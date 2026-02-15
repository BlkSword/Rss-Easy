# =====================================================
# Rss-Easy Dockerfile (安全优化版本)
# =====================================================

FROM node:20-alpine AS base

# 安装安全相关工具
RUN apk add --no-cache dumb-init

# 安装依赖
FROM base AS deps
WORKDIR /app

# 安装 Prisma CLI (匹配项目版本)
RUN npm install -g prisma@6.19.2

COPY package*.json ./
RUN npm ci --production=false

# 构建应用
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 创建必要的目录
RUN mkdir -p public static

# 生成 Prisma Client
RUN npx prisma generate

# 构建应用
RUN npm run build

# 生产镜像（安全优化）
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# 创建非 root 用户和组
RUN addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs nextjs

# 复制必要文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public/ ./public
COPY --from=builder /app/.next/static ./.next/static

# 复制启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 创建日志目录
RUN mkdir -p /app/logs && \
    chown -R nextjs:nodejs /app

# 使用非 root 用户
USER nextjs

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 3000

ENV PORT=3000

# 使用启动脚本（自动生成密钥）
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["dumb-init", "--", "node", "server.js"]
