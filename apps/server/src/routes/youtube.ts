import { Router, Request, Response } from 'express';
import ytdl from '@distube/ytdl-core';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/youtube/info?url=<youtube_url>
 * Returns metadata about a YouTube video: title, author, duration, thumbnailUrl
 */
router.get('/info', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.query as { url?: string };
    if (!url) {
      res.status(400).json({ success: false, error: 'url query parameter is required' });
      return;
    }

    if (!ytdl.validateURL(url)) {
      res.status(400).json({ success: false, error: 'Invalid YouTube URL' });
      return;
    }

    const info = await ytdl.getInfo(url);
    const details = info.videoDetails;

    // Pick best audio-only format
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    res.json({
      success: true,
      data: {
        videoId: details.videoId,
        title: details.title,
        author: details.author?.name || 'Unknown',
        duration: parseInt(details.lengthSeconds, 10),
        thumbnailUrl: details.thumbnails?.[details.thumbnails.length - 1]?.url || null,
        audioUrl: audioFormat?.url || null,
        itag: audioFormat?.itag,
      },
    });
  } catch (error: any) {
    console.error('[YouTube] Info error:', error?.message);
    res.status(500).json({ success: false, error: 'Failed to fetch YouTube info. The video may be unavailable or age-restricted.' });
  }
});

/**
 * GET /api/youtube/stream?url=<youtube_url>
 * Streams the audio directly. Used as an audio src that all clients fetch simultaneously.
 * This bypasses the YouTube player → no ads, perfect sync.
 */
router.get('/stream', async (req: Request, res: Response) => {
  try {
    const { url } = req.query as { url?: string };
    if (!url || !ytdl.validateURL(url)) {
      res.status(400).send('Invalid URL');
      return;
    }

    // Get video info to set headers
    const info = await ytdl.getInfo(url);
    const details = info.videoDetails;
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    if (!audioFormat) {
      res.status(404).send('No audio format available');
      return;
    }

    // Set headers for audio streaming
    res.setHeader('Content-Type', audioFormat.mimeType?.split(';')[0] || 'audio/webm');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(details.title)}.webm"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Handle range requests (for seeking)
    const rangeHeader = req.headers.range;

    if (audioFormat.contentLength) {
      const totalSize = parseInt(audioFormat.contentLength, 10);
      res.setHeader('Content-Length', totalSize);

      if (rangeHeader) {
        const parts = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', end - start + 1);
      }
    }

    // Pipe audio stream from YouTube CDN directly to client
    const stream = ytdl(url, {
      format: audioFormat,
      begin: rangeHeader ? rangeHeader.replace('bytes=', '').split('-')[0] + 'B' : '0s',
    });

    stream.on('error', (err) => {
      console.error('[YouTube] Stream error:', err.message);
      if (!res.headersSent) res.status(500).send('Stream error');
    });

    req.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (error: any) {
    console.error('[YouTube] Stream error:', error?.message);
    if (!res.headersSent) res.status(500).send('Failed to stream audio');
  }
});

export default router;
