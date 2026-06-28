'use client';

import { useEffect, useRef, useState, useCallback, MutableRefObject } from 'react';
import { Socket } from 'socket.io-client';
import { PlaybackState, Track, AudioPlayerState } from '@/types';
import { SERVER_URL, DRIFT_REPORT_INTERVAL, DRIFT_SMOOTH_RATE } from '@/lib/constants';

interface UseAudioPlayerOptions {
  socket: Socket | null;
  offsetRef: MutableRefObject<number>;
  volume: number;
}

/**
 * useAudioPlayer
 *
 * The core synchronized audio engine using Web Audio API.
 *
 * Synchronization flow:
 *   1. Server sends: { type: 'play', trackId, position, startServerTime }
 *   2. Client fetches & decodes audio (or uses URL)
 *   3. Converts startServerTime to local AudioContext time:
 *      localStart = audioCtx.currentTime
 *                 + (startServerTime - serverNow()) / 1000
 *                 - audioCtx.outputLatency
 *                 - audioCtx.baseLatency
 *   4. Calls source.start(localStart, position)
 *   5. Reports position every 2s for drift correction
 *
 * Drift correction:
 *   Server sends { expectedPosition, drift } if > 20ms off.
 *   We smoothly adjust playbackRate by ±0.002 max (imperceptible).
 */
