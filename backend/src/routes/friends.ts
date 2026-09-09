import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

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

export default router;
