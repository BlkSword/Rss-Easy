#!/bin/bash

# =====================================================
# Rss-Easy 一键启动脚本 (Linux/macOS)
# =====================================================

set -e

echo ""
echo "========================================"
echo "  Rss-Easy 一键启动"
echo "========================================"
echo ""

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "[错误] Docker 未运行，请先启动 Docker"
    exit 1
fi

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
    echo "[提示] 创建 .env 文件..."
    cp .env.example .env
    echo "[完成] 已创建 .env 文件"
    echo ""
    echo "[重要] 请编辑 .env 文件配置以下选项："
    echo "  - OPENAI_API_KEY 或其他 AI API 密钥"
    echo "  - NEXTAUTH_SECRET（生产环境必须更改）"
    echo ""
fi

# 检查 AI API 密钥
AI_CONFIGURED=0
if grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null; then
    AI_CONFIGURED=1
elif grep -q "ANTHROPIC_API_KEY=sk-ant-" .env 2>/dev/null; then
    AI_CONFIGURED=1
elif grep -q "DEEPSEEK_API_KEY=sk-" .env 2>/dev/null; then
    AI_CONFIGURED=1
fi

if [ $AI_CONFIGURED -eq 0 ]; then
    echo "[警告] 未检测到 AI API 密钥配置"
    echo "  AI 功能将不可用，但其他功能正常"
    echo "  配置 AI 密钥后请运行: docker-compose up -d --build app"
    echo ""
fi

# 启动服务
echo "[1/4] 构建 Docker 镜像..."
docker-compose build

echo ""
echo "[2/4] 启动数据库服务..."
docker-compose up -d postgres redis

echo ""
echo "[3/4] 运行数据库初始化..."
docker-compose up init

echo ""
echo "[4/4] 启动应用服务..."
docker-compose up -d app

echo ""
echo "========================================"
echo "  启动完成！"
echo "========================================"
echo ""
echo "访问地址: http://localhost:3000"
echo ""
echo "测试账号:"
echo "  邮箱: test@example.com"
echo "  密码: password123"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f app"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
echo ""
