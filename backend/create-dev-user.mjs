import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = '1678252258@qq.com';
  const password = 'lucien666999';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('User already exists:', email);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      phone: '00000000000',
      name: '开发者',
      department: '管理',
      role: 'DEV',
      passwordHash,
    },
  });
  console.log('Developer account created:', email);
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    console.error('Full error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
