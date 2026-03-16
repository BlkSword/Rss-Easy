#!/bin/bash
#
# RSS-Post 预构建镜像部署脚本
#
# 用法：
#   ./deploy-prebuilt.sh              # 交互模式
#   ./deploy-prebuilt.sh --update     # 更新镜像并重启
#   ./deploy-prebuilt.sh --logs       # 查看日志
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
COMPOSE_FILE="docker-compose.prebuilt.yml"
# 替换为你的 GitHub 用户名或组织名
GHCR_OWNER="blksword"

# 解析参数
ACTION="deploy"
for arg in "$@"; do
    case $arg in
        --update)
            ACTION="update"
            ;;
        --logs)
            ACTION="logs"
            ;;
        --stop)
            ACTION="stop"
            ;;
        --help)
            echo "RSS-Post 预构建镜像部署脚本"
            echo ""
            echo "用法："
            echo "  ./deploy-prebuilt.sh          # 部署服务"
            echo "  ./deploy-prebuilt.sh --update # 更新镜像并重启"
            echo "  ./deploy-prebuilt.sh --logs   # 查看日志"
            echo "  ./deploy-prebuilt.sh --stop   # 停止服务"
            exit 0
            ;;
    esac
done

echo "================================"
echo "RSS-Post 预构建镜像部署"
echo "================================"
echo ""

# 检查 Docker
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}[错误] Docker 未运行${NC}"
    exit 1
fi

# 检测 docker compose 命令
if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

case $ACTION in
    "deploy")
        # 检查 .env 文件
        if [ ! -f ".env" ]; then
            echo -e "${YELLOW}⚠ .env 文件不存在，正在创建...${NC}"

            if [ -f ".env.example" ]; then
                cp .env.example .env

                # 生成随机密钥
                JWT_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
                NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
                ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
                CRON_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
                POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)

                # 更新 .env
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s/your-super-secret-jwt-key-min-32-characters-long/$JWT_SECRET/g" .env
                    sed -i '' "s/your-super-secret-nextauth-key/$NEXTAUTH_SECRET/g" .env
                    sed -i '' "s/your-encryption-key-here/$ENCRYPTION_KEY/g" .env
                    sed -i '' "s/your-cron-secret-key-here/$CRON_SECRET/g" .env
                    sed -i '' "s/rss_post_password/$POSTGRES_PASSWORD/g" .env
                else
                    sed -i "s/your-super-secret-jwt-key-min-32-characters-long/$JWT_SECRET/g" .env
                    sed -i "s/your-super-secret-nextauth-key/$NEXTAUTH_SECRET/g" .env
                    sed -i "s/your-encryption-key-here/$ENCRYPTION_KEY/g" .env
                    sed -i "s/your-cron-secret-key-here/$CRON_SECRET/g" .env
                    sed -i "s/rss_post_password/$POSTGRES_PASSWORD/g" .env
                fi

                echo -e "${GREEN}✓ .env 文件已创建${NC}"
            else
                echo -e "${RED}[错误] .env.example 文件不存在${NC}"
                exit 1
            fi
        fi

        # 更新 docker-compose.prebuilt.yml 中的镜像地址
        if [ "$GHCR_OWNER" = "<owner>" ]; then
            echo -e "${YELLOW}⚠ 请先编辑 deploy-prebuilt.sh，设置 GHCR_OWNER 变量${NC}"
            echo -e "${YELLOW}  或直接编辑 docker-compose.prebuilt.yml 中的镜像地址${NC}"
            echo ""
            read -p "请输入你的 GitHub 用户名: " github_user
            if [ -n "$github_user" ]; then
                sed -i "s/<owner>/$github_user/g" docker-compose.prebuilt.yml 2>/dev/null || \
                sed -i '' "s/<owner>/$github_user/g" docker-compose.prebuilt.yml
                echo -e "${GREEN}✓ 已更新镜像地址${NC}"
            else
                echo -e "${RED}[错误] 未提供 GitHub 用户名${NC}"
                exit 1
            fi
        fi

        echo ""
        echo "[1/3] 拉取最新镜像..."
        $COMPOSE_CMD -f $COMPOSE_FILE pull

        echo ""
        echo "[2/3] 启动服务..."
        $COMPOSE_CMD -f $COMPOSE_FILE up -d

        echo ""
        echo "[3/3] 等待服务启动..."
        sleep 10
        $COMPOSE_CMD -f $COMPOSE_FILE ps

        echo ""
        echo -e "${GREEN}✓ 部署完成！${NC}"
        echo ""
        echo -e "${BLUE}访问地址: http://localhost:8915${NC}"
        echo -e "${BLUE}健康检查: http://localhost:8915/api/health${NC}"
        echo ""
        echo -e "${YELLOW}常用命令:${NC}"
        echo "  查看日志: $COMPOSE_CMD -f $COMPOSE_FILE logs -f"
        echo "  更新服务: ./deploy-prebuilt.sh --update"
        echo "  停止服务: ./deploy-prebuilt.sh --stop"
        ;;

    "update")
        echo "[1/3] 拉取最新镜像..."
        $COMPOSE_CMD -f $COMPOSE_FILE pull

        echo ""
        echo "[2/3] 重新创建服务..."
        $COMPOSE_CMD -f $COMPOSE_FILE up -d --force-recreate

        echo ""
        echo "[3/3] 清理旧镜像..."
        docker image prune -f

        echo ""
        echo -e "${GREEN}✓ 更新完成！${NC}"
        $COMPOSE_CMD -f $COMPOSE_FILE ps
        ;;

    "logs")
        echo "查看日志 (Ctrl+C 退出)..."
        $COMPOSE_CMD -f $COMPOSE_FILE logs -f
        ;;

    "stop")
        echo "停止服务..."
        $COMPOSE_CMD -f $COMPOSE_FILE down
        echo -e "${GREEN}✓ 服务已停止${NC}"
        ;;
esac
