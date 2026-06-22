import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { Server } from 'socket.io';

// Route imports
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import trackRoutes from './routes/tracks';
import youtubeRoutes from './routes/youtube';

// Socket handler imports
import { registerClockHandlers } from './socket/clockHandlers';
import { registerRoomHandlers } from './socket/roomHandlers';
import { registerPlaybackHandlers } from './socket/playbackHandlers';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

// ── Express App ───────────────────────────────────────────

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow audio file serving
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow: no origin (curl/mobile), localhost, Vercel deployments, Railway
      const allowed = [
        'http://localhost:3000',
        'http://localhost:3001',
        CLIENT_URL,
      ];
      if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.railway.app')) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all in dev; tighten in production if needed
      }
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded audio files
app.use('/uploads', express.static(UPLOADS_DIR));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: Date.now(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms/:code/tracks', trackRoutes);
app.use('/api/youtube', youtubeRoutes);

// ── HTTP + Socket.IO Server ───────────────────────────────

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// Single-instance mode (no Redis adapter needed for local dev)

// ── Socket.IO Connection Handler ──────────────────────────

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Register all handler groups
  registerClockHandlers(io, socket);
  registerRoomHandlers(io, socket);
  registerPlaybackHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
  });
});

// ── Start Server ──────────────────────────────────────────

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎵 Music System Server`);
  console.log(`   ➜ HTTP:   http://localhost:${PORT}`);
  console.log(`   ➜ WS:     ws://localhost:${PORT}`);
  console.log(`   ➜ Health: http://localhost:${PORT}/health`);
  console.log(`   ➜ Env:    ${process.env.NODE_ENV || 'development'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  httpServer.close(() => process.exit(0));
});
