/**
 * 一次性运维脚本：把开发者账号的登录邮箱与密码改为指定值
 * 用法：npx tsx scripts/change-dev-account.ts <新邮箱> <新密码>
 * 说明：仅改 User.email 与 passwordHash；好友/会话/消息等数据按 userId 关联，不受影响
 */
import { prisma } from '../src/prisma.js';
import { hashPassword } from '../src/lib/password.js';

const newEmail = (process.argv[2] ?? '').trim().toLowerCase();
const newPassword = process.argv[3] ?? '';
if (!newEmail || newPassword.length < 8) {
  console.error('用法：npx tsx scripts/change-dev-account.ts <新邮箱> <新密码≥8位>');
  process.exit(1);
}

const conflict = await prisma.user.findUnique({ where: { email: newEmail } });
if (conflict) {
  console.error(`该邮箱已存在用户：${newEmail}`);
  process.exit(1);
}

const dev = await prisma.user.findFirst({ where: { role: 'DEV' } });
if (!dev) {
  console.error('未找到开发者账号，请先执行 npm run db:seed');
  process.exit(1);
}

await prisma.user.update({
  where: { id: dev.id },
  data: { email: newEmail, passwordHash: await hashPassword(newPassword) },
});

console.log(`开发者账号已更新：`);
console.log(`  登录邮箱：${newEmail}`);
console.log(`  原邮箱：${dev.email}（已不可登录）`);
console.log(`  数据（好友/会话/消息/抽奖/审批）均保留`);
await prisma.$disconnect();
