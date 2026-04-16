@echo off
echo ====================================
echo 记账助手 - 安装脚本
echo ====================================
echo.

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js 已安装
node --version

:: 清理可能的残留文件
if exist node_modules rmdir /s /q node_modules 2>nul
if exist package-lock.json del package-lock.json 2>nul

echo.
echo 正在安装依赖...
echo.

:: 设置 npm 镜像源（国内用户可选）
:: npm config set registry https://registry.npmmirror.com

:: 安装依赖
npm install --legacy-peer-deps

if %errorlevel% neq 0 (
    echo.
    echo [错误] 依赖安装失败
    echo 请尝试以管理员身份运行此脚本
    pause
    exit /b 1
)

echo.
echo ====================================
echo 安装完成！
echo ====================================
echo.
echo 运行开发服务器:
echo   npm run dev
echo.
echo 构建应用:
echo   npm run build
echo.
pause
