#!/bin/bash
#
# Rss-Easy 开发环境初始化脚本
# 一键启动数据库并完成初始化
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================"
echo "Rss-Easy 开发环境初始化"
echo "================================"
echo ""

# ========================================
# 第一步：检查 Docker
# ========================================
echo "[1/5] 检查 Docker 环境..."

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}[错误] Docker 未运行，请先启动 Docker Desktop${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Docker 已就绪${NC}"

# ========================================
# 第二步：启动数据库服务
# ========================================
echo ""
echo "[2/5] 启动 PostgreSQL 和 Redis..."

docker-compose -f docker-compose.dev.yml up -d postgres redis

if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] 数据库服务启动失败${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] 数据库服务已启动${NC}"

# ========================================
# 第三步：等待数据库就绪
# ========================================
echo ""
echo "[3/5] 等待数据库就绪..."

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec rss-easy-db-dev pg_isready -U rss_easy > /dev/null 2>&1; then
        echo -e "${GREEN}[OK] PostgreSQL 已就绪${NC}"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "  等待中... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}[错误] PostgreSQL 启动超时${NC}"
    exit 1
fi

# 检查 Redis
if docker exec rss-easy-redis-dev redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}[OK] Redis 已就绪${NC}"
else
    echo -e "${YELLOW}[警告] Redis 未就绪，但继续执行${NC}"
fi

# ========================================
# 第四步：初始化数据库
# ========================================
echo ""
echo "[4/5] 初始化数据库 (generate + push + seed)..."

echo "  - 生成 Prisma Client..."
if npm run db:generate > /dev/null 2>&1; then
    echo -e "  ${GREEN}[OK] Prisma Client 已生成${NC}"
else
    echo -e "${RED}[错误] Prisma Client 生成失败${NC}"
    exit 1
fi

echo "  - 推送数据库 Schema..."
if npm run db:push > /dev/null 2>&1; then
    echo -e "  ${GREEN}[OK] Schema 已推送${NC}"
else
    echo -e "${RED}[错误] 数据库 Schema 推送失败${NC}"
    exit 1
fi

echo "  - 执行数据库 Seed..."
if npm run db:seed > /dev/null 2>&1; then
    echo -e "  ${GREEN}[OK] Seed 完成${NC}"
else
    echo -e "${YELLOW}[警告] Seed 执行失败（可能已存在数据）${NC}"
fi

# ========================================
# 第五步：完成
# ========================================
echo ""
echo "[5/5] 初始化完成！"
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}开发环境已就绪${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}数据库信息：${NC}"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo -e "${YELLOW}启动开发服务器：${NC}"
echo "  npm run dev"
echo ""
echo -e "${YELLOW}停止数据库服务：${NC}"
echo "  docker-compose -f docker-compose.dev.yml down"
echo ""
