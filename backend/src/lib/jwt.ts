import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// 登录态令牌
export interface AuthTokenPayload {
  sub: string; // userId
  email: string;
  role: string;
}

// 一次性令牌（激活链接等）；有效期 24 小时，缩短泄露利用窗口
export interface OneTimeTokenPayload {
  type: string;
  email: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function signOneTimeToken(payload: OneTimeTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
}

export function verifyOneTimeToken(token: string): OneTimeTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as OneTimeTokenPayload;
  } catch {
    return null;
  }
}
