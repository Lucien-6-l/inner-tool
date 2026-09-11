import { PrismaClient } from '@prisma/client';
// 全局单例，避免开发热重载时重复创建连接
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
//# sourceMappingURL=prisma.js.map