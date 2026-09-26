// src/lib/socket.ts
// Singleton Socket.io client — connects once on first import, reused everywhere.
// Dynamically reads the JWT from the Zustand auth store / localStorage.

import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

function getValidToken(): string {
  const storeToken = useAuthStore.getState().token;
  if (storeToken) return storeToken;
  try {
    const raw = localStorage.getItem('careernest-auth');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed?.state?.token ?? '';
  } catch {
    return '';
  }
}

const BACKEND_URL = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace('/api', '')
  : 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = getValidToken();

  if (!socket) {
    socket = io(BACKEND_URL, {
      auth: (cb) => {
        cb({ token: getValidToken() });
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket.io] Connected successfully —', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.io] Connection error:', err.message);
      // If auth token was missing or expired, refresh socket.auth for next attempt
      if (socket) {
        socket.auth = { token: getValidToken() };
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.io] Disconnected:', reason);
    });
  } else {
    // If socket already exists, ensure its auth payload has the latest token
    socket.auth = { token };
    if (!socket.connected && token) {
      socket.connect();
    }
  }

  return socket;
}

/** Call on logout to cleanly close the connection and reset the singleton. */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

