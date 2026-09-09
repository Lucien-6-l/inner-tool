import { io, type Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

/** 连接实时通道（带登录 token 鉴权）；重复调用返回同一实例 */
export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io('/', { auth: { token: getToken() } });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
