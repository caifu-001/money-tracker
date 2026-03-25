# 🚀 部署指南

## 第一步：创建 GitHub 仓库

### 方式一：通过 GitHub 网页创建（推荐）

1. 打开 https://github.com/new
2. 仓库名称：`money-tracker`
3. 描述：智能记账应用
4. 选择 **Public**（公开，可以部署到 GitHub Pages）
5. **不要勾选** "Add a README file"（我们已经有了）
6. 点击 "Create repository"

### 方式二：通过命令行创建（需要 GitHub CLI）

```bash
gh repo create money-tracker --public --description "智能记账应用"
```

---

## 第二步：推送代码到 GitHub

在项目目录下执行：

```bash
# 初始化 git（如果还没有）
git init

# 添加所有文件
git add .

# 创建第一次提交
git commit -m "feat: 初始化记账应用

- 完整的记账功能
- 预算管理
- 数据分析
- 分类管理（支持5级嵌套）
- 用户权限管理
- 管理员审核系统
- 美观的 UI 设计"

# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/money-tracker.git

# 推送到 GitHub
git push -u origin master
```

或者如果默认分支是 main：

```bash
git branch -M main
git push -u origin main
```

---

## 第三步：配置 GitHub Secrets

1. 打开仓库页面：https://github.com/YOUR_USERNAME/money-tracker
2. 点击 **Settings** 标签
3. 左侧菜单找到 **Secrets and variables** → **Actions**
4. 点击 **New repository secret** 添加两个密钥：

### Secret 1:
- **Name**: `VITE_SUPABASE_URL`
- **Value**: `https://abkscyijuvkfeazhlquz.supabase.co`

### Secret 2:
- **Name**: `VITE_SUPABASE_ANON_KEY`
- **Value**: （从 `.env` 文件中复制 `VITE_SUPABASE_ANON_KEY` 的值）

---

## 第四步：启用 GitHub Pages

1. 在仓库页面，点击 **Settings** 标签
2. 左侧菜单找到 **Pages**
3. **Source** 选择 **Deploy from a branch**
4. **Branch** 选择 **gh-pages**（如果没有，等 GitHub Actions 运行后会自动创建）
5. 点击 **Save**

---

## 第五步：等待部署完成

1. 点击仓库的 **Actions** 标签
2. 查看部署进度
3. 大约 2-3 分钟后部署完成

---

## 第六步：访问应用

部署完成后，访问：

```
https://YOUR_USERNAME.github.io/money-tracker/
```

---

## 📱 手机使用

### 方式一：浏览器访问

1. 在手机浏览器中打开：`https://YOUR_USERNAME.github.io/money-tracker/`
2. 登录账号即可使用

### 方式二：添加到主屏幕（PWA 体验）

#### iOS (iPhone/iPad):
1. 用 Safari 打开网址
2. 点击底部分享按钮
3. 选择"添加到主屏幕"
4. 输入名称"钱迹"
5. 点击"添加"

#### Android:
1. 用 Chrome 打开网址
2. 点击右上角菜单
3. 选择"添加到主屏幕"或"安装应用"
4. 点击"安装"

---

## 🔄 更新部署

每次推送代码到 main/master 分支，GitHub Actions 会自动重新部署：

```bash
git add .
git commit -m "更新说明"
git push
```

---

## ⚠️ 注意事项

1. **Supabase 密钥**：不要将 `.env` 文件提交到 GitHub（已在 .gitignore 中）
2. **GitHub Pages 限制**：
   - 免费版支持公开仓库
   - 每月 100GB 流量
   - 1GB 存储空间
3. **自定义域名**（可选）：
   - 在 Settings → Pages → Custom domain 添加你的域名
   - 配置 DNS CNAME 记录指向 `YOUR_USERNAME.github.io`

---

## 🎉 完成！

现在你可以在电脑、手机、平板上使用记账应用了！

**访问地址**：`https://YOUR_USERNAME.github.io/money-tracker/`