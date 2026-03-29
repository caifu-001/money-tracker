# 钱迹 · 微信小程序版

> 与 Web 版共用同一个 Supabase 后端，数据完全互通。

## 目录结构

```
money-tracker-miniapp/
├── app.js              # 全局入口（每日登录检查、全局状态）
├── app.json            # 页面路由、TabBar 配置
├── app.wxss            # 全局样式
├── utils/
│   ├── supabase.js     # Supabase 客户端（wx.request 封装）
│   └── categories.js   # 默认类别数据
└── pages/
    ├── login/          # 登录/注册/忘记密码
    ├── home/           # 首页（记账、编辑、删除）✅ 完整实现
    ├── budget/         # 预算管理 ✅ 完整实现
    ├── analytics/      # 数据分析（开发中）
    ├── categories/     # 类别管理（开发中）
    ├── family/         # 成员管理（开发中）
    ├── ledgers/        # 账本管理（开发中）
    ├── admin/          # 管理后台（开发中）
    └── settings/       # 系统设置（开发中）
```

## 开发步骤

### 1. 安装微信开发者工具
下载：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 2. 导入项目
- 打开微信开发者工具
- 选择「导入项目」
- 目录选择：`C:\Users\yinsu\.qclaw\workspace\money-tracker-miniapp`
- AppID：先用「测试号」（touristappid）

### 3. 配置合法域名（发布前必须）
在微信公众平台 → 开发 → 开发设置 → 服务器域名，添加：
- request 合法域名：`https://abkscyijuvkfeazhlquz.supabase.co`

### 4. 已完成功能
- ✅ 登录/注册/忘记密码
- ✅ 每日强制登录（跨天自动退出）
- ✅ 首页记账（支持子类别目录选择）
- ✅ 账目编辑/删除（权限控制）
- ✅ 预算管理（设置/修改月度预算）
- ✅ 与 Web 版数据完全互通

### 5. 待开发功能
- 📊 数据分析（图表）
- 📂 类别管理（增删改）
- 👥 成员管理（邀请/权限）
- 📚 账本管理（切换/创建）
- 🛡️ 管理后台（用户审核）
- ⚙️ 系统设置（名称/类别）

## 注意事项
- 微信小程序不支持 npm 包，Supabase 客户端已手动封装在 `utils/supabase.js`
- 图表功能需要引入 `wx-charts` 或 `echarts-for-weixin`
