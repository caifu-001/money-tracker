# -*- coding: utf-8 -*-
html = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>记账助手</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;min-height:100vh}
    .login-container{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;background:linear-gradient(135deg,#4f46e5,#7c3aed)}
    .login-box{background:white;border-radius:1rem;padding:2rem;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
    .login-logo{text-align:center;font-size:3rem;margin-bottom:1rem}
    .login-title{text-align:center;font-size:1.5rem;font-weight:bold;color:#1f2937;margin-bottom:2rem}
    .login-tabs{display:flex;margin-bottom:1.5rem;border-bottom:2px solid #e5e7eb}
    .login-tab{flex:1;padding:0.75rem;text-align:center;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .2s}
    .login-tab.active{color:#4f46e5;border-bottom-color:#4f46e5;font-weight:500}
    .login-form{display:none}
    .login-form.active{display:block}
    .login-input{width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;margin-bottom:1rem;font-size:1rem;transition:border-color .2s}
    .login-input:focus{outline:none;border-color:#4f46e5}
    .login-btn{width:100%;padding:0.75rem;background:#4f46e5;color:white;border:none;border-radius:0.5rem;font-size:1rem;cursor:pointer;transition:background .2s}
    .login-btn:hover{background:#4338ca}
    .login-error{color:#ef4444;font-size:0.875rem;margin-top:0.5rem;text-align:center;display:none}
    .login-success{color:#10b981;font-size:0.875rem;margin-top:0.5rem;text-align:center;display:none}
    .navbar{background:#4f46e5;color:white;padding:1rem;position:sticky;top:0;z-index:100}
    .navbar h1{font-size:1.25rem;margin-bottom:0.75rem;display:flex;justify-content:space-between;align-items:center}
    .nav-tabs{display:flex;gap:0.5rem;flex-wrap:wrap}
    .nav-tab{padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;background:transparent;color:white;border:none;transition:all .2s}
    .nav-tab.active{background:white;color:#4f46e5;font-weight:500}
    .user-menu{position:relative}
    .user-btn{display:flex;align-items:center;gap:0.5rem;background:rgba(255,255,255,0.2);padding:0.5rem 1rem;border-radius:2rem;cursor:pointer;border:none;color:white;font-size:0.875rem}
    .user-dropdown{position:absolute;top:100%;right:0;margin-top:0.5rem;background:white;border-radius:0.5rem;box-shadow:0 10px 40px rgba(0,0,0,0.15);min-width:150px;display:none;z-index:1000}
    .user-dropdown.show{display:block}
    .user-dropdown button{width:100%;padding:0.75rem 1rem;border:none;background:none;text-align:left;cursor:pointer;color:#374151;font-size:0.875rem}
    .user-dropdown button:hover{background:#f3f4f6}
    .container{max-width:1000px;margin:0 auto;padding:1rem}
    .page-title{font-size:1.5rem;font-weight:bold;color:#1f2937;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center}
    .card{background:white;border-radius:0.75rem;padding:1.5rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
    .card-title{font-size:1.125rem;font-weight:600;color:#1f2937;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem}
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1rem}
    .stat-card{background:white;border-radius:0.75rem;padding:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid}
    .stat-card.green{border-left-color:#10b981}
    .stat-card.red{border-left-color:#ef4444}
    .stat-card.blue{border-left-color:#3b82f6}
    .stat-card.purple{border-left-color:#8b5cf6}
    .stat-label{color:#6b7280;font-size:0.875rem;margin-bottom:0.25rem}
    .stat-value{font-size:1.5rem;font-weight:bold}
    .stat-value.green{color:#10b981}
    .stat-value.red{color:#ef4444}
    .stat-value.blue{color:#3b82f6}
    .stat-value.purple{color:#8b5cf6}
    .btn{padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;border:none;font-weight:500;font-size:0.875rem;transition:all .2s}
    .btn-primary{background:#4f46e5;color:white}
    .btn-primary:hover{background:#4338ca}
    .btn-danger{background:#ef4444;color:white}
    .btn-danger:hover{background:#dc2626}
    .btn-success{background:#10b981;color:white}
    .btn-success:hover{background:#059669}
    .btn-sm{padding:0.25rem 0.75rem;font-size:0.75rem}
    .btn-ghost{background:transparent;color:#6b7280;border:1px solid #d1d5db}
    .btn-ghost:hover{background:#f9fafb}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{padding:0.75rem;text-align:left;border-bottom:1px solid #e5e7eb}
    .table th{background:#f9fafb;font-weight:500;color:#6b7280;font-size:0.875rem}
    .form-input{width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;margin-bottom:1rem;font-size:1rem;transition:border-color .2s}
    .form-input:focus{outline:none;border-color:#4f46e5}
    .form-select{width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;margin-bottom:1rem;font-size:1rem;background:white}
    .form-group{margin-bottom:1rem}
    .form-group label{display:block;margin-bottom:0.5rem;font-weight:500;color:#374151}
    .type-toggle{display:flex;gap:0.5rem;margin-bottom:1rem}
    .type-btn{flex:1;padding:0.75rem;border:2px solid;border-radius:0.5rem;cursor:pointer;font-weight:500;background:white;transition:all .2s}
    .type-btn.expense{border-color:#ef4444;color:#ef4444}
    .type-btn.expense.active{background:#fef2f2}
    .type-btn.income{border-color:#10b981;color:#10b981}
    .type-btn.income.active{background:#ecfdf5}
    .category-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:0.5rem;margin-bottom:1rem}
    .category-btn{padding:0.75rem 0.5rem;border:2px solid #e5e7eb;border-radius:0.5rem;cursor:pointer;background:white;text-align:center;position:relative;transition:all .2s}
    .category-btn:hover{border-color:#a5b4fc}
    .category-btn.selected{border-color:#4f46e5;background:#eef2ff}
    .category-btn .icon{font-size:1.5rem;display:block;margin-bottom:0.25rem}
    .category-btn .name{font-size:0.75rem;color:#374151}
    .category-btn .delete-icon{position:absolute;top:-8px;right:-8px;background:#ef4444;color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;cursor:pointer;display:none}
    .category-btn.custom .delete-icon{display:flex}
    .modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem}
    .modal{background:white;border-radius:1rem;padding:1.5rem;max-width:500px;width:100%;max-height:90vh;overflow-y:auto}
    .modal-title{font-size:1.25rem;font-weight:bold;margin-bottom:1.5rem}
    .modal-sm{max-width:400px}
    .fab{position:fixed;bottom:1.5rem;right:1.5rem;width:3.5rem;height:3.5rem;border-radius:50%;background:#4f46e5;color:white;border:none;font-size:2rem;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.4);transition:all .2s}
    .fab:hover{background:#4338ca;transform:scale(1.05)}
    .transaction-item{display:flex;align-items:center;justify-content:space-between;padding:1rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;transition:background .2s}
    .transaction-item:hover{background:#f3f4f6}
    .transaction-left{display:flex;align-items:center;gap:0.75rem}
    .transaction-icon{font-size:1.75rem}
    .transaction-amount{font-weight:bold}
    .transaction-amount.income{color:#10b981}
    .transaction-amount.expense{color:#ef4444}
    .empty-state{text-align:center;padding:3rem;color:#6b7280}
    .empty-state .emoji{font-size:3rem;margin-bottom:1rem;display:block}
    .budget-bar{width:100%;height:1rem;background:#e5e7eb;border-radius:0.5rem;overflow:hidden;margin-bottom:0.5rem}
    .budget-bar-fill{height:100%;background:#10b981;transition:width .3s;border-radius:0.5rem}
    .budget-bar-fill.yellow{background:#f59e0b}
    .budget-bar-fill.red{background:#ef4444}
    .badge{display:inline-block;padding:0.25rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:500}
    .badge-admin{background:#fef3c7;color:#92400e}
    .badge-user{background:#e0e7ff;color:#3730a3}
    .badge-pending{background:#fed7aa;color:#92400e}
    .badge-approved{background:#dcfce7;color:#166534}
    .badge-rejected{background:#fee2e2;color:#991b1b}
    .hidden{display:none!important}
    .sync-status{position:fixed;top:4.5rem;right:1rem;padding:0.5rem 1rem;border-radius:2rem;font-size:0.75rem;background:#dcfce7;color:#166534;z-index:50}
    .alert{padding:1rem;border-radius:0.5rem;margin-bottom:1rem}
    .alert-warning{background:#fef3c7;color:#92400e;border-left:4px solid #f59e0b}
    .alert-info{background:#dbeafe;color:#1e40af;border-left:4px solid #3b82f6}
    .icon-picker{display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;margin-bottom:0.5rem;max-height:220px;overflow-y:auto;padding:2px}
    .icon-picker-btn{padding:0.75rem;border:2px solid #e5e7eb;border-radius:0.5rem;cursor:pointer;background:white;font-size:1.5rem;transition:all .15s}
    .icon-picker-btn:hover{border-color:#a5b4fc;background:#f5f3ff;transform:scale(1.05)}
    .icon-picker-btn.selected{border-color:#4f46e5;background:#eef2ff;box-shadow:0 0 0 2px rgba(79,70,229,0.2)}
    .icon-preview{display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border:2px solid #e5e7eb;border-radius:0.5rem;margin-bottom:0.75rem;background:#f9fafb}
    .icon-preview-emoji{font-size:2rem}
    .icon-preview-text{font-size:0.875rem;color:#6b7280}
    .icon-hint{font-size:0.75rem;color:#9ca3af;margin-bottom:0.5rem;text-align:center}
    .pie-container{display:flex;align-items:center;gap:2rem;flex-wrap:wrap}
    .pie-chart{width:200px;height:200px;border-radius:50%;position:relative;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.1);transition:transform .2s}
    .pie-chart:hover{transform:scale(1.02)}
    .pie-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:90px;height:90px;background:white;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(0,0,0,0.05)}
    .pie-center-label{font-size:0.65rem;color:#6b7280}
    .pie-center-value{font-size:1rem;font-weight:bold;color:#1f2937}
    .pie-legend{flex:1;min-width:200px}
    .pie-legend-item{display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid #f3f4f6}
    .pie-legend-item:last-child{border-bottom:none}
    .pie-legend-color{width:12px;height:12px;border-radius:3px;flex-shrink:0}
    .pie-legend-name{flex:1;font-size:0.875rem;color:#374151}
    .pie-legend-pct{font-size:0.875rem;font-weight:600;color:#374151;min-width:40px;text-align:right}
    .pie-legend-amt{font-size:0.75rem;color:#9ca3af;min-width:70px;text-align:right}
    .bar-chart{display:flex;align-items:flex-end;gap:0.5rem;height:220px;padding:1rem 0;overflow-x:auto}
    .bar-group{display:flex;flex-direction:column;align-items:center;gap:0.25rem;flex:1;min-width:55px}
    .bar-bars{display:flex;align-items:flex-end;gap:3px;height:160px}
    .bar{width:18px;border-radius:4px 4px 0 0;transition:all .3s;cursor:pointer;position:relative}
    .bar:hover{opacity:0.8}
    .bar.income{background:#10b981}
    .bar.expense{background:#ef4444}
    .bar-label{font-size:0.7rem;color:#6b7280;margin-top:0.25rem}
    .bar-tooltip{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#1f2937;color:white;padding:4px 8px;border-radius:4px;font-size:0.65rem;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s;z-index:10}
    .bar:hover .bar-tooltip{opacity:1}
    .rank-list{display:flex;flex-direction:column;gap:0.5rem}
    .rank-item{display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:#f9fafb;border-radius:0.5rem;transition:background .2s}
    .rank-item:hover{background:#f3f4f6}
    .rank-num{width:1.5rem;height:1.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;flex-shrink:0}
    .rank-num.top1{background:#fde68a;color:#92400e}
    .rank-num.top2{background:#d1d5db;color:#374151}
    .rank-num.top3{background:#fcd9a0;color:#92400e}
    .rank-icon{font-size:1.25rem}
    .rank-name{flex:1;font-size:0.875rem;color:#374151}
    .rank-amount{font-weight:600;color:#ef4444;font-size:0.875rem;min-width:80px;text-align:right}
    .rank-bar-wrap{flex:1;max-width:120px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden}
    .rank-bar-fill{height:100%;border-radius:3px;background:#ef4444;transition:width .3s}
    .search-box{display:flex;gap:0.5rem;margin-bottom:1rem}
    .search-box input{flex:1}
    .search-result{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin-top:1rem}
    .search-stat-card{background:#f9fafb;border-radius:0.5rem;padding:1rem;text-align:center}
    .search-stat-card .icon{font-size:2rem;margin-bottom:0.5rem}
    .search-stat-card .name{font-size:0.8rem;color:#6b7280;margin-bottom:0.25rem}
    .search-stat-card .amount{font-size:1.1rem;font-weight:bold}
    .search-stat-card .count{font-size:0.7rem;color:#9ca3af}
    .search-no-result{text-align:center;padding:2rem;color:#9ca3af}
    .search-no-result .emoji{font-size:2.5rem;margin-bottom:0.5rem;display:block}
    .month-selector{display:flex;align-items:center;gap:0.5rem}
    .month-nav{background:white;border:1px solid #d1d5db;border-radius:0.5rem;padding:0.5rem 0.75rem;cursor:pointer;font-size:1rem;transition:all .2s;color:#374151}
    .month-nav:hover{background:#f3f4f6}
    .no-data-chart{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;color:#9ca3af}
    .no-data-chart .emoji{font-size:2.5rem;margin-bottom:0.5rem}
  </style>
</head>
<body>
<div id="login-page" class="login-container">
  <div class="login-box">
    <div class="login-logo">💰</div>
    <h1 class="login-title">记账助手</h1>
    <div class="login-tabs">
      <div class="login-tab active" data-tab="login">登录</div>
      <div class="login-tab" data-tab="register">注册</div>
      <div class="login-tab" data-tab="forgot">找回密码</div>
    </div>
    <form id="login-form" class="login-form active">
      <input type="text" id="login-username" class="login-input" placeholder="用户名" required>
      <input type="password" id="login-password" class="login-input" placeholder="密码" required>
      <button type="submit" class="login-btn">登录</button>
      <p class="login-error" id="login-error"></p>
    </form>
    <form id="register-form" class="login-form">
      <input type="text" id="reg-username" class="login-input" placeholder="用户名" required>
      <input type="password" id="reg-password" class="login-input" placeholder="密码（至少6位）" required minlength="6">
      <input type="password" id="reg-password2" class="login-input" placeholder="确认密码" required>
      <button type="submit" class="login-btn">注册</button>
      <p class="login-success" id="reg-success"></p>
      <p class="login-error" id="reg-error"></p>
    </form>
    <form id="forgot-form" class="login-form">
      <input type="text" id="forgot-username" class="login-input" placeholder="用户名" required>
      <input type="password" id="forgot-password" class="login-input" placeholder="新密码（至少6位）" required minlength="6">
      <input type="password" id="forgot-password2" class="login-input" placeholder="确认新密码" required>
      <button type="submit" class="login-btn">重置密码</button>
      <p class="login-success" id="forgot-success"></p>
      <p class="login-error" id="forgot-error"></p>
    </form>
    <p style="margin-top:1.5rem;text-align:center;color:#6b7280;font-size:0.75rem;">首次使用请先注册账号<br>管理员账号: admin / admin123</p>
  </div>
</div>

<div id="app-page" class="hidden">
  <nav class="navbar">
    <h1>
      <span>💰 记账助手</span>
      <div class="user-menu">
        <button class="user-btn" id="user-btn"><span id="current-username">用户</span><span>▼</span></button>
        <div class="user-dropdown" id="user-dropdown">
          <button id="btn-settings">⚙️ 设置</button>
          <button id="btn-admin" class="hidden">👥 用户管理</button>
          <button id="btn-logout">🚪 退出登录</button>
        </div>
      </div>
    </h1>
    <div class="nav-tabs">
      <button class="nav-tab active" data-tab="dashboard">概览</button>
      <button class="nav-tab" data-tab="transactions">记账</button>
      <button class="nav-tab" data-tab="statistics">📊 统计</button>
      <button class="nav-tab" data-tab="budget">预算</button>
      <button class="nav-tab" data-tab="export">导出</button>
    </div>
  </nav>
  <div class="sync-status" id="sync-status" style="display:none;">已同步</div>

  <main class="container">
    <div id="pending-alert" class="alert alert-warning hidden">⏳ 您的账号正在等待管理员审核，审核通过后即可使用所有功能。</div>

    <section id="dashboard" class="page">
      <div class="page-title"><span>月度概览</span><input type="month" id="dashboard-month" class="form-input" style="width:auto;"></div>
      <div class="stats-grid">
        <div class="stat-card green"><div class="stat-label">本月收入</div><div class="stat-value green" id="stat-income">¥0.00</div></div>
        <div class="stat-card red"><div class="stat-label">本月支出</div><div class="stat-value red" id="stat-expense">¥0.00</div></div>
        <div class="stat-card blue"><div class="stat-label">本月结余</div><div class="stat-value blue" id="stat-balance">¥0.00</div></div>
      </div>
      <div class="card"><div class="card-title">最近交易</div><div id="recent-transactions"></div></div>
    </section>

    <section id="transactions" class="page hidden">
      <div class="page-title">
        <span>记账</span>
        <div style="display:flex;gap:0.5rem;"><input type="month" id="transactions-month" class="form-input" style="width:auto;"><button class="btn btn-primary" id="btn-add-transaction">+ 添加</button></div>
      </div>
      <div class="card"><div id="transactions-list"></div></div>
    </section>

    <section id="statistics" class="page hidden">
      <div class="page-title">
        <span>📊 收支统计</span>
        <div class="month-selector">
          <button class="month-nav" id="stat-prev">‹</button>
          <input type="month" id="stat-month" class="form-input" style="width:auto;">
          <button class="month-nav" id="stat-next">›</button>
        </div>
      </div>
      <div class="card"><div class="card-title">💸 支出分布</div><div id="pie-chart-container"><div class="no-data-chart"><span class="emoji">📊</span><span>暂无支出数据</span></div></div></div>
      <div class="card">
        <div class="card-title">📈 月度收支对比</div>
        <div id="bar-chart-container"><div class="no-data-chart"><span class="emoji">📈</span><span>暂无数据</span></div></div>
        <div style="display:flex;gap:1.5rem;margin-top:0.75rem;font-size:0.8rem;">
          <span style="display:flex;align-items:center;gap:0.3rem;"><span style="width:12px;height:12px;background:#10b981;border-radius:2px;display:inline-block;"></span> 收入</span>
          <span style="display:flex;align-items:center;gap:0.3rem;"><span style="width:12px;height:12px;background:#ef4444;border-radius:2px;display:inline-block;"></span> 支出</span>
        </div>
      </div>
      <div class="card"><div class="card-title">🏆 消费排行</div><div id="ranking-container"><div class="no-data-chart"><span class="emoji">🏆</span><span>暂无支出数据</span></div></div></div>
      <div class="card">
        <div class="card-title">🔍 搜索统计</div>
        <div class="search-box">
          <input type="text" id="stats-search" class="form-input" placeholder="输入类别名称或关键词搜索，如：餐饮、工资...">
          <button class="btn btn-primary" id="btn-stats-search">搜索</button>
          <button class="btn btn-ghost" id="btn-stats-clear">清除</button>
        </div>
        <div id="search-results"><p style="color:#9ca3af;font-size:0.875rem;text-align:center;padding:1rem;">输入关键词后点击搜索</p></div>
      </div>
    </section>

    <section id="budget" class="page hidden">
      <div class="page-title">预算管理</div>
      <div class="card">
        <div class="card-title">月度预算</div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <input type="number" id="budget-input" class="form-input" placeholder="0.00" style="width:150px;">
          <span>元</span>
          <button class="btn btn-primary" id="btn-save-budget">保存</button>
        </div>
        <div id="budget-progress" class="hidden" style="margin-top:1rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;"><span>已使用</span><span id="budget-used">¥0 / ¥0</span></div>
          <div class="budget-bar"><div class="budget-bar-fill" id="budget-bar-fill"></div></div>
          <p id="budget-status" style="margin-top:0.5rem;font-size:0.875rem;"></p>
        </div>
      </div>
    </section>

    <section id="export" class="page hidden">
      <div class="page-title">数据导出</div>
      <div class="card">
        <div class="card-title">导出数据</div>
        <p id="export-info">共 0 条记录</p>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1rem;">
          <button class="btn btn-primary" id="btn-export-csv">📊 CSV</button>
          <button class="btn btn-primary" id="btn-export-json">📄 JSON</button>
          <button class="btn btn-primary" id="btn-export-html">📈 Excel</button>
        </div>
      </div>
    </section>

    <section id="admin" class="page hidden">
      <div class="page-title"><span>用户管理</span><button class="btn btn-primary btn-sm" id="btn-add-user">+ 添加用户</button></div>
      <div class="card"><div class="card-title">⏳ 待审核注册申请</div><div id="pending-users-list"></div></div>
      <div class="card"><div class="card-title">✅ 已批准用户</div><div id="users-list"></div></div>
    </section>

    <section id="settings" class="page hidden">
      <div class="page-title">设置</div>
      <div class="card">
        <div class="card-title">📁 自定义类别</div>
        <div style="margin-bottom:1.5rem;">
          <h4 style="margin-bottom:0.75rem;font-weight:600;">支出类别</h4>
          <div class="category-grid" id="custom-expense-grid"></div>
          <button class="btn btn-primary btn-sm" id="btn-add-expense-category">+ 添加支出类别</button>
        </div>
        <div>
          <h4 style="margin-bottom:0.75rem;font-weight:600;">收入类别</h4>
          <div class="category-grid" id="custom-income-grid"></div>
          <button class="btn btn-primary btn-sm" id="btn-add-income-category">+ 添加收入类别</button>
        </div>
      </div>
      <div class="card" id="admin-categories" style="display:none;">
        <div class="card-title">🔧 全局默认类别（管理员）</div>
        <p style="color:#6b7280;margin-bottom:1rem;font-size:0.875rem;">设置所有新用户的默认类别</p>
        <div style="margin-bottom:1.5rem;">
          <h4 style="margin-bottom:0.75rem;font-weight:600;">支出类别</h4>
          <div class="category-grid" id="admin-expense-grid"></div>
          <button class="btn btn-primary btn-sm" id="btn-admin-add-expense">+ 添加</button>
        </div>
        <div>
          <h4 style="margin-bottom:0.75rem;font-weight:600;">收入类别</h4>
          <div class="category-grid" id="admin-income-grid"></div>
          <button class="btn btn-primary btn-sm" id="btn-admin-add-income">+ 添加</button>
        </div>
      </div>
    </section>
  </main>
  <button class="fab hidden" id="fab-add">+</button>
</div>

<!-- 交易模态框 -->
<div class="modal-overlay hidden" id="modal">
  <div class="modal">
    <h3 class="modal-title" id="modal-title">添加记录</h3>
    <form id="transaction-form">
      <input type="hidden" id="transaction-id">
      <div class="type-toggle">
        <button type="button" class="type-btn expense active" data-type="expense">支出</button>
        <button type="button" class="type-btn income" data-type="income">收入</button>
      </div>
      <input type="number" step="0.01" id="amount" class="form-input" placeholder="金额" required>
      <div class="category-grid" id="category-grid"></div>
      <input type="date" id="date" class="form-input" required>
      <input type="text" id="note" class="form-input" placeholder="备注（可选）">
      <div style="display:flex;gap:0.5rem;">
        <button type="button" class="btn" style="flex:1;background:#e5e7eb;" id="btn-cancel">取消</button>
        <button type="submit" class="btn btn-primary" style="flex:1;">保存</button>
      </div>
    </form>
  </div>
</div>

<!-- 用户模态框 -->
<div class="modal-overlay hidden" id="user-modal">
  <div class="modal modal-sm">
    <h3 class="modal-title" id="user-modal-title">添加用户</h3>
    <form id="user-form">
      <input type="hidden" id="edit-user-id">
      <input type="text" id="new-username" class="form-input" placeholder="用户名" required>
      <input type="password" id="new-password" class="form-input" placeholder="密码（留空则不修改）">
      <select id="new-role" class="form-select">
        <option value="user">普通用户</option>
        <option value="admin">管理员</option>
      </select>
      <div style="display:flex;gap:0.5rem;">
        <button type="button" class="btn" style="flex:1;background:#e5e7eb;" id="btn-user-cancel">取消</button>
        <button type="submit" class="btn btn-primary" style="flex:1;">保存</button>
      </div>
    </form>
  </div>
</div>

<!-- 添加自定义类别模态框 [修复：图标点击即选中+确定/取消按钮] -->
<div class="modal-overlay hidden" id="category-modal">
  <div class="modal modal-sm">
    <h3 class="modal-title">添加自定义类别</h3>
    <form id="category-form">
      <input type="hidden" id="category-type">
      <div class="form-group">
        <label>类别名称</label>
        <input type="text" id="category-name" class="form-input" placeholder="例如：外卖" required>
      </div>
      <div class="form-group">
        <label>选择图标</label>
        <p class="icon-hint">点击图标直接选中，再点击"添加"按钮确认</p>
        <div class="icon-picker" id="icon-picker"></div>
      </div>
      <!-- 已选图标预览 -->
      <div class="icon-preview" id="icon-preview" style="display:none;">
        <span class="icon-preview-emoji" id="preview-emoji">🍔</span>
        <span class="icon-preview-text">已选择：<strong id="preview-name"></strong></span>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
        <button type="button" class="btn" style="flex:1;background:#e5e7eb;" id="btn-category-cancel">取消</button>
        <button type="submit" class="btn btn-primary" style="flex:1;" id="btn-category-confirm">添加</button>
      </div>
    </form>
  </div>
</div>

<script>
// ==================== 配置 ====================
const SUPABASE_URL = 'https://nvqqfmvtyqzxxcgoeriv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cXFmbXZ0eXF6eHhjZ29lcml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTAyODIsImV4cCI6MjA4OTg2NjI4Mn0.PoZYNU7ShemdTA_HCAK3Sp9t2OfswFI9ttmsVeE98T0';

const DEFAULT_CATEGORIES = {
  income: [
    {id:'salary',name:'工资',icon:'💰'},{id:'parttime',name:'兼职',icon:'💼'},
    {id:'investment',name:'投资',icon:'📈'},{id:'gift',name:'礼金',icon:'🎁'},
    {id:'other_income',name:'其他',icon:'💵'}
  ],
  expense: [
    {id:'food',name:'餐饮',icon:'🍔'},{id:'transport',name:'交通',icon:'🚗'},
    {id:'shopping',name:'购物',icon:'🛒'},{id:'living',name:'居住',icon:'🏠'},
    {id:'health',name:'医疗',icon:'💊'},{id:'education',name:'教育',icon:'📚'},
    {id:'entertainment',name:'娱乐',icon:'🎮'},{id:'social',name:'社交',icon:'🤝'},
    {id:'other_expense',name:'其他',icon:'📦'}
  ]
};

const ICON_PICKER = ['🍔','🍕','🍜','🍱','🍰','🍷','🚗','🚕','🚌','🚎','🏠','🏢','🏪','🏫','🏥','💊','💉','📚','📖','✏️','🎮','🎬','🎤','🎧','🎨','🎭','🎪','🎯','⚽','🏀','🎾','🏐','🏈','⛳','🎳','🚴','🏃','🤸','🧘','💼','👔','👗','👠','👜','💄','💍','⌚','👓','🎒','🧳','📱','💻','⌨️','🖱️','🖨️','📷','📹','🎥','📺','📻','☎️','📞','📟','📠','💾','💿','📀','🎞️','📽️'];

const PIE_COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7','#fb7185'];

// ==================== 状态 ====================
let currentUser = null;
let transactions = [];
let budgets = {total:0};
let currentTab = 'dashboard';
let currentType = 'expense';
let selectedCategory = 'food';
let editingId = null;
let categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
let customCategories = {income:[],expense:[]};
let adminCategories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
let selectedIcon = '🍔';
let categoryModalType = 'expense';

// ==================== 工具函数 ====================
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const formatCurrency = amount => '¥' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const formatDate = date => new Date(date).toLocaleDateString('zh-CN');
const getCurrentMonth = () => {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
};
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const simpleHash = str => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(16);
};
const getPrevMonth = ym => {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return (y - 1) + '-12';
  return y + '-' + String(m - 1).padStart(2, '0');
};
const getNextMonth = ym => {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return (y + 1) + '-01';
  return y + '-' + String(m + 1).padStart(2, '0');
};
const monthLabel = ym => {
  const [y, m] = ym.split('-');
  return parseInt(m) + '月';
};

// ==================== API ====================
const api = {
  async request(method, table, data = null, params = '') {
    try {
      const options = {
        method,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': method === 'POST' ? 'return=representation' : ''
        }
      };
      if (data) options.body = JSON.stringify(data);
      const url = SUPABASE_URL + '/rest/v1/' + table + params;
      const res = await fetch(url, options);
      const text = await res.text();
      if (!text) return method === 'DELETE' ? [] : null;
      try { return JSON.parse(text); } catch { return text; }
    } catch (err) { console.error('API Error:', err); throw err; }
  },
  get: (table, params) => api.request('GET', table, null, params),
  post: (table, data) => api.request('POST', table, data),
  put: (table, data, params) => api.request('PUT', table, data, params),
  delete: (table, params) => api.request('DELETE', table, null, params)
};

// ==================== 认证 ====================
const checkAuth = () => {
  const saved = localStorage.getItem('currentUser');
  if (saved) { currentUser = JSON.parse(saved); return true; }
  return false;
};

const showApp = () => {
  $('#login-page').classList.add('hidden');
  $('#app-page').classList.remove('hidden');
  $('#current-username').textContent = currentUser.username;
  if (currentUser.status === 'pending') {
    $('#pending-alert').classList.remove('hidden');
  } else {
    $('#pending-alert').classList.add('hidden');
  }
  if (currentUser.role === 'admin') {
    $('#btn-admin').classList.remove('hidden');
    $('#admin-categories').style.display = 'block';
    if (!$('[data-tab="admin"]').length) {
      const tab = document.createElement('button');
      tab.className = 'nav-tab';
      tab.dataset.tab = 'admin';
      tab.textContent = '用户管理';
      $('.nav-tabs').appendChild(tab);
    }
  }
  initApp();
};

const showLogin = () => {
  $('#login-page').classList.remove('hidden');
  $('#app-page').classList.add('hidden');
  currentUser = null; transactions = [];
};

const login = async (username, password) => {
  try {
    const data = await api.get('users', '?username=eq.' + username);
    if (!data || data.length === 0) return {success: false, error: '用户不存在'};
    const user = data[0];
    if (user.password !== simpleHash(password)) return {success: false, error: '密码错误'};
    if (user.status === 'pending') return {success: false, error: '账号待审核，请联系管理员'};
    if (user.status === 'rejected') return {success: false, error: '注册申请已被拒绝'};
    currentUser = {id: user.id, username: user.username, role: user.role, status: user.status};
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    return {success: true};
  } catch (err) { return {success: false, error: '登录失败，请检查网络'}; }
};

const register = async (username, password) => {
  try {
    const existing = await api.get('users', '?username=eq.' + username);
    if (existing && existing.length > 0) return {success: false, error: '用户名已存在'};
    await api.post('users', {
      id: generateId(), username,
      password: simpleHash(password),
      role: 'user', status: 'pending',
      created_at: new Date().toISOString()
    });
    return {success: true};
  } catch (err) { return {success: false, error: '注册失败，请检查数据库配置'}; }
};

const resetPassword = async (username, newPassword) => {
  try {
    const data = await api.get('users', '?username=eq.' + username);
    if (!data || data.length === 0) return {success: false, error: '用户不存在'};
    await api.put('users', {password: simpleHash(newPassword)}, '?id=eq.' + data[0].id);
    return {success: true};
  } catch (err) { return {success: false, error: '重置失败，请检查网络'}; }
};

const logout = () => {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('transactions');
  localStorage.removeItem('budgets');
  localStorage.removeItem('customCategories');
  showLogin();
};

// ==================== 数据 ====================
const loadData = async () => {
  if (!currentUser) return;
  try {
    const tx = await api.get('transactions', '?user_id=eq.' + currentUser.id + '&order=date.desc');
    transactions = tx || [];
    localStorage.setItem('transactions', JSON.stringify(transactions));
    const budgetData = await api.get('budgets', '?user_id=eq.' + currentUser.id + '&limit=1');
    if (budgetData && budgetData.length > 0) {
      budgets = {total: budgetData[0].total || 0};
      localStorage.setItem('budgets', JSON.stringify(budgets));
    }
    const customCatData = await api.get('custom_categories', '?user_id=eq.' + currentUser.id);
    if (customCatData && customCatData.length > 0) {
      customCategories = {income:[], expense:[]};
      customCatData.forEach(cat => {
        customCategories[cat.type].push({id: cat.id, name: cat.name, icon: cat.icon, custom: true});
      });
      localStorage.setItem('customCategories', JSON.stringify(customCategories));
      mergeCategories();
    }
  } catch (err) {
    transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    budgets = JSON.parse(localStorage.getItem('budgets') || '{"total":0}');
    customCategories = JSON.parse(localStorage.getItem('customCategories') || '{"income":[],"expense":[]}');
    mergeCategories();
  }
};

const mergeCategories = () => {
  categories = {
    income: [...DEFAULT_CATEGORIES.income, ...customCategories.income],
    expense: [...DEFAULT_CATEGORIES.expense, ...customCategories.expense]
  };
};

const saveTransaction = async (data) => {
  const tx = {...data, user_id: currentUser.id};
  try {
    if (editingId) {
      await api.put('transactions', tx, '?id=eq.' + editingId);
      transactions = transactions.map(t => t.id === editingId ? {...tx, id: editingId} : t);
    } else {
      tx.id = generateId();
      await api.post('transactions', tx);
      transactions.unshift(tx);
    }
    localStorage.setItem('transactions', JSON.stringify(transactions));
    closeModal();
    renderCurrentPage();
    alert('保存成功');
  } catch (err) {
    if (editingId) {
      transactions = transactions.map(t => t.id === editingId ? {...tx, id: editingId} : t);
    } else {
      tx.id = generateId(); transactions.unshift(tx);
    }
    localStorage.setItem('transactions', JSON.stringify(transactions));
    closeModal();
    renderCurrentPage();
    alert('已保存到本地');
  }
};

const deleteTransaction = async (id) => {
  if (!confirm('确定删除？')) return;
  try {
    await api.delete('transactions', '?id=eq.' + id);
    transactions = transactions.filter(t => t.id !== id);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    renderCurrentPage();
  } catch (err) {
    transactions = transactions.filter(t => t.id !== id);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    renderCurrentPage();
  }
};

const addCustomCategory = async (type, name, icon) => {
  try {
    const catId = generateId();
    await api.post('custom_categories', {id: catId, user_id: currentUser.id, type, name, icon});
    customCategories[type].push({id: catId, name, icon, custom: true});
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
    mergeCategories();
    renderSettings();
  } catch (err) {
    customCategories[type].push({id: generateId(), name, icon, custom: true});
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
    mergeCategories();
    renderSettings();
  }
};

const deleteCustomCategory = async (type, id) => {
  if (!confirm('确定删除此类别？')) return;
  try {
    await api.delete('custom_categories', '?id=eq.' + id);
    customCategories[type] = customCategories[type].filter(c => c.id !== id);
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
    mergeCategories();
    renderSettings();
  } catch (err) {
    customCategories[type] = customCategories[type].filter(c => c.id !== id);
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
    mergeCategories();
    renderSettings();
  }
};

// ==================== 渲染 ====================
const renderCategories = type => {
  const grid = $('#category-grid');
  grid.innerHTML = categories[type].map(cat =>
    '<button type="button" class="category-btn ' + (cat.id === selectedCategory ? 'selected' : '') + '" data-id="' + cat.id + '">' +
    '<span class="icon">' + cat.icon + '</span><span class="name">' + cat.name + '</span></button>'
  ).join('');
  grid.querySelectorAll('.category-btn').forEach(btn => {
    btn.onclick = () => {
      grid.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCategory = btn.dataset.id;
    };
  });
};

const renderCustomCategories = (type, containerId) => {
  const grid = $(containerId);
  const cats = categories[type];
  grid.innerHTML = cats.map(cat =>
    '<div class="category-btn ' + (cat.custom ? 'custom' : '') + '">' +
    '<span class="icon">' + cat.icon + '</span><span class="name">' + cat.name + '</span>' +
    (cat.custom ? '<div class="delete-icon" onclick="deleteCustomCategory(\'' + type + '\',\'' + cat.id + '\')">×</div>' : '') +
    '</div>'
  ).join('');
};

const renderDashboard = () => {
  const month = $('#dashboard-month').value || getCurrentMonth();
  const monthly = transactions.filter(t => t.date.startsWith(month));
  const income = monthly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  $('#stat-income').textContent = formatCurrency(income);
  $('#stat-expense').textContent = formatCurrency(expense);
  $('#stat-balance').textContent = formatCurrency(income - expense);
  const recent = monthly.slice(-5).reverse();
  $('#recent-transactions').innerHTML = recent.length === 0
    ? '<p class="empty-state"><span class="emoji">📭</span>暂无记录</p>'
    : recent.map(t => {
      const cat = categories[t.type].find(c => c.id === t.category);
      return '<div class="transaction-item"><div class="transaction-left"><span class="transaction-icon">' + (cat?.icon || '📝') + '</span><span>' + (cat?.name || t.category) + '</span></div><div><span class="transaction-amount ' + t.type + '">' + (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount) + '</span> <button class="btn btn-sm" style="margin-left:0.5rem;" onclick="deleteTransaction(\'' + t.id + '\')">删除</button></div></div>';
    }).join('');
};

const renderTransactions = () => {
  const month = $('#transactions-month').value || getCurrentMonth();
  const monthly = transactions.filter(t => t.date.startsWith(month)).reverse();
  $('#transactions-list').innerHTML = monthly.length === 0
    ? '<p class="empty-state"><span class="emoji">📭</span>暂无记录</p>'
    : '<table class="table"><thead><tr><th>日期</th><th>类别</th><th>金额</th><th></th></tr></thead><tbody>' +
      monthly.map(t => {
        const cat = categories[t.type].find(c => c.id === t.category);
        return '<tr><td>' + formatDate(t.date) + '</td><td>' + (cat?.icon || '') + ' ' + (cat?.name || t.category) + '</td><td class="transaction-amount ' + t.type + '">' + (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount) + '</td><td><button class="btn btn-sm btn-danger" onclick="deleteTransaction(\'' + t.id + '\')">删除</button></td></tr>';
      }).join('') + '</tbody></table>';
};

const renderBudget = () => {
  const month = getCurrentMonth();
  const monthly = transactions.filter(t => t.date.startsWith(month));
  const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  $('#budget-input').value = budgets.total || '';
  if (budgets.total > 0) {
    $('#budget-progress').classList.remove('hidden');
    const pct = Math.min(100, (expense / budgets.total) * 100);
    $('#budget-used').textContent = formatCurrency(expense) + ' / ' + formatCurrency(budgets.total);
    const bar = $('#budget-bar-fill');
    bar.style.width = pct + '%';
    bar.className = 'budget-bar-fill' + (pct > 100 ? ' red' : pct > 80 ? ' yellow' : '');
    const remaining = budgets.total - expense;
    $('#budget-status').textContent = remaining >= 0 ? '剩余 ' + formatCurrency(remaining) : '已超支 ' + formatCurrency(-remaining);
  } else {
    $('#budget-progress').classList.add('hidden');
  }
};

const renderExport = () => {
  $('#export-info').textContent = '共 ' + transactions.length + ' 条记录';
};

const renderSettings = () => {
  renderCustomCategories('expense', 'custom-expense-grid');
  renderCustomCategories('income', 'custom-income-grid');
  if (currentUser?.role === 'admin') {
    renderCustomCategories('expense', 'admin-expense-grid');
    renderCustomCategories('income', 'admin-income-grid');
  }
};

// ==================== 统计图表 ====================
const renderPieChart = (month) => {
  const container = $('#pie-chart-container');
  const monthly = transactions.filter(t => t.date.startsWith(month) && t.type === 'expense');
  if (monthly.length === 0) {
    container.innerHTML = '<div class="no-data-chart"><span class="emoji">📊</span><span>暂无支出数据</span></div>';
    return;
  }
  const map = {};
  monthly.forEach(t => {
    if (!map[t.category]) map[t.category] = 0;
    map[t.category] += t.amount;
  });
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const wedges = [];
  let startAngle = 0;
  sorted.forEach(([catId, amt], i) => {
    const pct = amt / total;
    const angle = pct * 360;
    wedges.push({catId, amt, pct, startAngle, angle, color: PIE_COLORS[i % PIE_COLORS.length]});
    startAngle += angle;
  });
  // Build conic-gradient
  const gradients = wedges.map(w => w.color + ' ' + w.startAngle + 'deg ' + (w.startAngle + w.angle) + 'deg');
  container.innerHTML =
    '<div class="pie-container">' +
      '<div class="pie-chart" style="background:conic-gradient(' + gradients.join(',') + ');">' +
        '<div class="pie-center"><span class="pie-center-label">支出合计</span><span class="pie-center-value">' + formatCurrency(total) + '</span></div>' +
      '</div>' +
      '<div class="pie-legend">' +
        wedges.map((w, i) => {
          const cat = categories.expense.find(c => c.id === w.catId) || {name: w.catId, icon: '📦'};
          return '<div class="pie-legend-item">' +
            '<div class="pie-legend-color" style="background:' + w.color + '"></div>' +
            '<span class="pie-legend-name">' + cat.icon + ' ' + cat.name + '</span>' +
            '<span class="pie-legend-pct">' + (w.pct * 100).toFixed(1) + '%</span>' +
            '<span class="pie-legend-amt">' + formatCurrency(w.amt) + '</span>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
};

const renderBarChart = () => {
  const container = $('#bar-chart-container');
  const months = [];
  let ym = getCurrentMonth();
  for (let i = 5; i >= 0; i--) {
    let m = new Date();
    m.setMonth(m.getMonth() - i);
    months.push(m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0'));
  }
  const data = months.map(m => {
    const monthTx = transactions.filter(t => t.date.startsWith(m));
    return {
      ym: m,
      income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    };
  });
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
  container.innerHTML =
    '<div class="bar-chart">' +
      data.map(d =>
        '<div class="bar-group">' +
          '<div class="bar-bars">' +
            '<div class="bar income" style="height:' + (d.income / maxVal * 150) + 'px;"><div class="bar-tooltip">收入 ' + formatCurrency(d.income) + '</div></div>' +
            '<div class="bar expense" style="height:' + (d.expense / maxVal * 150) + 'px;"><div class="bar-tooltip">支出 ' + formatCurrency(d.expense) + '</div></div>' +
          '</div>' +
          '<span class="bar-label">' + monthLabel(d.ym) + '</span>' +
        '</div>'
      ).join('') +
    '</div>';
};

const renderRanking = (month) => {
  const container = $('#ranking-container');
  const monthly = transactions.filter(t => t.date.startsWith(month) && t.type === 'expense');
  if (monthly.length === 0) {
    container.innerHTML = '<div class="no-data-chart"><span class="emoji">🏆</span><span>暂无支出数据</span></div>';
    return;
  }
  const map = {};
  monthly.forEach(t => {
    if (!map[t.category]) map[t.category] = 0;
    map[t.category] += t.amount;
  });
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  container.innerHTML =
    '<div class="rank-list">' +
      sorted.map(([catId, amt], i) => {
        const cat = categories.expense.find(c => c.id === catId) || {name: catId, icon: '📦'};
        const pct = (amt / total * 100).toFixed(1);
        const topClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
        return '<div class="rank-item">' +
          '<div class="rank-num ' + topClass + '">' + (i + 1) + '</div>' +
          '<span class="rank-icon">' + cat.icon + '</span>' +
          '<span class="rank-name">' + cat.name + '</span>' +
          '<div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="rank-amount">' + formatCurrency(amt) + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
};

const renderSearch = () => {
  const keyword = $('#stats-search').value.trim().toLowerCase();
  const container = $('#search-results');
  if (!keyword) {
    container.innerHTML = '<p style="color:#9ca3af;font-size:0.875rem;text-align:center;padding:1rem;">输入关键词后点击搜索</p>';
    return;
  }
  // 按类别搜索
  const matchedCats = categories.expense.filter(c =>
    c.name.toLowerCase().includes(keyword) || c.icon.includes(keyword)
  ).concat(categories.income.filter(c => c.name.toLowerCase().includes(keyword) || c.icon.includes(keyword)));
  // 搜索所有交易
  const matched = transactions.filter(t => {
    const cat = categories[t.type].find(c => c.id === t.category);
    return t.note?.toLowerCase().includes(keyword) ||
      cat?.name.toLowerCase().includes(keyword) ||
      String(t.amount).includes(keyword) ||
      t.date.includes(keyword);
  });
  if (matchedCats.length === 0 && matched.length === 0) {
    container.innerHTML = '<div class="search-no-result"><span class="emoji">🔍</span><span>未找到匹配"' + keyword + '"的记录</span></div>';
    return;
  }
  // 汇总匹配类别的统计
  const catStats = {};
  matched.forEach(t => {
    if (!catStats[t.category]) catStats[t.category] = {amount: 0, count: 0, type: t.type};
    catStats[t.category].amount += t.amount;
    catStats[t.category].count++;
  });
  let html = '';
  if (Object.keys(catStats).length > 0) {
    const totalAmt = Object.values(catStats).reduce((s, v) => s + v.amount, 0);
    const totalCnt = Object.values(catStats).reduce((s, v) => s + v.count, 0);
    html += '<div style="margin-bottom:1rem;"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;text-align:center;">' +
      '<div class="search-stat-card"><div class="amount" style="color:#1f2937;">' + formatCurrency(totalAmt) + '</div><div class="count">涉及金额</div></div>' +
      '<div class="search-stat-card"><div class="amount" style="color:#ef4444;">' + totalCnt + ' 笔</div><div class="count">交易记录</div></div>' +
      '<div class="search-stat-card"><div class="amount" style="color:#3b82f6;">' + Object.keys(catStats).length + ' 类</div><div class="count">涉及类别</div></div>' +
    '</div></div>';
  }
  html += '<div class="search-result">';
  Object.entries(catStats).forEach(([catId, stat]) => {
    const cat = categories[stat.type].find(c => c.id === catId) || {name: catId, icon: '📦'};
    html += '<div class="search-stat-card">' +
      '<div class="icon">' + cat.icon + '</div>' +
      '<div class="name">' + cat.name + '</div>' +
      '<div class="amount" style="color:' + (stat.type === 'expense' ? '#ef4444' : '#10b981') + '">' + formatCurrency(stat.amount) + '</div>' +
      '<div class="count">' + stat.count + ' 笔</div>' +
    '</div>';
  });
  // 显示匹配的交易明细
  if (matched.length > 0) {
    html += '</div><div style="margin-top:1rem;"><p style="font-weight:600;color:#374151;margin-bottom:0.5rem;">匹配记录（最近20条）</p>';
    html += '<table class="table"><thead><tr><th>日期</th><th>类别</th><th>金额</th><th>备注</th></tr></thead><tbody>';
    matched.slice(0, 20).forEach(t => {
      const cat = categories[t.type].find(c => c.id === t.category);
      html += '<tr><td>' + formatDate(t.date) + '</td><td>' + (cat?.icon || '') + ' ' + (cat?.name || t.category) + '</td><td class="transaction-amount ' + t.type + '">' + (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount) + '</td><td>' + (t.note || '-') + '</td></tr>';
    });
    html += '</tbody></table>';
    if (matched.length > 20) html += '<p style="color:#9ca3af;font-size:0.75rem;margin-top:0.5rem;">还有 ' + (matched.length - 20) + ' 条记录...</p>';
  }
  container.innerHTML = html + '</div>';
};

const renderStatistics = () => {
  const month = $('#stat-month').value || getCurrentMonth();
  renderPieChart(month);
  renderBarChart();
  renderRanking(month);
};

const renderAdmin = async () => {
  if (currentUser?.role !== 'admin') return;
  try {
    const users = await api.get('users', '?order=created_at.desc');
    const allTx = await api.get('transactions', '?order=date.desc');
    const pendingUsers = users ? users.filter(u => u.status === 'pending') : [];
    $('#pending-users-list').innerHTML = pendingUsers.length > 0
      ? '<table class="table"><thead><tr><th>用户名</th><th>注册时间</th><th>操作</th></tr></thead><tbody>' +
        pendingUsers.map(u => '<tr><td>' + u.username + '</td><td>' + formatDate(u.created_at) + '</td><td><button class="btn btn-sm btn-success" onclick="approveUser(\'' + u.id + '\')">通过</button> <button class="btn btn-sm btn-danger" onclick="rejectUser(\'' + u.id + '\')">拒绝</button></td></tr>').join('') + '</tbody></table>'
      : '<p class="empty-state"><span class="emoji">✅</span>暂无待审核用户</p>';
    const approvedUsers = users ? users.filter(u => u.status !== 'pending' && u.status !== 'rejected') : [];
    $('#users-list').innerHTML = approvedUsers.length > 0
      ? '<table class="table"><thead><tr><th>用户名</th><th>角色</th><th>记账数</th><th>操作</th></tr></thead><tbody>' +
        approvedUsers.map(u => {
          const userTxCount = allTx ? allTx.filter(t => t.user_id === u.id).length : 0;
          return '<tr><td>' + u.username + '</td><td><span class="badge ' + (u.role === 'admin' ? 'badge-admin' : 'badge-user') + '">' + (u.role === 'admin' ? '管理员' : '用户') + '</span></td><td>' + userTxCount + ' 条</td><td><button class="btn btn-sm" onclick="editUser(\'' + u.id + '\')">编辑</button> <button class="btn btn-sm btn-danger" onclick="deleteUser(\'' + u.id + '\')" ' + (u.id === currentUser.id ? 'disabled' : '') + '>删除</button></td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="empty-state"><span class="emoji">👥</span>暂无用户</p>';
    if (allTx && allTx.length > 0) {
      $('#users-list').innerHTML += '<div style="margin-top:1.5rem;">