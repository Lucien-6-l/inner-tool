import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { RegistrationSource, RegistrationStatus, Role, TokenType } from '../constants.js';
import { signOneTimeToken } from '../lib/jwt.js';
import { sendActivationMail } from '../lib/mailer.js';
import { config } from '../config.js';
const router = Router();
router.use(requireAuth);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 预注册名单列表
// DEV：全部；ADMIN：只看自己提交的；成员无权限
router.get('/registrations', requireRole(Role.DEV, Role.ADMIN), async (req, res) => {
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
router.post('/registrations', requireRole(Role.DEV, Role.ADMIN), async (req, res) => {
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
            createdById: req.userId,
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
router.post('/registrations/:id/review', requireRole(Role.DEV), async (req, res) => {
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
// ===== 成员管理（仅开发者）=====
// 成员列表（开发者/管理员；开发者可设管理员与编辑，管理员仅可删除普通成员）
router.get('/users', requireRole(Role.DEV, Role.ADMIN), async (_req, res) => {
    const list = await prisma.user.findMany({
        orderBy: [{ department: 'asc' }, { name: 'asc' }],
        select: { id: true, email: true, name: true, phone: true, department: true, role: true, isActive: true, createdAt: true, avatarUrl: true, bio: true },
    });
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    res.json({ ok: true, data: { list, maxAdmins: config.maxAdmins, adminCount } });
});
// 设置 / 撤销管理员（仅开发者；不能修改开发者账号；管理员数量上限 5）
router.post('/users/:id/role', requireRole(Role.DEV), async (req, res) => {
    const { role } = req.body ?? {};
    if (role !== Role.ADMIN && role !== Role.MEMBER) {
        res.status(400).json({ ok: false, error: 'role 必须是 ADMIN 或 MEMBER' });
        return;
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
        res.status(404).json({ ok: false, error: '成员不存在' });
        return;
    }
    if (target.role === Role.DEV) {
        res.status(400).json({ ok: false, error: '不能修改开发者账号的角色' });
        return;
    }
    if (role === Role.ADMIN && target.role !== Role.ADMIN) {
        const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
        if (adminCount >= config.maxAdmins) {
            res.status(400).json({ ok: false, error: `管理员数量已达上限 ${config.maxAdmins} 人` });
            return;
        }
    }
    const updated = await prisma.user.update({ where: { id: target.id }, data: { role } });
    res.json({ ok: true, data: { user: updated } });
});
// 修改成员信息（仅开发者；不能修改开发者账号）
router.patch('/users/:id', requireRole(Role.DEV), async (req, res) => {
    const { name, phone, department } = req.body ?? {};
    const patch = {};
    if (typeof name === 'string' && name.trim())
        patch.name = name.trim();
    if (typeof phone === 'string' && phone.trim())
        patch.phone = phone.trim();
    if (typeof department === 'string' && department.trim())
        patch.department = department.trim();
    if (Object.keys(patch).length === 0) {
        res.status(400).json({ ok: false, error: '至少提供一项要修改的信息（姓名/手机号/部门）' });
        return;
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
        res.status(404).json({ ok: false, error: '成员不存在' });
        return;
    }
    if (target.role === Role.DEV) {
        res.status(400).json({ ok: false, error: '不能修改开发者账号信息' });
        return;
    }
    const updated = await prisma.user.update({ where: { id: target.id }, data: patch });
    res.json({ ok: true, data: { user: updated } });
});
// 删除成员（开发者可删除管理员/成员；管理员只能删除成员）
// 删除后：好友关系/会话成员资格移除、其发起的抽奖移除、其创建的预注册记录移除；
// 聊天消息历史保留（发送者标记为已注销）
router.delete('/users/:id', requireRole(Role.DEV, Role.ADMIN), async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
        res.status(404).json({ ok: false, error: '成员不存在' });
        return;
    }
    if (target.role === Role.DEV) {
        res.status(400).json({ ok: false, error: '不能删除开发者账号' });
        return;
    }
    if (req.userId === target.id) {
        res.status(400).json({ ok: false, error: '不能删除自己的账号' });
        return;
    }
    if (req.role === Role.ADMIN && target.role === Role.ADMIN) {
        res.status(403).json({ ok: false, error: '管理员不能删除其他管理员，请联系开发者' });
        return;
    }
    if (!target.isActive) {
        res.status(400).json({ ok: false, error: '该账号已是停用状态' });
        return;
    }
    // 事务清理：好友关系（双向）→ 其创建的预注册记录 → 删除账号（其余关系级联）
    await prisma.$transaction([
        prisma.contact.deleteMany({ where: { OR: [{ ownerId: target.id }, { friendId: target.id }] } }),
        prisma.pendingRegistration.deleteMany({ where: { createdById: target.id } }),
        prisma.user.delete({ where: { id: target.id } }),
    ]);
    res.json({ ok: true, data: { message: `已删除成员 ${target.name}（${target.email}）` } });
});
function buildActivateUrl(email) {
    const token = signOneTimeToken({ type: TokenType.ACTIVATE, email });
    // GitHub Pages 部署在 /inner-tool/ 子路径，且使用 hash 路由
    return `${config.clientOrigin}/inner-tool/#/activate?token=${token}`;
}
export default router;
//# sourceMappingURL=admin.js.map