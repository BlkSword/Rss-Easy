#!/bin/bash
#
# RSS-Post 一键部署脚本
# 集成安全依赖安装、环境配置、服务启动
#
# 用法：
#   ./start.sh              # 交互模式，会询问选项
#   ./start.sh --prod       # 非交互模式，直接使用生产配置
#   ./start.sh --dev        # 非交互模式，直接使用开发配置
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认值
INTERACTIVE=true
COMPOSE_FILE="docker-compose.yml"

# 解析命令行参数
for arg in "$@"; do
    case $arg in
        --prod)
            INTERACTIVE=false
            COMPOSE_FILE="docker-compose.prod.yml"
            ;;
        --dev)
            INTERACTIVE=false
            COMPOSE_FILE="docker-compose.yml"
            ;;
        --help)
            echo "RSS-Post 一键部署脚本"
            echo ""
            echo "用法："
            echo "  ./start.sh              # 交互模式"
            echo "  ./start.sh --prod       # 非交互模式，生产环境"
            echo "  ./start.sh --dev        # 非交互模式，开发环境"
            exit 0
            ;;
    esac
done

echo "================================"
echo "RSS-Post 一键部署脚本"
echo "================================"
echo ""

# ========================================
# 第一步：检查 Docker 和 docker compose
# ========================================
echo "[1/6] 检查 Docker 环境..."

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}[错误] Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 已安装: $(docker --version | head -n1)${NC}"

# 检测使用 docker compose 还是 docker-compose
if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    echo -e "${GREEN}✓ 使用 docker compose (插件模式)${NC}"
elif docker-compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
    echo -e "${GREEN}✓ 使用 docker-compose (独立命令)${NC}"
else
    echo -e "${RED}[错误] 未找到 docker compose 命令${NC}"
    echo "请安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# ========================================
# 第二步：检查 .env 文件
# ========================================
echo ""
echo "[2/6] 检查环境配置..."

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env 文件不存在，正在创建...${NC}"

    # 检查 .env.example 是否存在
    if [ ! -f ".env.example" ]; then
        echo -e "${RED}[错误] .env.example 文件不存在${NC}"
        exit 1
    fi

    cp .env.example .env

    # 生成随机密钥
    JWT_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    CRON_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)
    REDIS_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)

    # 更新 .env 文件（兼容 Linux 和 macOS）
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-super-secret-jwt-key-min-32-characters-long/$JWT_SECRET/g" .env
        sed -i '' "s/your-super-secret-nextauth-key/$NEXTAUTH_SECRET/g" .env
        sed -i '' "s/your-encryption-key-here/$ENCRYPTION_KEY/g" .env
        sed -i '' "s/your-cron-secret-key-here/$CRON_SECRET/g" .env
        sed -i '' "s/rss_post_password/$POSTGRES_PASSWORD/g" .env
        sed -i '' "s/your-redis-password/$REDIS_PASSWORD/g" .env
    else
        # Linux
        sed -i "s/your-super-secret-jwt-key-min-32-characters-long/$JWT_SECRET/g" .env
        sed -i "s/your-super-secret-nextauth-key/$NEXTAUTH_SECRET/g" .env
        sed -i "s/your-encryption-key-here/$ENCRYPTION_KEY/g" .env
        sed -i "s/your-cron-secret-key-here/$CRON_SECRET/g" .env
        sed -i "s/rss_post_password/$POSTGRES_PASSWORD/g" .env
        sed -i "s/your-redis-password/$REDIS_PASSWORD/g" .env
    fi

    echo -e "${GREEN}✓ .env 文件已创建并配置安全密钥${NC}"
fi

# ========================================
# 第三步：验证关键环境变量
# ========================================
echo ""
echo "[3/6] 验证安全配置..."

SECURITY_ISSUES=0

if grep -q "JWT_SECRET=\"your-super-secret-jwt-key-min-32-characters-long\"" .env 2>/dev/null; then
    echo -e "${RED}[错误] JWT_SECRET 仍使用默认占位符${NC}"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi

if [ $SECURITY_ISSUES -gt 0 ]; then
    echo ""
    echo -e "${RED}发现安全问题，请检查 .env 文件${NC}"
    if [ "$INTERACTIVE" = true ]; then
        read -p "是否继续？: " continue_anyway
        if [ "$continue_anyway" != "yes" ]; then
            exit 1
        fi
    else
        exit 1
    fi
else
    echo -e "${GREEN}✓ 环境变量检查通过${NC}"
fi

# ========================================
# 第四步：选择启动模式
# ========================================
echo ""
echo "[4/6] 选择启动模式..."

if [ "$INTERACTIVE" = true ]; then
    echo "请选择启动模式："
    echo "  1) 开发环境 (docker-compose.yml) - 快速体验"
    echo "  2) 生产环境 (docker-compose.prod.yml) - 推荐用于正式部署"
    echo ""
    read -p "请输入选项 (1/2，默认 1): " mode

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
else
    if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
        echo -e "${BLUE}[生产模式] 使用 docker-compose.prod.yml${NC}"
    else
        echo -e "${BLUE}[开发模式] 使用 docker-compose.yml${NC}"
    fi
fi

# ========================================
# 第五步：准备启动
# ========================================
echo ""
echo "[5/6] 准备启动服务..."

# 确保脚本可执行
chmod +x scripts/*.sh 2>/dev/null || true

# 停止现有容器
echo "停止现有容器..."
$COMPOSE_CMD -f $COMPOSE_FILE down 2>/dev/null || true

# ========================================
# 第六步：启动服务
# ========================================
echo ""
echo "[6/6] 启动 Docker 服务..."
echo ""

$COMPOSE_CMD -f $COMPOSE_FILE up -d --build

if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] Docker 服务启动失败${NC}"
    echo ""
    echo "查看详细日志："
    echo "  $COMPOSE_CMD -f $COMPOSE_FILE logs"
    exit 1
fi

# 等待服务启动
echo ""
echo "等待服务启动..."
sleep 15

# 检查服务状态
echo ""
echo "检查服务状态..."
$COMPOSE_CMD -f $COMPOSE_FILE ps

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
echo "  查看日志: $COMPOSE_CMD -f $COMPOSE_FILE logs -f"
echo "  查看状态: $COMPOSE_CMD -f $COMPOSE_FILE ps"
echo "  停止服务: $COMPOSE_CMD -f $COMPOSE_FILE down"
echo "  重启服务: $COMPOSE_CMD -f $COMPOSE_FILE restart"
echo ""

if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    echo -e "${YELLOW}数据库备份：${NC}"
    echo "  备份目录: ./backups/"
    echo "  查看备份: ls -lh backups/"
    echo ""
fi

echo -e "${YELLOW}AI 配置：${NC}"
echo "  启动后在设置页面配置 AI API Key"
echo ""
