@echo off
setlocal enabledelayedexpansion

REM =====================================================
REM RSS-Post 一键部署脚本 (Windows)
REM =====================================================
REM 用法：
REM   start.bat              # 交互模式
REM   start.bat --prod       # 非交互模式，生产环境
REM   start.bat --dev        # 非交互模式，开发环境
REM =====================================================

set INTERACTIVE=true
set COMPOSE_FILE=docker-compose.yml

REM 解析命令行参数
for %%a in (%*) do (
    if "%%a"=="--prod" (
        set INTERACTIVE=false
        set COMPOSE_FILE=docker-compose.prod.yml
    )
    if "%%a"=="--dev" (
        set INTERACTIVE=false
        set COMPOSE_FILE=docker-compose.yml
    )
    if "%%a"=="--help" (
        echo RSS-Post 一键部署脚本
        echo.
        echo 用法：
        echo   start.bat              # 交互模式
        echo   start.bat --prod       # 非交互模式，生产环境
        echo   start.bat --dev        # 非交互模式，开发环境
        exit /b 0
    )
)

echo ================================
echo RSS-Post 一键部署脚本
echo ================================
echo.

REM =====================================================
REM 第一步：检查 Docker
REM =====================================================
echo [1/6] 检查 Docker 环境...

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('docker --version ^| findstr "Docker"') do set DOCKER_VERSION=%%i
echo [OK] Docker 已安装: %DOCKER_VERSION%

REM =====================================================
REM 第二步：检查 .env 文件
REM =====================================================
echo.
echo [2/6] 检查环境配置...

if not exist ".env" (
    echo [!] .env 文件不存在
    echo.
    echo 正在从 .env.example 创建 .env 文件...

    if not exist ".env.example" (
        echo [错误] .env.example 文件不存在
        pause
        exit /b 1
    )

    copy .env.example .env >nul

    REM 使用 PowerShell 生成随机密钥并替换
    echo 正在生成安全密钥...

    powershell -Command ^
        $jwt = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 })) -replace '[/+=]', ''; ^
        $nextauth = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 })) -replace '[/+=]', ''; ^
        $encrypt = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 })) -replace '[/+=]', ''; ^
        $cron = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 })) -replace '[/+=]', ''; ^
        $pgpass = [Convert]::ToBase64String((1..16 | ForEach-Object { Get-Random -Maximum 256 })) -replace '[/+=]', ''; ^
        $redispass = [Convert]::ToBase64String((1..16 | ForEach-Object { Get-Random -Maximum 256 })) -replace '[/+=]', ''; ^
        $content = Get-Content .env -Raw; ^
        $content = $content -replace 'your-super-secret-jwt-key-min-32-characters-long', $jwt; ^
        $content = $content -replace 'your-super-secret-nextauth-key', $nextauth; ^
        $content = $content -replace 'your-encryption-key-here', $encrypt; ^
        $content = $content -replace 'your-cron-secret-key-here', $cron; ^
        $content = $content -replace 'rss_post_password', $pgpass; ^
        $content = $content -replace 'your-redis-password', $redispass; ^
        $content | Set-Content .env -NoNewline

    echo [OK] .env 文件已创建并配置安全密钥
)

REM =====================================================
REM 第三步：验证关键环境变量
REM =====================================================
echo.
echo [3/6] 验证安全配置...

set SECURITY_ISSUES=0

findstr /C:"JWT_SECRET=" .env | findstr /C:"your-super-secret-jwt-key-min-32-characters-long" >nul
if %errorlevel% equ 0 (
    echo [错误] JWT_SECRET 仍使用默认占位符
    set /A SECURITY_ISSUES=1
)

if %SECURITY_ISSUES% gtr 0 (
    echo.
    echo 发现安全问题，请检查 .env 文件
    if "%INTERACTIVE%"=="true" (
        choice /C YN /M "是否继续"
        if errorlevel 2 exit /b 1
    ) else (
        pause
        exit /b 1
    )
) else (
    echo [OK] 环境变量检查通过
)

REM =====================================================
REM 第四步：选择启动模式
REM =====================================================
echo.
echo [4/6] 选择启动模式...

if "%INTERACTIVE%"=="true" (
    echo 请选择启动模式：
    echo   1. 开发环境 ^(docker-compose.yml^) - 快速体验
    echo   2. 生产环境 ^(docker-compose.prod.yml^) - 推荐用于正式部署
    echo.
    set /p mode="请输入选项 (1/2，默认 1): "

    if "!mode!"=="2" (
        set COMPOSE_FILE=docker-compose.prod.yml
        echo [生产模式] 使用 docker-compose.prod.yml
    ) else (
        echo [开发模式] 使用 docker-compose.yml
    )
) else (
    if "%COMPOSE_FILE%"=="docker-compose.prod.yml" (
        echo [生产模式] 使用 docker-compose.prod.yml
    ) else (
        echo [开发模式] 使用 docker-compose.yml
    )
)

REM =====================================================
REM 第五步：准备启动
REM =====================================================
echo.
echo [5/6] 准备启动服务...

REM 停止现有容器
echo 停止现有容器...
docker-compose -f %COMPOSE_FILE% down 2>nul

REM =====================================================
REM 第六步：启动服务
REM =====================================================
echo.
echo [6/6] 启动 Docker 服务...
echo.

docker-compose -f %COMPOSE_FILE% up -d --build

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
echo 等待服务启动...
timeout /t 15 /nobreak >nul

REM 检查服务状态
echo.
echo 检查服务状态...
docker-compose -f %COMPOSE_FILE% ps

REM =====================================================
REM 完成
REM =====================================================
echo.
echo ================================
echo 部署完成！
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
echo.

if "%COMPOSE_FILE%"=="docker-compose.prod.yml" (
    echo 数据库备份：
    echo   备份目录: .\backups\
    echo   查看备份: dir backups
    echo.
)

echo AI 配置：
echo   启动后在设置页面配置 AI API Key
echo.

if "%INTERACTIVE%"=="true" pause
