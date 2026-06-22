'use client';

import { Device } from '@/types';
import styles from './DeviceList.module.css';

interface DeviceListProps {
  devices: Device[];
  myDeviceId: string | null;
  amHost: boolean;
}

function LatencyBadge({ latency }: { latency: number | null }) {
  if (latency === null) return <span className={`badge badge-gray`}>--</span>;
  const cls = latency < 30 ? 'badge-green' : latency < 80 ? 'badge-yellow' : 'badge-red';
  return <span className={`badge ${cls}`}>{latency.toFixed(0)}ms</span>;
}

function QualityDot({ quality }: { quality: Device['connectionQuality'] }) {
  const cls = quality === 'excellent' ? '' : quality === 'good' ? 'yellow' : 'red';
  return <span className={`dot-pulse ${cls}`} title={quality} />;
}

function SignalBars({ quality }: { quality: Device['connectionQuality'] }) {
  const bars = [1, 2, 3];
  const active =
    quality === 'excellent' ? 3 : quality === 'good' ? 2 : quality === 'poor' ? 1 : 0;
  const color =
    quality === 'excellent' ? 'var(--color-green)' :
    quality === 'good' ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {bars.map((b) => (
        <div
          key={b}
          style={{
            width: 4,
            height: `${b * 33}%`,
            borderRadius: 2,
            background: b <= active ? color : 'var(--color-surface-2)',
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function DeviceList({ devices, myDeviceId, amHost }: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className={styles.empty}>
        <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" opacity="0.4">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
        <p>No devices connected yet</p>
        <p className="text-xs" style={{ marginTop: 4 }}>Share the room code to invite friends</p>
      </div>
    );
  }

  return (
    <div className={`${styles.list} stagger`}>
      {devices.map((device) => (
        <div
          key={device.id}
          className={`${styles.deviceCard} anim-fade-in ${device.id === myDeviceId ? styles.myDevice : ''}`}
        >
          <div className={styles.deviceLeft}>
            <div className={styles.deviceIcon}>
              {device.isHost ? '👑' : '📱'}
            </div>
            <div className={styles.deviceInfo}>
              <div className={styles.deviceName}>
                {device.name}
                {device.id === myDeviceId && (
                  <span className="badge badge-purple" style={{ marginLeft: 6, fontSize: '0.6rem' }}>You</span>
                )}
              </div>
              <div className={styles.deviceMeta}>
                {device.isHost && <span className="text-xs" style={{ color: 'var(--color-warning)' }}>Host</span>}
                {!device.isHost && <span className="text-xs text-secondary">Listener</span>}
              </div>
            </div>
          </div>

          <div className={styles.deviceRight}>
            <SignalBars quality={device.connectionQuality} />
            <LatencyBadge latency={device.latency} />
          </div>
        </div>
      ))}

      <div className={styles.summary}>
        <span className="dot-pulse" />
        <span className="text-secondary text-xs">
          {devices.length} device{devices.length !== 1 ? 's' : ''} connected
        </span>
      </div>
    </div>
  );
}
