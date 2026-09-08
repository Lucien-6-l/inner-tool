import { Router } from 'express';

const router = Router();

// 阶段 2 起挂载：认证、预注册、管理后台等路由
router.get('/ping', (_req, res) => {
  res.json({ ok: true });
});

export default router;
