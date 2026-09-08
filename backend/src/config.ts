import 'dotenv/config';

// SMTP 占位符视为未配置（.env.example 复制而来时避免误连）
const smtpUser = process.env.SMTP_USER ?? '';
const smtpPass = process.env.SMTP_PASS ?? '';
const smtpConfigured = Boolean(
  smtpUser && smtpPass && !smtpUser.startsWith('your_') && !smtpPass.startsWith('your_'),
);

export const config = {
  port: Number(process.env.PORT ?? 3000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'please_change_me',
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.qq.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    user: smtpUser,
    pass: smtpPass,
    from: process.env.MAIL_FROM ?? smtpUser,
    enabled: smtpConfigured,
  },
} as const;
