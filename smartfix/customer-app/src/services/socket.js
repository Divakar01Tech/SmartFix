import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('🔌 Socket connected:', socket.id);
  // Re-join user room if we have a stored user ID
  const user = localStorage.getItem('hb_user');
  if (user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed?.id) socket.emit('join-user', parsed.id);
    } catch (e) {}
  }
});

socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
socket.on('connect_error', (err) => console.warn('Socket error:', err.message));

export default socket;
