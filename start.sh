#!/bin/bash
#
# Rss-Easy 一键部署脚本
# 集成安全依赖安装、环境配置、服务启动
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================"
echo "Rss-Easy 一键部署脚本"
echo "================================"
echo ""

# ========================================
# 第一步：检查 Docker
# ========================================
echo "[1/8] 检查 Docker 环境..."

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}[错误] Docker 未运行，请先启动 Docker Desktop${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 已安装: $(docker --version | head -n1)${NC}"

# ========================================
# 第二步：检查并安装安全依赖
# ========================================
echo ""
echo "[2/8] 检查安全依赖..."

if grep -q "dompurify" package.json 2>/dev/null; then
    echo -e "${GREEN}✓ DOMPurify 已安装${NC}"
else
    echo -e "${YELLOW}⚠ DOMPurify 未安装，正在自动安装...${NC}"
    npm install dompurify @types/dompurify > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ DOMPurify 安装成功${NC}"
    else
        echo -e "${RED}✗ DOMPurify 安装失败${NC}"
        echo "请手动运行: npm install dompurify @types/dompurify"
        exit 1
    fi
fi

# ========================================
# 第三步：检查 .env 文件
# ========================================
echo ""
echo "[3/8] 检查环境配置..."

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env 文件不存在${NC}"
    echo ""
    echo "正在从 .env.example 创建 .env 文件..."
    cp .env.example .env

    # 生成随机密钥
    JWT_SECRET=$(openssl rand -base64 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    CRON_SECRET=$(openssl rand -base64 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 16)
    REDIS_PASSWORD=$(openssl rand -base64 16)

    echo ""
    echo "已生成安全密钥："
    echo "  JWT_SECRET, NEXTAUTH_SECRET, ENCRYPTION_KEY, CRON_SECRET"
    echo "  POSTGRES_PASSWORD, REDIS_PASSWORD"
    echo ""

    # 更新 .env 文件
    sed -i.bak "s/your-super-secret-jwt-key-min-32-characters-long/$JWT_SECRET/g" .env
    sed -i.bak "s/your-super-secret-nextauth-key/$NEXTAUTH_SECRET/g" .env
    sed -i.bak "s/your-encryption-key-here/$ENCRYPTION_KEY/g" .env
    sed -i.bak "s/your-cron-secret-key-here/$CRON_SECRET/g" .env
    sed -i.bak "s/rss_easy_password/$POSTGRES_PASSWORD/g" .env
    sed -i.bak "s/your-redis-password/$REDIS_PASSWORD/g" .env

    rm .env.bak

    echo -e "${GREEN}✓ .env 文件已创建并配置随机密钥${NC}"
    echo ""
    echo -e "${YELLOW}[重要] 以下密钥需要手动配置：${NC}"
    echo "  - OPENAI_API_KEY"
    echo "  - ANTHROPIC_API_KEY"
    echo "  - DEEPSEEK_API_KEY"
    echo ""
    read -p "是否现在编辑 .env 文件？(yes/no): " edit_now

    if [ "$edit_now" = "yes" ]; then
        ${EDITOR:-nano} .env
    fi
fi

# ========================================
# 第四步：验证关键环境变量
# ========================================
echo ""
echo "[4/8] 验证安全配置..."

SECURITY_ISSUES=0

if grep -q "JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long" .env; then
    echo -e "${RED}[错误] JWT_SECRET 使用默认值${NC}"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi

if grep -q "POSTGRES_PASSWORD=rss_easy_password" .env; then
    echo -e "${YELLOW}[警告] POSTGRES_PASSWORD 使用默认值${NC}"
fi

if [ $SECURITY_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ 环境变量检查通过${NC}"
else
    echo ""
    echo -e "${RED}发现安全问题，请修复后重试${NC}"
    exit 1
fi

# ========================================
# 第五步：检查必要依赖
# ========================================
echo ""
echo "[5/8] 检查构建依赖..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}[错误] Docker 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 可用${NC}"

# ========================================
# 第六步：选择启动模式
# ========================================
echo ""
echo "请选择启动模式："
echo "  1) 开发环境 (docker-compose.yml)"
echo "  2) 生产环境 (docker-compose.prod.yml)"
echo ""
read -p "请输入选项 (1/2): " mode

case $mode in
    2)
        COMPOSE_FILE="docker-compose.prod.yml"
        echo -e "${BLUE}[生产模式] 使用 docker-compose.prod.yml${NC}"
        ;;
    *)
        COMPOSE_FILE="docker-compose.yml"
        echo -e "${BLUE}[开发模式] 使用 docker-compose.yml${NC}"
        ;;
esac

# ========================================
# 第七步：准备启动
# ========================================
echo ""
echo "[6/8] 准备启动服务..."

# 确保备份脚本可执行
chmod +x scripts/*.sh 2>/dev/null || true

# 停止现有容器
echo "停止现有容器..."
docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

# 清理悬空镜像
echo "清理悬空镜像..."
docker image prune -f > /dev/null 2>&1 || true

# ========================================
# 第八步：启动服务
# ========================================
echo ""
echo "[7/8] 启动 Docker 服务..."
echo ""

docker-compose -f $COMPOSE_FILE up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] Docker 服务启动失败${NC}"
    echo ""
    echo "查看详细日志："
    echo "  docker-compose -f $COMPOSE_FILE logs"
    exit 1
fi

# 等待服务启动
echo ""
echo "[8/8] 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "检查服务状态..."
docker-compose -f $COMPOSE_FILE ps

# ========================================
# 完成
# ========================================
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ 部署完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}访问信息：${NC}"
echo "  应用地址: http://localhost:8915"
echo "  健康检查: http://localhost:8915/api/health"
echo ""
echo -e "${YELLOW}常用命令：${NC}"
echo "  查看日志: docker-compose -f $COMPOSE_FILE logs -f"
echo "  查看状态: docker-compose -f $COMPOSE_FILE ps"
echo "  停止服务: docker-compose -f $COMPOSE_FILE down"
echo "  重启服务: docker-compose -f $COMPOSE_FILE restart"
echo "  重新构建: docker-compose -f $COMPOSE_FILE up -d --build"
echo ""
echo -e "${YELLOW}数据库管理：${NC}"
echo "  运行备份: docker exec rss-easy-backup sh /scripts/backup.sh"
echo "  查看备份: ls -lh backups/"
echo ""
echo -e "${YELLOW}AI 分析管理：${NC}"
echo "  查看队列状态: curl http://localhost:8915/api/scheduler/status"
echo "  手动触发分析: curl -X POST http://localhost:8915/api/scheduler/trigger -H 'Content-Type: application/json' -d '{\"type\":\"both\"}'"
echo ""
