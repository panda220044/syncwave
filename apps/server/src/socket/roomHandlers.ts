import { Server, Socket } from 'socket.io';
import db from '../lib/db';
import { RedisRoom } from '../lib/redis';
import { verifyToken } from '../lib/jwt';
import {
  RoomJoinPayload,
  RoomStatePayload,
  Device,
  DeviceReportPayload,
  DeviceVolumePayload,
} from '../types/shared';

// In-memory map of socketId → { code, deviceId }
const socketRoomMap = new Map<string, { code: string; deviceId: string }>();

export function registerRoomHandlers(io: Server, socket: Socket): void {
  // ── Join Room ──────────────────────────────────────────
  socket.on('room:join', async (payload: RoomJoinPayload) => {
    try {
      const { code, deviceName, token } = payload;
      const upperCode = code.toUpperCase();

      // Verify JWT
      let user: { userId: string; displayName: string };
      try {
        user = verifyToken(token);
      } catch {
        socket.emit('room:error', { message: 'Invalid auth token' });
        return;
      }

      // Check room exists in DB
      const room = db.prepare('SELECT * FROM Room WHERE code = ?').get(upperCode) as any;

      if (!room || !room.isActive) {
        socket.emit('room:error', { message: 'Room not found or has ended' });
        return;
      }

      // Map properties for SQLite
      room.isActive = !!room.isActive;
      
      const playlist = db.prepare('SELECT * FROM Track WHERE roomId = ? ORDER BY \`order\` ASC').all(room.id) as any[];
      playlist.forEach(t => {
        t.isUrl = !!t.isUrl;
      });
      room.playlist = playlist;

      const isHost = room.hostId === user.userId;
      const deviceId = socket.id;

      const device: Device = {
        id: deviceId,
        socketId: socket.id,
        name: deviceName || user.displayName,
        isHost,
        latency: null,
        connectionQuality: 'excellent',
        joinedAt: Date.now(),
        volume: 1,
      };

      // Store in Redis
      await RedisRoom.addDevice(upperCode, deviceId, JSON.stringify(device));

      // Join socket room
      await socket.join(upperCode);
      socketRoomMap.set(socket.id, { code: upperCode, deviceId });

      // Get current playback state
      const rawPlayback = await RedisRoom.getPlaybackState(upperCode);
      const playbackState = rawPlayback
        ? JSON.parse(rawPlayback)
        : { status: 'idle', trackId: null, position: 0, startServerTime: null, scheduledAt: null };

      // Get all devices
      const rawDevices = await RedisRoom.getDevices(upperCode);
      const devices: Device[] = Object.values(rawDevices).map((d) => JSON.parse(d));

      // Send current state to joiner
      const statePayload: RoomStatePayload = {
        room: {
          id: room.id,
          code: room.code,
          hostId: room.hostId,
          isActive: room.isActive,
          playlist: room.playlist as any,
          devices,
          currentTrack: room.playlist.find((t: any) => t.id === playbackState.trackId) as any || null,
          playbackState,
          createdAt: typeof room.createdAt === 'string' ? new Date(room.createdAt).getTime() : room.createdAt,
        },
        yourDeviceId: deviceId,
      };

      socket.emit('room:state', statePayload);

      // Broadcast updated device list to everyone in room
      io.to(upperCode).emit('room:devices', { devices });

      console.log(`[Room] ${device.name} joined ${upperCode} (host: ${isHost})`);
    } catch (error) {
      console.error('[Room] Join error:', error);
      socket.emit('room:error', { message: 'Failed to join room' });
    }
  });

  // ── Leave Room ─────────────────────────────────────────
  socket.on('room:leave', async () => {
    await handleLeave(io, socket);
  });

  socket.on('disconnect', async () => {
    await handleLeave(io, socket);
  });

  // ── Device Volume ──────────────────────────────────────
  socket.on('device:volume', async (payload: DeviceVolumePayload) => {
    const info = socketRoomMap.get(socket.id);
    if (!info) return;

    const rawDevices = await RedisRoom.getDevices(info.code);
    const deviceData = rawDevices[info.deviceId];
    if (!deviceData) return;

    const device: Device = JSON.parse(deviceData);
    device.volume = Math.min(1, Math.max(0, payload.volume));

    await RedisRoom.addDevice(info.code, info.deviceId, JSON.stringify(device));

    // No need to broadcast individual volume — it's per-device local control
  });

  // ── Device Report (Drift Monitoring) ──────────────────
  socket.on('device:report', async (payload: DeviceReportPayload) => {
    const info = socketRoomMap.get(socket.id);
    if (!info) return;

    const rawDevices = await RedisRoom.getDevices(info.code);
    const deviceData = rawDevices[info.deviceId];
    if (!deviceData) return;

    const device: Device = JSON.parse(deviceData);

    // Update latency and connection quality
    device.latency = payload.localLatency;
    device.connectionQuality =
      payload.localLatency < 30
        ? 'excellent'
        : payload.localLatency < 80
        ? 'good'
        : 'poor';

    await RedisRoom.addDevice(info.code, info.deviceId, JSON.stringify(device));

    // Broadcast updated latency to all in room (for the dashboard)
    io.to(info.code).emit('device:latency', {
      deviceId: info.deviceId,
      latency: device.latency,
      quality: device.connectionQuality,
    });
  });
}

async function handleLeave(io: Server, socket: Socket): Promise<void> {
  const info = socketRoomMap.get(socket.id);
  if (!info) return;

  socketRoomMap.delete(socket.id);
  await RedisRoom.removeDevice(info.code, info.deviceId);
  await socket.leave(info.code);

  // Update device list for remaining members
  const rawDevices = await RedisRoom.getDevices(info.code);
  const devices: Device[] = Object.values(rawDevices).map((d) => JSON.parse(d));

  io.to(info.code).emit('room:devices', { devices });

  console.log(`[Room] Device ${info.deviceId} left ${info.code}`);
}
