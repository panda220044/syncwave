'use client';

import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';
import styles from './QRCodePanel.module.css';

interface QRCodePanelProps {
  code: string;
  joinUrl: string;
}

export default function QRCodePanel({ code, joinUrl }: QRCodePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code client-side — works everywhere, no server config needed
  useEffect(() => {
    if (!canvasRef.current || !joinUrl) return;
    QRCodeLib.toCanvas(canvasRef.current, joinUrl, {
      width: 220,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#00000000',
      },
    }).catch(console.error);
  }, [joinUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      // Visual feedback is handled by the parent via toast
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.qrWrapper}>
        <canvas ref={canvasRef} className={styles.qrCanvas} />
      </div>

      <div className={styles.codeDisplay}>
        <span className={styles.codeLabel}>ROOM CODE</span>
        <span className={styles.code}>{code}</span>
      </div>

      <p className={styles.hint}>Scan to join · or share the room code</p>

      <div className={styles.actions}>
        <button
          className="btn btn-secondary w-full btn-sm"
          onClick={() => {
            navigator.clipboard.writeText(joinUrl);
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          Copy Invite Link
        </button>
        <button
          className="btn btn-ghost w-full btn-sm"
          onClick={() => {
            navigator.clipboard.writeText(code);
          }}
          style={{ marginTop: 8 }}
        >
          Copy Room Code Only
        </button>
      </div>

      <p className="text-xs text-secondary text-center" style={{ marginTop: 12, opacity: 0.6 }}>
        {joinUrl}
      </p>
    </div>
  );
}
