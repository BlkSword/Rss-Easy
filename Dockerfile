# =====================================================
# Rss-Easy Dockerfile
# =====================================================

FROM node:20-alpine AS base

# 安装依赖
FROM base AS deps
WORKDIR /app

# 安装 Prisma CLI (匹配项目版本)
RUN npm install -g prisma@6.19.2

COPY package*.json ./
RUN npm ci

# 构建应用
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 创建必要的目录
RUN mkdir -p public static

RUN npx prisma generate
RUN npm run build

# 生产镜像
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./

# 复制 public 和 static
COPY --from=builder /app/public/ ./public
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
