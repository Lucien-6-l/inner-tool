import { PrismaClient } from '@prisma/client';
import { Role } from '../src/constants.js';
import { hashPassword } from '../src/lib/password.js';

// 首次初始化：创建唯一开发者账号
// 用 npx prisma db seed 执行，或 node prisma/seed.js 手动执行
const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_DEV_EMAIL ?? 'dev@inner-tool.local').toLowerCase();
  // 安全要求：开发者密码必须显式配置（不提供默认密码），避免弱口令上线
  const password = process.env.SEED_DEV_PASSWORD;
  if (!password || password.length < 8) {
    console.error('请先设置环境变量 SEED_DEV_PASSWORD（至少 8 位），再执行 db:seed。');
    console.error('示例：在 backend/.env 中写入 SEED_DEV_PASSWORD=你的强密码');
    process.exit(1);
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`开发者账号已存在：${email}，跳过创建`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      phone: '00000000000',
      name: '开发者',
      department: '管理',
      role: Role.DEV,
      passwordHash: await hashPassword(password),
    },
  });
  console.log(`已创建开发者账号：${email}（密码已设置，请勿在日志中回显）`);
  console.log('登录后请尽快修改默认密码（阶段 3 提供改密接口）。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
