import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use DB_PATH env var for Railway persistent volume, fallback to local prisma dir
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'prisma', 'dev.db');
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db: any = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema Bootstrap ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS User (
    id          TEXT PRIMARY KEY,
    displayName TEXT NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS Room (
    id        TEXT PRIMARY KEY,
    code      TEXT NOT NULL UNIQUE,
    hostId    TEXT NOT NULL,
    isActive  INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (hostId) REFERENCES User(id)
  );

  CREATE TABLE IF NOT EXISTS Track (
    id        TEXT PRIMARY KEY,
    roomId    TEXT NOT NULL,
    title     TEXT NOT NULL,
    artist    TEXT,
    album     TEXT,
    duration  REAL NOT NULL DEFAULT 0,
    fileUrl   TEXT NOT NULL,
    mimeType  TEXT NOT NULL DEFAULT 'audio/mpeg',
    fileSize  INTEGER NOT NULL DEFAULT 0,
    \`order\`   INTEGER NOT NULL DEFAULT 0,
    isUrl     INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (roomId) REFERENCES Room(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS PlaybackEvent (
    id         TEXT PRIMARY KEY,
    roomId     TEXT NOT NULL,
    type       TEXT NOT NULL,
    trackId    TEXT,
    position   REAL,
    serverTime INTEGER NOT NULL,
    deviceId   TEXT,
    createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (roomId) REFERENCES Room(id) ON DELETE CASCADE
  );
`);

console.log(`[DB] SQLite ready at ${DB_PATH}`);

export default db;
