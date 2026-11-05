# 游游记账 · Money Tracker

一套 Supabase 后端，两个客户端：**微信小程序** 与 **React Web 版**，数据完全互通。

## 仓库结构

| 路径 | 说明 | 状态 |
| --- | --- | --- |
| 根目录 `app.js` / `pages/` / `utils/` | **微信小程序版** | 主开发（v5） |
| `src/` | React + TypeScript Web 版，GitHub Pages 部署 | 历史版本 |
| `money-tracker/` | Web 版早期独立副本 | 归档 |
| `accounting-app/` | Electron 桌面版 | 归档 |
| `supabase/`、`0**.sql` | 数据库迁移与后端 RPC | 在用 |
| `.github/` | GitHub Pages 自动部署工作流 | 在用 |

---

# 一、微信小程序版

## 已实现功能

- **记账**：收入 / 支出 / 转账三类，支持多级分类、备注、指定日期
- **多币种**：账本本位币 + 原币记账，汇率自动获取（er-api 主源 / frankfurter 备源，12 小时缓存 + 离线兜底）
- **外币待结算**：境外刷卡未出账单时先挂「待结算」，不计入任何统计，账单出具后回填实际扣款即转为已结算
- **资金账户**：资产 / 负债账户（信用卡作为负债），余额 = 期初 + 收入 − 支出 + 转入 − 转出
- **借款记账**：借出 / 借入按净额法汇总，按对方自动计算净欠款，反向记一笔即抵消
- **预算管理**：月度总预算 + 分类预算，超支提醒
- **数据分析**：支出 / 收入 / 账户 / 借款四个视图，构成列表 + 趋势图，支持分类目录筛选与搜索
- **报销**：可报销标记与到账状态跟踪
- **油耗统计**：多车独立统计
- **导出**：CSV 明细导出 + JSON 全量备份与恢复
- **多账本与成员协作**：共享账本、成员权限、管理后台

## 快速开始

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本仓库根目录，AppID 可先填测试号 `touristappid`
3. 配置 `utils/supabase.js` 中的 Supabase 地址与 anon key
4. 在微信公众平台 → 开发 → 开发设置 → 服务器域名，添加 request 合法域名：
   - `https://<你的项目>.supabase.co`
   - `https://open.er-api.com`
   - `https://api.frankfurter.app`

## 数据库迁移

按顺序执行，脚本均为幂等，可重复运行。每个脚本末尾附有自检 SELECT，执行完应为 0。

```
011 → 012 → 013 → 014 → 015 → 016 → 017 → 018   用户 / 权限 / 账本 / 油耗
019_currency_support.sql                        多币种与汇率表
020_settlement_status.sql                       外币待结算
021_accounts_transfer.sql                       资金账户与转账
022_loans.sql                                   借款记账
```

## 相关文档

- [CURRENCY_SETUP.md](CURRENCY_SETUP.md) — 多币种与汇率
- [ACCOUNTS_SETUP.md](ACCOUNTS_SETUP.md) — 资金账户与转账
- [LOANS_SETUP.md](LOANS_SETUP.md) — 借款记账
- [WECHAT_LOGIN_SETUP.md](WECHAT_LOGIN_SETUP.md) — 微信登录链路

---

# 二、Web 版

React + TypeScript。构建产物部署到 GitHub Pages，推送 `main` 自动触发 `.github/workflows` 中的工作流。

```bash
npm install
npm run dev      # 本地开发
npm run build    # 生产构建
```

---

## 附录：Web 版原 README（合并前保留，供参考）

## 💰 记账助手 - Money Tracker

一个功能完整的记账软件，支持手机、电脑协同，部署在 GitHub Pages + Supabase。

### ✨ 核心功能

- 📌 **快速记账入口** - 首页悬浮按钮，3秒完成记账
- 📅 **日历账单视图** - 按日/周/月分类展示账目趋势
- 💰 **预算提醒页面** - 实时显示预算使用情况
- 📚 **多账本切换** - 个人/家庭/项目账本快速切换
- 📊 **可视化报表** - 饼图/柱状图一眼看清支出分布
- 👥 **权限控制** - 支持家庭账本成员与权限设置
- 🔐 **后台管理** - 管理员权限、用户审核、密码重置

