'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { joinAnonymously, createRoom } from '@/lib/api';
import { AuthData } from '@/types';
import styles from './page.module.css';

export default function LandingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!displayName.trim()) {
      toast.error('Enter your name first');
      return;
    }
    setLoading(true);
    try {
      const auth = await joinAnonymously(displayName.trim());
      localStorage.setItem('auth', JSON.stringify(auth));

      const { room, qrCodeDataUrl } = await createRoom(auth.token);
      localStorage.setItem('qrCode', qrCodeDataUrl);

      router.push(`/room/${room.code}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create room');
      setLoading(false);
    }
  }, [displayName, router]);

  const handleJoin = useCallback(async () => {
    if (!displayName.trim()) {
      toast.error('Enter your name first');
      return;
    }
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      toast.error('Enter a valid 6-character room code');
      return;
    }
    setLoading(true);
    try {
      const auth = await joinAnonymously(displayName.trim());
      localStorage.setItem('auth', JSON.stringify(auth));
      router.push(`/room/${code}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to join room');
      setLoading(false);
    }
  }, [displayName, roomCode, router]);

  return (
    <div className={styles.landing}>
      {/* Background */}
      <div className={styles.bg}>
        <div className={`${styles.orb} ${styles.orbGreen}`} />
        <div className={`${styles.orb} ${styles.orbPurple}`} />
        <div className={`${styles.orb} ${styles.orbBlue}`} />
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={`${styles.logo} anim-fade-in`}>
          <SoundwaveIcon />
          <span>SyncWave</span>
        </div>

        <h1 className={`${styles.headline} anim-slide-up`}>
          Your phones,<br />
          <span className="text-gradient">one sound.</span>
        </h1>

        <p className={`${styles.subheadline} anim-slide-up`} style={{ animationDelay: '80ms' }}>
          Turn every phone in the room into a synchronized speaker.
          Less than 50ms drift. No special hardware needed.
        </p>

        {/* Sync animation */}
        <div className={`${styles.syncAnim} anim-fade-in`} style={{ animationDelay: '200ms' }}>
          <SyncBars />
        </div>
      </div>

      {/* Card */}
      <div className={`${styles.card} anim-scale-in`} style={{ animationDelay: '150ms' }}>
        {mode === 'select' && (
          <div className={styles.modeSelect}>
            <div className={styles.nameField}>
              <label className="label" htmlFor="displayName">Your name</label>
              <input
                id="displayName"
                className={`input input-lg ${styles.nameInput}`}
                type="text"
                placeholder="e.g. Alex"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && displayName.trim()) setMode('create');
                }}
              />
            </div>

            <div className={styles.actionButtons}>
              <button
                id="btn-create-room"
                className={`btn btn-primary btn-lg ${styles.actionBtn}`}
                onClick={() => {
                  if (!displayName.trim()) { toast.error('Enter your name first'); return; }
                  setMode('create');
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Create a Room
              </button>

              <button
                id="btn-join-room"
                className={`btn btn-secondary btn-lg ${styles.actionBtn}`}
                onClick={() => {
                  if (!displayName.trim()) { toast.error('Enter your name first'); return; }
                  setMode('join');
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M14 12H3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Join a Room
              </button>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <div className={styles.createPanel}>
            <button className="btn btn-ghost" onClick={() => setMode('select')}>
              ← Back
            </button>
            <h2 className={styles.panelTitle}>Create a Room</h2>
            <p className="text-secondary text-sm" style={{ marginBottom: 24 }}>
              You'll be the host. Share the room code with friends to let them join.
            </p>
            <div className={styles.nameField}>
              <label className="label">Your name</label>
              <input
                className="input input-lg"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
              />
            </div>
            <button
              id="btn-confirm-create"
              className="btn btn-primary btn-lg w-full"
              onClick={handleCreate}
              disabled={loading || !displayName.trim()}
              style={{ marginTop: 16 }}
            >
              {loading ? <span className="spinner" /> : 'Create Room & Start'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className={styles.joinPanel}>
            <button className="btn btn-ghost" onClick={() => setMode('select')}>
              ← Back
            </button>
            <h2 className={styles.panelTitle}>Join a Room</h2>
            <p className="text-secondary text-sm" style={{ marginBottom: 24 }}>
              Enter the 6-character code from the host's screen.
            </p>
            <div className={styles.nameField}>
              <label className="label">Your name</label>
              <input
                className="input input-lg"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
              />
            </div>
            <div className={styles.nameField} style={{ marginTop: 16 }}>
              <label className="label">Room Code</label>
              <input
                id="input-room-code"
                className={`input input-lg ${styles.codeInput}`}
                type="text"
                placeholder="X7K9PQ"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
              />
            </div>
            <button
              id="btn-confirm-join"
              className="btn btn-purple btn-lg w-full"
              onClick={handleJoin}
              disabled={loading || !displayName.trim() || roomCode.length !== 6}
              style={{ marginTop: 16 }}
            >
              {loading ? <span className="spinner" /> : 'Join Room'}
            </button>
          </div>
        )}
      </div>

      {/* Features */}
      <div className={`${styles.features} anim-fade-in`} style={{ animationDelay: '300ms' }}>
        {[
          { icon: '⚡', label: '< 50ms drift' },
          { icon: '📱', label: 'Up to 50 devices' },
          { icon: '🎵', label: 'Upload or URL' },
          { icon: '🎛️', label: 'Per-device volume' },
        ].map((f) => (
          <div key={f.label} className={styles.featureChip}>
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SoundwaveIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="10" width="4" height="12" rx="2" fill="#1ed760" />
      <rect x="10" y="6" width="4" height="20" rx="2" fill="#1ed760" opacity="0.8" />
      <rect x="16" y="2" width="4" height="28" rx="2" fill="#1ed760" />
      <rect x="22" y="6" width="4" height="20" rx="2" fill="#1ed760" opacity="0.8" />
      <rect x="28" y="10" width="4" height="12" rx="2" fill="#1ed760" opacity="0.6" />
    </svg>
  );
}

function SyncBars() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, justifyContent: 'center' }}>
      {[0.3, 0.6, 1, 0.8, 0.5, 0.9, 0.7, 0.4, 0.8, 1, 0.6, 0.3].map((h, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: `${h * 100}%`,
            background: i < 4 ? '#1ed760' : i < 8 ? '#a855f7' : '#3b82f6',
            borderRadius: 2,
            animation: `waveBar ${0.8 + i * 0.1}s ease-in-out infinite`,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}
