#!/bin/bash

echo "🚀 记账助手 - 快速启动"
echo "========================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    echo ""
fi

# 检查环境变量
if [ ! -f ".env.local" ]; then
    echo "⚠️  未找到 .env.local 文件"
    echo "请复制 .env.example 到 .env.local 并填入 Supabase 配置"
    echo ""
    echo "命令: cp .env.example .env.local"
    exit 1
fi

echo "✅ 环境配置完成"
echo ""
echo "🎯 启动开发服务器..."
echo "访问: http://localhost:5173"
echo ""

npm run dev
