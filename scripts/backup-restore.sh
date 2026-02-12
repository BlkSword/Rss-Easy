#!/bin/bash
#
# Rss-Easy 数据库恢复脚本
# 用于从备份文件恢复数据库
#

set -e

# 配置
POSTGRES_USER="${POSTGRES_USER:-rss_easy}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DB="${POSTGRES_DB:-rss_easy}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

BACKUP_FILE="$1"

# 检查参数
if [ -z "$BACKUP_FILE" ]; then
  echo "用法: $0 <备份文件>"
  echo ""
  echo "示例: $0 /backups/backup_20240101_020000.sql.gz"
  echo ""
  echo "可用的备份文件:"
  ls -lh /backups/*.sql.gz 2>/dev/null || echo "  未找到备份文件"
  exit 1
fi

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ 错误: 备份文件不存在: $BACKUP_FILE"
  exit 1
fi

# 警告
echo "================================"
echo "⚠️  警告：此操作将覆盖现有数据库！"
echo "================================"
echo "备份文件: $BACKUP_FILE"
echo "目标数据库: $POSTGRES_DB"
echo ""
read -p "确认恢复？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "已取消恢复操作"
  exit 0
fi

# 恢复数据库
echo ""
echo "正在恢复数据库..."
echo ""

# 解压并恢复
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1

# 检查恢复是否成功
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 数据库恢复成功!"
else
  echo ""
  echo "❌ 数据库恢复失败!"
  exit 1
fi

echo ""
echo "恢复完成时间: $(date)"
echo "================================"
