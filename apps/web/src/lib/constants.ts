const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

export { SERVER_URL };

export const PLAY_BUFFER_MS = 3000;    // How long before scheduled play fires
export const CLOCK_SYNC_ROUNDS = 8;    // NTP rounds per sync
export const CLOCK_SYNC_INTERVAL = 10_000; // Re-sync every 10s
export const DRIFT_REPORT_INTERVAL = 2_000; // Report position every 2s
export const DRIFT_SMOOTH_RATE = 0.002;     // Max playbackRate delta for correction
