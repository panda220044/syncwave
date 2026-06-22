'use client';

import { AudioPlayerState, PlaybackState, Track } from '@/types';
import styles from './PlayerControls.module.css';

interface PlayerControlsProps {
  playerState: AudioPlayerState;
  playbackState: PlaybackState;
  currentTrack: Track | null;
  playlist: Track[];
  amHost: boolean;
  volume: number;
  onVolumeChange: (v: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (pos: number) => void;
  onNext: () => void;
  onPrev: () => void;
}

function formatTime(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PlayerControls({
  playerState,
  playbackState,
  currentTrack,
  playlist,
  amHost,
  volume,
  onVolumeChange,
  onPlay,
  onPause,
  onSeek,
  onNext,
  onPrev,
}: PlayerControlsProps) {
  const isPlaying = playbackState.status === 'playing';
  const isBuffering = playerState.status === 'buffering';
  const progress =
    currentTrack && playerState.duration > 0
      ? (playerState.currentTime / playerState.duration) * 100
      : 0;

  return (
    <div className={styles.controls}>
      {/* Progress Bar */}
      <div className={styles.progressSection}>
        <span className={styles.time}>{formatTime(playerState.currentTime)}</span>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          {amHost && currentTrack && (
            <input
              type="range"
              className={styles.progressInput}
              min={0}
              max={playerState.duration || 100}
              step={0.5}
              value={playerState.currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              aria-label="Seek"
            />
          )}
        </div>
        <span className={styles.time}>{formatTime(playerState.duration || currentTrack?.duration || 0)}</span>
      </div>

      {/* Buttons */}
      <div className={styles.buttons}>
        {/* Prev */}
        <button
          id="btn-prev"
          className={styles.ctrlBtn}
          onClick={onPrev}
          disabled={!amHost || playlist.length < 2}
          title="Previous"
        >
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          id="btn-play-pause"
          className={`${styles.playBtn} ${!amHost ? styles.playBtnGuest : ''}`}
          onClick={isPlaying ? onPause : onPlay}
          disabled={!amHost || (!currentTrack && playlist.length === 0)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering ? (
            <span className="spinner" style={{ borderTopColor: '#000' }} />
          ) : isPlaying ? (
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Next */}
        <button
          id="btn-next"
          className={styles.ctrlBtn}
          onClick={onNext}
          disabled={!amHost || playlist.length < 2}
          title="Next"
        >
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
          </svg>
        </button>

        {/* Volume */}
        <div className={styles.volumeSection}>
          <button
            className={styles.volIcon}
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
            title="Mute/Unmute"
          >
            {volume === 0 ? (
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-9.5-8.76L7 7H3v10h4l2.5 2.5v-9.76l-2 2V15H5V9h2.5l2.5-2.5v-3.26zM19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
          <input
            id="input-volume"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className={styles.volumeSlider}
            aria-label="Volume"
            style={{ '--vol': `${volume * 100}%` } as any}
          />
        </div>
      </div>

      {/* Guest notice */}
      {!amHost && (
        <p className={styles.guestNotice}>
          🎧 You're a guest — the host controls playback
        </p>
      )}
    </div>
  );
}
