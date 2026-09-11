import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import friendsRoutes from './routes/friends.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import uploadRoutes from './routes/upload.js';
import lotteriesRoutes from './routes/lotteries.js';
import timelinesRoutes from './routes/timelines.js';
import mergeRequestsRoutes from './routes/mergeRequests.js';
import { initSocket } from './socket.js';
import { checkDueLotteries } from './lib/lottery.js';
import { prisma } from './prisma.js';
import { hashPassword } from './lib/password.js';
// 安全门：JWT_SECRET 必须配置为强随机值，缺失或默认值一律拒绝启动
if (!config.jwtSecret || config.jwtSecret === 'please_change_me') {
    console.error('[config] JWT_SECRET 未配置或仍为默认值，拒绝启动。请在 backend/.env 中设置强随机密钥（node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"）。');
    process.exit(1);
}
// 生产模式：由后端直接托管前端构建产物（单端口访问，无需 5173）
const isProd = process.env.NODE_ENV === 'production';
const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
const serveFrontend = isProd && fs.existsSync(path.join(frontendDist, 'index.html'));
// CORS 白名单：开发期前端 5173；生产模式额外放行同源端口
const corsOrigins = [config.clientOrigin];
if (serveFrontend)
    corsOrigins.push(`http://localhost:${config.port}`);
const app = express();
app.use(cors({ origin: corsOrigins, credentials: true }));
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
app.use('/api/timelines', timelinesRoutes);
app.use('/api', mergeRequestsRoutes);
// 生产模式：托管前端静态文件 + SPA 路由回退（API/上传/socket 不拦截）
if (serveFrontend) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api\/|\/uploads\/|\/socket\.io).*/, (_req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
}
const server = http.createServer(app);
// 统一错误处理（multer 文件过大 / 类型不合法等 → JSON 响应，避免返回 HTML 500）
app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ ok: false, error: '文件大小不能超过 50MB' });
        return;
    }
    res.status(400).json({ ok: false, error: err.message || '请求处理失败' });
});
// Socket.IO —— 实时消息通道（鉴权 + 会话房间）
initSocket(server, corsOrigins);
// 定时开奖：每分钟检查一次到期的抽奖
setInterval(() => {
    checkDueLotteries().catch((err) => console.error('[lottery] 定时开奖失败:', err));
}, 60 * 1000);
// 启动时初始化开发者账号（从环境变量读取，仅当账号不存在时创建）
async function ensureDevAccount() {
    const email = process.env.SEED_DEV_EMAIL?.toLowerCase();
    const password = process.env.SEED_DEV_PASSWORD;
    if (!email || !password || password.length < 8)
        return;
    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            console.log(`[init] 开发者账号已存在: ${email}`);
            return;
        }
        await prisma.user.create({
            data: {
                email,
                phone: '00000000000',
                name: '开发者',
                department: '管理',
                role: 'DEV',
                passwordHash: await hashPassword(password),
            },
        });
        console.log(`[init] 已创建开发者账号: ${email}`);
    }
    catch (err) {
        console.error('[init] 开发者账号初始化失败:', err);
    }
}
server.listen(config.port, async () => {
    console.log(`[inner-tool] backend listening on http://localhost:${config.port}`);
    await ensureDevAccount();
});
//# sourceMappingURL=index.js.map