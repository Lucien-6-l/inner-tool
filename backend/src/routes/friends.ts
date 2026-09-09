import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ensureDirectConversation } from '../lib/chat.js';

const router = Router();
router.use(requireAuth);

// 我的好友列表（同部门自动互为好友；按部门分组展示）
router.get('/', async (req: AuthedRequest, res) => {
  const contacts = await prisma.contact.findMany({
    where: { ownerId: req.userId },
    include: {
      friend: {
        select: { id: true, email: true, name: true, phone: true, department: true, role: true },
      },
    },
    orderBy: [{ friend: { department: 'asc' } }, { friend: { name: 'asc' } }],
  });
  const list = contacts.map((c) => c.friend);
  res.json({ ok: true, data: { list } });
});

// 搜索可添加的用户（排除自己、排除已是好友的；按姓名/邮箱模糊匹配）
router.get('/search', async (req: AuthedRequest, res) => {
  const keyword = String(req.query.keyword ?? '').trim().toLowerCase();
  if (keyword.length < 1) {
    res.json({ ok: true, data: { list: [] } });
    return;
  }
  const mine = await prisma.contact.findMany({
    where: { ownerId: req.userId },
    select: { friendId: true },
  });
  const friendIds = new Set(mine.map((c) => c.friendId));
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: req.userId, notIn: [...friendIds] },
      OR: [{ name: { contains: keyword } }, { email: { contains: keyword } }],
    },
    select: { id: true, email: true, name: true, department: true, role: true },
    take: 10,
  });
  res.json({ ok: true, data: { list: users } });
});

// 手动添加好友（非同部门手动添加；幂等，自动创建单聊会话）
router.post('/add', async (req: AuthedRequest, res) => {
  const { userId } = req.body ?? {};
  if (typeof userId !== 'string' || userId === req.userId) {
    res.status(400).json({ ok: false, error: '参数错误：不能添加自己' });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: userId, isActive: true } });
  if (!target) {
    res.status(404).json({ ok: false, error: '用户不存在' });
    return;
  }
  const existing = await prisma.contact.findUnique({
    where: { ownerId_friendId: { ownerId: req.userId as string, friendId: userId } },
  });
  if (existing) {
    res.json({ ok: true, data: { added: false, message: '你们已经是好友了' } });
    return;
  }
  await prisma.contact.createMany({
    data: [
      { ownerId: req.userId as string, friendId: userId },
      { ownerId: userId, friendId: req.userId as string },
    ],
  });
  await ensureDirectConversation(req.userId as string, userId);
  res.json({ ok: true, data: { added: true, message: '已添加好友' } });
});

export default router;