### 🚀 快速开始

#### 前置要求

- Node.js 18+
- npm 或 yarn
- Supabase 账号（免费）
- GitHub 账号

#### 1. 本地开发

```bash
## 克隆项目
git clone https://github.com/your-username/money-tracker.git
cd money-tracker

## 安装依赖
npm install

## 创建 .env.local 文件
cp .env.example .env.local

## 填入 Supabase 配置
## VITE_SUPABASE_URL=your_url
## VITE_SUPABASE_ANON_KEY=your_key

## 启动开发服务器
npm run dev
```

访问 http://localhost:5173

#### 2. Supabase 配置

##### 创建项目

1. 访问 [supabase.com](https://supabase.com)
2. 创建新项目
3. 复制 Project URL 和 Anon Key

##### 初始化数据库

1. 进入 Supabase 控制台
2. 打开 SQL Editor
3. 复制 `supabase/migrations/001_init.sql` 的内容
4. 执行 SQL 脚本

##### 配置认证

1. 进入 Authentication > Providers
2. 启用 Email 认证
3. 配置邮件模板（可选）

#### 3. GitHub 部署

##### 配置 Secrets

1. 进入 GitHub 仓库 Settings > Secrets and variables > Actions
2. 添加以下 Secrets：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

##### 启用 GitHub Pages

1. 进入 Settings > Pages
2. Source 选择 "Deploy from a branch"
3. Branch 选择 "gh-pages"

##### 部署

```bash
## 推送到 main 分支会自动触发部署
git push origin main
```

部署完成后，访问 `https://your-username.github.io/money-tracker`

### 📁 项目结构

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

### 🔧 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **图表库**: Recharts
- **后端**: Supabase (PostgreSQL + Auth)
- **部署**: GitHub Pages + GitHub Actions

### 📱 功能详解

#### 快速记账

- 点击悬浮按钮打开记账弹窗
- 选择收入/支出类型
- 输入金额、分类、备注
- 一键确认，实时同步

#### 日历视图

- 按日期展示所有账目
- 显示每日收入、支出、结余
- 支持删除和编辑账目

#### 预算管理

- 为每个分类设置月度预算
- 实时显示预算使用百分比
- 超预算时自动警告（红色）

#### 可视化报表

- 支出分布饼图
- 收入分布饼图
- 日趋势柱状图
- 支持按月份切换

#### 多账本

- 创建个人/家庭/项目账本
- 快速切换账本
- 邀请成员协作

#### 权限控制

- **所有者**: 完全控制，可删除账本
- **编辑者**: 可添加/编辑账目
- **查看者**: 只读权限

#### 后台管理

- 查看所有用户
- 审核待激活用户
- 管理用户权限
- 系统统计

### 🔐 安全特性

- ✅ 行级安全策略 (RLS)
- ✅ 用户认证和授权
- ✅ 数据加密传输
- ✅ 环境变量管理
- ✅ 权限隔离

### 📊 数据库设计

#### 核心表

| 表名 | 说明 |
|------|------|
| users | 用户信息 |
| ledgers | 账本 |
| ledger_members | 账本成员 |
| transactions | 账目 |
| budgets | 预算 |
| categories | 分类 |

### 🎯 后续功能规划

- [ ] 数据导出 (CSV/Excel)
- [ ] 定期账目提醒
- [ ] 账目标签系统
- [ ] 多币种支持
- [ ] 移动端 App (React Native)
- [ ] 数据备份与恢复
- [ ] 账目搜索功能
- [ ] 自定义分类

### 🐛 常见问题

#### Q: 如何重置密码？
A: 在登录页点击"忘记密码"，按邮件提示重置。

#### Q: 如何导出数据？
A: 目前支持在 Supabase 控制台直接导出，后续会添加应用内导出功能。

#### Q: 支持离线使用吗？
A: 目前需要网络连接。后续版本会添加 Service Worker 支持离线缓存。

#### Q: 如何删除账本？
A: 只有账本所有者可以删除，在账本详情页点击删除按钮。

### 📝 许可证

MIT License

### 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 📧 联系方式

有问题或建议？欢迎通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至 your-email@example.com

---

**祝你使用愉快！** 💚
