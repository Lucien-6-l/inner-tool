import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';

const app = express();
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'inner-tool-backend', time: new Date().toISOString() });
});

const server = http.createServer(app);

// Socket.IO —— 阶段 5 消息实时通道，先挂载占位
const io = new Server(server, {
  cors: { origin: config.clientOrigin, credentials: true },
});

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

server.listen(config.port, () => {
  console.log(`[inner-tool] backend listening on http://localhost:${config.port}`);
});
