# 🚀 完整部署指南

## 第一步：Supabase 配置（5分钟）

### 1.1 创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com)
2. 点击 "New Project"
3. 填写项目信息：
   - Organization: 选择或创建
   - Project name: `money-tracker`
   - Database password: 设置强密码
   - Region: 选择离你最近的地区（如 Singapore）
4. 点击 "Create new project"，等待 2-3 分钟

### 1.2 获取 API 密钥

1. 项目创建完成后，进入 Settings > API
2. 复制以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJhbGc...`（长字符串）

### 1.3 初始化数据库

1. 进入 SQL Editor
2. 点击 "New Query"
3. 复制 `supabase/migrations/001_init.sql` 的全部内容
4. 粘贴到编辑器
5. 点击 "Run"

✅ 数据库初始化完成！

---

## 第二步：本地开发（10分钟）

### 2.1 克隆项目

```bash
# 如果还没有克隆
git clone https://github.com/your-username/money-tracker.git
cd money-tracker
```

### 2.2 安装依赖

```bash
npm install
```

### 2.3 配置环境变量

```bash
# 复制示例文件
cp .env.example .env.local

# 编辑 .env.local，填入 Supabase 信息
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 2.4 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 2.5 测试功能

1. **注册账号**: 使用任意邮箱注册
2. **创建账本**: 点击"账本"标签，创建第一个账本
3. **快速记账**: 点击悬浮按钮，添加一条账目
4. **查看报表**: 切换到"报表"标签查看图表

✅ 本地开发完成！

---

## 第三步：GitHub 部署（15分钟）

### 3.1 创建 GitHub 仓库

1. 访问 [github.com/new](https://github.com/new)
2. 填写信息：
   - Repository name: `money-tracker`
   - Description: `💰 智能记账软件`
   - Public（公开）
3. 点击 "Create repository"

### 3.2 推送代码到 GitHub

```bash
# 添加远程仓库
git remote add origin https://github.com/your-username/money-tracker.git

# 推送代码
git branch -M main
git push -u origin main
```

### 3.3 配置 GitHub Secrets

1. 进入仓库 Settings
2. 左侧菜单 > Secrets and variables > Actions
3. 点击 "New repository secret"
4. 添加两个 Secret：

**Secret 1:**
- Name: `VITE_SUPABASE_URL`
- Value: `https://xxxxx.supabase.co`

**Secret 2:**
- Name: `VITE_SUPABASE_ANON_KEY`
- Value: `eyJhbGc...`

### 3.4 启用 GitHub Pages

1. 进入 Settings > Pages
2. Source 选择 "Deploy from a branch"
3. Branch 选择 "gh-pages"
4. 点击 Save

### 3.5 触发部署

```bash
# 推送任意更改会自动触发部署
git commit --allow-empty -m "Trigger deployment"
git push origin main
```

### 3.6 查看部署状态

1. 进入 Actions 标签
2. 查看 "Deploy to GitHub Pages" 工作流
3. 等待绿色 ✅ 标记

### 3.7 访问应用

部署完成后，访问：
```
https://your-username.github.io/money-tracker
```

✅ GitHub 部署完成！

---

## 第四步：自定义配置（可选）

### 4.1 自定义域名

如果你有自己的域名，可以配置自定义域名：

1. 进入 Settings > Pages
2. Custom domain 输入你的域名
3. 按照提示配置 DNS 记录

### 4.2 启用 HTTPS

GitHub Pages 自动启用 HTTPS，无需额外配置。

### 4.3 修改应用标题

编辑 `index.html`：
```html
<title>💰 记账助手 - Money Tracker</title>
```

---

## 第五步：后续维护

### 5.1 添加新功能

1. 创建新分支：`git checkout -b feature/xxx`
2. 开发功能
3. 提交代码：`git commit -m "Add xxx"`
4. 推送分支：`git push origin feature/xxx`
5. 创建 Pull Request
6. 合并到 main 分支后自动部署

### 5.2 监控应用

1. 进入 Supabase 控制台
2. 查看 Database 使用情况
3. 查看 Auth 用户数
4. 监控 API 调用

### 5.3 备份数据

Supabase 免费版每天自动备份，可在 Settings > Backups 查看。

---

## 🎉 完成！

你的记账软件已经上线！

### 分享给朋友

```
https://your-username.github.io/money-tracker
```

### 后续优化建议

1. **SEO 优化**: 添加 meta 标签
2. **PWA 支持**: 添加 manifest.json
3. **性能优化**: 代码分割、图片优化
4. **功能扩展**: 数据导出、定期提醒等

---

## 🆘 常见问题

### Q: 部署失败怎么办？

A: 检查以下几点：
1. GitHub Secrets 是否正确配置
2. `.env.example` 是否有正确的变量名
3. 查看 Actions 日志获取错误信息

### Q: 如何更新应用？

A: 只需推送代码到 main 分支，GitHub Actions 会自动部署。

### Q: 如何回滚到之前的版本？

A: 
```bash
git revert <commit-hash>
git push origin main
```

### Q: 如何增加 Supabase 配额？

A: 升级到付费计划，或联系 Supabase 支持。

---

## 📞 需要帮助？

- 查看 [Supabase 文档](https://supabase.com/docs)
- 查看 [GitHub Pages 文档](https://docs.github.com/en/pages)
- 提交 GitHub Issue

祝部署顺利！🚀
