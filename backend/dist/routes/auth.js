import { Router } from 'express';
import { prisma } from '../prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signAuthToken, verifyOneTimeToken } from '../lib/jwt.js';
import { RegistrationStatus, Role, TokenType } from '../constants.js';
import { requireAuth } from '../middleware/auth.js';
import { buildFriendshipsForUser } from '../lib/friendship.js';
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
    // 阶段 4：激活成功后自动与同部门所有员工互加好友
    await buildFriendshipsForUser(user.id).catch((err) => {
        console.error('[friendship] 激活后自动加好友失败（不阻断激活）:', err);
    });
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
router.get('/me', requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
        res.status(404).json({ ok: false, error: '用户不存在' });
        return;
    }
    res.json({ ok: true, data: { user: publicUser(user) } });
});
// 更新自己的资料（头像 / 个性标签）
router.patch('/me', requireAuth, async (req, res) => {
    const { avatarUrl, bio } = req.body ?? {};
    const patch = {};
    if (avatarUrl !== undefined) {
        if (avatarUrl === null || avatarUrl === '') {
            patch.avatarUrl = null;
        }
        else if (typeof avatarUrl === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(avatarUrl)) {
            patch.avatarUrl = avatarUrl;
        }
        else {
            res.status(400).json({ ok: false, error: '头像地址不合法' });
            return;
        }
    }
    if (bio !== undefined) {
        if (bio === null || bio === '') {
            patch.bio = null;
        }
        else if (typeof bio === 'string') {
            const trimmed = bio.trim();
            if (trimmed.length > 30) {
                res.status(400).json({ ok: false, error: '个性标签最多 30 个字' });
                return;
            }
            patch.bio = trimmed || null;
        }
        else {
            res.status(400).json({ ok: false, error: '个性标签格式不正确' });
            return;
        }
    }
    if (Object.keys(patch).length === 0) {
        res.status(400).json({ ok: false, error: '至少提供一项要修改的内容' });
        return;
    }
    const user = await prisma.user.update({ where: { id: req.userId }, data: patch });
    res.json({ ok: true, data: { user: publicUser(user) } });
});
// 修改自己的密码（所有登录用户）
router.post('/change-password', requireAuth, async (req, res) => {
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
function publicUser(u) {
    const { passwordHash: _omit, ...rest } = u;
    return rest;
}
export default router;
//# sourceMappingURL=auth.js.map