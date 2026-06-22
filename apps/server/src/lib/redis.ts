/**
 * In-memory store replacing Redis for local development.
 * 
 * For production, switch back to ioredis by:
 *   1. Restoring the ioredis import
 *   2. Replacing the Map-based implementation below
 *   3. Using the @socket.io/redis-adapter
 */

// ── Room State (In-Memory) ────────────────────────────────

const roomActive = new Map<string, boolean>();
const roomDevices = new Map<string, Map<string, string>>(); // code → { deviceId → JSON }
const roomPlayback = new Map<string, string>(); // code → JSON

export const RedisRoom = {
  async setActive(code: string, active: boolean) {
    roomActive.set(code, active);
  },

  async isActive(code: string): Promise<boolean> {
    return roomActive.get(code) ?? false;
  },

  async addDevice(code: string, deviceId: string, deviceData: string) {
    if (!roomDevices.has(code)) roomDevices.set(code, new Map());
    roomDevices.get(code)!.set(deviceId, deviceData);
  },

  async removeDevice(code: string, deviceId: string) {
    roomDevices.get(code)?.delete(deviceId);
  },

  async getDevices(code: string): Promise<Record<string, string>> {
    const devices = roomDevices.get(code);
    if (!devices) return {};
    const result: Record<string, string> = {};
    devices.forEach((val, key) => { result[key] = val; });
    return result;
  },

  async setPlaybackState(code: string, state: string) {
    roomPlayback.set(code, state);
  },

  async getPlaybackState(code: string): Promise<string | null> {
    return roomPlayback.get(code) ?? null;
  },

  async cleanup(code: string) {
    roomActive.delete(code);
    roomDevices.delete(code);
    roomPlayback.delete(code);
  },
};

// Dummy redis export for compatibility (not used in dev mode)
export const redis = { on: () => {}, del: () => {} };
export const redisPub = { subscribe: () => {}, publish: () => {} };
export const redisSub = { subscribe: () => {}, on: () => {} };
export default redis;
