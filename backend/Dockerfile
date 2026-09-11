FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build
RUN npx prisma generate

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3000

# 启动命令：先同步数据库，再启动服务
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
