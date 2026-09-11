import { prisma } from '../prisma.js';
/**
 * 确保两人之间存在 DIRECT 会话（不存在则创建）。
 * 手动添加好友后调用。
 */
export async function ensureDirectConversation(userA, userB) {
    const existing = await prisma.conversation.findFirst({
        where: { kind: 'DIRECT', members: { every: { userId: { in: [userA, userB] } } } },
        select: { id: true },
    });
    if (existing)
        return existing.id;
    return prisma.$transaction(async (tx) => {
        const conv = await tx.conversation.create({ data: { kind: 'DIRECT' } });
        await tx.conversationMember.createMany({
            data: [
                { conversationId: conv.id, userId: userA },
                { conversationId: conv.id, userId: userB },
            ],
        });
        return conv.id;
    });
}
/**
 * 确保该用户的部门群存在，且部门全员在群里（幂等）。
 * 激活成功 / 存量同步时调用。
 */
export async function ensureDepartmentGroup(userId) {
    const me = await prisma.user.findUnique({ where: { id: userId } });
    if (!me)
        return null;
    const members = await prisma.user.findMany({
        where: { department: me.department, isActive: true },
        select: { id: true },
    });
    if (members.length === 0)
        return null;
    const memberIds = members.map((m) => m.id);
    let group = await prisma.conversation.findFirst({
        where: { kind: 'GROUP', department: me.department },
        select: { id: true },
    });
    const convId = await prisma.$transaction(async (tx) => {
        let id = group?.id;
        if (!id) {
            const conv = await tx.conversation.create({
                data: { kind: 'GROUP', name: `${me.department}群`, department: me.department },
            });
            id = conv.id;
        }
        const existing = await tx.conversationMember.findMany({
            where: { conversationId: id, userId: { in: memberIds } },
            select: { userId: true },
        });
        const have = new Set(existing.map((e) => e.userId));
        const missing = memberIds.filter((m) => !have.has(m));
        if (missing.length > 0) {
            await tx.conversationMember.createMany({
                data: missing.map((m) => ({ conversationId: id, userId: m })),
            });
        }
        return id;
    });
    return convId;
}
/**
 * 某个会话里、发给"我"且尚未读的消息数。
 */
export async function unreadCountOf(conversationId, userId) {
    const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member)
        return 0;
    return prisma.message.count({
        where: { conversationId, senderId: { not: userId }, createdAt: { gt: member.lastReadAt } },
    });
}
//# sourceMappingURL=chat.js.map