export function useAudioPlayer({ socket, offsetRef, volume }: UseAudioPlayerOptions) {
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    status: 'idle',
    currentTime: 0,
    duration: 0,
    volume,
    isMuted: false,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startedAtRef = useRef<number>(0);      // audioCtx.currentTime when source started
  const startPositionRef = useRef<number>(0);  // track position in seconds when started
  const playbackStatusRef = useRef<'idle' | 'playing' | 'paused'>('idle');
  const currentTrackRef = useRef<Track | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const driftIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const animFrameRef = useRef<number | undefined>(undefined);
  const playQueueRef = useRef<{ command: any; track: Track } | null>(null);

  // ── AudioContext Initialization ───────────────────────────
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      audioCtxRef.current = new Ctx();
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.connect(audioCtxRef.current.destination);
    }
    return audioCtxRef.current as AudioContext;
  }, []);

  // ── Unlock Audio Context for Mobile ────────────────────────
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Play a short silent buffer to force unlock on iOS
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      console.log('[Audio] AudioContext successfully unlocked!');
      return true;
    } catch (err) {
      console.error('[Audio] Failed to unlock AudioContext:', err);
      return false;
    }
  }, [getAudioContext]);

  // ── Volume Control ─────────────────────────────────────────
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.05);
    }
  }, [volume]);

  // ── Current Time Tracking (animation frame) ───────────────
  const trackCurrentTime = useCallback(() => {
    if (playbackStatusRef.current !== 'playing' || !audioCtxRef.current) {
      animFrameRef.current = requestAnimationFrame(trackCurrentTime);
      return;
    }

    const elapsed = audioCtxRef.current.currentTime - startedAtRef.current;
    const currentTime = startPositionRef.current + Math.max(0, elapsed);

    setPlayerState((prev) => ({ ...prev, currentTime }));

    animFrameRef.current = requestAnimationFrame(trackCurrentTime);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(trackCurrentTime);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [trackCurrentTime]);

  // ── Stop Current Source ────────────────────────────────────
  const stopSource = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {}
    sourceRef.current = null;
    clearInterval(driftIntervalRef.current);
  }, []);

  // ── Schedule Playback ─────────────────────────────────────
  const schedulePlay = useCallback(
    async (track: Track, position: number, startServerTime: number) => {
      const ctx = getAudioContext();

      // Resume AudioContext if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') await ctx.resume();

      stopSource();
      setPlayerState((prev) => ({ ...prev, status: 'buffering' }));

      let buffer: AudioBuffer;

      if (audioBufferRef.current && currentTrackRef.current?.id === track.id) {
        // Use cached buffer
        buffer = audioBufferRef.current;
      } else {
        try {
          const audioUrl = track.isUrl ? track.fileUrl : `${SERVER_URL}${track.fileUrl}`;
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          buffer = await ctx.decodeAudioData(arrayBuffer);
          audioBufferRef.current = buffer;
          currentTrackRef.current = track;
        } catch (err) {
          console.error('[Audio] Failed to load track:', err);
          setPlayerState((prev) => ({ ...prev, status: 'error' }));
          return;
        }
      }

      // Calculate how many seconds until the scheduled start time
      const serverNow = Date.now() + offsetRef.current;
      const msUntilStart = startServerTime - serverNow;

      // Convert to AudioContext time:
      const outputLatency = (ctx as any).outputLatency || 0;
      const baseLatency = ctx.baseLatency || 0;
      const totalHwLatency = outputLatency + baseLatency;

      let startOffset = position;
      let targetStartTime = ctx.currentTime + (msUntilStart / 1000) - totalHwLatency;

      if (msUntilStart < 0) {
        // Playback has already started in the past. Calculate elapsed time and offset.
        const elapsedSeconds = -msUntilStart / 1000;
        startOffset = position + elapsedSeconds;

        if (startOffset >= buffer.duration) {
          console.log('[Audio] Target position exceeds track duration. Staying idle.');
          setPlayerState((prev) => ({ ...prev, status: 'idle' }));
          playbackStatusRef.current = 'idle';
          return;
        }

        // Start playing immediately (50ms buffer)
        targetStartTime = ctx.currentTime + 0.05;
      } else {
        // Future start: ensure we schedule it at least 50ms in the future for hardware preparation
        targetStartTime = Math.max(ctx.currentTime + 0.05, targetStartTime);
      }

      // Create new source node
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNodeRef.current!);

      source.onended = () => {
        if (playbackStatusRef.current === 'playing') {
          setPlayerState((prev) => ({ ...prev, status: 'idle', currentTime: 0 }));
          playbackStatusRef.current = 'idle';
        }
      };

      source.start(targetStartTime, startOffset);
      sourceRef.current = source;

      startedAtRef.current = targetStartTime;
      startPositionRef.current = startOffset;
      playbackStatusRef.current = 'playing';

      setPlayerState((prev) => ({
        ...prev,
        status: 'playing',
        duration: buffer.duration,
        currentTime: startOffset,
      }));

      console.log(
        `[Audio] Play scheduled. Offset: ${startOffset.toFixed(2)}s | Target time delta: ${(targetStartTime - ctx.currentTime).toFixed(3)}s | Latency: ${(totalHwLatency * 1000).toFixed(1)}ms`
      );

      // Start drift reporting
      startDriftReporting(startOffset, startServerTime);
    },
    [getAudioContext, stopSource, offsetRef]
  );

  // ── Drift Position Reporting ──────────────────────────────
  const startDriftReporting = useCallback(
    (startPosition: number, startServerTime: number) => {
      clearInterval(driftIntervalRef.current);

      if (!socket) return;

      driftIntervalRef.current = setInterval(() => {
        if (!audioCtxRef.current || playbackStatusRef.current !== 'playing') return;

        const ctx = audioCtxRef.current;
        const elapsed = ctx.currentTime - startedAtRef.current;
        const currentPosition = startPositionRef.current + Math.max(0, elapsed);

        const outputLatency = (ctx as any).outputLatency || 0;
        const baseLatency = ctx.baseLatency || 0;

        socket.emit('device:position', {
          position: currentPosition,
          roomCode: socket.io.opts?.query?.roomCode || '',
        });

        socket.emit('device:report', {
          position: currentPosition,
          localLatency: (outputLatency + baseLatency) * 1000,
          clockOffset: offsetRef.current,
        });
      }, DRIFT_REPORT_INTERVAL);
    },
    [socket, offsetRef]
  );

  // ── Drift Correction Handler ──────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleDriftCorrection = (data: { expectedPosition: number; drift: number }) => {
      if (!sourceRef.current || playbackStatusRef.current !== 'playing') return;

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const elapsed = ctx.currentTime - startedAtRef.current;
      const currentPosition = startPositionRef.current + elapsed;
      const diff = data.expectedPosition - currentPosition;

      // Apply gentle playback rate correction (imperceptible up to ~2%)
      const rateDelta = Math.sign(diff) * DRIFT_SMOOTH_RATE;
      const newRate = Math.min(1.02, Math.max(0.98, 1 + rateDelta));
      sourceRef.current.playbackRate.setTargetAtTime(newRate, ctx.currentTime, 0.5);

      // Return to normal rate after 3 seconds of correction
      setTimeout(() => {
        if (sourceRef.current) {
          sourceRef.current.playbackRate.setTargetAtTime(1, ctx.currentTime, 0.5);
        }
      }, 3000);

      console.log(`[Audio] Drift correction: ${(diff * 1000).toFixed(1)}ms → rate ${newRate.toFixed(4)}`);
    };

    socket.on('playback:drift_correction', handleDriftCorrection);
    return () => { socket.off('playback:drift_correction', handleDriftCorrection); };
  }, [socket]);

  // ── Playback Command Handler ──────────────────────────────
  const handlePlaybackCommand = useCallback(
    async (command: PlaybackState & { serverTime?: number }, playlist: Track[]) => {
      switch (command.status) {
        case 'playing': {
          if (!command.trackId || !command.startServerTime) return;
          const track = playlist.find((t) => t.id === command.trackId);
          if (!track) return;
          await schedulePlay(track, command.position || 0, command.startServerTime);
          break;
        }
        case 'paused': {
          stopSource();
          const ctx = audioCtxRef.current;
          if (ctx) {
            const elapsed = ctx.currentTime - startedAtRef.current;
            startPositionRef.current = startPositionRef.current + Math.max(0, elapsed);
          }
          playbackStatusRef.current = 'paused';
          setPlayerState((prev) => ({ ...prev, status: 'paused' }));
          break;
        }
        case 'idle': {
          stopSource();
          playbackStatusRef.current = 'idle';
          setPlayerState((prev) => ({ ...prev, status: 'idle', currentTime: 0 }));
          break;
        }
      }
    },
    [schedulePlay, stopSource]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      stopSource();
      audioCtxRef.current?.close();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [stopSource]);

  return {
    playerState,
    handlePlaybackCommand,
    stopSource,
    schedulePlay,
    unlockAudio,
  };
}
