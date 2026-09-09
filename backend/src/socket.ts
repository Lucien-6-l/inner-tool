import { Server } from 'socket.io';
import { config } from './config.js';
import { verifyAuthToken } from './lib/jwt.js';
import { prisma } from './prisma.js';
import type http from 'node:http';

let io: Server | null = null;

export function initSocket(server: http.Server, corsOrigins: string[] = [config.clientOrigin]): Server {
  io = new Server(server, {
    cors: { origin: corsOrigins, credentials: true },
  });

  // 鉴权：握手时带 Authorization: Bearer <token>（或 auth.token）
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '');
    const payload = verifyAuthToken(token);
    if (!payload) {
      next(new Error('unauthorized'));
      return;
    }
    socket.data.userId = payload.sub;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    // 加入自己所在的所有会话房间（用 REST 发消息，socket 只做推送）
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    for (const m of memberships) {
      socket.join(m.conversationId);
    }
    socket.emit('ready', { userId });
    console.log(`[socket] connected userId=${userId} rooms=${memberships.length}`);

    socket.on('conversations:changed', async () => {
      const ms = await prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      for (const m of ms) socket.join(m.conversationId);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected userId=${userId}`);
    });
  });

  return io;
}

export function getIo(): Server | null {
  return io;
}
