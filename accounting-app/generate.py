import os

html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>记账助手</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;min-height:100vh}
    .login-container{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;background:linear-gradient(135deg,#4f46e5,#7c3aed)}
    .login-box{background:white;border-radius:1rem;padding:2rem;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
    .login-logo{text-align:center;font-size:3rem;margin-bottom:1rem}
    .login-title{text-align:center;font-size:1.5rem;font-weight:bold;color:#1f2937;margin-bottom:2rem}
    .login-tabs{display:flex;margin-bottom:1.5rem;border-bottom:2px solid #e5e7eb}
    .login-tab{flex:1;padding:0.75rem;text-align:center;cursor:pointer;color:#6b7280;border-bottom:2px solid transparent;margin-bottom:-2px}
    .login-tab.active{color:#4f46e5;border-bottom-color:#4f46e5;font-weight:500}
    .login-form{display:none}
    .login-form.active{display:block}
    .login-input{width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;margin-bottom:1rem;font-size:1rem}
    .login-btn{width:100%;padding:0.75rem;background:#4f46e5;color:white;border:none;border-radius:0.5rem;font-size:1rem;cursor:pointer}
    .login-error{color:#ef4444;font-size:0.875rem;text-align:center;display:none}
    .login-success{color:#10b981;font-size:0.875rem;text-align:center;display:none}
    .navbar{background:#4f46e5;color:white;padding:1rem;position:sticky;top:0;z-index:100}
    .navbar h1{font-size:1.25rem;margin-bottom:0.75rem;display:flex;justify-content:space-between;align-items:center}
    .nav-tabs{display:flex;gap:0.5rem;flex-wrap:wrap}
    .nav-tab{padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;background:transparent;color:white;border:none}
    .nav-tab.active{background:white;color:#4f46e5;font-weight:500}
    .user-menu{position:relative}
    .user-btn{background:rgba(255,255,255,0.2);padding:0.5rem 1rem;border-radius:2rem;cursor:pointer;border:none;color:white}
    .user-dropdown{position:absolute;top:100%;right:0;margin-top:0.5rem;background:white;border-radius:0.5rem;box-shadow:0 10px 40px rgba(0,0,0,0.15);min-width:150px;display:none}
    .user-dropdown.show{display:block}
    .user-dropdown button{width:100%;padding:0.75rem 1rem;border:none;background:none;text-align:left;cursor:pointer;color:#374151}
    .user-dropdown button:hover{background:#f3f4f6}
    .container{max-width:1000px;margin:0 auto;padding:1rem}
    .page-title{font-size:1.5rem;font-weight:bold;color:#1f2937;margin-bottom:1rem;display:flex;justify-content:space-between}
    .card{background:white;border-radius:0.75rem;padding:1.5rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
    .card-title{font-size:1.125rem;font-weight:600;color:#1f2937;margin-bottom:1rem}
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1rem}
    .stat-card{background:white;border-radius:0.75rem;padding:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-left:4px solid}
    .stat-card.green{border-left-color:#10b981}
    .stat-card.red{border-left-color:#ef4444}
    .stat-card.blue{border-left-color:#3b82f6}
    .stat-label{color:#6b7280;font-size:0.875rem;margin-bottom:0.25rem}
    .stat-value{font-size:1.5rem;font-weight:bold}
    .stat-value.green{color:#10b981}
    .stat-value.red{color:#ef4444}
    .stat-value.blue{color:#3b82f6}
    .btn{padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;border:none;font-weight:500;font-size:0.875rem}
    .btn-primary{background:#4f46e5;color:white}
    .btn-danger{background:#ef4444;color:white}
    .btn-secondary{background:#e5e7eb;color:#374151}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{padding:0.75rem;text-align:left;border-bottom:1px solid #e5e7eb}
    .form-input{width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;margin-bottom:1rem;font-size:1rem}
    .type-toggle{display:flex;gap:0.5rem;margin-bottom:1rem}
    .type-btn{flex:1;padding:0.75rem;border:2px solid;border-radius:0.5rem;cursor:pointer;background:white;font-weight:500}
    .type-btn.expense{border-color:#ef4444;color:#ef4444}
    .type-btn.expense.active{background:#fef2f2}
    .type-btn.income{border-color:#10b981;color:#10b981}
    .type-btn.income.active{background:#ecfdf5}
    .category-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:0.5rem;margin-bottom:1rem}
    .category-btn{padding:0.75rem 0.5rem;border:2px solid #e5e7eb;border-radius:0.5rem;cursor:pointer;background:white;text-align:center}
    .category-btn.selected{border-color:#4f46e5;background:#eef2ff}
    .modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem}
    .modal{background:white;border-radius:1rem;padding:1.5rem;max-width:500px;width:100%}
    .modal-title{font-size:1.25rem;font-weight:bold;margin-bottom:1.5rem}
    .fab{position:fixed;bottom:1.5rem;right:1.5rem;width:3.5rem;height:3.5rem;border-radius:50%;background:#4f46e5;color:white;border:none;font-size:2rem;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.4)}
    .hidden{display:none!important}
    .alert{padding:1rem;border-radius:0.5rem;margin-bottom:1rem}
    .alert-warning{background:#fef3c7;color:#92400e}
    .badge{display:inline-block;padding:0.25rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:500}
    .badge-pending{background:#fee2e2;color:#991b1b}
    .badge-approved{background:#dcfce7;color:#166534}
    .icon-picker{display:grid;grid-template-columns:repeat(8,1fr);gap:0.5rem;max-height:200px;overflow-y:auto;padding:0.5rem;border:1px solid #e5e7eb;border-radius:0.5rem;margin-bottom:1rem}
    .icon-option{padding:0.5rem;text-align:center;cursor:pointer;border-radius:0.25rem;font-size:1.5rem}
    .icon-option.selected{background:#4f46e5;color:white}
    .budget-bar{width:100%;height:1rem;background:#e5e7eb;border-radius:0.5rem;overflow:hidden;margin-bottom:0.5rem}
    .budget-bar-fill{height:100%;background:#10b981}
    .budget-bar-fill.yellow{background:#f59e0b}
    .budget-bar-fill.red{background:#ef4444}
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
      <div class="login-tab" data-tab="reset">找回密码</div>
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
    <form id="reset-form" class="login-form">
      <input type="text" id="reset-username" class="login-input" placeholder="用户名" required>
      <input type="password" id="reset-password" class="login-input" placeholder="新密码" required>
      <input type="password" id="reset-password2" class="login-input" placeholder="确认新密码" required>
      <button type="submit" class="login-btn">重置密码</button>
      <p class="login-success" id="reset-success"></p>
      <p class="login-error" id="reset-error"></p>
    </form>
    <p style="margin-top:1.5rem;text-align:center;color:#6b7280;font-size:0.75rem;">管理员: admin / admin123</p>
  </div>
</div>

<div id="app-page" class="hidden">
  <nav class="navbar">
    <h1>
      <span>💰 记账助手</span>
      <div class="user-menu">
        <button class="user-btn" id="user-btn"><span id="current-username">用户</span> ▼</button>
        <div class="user-dropdown" id="user-dropdown">
          <button id="btn-settings">⚙️ 设置</button>
          <button id="btn-admin" class="hidden">👥 用户管理</button>
          <button id="btn-logout">🚪 退出</button>
        </div>
      </div>
    </h1>
    <div class="nav-tabs">
      <button class="nav-tab active" data-tab="dashboard">概览</button>
      <button class="nav-tab" data-tab="transactions">记账</button>
      <button class="nav-tab" data-tab="statistics">统计</button>
      <button class="nav-tab" data-tab="budget">预算</button>
      <button class="nav-tab" data-tab="export">导出</button>
    </div>
  </nav>
  <div class="container">
    <div id="pending-alert" class="alert alert-warning hidden">⚠️ 账号待审核</div>
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
      <div class="page-title"><span>记账</span><div><input type="month" id="transactions-month" class="form-input" style="width:auto;"> <button class="btn btn-primary" id="btn-add">+ 添加</button></div></div>
      <div class="card"><div id="transactions-list"></div></div>
    </section>
    <section id="statistics" class="page hidden">
      <div class="page-title">统计分析</div>
      <div class="card"><div class="card-title">📊 支出分布</div><div id="pie-chart"></div></div>
    </section>
    <section id="budget" class="page hidden">
      <div class="page-title">预算管理</div>
      <div class="card"><div class="card-title">月度预算</div><div><input type="number" id="budget-input" class="form-input" placeholder="0" style="width:150px;"> 元 <button class="btn btn-primary" id="btn-save-budget">保存</button></div><div id="budget-progress" class="hidden" style="margin-top:1rem;"><div class="budget-bar"><div class="budget-bar-fill" id="budget-bar-fill"></div></div><p id="budget-status"></p></div></div>
    </section>
    <section id="export" class="page hidden">
      <div class="page-title">数据导出</div>
      <div class="card"><div class="card-title">导出数据</div><p id="export-info">共 0 条记录</p><div><button class="btn btn-primary" id="btn-export-csv">📊 CSV</button> <button class="btn btn-primary" id="btn-export-json">📄 JSON</button> <button class="btn btn-secondary" id="btn-export-html">📈 Excel</button></div></div>
      <div class="card"><div class="card-title">危险操作</div><button class="btn btn-danger" id="btn-clear-data">🗑️ 清空所有数据</button></div>
    </section>
    <section id="settings" class="page hidden">
      <div class="page-title">设置</div>
      <div class="card"><div class="card-title">自定义类别</div><button class="btn btn-primary" id="btn-add-category">+ 添加类别</button><div id="custom-categories-list"></div></div>
    </section>
    <section id="admin" class="page hidden">
      <div class="page-title">用户管理</div>
      <div class="card"><div class="card-title">待审核用户</div><div id="pending-users"></div></div>
      <div class="card"><div class="card-title">所有用户</div><div id="all-users"></div></div>
    </section>
  </div>
  <button class="fab hidden" id="fab-add">+</button>
</div>

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
      <input type="text" id="note" class="form-input" placeholder="备注">
      <div><button type="button" class="btn btn-secondary" id="btn-cancel" style="width:49%;">取消</button> <button type="submit" class="btn btn-primary" style="width:49%;">保存</button></div>
    </form>
  </div>
</div>

<div class="modal-overlay hidden" id="category-modal">
  <div class="modal">
    <h3 class="modal-title">添加类别</h3>
    <form id="category-form">
      <select id="category-type" class="form-input"><option value="expense">支出</option><option value="income">收入</option></select>
      <input type="text" id="category-name" class="form-input" placeholder="名称" required>
      <div class="icon-picker" id="icon-picker"></div>
      <div style="text-align:center;padding:1rem;background:#f3f4f6;border-radius:0.5rem;margin-bottom:1rem;"><span id="preview-icon" style="font-size:2rem;">🍔</span></div>
      <div><button type="button" class="btn btn-secondary" id="btn-category-cancel" style="width:49%;">取消</button> <button type="submit" class="btn btn-primary" style="width:49%;">添加</button></div>
    </form>
  </div>
</div>

<script>
const SUPABASE_URL='https://nvqqfmvtyqzxxcgoeriv.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cXFmbXZ0eXF6eHhjZ29lcml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNjA2MDAsImV4cCI6MjA1NjczNjYwMH0.5FlqnLlXuzJ2ne2AjvYnug_XGOCUenw';
const CATEGORIES={income:[{id:'salary',name:'工资',icon:'💰'},{id:'parttime',name:'兼职',icon:'💼'},{id:'investment',name:'投资',icon:'📈'},{id:'gift',name:'礼金',icon:'🎁'},{id:'other_income',name:'其他',icon:'💵'}],expense:[{id:'food',name:'餐饮',icon:'🍔'},{id:'transport',name:'交通',icon:'🚗'},{id:'shopping',name:'购物',icon:'🛒'},{id:'living',name:'居住',icon:'🏠'},{id:'health',name:'医疗',icon:'💊'},{id:'education',name:'教育',icon:'📚'},{id:'entertainment',name:'娱乐',icon:'🎮'},{id:'social',name:'社交',icon:'🤝'},{id:'other_expense',name:'其他',icon:'📦'}]};
const ICON_LIST=['🍔','🍕','🍜','🍱','🍰','☕','🍵','🚗','🚌','🚲','🏠','🏥','💊','📚','🎮','💼','👔','📱','💻','💰','💳','🎁','🏆','🥇','🎯','⚽','🏀'];
let currentUser=null,transactions=[],budgets={total:0},currentTab='dashboard',currentType='expense',selectedCategory='food',editingId=null,customCategories={income:[],expense:[]},selectedIcon='🍔';
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const formatCurrency=a=>'¥'+Number(a).toFixed(2);
const formatDate=d=>new Date(d).toLocaleDateString('zh-CN');
const getCurrentMonth=()=>{const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')};
const generateId=()=>Date.now().toString(36)+Math.random().toString(36).substr(2);
const simpleHash=s=>{let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h)+s.charCodeAt(i);return h.toString(16)};
const api={async request(m,t,d=null,p=''){try{const o={method:m,headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'}};if(d)o.body=JSON.stringify(d);const r=await fetch(SUPABASE_URL+'/rest/v1/'+t+p,o);const txt=await r.text();return txt?JSON.parse(txt):null}catch(e){return null}},get:(t,p='')=>api.request('GET',t,null,p),post:(t,d)=>api.request('POST',t,d),put:(t,d,p)=>api.request('PUT',t,d,p),delete:(t,p)=>api.request('DELETE',t,null,p)};
const checkAuth=()=>{const s=localStorage.getItem('currentUser');if(s){currentUser=JSON.parse(s);return true}return false};
const showApp=()=>{$('#login-page').classList.add('hidden');$('#app-page').classList.remove('hidden');$('#current-username').textContent=currentUser.username;if(currentUser.status==='pending')$('#pending-alert').classList.remove('hidden');if(currentUser.role==='admin'){$('#btn-admin').classList.remove('hidden');const tab=document.createElement('button');tab.className='nav-tab';tab.dataset.tab='admin';tab.textContent='用户管理';document.querySelector('.nav-tabs').appendChild(tab);tab.addEventListener('click',()=>switchTab('admin'))}initApp()};
const showLogin=()=>{$('#login-page').classList.remove('hidden');$('#app-page').classList.add('hidden');currentUser=null};
const login=async(u,p)=>{try{const d=await api.get('users','?username=eq.'+u);if(!d||d.length===0)return{success:false,error:'用户不存在'};const us=d[0];if(us.password!==simpleHash(p))return{success:false,error:'密码错误'};if(us.status==='pending')return{success:false,error:'账号待审核'};if(us.status==='rejected')return{success:false,error:'申请被拒绝'};currentUser={id:us.id,username:us.username,role:us.role,status:us.status};localStorage.setItem('currentUser',JSON.stringify(currentUser));return{success:true}}catch(e){return{success:false,error:'登录失败'}}};
const register=async(u,p)=>{try{const ex=await api.get('users','?username=eq.'+u);if(ex&&ex.length>0)return{success:false,error:'用户名已存在'};await api.post('users',{id:generateId(),username:u,password:simpleHash(p),role:'user',status:'pending',created_at:new Date().toISOString()});return{success:true}}catch(e){return{success:false,error:'注册失败'}}};
const resetPassword=async(u,p)=>{try{const d=await api.get('users','?username=eq.'+u);if(!d||d.length===0)return{success:false,error:'用户不存在'};await api.put('users',{password:simpleHash(p)},'?id=eq.'+d[0].id);return{success:true}}catch(e){return{success:false,error:'重置失败'}}};
const logout=()=>{localStorage.removeItem('currentUser');showLogin()};
const loadData=async()=>{if(!currentUser)return;try{const tx=await api.get('transactions','?user_id=eq.'+currentUser.id+'&order=date.desc');transactions=tx||[];const bd=await api.get('budgets','?user_id=eq.'+currentUser.id+'&limit=1');if(bd&&bd.length>0)budgets={total:bd[0].total||0};const cc=await api.get('custom_categories','?user_id=eq.'+currentUser.id);if(cc&&cc.length>0){customCategories={income:[],expense:[]};cc.forEach(c=>customCategories[c.type].push({id:c.id,name:c.name,icon:c.icon,custom:true}))}}catch(e){}};
const getCategories=()=>{return{income:[...CATEGORIES.income,...customCategories.income],expense:[...CATEGORIES.expense,...customCategories.expense]}};
const renderCategories=type=>{const grid=$('#category-grid');const cats=getCategories()[type];grid.innerHTML=cats.map(cat=>`<button type="button" class="category-btn ${cat.id===selectedCategory?'selected':''}" data-id="${cat.id}"><span style="font-size:1.5rem;display:block;">${cat.icon}</span><span style="font-size:0.75rem;">${cat.name}</span></button>`).join('');grid.querySelectorAll('.category-btn').forEach(btn=>{btn.addEventListener('click',()=>{grid.querySelectorAll('.category-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');selectedCategory=btn.dataset.id})})};
const renderDashboard=()=>{const month=$('#dashboard-month').value||getCurrentMonth();const monthly=transactions.filter(t=>t.date.startsWith(month));const income=monthly.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);const expense=monthly.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);$('#stat-income').textContent=formatCurrency(income);$('#stat-expense').textContent=formatCurrency(expense);$('#stat-balance').textContent=formatCurrency(income-expense);const recent=monthly.slice(-5).reverse();const cats=getCategories();$('#recent-transactions').innerHTML=recent.length===0?'<p style="text-align:center;padding:2rem;color:#6b7280;">暂无记录</p>':recent.map(t=>{const cat=cats[t.type].find(c=>c.id===t.category);return`<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;"><div><span style="font-size:1.5rem;margin-right:0.5rem;">${cat?.icon||'📝'}</span><span>${cat?.name||t.category}</span></div><div><span style="font-weight:bold;color:${t.type==='income'?'#10b981':'#ef4444'}">${t.type==='income'?'+':'-'}${formatCurrency(t.amount)}</span> <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')">删除</button></div></div>`}).join('')};
const renderTransactions=()=>{const month=$('#transactions-month').value||getCurrentMonth();const monthly=transactions.filter(t=>t.date.startsWith(month)).reverse();const cats=getCategories();$('#transactions-list').innerHTML=monthly.length===0?'<p style="text-align:center;padding:2rem;color:#6b7280;">暂无记录</p>':`<table class="table"><thead><tr><th>日期</th><th>类别</th><th>金额</th><th></th></tr></thead><tbody>${monthly.map(t=>{const cat=cats[t.type].find(c=>c.id===t.category);return`<tr><td>${formatDate(t.date)}</td><td>${cat?.icon||''} ${cat?.name||t.category}</td><td style="color:${t.type==='income'?'#10b981':'#ef4444'};font-weight:bold;">${t.type==='income'?'+':'-'}${formatCurrency(t.amount)}</td><td><button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')">删除</button></td></tr>`}).join('')}</tbody></table>`};
const renderStatistics=()=>{const cats=getCategories();const monthly=transactions.filter(t=>t.type==='expense');const byCat={};monthly.forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount});const data=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8);const total=data.reduce((s,[,v])=>s+v,0);if(data.length===0){$('#pie-chart').innerHTML='<p style="text-align:center;padding:2rem;color:#6b7280;">暂无数据</p>';return}let html='<div style="display:flex;flex-wrap:wrap;gap:2rem;align-items:center;"><div style="width:150px;height:150px;border-radius:50%;position:relative;background:conic-gradient(';let start=0;const colors=['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];data.forEach(([cat,amt],i)=>{const pct=amt/total;html+=`${colors[i]} ${start*360}deg ${(start+pct)*360}deg${i<data.length-1?',':''}`;start+=pct});html+=`);"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;"><div style="font-size:0.75rem;color:#6b7280;">总支出</div><div style="font-weight:bold;">${formatCurrency(total)}</div></div></div><div style="flex:1;min-width:200px;">`;data.forEach(([cat,amt],i)=>{const c=cats.expense.find(x=>x.id===cat);html+=`<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;"><div style="width:12px;height:12px;border-radius:2px;background:${colors[i]}"></div><span style="flex:1;">${c?.icon||''} ${c?.name||cat}</span><span style="font-weight:bold;">${formatCurrency(amt)} (${((amt/total)*100).toFixed(1)}%)</span></div>`});html+='</div></div>';$('#pie-chart').innerHTML=html};
const renderBudget=()=>{const monthly=transactions.filter(t=>t.type==='expense');const expense=monthly.reduce((s,t)=>s+t.amount,0);$('#budget-input').value=budgets.total||'';if(budgets.total>0){$('#budget-progress').classList.remove('hidden');const pct=Math.min(100,(expense/budgets.total)*100);$('#budget-bar-fill').style.width=pct+'%';$('#budget-bar-fill').className='budget-bar-fill'+(pct>100?' red':pct>80?' yellow':'');$('#budget-status').textContent=(budgets.total-expense)>=0?`剩余 ${formatCurrency(budgets.total-expense)}`:`超支 ${formatCurrency(expense-budgets.total)}`}else{$('#budget-progress').classList.add('hidden')}};
const renderExport=()=>{$('#export-info').textContent=`共 ${transactions.length} 条记录`};
const renderSettings=()=>{const cats=getCategories();let html='';['income','expense'].forEach(type=>{html+=`<h4 style="margin:1rem 0 0.5rem;">${type==='income'?'收入':'支出'}类别</h4>`;cats[type].filter(c=>c.custom).forEach(c=>{html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;"><span>${c.icon} ${c.name}</span><button class="btn btn-danger btn-sm" onclick="deleteCategory('${c.id}')">删除</button></div>`})});$('#custom-categories-list').innerHTML=html||'<p style="color:#6b7280;">暂无自定义类别</p>'};
const renderAdmin=async()=>{try{const users=await api.get('users','?order=created_at.desc');const pending=users.filter(u=>u.status==='pending');const approved=users.filter(u=>u.status==='approved');$('#pending-users').innerHTML=pending.length===0?'<p style="color:#6b7280;">暂无待审核用户</p>':pending.map(u=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;"><span>${u.username} <span class="badge badge-pending">待审核</span></span><div><button class="btn btn-primary btn-sm" onclick="approveUser('${u.id}')">通过</button> <button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')">拒绝</button></div></div>`).join('');$('#all-users').innerHTML=approved.map(u=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;"><span>${u.username} ${u.role==='admin'?'<span class="badge badge-approved">管理员</span>':'<span class="badge">用户</span>'}</span><button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')" ${u.id===currentUser.id?'disabled':''}>删除</button></div>`).join('')}catch(e){}};
const switchTab=tab=>{currentTab=tab;$$('.nav-tab').forEach(t=>t.classList.remove('active'));$(`.nav-tab[data-tab="${tab}"]`)?.class