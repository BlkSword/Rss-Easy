#!/bin/sh
# =====================================================
# RSS-Post Docker Entrypoint (统一版本)
# =====================================================
#
# 支持两种服务类型:
#   - SERVICE_TYPE=app: 主应用服务
#   - SERVICE_TYPE=worker: Worker 服务（根据 WORKER_TYPE 启动）
#
# =====================================================

set -e

# 生成随机字符串
generate_secret() {
  head -c 32 /dev/urandom | base64 | tr -d '\n='
}

# =====================================================
# 自动生成必要密钥（如果未设置）
# =====================================================

if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "dev-secret-change-in-production" ]; then
  export NEXTAUTH_SECRET=$(generate_secret)
  echo "[INFO] 自动生成 NEXTAUTH_SECRET"
fi

if [ -z "$CRON_SECRET" ]; then
  export CRON_SECRET=$(generate_secret)
  echo "[INFO] 自动生成 CRON_SECRET"
fi

# =====================================================
# 设置默认值
# =====================================================

: ${NODE_ENV:="production"}
: ${LOG_LEVEL:="info"}
: ${AI_PROVIDER:="openai"}
: ${AI_MODEL:="gpt-4o-mini"}
: ${NEXTAUTH_URL:="http://localhost:8915"}
: ${APP_URL:="http://localhost:8915"}

# =====================================================
# 根据服务类型启动
# =====================================================

echo "=========================================="
echo "  RSS-Post Starting..."
echo "=========================================="
echo ""
echo "Service Type: ${SERVICE_TYPE}"
echo "Node Env: ${NODE_ENV}"
echo "Log Level: ${LOG_LEVEL}"

# 等待数据库就绪
if [ -n "$DATABASE_URL" ]; then
  echo "[INFO] Waiting for database..."
  sleep 3
fi

# 等待 Redis 就绪
if [ -n "$REDIS_HOST" ]; then
  echo "[INFO] Waiting for Redis..."
  sleep 2
fi

case "$SERVICE_TYPE" in
  # ===================================================
  # Worker 服务
  # ===================================================
  "worker")
    echo ""
    echo "Worker Type: ${WORKER_TYPE}"

    case "$WORKER_TYPE" in
      "preliminary")
        echo "[INFO] Starting Preliminary Worker..."
        echo "  Concurrency: ${PRELIMINARY_WORKER_CONCURRENCY:-5}"
        echo "  Min Value: ${PRELIMINARY_MIN_VALUE:-3}"
        echo ""
        exec dumb-init -- tsx --tsconfig tsconfig.json scripts/start-preliminary-worker.ts
        ;;

      "deep-analysis")
        echo "[INFO] Starting Deep Analysis Worker..."
        echo "  Concurrency: ${DEEP_ANALYSIS_WORKER_CONCURRENCY:-2}"
        echo "  Reflection: ${REFLECTION_ENABLED:-true}"
        echo ""
        exec dumb-init -- tsx --tsconfig tsconfig.json scripts/start-deep-analysis-worker.ts
        ;;

      "feed-discovery")
        echo "[INFO] Starting Feed Discovery Worker..."
        echo "  Concurrency: ${FEED_DISCOVERY_CONCURRENCY:-3}"
        echo ""
        exec dumb-init -- tsx --tsconfig tsconfig.json scripts/start-feed-discovery-worker.ts
        ;;

      *)
        echo "[ERROR] Unknown WORKER_TYPE: $WORKER_TYPE"
        echo "[INFO] Valid types: preliminary, deep-analysis, feed-discovery"
        exit 1
        ;;
    esac
    ;;

  # ===================================================
  # 主应用服务（默认）
  # ===================================================
  "app"|"")
    echo "AI Provider: ${AI_PROVIDER}"
    echo "AI Model: ${AI_MODEL}"
    echo ""

    # 执行传入的命令（启动主应用）
    exec "$@"
    ;;

  *)
    echo "[ERROR] Unknown SERVICE_TYPE: $SERVICE_TYPE"
    echo "[INFO] Valid types: app, worker"
    exit 1
    ;;
esac
