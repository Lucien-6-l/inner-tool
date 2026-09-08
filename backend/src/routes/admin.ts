import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { RegistrationSource, RegistrationStatus, Role, TokenType } from '../constants.js';
import { signOneTimeToken } from '../lib/jwt.js';
import { sendActivationMail } from '../lib/mailer.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 预注册名单列表
// DEV：全部；ADMIN：只看自己提交的；成员无权限
router.get('/registrations', requireRole(Role.DEV, Role.ADMIN), async (req: AuthedRequest, res) => {
  const list = await prisma.pendingRegistration.findMany({
    where: req.role === Role.DEV ? undefined : { createdById: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  res.json({ ok: true, data: { list } });
});

// 录入预注册名单
// DEV：直接录入 → 自动通过 + 发激活邮件
// ADMIN：提交名单 → 待审批（开发者决定）
router.post('/registrations', requireRole(Role.DEV, Role.ADMIN), async (req: AuthedRequest, res) => {
  const { email, phone, name, department } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || typeof phone !== 'string' || typeof name !== 'string' || typeof department !== 'string') {
    res.status(400).json({ ok: false, error: '参数错误：需要合法的邮箱、手机号、姓名、部门' });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
    res.status(400).json({ ok: false, error: '该邮箱已是成员账号，无需重复录入' });
    return;
  }
  const existing = await prisma.pendingRegistration.findFirst({
    where: { email: normalizedEmail, status: { in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED] } },
  });
  if (existing) {
    res.status(400).json({ ok: false, error: '该邮箱已存在待审批/已通过的预注册记录' });
    return;
  }

  const isDev = req.role === Role.DEV;
  const reg = await prisma.pendingRegistration.create({
    data: {
      email: normalizedEmail,
      phone,
      name,
      department,
      source: isDev ? RegistrationSource.DEV : RegistrationSource.ADMIN,
      status: isDev ? RegistrationStatus.APPROVED : RegistrationStatus.PENDING,
      createdById: req.userId!,
      reviewedById: isDev ? req.userId : null,
      reviewedAt: isDev ? new Date() : null,
    },
  });

  // 开发者直接录入 → 立即发激活邮件
  if (isDev) {
    const activateUrl = buildActivateUrl(normalizedEmail);
    await sendActivationMail(normalizedEmail, name, activateUrl);
  }
  res.json({
    ok: true,
    data: {
      registration: reg,
      note: isDev ? '已通过并发送激活邮件' : '已提交，等待开发者审批',
    },
  });
});

// 审批名单（仅开发者）
router.post('/registrations/:id/review', requireRole(Role.DEV), async (req: AuthedRequest, res) => {
  const { action, rejectReason } = req.body ?? {};
  const reg = await prisma.pendingRegistration.findUnique({ where: { id: req.params.id } });
  if (!reg) {
    res.status(404).json({ ok: false, error: '名单不存在' });
    return;
  }
  if (reg.status !== RegistrationStatus.PENDING) {
    res.status(400).json({ ok: false, error: '该记录已处理，不能重复审批' });
    return;
  }
  if (action === 'approve') {
    const updated = await prisma.pendingRegistration.update({
      where: { id: reg.id },
      data: { status: RegistrationStatus.APPROVED, reviewedById: req.userId, reviewedAt: new Date(), rejectReason: null },
    });
    const activateUrl = buildActivateUrl(reg.email);
    await sendActivationMail(reg.email, reg.name, activateUrl);
    res.json({ ok: true, data: { registration: updated } });
    return;
  }
  if (action === 'reject') {
    const updated = await prisma.pendingRegistration.update({
      where: { id: reg.id },
      data: {
        status: RegistrationStatus.REJECTED,
        reviewedById: req.userId,
        reviewedAt: new Date(),
        rejectReason: typeof rejectReason === 'string' ? rejectReason.slice(0, 200) : null,
      },
    });
    res.json({ ok: true, data: { registration: updated } });
    return;
  }
  res.status(400).json({ ok: false, error: 'action 必须是 approve 或 reject' });
});

function buildActivateUrl(email: string): string {
  const token = signOneTimeToken({ type: TokenType.ACTIVATE, email });
  return `${config.clientOrigin}/activate?token=${token}`;
}

export default router;
