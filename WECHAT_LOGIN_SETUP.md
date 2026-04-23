# 微信登录部署说明

## 1. Supabase 数据库修改

在 Supabase Dashboard → Table Editor → `users` 表，添加字段：

```sql
ALTER TABLE users ADD COLUMN wechat_openid TEXT UNIQUE;
```

## 2. 部署 Edge Function

```bash
# 安装 Supabase CLI（如果还没装）
npm install -g supabase

# 登录
supabase login

# 进入项目目录
cd D:\1kaifa\money-tracker-miniapp

# 链接你的 Supabase 项目
supabase link --project-ref abkscyijuvkfeazhlquz

# 部署函数
supabase functions deploy wechat-auth

# 设置环境变量（小程序 AppID 和 Secret）
supabase secrets set WECHAT_APPID=wx你的AppID
supabase secrets set WECHAT_SECRET=你的AppSecret
```

获取 AppSecret：微信公众平台 → 开发 → 开发管理 → 开发设置 → AppSecret

## 3. 修改小程序代码

在 `login.js` 第 52 行，把 `wxYOUR_APPID_HERE` 换成你的真实 AppID：

```javascript
data: { code, appid: 'wx你的真实AppID' }
```

## 4. 重新编译小程序

开发者工具 → 重新编译 → 测试微信登录

## 流程说明

1. 用户打开小程序 → 自动调用 `wx.login()` 获取 code
2. 发送 code 到 Edge Function → 换取 openid
3. 用 openid 查 users 表：
   - 找到 → 自动登录 → 跳首页
   - 没找到 → 显示「一键注册」按钮
4. 用户点一键注册 → 自动生成账号 → 等待审核（或直接通过）

## 安全说明

- AppSecret 只保存在 Supabase 环境变量，不会暴露到客户端
- 微信 code 只能使用一次，5分钟过期
- openid 是微信用户唯一标识，同一小程序内不变
