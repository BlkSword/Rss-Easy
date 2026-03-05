#!/bin/bash
#
# RSS-Post 一键部署脚本
# 集成安全依赖安装、环境配置、服务启动
# 自动检测内存并动态调整构建参数
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
CYAN='\033[0;36m'
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
# 函数：检测系统内存（MB）
# ========================================
detect_memory() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        local total_bytes=$(sysctl -n hw.memsize)
        echo $((total_bytes / 1048576))
    else
        # Linux
        local mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        echo $((mem_kb / 1024))
    fi
}

# ========================================
# 函数：计算构建参数
# ========================================
calculate_build_args() {
    local total_mem=$1
    local BUILD_MEMORY
    local RUNTIME_MEMORY
    local PNPM_CONCURRENCY

    # 根据总内存计算构建内存限制
    # 预留 30% 给系统和其他进程
    if [ "$total_mem" -ge 8192 ]; then
        # 8GB+ : 高配服务器
        BUILD_MEMORY=3072
        RUNTIME_MEMORY=768
        PNPM_CONCURRENCY=4
        MEMORY_PROFILE="high"
    elif [ "$total_mem" -ge 4096 ]; then
        # 4-8GB : 中等配置
        BUILD_MEMORY=2048
        RUNTIME_MEMORY=512
        PNPM_CONCURRENCY=2
        MEMORY_PROFILE="medium"
    elif [ "$total_mem" -ge 2048 ]; then
        # 2-4GB : 低配服务器
        BUILD_MEMORY=1024
        RUNTIME_MEMORY=384
        PNPM_CONCURRENCY=1
        MEMORY_PROFILE="low"
    else
        # <2GB : 极低内存
        BUILD_MEMORY=768
        RUNTIME_MEMORY=256
        PNPM_CONCURRENCY=1
        MEMORY_PROFILE="minimal"
    fi

    echo "$BUILD_MEMORY $RUNTIME_MEMORY $PNPM_CONCURRENCY $MEMORY_PROFILE"
}

# ========================================
# 第一步：检查 Docker 和 docker compose
# ========================================
echo "[1/7] 检查 Docker 环境..."

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
# 第二步：检测内存并计算构建参数
# ========================================
echo ""
echo "[2/7] 检测系统资源..."

TOTAL_MEM=$(detect_memory)
BUILD_ARGS=$(calculate_build_args $TOTAL_MEM)
BUILD_MEMORY=$(echo $BUILD_ARGS | awk '{print $1}')
RUNTIME_MEMORY=$(echo $BUILD_ARGS | awk '{print $2}')
PNPM_CONCURRENCY=$(echo $BUILD_ARGS | awk '{print $3}')
MEMORY_PROFILE=$(echo $BUILD_ARGS | awk '{print $4}')

echo -e "${CYAN}系统总内存: ${TOTAL_MEM}MB${NC}"
echo -e "${CYAN}内存配置档: ${MEMORY_PROFILE}${NC}"
echo ""
echo -e "${BLUE}动态构建参数:${NC}"
echo "  构建内存限制: ${BUILD_MEMORY}MB"
echo "  运行时内存: ${RUNTIME_MEMORY}MB"
echo "  pnpm 并发数: ${PNPM_CONCURRENCY}"

# 低内存警告
if [ "$MEMORY_PROFILE" = "low" ] || [ "$MEMORY_PROFILE" = "minimal" ]; then
    echo ""
    echo -e "${YELLOW}⚠ 检测到低内存环境，已自动优化构建参数${NC}"
    echo -e "${YELLOW}  - 构建时间可能较长，请耐心等待${NC}"
    if [ "$MEMORY_PROFILE" = "minimal" ]; then
        echo -e "${YELLOW}  - 建议增加 swap 分区以避免构建失败${NC}"
        echo -e "${YELLOW}  - 创建 swap: sudo fallocate -l 2G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile${NC}"
    fi
fi

# ========================================
# 第三步：检查 .env 文件
# ========================================
echo ""
echo "[3/7] 检查环境配置..."

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
# 第四步：验证关键环境变量
# ========================================
echo ""
echo "[4/7] 验证安全配置..."

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
# 第五步：选择启动模式
# ========================================
echo ""
echo "[5/7] 选择启动模式..."

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
# 第六步：准备启动
# ========================================
echo ""
echo "[6/7] 准备启动服务..."

# 确保脚本可执行
chmod +x scripts/*.sh 2>/dev/null || true

# 停止现有容器
echo "停止现有容器..."
$COMPOSE_CMD -f $COMPOSE_FILE down 2>/dev/null || true

# ========================================
# 第七步：启动服务（传递动态构建参数）
# ========================================
echo ""
echo "[7/7] 启动 Docker 服务..."
echo ""

# 启用 BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# 使用动态参数构建
$COMPOSE_CMD -f $COMPOSE_FILE build \
    --build-arg BUILD_MEMORY=$BUILD_MEMORY \
    --build-arg RUNTIME_MEMORY=$RUNTIME_MEMORY \
    --build-arg PNPM_CONCURRENCY=$PNPM_CONCURRENCY

if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] Docker 镜像构建失败${NC}"
    echo ""
    echo "故障排查："
    if [ "$MEMORY_PROFILE" = "minimal" ]; then
        echo "  1. 增加系统 swap 分区"
        echo "  2. 关闭其他占用内存的应用"
    fi
    echo "  查看详细日志: $COMPOSE_CMD -f $COMPOSE_FILE logs"
    exit 1
fi

# 启动服务
$COMPOSE_CMD -f $COMPOSE_FILE up -d

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
echo -e "${BLUE}系统配置:${NC}"
echo "  内存配置档: ${MEMORY_PROFILE}"
echo "  构建内存: ${BUILD_MEMORY}MB"
echo "  运行时内存: ${RUNTIME_MEMORY}MB"
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
