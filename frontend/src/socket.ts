import { io } from 'socket.io-client';

const URL = import.meta.env.MODE === 'production' 
  ? (import.meta.env.VITE_BACKEND_URL || undefined) 
  : 'http://localhost:3001';

export const socket = io(URL as string, {
  autoConnect: false
});
