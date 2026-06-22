// Shared types for socket events and API responses
// Used by both apps/server and apps/web

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
  position: number;        // seconds
  startServerTime: number | null; // epoch ms when playback should start
  scheduledAt: number | null;     // epoch ms when command was issued
}

// ── Socket Event Payloads ─────────────────────────────────

export interface ClockPingPayload {
  t0: number; // client epoch ms at send time
}

export interface ClockPongPayload {
  t0: number; // echoed back
  t1: number; // server receive time
  t2: number; // server send time
}

export interface RoomJoinPayload {
  code: string;
  deviceName: string;
  token: string; // JWT
}

export interface RoomStatePayload {
  room: Room;
  yourDeviceId: string;
}

export interface PlaybackCommandPayload {
  type: 'play' | 'pause' | 'seek' | 'stop' | 'next' | 'prev';
  trackId?: string;
  position?: number;       // seconds
  startServerTime?: number; // epoch ms — when to start (future time)
}

export interface DeviceReportPayload {
  position: number;        // reported current position in seconds
  localLatency: number;    // ms — measured outputLatency + baseLatency
  clockOffset: number;     // ms — client's measured NTP offset
}

export interface DeviceVolumePayload {
  deviceId: string;
  volume: number; // 0–1
}

export interface HostTransferPayload {
  newHostDeviceId: string;
}

// ── API Response Types ───────────────────────────────────

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
