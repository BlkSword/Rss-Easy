@echo off
setlocal enabledelayedexpansion

echo ================================
echo Rss-Easy 开发环境初始化
echo ================================
echo.

REM =====================================================
REM 第一步：检查 Docker
REM =====================================================
echo [1/5] 检查 Docker 环境...

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

echo [OK] Docker 已就绪

REM =====================================================
REM 第二步：启动数据库服务
REM =====================================================
echo.
echo [2/5] 启动 PostgreSQL 和 Redis...

docker-compose -f docker-compose.dev.yml up -d postgres redis

if %errorlevel% neq 0 (
    echo [错误] 数据库服务启动失败
    pause
    exit /b 1
)

echo [OK] 数据库服务已启动

REM =====================================================
REM 第三步：等待数据库就绪
REM =====================================================
echo.
echo [3/5] 等待数据库就绪...

set MAX_RETRIES=30
set RETRY_COUNT=0

:check_db
docker exec rss-easy-db-dev pg_isready -U rss_easy >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PostgreSQL 已就绪
    goto :redis_check
)

set /A RETRY_COUNT+=1
if %RETRY_COUNT% geq %MAX_RETRIES% (
    echo [错误] PostgreSQL 启动超时
    pause
    exit /b 1
)

echo   等待中... (%RETRY_COUNT%/%MAX_RETRIES%)
timeout /t 1 /nobreak >nul
goto :check_db

:redis_check
docker exec rss-easy-redis-dev redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Redis 已就绪
) else (
    echo [警告] Redis 未就绪，但继续执行
)

REM =====================================================
REM 第四步：初始化数据库
REM =====================================================
echo.
echo [4/5] 初始化数据库 (generate + push + seed)...

echo   - 生成 Prisma Client...
call npm run db:generate >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Prisma Client 生成失败
    pause
    exit /b 1
)
echo   [OK] Prisma Client 已生成

echo   - 推送数据库 Schema...
call npm run db:push >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 数据库 Schema 推送失败
    pause
    exit /b 1
)
echo   [OK] Schema 已推送

echo   - 执行数据库 Seed...
call npm run db:seed >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] Seed 执行失败（可能已存在数据）
) else (
    echo   [OK] Seed 完成
)

REM =====================================================
REM 第五步：完成
REM =====================================================
echo.
echo [5/5] 初始化完成！
echo.
echo ================================
echo 开发环境已就绪
echo ================================
echo.
echo 数据库信息：
echo   PostgreSQL: localhost:5432
echo   Redis: localhost:6379
echo.
echo 启动开发服务器：
echo   npm run dev
echo.
echo 停止数据库服务：
echo   docker-compose -f docker-compose.dev.yml down
echo.
pause
