// src/config/socketServer.ts
// Creates and configures the Socket.io server.
// Provides real-time event broadcasting, 1-on-1 chat room dispatch,
// typing indicators, read receipts, and live online presence tracking.

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './prismaClient.js';

let io: SocketIOServer | null = null;

// Maps userId → Set of active socket IDs
const userSockets = new Map<string, Set<string>>();

export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

export function getOnlineUsers(userIds: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const id of userIds) {
    result[id] = isUserOnline(id);
  }
  return result;
}

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
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
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

    // Join personal user room for direct targeting
    socket.join(`user:${userId}`);

    const isFirstConnection = !userSockets.has(userId) || (userSockets.get(userId)?.size ?? 0) === 0;
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    // Broadcast presence if newly online
    if (isFirstConnection) {
      io?.emit('presence:update', { userId, isOnline: true });
    }

    // ── Room Management for Live Chat ───────────────────────────────────────
    socket.on('chat:join', (data: { conversationId?: string }) => {
      if (data?.conversationId) {
        const roomName = `conversation:${data.conversationId}`;
        socket.join(roomName);
        console.log(`[Socket.io] User ${userId} joined ${roomName}`);
      }
    });

    socket.on('chat:leave', (data: { conversationId?: string }) => {
      if (data?.conversationId) {
        const roomName = `conversation:${data.conversationId}`;
        socket.leave(roomName);
        console.log(`[Socket.io] User ${userId} left ${roomName}`);
      }
    });

    // ── Live Typing Indicator ───────────────────────────────────────────────
    socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (data?.conversationId) {
        socket.to(`conversation:${data.conversationId}`).emit('chat:peer_typing', {
          conversationId: data.conversationId,
          userId,
          isTyping: !!data.isTyping,
        });
      }
    });

    // ── Real-Time Read Receipt Dispatch ──────────────────────────────────────
    socket.on('chat:mark_read', async (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      try {
        const now = new Date();
        const updateResult = await prisma.chatMessage.updateMany({
          where: {
            conversationId: data.conversationId,
            senderId: { not: userId },
            isRead: false,
          },
          data: {
            isRead: true,
            readAt: now,
          },
        });

        if (updateResult.count > 0) {
          socket.to(`conversation:${data.conversationId}`).emit('chat:read_receipt', {
            conversationId: data.conversationId,
            readBy: userId,
            readAt: now.toISOString(),
          });
        }
      } catch (err) {
        console.error('[Socket.io] chat:mark_read error:', err);
      }
    });

    // ── Presence Query ───────────────────────────────────────────────────────
    socket.on('presence:query', (data: { userIds: string[] }, callback) => {
      if (typeof callback === 'function' && Array.isArray(data?.userIds)) {
        callback(getOnlineUsers(data.userIds));
      }
    });

    // ── Disconnect handler ───────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      userSockets.get(userId)?.delete(socket.id);
      if (userSockets.get(userId)?.size === 0) {
        userSockets.delete(userId);
        io?.emit('presence:update', { userId, isOnline: false });
      }
      console.log(`[Socket.io] User ${userId} disconnected (${reason}) — socket ${socket.id}`);
    });
  });

  console.log('[Socket.io] Server initialised with CORS origins:', allowedOrigins);
  return io;
}

// ── Getters & Emitters ────────────────────────────────────────────────────────
export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialised. Call initSocketServer first.');
  return io;
}

/** Emit an event to every socket belonging to a specific user. */
export function emitToUser(userId: string, event: string, data: unknown): void {
  const socketIds = userSockets.get(userId);
  if (!socketIds || socketIds.size === 0) {
    console.log(`[Socket.io] User ${userId} not currently connected — event "${event}" queued for next sync`);
    return;
  }
  const ioInstance = getIO();
  for (const sid of socketIds) {
    ioInstance.to(sid).emit(event, data);
  }
  console.log(`[Socket.io] Emitted "${event}" to user ${userId} (${socketIds.size} socket(s))`);
}

/** Broadcast an event to all connected sockets (announcements). */
export function broadcastGlobal(event: string, data: unknown): void {
  const ioInstance = getIO();
  ioInstance.emit(event, data);
  console.log(`[Socket.io] Global broadcast "${event}" sent`);
}
