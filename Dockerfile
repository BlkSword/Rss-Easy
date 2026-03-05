# =====================================================
# RSS-Post Dockerfile (智能内存优化版本)
# 支持通过 build-arg 动态调整内存限制
# =====================================================
# 构建命令:
#   docker build --build-arg BUILD_MEMORY=1024 -t rss-post .
#   docker compose build (由 start.sh 自动传递内存参数)
# =====================================================

# ========== 基础镜像 ==========
FROM node:20-alpine AS base

# 设置 pnpm 环境变量
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# 安装必要工具 + 固定 pnpm 版本
RUN apk add --no-cache dumb-init curl && \
    mkdir -p $PNPM_HOME && \
    corepack enable && \
    npm config set registry https://registry.npmmirror.com && \
    corepack prepare pnpm@10.12.1 --activate && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm config set store-dir /root/.pnpm-store

# ========== 依赖安装层 ==========
FROM base AS deps
WORKDIR /app

# 🆕 接收构建参数
ARG PNPM_CONCURRENCY=2

# 复制 package 文件
COPY package.json package-lock.json* pnpm-lock.yaml* ./
COPY prisma ./prisma/

# 安装生产依赖 + Prisma（不设置 NODE_OPTIONS）
RUN --mount=type=cache,target=/root/.pnpm-store \
    echo "ignore-scripts=false" >> ~/.npmrc && \
    pnpm config set network-concurrency ${PNPM_CONCURRENCY} && \
    pnpm config set child-concurrency ${PNPM_CONCURRENCY} && \
    pnpm install --prod --frozen-lockfile=false --no-optional && \
    pnpm add prisma@6.19.2 && \
    pnpm exec prisma generate

# ========== 构建层 ==========
FROM base AS builder
WORKDIR /app

# 🆕 接收构建参数
ARG BUILD_MEMORY=1536
ARG RUNTIME_MEMORY=512
ARG PNPM_CONCURRENCY=2

# 限制并行编译
ENV NEXT_PRIVATE_STANDALONE_WORKER_THREADS=1
ENV UV_THREADPOOL_SIZE=4
ENV NEXT_TELEMETRY_DISABLED=1

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 安装开发依赖（临时覆盖 NODE_OPTIONS 为空，避免继承）
RUN --mount=type=cache,target=/root/.pnpm-store \
    NODE_OPTIONS="" && \
    echo "ignore-scripts=false" >> ~/.npmrc && \
    pnpm config set network-concurrency ${PNPM_CONCURRENCY} && \
    pnpm config set child-concurrency ${PNPM_CONCURRENCY} && \
    pnpm install --frozen-lockfile=false --no-optional

# 生成 Prisma Client
RUN NODE_OPTIONS="" pnpm exec prisma generate

# 清理缓存
RUN rm -rf node_modules/.cache .next/cache 2>/dev/null || true

# 构建（设置内存限制，带 fallback 策略）
# 通过环境变量跳过 ESLint 和 TypeScript 检查以减少内存
ENV NEXT_ESLINT_IGNORE_DURING_BUILDS=1
ENV NEXT_TYPESCRIPT_CHECK_DURING_BUILDS=0

RUN NODE_OPTIONS="--max-old-space-size=${BUILD_MEMORY}" pnpm run build 2>&1 || \
    (echo "Build failed, retrying with reduced memory..." && \
     NODE_OPTIONS="--max-old-space-size=$((BUILD_MEMORY * 70 / 100)) --max-semi-space-size=32" \
     pnpm run build)

# 清理不必要的文件
RUN rm -rf node_modules/.cache .next/cache node_modules/@types 2>/dev/null || true

# ========== 生产镜像 ==========
FROM base AS runner
WORKDIR /app

# 🆕 接收运行时内存参数
ARG RUNTIME_MEMORY=512

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=${RUNTIME_MEMORY}"
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs nextjs

# 复制必要文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 复制启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 创建日志目录并设置权限
RUN mkdir -p /app/logs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000
ENV PORT=3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["dumb-init", "--", "node", "server.js"]
