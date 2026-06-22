import { Router, Response } from 'express';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateRoomCode } from '../utils/roomCode';
import { RedisRoom } from '../lib/redis';

const router = Router();

/**
 * POST /api/rooms
 * Create a new room. Returns room + QR code data URL.
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    // Generate unique room code
    let code: string | null = null;
    let attempts = 0;
    do {
      const prospectiveCode = generateRoomCode();
      const existing = db.prepare('SELECT id FROM Room WHERE code = ?').get(prospectiveCode);
      if (!existing) {
        code = prospectiveCode;
        break;
      }
      attempts++;
    } while (attempts < 10);

    if (!code) {
      res.status(500).json({ success: false, error: 'Could not generate unique room code' });
      return;
    }

    const roomId = uuidv4();
    db.prepare(
      'INSERT INTO Room (id, code, hostId, isActive) VALUES (?, ?, ?, 1)'
    ).run(roomId, code, user.userId);

    // Get the room we just created
    const room = db.prepare('SELECT * FROM Room WHERE id = ?').get(roomId) as any;
    room.playlist = []; // Freshly created room has no tracks

    // Activate in Redis for fast presence checks
    await RedisRoom.setActive(code, true);

    // Generate QR code for the join URL
    const joinUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/join/${code}`;
    const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
      width: 256,
      color: { dark: '#ffffff', light: '#00000000' },
    });

    res.json({
      success: true,
      data: {
        room: {
          ...room,
          isActive: !!room.isActive,
          devices: [],
          currentTrack: null,
          playbackState: {
            status: 'idle',
            trackId: null,
            position: 0,
            startServerTime: null,
            scheduledAt: null,
          },
        },
        qrCodeDataUrl,
      },
    });
  } catch (error) {
    console.error('[Rooms] Create error:', error);
    res.status(500).json({ success: false, error: 'Failed to create room' });
  }
});

/**
 * GET /api/rooms/:code
 * Get room state.
 */
router.get('/:code', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();

    const room = db.prepare('SELECT * FROM Room WHERE code = ?').get(upperCode) as any;

    if (!room || !room.isActive) {
      res.status(404).json({ success: false, error: 'Room not found or inactive' });
      return;
    }

    // Convert isActive back to boolean
    room.isActive = !!room.isActive;

    // Get playlist tracks
    const playlist = db.prepare('SELECT * FROM Track WHERE roomId = ? ORDER BY \`order\` ASC').all(room.id) as any[];
    playlist.forEach(t => {
      t.isUrl = !!t.isUrl;
    });
    room.playlist = playlist;

    // Get host details
    const host = db.prepare('SELECT id, displayName FROM User WHERE id = ?').get(room.hostId) as any;
    room.host = host;

    // Get active devices from Redis
    const rawDevices = await RedisRoom.getDevices(upperCode);
    const devices = Object.values(rawDevices).map((d) => JSON.parse(d));

    // Get playback state from Redis
    const rawPlayback = await RedisRoom.getPlaybackState(upperCode);
    const playbackState = rawPlayback
      ? JSON.parse(rawPlayback)
      : { status: 'idle', trackId: null, position: 0, startServerTime: null, scheduledAt: null };

    res.json({
      success: true,
      data: {
        room: {
          ...room,
          devices,
          playbackState,
          currentTrack: room.playlist.find((t: any) => t.id === playbackState.trackId) || null,
        },
      },
    });
  } catch (error) {
    console.error('[Rooms] Get error:', error);
    res.status(500).json({ success: false, error: 'Failed to get room' });
  }
});

/**
 * DELETE /api/rooms/:code
 * Close a room (host only).
 */
router.delete('/:code', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();
    const user = req.user!;

    const room = db.prepare('SELECT * FROM Room WHERE code = ?').get(upperCode) as any;

    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    if (room.hostId !== user.userId) {
      res.status(403).json({ success: false, error: 'Only the host can close the room' });
      return;
    }

    db.prepare('UPDATE Room SET isActive = 0, updatedAt = datetime(\'now\') WHERE id = ?').run(room.id);

    await RedisRoom.cleanup(upperCode);

    res.json({ success: true });
  } catch (error) {
    console.error('[Rooms] Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to close room' });
  }
});

/**
 * POST /api/rooms/:code/transfer
 * Transfer host role to another device.
 */
router.post('/:code/transfer', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();
    const { newHostUserId } = req.body as { newHostUserId: string };
    const user = req.user!;

    const room = db.prepare('SELECT * FROM Room WHERE code = ?').get(upperCode) as any;

    if (!room || room.hostId !== user.userId) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    db.prepare('UPDATE Room SET hostId = ?, updatedAt = datetime(\'now\') WHERE id = ?').run(newHostUserId, room.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to transfer host' });
  }
});

export default router;
