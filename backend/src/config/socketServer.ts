// src/config/socketServer.ts
// Creates and configures the Socket.io server.
// Call initSocketServer(httpServer) once in server.ts.
// Call getIO() anywhere in the app to emit events.

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;

// Maps userId → Set of socket IDs (a user may have multiple tabs open)
const userSockets = new Map<string, Set<string>>();

// ── Init ─────────────────────────────────────────────────────────────────────
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = [
    process.env['FRONTEND_URL'],
    process.env['CLIENT_URL'],
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://career-nest-sand.vercel.app',
  ].filter(Boolean) as string[];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
        // Permissive in development
        if (process.env['NODE_ENV'] !== 'production') {
          return callback(null, true);
        }
        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── JWT auth middleware ────────────────────────────────────────────────────
  // The frontend sends the token via socket.auth = { token } or Authorization header
  io.use((socket: Socket, next) => {
    const authHeader = socket.handshake.headers['authorization'];
    const token = (socket.handshake.auth['token'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader)) as string | undefined;

    if (!token) {
      console.warn(`[Socket.io Auth] Connection rejected: No token provided (socket ${socket.id})`);
      return next(new Error('Authentication token missing'));
    }

    const secret = process.env['JWT_SECRET'];
    if (!secret) return next(new Error('Server misconfiguration: JWT_SECRET missing'));

    try {
      const payload = jwt.verify(token, secret) as { userId: string };
      (socket as Socket & { userId: string }).userId = payload.userId;
      next();
    } catch (err: unknown) {
      console.warn(`[Socket.io Auth] Token verification failed: ${(err as Error).message}`);
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = (socket as Socket & { userId: string }).userId;
    console.log(`[Socket.io] User ${userId} connected — socket ${socket.id}`);

    // Track all sockets for this user
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    socket.on('disconnect', (reason) => {
      userSockets.get(userId)?.delete(socket.id);
      if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
      console.log(`[Socket.io] User ${userId} disconnected (${reason}) — socket ${socket.id}`);
    });
  });

  console.log('[Socket.io] Server initialised with CORS origins:', allowedOrigins);
  return io;
}

// ── Getters ───────────────────────────────────────────────────────────────────
export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialised. Call initSocketServer first.');
  return io;
}

/** Emit an event to every socket belonging to a specific user. */
export function emitToUser(userId: string, event: string, data: unknown): void {
  const socketIds = userSockets.get(userId);
  if (!socketIds || socketIds.size === 0) {
    console.log(`[Socket.io] No active sockets for user ${userId} — event "${event}" not delivered`);
    return;
  }
  const ioInstance = getIO();
  for (const sid of socketIds) {
    ioInstance.to(sid).emit(event, data);
  }
  console.log(`[Socket.io] Emitted "${event}" to user ${userId} (${socketIds.size} socket(s))`);
}
