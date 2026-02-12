#!/bin/bash
#
# Rss-Easy 安全修复安装脚本
# 安装所有必要的安全依赖
#

set -e

echo "================================"
echo "Rss-Easy 安全依赖安装"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "[1/4] 检查 package.json..."
if [ ! -f "package.json" ]; then
    echo -e "${RED}[错误] package.json 未找到${NC}"
    exit 1
fi

echo -e "${GREEN}✓ package.json 已找到${NC}"

echo ""
echo "[2/4] 安装安全依赖..."

# 安装 DOMPurify（XSS 防护）
echo "安装 DOMPurify..."
npm install dompurify @types/dompurify

echo ""
echo "[3/4] 安装 dumb-init（Docker 信号处理）..."

# Docker alpine 会使用
echo "Docker 容器中已包含 dumb-init"
echo "如需在本地开发，运行: npm install --save-dev dumb-init"

echo ""
echo "[4/4] 验证安装..."

# 验证 DOMPurify
if grep -q "dompurify" package.json; then
    echo -e "${GREEN}✓ DOMPurify 已安装${NC}"
else
    echo -e "${YELLOW}⚠ DOMPurify 未在 package.json 中找到${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}安全依赖安装完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "下一步："
echo "1. 配置环境变量（参考 DEPLOYMENT.md）"
echo "2. 重新构建应用：npm run build"
echo "3. 启动服务：./start.sh"
echo ""
