# =====================================================
# RSS-Post Dockerfile (统一构建版本)
# =====================================================
#
# 多目标构建支持:
#   - app (默认): 主应用服务（包含前端）
#   - worker: Worker 服务（轻量级，无前端）
#   - deps: 依赖层（用于初始化）
#
# 构建命令:
#   docker build -t rss-post .                          # 默认构建主应用
#   docker build --target worker -t rss-post-worker .   # 构建 Worker
#   docker build --target deps -t rss-post-init .       # 构建初始化镜像
#
# =====================================================

# =====================================================
# 阶段 1: 基础镜像
# =====================================================
FROM node:20-alpine AS base

# 设置 pnpm 环境变量
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# 安装必要工具 + 预安装 tsx（多阶段共用）
RUN apk add --no-cache dumb-init curl python3 make g++ && \
    mkdir -p $PNPM_HOME && \
    corepack enable && \
    npm config set registry https://registry.npmmirror.com && \
    corepack prepare pnpm@10.12.1 --activate && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm config set store-dir /root/.pnpm-store && \
    pnpm add -g tsx

# =====================================================
# 阶段 2: 依赖安装层
# =====================================================
FROM base AS deps
WORKDIR /app

# 构建参数
ARG PNPM_CONCURRENCY=4

# 只复制 package 文件（最大化缓存）
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装所有依赖（包括 devDependencies，供构建使用）
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm config set network-concurrency ${PNPM_CONCURRENCY} && \
    pnpm config set child-concurrency ${PNPM_CONCURRENCY} && \
    pnpm install --frozen-lockfile=false --no-optional && \
    pnpm exec prisma generate

# =====================================================
# 阶段 3: 构建层（仅主应用需要）
# =====================================================
FROM base AS builder
WORKDIR /app

# 构建参数
ARG BUILD_MEMORY=1536

# 构建优化环境变量
ENV NEXT_PRIVATE_STANDALONE_WORKER_THREADS=1
ENV UV_THREADPOOL_SIZE=4
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_ESLINT_IGNORE_DURING_BUILDS=1
ENV NEXT_TYPESCRIPT_CHECK_DURING_BUILDS=0

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 分层复制源代码（按变更频率排序）
COPY prisma ./prisma
COPY lib ./lib
COPY server ./server
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY public ./public
COPY scripts ./scripts
COPY next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs package.json ./

# 构建（带内存限制）
RUN NODE_OPTIONS="--max-old-space-size=${BUILD_MEMORY}" pnpm run build

# 清理不必要的文件
RUN rm -rf node_modules/.cache .next/cache

# =====================================================
# 阶段 4: 主应用运行时（默认 target）
# =====================================================
FROM base AS app
WORKDIR /app

# 构建参数
ARG RUNTIME_MEMORY=512

# 环境变量
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=${RUNTIME_MEMORY}"
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs nextjs

# 复制生产必要文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 复制启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 创建日志目录并设置权限
RUN mkdir -p /app/logs && \
    chown -R nextjs:nodejs /app

USER nextjs

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000
ENV PORT=3000

# 设置服务类型标识
ENV SERVICE_TYPE=app

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["dumb-init", "--", "node", "server.js"]

# =====================================================
# 阶段 5: Worker 运行时（轻量级）
# =====================================================
FROM base AS worker
WORKDIR /app

# 构建参数
ARG RUNTIME_MEMORY=384

# 环境变量
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=${RUNTIME_MEMORY}"

# 创建非 root 用户
RUN addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs worker

# 只复制 Worker 必要文件（无前端）
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY lib ./lib
COPY scripts ./scripts
COPY tsconfig.json ./tsconfig.json

# 复制启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 设置权限
RUN chown -R worker:nodejs /app

USER worker

# 设置服务类型标识
ENV SERVICE_TYPE=worker
# WORKER_TYPE: preliminary | deep-analysis | feed-discovery

ENTRYPOINT ["docker-entrypoint.sh"]
