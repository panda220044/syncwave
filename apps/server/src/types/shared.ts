// Inlined shared types — avoids npm workspace resolution issues on Railway
// This mirrors packages/shared/src/types.ts exactly

export interface Device {
  id: string;
  socketId: string;
  name: string;
  isHost: boolean;
  latency: number | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  joinedAt: number;
  volume: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string | null;
  duration: number;
  fileUrl: string;
  order: number;
  roomId: string;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  isActive: boolean;
  playlist: Track[];
  devices: Device[];
  currentTrack: Track | null;
  playbackState: PlaybackState;
  createdAt: number;
}

export interface PlaybackState {
  status: 'idle' | 'playing' | 'paused' | 'buffering';
  trackId: string | null;
  position: number;
  startServerTime: number | null;
  scheduledAt: number | null;
}

// ── Socket Event Payloads ─────────────────────────────────

export interface ClockPingPayload {
  t0: number;
}

export interface ClockPongPayload {
  t0: number;
  t1: number;
  t2: number;
}

export interface RoomJoinPayload {
  code: string;
  deviceName: string;
  token: string;
}

export interface RoomStatePayload {
  room: Room;
  yourDeviceId: string;
}

export interface PlaybackCommandPayload {
  type: 'play' | 'pause' | 'seek' | 'stop' | 'next' | 'prev';
  trackId?: string;
  position?: number;
  startServerTime?: number;
}

export interface DeviceReportPayload {
  position: number;
  localLatency: number;
  clockOffset: number;
}

export interface DeviceVolumePayload {
  deviceId: string;
  volume: number;
}

export interface HostTransferPayload {
  newHostDeviceId: string;
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  displayName: string;
}

export interface CreateRoomResponse {
  room: Room;
  qrCodeDataUrl: string;
}
