import { prisma } from '../prisma.js';
import { getIo } from '../socket.js';

/** 洗牌（Fisher-Yates） */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 开奖（幂等：仅 PENDING 可开）。
 * 规则：报名人数 ≤ 开奖人数 → 全部中奖（必中，不流局）；否则随机抽取 winnerCount 人。
 * 开奖后往会话推送一条 lottery_result 消息并广播 socket。
 */
export async function drawLottery(lotteryId: string): Promise<{ ok: boolean; error?: string }> {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      entries: { include: { user: { select: { id: true, name: true, department: true } } } },
      conversation: true,
    },
  });
  if (!lottery) return { ok: false, error: '抽奖不存在' };
  if (lottery.status !== 'PENDING') return { ok: false, error: '该抽奖已结束' };

  const pool = lottery.entries.map((e) => e.user);
  const take = Math.min(lottery.winnerCount, pool.length);
  const winners = shuffle(pool).slice(0, take);

  await prisma.$transaction(async (tx) => {
    await tx.lottery.update({
      where: { id: lottery.id },
      data: { status: 'DRAWN', drawnAt: new Date() },
    });
    if (winners.length > 0) {
      await tx.lotteryWinner.createMany({
        data: winners.map((w) => ({ lotteryId: lottery.id, userId: w.id })),
      });
    }
    // 结果消息
    await tx.message.create({
      data: {
        conversationId: lottery.conversationId,
        senderId: lottery.creatorId,
        type: 'lottery_result',
        content: JSON.stringify({
          lotteryId: lottery.id,
          winnerCount: lottery.winnerCount,
          winners: winners.map((w) => ({ id: w.id, name: w.name, department: w.department })),
        }),
      },
    });
  });

  const resultMessage = await prisma.message.findFirst({
    where: { conversationId: lottery.conversationId, type: 'lottery_result' },
    orderBy: { createdAt: 'desc' },
    include: { sender: { select: { id: true, name: true } } },
  });
  getIo()?.to(lottery.conversationId).emit('message:new', { message: resultMessage });
  getIo()?.to(lottery.conversationId).emit('lottery:updated', { lotteryId: lottery.id });
  return { ok: true };
}

/** 扫描并自动开奖：所有到期的 PENDING 抽奖 */
export async function checkDueLotteries(): Promise<number> {
  const due = await prisma.lottery.findMany({
    where: { status: 'PENDING', deadline: { lte: new Date() } },
    select: { id: true },
  });
  let drawn = 0;
  for (const l of due) {
    const r = await drawLottery(l.id);
    if (r.ok) drawn++;
  }
  return drawn;
}
