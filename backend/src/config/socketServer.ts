/**
 * @file socketServer.ts
 * @description Real-Time WebSocket Gateway powered by Socket.io.
 * Orchestrates multi-tenant rooms, 1-on-1 direct messaging, live typing relays,
 * read receipts, and O(1) in-memory presence tracking across distributed clients.
 *
 * @architecture
 * - Authentication: JWT verification during WebSocket handshake with strict error isolation.
 * - Room Partitioning: Dedicated rooms per user (`user:<userId>`) and per hiring conversation (`conversation:<conversationId>`).
 * - Presence Tracking: In-memory hash set mapping user IDs to active socket connections. Emits presence updates only on state boundary transitions (0 -> 1 or 1 -> 0).
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './prismaClient.js';

let io: SocketIOServer | null = null;

/**
 * Tracks active socket connections per user.
 * Key: userId, Value: Set of connected socket IDs (supports multi-device sessions).
 */
const userSockets = new Map<string, Set<string>>();

/**
 * Checks whether a given user has at least one active WebSocket connection.
 * @param userId - Unique user identifier.
 * @returns boolean indicating real-time online status.
 */
export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

/**
 * Batch-evaluates the online presence status for a collection of user IDs.
 * @param userIds - Array of target user identifiers.
 * @returns Key-value map of userId to online boolean status.
 */
export function getOnlineUsers(userIds: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const id of userIds) {
    result[id] = isUserOnline(id);
  }
  return result;
}

/**
 * Initializes and binds the Socket.io server to the existing HTTP listener.
 * Configures CORS, security middleware, and bidirectional event listeners.
 *
 * @param httpServer - Active Node.js HTTP server instance.
 * @returns Configured SocketIOServer instance.
 */
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

  // ── Authentication Middleware: Verify JWT before connection establishment ───
  io.use((socket: Socket, next) => {
    const authHeader = socket.handshake.headers['authorization'];
    const token = (socket.handshake.auth['token'] ||
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader)) as string | undefined;

    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    const secret = process.env['JWT_SECRET'];
    if (!secret) return next(new Error('Server misconfiguration: JWT_SECRET missing'));

    try {
      const payload = jwt.verify(token, secret) as { userId: string };
      (socket as Socket & { userId: string }).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection Handler ──────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = (socket as Socket & { userId: string }).userId;

    // Join personal user room for targeted notifications
    socket.join(`user:${userId}`);

    const isFirstConnection = !userSockets.has(userId) || (userSockets.get(userId)?.size ?? 0) === 0;
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    // Broadcast presence update only when transitioning from 0 to 1 active session
    if (isFirstConnection) {
      io?.emit('presence:update', { userId, isOnline: true });
    }

    // ── Room Join / Leave ─────────────────────────────────────────────────────
    socket.on('chat:join', (data: { conversationId?: string }) => {
      if (data?.conversationId) {
        socket.join(`conversation:${data.conversationId}`);
      }
    });

    socket.on('chat:leave', (data: { conversationId?: string }) => {
      if (data?.conversationId) {
        socket.leave(`conversation:${data.conversationId}`);
      }
    });

    // ── Live Typing Relay ─────────────────────────────────────────────────────
    socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (data?.conversationId) {
        socket.to(`conversation:${data.conversationId}`).emit('chat:peer_typing', {
          conversationId: data.conversationId,
          userId,
          isTyping: !!data.isTyping,
        });
      }
    });

    // ── Read Receipt Synchronization ──────────────────────────────────────────
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
        console.error('[Socket.io] Read receipt persistence failed:', err);
      }
    });

    // ── Presence Query Protocol ───────────────────────────────────────────────
    socket.on('presence:query', (data: { userIds: string[] }, callback) => {
      if (typeof callback === 'function' && Array.isArray(data?.userIds)) {
        callback(getOnlineUsers(data.userIds));
      }
    });

    // ── Disconnection Handler ─────────────────────────────────────────────────
    socket.on('disconnect', () => {
      userSockets.get(userId)?.delete(socket.id);
      if (userSockets.get(userId)?.size === 0) {
        userSockets.delete(userId);
        io?.emit('presence:update', { userId, isOnline: false });
      }
    });
  });

  return io;
}

/**
 * Accessor for the active SocketIOServer instance.
 * Throws if accessed prior to server initialization.
 */
export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized. Call initSocketServer first.');
  return io;
}

/**
 * Dispatches an event directly to every active socket belonging to a target user.
 * If the user has multiple tabs/devices open, all connections receive the event.
 *
 * @param userId - Target recipient's unique identifier.
 * @param event - Event name string.
 * @param data - Event payload.
 */
export function emitToUser(userId: string, event: string, data: unknown): void {
  const socketIds = userSockets.get(userId);
  if (!socketIds || socketIds.size === 0) {
    return;
  }
  const ioInstance = getIO();
  for (const sid of socketIds) {
    ioInstance.to(sid).emit(event, data);
  }
}

/**
 * Broadcasts an announcement event globally to all connected clients.
 *
 * @param event - Event identifier string.
 * @param data - Broadcast payload.
 */
export function broadcastGlobal(event: string, data: unknown): void {
  const ioInstance = getIO();
  ioInstance.emit(event, data);
}
