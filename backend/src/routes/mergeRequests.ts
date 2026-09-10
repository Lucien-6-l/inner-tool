import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

const router = Router();

// 计算汇入所需赞成票数：> 全体参与者 × 2/3
function requiredApprovals(total: number): number {
  return Math.floor((total * 2) / 3) + 1;
}

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

// 创建汇入请求（从我的分支 → 主线）
router.post('/timelines/:timelineId/merge-requests', requireAuth, async (req: AuthedRequest, res) => {
  const { timelineId } = req.params;
  const { title, description } = req.body as { title: string; description?: string };
  if (!title?.trim()) { res.status(400).json({ ok: false, error: '请求标题必填' }); return; }
  if (!await canAccessTimeline(req.userId!, req.role!, timelineId)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  const myBranch = await prisma.timelineBranch.findFirst({ where: { timelineId, ownerId: req.userId, isMain: false } });
  if (!myBranch) { res.status(400).json({ ok: false, error: '您还没有个人分支，请先上传文件' }); return; }

  const fileCount = await prisma.timelineFile.count({ where: { branchId: myBranch.id } });
  if (fileCount === 0) { res.status(400).json({ ok: false, error: '分支中没有文件，无法发起汇入' }); return; }

  // 检查是否已有 pending 请求
  const existing = await prisma.mergeRequest.findFirst({ where: { sourceBranchId: myBranch.id, status: 'pending' } });
  if (existing) { res.status(400).json({ ok: false, error: '已有进行中的汇入请求，请先处理' }); return; }

  const mr = await prisma.mergeRequest.create({
    data: { timelineId, sourceBranchId: myBranch.id, title: title.trim(), description: description?.trim() || null, createdById: req.userId! },
  });
  await logActivity(timelineId, req.userId!, 'mr_created', myBranch.id, { mergeRequestId: mr.id, title: mr.title });
  res.json({ ok: true, data: { id: mr.id } });
});

// 时间线下的汇入请求列表
router.get('/timelines/:timelineId/merge-requests', requireAuth, async (req: AuthedRequest, res) => {
  const { timelineId } = req.params;
  if (!await canAccessTimeline(req.userId!, req.role!, timelineId)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  const list = await prisma.mergeRequest.findMany({
    where: { timelineId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      sourceBranch: { include: { owner: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { votes: true, comments: true } },
    },
  });
  const participantCount = await prisma.timelineParticipant.count({ where: { timelineId } });
  res.json({ ok: true, data: { list, participantCount, requiredApprovals: requiredApprovals(participantCount) } });
});

// 汇入请求详情
router.get('/merge-requests/:id', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const mr = await prisma.mergeRequest.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      sourceBranch: { include: { owner: { select: { id: true, name: true, avatarUrl: true } } } },
      votes: { include: { voter: { select: { id: true, name: true, avatarUrl: true } } } },
      comments: { include: { user: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!mr) { res.status(404).json({ ok: false, error: '请求不存在' }); return; }
  if (!await canAccessTimeline(req.userId!, req.role!, mr.timelineId)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  // 源分支文件（最新版本）
  const allFiles = await prisma.timelineFile.findMany({
    where: { branchId: mr.sourceBranchId },
    orderBy: [{ filename: 'asc' }, { version: 'desc' }],
  });
  const latestFiles = new Map<string, typeof allFiles[0]>();
  for (const f of allFiles) if (!latestFiles.has(f.filename)) latestFiles.set(f.filename, f);

  // 主线文件（用于标记冲突/覆盖）
  const mainBranch = await prisma.timelineBranch.findFirst({ where: { timelineId: mr.timelineId, isMain: true } });
  const mainFiles = mainBranch
    ? await prisma.timelineFile.findMany({ where: { branchId: mainBranch.id }, orderBy: [{ filename: 'asc' }, { version: 'desc' }] })
    : [];
  const mainLatest = new Map<string, number>();
  for (const f of mainFiles) if (!mainLatest.has(f.filename)) mainLatest.set(f.filename, f.version);

  const filesWithStatus = [...latestFiles.values()].map((f) => ({
    ...f,
    isConflict: mainLatest.has(f.filename),
    mainVersion: mainLatest.get(f.filename) || null,
  }));

  const participantCount = await prisma.timelineParticipant.count({ where: { timelineId: mr.timelineId } });
  const approveCount = mr.votes.filter((v) => v.vote === 'approve').length;
  const rejectCount = mr.votes.filter((v) => v.vote === 'reject').length;

  res.json({
    ok: true,
    data: {
      ...mr,
      files: filesWithStatus,
      participantCount,
      requiredApprovals: requiredApprovals(participantCount),
      approveCount,
      rejectCount,
      canMerge: mr.status === 'approved',
    },
  });
});

// 投票（仅参与者；reject 必填问题描述）
router.post('/merge-requests/:id/vote', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { vote, comment } = req.body as { vote: string; comment?: string };
  if (!['approve', 'reject', 'abstain'].includes(vote)) { res.status(400).json({ ok: false, error: '无效投票' }); return; }
  if (vote === 'reject' && !comment?.trim()) { res.status(400).json({ ok: false, error: '驳回票必须填写具体问题所在' }); return; }

  const mr = await prisma.mergeRequest.findUnique({ where: { id } });
  if (!mr) { res.status(404).json({ ok: false, error: '请求不存在' }); return; }
  if (mr.status !== 'pending') { res.status(400).json({ ok: false, error: '该请求已结束，无法投票' }); return; }

  // 投票者必须是参与者（发起人不在参与者表中则无投票权）
  const isParticipant = await prisma.timelineParticipant.findUnique({
    where: { timelineId_userId: { timelineId: mr.timelineId, userId: req.userId! } },
  });
  if (!isParticipant && req.role !== 'DEV') { res.status(403).json({ ok: false, error: '仅项目参与者可投票' }); return; }

  // 覆盖之前的投票
  const existing = await prisma.mergeRequestVote.findUnique({ where: { mergeRequestId_voterId: { mergeRequestId: id, voterId: req.userId! } } });
  if (existing) {
    await prisma.mergeRequestVote.update({
      where: { id: existing.id },
      data: { vote, comment: vote === 'reject' ? comment!.trim() : null },
    });
  } else {
    await prisma.mergeRequestVote.create({
      data: { mergeRequestId: id, voterId: req.userId!, vote, comment: vote === 'reject' ? comment!.trim() : null },
    });
  }
  await logActivity(mr.timelineId, req.userId!, 'mr_voted', undefined, { mergeRequestId: id, vote });

  // 检查是否达到汇入阈值
  const participantCount = await prisma.timelineParticipant.count({ where: { timelineId: mr.timelineId } });
  const votes = await prisma.mergeRequestVote.findMany({ where: { mergeRequestId: id } });
  const approveCount = votes.filter((v) => v.vote === 'approve').length;
  const threshold = requiredApprovals(participantCount);

  let newStatus = mr.status;
  if (approveCount >= threshold) {
    await prisma.mergeRequest.update({ where: { id }, data: { status: 'approved' } });
    newStatus = 'approved';
    await logActivity(mr.timelineId, req.userId!, 'mr_approved', undefined, { mergeRequestId: id, approveCount, threshold });
  }

  res.json({ ok: true, data: { status: newStatus, approveCount, threshold } });
});

// 评论
router.post('/merge-requests/:id/comments', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { content } = req.body as { content: string };
  if (!content?.trim()) { res.status(400).json({ ok: false, error: '评论内容不能为空' }); return; }

  const mr = await prisma.mergeRequest.findUnique({ where: { id } });
  if (!mr) { res.status(404).json({ ok: false, error: '请求不存在' }); return; }
  if (!await canAccessTimeline(req.userId!, req.role!, mr.timelineId)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  const c = await prisma.mergeRequestComment.create({
    data: { mergeRequestId: id, userId: req.userId!, content: content.trim() },
  });
  await logActivity(mr.timelineId, req.userId!, 'mr_commented', undefined, { mergeRequestId: id });
  res.json({ ok: true, data: { id: c.id } });
});

// 执行汇入（status=approved 时，参与者/发起人均可执行）
router.post('/merge-requests/:id/merge', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const mr = await prisma.mergeRequest.findUnique({ where: { id } });
  if (!mr) { res.status(404).json({ ok: false, error: '请求不存在' }); return; }
  if (mr.status !== 'approved') { res.status(400).json({ ok: false, error: '请求未通过投票，无法汇入' }); return; }
  if (!await canAccessTimeline(req.userId!, req.role!, mr.timelineId)) { res.status(403).json({ ok: false, error: '无权限' }); return; }

  const mainBranch = await prisma.timelineBranch.findFirst({ where: { timelineId: mr.timelineId, isMain: true } });
  if (!mainBranch) { res.status(500).json({ ok: false, error: '主线分支不存在' }); return; }

  // 复制源分支最新版本文件到主线（版本号递增）
  const sourceFiles = await prisma.timelineFile.findMany({
    where: { branchId: mr.sourceBranchId },
    orderBy: [{ filename: 'asc' }, { version: 'desc' }],
  });
  const latest = new Map<string, typeof sourceFiles[0]>();
  for (const f of sourceFiles) if (!latest.has(f.filename)) latest.set(f.filename, f);

  let mergedCount = 0;
  for (const f of latest.values()) {
    const lastMain = await prisma.timelineFile.findFirst({
      where: { branchId: mainBranch.id, filename: f.filename },
      orderBy: { version: 'desc' },
    });
    await prisma.timelineFile.create({
      data: {
        branchId: mainBranch.id,
        filename: f.filename,
        filePath: f.filePath,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        version: (lastMain?.version || 0) + 1,
        uploadedById: req.userId!,
      },
    });
    mergedCount++;
  }

  await prisma.mergeRequest.update({
    where: { id },
    data: { status: 'merged', mergedAt: new Date(), mergedById: req.userId },
  });
  await logActivity(mr.timelineId, req.userId!, 'mr_merged', mainBranch.id, { mergeRequestId: id, mergedCount });

  res.json({ ok: true, data: { mergedCount } });
});

// 被拒后重新提交（清空旧投票，status→pending，resubmitCount+1）
router.post('/merge-requests/:id/resubmit', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { title, description } = req.body as { title?: string; description?: string };

  const mr = await prisma.mergeRequest.findUnique({ where: { id } });
  if (!mr) { res.status(404).json({ ok: false, error: '请求不存在' }); return; }
  if (mr.createdById !== req.userId && req.role !== 'DEV') { res.status(403).json({ ok: false, error: '仅发起人可重新提交' }); return; }
  if (mr.status !== 'rejected') { res.status(400).json({ ok: false, error: '仅被驳回的请求可重新提交' }); return; }

  await prisma.$transaction([
    prisma.mergeRequestVote.deleteMany({ where: { mergeRequestId: id } }),
    prisma.mergeRequest.update({
      where: { id },
      data: {
        status: 'pending',
        resubmitCount: { increment: 1 },
        title: title?.trim() || mr.title,
        description: description !== undefined ? (description.trim() || null) : mr.description,
      },
    }),
  ]);
  await logActivity(mr.timelineId, req.userId!, 'mr_resubmitted', undefined, { mergeRequestId: id });
  res.json({ ok: true });
});

export default router;
