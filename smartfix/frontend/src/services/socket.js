import { io } from 'socket.io-client';
import { getPortalToken } from '../utils/authStorage';

const getSocketUrl = () => {
  if (import.meta.env?.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL.replace('/api', '');
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000`;
  }
  return 'http://localhost:5000';
};

const SOCKET_URL = getSocketUrl();

const getActiveToken = () => {
  if (typeof window === 'undefined') return null;
  const path = window.location?.pathname || '';
  if (path.startsWith('/worker')) {
    return getPortalToken('worker');
  }
  if (path.startsWith('/admin')) {
    return getPortalToken('admin');
  }
  return getPortalToken('customer');
};

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  auth: (cb) => {
    const token = getActiveToken();
    cb({ token });
  },
});

/**
 * Explicitly reconnect socket using a specific portal's token
 */
export const reconnectSocketForRole = (role) => {
  const token = getPortalToken(role);
  socket.auth = { token };
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
};

socket.on('connect', () => {
  console.log('⚡ Connected to Socket.IO server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.warn('🔌 Disconnected from Socket.IO server:', reason);
});

export default socket;
