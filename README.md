# 公司内部沟通工具（inner-tool）

10 人小团队的内部沟通工具 · 自研 Web 版 · 自己动手维护

功能：邮箱（QQ 邮箱为主）账号 + 开发者预注册审批、三级权限（开发者/管理员/成员）、部门自动加好友 + 跨部门手动加好友、单聊/部门群、实时消息（Socket.IO）、图片/文件发送、消息持久化、未读已读、「谁想要」点赞抽奖（自设开奖人数与时间、定时/手动开奖）。

## 技术栈

- 前端：Vue 3 + Vite + TypeScript（`frontend/`）
- 后端：Node.js + Express + Socket.IO（`backend/`）
- 数据库：开发期 SQLite（零安装）；部署切 PostgreSQL（表结构不变，仅改 provider + 连接串）
- ORM：Prisma · 认证：JWT + bcrypt · 邮件：nodemailer（QQ 邮箱 SMTP）

## 目录

```
inner-tool/
├── backend/     # API 服务（Express + Socket.IO + Prisma）
├── frontend/    # Web 前端（Vue 3 + Vite）
├── build-all.bat   # 一键构建（Windows）
├── start-prod.bat  # 一键构建 + 生产启动（Windows）
├── docker-compose.yml   # 服务器部署参考（PostgreSQL + Redis）
└── .github/workflows/ci.yml  # CI
```

## 环境要求

- Node.js ≥ 20（已确认 v22）
- 开发期无需安装数据库（SQLite 单文件 `backend/prisma/dev.db`）

## 开发模式（改代码用）

```bash
# 终端 1：后端（端口 3000）
cd backend
npm install
cp .env.example .env   # 按需修改（见下方配置说明）
npm run db:seed        # 首次：创建开发者账号
npm run dev            # tsx watch 热重载

# 终端 2：前端（端口 5173，自动代理 /api、/socket.io、/uploads 到 3000）
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

默认开发者账号：`dev@inner-tool.local` / `Dev123456!`（登录后请尽快在「我的」里改密码）

## 生产模式（正式用，单端口）

```bat
# Windows 一键：构建 + 启动（首次先双击一次即可，之后直接 start-prod.bat）
start-prod.bat
```

访问 http://localhost:3000 （后端自动托管前端静态文件，无需再开 5173）

生产模式下的 SMTP 与数据库配置见下方。

## 配置说明（backend/.env）

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 服务端口 | `3000` |
| `JWT_SECRET` | 登录令牌密钥，**上线务必改成长随机串** | `please_change_me` |
| `SMTP_USER` / `SMTP_PASS` | QQ 邮箱 + SMTP 授权码，**填了才真正发激活邮件**；未填时激活链接打印在后端控制台 | 空 |
| `MAIL_FROM` | 发件人（默认同 SMTP_USER） | — |
| `MAX_ADMINS` | 管理员数量上限 | `5` |
| `DATABASE_URL` | 开发期 `file:./dev.db`；部署改 PostgreSQL 连接串 | `file:./dev.db` |
| `CLIENT_ORIGIN` | 开发期前端地址（CORS 白名单） | `http://localhost:5173` |

### 开启真实邮件（QQ 邮箱）

1. 登录 QQ 邮箱网页版 → 设置 → 账户 → 开启「SMTP 服务」→ 生成**授权码**
2. 填入 `backend/.env`：`SMTP_USER=你的qq邮箱`、`SMTP_PASS=授权码`
3. 重启服务即可；开发者录入名单时会向对方邮箱发送激活链接

### 切换 PostgreSQL（部署服务器时）

1. `backend/prisma/schema.prisma`：`provider = "sqlite"` → `"postgresql"`
2. `backend/.env`：`DATABASE_URL="postgresql://user:pass@host:5432/dbname"`
3. 执行 `npm run db:migrate`（表结构不变，仅换存储）
4. 服务器可用 `docker-compose.yml` 起 PostgreSQL + Redis（Redis 当前版本未使用，预留）

## 常用运维命令（backend 目录）

```bash
npm run dev               # 开发热重载
npm run build && npm start  # 生产构建与启动
npm run typecheck         # TS 类型检查
npm run db:migrate        # 应用数据库迁移
npm run db:seed           # 创建开发者账号（幂等）
npm run db:sync-friendships  # 存量用户补好友/部门群（幂等）
npm run db:studio         # 可视化查看数据库
```

## 数据与备份

- 开发期全部数据在 `backend/prisma/dev.db` 单文件，**备份 = 复制该文件**
- 上传的图片/文件在 `backend/uploads/`（已加入 .gitignore）
- 消息、好友、抽奖全部持久化存储

## 开发顺序

阶段 1 地基 → 2 账号体系 → 3 三级权限 → 4 部门+自动加好友 → 5 消息 → 6 点赞抽奖 → 7 收尾上线（本文件）
