import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('⚡ Provider socket connected:', socket.id);
  const user = localStorage.getItem('hb_provider_user');
  if (user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed?.id) socket.emit('join-user', parsed.id);
    } catch (e) {}
  }
});

socket.on('disconnect', () => console.log('Provider socket disconnected'));

export default socket;
