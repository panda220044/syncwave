'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useSocket } from '@/contexts/SocketContext';
import { useRoom } from '@/hooks/useRoom';
import { useClockSync } from '@/hooks/useClockSync';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { AuthData, Track } from '@/types';
import { uploadTrack, addUrlTrack, deleteTrack, getYoutubeInfo, getYoutubeStreamUrl } from '@/lib/api';

import PlayerControls from '@/components/player/PlayerControls';
import DeviceList from '@/components/room/DeviceList';
import QRCodePanel from '@/components/room/QRCodePanel';
import TrackList from '@/components/room/TrackList';
import SyncStatusBar from '@/components/room/SyncStatusBar';
import UploadModal from '@/components/room/UploadModal';
import styles from './room.module.css';
import { Menu, X, Users, Disc, Volume2, Copy, Share2, LogOut, Plus, Music, Headphones } from 'lucide-react';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { code } = use(params);
  const router = useRouter();
  const { socket, connect, connected } = useSocket();
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<'devices' | 'playlist' | 'qr'>('devices');
  const [joinUrl, setJoinUrl] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Load auth from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('auth');
    if (!stored) {
      router.push('/');
      return;
    }
    setAuth(JSON.parse(stored));
    // Build join URL using the current page's origin (works on LAN, localhost, and deployed)
    setJoinUrl(`${window.location.origin}/join/${code}`);
    connect();
  }, [router, connect, code]);

  const {
    socket: _,
    ...clockSync
  } = { socket, ...useClockSync(socket) };

  const { offset: _offset, serverNow, offsetRef, ...syncState } = clockSync;

  const {
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
    currentTrack,
  } = useRoom({ socket, auth });

  const { playerState, handlePlaybackCommand, unlockAudio } = useAudioPlayer({
    socket,
    offsetRef,
    volume,
  });

  // Join room when socket connects
  const handleUnlockAudio = async () => {
    const success = await unlockAudio();
    if (success) {
      setAudioUnlocked(true);
      toast.success('Audio sync enabled!');
    }
  };
  useEffect(() => {
    if (connected && auth && !room && !isJoining) {
      joinRoom(code, auth.displayName);
    }
  }, [connected, auth, room, isJoining, joinRoom, code]);

  // Handle incoming playback commands → audio engine
  useEffect(() => {
    if (!socket) return;
    const handler = (cmd: any) => {
      if (room?.playlist) handlePlaybackCommand(cmd, room.playlist);
    };
    socket.on('playback:command', handler);
    return () => { socket.off('playback:command', handler); };
  }, [socket, room?.playlist, handlePlaybackCommand]);

  // Show error
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // ── Upload ────────────────────────────────────────────────
  const handleUploadFile = useCallback(
    async (file: File) => {
      if (!auth || !room) return;
      const toastId = toast.loading('Uploading track...');
      try {
        const { track } = await uploadTrack(room.code, auth.token, file);
        addTrackToPlaylist(track);
        toast.success(`Added: ${track.title}`, { id: toastId });
      } catch (err: any) {
        toast.error(err.message || 'Upload failed', { id: toastId });
      }
    },
    [auth, room, addTrackToPlaylist]
  );

  const handleAddUrl = useCallback(
    async (url: string, title: string) => {
      if (!auth || !room) return;
      const toastId = toast.loading('Adding track...');
      try {
        const { track } = await addUrlTrack(room.code, auth.token, url, title);
        addTrackToPlaylist(track);
        toast.success(`Added: ${track.title}`, { id: toastId });
      } catch (err: any) {
        toast.error(err.message || 'Failed to add URL', { id: toastId });
      }
    },
    [auth, room, addTrackToPlaylist]
  );

  const handleAddYoutube = useCallback(
    async (youtubeUrl: string) => {
      if (!auth || !room) return;
      const toastId = toast.loading('Fetching YouTube audio...');
      try {
        const info = await getYoutubeInfo(youtubeUrl, auth.token);
        // Store the stream URL (proxied through our backend — zero ads)
        const streamUrl = getYoutubeStreamUrl(youtubeUrl);
        const { track } = await addUrlTrack(
          room.code,
          auth.token,
          streamUrl,
          info.title,
          info.author
        );
        addTrackToPlaylist(track);
        toast.success(`Added: ${info.title}`, { id: toastId });
      } catch (err: any) {
        toast.error(err.message || 'Failed to fetch YouTube audio', { id: toastId });
      }
    },
    [auth, room, addTrackToPlaylist]
  );

  const handleDeleteTrack = useCallback(
    async (track: Track) => {
      if (!auth || !room) return;
      try {
        await deleteTrack(room.code, auth.token, track.id);
        removeTrackFromPlaylist(track.id);
        toast.success('Track removed');
      } catch (err: any) {
        toast.error(err.message || 'Failed to remove track');
      }
    },
    [auth, room, removeTrackFromPlaylist]
  );

  // ── Loading state ─────────────────────────────────────────
  if (!auth || isJoining || !room) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <div className="spinner spinner-lg" />
          <p className="text-secondary" style={{ marginTop: 16 }}>
            {!auth ? 'Loading...' : isJoining ? 'Joining room...' : 'Connecting...'}
          </p>
        </div>
      </div>
    );
  }

  const amHost = isHost();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <div className={styles.roomLayout}>
      {/* ── Mobile Sidebar Backdrop ── */}
      {mobileSidebarOpen && (
        <div
          className={styles.sidebarBackdrop}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Left Sidebar ── */}
      <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogoRow}>
            <div className={styles.sidebarLogo}>
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="10" width="4" height="12" rx="2" fill="#1ed760" />
                <rect x="10" y="6" width="4" height="20" rx="2" fill="#1ed760" opacity="0.8" />
                <rect x="16" y="2" width="4" height="28" rx="2" fill="#1ed760" />
                <rect x="22" y="6" width="4" height="20" rx="2" fill="#1ed760" opacity="0.8" />
              </svg>
              <span className={styles.sidebarTitle}>SyncWave</span>
            </div>

            {/* Mobile Close Button */}
            <button
              className={styles.closeSidebarBtn}
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className={styles.roomCodeBadge}>
            <span className={styles.roomCodeLabel}>ROOM</span>
            <span className={styles.roomCode}>{room.code}</span>
            <button
              className="btn-icon"
              title="Copy code"
              onClick={() => {
                navigator.clipboard.writeText(room.code);
                toast.success('Code copied!');
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(['devices', 'playlist', 'qr'] as const).map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'devices' ? `Devices (${devices.length})` : tab === 'playlist' ? 'Playlist' : 'QR Code'}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'devices' && (
            <DeviceList devices={devices} myDeviceId={myDeviceId} amHost={amHost} />
          )}
          {activeTab === 'playlist' && (
            <TrackList
              tracks={room.playlist}
              currentTrackId={playbackState.trackId}
              amHost={true} // Collaborative: everyone can add/delete/play tracks
              onPlay={(track) => {
                sendPlayback('play', track.id, 0);
                setMobileSidebarOpen(false); // Close sidebar on mobile after play
              }}
              onDelete={handleDeleteTrack} // Collaborative: everyone can delete tracks
              onAddTrack={() => setShowUpload(true)}
            />
          )}
          {activeTab === 'qr' && (
            <QRCodePanel
              code={room.code}
              joinUrl={joinUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${room.code}`}
            />
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className={styles.main}>
        {/* Mobile Header */}
        <header className={styles.mobileHeader}>
          <button
            className={styles.sidebarToggle}
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <div className={styles.mobileTitle}>SyncWave • {room.code}</div>
          <button
            className={styles.sidebarToggle}
            onClick={() => {
              setActiveTab('playlist');
              setMobileSidebarOpen(true);
            }}
            aria-label="Open playlist"
          >
            <Music size={20} />
          </button>
        </header>

        {/* Sync Status Bar */}
        <SyncStatusBar
          syncState={{ ...syncState, offset: clockSync.offset, rtt: clockSync.rtt, syncedAt: clockSync.syncedAt, isSyncing: clockSync.isSyncing, quality: clockSync.quality }}
          connected={connected}
          deviceCount={devices.length}
        />

        {/* Now Playing */}
        <div className={styles.nowPlaying}>
          <div className={styles.albumArt}>
            <MusicVisualizer isPlaying={playerState.status === 'playing'} />
          </div>

          <div className={styles.trackInfo}>
            {currentTrack ? (
              <>
                <h2 className={styles.trackTitle}>{currentTrack.title}</h2>
                <p className={styles.trackArtist}>
                  {currentTrack.artist || 'Unknown Artist'}
                </p>
              </>
            ) : (
              <>
                <h2 className={`${styles.trackTitle} text-secondary`}>No track selected</h2>
                <p className={styles.trackArtist}>
                  Add tracks to the playlist to get started →
                </p>
              </>
            )}
          </div>
        </div>

        {/* Player Controls */}
        <PlayerControls
          playerState={playerState}
          playbackState={playbackState}
          currentTrack={currentTrack}
          playlist={room.playlist}
          amHost={true} // Collaborative: everyone has playback controls enabled
          volume={volume}
          onVolumeChange={setVolume}
          onPlay={() => {
            if (currentTrack) sendPlayback('play', currentTrack.id, playerState.currentTime);
            else if (room.playlist[0]) sendPlayback('play', room.playlist[0].id, 0);
          }}
          onPause={() => sendPlayback('pause', playbackState.trackId || undefined, playerState.currentTime)}
          onSeek={(pos) => sendPlayback('seek', playbackState.trackId || undefined, pos)}
          onNext={() => sendPlayback('next', playbackState.trackId || undefined)}
          onPrev={() => sendPlayback('prev', playbackState.trackId || undefined)}
        />

        {/* Control Actions Bar */}
        <div className={styles.hostControls}>
          <button
            id="btn-add-music"
            className="btn btn-secondary"
            onClick={() => setShowUpload(true)}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add Music
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => setActiveTab('qr')}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
            </svg>
            Invite Friends
          </button>

          <button
            className="btn btn-ghost"
            style={{ color: 'var(--color-error)', marginLeft: 'auto' }}
            onClick={leaveRoom}
          >
            {amHost ? 'End Session' : 'Leave Room'}
          </button>
        </div>
      </main>

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploadFile={handleUploadFile}
          onAddUrl={handleAddUrl}
          onAddYoutube={handleAddYoutube}
        />
      )}

      {/* ── Audio Tap-to-Unlock Overlay for Mobile Compatibility ── */}
      {!audioUnlocked && (
        <div className={styles.unlockOverlay} onClick={handleUnlockAudio}>
          <div className={styles.unlockCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.unlockIcon}>
              <Headphones size={40} className={styles.pulseIcon} />
            </div>
            <h3 className={styles.unlockTitle}>Sync Audio Enabled</h3>
            <p className={styles.unlockText}>
              Tap the button below to connect this device to the synchronized audio session.
            </p>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={handleUnlockAudio}
            >
              Connect Audio Sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MusicVisualizer({ isPlaying }: { isPlaying: boolean }) {
  const bars = Array.from({ length: 20 });
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 3,
        padding: '20px',
      }}
    >
      {bars.map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            maxWidth: 12,
            background: `hsl(${142 + i * 4}, 70%, ${50 + i * 1.5}%)`,
            borderRadius: 3,
            minHeight: 4,
            animation: isPlaying ? `waveBar ${0.6 + (i % 5) * 0.15}s ease-in-out infinite` : 'none',
            animationDelay: `${i * 40}ms`,
            height: isPlaying ? undefined : `${20 + Math.sin(i) * 15 + 10}%`,
            opacity: isPlaying ? 1 : 0.4,
            transition: 'opacity 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}
