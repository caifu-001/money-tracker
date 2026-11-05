# 💰 记账助手 - Money Tracker

一个功能完整的记账软件，支持手机、电脑协同，部署在 GitHub Pages + Supabase。

## ✨ 核心功能

- 📌 **快速记账入口** - 首页悬浮按钮，3秒完成记账
- 📅 **日历账单视图** - 按日/周/月分类展示账目趋势
- 💰 **预算提醒页面** - 实时显示预算使用情况
- 📚 **多账本切换** - 个人/家庭/项目账本快速切换
- 📊 **可视化报表** - 饼图/柱状图一眼看清支出分布
- 👥 **权限控制** - 支持家庭账本成员与权限设置
- 🔐 **后台管理** - 管理员权限、用户审核、密码重置

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm 或 yarn
- Supabase 账号（免费）
- GitHub 账号

### 1. 本地开发

```bash
# 克隆项目
git clone https://github.com/your-username/money-tracker.git
cd money-tracker

# 安装依赖
npm install

# 创建 .env.local 文件
cp .env.example .env.local

# 填入 Supabase 配置
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_ANON_KEY=your_key

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173

### 2. Supabase 配置

#### 创建项目

1. 访问 [supabase.com](https://supabase.com)
2. 创建新项目
3. 复制 Project URL 和 Anon Key

#### 初始化数据库

1. 进入 Supabase 控制台
2. 打开 SQL Editor
3. 复制 `supabase/migrations/001_init.sql` 的内容
4. 执行 SQL 脚本

#### 配置认证

1. 进入 Authentication > Providers
2. 启用 Email 认证
3. 配置邮件模板（可选）

### 3. GitHub 部署

#### 配置 Secrets

1. 进入 GitHub 仓库 Settings > Secrets and variables > Actions
2. 添加以下 Secrets：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

#### 启用 GitHub Pages

1. 进入 Settings > Pages
2. Source 选择 "Deploy from a branch"
3. Branch 选择 "gh-pages"

#### 部署

```bash
# 推送到 main 分支会自动触发部署
git push origin main
```

部署完成后，访问 `https://your-username.github.io/money-tracker`

## 📁 项目结构

```
money-tracker/
├── src/
│   ├── pages/           # 页面组件
│   │   ├── Home.tsx     # 首页
│   │   ├── Budget.tsx   # 预算页
│   │   ├── Reports.tsx  # 报表页
│   │   ├── Ledgers.tsx  # 账本管理
│   │   └── Admin.tsx    # 后台管理
│   ├── components/      # 可复用组件
│   │   ├── QuickAdd.tsx      # 快速记账
│   │   ├── FloatButton.tsx   # 悬浮按钮
│   │   └── BudgetBar.tsx     # 预算进度条
│   ├── lib/
│   │   ├── supabase.ts  # Supabase 客户端
│   │   └── services.ts  # API 服务
│   ├── store/
│   │   └── appStore.ts  # 全局状态
│   ├── App.tsx          # 主应用
│   └── main.tsx         # 入口
├── supabase/
│   └── migrations/      # 数据库迁移
├── .github/
│   └── workflows/       # CI/CD 配置
└── package.json
```

## 🔧 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **图表库**: Recharts
- **后端**: Supabase (PostgreSQL + Auth)
- **部署**: GitHub Pages + GitHub Actions

## 📱 功能详解

### 快速记账

- 点击悬浮按钮打开记账弹窗
- 选择收入/支出类型
- 输入金额、分类、备注
- 一键确认，实时同步

### 日历视图

- 按日期展示所有账目
- 显示每日收入、支出、结余
- 支持删除和编辑账目

### 预算管理

- 为每个分类设置月度预算
- 实时显示预算使用百分比
- 超预算时自动警告（红色）

### 可视化报表

- 支出分布饼图
- 收入分布饼图
- 日趋势柱状图
- 支持按月份切换

### 多账本

- 创建个人/家庭/项目账本
- 快速切换账本
- 邀请成员协作

### 权限控制

- **所有者**: 完全控制，可删除账本
- **编辑者**: 可添加/编辑账目
- **查看者**: 只读权限

### 后台管理

- 查看所有用户
- 审核待激活用户
- 管理用户权限
- 系统统计

## 🔐 安全特性

- ✅ 行级安全策略 (RLS)
- ✅ 用户认证和授权
- ✅ 数据加密传输
- ✅ 环境变量管理
- ✅ 权限隔离

## 📊 数据库设计

### 核心表

| 表名 | 说明 |
|------|------|
| users | 用户信息 |
| ledgers | 账本 |
| ledger_members | 账本成员 |
| transactions | 账目 |
| budgets | 预算 |
| categories | 分类 |

## 🎯 后续功能规划

- [ ] 数据导出 (CSV/Excel)
- [ ] 定期账目提醒
- [ ] 账目标签系统
- [ ] 多币种支持
- [ ] 移动端 App (React Native)
- [ ] 数据备份与恢复
- [ ] 账目搜索功能
- [ ] 自定义分类

## 🐛 常见问题

### Q: 如何重置密码？
A: 在登录页点击"忘记密码"，按邮件提示重置。

### Q: 如何导出数据？
A: 目前支持在 Supabase 控制台直接导出，后续会添加应用内导出功能。

### Q: 支持离线使用吗？
A: 目前需要网络连接。后续版本会添加 Service Worker 支持离线缓存。

### Q: 如何删除账本？
A: 只有账本所有者可以删除，在账本详情页点击删除按钮。

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

有问题或建议？欢迎通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至 your-email@example.com

---

**祝你使用愉快！** 💚
