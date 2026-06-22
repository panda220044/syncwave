'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Room, Device, PlaybackState, Track } from '@/types';
import { AuthData } from '@/types';

interface UseRoomOptions {
  socket: Socket | null;
  auth: AuthData | null;
}

export function useRoom({ socket, auth }: UseRoomOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    status: 'idle',
    trackId: null,
    position: 0,
    startServerTime: null,
    scheduledAt: null,
  });
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinedRoomCode = useRef<string | null>(null);

  const joinRoom = useCallback(
    async (code: string, deviceName: string) => {
      if (!socket || !auth) return;
      setIsJoining(true);
      setError(null);

      if (!socket.connected) {
        socket.connect();
        await new Promise<void>((resolve) => {
          socket.once('connect', resolve);
        });
      }

      socket.emit('room:join', {
        code: code.toUpperCase(),
        deviceName,
        token: auth.token,
      });
      joinedRoomCode.current = code.toUpperCase();
    },
    [socket, auth]
  );

  const leaveRoom = useCallback(() => {
    socket?.emit('room:leave');
    joinedRoomCode.current = null;
    setRoom(null);
    setMyDeviceId(null);
    setDevices([]);
  }, [socket]);

  const isHost = useCallback(() => {
    if (!room || !auth) return false;
    return room.hostId === auth.userId;
  }, [room, auth]);

  const sendPlayback = useCallback(
    (type: string, trackId?: string, position?: number) => {
      if (!socket || !auth || !joinedRoomCode.current) return;
      socket.emit('playback:command', {
        type,
        trackId,
        position,
        roomCode: joinedRoomCode.current,
        token: auth.token,
      });
    },
    [socket, auth]
  );

  // ── Socket Event Listeners ─────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (data: { room: Room; yourDeviceId: string }) => {
      setRoom(data.room);
      setDevices(data.room.devices);
      setPlaybackState(data.room.playbackState);
      setMyDeviceId(data.yourDeviceId);
      setIsJoining(false);
    };

    const handleDevices = (data: { devices: Device[] }) => {
      setDevices(data.devices);
    };

    const handlePlaybackCommand = (cmd: PlaybackState & { serverTime: number }) => {
      setPlaybackState(cmd);
      // Update current track in room
      setRoom((prev) => {
        if (!prev) return prev;
        const currentTrack = prev.playlist.find((t) => t.id === cmd.trackId) || null;
        return { ...prev, playbackState: cmd, currentTrack };
      });
    };

    const handleRoomError = (data: { message: string }) => {
      setError(data.message);
      setIsJoining(false);
    };

    const handleDeviceLatency = (data: { deviceId: string; latency: number; quality: string }) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === data.deviceId
            ? { ...d, latency: data.latency, connectionQuality: data.quality as Device['connectionQuality'] }
            : d
        )
      );
    };

    socket.on('room:state', handleRoomState);
    socket.on('room:devices', handleDevices);
    socket.on('playback:command', handlePlaybackCommand);
    socket.on('room:error', handleRoomError);
    socket.on('device:latency', handleDeviceLatency);

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('room:devices', handleDevices);
      socket.off('playback:command', handlePlaybackCommand);
      socket.off('room:error', handleRoomError);
      socket.off('device:latency', handleDeviceLatency);
    };
  }, [socket]);

  const addTrackToPlaylist = useCallback((track: Track) => {
    setRoom((prev) =>
      prev ? { ...prev, playlist: [...prev.playlist, track] } : prev
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((trackId: string) => {
    setRoom((prev) =>
      prev
        ? { ...prev, playlist: prev.playlist.filter((t) => t.id !== trackId) }
        : prev
    );
  }, []);

  return {
    room,
    myDeviceId,
    devices,
    playbackState,
    isJoining,
    error,
    joinRoom,
    leaveRoom,
    isHost,
    sendPlayback,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    currentTrack: room?.playlist.find((t) => t.id === playbackState.trackId) || null,
  };
}
