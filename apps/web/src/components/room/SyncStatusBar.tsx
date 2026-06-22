'use client';

import { ClockSyncState } from '@/types';
import styles from './SyncStatusBar.module.css';

interface SyncStatusBarProps {
  syncState: ClockSyncState;
  connected: boolean;
  deviceCount: number;
}

export default function SyncStatusBar({ syncState, connected, deviceCount }: SyncStatusBarProps) {
  const { offset, rtt, quality, isSyncing } = syncState;

  const qualityColor =
    quality === 'excellent' ? 'var(--color-green)' :
    quality === 'good' ? 'var(--color-warning)' :
    quality === 'poor' ? 'var(--color-error)' :
    'var(--color-text-secondary)';

  const qualityLabel =
    quality === 'excellent' ? '< 30ms' :
    quality === 'good' ? '< 80ms' :
    quality === 'poor' ? '> 80ms' : 'syncing...';

  return (
    <div className={styles.bar}>
      <div className={styles.statusItem}>
        <div
          className={styles.dot}
          style={{ background: connected ? 'var(--color-green)' : 'var(--color-error)' }}
        />
        <span className={styles.label}>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.statusItem} title="Clock synchronization quality">
        <svg width="12" height="12" fill="none" stroke={qualityColor} strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className={styles.label} style={{ color: qualityColor }}>
          {isSyncing ? 'syncing...' : `±${Math.abs(offset).toFixed(0)}ms offset`}
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.statusItem} title="Round-trip time">
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span className={styles.label}>RTT {rtt.toFixed(0)}ms</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.statusItem}>
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
        <span className={styles.label}>{deviceCount} device{deviceCount !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.syncQuality} style={{ color: qualityColor }}>
        <span className={styles.dot} style={{ background: qualityColor }} />
        {qualityLabel}
      </div>
    </div>
  );
}
