import { AuthData } from '@/types';
import { SERVER_URL } from './constants';

const BASE = SERVER_URL;

function getHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data as T;
}

// ── Auth ──────────────────────────────────────────────────

export async function joinAnonymously(displayName: string): Promise<AuthData> {
  const res = await fetch(`${BASE}/api/auth/join`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ displayName }),
  });
  return handleResponse<AuthData>(res);
}

// ── Rooms ─────────────────────────────────────────────────

export async function createRoom(token: string) {
  const res = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  return handleResponse<{ room: any; qrCodeDataUrl: string }>(res);
}

export async function getRoom(code: string, token: string) {
  const res = await fetch(`${BASE}/api/rooms/${code}`, {
    headers: getHeaders(token),
  });
  return handleResponse<{ room: any }>(res);
}

export async function closeRoom(code: string, token: string) {
  const res = await fetch(`${BASE}/api/rooms/${code}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  return handleResponse<void>(res);
}

// ── Tracks ────────────────────────────────────────────────

export async function uploadTrack(
  roomCode: string,
  token: string,
  file: File
): Promise<{ track: any }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE}/api/rooms/${roomCode}/tracks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // No Content-Type — multipart
    body: formData,
  });
  return handleResponse<{ track: any }>(res);
}

export async function addUrlTrack(
  roomCode: string,
  token: string,
  url: string,
  title?: string,
  artist?: string
): Promise<{ track: any }> {
  const res = await fetch(`${BASE}/api/rooms/${roomCode}/tracks`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ url, title, artist }),
  });
  return handleResponse<{ track: any }>(res);
}

export async function deleteTrack(
  roomCode: string,
  token: string,
  trackId: string
): Promise<void> {
  const res = await fetch(`${BASE}/api/rooms/${roomCode}/tracks/${trackId}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  return handleResponse<void>(res);
}

export async function reorderTracks(
  roomCode: string,
  token: string,
  order: string[]
): Promise<void> {
  const res = await fetch(`${BASE}/api/rooms/${roomCode}/tracks/reorder`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({ order }),
  });
  return handleResponse<void>(res);
}

// ── YouTube ───────────────────────────────────────────────

export interface YoutubeInfo {
  videoId: string;
  title: string;
  author: string;
  duration: number;
  thumbnailUrl: string | null;
  audioUrl: string | null;
}

export async function getYoutubeInfo(
  youtubeUrl: string,
  token: string
): Promise<YoutubeInfo> {
  const res = await fetch(
    `${BASE}/api/youtube/info?url=${encodeURIComponent(youtubeUrl)}`,
    { headers: getHeaders(token) }
  );
  return handleResponse<YoutubeInfo>(res);
}

/** Returns the proxy stream URL — audio served from our backend, zero ads */
export function getYoutubeStreamUrl(youtubeUrl: string): string {
  return `${BASE}/api/youtube/stream?url=${encodeURIComponent(youtubeUrl)}`;
}
