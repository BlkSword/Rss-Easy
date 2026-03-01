@echo off
setlocal enabledelayedexpansion

echo ================================
echo Rss-Easy 一键部署脚本
echo 集成安全依赖安装、环境配置、服务启动
echo ================================
echo.

REM =====================================================
REM 第一步：检查 Docker
REM =====================================================
echo [1/8] 检查 Docker 环境...

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('docker --version ^| findstr "Docker"') do set DOCKER_VERSION=%%i
echo [√] Docker 已安装: %DOCKER_VERSION%

REM =====================================================
REM 第二步：检查并安装安全依赖
REM =====================================================
echo.
echo [2/8] 检查安全依赖...

findstr /C:"dompurify" package.json >nul
if %errorlevel% equ 0 (
    echo [√] DOMPurify 已安装
) else (
    echo [!] DOMPurify 未安装，正在自动安装...
    call npm install dompurify @types/dompurify >nul 2>&1

    if %errorlevel% equ 0 (
        echo [√] DOMPurify 安装成功
    ) else (
        echo [×] DOMPurify 安装失败
        echo 请手动运行: npm install dompurify @types/dompurify
        pause
        exit /b 1
    )
)

REM =====================================================
REM 第三步：检查 .env 文件
REM =====================================================
echo.
echo [3/8] 检查环境配置...

if not exist ".env" (
    echo [!] .env 文件不存在
    echo.
    echo 正在从 .env.example 创建 .env 文件...
    copy .env.example .env >nul

    REM 生成随机密钥
    for /f "delims=" %%i in ('openssl rand -base64 32') do set %%i=%%i
    set NEXTAUTH_SECRET=%%i
    for /f "delims=" %%i in ('openssl rand -base64 32') do set %%i=%%i
    set ENCRYPTION_KEY=%%i
    for /f "delims=" %%i in ('openssl rand -base64 32') do set %%i=%%i
    set CRON_SECRET=%%i
    for /f "delims=" %%i in ('openssl rand -base64 16') do set %%i=%%i
    set POSTGRES_PASSWORD=%%i
    for /f "delims=" %%i in ('openssl rand -base64 16') do set %%i=%%i
    set REDIS_PASSWORD=%%i

    echo.
    echo 已生成安全密钥：
    echo   JWT_SECRET, NEXTAUTH_SECRET, ENCRYPTION_KEY, CRON_SECRET
    echo   POSTGRES_PASSWORD, REDIS_PASSWORD
    echo.

    REM 更新 .env 文件（使用 PowerShell）
    powershell -Command "(Get-Content .env) -replace 'your-super-secret-jwt-key-min-32-characters-long', '%JWT_SECRET%' -replace 'your-super-secret-nextauth-key', '%NEXTAUTH_SECRET%' -replace 'your-encryption-key-here', '%ENCRYPTION_KEY%' -replace 'your-cron-secret-key-here', '%CRON_SECRET%' -replace 'rss_easy_password', '%POSTGRES_PASSWORD%' -replace 'your-redis-password', '%REDIS_PASSWORD%' | Set-Content .env"

    echo [√] .env 文件已创建并配置随机密钥
    echo.
    echo [重要] 以下密钥需要手动配置：
    echo   - OPENAI_API_KEY
    echo   - ANTHROPIC_API_KEY
    echo   - DEEPSEEK_API_KEY
    echo.
    choice /C /N /M "是否现在编辑 .env 文件？"
    if errorlevel 1 (
        notepad .env
    )
)

REM =====================================================
REM 第四步：验证关键环境变量
REM =====================================================
echo.
echo [4/8] 验证安全配置...

set SECURITY_ISSUES=0

findstr /C:"JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long" .env >nul
if %errorlevel% equ 0 (
    echo [错误] JWT_SECRET 使用默认值
    set /A SECURITY_ISSUES=1
)

findstr /C:"POSTGRES_PASSWORD=rss_easy_password" .env >nul
if %errorlevel% equ 0 (
    echo [警告] POSTGRES_PASSWORD 使用默认值
)

if %SECURITY_ISSUES%==0 (
    echo [√] 环境变量检查通过
) else (
    echo.
    echo 发现安全问题，请修复后重试
    pause
    exit /b 1
)

REM =====================================================
REM 第五步：检查必要依赖
REM =====================================================
echo.
echo [5/8] 检查构建依赖...

docker --version >nul
if %errorlevel% neq 0 (
    echo [错误] Docker 未安装
    pause
    exit /b 1
)

echo [√] Docker 可用

REM =====================================================
REM 第六步：选择启动模式
REM =====================================================
echo.
echo 请选择启动模式：
echo   1. 开发环境 (docker-compose.yml)
echo   2. 生产环境 (docker-compose.prod.yml)
echo.
set /p mode="请输入选项 (1/2): "

if "%mode%"=="2" (
    set COMPOSE_FILE=docker-compose.prod.yml
    echo [生产模式] 使用 docker-compose.prod.yml
) else (
    set COMPOSE_FILE=docker-compose.yml
    echo [开发模式] 使用 docker-compose.yml
)

REM =====================================================
REM 第七步：准备启动
REM =====================================================
echo.
echo [6/8] 准备启动服务...

REM 停止现有容器
echo 停止现有容器...
docker-compose -f %COMPOSE_FILE% down >nul 2>&1

REM 清理悬空镜像
echo 清理悬空镜像...
docker image prune -f >nul 2>&1

REM =====================================================
REM 第八步：启动服务
REM =====================================================
echo.
echo [7/8] 启动 Docker 服务...
echo.

docker-compose -f %COMPOSE_FILE% up -d

if %errorlevel% neq 0 (
    echo [错误] Docker 服务启动失败
    echo.
    echo 查看详细日志：
    echo   docker-compose -f %COMPOSE_FILE% logs
    pause
    exit /b 1
)

REM 等待服务启动
echo.
echo [8/8] 等待服务启动...
timeout /t 10 /nobreak >nul

REM 检查服务状态
echo.
echo 检查服务状态...
docker-compose -f %COMPOSE_FILE% ps

REM =====================================================
REM 完成
REM =====================================================
echo.
echo ================================
echo ✓ 部署完成！
echo ================================
echo.
echo 访问信息：
echo   应用地址: http://localhost:8915
echo   健康检查: http://localhost:8915/api/health
echo.
echo 常用命令：
echo   查看日志: docker-compose -f %COMPOSE_FILE% logs -f
echo   查看状态: docker-compose -f %COMPOSE_FILE% ps
echo   停止服务: docker-compose -f %COMPOSE_FILE% down
echo   重启服务: docker-compose -f %COMPOSE_FILE% restart
echo   重新构建: docker-compose -f %COMPOSE_FILE% up -d --build
echo.
echo 数据库管理：
echo   运行备份: docker exec rss-easy-backup sh /scripts/backup.sh
echo   查看备份: dir backups \
echo.
echo AI 分析管理：
echo   查看队列状态: curl http://localhost:8915/api/scheduler/status
echo   手动触发: curl -X POST http://localhost:8915/api/scheduler/trigger -H "Content-Type: application/json" -d "{\"type\":\"both\"}"
echo.
pause
