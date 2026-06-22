'use client';

import { Track } from '@/types';
import styles from './TrackList.module.css';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  amHost: boolean;
  onPlay: (track: Track) => void;
  onDelete?: (track: Track) => void;
  onAddTrack: () => void;
}

function formatDuration(s: number): string {
  if (!s) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function TrackList({
  tracks,
  currentTrackId,
  amHost,
  onPlay,
  onDelete,
  onAddTrack,
}: TrackListProps) {
  return (
    <div className={styles.wrapper}>
      {amHost && (
        <button id="btn-add-track" className={`btn btn-secondary w-full ${styles.addBtn}`} onClick={onAddTrack}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Add Music
        </button>
      )}

      {tracks.length === 0 ? (
        <div className={styles.empty}>
          <span style={{ fontSize: '2rem' }}>🎵</span>
          <p>No tracks yet</p>
          {amHost && <p className="text-xs">Add music to get started</p>}
        </div>
      ) : (
        <div className={`${styles.list} stagger`}>
          {tracks.map((track, idx) => {
            const isActive = track.id === currentTrackId;
            return (
              <div
                key={track.id}
                className={`${styles.trackRow} anim-fade-in ${isActive ? styles.trackActive : ''}`}
                onClick={() => amHost && onPlay(track)}
                title={amHost ? `Play: ${track.title}` : track.title}
              >
                <div className={styles.trackNum}>
                  {isActive ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-green)">
                      <rect x="3" y="4" width="4" height="16" rx="1" />
                      <rect x="10" y="4" width="4" height="16" rx="1" />
                      <rect x="17" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <span className="text-secondary text-xs">{idx + 1}</span>
                  )}
                </div>
                <div className={styles.trackInfo}>
                  <div className={styles.trackTitle}>{track.title}</div>
                  {track.artist && <div className={styles.trackArtist}>{track.artist}</div>}
                </div>
                <div className={styles.trackMeta}>
                  <span className="text-xs text-secondary">{formatDuration(track.duration)}</span>
                  {track.isUrl && (
                    <span className="badge badge-purple" style={{ fontSize: '0.55rem' }}>URL</span>
                  )}
                </div>
                {amHost && onDelete && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); onDelete(track); }}
                    title="Remove track"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
