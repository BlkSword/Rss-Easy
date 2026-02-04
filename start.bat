@echo off
REM =====================================================
REM Rss-Easy Quick Start Script (Windows)
REM =====================================================

chcp 65001 >nul

echo.
echo ========================================
echo   Rss-Easy Quick Start
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo [INFO] Creating .env file...
    copy .env.example .env >nul
    echo [DONE] .env file created
    echo.
    echo [IMPORTANT] Please edit .env file to configure:
    echo   - OPENAI_API_KEY or other AI API keys
    echo   - NEXTAUTH_SECRET (change in production)
    echo.
    pause
)

REM Check for AI API configuration
set AI_CONFIGURED=0
findstr /C:"OPENAI_API_KEY=sk-" .env >nul 2>&1
if %errorlevel% equ 0 set AI_CONFIGURED=1
findstr /C:"ANTHROPIC_API_KEY=sk-ant-" .env >nul 2>&1
if %errorlevel% equ 0 set AI_CONFIGURED=1
findstr /C:"DEEPSEEK_API_KEY=sk-" .env >nul 2>&1
if %errorlevel% equ 0 set AI_CONFIGURED=1

if %AI_CONFIGURED% equ 0 (
    echo [WARNING] No AI API key configured
    echo   AI features will be disabled, but other features work normally
    echo   After configuring AI keys, run: docker-compose up -d --build app
    echo.
)

REM Start services
echo [1/4] Building Docker images...
docker-compose build

if %errorlevel% neq 0 (
    echo [ERROR] Docker build failed
    pause
    exit /b 1
)

echo.
echo [2/4] Starting database services...
docker-compose up -d postgres redis

echo.
echo [3/4] Running database initialization...
docker-compose up init

echo.
echo [4/4] Starting application...
docker-compose up -d app

echo.
echo ========================================
echo   Startup Complete!
echo ========================================
echo.
echo URL: http://localhost:3000
echo.
echo Test Account:
echo   Email: test@example.com
echo   Password: password123
echo.
echo Common Commands:
echo   View logs: docker-compose logs -f app
echo   Stop: docker-compose down
echo   Restart: docker-compose restart
echo.

pause
