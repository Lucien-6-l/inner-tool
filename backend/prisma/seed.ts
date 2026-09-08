import { PrismaClient } from '@prisma/client';
import { Role } from '../src/constants.js';
import { hashPassword } from '../src/lib/password.js';

// 首次初始化：创建唯一开发者账号
// 用 npx prisma db seed 执行，或 node prisma/seed.js 手动执行
const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_DEV_EMAIL ?? 'dev@inner-tool.local').toLowerCase();
  const password = process.env.SEED_DEV_PASSWORD ?? 'Dev123456!';
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
  console.log(`已创建开发者账号：${email} / ${password}`);
  console.log('登录后请尽快修改默认密码（阶段 3 提供改密接口）。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
