import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseFile } from 'music-metadata';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// ── File Storage Setup ────────────────────────────────────

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

// ── Helper ────────────────────────────────────────────────

function getRoomAndVerify(code: string) {
  const room = db.prepare('SELECT * FROM Room WHERE code = ?').get(code.toUpperCase()) as any;
  if (!room || !room.isActive) return null;
  return room;
}

// ── Routes ────────────────────────────────────────────────

/**
 * GET /api/rooms/:code/tracks
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const room = getRoomAndVerify(code);
    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    const tracks = db.prepare('SELECT * FROM Track WHERE roomId = ? ORDER BY \`order\` ASC').all(room.id) as any[];
    tracks.forEach(t => {
      t.isUrl = !!t.isUrl;
    });

    res.json({ success: true, data: { tracks } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get tracks' });
  }
});

/**
 * POST /api/rooms/:code/tracks
 * Upload an audio file OR add a URL track.
 */
router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { code } = req.params;
      const room = getRoomAndVerify(code);
      if (!room) {
        res.status(404).json({ success: false, error: 'Room not found' });
        return;
      }

      const countResult = db.prepare('SELECT COUNT(*) as count FROM Track WHERE roomId = ?').get(room.id) as any;
      const count = countResult ? countResult.count : 0;

      let trackData: {
        title: string;
        artist: string | null;
        album: string | null;
        duration: number;
        fileUrl: string;
        mimeType: string;
        fileSize: number;
        isUrl: number;
      };

      if (req.file) {
        // File upload path
        const filePath = req.file.path;
        let title = path.basename(req.file.originalname, path.extname(req.file.originalname));
        let artist: string | null = null;
        let album: string | null = null;
        let duration = 0;

        try {
          const metadata = await parseFile(filePath);
          title = metadata.common.title || title;
          artist = metadata.common.artist || null;
          album = metadata.common.album || null;
          duration = metadata.format.duration || 0;
        } catch {
          // metadata parse failed, use filename
        }

        trackData = {
          title,
          artist,
          album,
          duration,
          fileUrl: `/uploads/${path.basename(filePath)}`,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          isUrl: 0,
        };
      } else if (req.body.url) {
        // External URL track
        const { url, title, artist } = req.body as {
          url: string;
          title?: string;
          artist?: string;
        };

        trackData = {
          title: title || 'Unknown Track',
          artist: artist || null,
          album: null,
          duration: 0, // will be updated client-side via Audio element
          fileUrl: url,
          mimeType: 'audio/mpeg',
          fileSize: 0,
          isUrl: 1,
        };
      } else {
        res.status(400).json({ success: false, error: 'No file or URL provided' });
        return;
      }

      const id = uuidv4();
      db.prepare(`
        INSERT INTO Track (id, roomId, title, artist, album, duration, fileUrl, mimeType, fileSize, \`order\`, isUrl)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        room.id,
        trackData.title,
        trackData.artist,
        trackData.album,
        trackData.duration,
        trackData.fileUrl,
        trackData.mimeType,
        trackData.fileSize,
        count,
        trackData.isUrl
      );

      const track = db.prepare('SELECT * FROM Track WHERE id = ?').get(id) as any;
      track.isUrl = !!track.isUrl;

      res.json({ success: true, data: { track } });
    } catch (error) {
      console.error('[Tracks] Upload error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload track' });
    }
  }
);

/**
 * DELETE /api/rooms/:code/tracks/:trackId
 */
router.delete('/:trackId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code, trackId } = req.params;
    const room = getRoomAndVerify(code);
    if (!room || room.hostId !== req.user!.userId) {
      res.status(403).json({ success: false, error: 'Only the host can remove tracks' });
      return;
    }

    const track = db.prepare('SELECT * FROM Track WHERE id = ? AND roomId = ?').get(trackId, room.id) as any;

    if (!track) {
      res.status(404).json({ success: false, error: 'Track not found' });
      return;
    }

    // Delete the physical file if it's an upload
    if (!track.isUrl) {
      const filePath = path.join(UPLOADS_DIR, path.basename(track.fileUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM Track WHERE id = ?').run(track.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete track' });
  }
});

/**
 * PATCH /api/rooms/:code/tracks/reorder
 * Reorder the playlist.
 */
router.patch('/reorder', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const { order } = req.body as { order: string[] }; // array of track IDs
    const room = getRoomAndVerify(code);
    if (!room || room.hostId !== req.user!.userId) {
      res.status(403).json({ success: false, error: 'Only the host can reorder tracks' });
      return;
    }

    const updateStmt = db.prepare('UPDATE Track SET \`order\` = ? WHERE id = ? AND roomId = ?');
    
    // Wrap updates in a transaction for speed and safety
    const reorderTransaction = db.transaction((orderIds: string[], roomId: string) => {
      orderIds.forEach((trackId, index) => {
        updateStmt.run(index, trackId, roomId);
      });
    });

    reorderTransaction(order, room.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reorder tracks' });
  }
});

export default router;
