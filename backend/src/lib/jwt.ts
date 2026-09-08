import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// 登录态令牌
export interface AuthTokenPayload {
  sub: string; // userId
  email: string;
  role: string;
}

// 一次性令牌（激活链接等）
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
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyOneTimeToken(token: string): OneTimeTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as OneTimeTokenPayload;
  } catch {
    return null;
  }
}
