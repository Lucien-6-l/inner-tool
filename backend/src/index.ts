import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import friendsRoutes from './routes/friends.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import uploadRoutes from './routes/upload.js';
import lotteriesRoutes from './routes/lotteries.js';
import { initSocket } from './socket.js';
import { checkDueLotteries } from './lib/lottery.js';

const app = express();
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'inner-tool-backend', time: new Date().toISOString() });
});

// 上传文件静态访问
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 业务路由
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/lotteries', lotteriesRoutes);

const server = http.createServer(app);

// Socket.IO —— 实时消息通道（鉴权 + 会话房间）
initSocket(server);

// 定时开奖：每分钟检查一次到期的抽奖
setInterval(() => {
  checkDueLotteries().catch((err) => console.error('[lottery] 定时开奖失败:', err));
}, 60 * 1000);

server.listen(config.port, () => {
  console.log(`[inner-tool] backend listening on http://localhost:${config.port}`);
});
