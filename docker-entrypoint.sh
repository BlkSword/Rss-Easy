#!/bin/sh
# =====================================================
# Rss-Easy Docker Entrypoint
# 自动生成密钥，零配置启动
# =====================================================

# 生成随机字符串
generate_secret() {
  # 使用 /dev/urandom 生成 32 字节随机数据，然后 base64 编码
  head -c 32 /dev/urandom | base64 | tr -d '\n='
}

# 自动生成 NEXTAUTH_SECRET（如果未设置）
if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "dev-secret-change-in-production" ]; then
  export NEXTAUTH_SECRET=$(generate_secret)
  echo "[INFO] 自动生成 NEXTAUTH_SECRET"
fi

# 自动生成 CRON_SECRET（如果未设置）
if [ -z "$CRON_SECRET" ]; then
  export CRON_SECRET=$(generate_secret)
  echo "[INFO] 自动生成 CRON_SECRET"
fi

# 设置默认值
: ${NEXTAUTH_URL:="http://localhost:8915"}
: ${APP_URL:="http://localhost:8915"}
: ${NODE_ENV:="production"}
: ${AI_PROVIDER:="openai"}
: ${AI_MODEL:="gpt-4o"}

echo "[INFO] Rss-Easy 启动中..."
echo "[INFO] NODE_ENV=$NODE_ENV"
echo "[INFO] AI_PROVIDER=$AI_PROVIDER"

# 执行传入的命令
exec "$@"
