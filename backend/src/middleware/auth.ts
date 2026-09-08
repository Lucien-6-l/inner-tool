import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../lib/jwt.js';
import { prisma } from '../prisma.js';
import type { Role } from '../constants.js';

export interface AuthedRequest extends Request {
  userId?: string;
  role?: string;
}

// 必须登录
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ ok: false, error: '未登录' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ ok: false, error: '登录已过期，请重新登录' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    res.status(401).json({ ok: false, error: '账号不存在或已停用' });
    return;
  }
  req.userId = user.id;
  req.role = user.role;
  next();
}

// 必须为指定角色之一
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role as Role)) {
      res.status(403).json({ ok: false, error: '无权限执行此操作' });
      return;
    }
    next();
  };
}
