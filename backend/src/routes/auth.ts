import { Router } from 'express';
import { prisma } from '../prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signAuthToken, signOneTimeToken, verifyOneTimeToken } from '../lib/jwt.js';
import { RegistrationStatus, Role, TokenType } from '../constants.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

// 激活账号（凭激活链接 token，设置密码，创建正式账号并登录）
router.post('/activate', async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof token !== 'string' || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ ok: false, error: '参数错误：token 必填，密码至少 8 位' });
    return;
  }
  const payload = verifyOneTimeToken(token);
  if (!payload || payload.type !== TokenType.ACTIVATE) {
    res.status(400).json({ ok: false, error: '激活链接无效或已过期' });
    return;
  }
  const email = payload.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    res.status(400).json({ ok: false, error: '该账号已激活，请直接登录' });
    return;
  }
  const reg = await prisma.pendingRegistration.findFirst({
    where: { email, status: RegistrationStatus.APPROVED },
    orderBy: { createdAt: 'desc' },
  });
  if (!reg) {
    res.status(400).json({ ok: false, error: '未找到该邮箱的预注册记录，请联系开发者' });
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      phone: reg.phone,
      name: reg.name,
      department: reg.department,
      role: Role.MEMBER,
      passwordHash: await hashPassword(password),
    },
  });
  const authToken = signAuthToken({ sub: user.id, email: user.email, role: user.role });
  res.json({ ok: true, data: { token: authToken, user: publicUser(user) } });
});

// 登录
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ ok: false, error: '邮箱和密码必填' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive) {
    res.status(401).json({ ok: false, error: '邮箱或密码错误' });
    return;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ ok: false, error: '邮箱或密码错误' });
    return;
  }
  const authToken = signAuthToken({ sub: user.id, email: user.email, role: user.role });
  res.json({ ok: true, data: { token: authToken, user: publicUser(user) } });
});

// 当前登录用户
router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ ok: false, error: '用户不存在' });
    return;
  }
  res.json({ ok: true, data: { user: publicUser(user) } });
});

// 修改自己的密码（所有登录用户）
router.post('/change-password', requireAuth, async (req: AuthedRequest, res) => {
  const { oldPassword, newPassword } = req.body ?? {};
  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
    res.status(400).json({ ok: false, error: '原密码和新密码必填' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ ok: false, error: '新密码至少 8 位' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ ok: false, error: '用户不存在' });
    return;
  }
  const ok = await verifyPassword(oldPassword, user.passwordHash);
  if (!ok) {
    res.status(400).json({ ok: false, error: '原密码不正确' });
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  res.json({ ok: true, data: { message: '密码已更新' } });
});

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  phone: string;
  department: string;
  role: string;
  isActive: boolean;
}) {
  const { passwordHash: _omit, ...rest } = u as typeof u & { passwordHash: string };
  return rest;
}

export default router;
