import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getIo } from '../socket.js';
import { drawLottery } from '../lib/lottery.js';
import { Role } from '../constants.js';
const router = Router();
router.use(requireAuth);
const MAX_WINNERS = 100;
async function detailOf(lotteryId, viewerId) {
    const lottery = await prisma.lottery.findUnique({
        where: { id: lotteryId },
        include: {
            creator: { select: { id: true, name: true } },
            entries: { include: { user: { select: { id: true, name: true, department: true, email: true } } } },
            winners: { include: { user: { select: { id: true, name: true, department: true } } } },
        },
    });
    if (!lottery)
        return null;
    const { entries, winners, ...rest } = lottery;
    return {
        ...rest,
        creator: rest.creator,
        entries: entries.map((e) => e.user),
        winners: winners.map((w) => w.user),
        myEntry: entries.some((e) => e.userId === viewerId),
    };
}
// 发起抽奖：发图片/文件 + 配文，点赞即参与
router.post('/', async (req, res) => {
    const { conversationId, title, fileUrl, fileName, fileSize, winnerCount, deadline } = req.body ?? {};
    if (typeof conversationId !== 'string' || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ ok: false, error: '会话和配文必填' });
        return;
    }
    const wc = Number(winnerCount);
    if (!Number.isInteger(wc) || wc < 1 || wc > MAX_WINNERS) {
        res.status(400).json({ ok: false, error: `开奖人数必须是 1-${MAX_WINNERS} 的整数` });
        return;
    }
    let dl = null;
    if (deadline != null && deadline !== '') {
        const d = new Date(deadline);
        if (Number.isNaN(d.getTime())) {
            res.status(400).json({ ok: false, error: '开奖时间格式不正确' });
            return;
        }
        dl = d;
    }
    const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: req.userId } },
    });
    if (!member) {
        res.status(403).json({ ok: false, error: '不在该会话中' });
        return;
    }
    const lottery = await prisma.lottery.create({
        data: {
            conversationId,
            creatorId: req.userId,
            title: title.trim().slice(0, 100),
            fileUrl: typeof fileUrl === 'string' ? fileUrl : null,
            fileName: typeof fileName === 'string' ? fileName.slice(0, 255) : null,
            fileSize: typeof fileSize === 'number' && fileSize >= 0 ? fileSize : null,
            winnerCount: wc,
            deadline: dl,
        },
    });
    const message = await prisma.message.create({
        data: {
            conversationId,
            senderId: req.userId,
            type: 'lottery',
            content: lottery.id,
        },
        include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    });
    getIo()?.to(conversationId).emit('message:new', { message });
    res.json({ ok: true, data: { lottery: await detailOf(lottery.id, req.userId), message } });
});
// 抽奖详情（参与人 / 中奖人 / 我是否已报名）
router.get('/:id', async (req, res) => {
    const detail = await detailOf(req.params.id, req.userId);
    if (!detail) {
        res.status(404).json({ ok: false, error: '抽奖不存在' });
        return;
    }
    const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: detail.conversationId, userId: req.userId } },
    });
    if (!member) {
        res.status(403).json({ ok: false, error: '不在该会话中' });
        return;
    }
    res.json({ ok: true, data: { lottery: detail } });
});
// 点赞参与（幂等）
router.post('/:id/entry', async (req, res) => {
    const lotteryId = req.params.id;
    const lottery = await prisma.lottery.findUnique({ where: { id: lotteryId } });
    if (!lottery) {
        res.status(404).json({ ok: false, error: '抽奖不存在' });
        return;
    }
    if (lottery.status !== 'PENDING') {
        res.status(400).json({ ok: false, error: '该抽奖已结束，无法参与' });
        return;
    }
    const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: lottery.conversationId, userId: req.userId } },
    });
    if (!member) {
        res.status(403).json({ ok: false, error: '不在该会话中' });
        return;
    }
    await prisma.lotteryEntry.upsert({
        where: { lotteryId_userId: { lotteryId, userId: req.userId } },
        create: { lotteryId, userId: req.userId },
        update: {},
    });
    getIo()?.to(lottery.conversationId).emit('lottery:updated', { lotteryId });
    res.json({ ok: true, data: { message: '已参与' } });
});
// 取消点赞 = 取消参与资格
router.delete('/:id/entry', async (req, res) => {
    const lotteryId = req.params.id;
    const lottery = await prisma.lottery.findUnique({ where: { id: lotteryId } });
    if (!lottery) {
        res.status(404).json({ ok: false, error: '抽奖不存在' });
        return;
    }
    await prisma.lotteryEntry.deleteMany({
        where: { lotteryId, userId: req.userId },
    });
    getIo()?.to(lottery.conversationId).emit('lottery:updated', { lotteryId });
    res.json({ ok: true, data: { message: '已取消参与' } });
});
// 手动开奖（发起人或开发者可提前开奖）
router.post('/:id/draw', async (req, res) => {
    const lottery = await prisma.lottery.findUnique({ where: { id: req.params.id } });
    if (!lottery) {
        res.status(404).json({ ok: false, error: '抽奖不存在' });
        return;
    }
    if (lottery.creatorId !== req.userId && req.role !== Role.DEV) {
        res.status(403).json({ ok: false, error: '只有发起人或开发者可以开奖' });
        return;
    }
    const r = await drawLottery(lottery.id);
    if (!r.ok) {
        res.status(400).json({ ok: false, error: r.error ?? '开奖失败' });
        return;
    }
    res.json({ ok: true, data: { message: '已开奖' } });
});
export default router;
//# sourceMappingURL=lotteries.js.map