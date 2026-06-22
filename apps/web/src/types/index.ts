// Re-export from shared package + web-specific types

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
  album: string | null;
  duration: number;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  order: number;
  roomId: string;
  isUrl: boolean;
}

export interface PlaybackState {
  status: 'idle' | 'playing' | 'paused' | 'buffering';
  trackId: string | null;
  position: number;
  startServerTime: number | null;
  scheduledAt: number | null;
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

export interface ClockSyncState {
  offset: number;          // ms — add to Date.now() to get server time
  rtt: number;             // ms — round-trip time
  syncedAt: number;        // local epoch ms when last synced
  isSyncing: boolean;
  quality: 'excellent' | 'good' | 'poor' | 'unsynced';
}

export interface AudioPlayerState {
  status: 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error';
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

export interface ApiError {
  success: false;
  error: string;
}

export interface AuthData {
  token: string;
  userId: string;
  displayName: string;
}
