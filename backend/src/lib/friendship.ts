import { prisma } from '../prisma.js';
import { ensureDepartmentGroup } from './chat.js';

/**
 * 为指定用户建立"同部门好友"关系（双向、幂等），并确保部门群存在。
 * 规则：激活成功后调用；同部门所有已激活用户互为好友。
 */
export async function buildFriendshipsForUser(userId: string): Promise<number> {
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) return 0;

  const colleagues = await prisma.user.findMany({
    where: { department: me.department, id: { not: me.id }, isActive: true },
  });
  if (colleagues.length === 0) return 0;

  const pairs: { ownerId: string; friendId: string }[] = [];
  for (const c of colleagues) {
    pairs.push({ ownerId: me.id, friendId: c.id });
    pairs.push({ ownerId: c.id, friendId: me.id });
  }

  const existing = await prisma.contact.findMany({
    where: { OR: pairs },
    select: { ownerId: true, friendId: true },
  });
  const have = new Set(existing.map((e) => `${e.ownerId}|${e.friendId}`));
  const missing = pairs.filter((p) => !have.has(`${p.ownerId}|${p.friendId}`));

  if (missing.length > 0) {
    await prisma.contact.createMany({ data: missing });
  }
  await ensureDepartmentGroup(me.id).catch((err) => {
    console.error('[friendship] 部门群创建失败（不阻断）:', err);
  });
  return missing.length;
}

/**
 * 全量同步：为所有已激活用户重建同部门好友关系（幂等，用于存量数据补齐）。
 */
export async function syncAllFriendships(): Promise<number> {
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  let total = 0;
  for (const u of users) {
    total += await buildFriendshipsForUser(u.id);
  }
  return total;
}
