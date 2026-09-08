# 公司内部沟通工具（inner-tool）

10 人小团队的内部沟通工具 · 自研 Web 版 · 自己动手维护

## 技术栈

- 前端：Vue 3 + Vite + TypeScript
- 后端：Node.js + Express + Socket.IO（实时消息）
- 数据库：PostgreSQL + Redis
- ORM：Prisma · 认证：JWT + bcrypt · 邮件：nodemailer（QQ 邮箱 SMTP）

## 目录

```
inner-tool/
├── backend/     # API 服务（Express + Socket.IO + Prisma）
├── frontend/    # Web 前端（Vue 3 + Vite）
├── docker-compose.yml   # 本地 PostgreSQL + Redis
└── .github/workflows/ci.yml  # CI（需 git 仓库）
```

## 环境要求

- Node.js ≥ 20（已确认 v22）
- git（未安装，需安装：`winget install Git.Git`）
- Docker Desktop（推荐，一键起数据库）或本机 PostgreSQL 17 + Redis 7

## 本地启动

```bash
# 1. 起数据库（首次）
docker compose up -d

# 2. 后端
cd backend
cp .env.example .env   # 填入 QQ 邮箱 SMTP 授权码等
npm install
npx prisma migrate dev --name init
npm run dev

# 3. 前端（另开终端）
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 （前端） / http://localhost:3000 （后端健康检查）

## 开发顺序（详见《开发计划-一页纸》）

阶段 1 地基 → 2 账号体系 → 3 三级权限 → 4 部门+自动加好友 → 5 消息 → 6 点赞抽奖 → 7 收尾上线
