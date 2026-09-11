import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { unreadCountOf } from '../lib/chat.js';
const router = Router();
router.use(requireAuth);
// 会话列表（含未读数，按最近活动排序）
router.get('/', async (req, res) => {
    const memberships = await prisma.conversationMember.findMany({
        where: { userId: req.userId },
        include: {
            conversation: {
                include: {
                    members: {
                        include: { user: { select: { id: true, name: true, email: true, department: true, avatarUrl: true } } },
                    },
                    messages: { orderBy: { id: 'desc' }, take: 1, include: { sender: { select: { name: true } } } },
                },
            },
        },
    });
    const items = [];
    for (const ms of memberships) {
        const conv = ms.conversation;
        const peers = conv.members.filter((m) => m.userId !== req.userId);
        const name = conv.kind === 'GROUP' ? (conv.name ?? '群聊') : (peers[0]?.user.name ?? '未知用户');
        const last = conv.messages[0] ?? null;
        items.push({
            id: conv.id,
            kind: conv.kind,
            name,
            department: conv.department,
            unread: await unreadCountOf(conv.id, req.userId),
            lastMessage: last
                ? {
                    type: last.type,
                    content: last.content,
                    fileName: last.fileName,
                    senderName: last.sender?.name ?? '已注销',
                    createdAt: last.createdAt,
                }
                : null,
            memberCount: conv.members.length,
        });
    }
    items.sort((a, b) => {
        const ta = a.lastMessage?.createdAt.getTime() ?? 0;
        const tb = b.lastMessage?.createdAt.getTime() ?? 0;
        return tb - ta;
    });
    res.json({ ok: true, data: { list: items } });
});
// 消息历史（最新一页，按时间升序返回；before=上一页最早消息 id）
router.get('/:id/messages', async (req, res) => {
    const convId = req.params.id;
    const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: convId, userId: req.userId } },
    });
    if (!member) {
        res.status(403).json({ ok: false, error: '不在该会话中' });
        return;
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);
    const before = req.query.before;
    const messages = await prisma.message.findMany({
        where: { conversationId: convId, ...(before ? { id: { lt: before } } : {}) },
        orderBy: { id: 'desc' },
        take: limit,
        include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    });
    messages.reverse();
    res.json({ ok: true, data: { list: messages, hasMore: messages.length === limit } });
});
// 标记已读：更新 lastReadAt；direct 场景把对方发来的消息置 readAt
router.post('/:id/read', async (req, res) => {
    const convId = req.params.id;
    const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: convId, userId: req.userId } },
        include: { conversation: true },
    });
    if (!member) {
        res.status(403).json({ ok: false, error: '不在该会话中' });
        return;
    }
    await prisma.conversationMember.update({
        where: { id: member.id },
        data: { lastReadAt: new Date() },
    });
    if (member.conversation.kind === 'DIRECT') {
        await prisma.message.updateMany({
            where: { conversationId: convId, senderId: { not: req.userId }, readAt: null },
            data: { readAt: new Date() },
        });
    }
    res.json({ ok: true, data: { message: '已读' } });
});
export default router;
//# sourceMappingURL=conversations.js.map