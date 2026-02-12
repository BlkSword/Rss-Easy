#!/bin/bash
#
# Rss-Easy 数据库备份脚本
# 用于 Docker 环境中的 PostgreSQL 数据库备份
#

set -e

# 配置（从环境变量读取）
POSTGRES_USER="${POSTGRES_USER:-rss_easy}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DB="${POSTGRES_DB:-rss_easy}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${DATE}.sql.gz"

echo "================================"
echo "Rss-Easy 数据库备份"
echo "================================"
echo "开始时间: $(date)"
echo "数据库: $POSTGRES_DB"
echo ""

# 执行备份
echo "正在备份数据库..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner \
  --no-acl \
  --verbose \
  | gzip > "$BACKUP_FILE"

# 检查备份是否成功
if [ $? -eq 0 ]; then
  echo "✅ 备份成功: $BACKUP_FILE"

  # 显示文件大小
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "文件大小: $SIZE"
else
  echo "❌ 备份失败!"
  exit 1
fi

# 清理旧备份
echo ""
echo "清理超过 $RETENTION_DAYS 天的旧备份..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 显示当前备份列表
echo ""
echo "当前备份文件:"
ls -lh "$BACKUP_DIR" | grep "backup_"

echo ""
echo "备份完成时间: $(date)"
echo "================================"
