import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { getIo } from '../socket.js';

const router = Router();
router.use(requireAuth);

// 发送消息（文本 / 图片 / 文件）。存储后实时推送会话内所有成员
router.post('/', async (req: AuthedRequest, res) => {
  const { conversationId, type, content, fileName, fileSize } = req.body ?? {};
  if (typeof conversationId !== 'string') {
    res.status(400).json({ ok: false, error: 'conversationId 必填' });
    return;
  }
  if (type !== 'text' && type !== 'image' && type !== 'file') {
    res.status(400).json({ ok: false, error: 'type 必须是 text / image / file' });
    return;
  }
  if (typeof content !== 'string' || content.length === 0 || content.length > 200_000) {
    res.status(400).json({ ok: false, error: '消息内容不能为空且不超过 200KB' });
    return;
  }

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: req.userId as string } },
  });
  if (!member) {
    res.status(403).json({ ok: false, error: '不在该会话中' });
    return;
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: req.userId as string,
      type,
      content,
      fileName: typeof fileName === 'string' ? fileName.slice(0, 255) : null,
      fileSize: typeof fileSize === 'number' && fileSize >= 0 ? fileSize : null,
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });

  getIo()?.to(conversationId).emit('message:new', { message });
  res.json({ ok: true, data: { message } });
});

export default router;
