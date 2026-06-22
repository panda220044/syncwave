import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { RedisRoom } from '../lib/redis';
import { verifyToken } from '../lib/jwt';
import { PlaybackCommandPayload, PlaybackState } from '@musicsystem/shared';

// ── Playback Buffer Time ──────────────────────────────────
// How far in the future to schedule play commands.
// 3 seconds gives all devices time to receive the command and buffer audio.
const PLAY_BUFFER_MS = 3000;

// ── Drift Correction Interval ─────────────────────────────
// Every N ms, compare reported positions and send corrections if needed.
const DRIFT_CHECK_INTERVAL_MS = 5000;
const DRIFT_THRESHOLD_MS = 20; // if drift > 20ms, correct it

// Track per-room drift check intervals
const driftIntervals = new Map<string, ReturnType<typeof setInterval>>();

// Per-device reported positions for drift calculation
const devicePositions = new Map<string, { position: number; reportedAt: number }>();

export function registerPlaybackHandlers(io: Server, socket: Socket): void {
  socket.on('playback:command', async (payload: PlaybackCommandPayload & { roomCode: string; token: string }) => {
    try {
      const { roomCode, token, type, trackId, position } = payload;
      const upperCode = roomCode.toUpperCase();

      // Verify JWT and host status
      let user: { userId: string };
      try {
        user = verifyToken(token);
      } catch {
        socket.emit('room:error', { message: 'Unauthorized' });
        return;
      }

      const room = db.prepare('SELECT * FROM Room WHERE code = ?').get(upperCode) as any;
      if (!room || !room.isActive) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      // Only host can send playback commands
      if (room.hostId !== user.userId) {
        socket.emit('room:error', { message: 'Only the host can control playback' });
        return;
      }

      const now = Date.now();
      let newState: PlaybackState;

      switch (type) {
        case 'play': {
          // Schedule playback PLAY_BUFFER_MS in the future to give all clients time to prepare
          const startServerTime = now + PLAY_BUFFER_MS;

          newState = {
            status: 'playing',
            trackId: trackId || null,
            position: position ?? 0,
            startServerTime,
            scheduledAt: now,
          };

          // Log the event
          db.prepare(`
            INSERT INTO PlaybackEvent (id, roomId, type, trackId, position, serverTime, deviceId)
            VALUES (?, ?, 'play', ?, ?, ?, ?)
          `).run(uuidv4(), room.id, trackId || null, position ?? 0, now, socket.id);

          // Start drift monitoring for this room
          startDriftMonitoring(io, upperCode);
          break;
        }

        case 'pause': {
          newState = {
            status: 'paused',
            trackId: trackId || null,
            position: position ?? 0,
            startServerTime: now, // pause effective immediately
            scheduledAt: now,
          };

          db.prepare(`
            INSERT INTO PlaybackEvent (id, roomId, type, trackId, position, serverTime, deviceId)
            VALUES (?, ?, 'pause', ?, ?, ?, ?)
          `).run(uuidv4(), room.id, trackId || null, position ?? 0, now, socket.id);

          stopDriftMonitoring(upperCode);
          break;
        }

        case 'seek': {
          // For seek, schedule a future start like play
          const startServerTime = now + PLAY_BUFFER_MS;

          newState = {
            status: 'playing',
            trackId: trackId || null,
            position: position ?? 0,
            startServerTime,
            scheduledAt: now,
          };

          db.prepare(`
            INSERT INTO PlaybackEvent (id, roomId, type, trackId, position, serverTime, deviceId)
            VALUES (?, ?, 'seek', ?, ?, ?, ?)
          `).run(uuidv4(), room.id, trackId || null, position ?? 0, now, socket.id);
          break;
        }

        case 'stop': {
          newState = {
            status: 'idle',
            trackId: null,
            position: 0,
            startServerTime: null,
            scheduledAt: now,
          };

          db.prepare(`
            INSERT INTO PlaybackEvent (id, roomId, type, trackId, position, serverTime, deviceId)
            VALUES (?, ?, 'stop', NULL, 0, ?, ?)
          `).run(uuidv4(), room.id, now, socket.id);

          stopDriftMonitoring(upperCode);
          break;
        }

        case 'next':
        case 'prev': {
          const tracks = db.prepare('SELECT * FROM Track WHERE roomId = ? ORDER BY \`order\` ASC').all(room.id) as any[];

          const currentIndex = tracks.findIndex((t) => t.id === trackId);
          let nextTrack =
            type === 'next'
              ? tracks[currentIndex + 1] || tracks[0]
              : tracks[currentIndex - 1] || tracks[tracks.length - 1];

          if (!nextTrack) {
            socket.emit('room:error', { message: 'No tracks in playlist' });
            return;
          }

          newState = {
            status: 'playing',
            trackId: nextTrack.id,
            position: 0,
            startServerTime: now + PLAY_BUFFER_MS,
            scheduledAt: now,
          };

          db.prepare(`
            INSERT INTO PlaybackEvent (id, roomId, type, trackId, position, serverTime, deviceId)
            VALUES (?, ?, ?, ?, 0, ?, ?)
          `).run(uuidv4(), room.id, type, nextTrack.id, now, socket.id);
          break;
        }

        default:
          return;
      }

      // Persist in Redis
      await RedisRoom.setPlaybackState(upperCode, JSON.stringify(newState));

      // Broadcast to ALL clients in the room (including host)
      io.to(upperCode).emit('playback:command', {
        ...newState,
        serverTime: now,
      });

    } catch (error) {
      console.error('[Playback] Command error:', error);
      socket.emit('room:error', { message: 'Playback command failed' });
    }
  });

  // ── Device Position Report for Drift Correction ───────
  socket.on('device:position', (payload: { position: number; roomCode: string }) => {
    devicePositions.set(socket.id, {
      position: payload.position,
      reportedAt: Date.now(),
    });
  });
}

// ── Drift Monitoring ──────────────────────────────────────

function startDriftMonitoring(io: Server, code: string): void {
  stopDriftMonitoring(code); // clear any existing

  const interval = setInterval(async () => {
    const rawPlayback = await RedisRoom.getPlaybackState(code);
    if (!rawPlayback) return;

    const playback: PlaybackState = JSON.parse(rawPlayback);
    if (playback.status !== 'playing' || !playback.startServerTime) return;

    const now = Date.now();
    const expectedPosition =
      playback.position + (now - playback.startServerTime) / 1000;

    // Check each device that has reported
    const rawDevices = await RedisRoom.getDevices(code);

    for (const deviceId of Object.keys(rawDevices)) {
      const report = devicePositions.get(deviceId);
      if (!report) continue;

      const reportAge = now - report.reportedAt;
      if (reportAge > 10000) continue; // stale report

      const drift = Math.abs(report.position - expectedPosition) * 1000; // ms

      if (drift > DRIFT_THRESHOLD_MS) {
        // Send gentle correction — client will use playbackRate adjustment
        const targetSocket = [...io.sockets.sockets.values()].find(
          (s) => s.id === deviceId
        );

        if (targetSocket) {
          targetSocket.emit('playback:drift_correction', {
            expectedPosition,
            drift,
            serverTime: now,
          });
        }
      }
    }
  }, DRIFT_CHECK_INTERVAL_MS);

  driftIntervals.set(code, interval);
}

function stopDriftMonitoring(code: string): void {
  const interval = driftIntervals.get(code);
  if (interval) {
    clearInterval(interval);
    driftIntervals.delete(code);
  }
}
