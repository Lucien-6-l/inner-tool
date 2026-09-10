import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { prisma } from '../prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

// ===== 上传配置（与全局上传白名单一致） =====
const uploadDir = path.join(process.cwd(), 'uploads', 'timeline');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXT = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z', 'txt', 'md', 'csv',
]);
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'text/plain', 'text/markdown', 'text/csv',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const mimeOk = file.mimetype.startsWith('image/') || ALLOWED_MIME.has(file.mimetype);
    if (ALLOWED_EXT.has(ext) && mimeOk) { cb(null, true); return; }
    cb(new Error('不支持的文件类型'));
  },
});

// ===== 工具函数 =====
async function canAccessTimeline(userId: string, role: string, timelineId: string): Promise<boolean> {
  if (role === 'DEV') return true;
  const tl = await prisma.timeline.findUnique({ where: { id: timelineId } });
  if (!tl) return false;
  if (tl.creatorId === userId) return true;
  const p = await prisma.timelineParticipant.findUnique({
    where: { timelineId_userId: { timelineId, userId } },
  });
  return !!p;
}

async function logActivity(timelineId: string, userId: string, actionType: string, branchId?: string, detail?: Record<string, unknown>) {
  await prisma.timelineActivity.create({
    data: { timelineId, userId, actionType, branchId, detail: detail ? JSON.stringify(detail) : null },
  });
}

// ===== 时间线 CRUD =====

// 创建时间线（项目发起人）
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { name, description, participantIds } = req.body as { name: string; description?: string; participantIds?: string[] };
  if (!name?.trim()) { res.status(400).json({ ok: false, error: '项目名称必填' }); return; }

  const result = await prisma.$transaction(async (tx) => {
    const tl = await tx.timeline.create({
      data: { name: name.trim(), description: description?.trim() || null, creatorId: req.userId! },
    });
    // 主线分支
    await tx.timelineBranch.create({ data: { timelineId: tl.id, isMain: true, ownerId: null } });
    // 发起人个人分支
    await tx.timelineBranch.create({ data: { timelineId: tl.id, isMain: false, ownerId: req.userId } });
    // 添加参与者
    if (participantIds?.length) {
      const uniqueIds = [...new Set(participantIds)].filter((id) => id !== req.userId);
      for (const uid of uniqueIds) {
        await tx.timelineParticipant.create({ data: { timelineId: tl.id, userId: uid } });
        // 每个参与者自动创建个人分支
        await tx.timelineBranch.create({ data: { timelineId: tl.id, isMain: false, ownerId: uid } });
      }
    }
    await tx.timelineActivity.create({
      data: { timelineId: tl.id, userId: req.userId!, actionType: 'timeline_created', detail: JSON.stringify({ name: tl.name }) },
    });
    return tl;
  });

  res.json({ ok: true, data: { id: result.id } });
});

// 时间线列表（开发者全部；其余仅参与或发起的）
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const where = req.role === 'DEV'
    ? {}
    : { OR: [{ creatorId: req.userId }, { participants: { some: { userId: req.userId } } }] };
  const list = await prisma.timeline.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { participants: true, branches: true, mergeRequests: true } },
    },
  });
  res.json({ ok: true, data: { list } });
});

// 时间线详情
router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  if (!await canAccessTimeline(req.userId!, req.role!, id)) { res.status(403).json({ ok: false, error: '无权限查看' }); return; }

  const tl = await prisma.timeline.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true } },
      participants: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true } } } },
      branches: { include: { owner: { select: { id: true, name: true, avatarUrl: true } }, _count: { select: { files: true } } } },
    },
  });
  if (!tl) { res.status(404).json({ ok: false, error: '时间线不存在' }); return; }
  res.json({ ok: true, data: tl });
});

// ===== 参与者管理 =====

// 添加参与者（仅发起人）
router.post('/:id/participants', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { userIds } = req.body as { userIds: string[] };
  const tl = await prisma.timeline.findUnique({ where: { id } });
  if (!tl) { res.status(404).json({ ok: false, error: '时间线不存在' }); return; }
  if (tl.creatorId !== req.userId && req.role !== 'DEV') { res.status(403).json({ ok: false, error: '仅发起人可添加参与者' }); return; }

  const added: string[] = [];
  for (const uid of [...new Set(userIds || [])]) {
    const exists = await prisma.timelineParticipant.findUnique({ where: { timelineId_userId: { timelineId: id, userId: uid } } });
    if (!exists) {
      await prisma.timelineParticipant.create({ data: { timelineId: id, userId: uid } });
      await prisma.timelineBranch.create({ data: { timelineId: id, isMain: false, ownerId: uid } });
      added.push(uid);
      await logActivity(id, req.userId!, 'participant_added', undefined, { userId: uid });
    }
  }
  res.json({ ok: true, data: { addedCount: added.length } });
});

