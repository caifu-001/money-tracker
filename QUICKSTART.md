# 🎯 快速开始指南

## 5分钟快速上手

### 第一步：准备工作（1分钟）

1. **确保已安装 Node.js 18+**
   ```bash
   node --version  # 应该显示 v18 或更高
   ```

2. **进入项目目录**
   ```bash
   cd money-tracker
   ```

### 第二步：本地开发（2分钟）

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env.local
   ```
   
   编辑 `.env.local`，填入你的 Supabase 信息：
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   
   访问 http://localhost:5173

### 第三步：部署到 GitHub（2分钟）

1. **创建 GitHub 仓库**
   - 访问 https://github.com/new
   - 创建名为 `money-tracker` 的仓库

2. **推送代码**
   ```bash
   git remote add origin https://github.com/your-username/money-tracker.git
   git branch -M main
   git push -u origin main
   ```

3. **配置 GitHub Secrets**
   - 进入仓库 Settings > Secrets and variables > Actions
   - 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

4. **启用 GitHub Pages**
   - 进入 Settings > Pages
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "gh-pages"

✅ 完成！访问 `https://your-username.github.io/money-tracker`

---

## 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器

# 构建
npm run build        # 生产构建

# 预览
npm run preview      # 预览生产构建

# 类型检查
npm run type-check   # TypeScript 类型检查
```

---

## 项目文件说明

| 文件/文件夹 | 说明 |
|-----------|------|
| `src/` | 源代码 |
| `src/pages/` | 页面组件 |
| `src/components/` | 可复用组件 |
| `src/lib/` | 工具函数和服务 |
| `src/store/` | 全局状态管理 |
| `supabase/` | 数据库配置 |
| `.github/workflows/` | CI/CD 配置 |
| `.env.example` | 环境变量示例 |
| `README.md` | 项目说明 |
| `DEPLOYMENT.md` | 详细部署指南 |
| `PROJECT_SUMMARY.md` | 项目总结 |

---

## 需要帮助？

- 📖 查看 `README.md` - 功能说明
- 🚀 查看 `DEPLOYMENT.md` - 详细部署指南
- 📋 查看 `PROJECT_SUMMARY.md` - 项目总结
- 🐛 提交 GitHub Issue

---

**祝你使用愉快！** 🎉
