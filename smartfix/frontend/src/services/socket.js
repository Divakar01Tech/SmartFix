import { io } from 'socket.io-client';

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

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('⚡ Connected to Socket.IO server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.warn('🔌 Disconnected from Socket.IO server:', reason);
});

export default socket;