// 移除参与者（仅发起人）
router.delete('/:id/participants/:userId', requireAuth, async (req: AuthedRequest, res) => {
  const { id, userId } = req.params;
  const tl = await prisma.timeline.findUnique({ where: { id } });
  if (!tl) { res.status(404).json({ ok: false, error: '时间线不存在' }); return; }
  if (tl.creatorId !== req.userId && req.role !== 'DEV') { res.status(403).json({ ok: false, error: '仅发起人可移除参与者' }); return; }

  await prisma.$transaction([
    prisma.timelineParticipant.deleteMany({ where: { timelineId: id, userId } }),
    prisma.timelineBranch.deleteMany({ where: { timelineId: id, ownerId: userId, isMain: false } }),
  ]);
  await logActivity(id, req.userId!, 'participant_removed', undefined, { userId });
  res.json({ ok: true });
});

// ===== 分支与文件 =====

// 获取我的分支
router.get('/:id/my-branch', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  if (!await canAccessTimeline(req.userId!, req.role!, id)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  let branch = await prisma.timelineBranch.findFirst({ where: { timelineId: id, ownerId: req.userId, isMain: false } });
  if (!branch) {
    branch = await prisma.timelineBranch.create({ data: { timelineId: id, isMain: false, ownerId: req.userId } });
    await logActivity(id, req.userId!, 'branch_created', branch.id);
  }
  res.json({ ok: true, data: branch });
});

// 分支文件列表
router.get('/branches/:branchId/files', requireAuth, async (req: AuthedRequest, res) => {
  const { branchId } = req.params;
  const branch = await prisma.timelineBranch.findUnique({ where: { id: branchId } });
  if (!branch) { res.status(404).json({ ok: false, error: '分支不存在' }); return; }
  if (!await canAccessTimeline(req.userId!, req.role!, branch.timelineId)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  // 每个文件名取最新版本
  const files = await prisma.timelineFile.findMany({
    where: { branchId },
    orderBy: [{ filename: 'asc' }, { version: 'desc' }],
    include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
  });
  // 去重：只保留每个 filename 的最高 version
  const latest = new Map<string, typeof files[0]>();
  for (const f of files) if (!latest.has(f.filename)) latest.set(f.filename, f);
  res.json({ ok: true, data: { files: [...latest.values()], totalVersions: files.length } });
});

// 上传文件到我的分支
router.post('/:id/my-branch/files', requireAuth, upload.single('file'), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  if (!req.file) { res.status(400).json({ ok: false, error: '未收到文件' }); return; }
  if (!await canAccessTimeline(req.userId!, req.role!, id)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  let branch = await prisma.timelineBranch.findFirst({ where: { timelineId: id, ownerId: req.userId, isMain: false } });
  if (!branch) branch = await prisma.timelineBranch.create({ data: { timelineId: id, isMain: false, ownerId: req.userId } });

  // 计算版本号
  const last = await prisma.timelineFile.findFirst({
    where: { branchId: branch.id, filename: req.file.originalname },
    orderBy: { version: 'desc' },
  });
  const version = (last?.version || 0) + 1;

  const file = await prisma.timelineFile.create({
    data: {
      branchId: branch.id,
      filename: req.file.originalname,
      filePath: `/uploads/timeline/${req.file.filename}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      version,
      uploadedById: req.userId!,
    },
  });
  await logActivity(id, req.userId!, 'file_uploaded', branch.id, { filename: file.filename, version });
  res.json({ ok: true, data: file });
});

// 删除分支文件（仅分支拥有者）
router.delete('/branches/:branchId/files/:fileId', requireAuth, async (req: AuthedRequest, res) => {
  const { branchId, fileId } = req.params;
  const branch = await prisma.timelineBranch.findUnique({ where: { id: branchId } });
  if (!branch) { res.status(404).json({ ok: false, error: '分支不存在' }); return; }
  if (branch.ownerId !== req.userId && req.role !== 'DEV') { res.status(403).json({ ok: false, error: '仅分支拥有者可删除文件' }); return; }

  const file = await prisma.timelineFile.findUnique({ where: { id: fileId } });
  await prisma.timelineFile.delete({ where: { id: fileId } });
  if (file) await logActivity(branch.timelineId, req.userId!, 'file_deleted', branchId, { filename: file.filename, version: file.version });
  res.json({ ok: true });
});

// ===== 活动记录（版本链） =====
router.get('/:id/activity', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  if (!await canAccessTimeline(req.userId!, req.role!, id)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  const list = await prisma.timelineActivity.findMany({
    where: { timelineId: id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json({ ok: true, data: { list } });
});

export default router;
