// 角色与状态常量（与 schema.prisma 的字符串字段对应）

export const Role = {
  DEV: 'DEV',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const RegistrationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

// 预注册名单来源
export const RegistrationSource = {
  DEV: 'DEV', // 开发者直接录入（自动通过）
  ADMIN: 'ADMIN', // 管理员提交（需开发者审批）
} as const;
export type RegistrationSource = (typeof RegistrationSource)[keyof typeof RegistrationSource];

// 激活令牌类型
export const TokenType = {
  ACTIVATE: 'activate',
} as const;
