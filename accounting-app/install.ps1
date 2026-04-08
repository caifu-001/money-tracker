# 记账助手 - 安装脚本 (PowerShell)

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "记账助手 - 安装脚本" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Host "[错误] 未找到 Node.js，请先安装 Node.js" -ForegroundColor Red
    Write-Host "下载地址: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

Write-Host "[OK] Node.js 已安装" -ForegroundColor Green
node --version

# 设置执行策略
Write-Host ""
Write-Host "设置 PowerShell 执行策略..." -ForegroundColor Yellow
try {
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Write-Host "[OK] 执行策略已设置" -ForegroundColor Green
} catch {
    Write-Host "[警告] 无法设置执行策略: $_" -ForegroundColor Yellow
}

# 清理残留文件
if (Test-Path "node_modules") {
    Write-Host "清理旧的 node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
}
if (Test-Path "package-lock.json") {
    Remove-Item "package-lock.json" -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "正在安装依赖..." -ForegroundColor Yellow
Write-Host ""

# 安装依赖
npm install --legacy-peer-deps

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[错误] 依赖安装失败" -ForegroundColor Red
    Write-Host "请尝试以管理员身份运行此脚本" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "安装完成！" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "运行开发服务器:" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "构建应用:" -ForegroundColor White
Write-Host "  npm run build" -ForegroundColor Yellow
Write-Host ""

Read-Host "按回车键退出"
