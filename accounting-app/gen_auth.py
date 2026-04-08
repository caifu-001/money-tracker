
# -*- coding: utf-8 -*-
html = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>记账助手</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f3f4f6; min-height: 100vh; }
    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .login-card { background: white; border-radius: 1rem; padding: 2rem; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .login-title { text-align: center; font-size: 1.75rem; font-weight: bold; color: #1f2937; margin-bottom: 0.5rem; }
    .login-subtitle { text-align: center; color: #6b7280; margin-bottom: 1.5rem; }
    .login-tabs { display: flex; border-bottom: 2px solid #e5e7eb; margin-bottom: 1.5rem; }
    .login-tab { flex: 1; padding: 0.75rem; text-align: center; cursor: pointer; color: #6b7280; font-weight: 500; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
    .login-tab:hover { color: #4f46e5; }
    .login-tab.active { color: #4f46e5; border-bottom-color: #4f46e5; }
    .login-form { display: none; }
    .login-form.active { display: block; }
    .login-error { background: #fef2f2; color: #dc2626; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem; text-align: center; }
    .login-success { background: #ecfdf5; color: #059669; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem; text-align: center; }
    .btn-login { width: 100%; padding: 0.875rem; background: #4f46e5; color: white; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn-login:hover { background: #4338ca; }
    .btn-login:disabled { background: #a5a5a5; cursor: not-allowed; }
    .navbar { background: #4f46e5; color: white; padding: 1rem; position: sticky; top: 0; z-index: 100; }
    .navbar h1 { font-size: 1.25rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .nav-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .nav-tab { padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; background: transparent; color: white; border: none; transition: all 0.2s; }
    .nav-tab:hover { background: rgba(255,255,255,0.2); }
    .nav-tab.active { background: white; color: #4f46e5; font-weight: 500; }
    .user-info { display: flex; align-items: center; gap: 1rem; }
    .user-badge { background: rgba(255,255,255,0.2); padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.75rem; }
    .user-badge.admin { background: #fbbf24; color: #92400e; }
    .btn-logout { background: rgba(255,255,255,0.2); border: none; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; }
    .container { max-width: 1000px; margin: 0 auto; padding: 1rem; }
    .page-title { font-size: 1.5rem; font-weight: bold; color: #1f2937; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .card { background: white; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card-title { font-size: 1.125rem; font-weight: 600; color: #1f2937; margin-bottom: 1rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .stat-card { background: white; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid; }
    .stat-card.green { border-left-color: #10b981; }
    .stat-card.red { border-left-color: #ef4444; }
    .stat-card.blue { border-left-color: #3b82f6; }
    .stat-label { color: #6b7280; font-size: 0.875rem; margin-bottom: 0.25rem; }
    .stat-value { font-size: 1.5rem; font-weight: bold; }
    .stat-value.green { color: #10b981; }
    .stat-value.red { color: #ef4444; }
    .stat-value.blue { color: #3b82f6; }
    .btn { padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; border: none; font-weight: 500; transition: all 0.2s; }
    .btn-primary { background: #4f46e5; color: white; }
    .btn-primary:hover { background: #4338ca; }
    .btn-secondary { background: #e5e7eb; color: #374151; }
    .btn-secondary:hover { background: #d1d5db; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-success { background: #10b981; color: white; }
    .btn-success:hover { background: #059669; }
    .btn-warning { background: #f59e0b; color: white; }
    .btn-warning:hover { background: #d97706; }
    .btn-sm { padding: 0.25rem 0.75rem; font-size: 0.875rem; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .table th { background: #f9fafb; font-weight: 500; color: #6b7280; font-size: 0.875rem; }
    .table tr:hover { background: #f9fafb; }
    .form-group { margin-bottom: 1rem; }
    .form-label { display: block; font-weight: 500; color: #374151; margin-bottom: 0.5rem; }
    .form-input { width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 1rem; }
    .form-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
    .type-toggle { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .type-btn { flex: 1; padding: 0.75rem; border: 2px solid; border-radius: 0.5rem; cursor: pointer; font-weight: 500; background: white; transition: all 0.2s; }
    .type-btn.expense { border-color: #ef4444; color: #ef4444; }
    .type-btn.expense.active { background: #fef2f2; }
    .type-btn.income { border-color: #10b981; color: #10b981; }
    .type-btn.income.active { background: #ecfdf5; }
    .category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 0.5rem; margin-bottom: 1rem; }
    .category-btn { padding: 0.75rem 0.5rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; cursor: pointer; background: white; text-align: center; transition: all 0.2s; }
    .category-btn:hover { background: #f3f4f6; }
    .category-btn.selected { border-color: #4f46e5; background: #eef2ff; }
    .category-btn .icon { font-size: 1.5rem; display: block; margin-bottom: 0.25rem; }
    .category-btn .name { font-size: 0.75rem; color: #374151; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
    .modal { background: white; border-radius: 1rem; padding: 1.5rem; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; }
    .modal-title { font-size: 1.25rem; font-weight: bold; margin-bottom: 1.5rem; }
    .fab { position: fixed; bottom: 1.5rem; right: 1.5rem; width: 3.5rem; height: 3.5rem; border-radius: 50%; background: #4f46e5; color: white; border: none; font-size: 2rem; cursor: pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4); transition: all 0.2s; z-index: 50; }
    .fab:hover { background: #4338ca; transform: scale(1.1); }
    .transaction-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: #f9fafb; border-radius: 0.5rem; margin-bottom: 0.5rem; }
    .transaction-left { display: flex; align-items: center; gap: 0.75rem; }
    .transaction-icon { font-size: 1.75rem; }
    .transaction-info .transaction-category { font-weight: 500; color: #1f2937; }
    .transaction-info .transaction-note { font-size: 0.875rem; color: #6b7280; }
    .transaction-right { display: flex; align-items: center; gap: 0.75rem; }
    .transaction-amount { font-weight: bold; font-size: 1.125rem; }
    .transaction-amount.income { color: #10b981; }
    .transaction-amount.expense { color: #ef4444; }
    .transaction-actions { display: flex; gap: 0.5rem; }
    .transaction-actions button { background: none; border: none; cursor: pointer; padding: 0.25rem; font-size: 0.875rem; }
    .edit-btn { color: #4f46e5; }
    .delete-btn { color: #ef4444; }
    .empty-state { text-align: center; padding: 3rem; color: #6b7280; }
    .empty-state .icon { font-size: 3rem; margin-bottom: 1rem; }
    .budget-bar { width: 100%; height: 1rem; background: #e5e7eb; border-radius: 0.5rem; overflow: hidden; margin-bottom: 0.5rem; }
    .budget-bar-fill { height: 100%; transition: width 0.3s; }
    .budget-bar-fill.green { background: #10b981; }
    .budget-bar-fill.yellow { background: #f59e0b; }
    .budget-bar-fill.red { background: #ef4444; }
    .export-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
    .chart-container { height: 300px; display: flex; align-items: center; justify-content: center; color: #6b7280; }
    .hidden { display: none !important; }
    .flex { display: flex; }
    .justify-content-between { justify-content: space-between; }
    .gap-2 { gap: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .mb-4 { margin-bottom: 1rem; }
    .text-sm { font-size: 0.875rem; }
    .text-center { text-align: center; }
    .pie-chart { width: 100%; min-height: 300px; position: relative; }
    .pie-legend { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-top: 1rem; }
    .pie-legend-item { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; }
    .pie-legend-color { width: 12px; height: 12px; border-radius: 2px; }
    .status-badge { padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; display: inline-block; }
    .status-badge.pending { background: #fef3c7; color: #92400e; }
    .status-badge.approved { background: #d1fae5; color: #065f46; }
    .status-badge.rejected { background: #fee2e2; color: #991b1b; }
    .user-card { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: #f9fafb; border-radius: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem; }
    .user-info-item { display: flex; align-items: center; gap: 0.75rem; }
    .user-avatar { width: 40px; height: 40px; border-radius: 50%; background: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.125rem; }
    .user-details .username { font-weight: 500; color: #1f2937; }
    .user-details .created { font-size: 0.75rem; color: #6b7280; }
    .user-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: #1f2937; color: white; padding: 1rem 2rem; border-radius: 0.5rem; z-index: 2000; animation: fadeInUp 0.3s; white-space: nowrap; }
    .toast.success { background: #059669; }
    .toast.error { background: #dc2626; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  </style>
</head>
<body>

  <div id="login-page" class="login-container">
    <div class="login-card">
      <h2 class="login-title">&#x1F4B0; 记账助手</h2>
      <p class="login-subtitle">管理你的每一笔收支</p>
      <div id="login-message"></div>
      <div class="login-tabs">
        <div class="login-tab active" data-tab="login">登录</div>
        <div class="login-tab" data-tab="register">注册</div>
        <div class="login-tab" data-tab="forgot">找回密码</div>
      </div>
      <form id="form-login" class="login-form active">
        <div class="form-group"><label class="form-label">用户名</label><input type="text" id="login-username" class="form-input" placeholder="请输入用户名" required></div>
        <div class="form-group"><label class="form-label">密码</label><input type="password" id="login-password" class="form-input" placeholder="请输入密码" required></div>
        <button type="submit" class="btn-login">登录</button>
        <p class="text-sm text-center mt-4" style="color:#6b7280;">管理员账号: admin / admin123</p>
      </form>
      <form id="form-register" class="login-form">
        <div class="form-group"><label class="form-label">用户名</label><input type="text" id="reg-username" class="form-input" placeholder="请输入用户名（3-20位）" required minlength="3" maxlength="20"></div>
        <div class="form-group"><label class="form-label">密码</label><input type="password" id="reg-password" class="form-input" placeholder="请输入密码（至少6位）" required minlength="6"></div>
        <div class="form-group"><label class="form-label">确认密码</label><input type="password" id="reg-confirm" class="form-input" placeholder="请再次输入密码" required></div>
        <button type="submit" class="btn-login">注册</button>
        <p class="text-sm text-center mt-4" style="color:#6b7280;">注册后需等待管理员审核</p>
      </form>
      <form id="form-forgot" class="login-form">
        <div class="form-group"><label class="form-label">用户名</label><input type="text" id="forgot-username" class="form-input" placeholder="请输入用户名" required></div>
        <div class="form-group"><label class="form-label">新密码</label><input type="password" id="forgot-password" class="form-input" placeholder="请输入新密码（至少6位）" required minlength="6"></div>
        <div class="form-group"><label class="form-label">确认新密码</label><input type="password" id="forgot-confirm" class="form-input" placeholder="请再次输入新密码" required></div>
        <button type="submit" class="btn-login">重置密码</button>
      </form>
    </div>
  </div>

  <div id="app-page" class="hidden">
    <nav class="navbar">
      <h1>
        <span>&#x1F4B0; 记账助手</span>
        <div class="user-info">
          <span id="current-user-display" class="user-badge"></span>
          <button class="btn-logout" id="btn-logout">退出</button>
        </div>
      </h1>
      <div class="nav-tabs" id="nav-tabs">
        <button class="nav-tab active" data-tab="dashboard">概览</button>
        <button class="nav-tab" data-tab="transactions">记账</button>
        <button class="nav-tab" data-tab="statistics">统计</button>
        <button class="nav-tab" data-tab="budget">预算</button>
        <button class="nav-tab" data-tab="export">导出</button>
        <button class="nav-tab hidden" data-tab="users">用户管理</button>
      </div>
    </nav>
    <main class="container">
      <section id="page-dashboard" class="page">
        <div class="page-title"><span>月度概览</span><input type="month" id="dashboard-month" class="form-input" style="width:auto;"></div>
        <div class="stats-grid">
          <div class="stat-card green"><div class="stat-label">本月收入</div><div class="stat-value green" id="stat-income">¥0.00</div></div>
          <div class="stat-card red"><div class="stat-label">本月支出</div><div class="stat-value red" id="stat-expense">¥0.00</div></div>
          <div class="stat-card blue"><div class="stat-label">本月结余</div><div class="stat-value blue" id="stat-balance">¥0.00</div></div>
        </div>
        <div class="card"><div class="card-title">最近交易</div><div id="recent-transactions"></div></div>
      </section>
      <section id="page-transactions" class="page hidden">
        <div class="page-title"><span>记账</span><div class="flex gap-2"><input type="month" id="transactions-month" class="form-input" style="width:auto;"><button class="btn btn-primary" id="btn-add-transaction">+ 添加记录</button></div></div>
        <div class="card"><div id="transactions-list"></div></div>
      </section>
      <section id="page-statistics" class="page hidden">
        <div class="page-title">统计分析</div>
        <div class="card"><div class="card-title">支出分布</div><div class="pie-chart" id="pie-chart"></div></div>
        <div class="card"><div class="card-title">收支对比（最近6个月）</div><div id="bar-chart" class="chart-container">暂无数据</div></div>
      </section>
      <section id="page-budget" class="page hidden">
        <div class="page-title">预算管理</div>
        <div class="card">
          <div class="card-title">月度预算</div>
          <div class="form-group"><label class="form-label">设置本月预算</label><div class="flex gap-2"><input type="number" id="budget-input" class="form-input" placeholder="0.00" style="width:200px;"><span style="line-height:3;">元</span><button class="btn btn-primary" id="btn-save-budget">保存</button></div></div>
          <div id="budget-progress" class="hidden">
            <div class="flex justify-content-between mb-4"><span>已使用</span><span id="budget-used">¥0 / ¥0</span></div>
            <div class="budget-bar"><div class="budget-bar-fill green" id="budget-bar-fill"></div></div>
            <p class="text-sm mt-4" id="budget-status"></p>
          </div>
        </div>
        <div class="card"><div class="card-title">分类支出明细</div><div id="category-expenses"></div></div>
      </section>
      <section id="page-export" class="page hidden">
        <div class="page-title">数据导出</div>
        <div class="card"><div class="card-title">导出数据</div><p class="text-sm mb-4" id="export-info">共 0 条记录</p><div class="export-grid"><button class="btn btn-success" id="btn-export-csv">&#x1F4CA; 导出 CSV</button><button class="btn btn-primary" id="btn-export-json">&#x1F4C4; 导出 JSON</button><button class="btn btn-secondary" id="btn-export-html">&#x1F4C8; 导出 Excel</button></div></div>
        <div class="card"><div class="card-title">危险操作</div><p class="text-sm mb-4">以下操作不可恢复，请谨慎使用</p><button class="btn btn-danger" id="btn-clear-data">&#x1F5D1;&#xFE0F; 清空所有数据</button></div>
      </section>
      <section id="page-users" class="page hidden">
        <div class="page-title">
          <span>用户管理</span>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" data-filter="pending">待审核</button>
            <button class="btn btn-secondary btn-sm" data-filter="approved">已通过</button>
            <button class="btn btn-secondary btn-sm" data-filter="rejected">已拒绝</button>
            <button class="btn btn-primary btn-sm" data-filter="all">全部</button>
          </div>
        </div>
        <div class="card"><div class="card-title">用户列表</div><div id="users-list"></div></div>
      </section>
    </main>
    <button class="fab hidden" id="fab-add">+</button>
    <div class="modal-overlay hidden" id="modal">
      <div class="modal">
        <h3 class="modal-title" id="modal-title">添加记录</h3>
        <form id="transaction-form">
          <input type="hidden" id="transaction-id">
          <div class="type-toggle">
            <button type="button" class="type-btn expense active" data-type="expense">支出</button>
            <button type="button" class="type-btn income" data-type="income">收入</button>
          </div>
          <div class="form-group"><label class="form-label">金额</label><input type="number" step="0.01" id="amount" class="form-input" placeholder="0.00" required></div>
          <div class="form-group"><label class="form-label">类别</label><div class="category-grid" id="category-grid"></div></div>
          <div class="form-group"><label class="form-label">日期</label><input type="date" id="date" class="form-input" required></div>
          <div class="form-group"><label class="form-label">备注</label><input type="text" id="note" class="form-input" placeholder="可选"></div>
          <div class="flex gap-2 mt-4">
            <button type="button" class="btn btn-secondary" id="btn-cancel" style="flex:1;">取消</button>
            <button type="submit" class="btn btn-primary" style="flex:1;">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <script>
    const SUPABASE_URL = 'https://nvqqfmvtyqzxxcgoeriv.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cXFmbXZ0eXF6eHhjZ29lcml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNjA2MDAsImV4cCI6MjA1NjczNjYwMH0.5FlqnLlXuzJ2ne2AjvYnug_XGOCUenw';

    let currentUser = null, isAdmin = false, currentFilter = 'pending';
    let transactions = [], budgets = {}, currentTab = 'dashboard';
    let currentType = 'expense', selectedCategory = 'food', editingId = null;

    const CATEGORIES = {
      income: [
        { id: 'salary', name: '工资', icon: '\u{1F4B0}' },
        { id: 'parttime', name: '兼职', icon: '\u{1F4BC}' },
        { id: 'investment', name: '投资', icon: '\u{1F4C8}' },
        { id: 'gift', name: '礼金', icon: '\u{1F381}' },
        { id: 'other_income', name: '其他', icon: '\u{1F4B5}' }
      ],
      expense: [
        { id: 'food', name: '餐饮', icon: '\u{1F354}' },
        { id: 'transport', name: '交通', icon: '\u{1F697}' },
        { id: 'shopping', name: '购物', icon: '\u{1F6D2}' },
        { id: 'living', name: '居住', icon: '\u{1F3E0}' },
        { id: 'health', name: '医疗', icon: '\u{1F48A}' },
        { id: 'education', name: '教育', icon: '\u{1F4DA}' },
        { id: 'entertainment', name: '娱乐', icon: '\u{1F3AE}' },
        { id: 'social', name: '社交', icon: '\u{1F91D}' },
        { id: 'other_expense', name: '其他', icon: '\u{1F4E6}' }
      ]
    };

    const EXPENSE_COLORS = {
      food: '#ef4444', transport: '#f97316', shopping: '#a855f7',
      living: '#8b5cf6', health: '#3b82f6', education: '#06b6d4',
      entertainment: '#14b8a6', social: '#22c55e', other_expense: '#6b7280'
    };

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const showToast = (msg, type = 'info') => {
      const e = document.querySelector('.toast');
      if (e) e.remove();
      const t = document.createElement('div');
      t.className = 'toast ' + type;
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    };

    const fmtCur = (a) => '\u00A5' + Number(a).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const fmtDate = (d) => new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const curMonth = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); };
    const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

    const sbFetch = async (table, opts = {}) => {
      const { method = 'GET', body = null, params = {} } = opts;
      const url = new URL(SUPABASE_URL + '/rest/v1/' + table);
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
      const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
      const cfg = { method, headers };
      if (body) cfg.body = JSON.stringify(body);
      const res = await fetch(url, cfg);
      if (!res.ok) { const err = await res.text(); throw new Error(err || 'HTTP ' + res.status); }
      const txt = await res.text();
      return txt ? JSON.parse(txt) : null;
    };

    const initAdmin = async () => {
      try {
        const admins = await sbFetch('users', { params: { username: 'eq.admin' } });
        if (!admins || admins.length === 0) {
          await sbFetch('users', { method: 'POST', body: { username: 'admin', password: 'admin123', status: 'approved', role: 'admin', created_at: new Date().toISOString() } });
        }
      } catch (e) { console.error('Init admin failed:', e); }
    };

    const checkAuth = () => {
      const saved = localStorage.getItem('currentUser');
      if (saved) { currentUser = JSON.parse(saved); isAdmin = currentUser.role === 'admin'; showApp(); }
      else showLogin();
    };

    const showLogin = () => {
      $('#login-page').classList.remove('hidden');
      $('#app-page').classList.add('hidden');
      initAdmin();
    };

    const showApp = () => {
      $('#login-page').classList.add('hidden');
      $('#app-page').classList.remove('hidden');
      $('#current-user-display').textContent = currentUser.username + (isAdmin ? ' (管理员)' : '');
      if (isAdmin) { $('#current-user-display').classList.add('admin'); $('[data-tab="users"]').classList.remove('hidden'); }
      else { $('#current-user-display').classList.remove('admin'); $('[data-tab="users"]').classList.add('hidden'); }
      loadData();
      renderDashboard();
    };

    const login = async (username, password) => {
      try {
        const users = await sbFetch('users', { params: { username: 'eq.' + username } });
        if (!users || users.length === 0) return { success: false, message: '用户不存在' };
        const u = users[0];
        if (u.password !== password) return { success: false, message: '密码错误' };
        if (u.status === 'pending') return { success: false, message: '账号待审核，请耐心等待管理员审批' };
        if (u.status === 'rejected') return { success: false, message: '申请被拒绝，请联系管理员' };
        currentUser = { id: u.id, username: u.username, role: u.role };
        isAdmin = u.role === 'admin';
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        return { success: true };
      } catch (e) { return { success: false, message: '登录失败: ' + e.message }; }
    };

    const register = async (username, password) => {
      try {
        const existing = await sbFetch('users', { params: { username: 'eq.' + username } });
        if (existing && existing.length > 0) return { success: false, message: '用户名已存在' };
        await sbFetch('users', { method: 'POST', body: { username, password, status: 'pending', role: 'user', created_at: new Date().toISOString() } });
        return { success: true };
      } catch (e) { return { success: false, message: '注册失败: ' + e.message }; }
    };

    const resetPassword = async (username, newPassword) => {
      try {
        const users = await sbFetch('users', { params: { username: 'eq.' + username } });
        if (!users || users.length === 0) return { success: false, message: '用户不存在' };
        const u = users[0];
        if (u.role === 'admin') return { success: false, message: '管理员密码不可通过此方式重置' };
        await sbFetch('users?id=eq.' + u.id, { method: 'PATCH', body: { password: newPassword } });
        return { success: true };
      } catch (e) { return { success: false, message: '重置失败: ' + e.message }; }
    };

    const updateUserStatus = async (userId, status) => {
      try {
        await sbFetch('users?id=eq.' + userId, { method: 'PATCH', body: { status } });
        return { success: true };
      } catch (e) { return { success: false, message: e.message }; }
    };

    const loadUsers = async (filter = 'all') => {
      try {
        const params = { 'role': 'neq.admin', 'order': 'created_at.desc' };
        if (filter !== 'all') params['status'] = 'eq.' + filter;
        return await sbFetch('users', { params }) || [];
      } catch (e) { console.error(e); return []; }
    };

    const showLoginMsg = (msg, type = 'error') => {
      const el = $('#login-message');
      el.innerHTML = '<div class="login-' + type + '">' + msg + '</div>';
      setTimeout(() => { el.innerHTML = ''; }, 4000);
    };

    const switchLoginTab = (tab) => {
      $$('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      $$('.login-form').forEach(f => f.classList.remove('active'));
      $('#form-' + tab).classList.add('active');
      $('#login-message').innerHTML = '';
    };

    const renderUsers = async () => {
      const list = $('#users-list');
      list.innerHTML = '<div class="empty-state"><div class="icon">\u23F3</div><p>加载中...</p></div>';
      const users = await loadUsers(currentFilter);
      if (users.length === 0) { list.innerHTML = '<div class="empty-state"><div class="icon">\u{1F465}</div><p>暂无用户</p></div>'; return; }
      const statusText = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
      list.innerHTML = users.map(u => `
        <div class="user-card">
          <div class="user-info-item">
            <div class="user-avatar">${u.username[0].toUpperCase()}</div>
            <div class="user-details">
              <div class="username">${u.username}</div>
              <div class="created">${new Date(u.created_at).toLocaleString('zh-CN')}</div>
            </div>
          </div>
          <div class="user-actions">
            <span class="status-badge ${u.status}">${statusText[u.status] || u.status}</span>
            ${u.status !== 'approved' ? `<button class="btn btn-success btn-sm" onclick="handleUserAction('${u.id}','approved')">通过</button>` : ''}
            ${u.status !== 'rejected' ? `<button class="btn btn-danger btn-sm" onclick="handleUserAction('${u.id}','rejected')">拒绝</button>` : ''}
          </div>
        </div>
      `).join('');
    };

    window.handleUserAction = async (userId, status) => {
      const result = await updateUserStatus(userId, status);
      if (result.success) { showToast(status === 'approved' ? '已通过审核' : '已拒绝申请', 'success'); renderUsers(); }
      else showToast('操作失败: ' + result.message, 'error');
    };

    const storage = {
      get: (k) => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : null; } catch { return null; } },
      set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
    };

    const uKey = (k) => currentUser ? k + '_' + currentUser.id : k;

    const loadData = () => {
      transactions = storage.get(uKey('transactions')) || [];
      budgets = storage.get(uKey('budgets')) || { total: 0 };
      $('#budget-input').value = budgets.total || '';
    };

    const saveTx = () => storage.set(uKey('transactions'), transactions);
    const saveBudgets = () => storage.set(uKey('budgets'), budgets);

    const getMonthly = (month) => transactions.filter(t => t.date.startsWith(month || curMonth()));

    const calcStats = (month) => {
      const m = getMonthly(month);
      const income = m.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = m.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const bycat = {};
      m.filter(t => t.type === 'expense').forEach(t => { bycat[t.category] = (bycat[t.category] || 0) + t.amount; });
      return { income, expense, balance: income - expense, expenseByCategory: bycat };
    };

    const renderCats = (type) => {
      const grid = $('#category-grid');
      grid.innerHTML = CATEGORIES[type].map(c => `<button type="button" class="category-btn ${c.id === selectedCategory ? 'selected' : ''}" data-category="${c.id}"><span class="icon">${c.icon}</span><span class="name">${c.name}</span></button>`).join('');
      grid.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedCategory = btn.dataset.category;
        });
      });
    };

    const renderDashboard = () => {
      const month = $('#dashboard-month').value || curMonth();
      const stats = calcStats(month);
      const recent = getMonthly(month).slice(-5).reverse();
      $('#stat-income').textContent = fmtCur(stats.income);
      $('#stat-expense').textContent = fmtCur(stats.expense);
      $('#stat-balance').textContent = fmtCur(stats.balance);
      $('#stat-balance').className = 'stat-value ' + (stats.balance >= 0 ? 'blue' : 'red');
      const list = $('#recent-transactions');
      if (!recent.length) { list.innerHTML = '<div class="empty-state"><div class="icon">\u{1F4DD}</div><p>暂无记录</p></div>'; return; }
      list.innerHTML = recent.map(t => {
        const cat = CATEGORIES[t.type].find(c => c.id === t.category);
        return `<div class="transaction-item"><div class="transaction-left"><span class="transaction-icon">${cat?.icon || '\u{1F4DD}'}</span><div class="transaction-info"><div class="transaction-category">${cat?.name || t.category}</div><div class="transaction-note">${t.note || fmtDate(t.date)}</div></div></div><div class="transaction-right"><span class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmtCur(t.amount)}</span><div class="transaction-actions"><button class="edit-btn" onclick="editTx('${t.id}')">编辑</button><button class="delete-btn" onclick="deleteTx('${t.id}')">删除</button></div></div></div>`;
      }).join('');
    };

    const renderTransactions = () => {
      const month = $('#transactions-month').value || curMonth();
      const monthly = getMonthly(month).reverse();
      const list = $('#transactions-list');
      if (!monthly.length) { list.innerHTML = '<div class="empty-state"><div class="icon">\u{1F4DD}</div><p>暂无记录，点击添加按钮记一笔</p></div>'; return; }
      list.innerHTML = '<table class="table"><thead><tr><th>日期</th><th>类别</th><th>备注</th><th style="text-align:right;">金额</th><th style="text-align:right;">操作</th></tr></thead><tbody>' +
        monthly.map(t => {
          const cat = CATEGORIES[t.type].find(c => c.id === t.category);
          return `<tr><td>${fmtDate(t.date)}</td><td>${cat?.icon || ''} ${cat?.name || t.category}</td><td>${t.note || '-'}</td><td style="text-align:right;" class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmtCur(t.amount)}</td><td style="text-align:right;"><button class="edit-btn" onclick="editTx('${t.id}')">编辑</button> <button class="delete-btn" onclick="deleteTx('${t.id}')">删除</button></td></tr>`;
        }).join('') + '</tbody></table>';
    };

    const renderPie = () => {
      const month = $('#dashboard-month')?.value || curMonth();
      const stats = calcStats(month);
      const pieData = Object.entries(stats.expenseByCategory);
      const container = $('#pie-chart');
      if (!pieData.length) { container.innerHTML = '<div class="chart-container">暂无数据</div>'; return; }
      const total = pieData.reduce((s, [, v]) => s + v, 0);
      let angle = 0;
      const parts = pieData.map(([catId, amount]) => {
        const pct = amount / total;
        const deg = pct * 360;
        const color = EXPENSE_COLORS[catId] || '#6b7280';
        const part = color + ' ' + angle + 'deg ' + (angle + deg) + 'deg';
        angle += deg;
        return { catId, amount, color, part };
      });
      const legend = parts.map(({ catId, amount, color }) => {
        const cat = CATEGORIES.expense.find(c => c.id === catId);
        return `<div class="pie-legend-item"><div class="pie-legend-color" style="background:${color}"></div>${cat?.name || catId} ${((amount / total) * 100).toFixed(1)}%</div>`;
      }).join('');
      container.innerHTML = `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:2rem;padding:1rem;">
        <div style="position:relative;width:200px;height:200px;">
          <div style="width:200px;height:200px;border-radius:50%;background:conic-gradient(${parts.map(p => p.part).join(',')});"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:100px;height:100px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;">
            <span style="font-size:0.7rem;color:#6b7280;">支出</span>
            <span style="font-weight:bold;font-size:0.8rem;">${fmtCur(stats.expense)}</span>
          </div>
        </div>
        <div class="pie-legend">${legend}</div>
      </div>`;
    };

    const renderBudget = () => {
      const stats = calcStats(curMonth());
      const pd = $('#budget-progress');
      if (budgets.total > 0) {
        pd.classList.remove('hidden');
        const pct = Math.min(100, (stats.expense / budgets.total) * 100);
        const rem = budgets.total - stats.expense;
        $('#budget-used').textContent = fmtCur(stats.expense) + ' / ' + fmtCur(budgets.total);
        $('#budget-bar-fill').style.width = pct + '%';
        $('#budget-bar-fill').className = 'budget-bar-fill ' + (pct > 100 ? 'red' : pct > 80 ? 'yellow' : 'green');
        $('#budget-status').textContent = rem >= 0 ? '剩余 ' + fmtCur(rem) : '\u26A0\uFE0F 已超支 ' + fmtCur(Math.abs(rem));
      } else pd.classList.add('hidden');
      $('#category-expenses').innerHTML = CATEGORIES.expense.map(cat => {
        const amount = stats.expenseByCategory[cat.id] || 0;
        return `<div class="transaction-item"><div class="transaction-left"><span class="transaction-icon">${cat.icon}</span><span>${cat.name}</span></div><span class="transaction-amount expense">${fmtCur(amount)}</span></div>`;
      }).join('');
    };

    const renderExport = () => { $('#export-info').textContent = '共 ' + transactions.length + ' 条记录'; };

    const renderStats = () => {
      renderPie();
      const barDiv = $('#bar-chart');
      const months = [];
      for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
      const hasData = months.some(m => getMonthly(m).length > 0);
      if (!hasData) { barDiv.innerHTML = '<div class="chart-container">暂无数据</div>'; return; }
      const maxVal = Math.max(...months.map(m => { const s = calcStats(m); return Math.max(s.income, s.expense); }), 1);
      barDiv.innerHTML = '<div style="display:flex;align-items:flex-end;gap:0.5rem;height:250px;padding:1rem;width:100%;">' +
        months.map(m => {
          const s = calcStats(m);
          const ih = Math.round((s.income / maxVal) * 200);
          const eh = Math.round((s.expense / maxVal) * 200);
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="display:flex;gap:2px;align-items:flex-end;height:200px;"><div style="width:14px;height:${ih}px;background:#10b981;border-radius:2px 2px 0 0;" title="${fmtCur(s.income)}"></div><div style="width:14px;height:${eh}px;background:#ef4444;border-radius:2px 2px 0 0;" title="${fmtCur(s.expense)}"></div></div><div style="font-size:0.7rem;color:#6b7280;">${m.slice(5)}月</div></div>`;
        }).join('') +
        '</div><div style="display:flex;gap:1rem;justify-content:center;font-size:0.75rem;"><span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#10b981;display:inline-block;border-radius:2px;"></span>收入</span><span style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#ef4444;display:inline-block;border-radius:2px;"></span>支出</span></div>';
    };

    const switchTab = (tab) => {
      currentTab = tab;
      $$('.nav-tab').forEach(t => t.classList.remove('active'));
      $('[data-tab="' + tab + '"]').classList.add('active');
      $$('.page').forEach(p => p.classList.add('hidden'));
      $('#page-' + tab).classList.remove('hidden');
      const fab = $('#fab-add');
      if (tab === 'dashboard' || tab === 'transactions') fab.classList.remove('hidden');
      else fab.classList.add('hidden');
      switch (tab) {
        case 'dashboard': renderDashboard(); break;
        case 'transactions': renderTransactions(); break;
        case 'statistics': renderStats(); break;
        case 'budget': renderBudget(); break;
        case 'export': renderExport(); break;
        case 'users': renderUsers(); break;
      }
    };

    const openModal = (edit = null) => {
      editingId = edit?.id || null;
      $('#modal-title').textContent = edit ? '编辑记录' : '添加记录';
      if (edit) {
        currentType = edit.type; selectedCategory = edit.category;
        $('#transaction-id').value = edit.id; $('#amount').value = edit.amount;
        $('#date').value = edit.date; $('#note').value = edit.note || '';
      } else {
        currentType = 'expense'; selectedCategory = 'food';
        $('#transaction-id').value = ''; $('#amount').value = '';
        $('#date').value = new Date().toISOString().split('T')[0]; $('#note').value = '';
      }
      $$('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === currentType));
      renderCats(currentType);
      $('#modal').classList.remove('hidden');
    };

    const closeModal = () => { $('#modal').classList.add('hidden'); editingId = null; };

    window.editTx = (id) => { const t = transactions.find(x => x.id === id); if (t) openModal(t); };
    window.deleteTx = (id) => {
      if (confirm('确定要删除这条记录吗？')) {
        transactions = transactions.filter(t => t.id !== id);
        saveTx(); renderCurrent();
      }
    };

    const saveTxData = (data) => {
      if (editingId) transactions = transactions.map(t => t.id === editingId ? { ...data, id: editingId } : t);
      else transactions.push({ ...data, id: genId() });
      saveTx(); closeModal(); renderCurrent();
    };

    const renderCurrent = () => {
      switch (currentTab) {
        case 'dashboard': renderDashboard(); break;
        case 'transactions': renderTransactions(); break;
        case 'statistics': renderStats(); break;
        case 'budget': renderBudget(); break;
        case 'export': renderExport(); break;
        case 'users': renderUsers(); break;
      }
    };

    const dlFile = (content, filename, type) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const exportCSV = () => {
      if (!transactions.length) { alert('暂无数据'); return; }
      const rows = transactions.map(t => { const cat = CATEGORIES[t.type].find(c => c.id === t.category); return [t.date, t.type === 'income' ? '收入' : '支出', cat?.name || t.category, t.amount, t.note || ''].join(','); });
      dlFile(['日期,类型,类别,金额,备注', ...rows].join('\n'), '账本数据.csv', 'text/csv;charset=utf-8');
    };

    const exportJSON = () => {
      if (!transactions.length) { alert('暂无数据'); return; }
      dlFile(JSON.stringify(transactions, null, 2), '账本数据.json', 'application/json');
    };

    const exportExcel = () => {
      if (!transactions.length) { alert('暂无数据'); return; }
      let rows = transactions.map(t => { const cat = CATEGORIES[t.type].find(c => c.id === t.category); return `<tr><td>${t.date}</td><td>${t.type === 'income' ? '收入' : '支出'}</td><td>${cat?.name || t.category}</td><td>${t.amount}</td><td>${t.note || ''}</td></tr>`; }).join('');
      dlFile('<html><head><meta charset="utf-8"><style>table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}</style></head><body><table><thead><tr><th>日期</th><th>类型</th><th>类别</th><th>金额</th><th>备注</th></tr></thead><tbody>' + rows + '</tbody></table></body></html>', '账本数据.xls', 'application/vnd.ms-excel');
    };

    const clearData = () => {
      if (confirm('确定要清空所有数据吗？此操作不可恢复！') && confirm('再次确认：所有数据将被永久删除！')) {
        localStorage.removeItem(uKey('transactions'));
        localStorage.removeItem(uKey('budgets'));
        transactions = []; budgets = { total: 0 };
        renderCurrent(); alert('数据已清空');
      }
    };

    const init = () => {
      $$('.login-tab').forEach(tab => tab.addEventListener('click', () => switchLoginTab(tab.dataset.tab)));

      $('#form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = '登录中...';
        const result = await login($('#login-username').value.trim(), $('#login-password').value);
        btn.disabled = false; btn.textContent = '登录';
        if (result.success) showApp();
        else showLoginMsg(result.message, 'error');
      });

      $('#form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = $('#reg-username').value.trim();
        const password = $('#reg-password').value;
        if (password !== $('#reg-confirm').value) { showLoginMsg('两次密码不一致', 'error'); return; }
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = '注册中...';
        const result = await register(username, password);
        btn.disabled = false; btn.textContent = '注册';
        if (result.success) { showLoginMsg('注册成功！请等待管理员审核后登录', 'success'); e.target.reset(); setTimeout(() => switchLoginTab('login'), 2000); }
        else showLoginMsg(result.message, 'error');
      });

      $('#form-forgot').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = $('#forgot-username').value.trim();
        const password = $('#forgot-password').value;
        if (password !== $('#forgot-confirm').value) { showLoginMsg('两次密码不一致', 'error'); return; }
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = '重置中...';
        const result = await resetPassword(username, password);
        btn.disabled = false; btn.textContent = '重置密码';
        if (result.success) { showLoginMsg('密码重置成功！请使用新密码登录', 'success'); e.target.reset(); setTimeout(() => switchLoginTab('login'), 2000); }
        else showLoginMsg(result.message, 'error');
      });

      $('#btn-logout').addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
          currentUser = null; isAdmin = false;
          localStorage.removeItem('currentUser');
          showLogin();
        }
      });

      $$('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentFilter = btn.dataset.filter;
          $$('[data-filter]').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
          btn.classList.remove('btn-secondary'); btn.classList.add('btn-primary');
          renderUsers();
        });
      });

      $$('.nav-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
      $('#btn-add-transaction')?.addEventListener('click', () => openModal());
      $('#fab-add').addEventListener('click', () => openModal());
      $('#btn-cancel').addEventListener('click', closeModal);

      $$('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentType = btn.dataset.type;
          $$('.type-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedCategory = CATEGORIES[currentType][0].id;
          renderCats(currentType);
        });
      });

      $('#transaction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveTxData({ type: currentType, amount: Number($('#amount').value), category: selectedCategory, date: $('#date').value, note: $('#note').value });
      });

      $('#btn-save-budget').addEventListener('click', () => {
        budgets.total = Number($('#budget-input').value) || 0;
        saveBudgets(); renderBudget();
        showToast('预算已保存', 'success');
      });

      $('#btn-export-csv').addEventListener('click', exportCSV);
      $('#btn-export-json').addEventListener('click', exportJSON);
      $('#btn-export-html').addEventListener('click', exportExcel);
      $('#btn-clear-data').addEventListener('click', clearData);
      $('#dashboard-month').addEventListener('change', renderDashboard);
      $('#transactions-month').addEventListener('change', renderTransactions);
      $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

      const cm = curMonth();
      $('#dashboard-month').value = cm;
      $('#transactions-month').value = cm;

      checkAuth();
    };

    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>"""

with open(r'C:\Users\yinsu\.qclaw\workspace\accounting-app\index-with-auth.html', 'w', encoding='utf-8') as f:
    f.write(html)

import os
size = os.path.getsize(r'C:\Users\yinsu\.qclaw\workspace\accounting-app\index-with-auth.html')
print(f"Done! File size: {size} bytes")
