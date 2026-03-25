@echo off
echo 🚀 记账助手 - 快速启动
echo ========================
echo.

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Node.js，请先安装 Node.js 18+
    exit /b 1
)

echo ✅ Node.js 版本: 
node --version
echo.

REM 检查依赖
if not exist "node_modules" (
    echo 📦 安装依赖...
    call npm install
    echo.
)

REM 检查环境变量
if not exist ".env.local" (
    echo ⚠️  未找到 .env.local 文件
    echo 请复制 .env.example 到 .env.local 并填入 Supabase 配置
    echo.
    echo 命令: copy .env.example .env.local
    exit /b 1
)

echo ✅ 环境配置完成
echo.
echo 🎯 启动开发服务器...
echo 访问: http://localhost:5173
echo.

call npm run dev
