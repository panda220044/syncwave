'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import styles from './UploadModal.module.css';

interface UploadModalProps {
  onClose: () => void;
  onUploadFile: (file: File) => Promise<void>;
  onAddUrl: (url: string, title: string) => Promise<void>;
  onAddYoutube: (youtubeUrl: string) => Promise<void>;
}

const ACCEPTED_TYPES = '.mp3,.wav,.ogg,.flac,.aac,.m4a,audio/*';

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/;

export default function UploadModal({ onClose, onUploadFile, onAddUrl, onAddYoutube }: UploadModalProps) {
  const [tab, setTab] = useState<'file' | 'youtube' | 'url'>('file');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // YouTube state
  const [ytUrl, setYtUrl] = useState('');

  // Direct URL state
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await onUploadFile(file);
      }
      onClose();
    } catch {
      // toast handled upstream
    } finally {
      setUploading(false);
    }
  };

  const handleAddYoutube = async () => {
    const url = ytUrl.trim();
    if (!url) { toast.error('Paste a YouTube URL'); return; }
    if (!YT_REGEX.test(url)) { toast.error('Not a valid YouTube URL'); return; }
    setUploading(true);
    try {
      await onAddYoutube(url);
      onClose();
    } catch {
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) { toast.error('Enter a URL'); return; }
    if (!titleInput.trim()) { toast.error('Enter a track title'); return; }
    setUploading(true);
    try {
      await onAddUrl(urlInput.trim(), titleInput.trim());
      onClose();
    } catch {
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} anim-scale-in`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add Music</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'file' ? styles.tabActive : ''}`} onClick={() => setTab('file')}>
            📁 Upload File
          </button>
          <button className={`${styles.tab} ${tab === 'youtube' ? styles.tabActive : ''}`} onClick={() => setTab('youtube')}>
            ▶️ YouTube
          </button>
          <button className={`${styles.tab} ${tab === 'url' ? styles.tabActive : ''}`} onClick={() => setTab('url')}>
            🔗 Direct URL
          </button>
        </div>

        {/* ── File Upload ── */}
        {tab === 'file' && (
          <div className={styles.fileSection}>
            <label
              className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            >
              <input
                id="file-input"
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className={styles.fileInput}
                onChange={(e) => handleFiles(e.target.files)}
              />
              {uploading ? (
                <div className="spinner spinner-lg" />
              ) : (
                <>
                  <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" opacity="0.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className={styles.dropText}>Drop audio files here</p>
                  <p className={styles.dropSub}>or click to browse · MP3, WAV, FLAC, OGG, AAC</p>
                </>
              )}
            </label>
          </div>
        )}

        {/* ── YouTube ── */}
        {tab === 'youtube' && (
          <div className={styles.urlSection}>
            <div className={styles.youtubeBanner}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff0000">
                <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.8 15.5V8.5l6.3 3.5-6.3 3.5z"/>
              </svg>
              <span>Audio is extracted & played ad-free through SyncWave</span>
            </div>
            <div className={styles.field}>
              <label className="label">YouTube URL</label>
              <input
                className="input"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                autoFocus
              />
            </div>
            <button
              id="btn-add-youtube"
              className="btn btn-secondary w-full"
              onClick={handleAddYoutube}
              disabled={uploading}
              style={{ marginTop: 12, background: 'linear-gradient(135deg, #ff0000, #cc0000)' }}
            >
              {uploading ? (
                <><span className="spinner" />&nbsp;Fetching audio...</>
              ) : (
                '+ Add from YouTube'
              )}
            </button>
            <p className="text-xs text-secondary text-center" style={{ marginTop: 8 }}>
              Works with youtube.com/watch, youtu.be, and Shorts links
            </p>
          </div>
        )}

        {/* ── Direct URL ── */}
        {tab === 'url' && (
          <div className={styles.urlSection}>
            <div className={styles.field}>
              <label className="label">Audio URL</label>
              <input
                className="input"
                type="url"
                placeholder="https://example.com/song.mp3"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className="label">Track Title</label>
              <input
                className="input"
                type="text"
                placeholder="Song name"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddUrl(); }}
              />
            </div>
            <button
              id="btn-add-url"
              className="btn btn-purple w-full"
              onClick={handleAddUrl}
              disabled={uploading}
              style={{ marginTop: 8 }}
            >
              {uploading ? <span className="spinner" /> : 'Add Track'}
            </button>
            <p className="text-xs text-secondary text-center" style={{ marginTop: 8 }}>
              Must be a direct link to an audio file (MP3, WAV, etc.)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
