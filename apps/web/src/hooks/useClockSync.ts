'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { ClockSyncState } from '@/types';
import { CLOCK_SYNC_ROUNDS, CLOCK_SYNC_INTERVAL } from '@/lib/constants';

/**
 * useClockSync
 *
 * Implements NTP-style clock offset estimation.
 *
 * Algorithm:
 *   1. Send CLOCK_SYNC_ROUNDS ping packets to server
 *   2. Each ping: t0=send, server echoes t1=receive, t2=send, we record t3=receive
 *   3. offset = ((t1-t0) + (t2-t3)) / 2
 *   4. Take the median offset from all rounds (outlier-resistant)
 *   5. Re-run every CLOCK_SYNC_INTERVAL ms
 *
 * Usage:
 *   const { offset, serverNow } = useClockSync(socket)
 *   const serverTime = serverNow() // current estimated server epoch ms
 */
export function useClockSync(socket: Socket | null) {
  const [state, setState] = useState<ClockSyncState>({
    offset: 0,
    rtt: 0,
    syncedAt: 0,
    isSyncing: false,
    quality: 'unsynced',
  });

  const offsetRef = useRef(0);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const pendingPingsRef = useRef<Map<number, number>>(new Map()); // t0 → promise resolve

  const runSync = useCallback(() => {
    if (!socket?.connected) return;

    setState((prev) => ({ ...prev, isSyncing: true }));
    const offsets: number[] = [];
    const rtts: number[] = [];
    let round = 0;

    function sendPing() {
      if (round >= CLOCK_SYNC_ROUNDS) {
        // All rounds done — compute median
        offsets.sort((a, b) => a - b);
        rtts.sort((a, b) => a - b);

        const median = (arr: number[]) =>
          arr.length % 2 === 0
            ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2
            : arr[Math.floor(arr.length / 2)];

        const medianOffset = median(offsets);
        const medianRtt = median(rtts);

        offsetRef.current = medianOffset;

        setState({
          offset: medianOffset,
          rtt: medianRtt,
          syncedAt: Date.now(),
          isSyncing: false,
          quality:
            medianRtt < 30 ? 'excellent' :
            medianRtt < 80 ? 'good' : 'poor',
        });
        return;
      }

      round++;
      const t0 = Date.now();

      if (socket) socket.emit('clock:ping', { t0 });

      // Small delay between rounds to avoid flooding
      setTimeout(sendPing, 100);
    }

    // Set up the pong handler for this sync session
    const handlePong = (data: { t0: number; t1: number; t2: number }) => {
      const t3 = Date.now();
      const { t0, t1, t2 } = data;

      const offset = ((t1 - t0) + (t2 - t3)) / 2;
      const rtt = (t3 - t0) - (t2 - t1);

      offsets.push(offset);
      rtts.push(Math.max(0, rtt));
    };

    socket.on('clock:pong', handlePong);

    sendPing();

    // Cleanup pong listener after sync completes
    setTimeout(() => {
      socket.off('clock:pong', handlePong);
    }, CLOCK_SYNC_ROUNDS * 200 + 500);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    // Run initial sync when socket connects
    socket.on('connect', runSync);
    if (socket.connected) runSync();

    // Periodic re-sync
    syncIntervalRef.current = setInterval(runSync, CLOCK_SYNC_INTERVAL);

    return () => {
      socket.off('connect', runSync);
      clearInterval(syncIntervalRef.current);
    };
  }, [socket, runSync]);

  /**
   * Returns current estimated server time in epoch ms.
   * Formula: Date.now() + clockOffset
   */
  const serverNow = useCallback((): number => {
    return Date.now() + offsetRef.current;
  }, []);

  return { ...state, serverNow, offsetRef };
}
