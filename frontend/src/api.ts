// 统一的 API 请求封装：自动带 token、统一错误处理
import { ref } from 'vue';

export const TOKEN_KEY = 'inner_tool_token';
export const USER_KEY = 'inner_tool_user';

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  phone: string;
  department: string;
  role: 'DEV' | 'ADMIN' | 'MEMBER';
  isActive: boolean;
}

export const currentUser = ref<UserInfo | null>(loadUser());

function loadUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: UserInfo) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  currentUser.value = user;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentUser.value = null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// 轻量 fetch 封装；401 时清除会话并跳登录
// options.form=true 时按 FormData 发送（文件上传），不设 Content-Type
export async function request<T>(path: string, options: RequestInit & { form?: boolean } = {}): Promise<T> {
  const isForm = options.form === true;
  const headers: Record<string, string> = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => null);

  if (res.status === 401) {
    clearSession();
    if (!location.pathname.startsWith('/login')) {
      location.href = '/login';
    }
    throw new ApiError(res.status, body?.error ?? '未登录');
  }
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `请求失败(${res.status})`);
  }
  return body.data as T;
}
