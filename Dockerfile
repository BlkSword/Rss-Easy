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
# 阶段 2a: 主应用依赖层
# =====================================================
FROM base AS app-deps
WORKDIR /app

# 构建参数
ARG PNPM_CONCURRENCY=4

# Prisma 配置（解决国内网络问题）
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# 只复制 package 文件（最大化缓存）
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装所有依赖（包括 devDependencies，供构建使用）
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm config set network-concurrency ${PNPM_CONCURRENCY} && \
    pnpm config set child-concurrency ${PNPM_CONCURRENCY} && \
    pnpm install --frozen-lockfile=false && \
    pnpm exec prisma generate

# 别名：保持向后兼容
FROM app-deps AS deps

# =====================================================
# 阶段 2b: Worker 依赖层（精简版 ~150MB vs ~1.1GB）
# =====================================================
FROM base AS worker-deps
WORKDIR /app

ARG PNPM_CONCURRENCY=4
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# 复制 Worker 专用依赖文件
COPY package.worker.json package.json
COPY prisma ./prisma/

# 只安装生产依赖（无前端库）
# 注意：pnpm 10.x 需要允许构建脚本运行（prisma、bcrypt 等需要编译）
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm config set network-concurrency ${PNPM_CONCURRENCY} && \
    pnpm config set enable-pre-post-scripts true && \
    pnpm install --prod --frozen-lockfile=false && \
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

# 重建原生模块（确保 lightningcss 等原生依赖匹配当前平台）
# 解决 alpine (musl) 与 glibc 环境的原生模块不兼容问题
COPY package.json pnpm-lock.yaml ./
RUN pnpm rebuild lightningcss 2>/dev/null || true

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
# 阶段 5: Worker 运行时（精简版，约 200MB）
# =====================================================
FROM base AS worker
WORKDIR /app

# 构建参数
ARG RUNTIME_MEMORY=384

# 环境变量
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=${RUNTIME_MEMORY}"
# 添加 node_modules/.bin 到 PATH，确保 tsx 可用
ENV PATH="/app/node_modules/.bin:${PATH}"

# 创建非 root 用户
RUN addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs worker

# 复制精简依赖（无前端库，约 150MB vs 1.1GB）
COPY --from=worker-deps /app/node_modules ./node_modules
COPY --from=worker-deps /app/prisma ./prisma

# 复制 Worker 必要的源代码
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
