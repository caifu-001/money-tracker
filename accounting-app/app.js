// ==================== 配置 ====================
const SUPABASE_URL = 'https://nvqqfmvtyqzxxcgoeriv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cXFmbXZ0eXF6eHhjZ29lcml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNjA2MDAsImV4cCI6MjA1NjczNjYwMH0.5FlqnLlXuzJ2ne2AjvYnug_XGOCUenw';

// 默认类别
const DEFAULT_CATEGORIES = {
  income: [
    { id: 'salary', name: '工资', icon: '💰' },
    { id: 'parttime', name: '兼职', icon: '💼' },
    { id: 'investment', name: '投资', icon: '📈' },
    { id: 'gift', name: '礼金', icon: '🎁' },
    { id: 'other_income', name: '其他', icon: '💵' }
  ],
  expense: [
    { id: 'food', name: '餐饮', icon: '🍔' },
    { id: 'transport', name: '交通', icon: '🚗' },
    { id: 'shopping', name: '购物', icon: '🛒' },
    { id: 'living', name: '居住', icon: '🏠' },
    { id: 'health', name: '医疗', icon: '💊' },
    { id: 'education', name: '教育', icon: '📚' },
    { id: 'entertainment', name: '娱乐', icon: '🎮' },
    { id: 'social', name: '社交', icon: '🤝' },
    { id: 'other_expense', name: '其他', icon: '📦' }
  ]
};

// 图标列表
const ICON_LIST = ['🍔','🍕','🍜','🍱','🍰','☕','🍵','🚗','🚌','🚲','✈️','🚄','🏠','🏥','💊','📚','🎮','💼','👔','📱','💻','💰','💳','🎁','🏆','🥇','🎯','⚽','🏀','🎾','🎳','💡','🔋','💎','🎀','🎉','🎈','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎸','🎻','🎺','🎷','🎲','🎯','🎳','🎰','🎮','🎪','🎭','📷','📹','🎥','📺','📻','☎️','📞'];

const PIE_COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4'];

// ==================== 状态 ====================
let currentUser = null;
let transactions = [];
let budgets = { total: 0 };
let currentTab = 'dashboard';
let currentType = 'expense';
let selectedCategory = 'food';
let editingId = null;
let categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
let customCategories = { income: [], expense: [] };
let selectedIcon = '🍔';

// ==================== 工具函数 ====================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const formatCurrency = a => '¥' + Number(a).toFixed(2);
const formatDate = d => new Date(d).toLocaleDateString('zh-CN');
const getCurrentMonth = () => {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
};
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const simpleHash = s => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h = h & h;
  }
  return h.toString(16);
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
          'Content-Type': 'application/json'
        }
      };
      if (data) options.body = JSON.stringify(data);
      const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + params, options);
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    } catch (e) {
      console.error('API Error:', e);
      throw e;
    }
  },
  get: (table, params = '') => api.request('GET', table, null, params),
  post: (table, data) => api.request('POST', table, data),
  put: (table, data, params) => api.request('PUT', table, data, params),
  delete: (table, params) => api.request('DELETE', table, null, params)
};

// ==================== 认证 ====================
const checkAuth = () => {
  const s = localStorage.getItem('currentUser');
  if (s) {
    currentUser = JSON.parse(s);
    return true;
  }
  return false;
};

const showApp = () => {
  $('#login-page').classList.add('hidden');
  $('#app-page').classList.remove('hidden');
  $('#current-username').textContent = currentUser.username;
  
  if (currentUser.status === 'pending') {
    $('#pending-alert').classList.remove('hidden');
  }
  
  if (currentUser.role === 'admin') {
    $('#btn-admin').classList.remove('hidden');
    // 添加用户管理标签
    if (!document.querySelector('[data-tab="admin"]')) {
      const tab = document.createElement('button');
      tab.className = 'nav-tab';
      tab.dataset.tab = 'admin';
      tab.textContent = '用户管理';
      tab.onclick = () => switchTab('admin');
      document.querySelector('.nav-tabs').appendChild(tab);
    }
  }
  
  initApp();
};

const showLogin = () => {
  $('#login-page').classList.remove('hidden');
  $('#app-page').classList.add('hidden');
  currentUser = null;
  transactions = [];
};

const login = async (u, p) => {
  try {
    const d = await api.get('users', '?username=eq.' + u);
    if (!d || d.length === 0) return { success: false, error: '用户不存在' };
    const us = d[0];
    if (us.password !== simpleHash(p)) return { success: false, error: '密码错误' };
    if (us.status === 'pending') return { success: false, error: '账号待审核' };
    if (us.status === 'rejected') return { success: false, error: '申请被拒绝' };
    currentUser = { id: us.id, username: us.username, role: us.role, status: us.status };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    return { success: true };
  } catch (e) {
    return { success: false, error: '登录失败' };
  }
};

const register = async (u, p) => {
  try {
    const ex = await api.get('users', '?username=eq.' + u);
    if (ex && ex.length > 0) return { success: false, error: '用户名已存在' };
    await api.post('users', {
      id: generateId(),
      username: u,
      password: simpleHash(p),
      role: 'user',
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: '注册失败' };
  }
};

const resetPassword = async (u, p) => {
  try {
    const d = await api.get('users', '?username=eq.' + u);
    if (!d || d.length === 0) return { success: false, error: '用户不存在' };
    await api.put('users', { password: simpleHash(p) }, '?id=eq.' + d[0].id);
    return { success: true };
  } catch (e) {
    return { success: false, error: '重置失败' };
  }
};

const logout = () => {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('transactions');
  localStorage.removeItem('budgets');
  localStorage.removeItem('customCategories');
  showLogin();
};

// ==================== 数据加载 ====================
const loadData = async () => {
  if (!currentUser) return;
  try {
    const tx = await api.get('transactions', '?user_id=eq.' + currentUser.id + '&order=date.desc');
    transactions = tx || [];
    
    const bd = await api.get('budgets', '?user_id=eq.' + currentUser.id + '&limit=1');
    if (bd && bd.length > 0) budgets = { total: bd[0].total || 0 };
    
    const cc = await api.get('custom_categories', '?user_id=eq.' + currentUser.id);
    if (cc && cc.length > 0) {
      customCategories = { income: [], expense: [] };
      cc.forEach(c => customCategories[c.type].push({ id: c.id, name: c.name, icon: c.icon, custom: true }));
      mergeCategories();
    }
  } catch (e) {
    // 离线模式，使用本地数据
    transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    budgets = JSON.parse(localStorage.getItem('budgets') || '{"total": 0}');
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

// ==================== 渲染函数 ====================
const renderCategories = (type) => {
  const grid = $('#category-grid');
  grid.innerHTML = categories[type].map(cat => 
    `<button type="button" class="category-btn ${cat.id === selectedCategory ? 'selected' : ''}" data-id="${cat.id}">
      <span class="icon">${cat.icon}</span>
      <span class="name">${cat.name}</span>
    </button>`
  ).join('');
  
  grid.querySelectorAll('.category-btn').forEach(btn => {
    btn.onclick = () => {
      grid.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCategory = btn.dataset.id;
    };
  });
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
  
  if (recent.length === 0) {
    $('#recent-transactions').innerHTML = '<p class="empty-state">暂无记录</p>';
  } else {
    $('#recent-transactions').innerHTML = recent.map(t => {
      const cat = categories[t.type].find(c => c.id === t.category);
      return `
        <div class="transaction-item">
          <div class="transaction-left">
            <span class="transaction-icon">${cat?.icon || '📝'}</span>
            <span>${cat?.name || t.category}</span>
          </div>
          <div>
            <span class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')">删除</button>
          </div>
        </div>
      `;
    }).join('');
  }
};

const renderTransactions = () => {
  const month = $('#transactions-month').value || getCurrentMonth();
  const monthly = transactions.filter(t => t.date.startsWith(month)).reverse();
  
  if (monthly.length === 0) {
    $('#transactions-list').innerHTML = '<p class="empty-state">暂无记录</p>';
  } else {
    $('#transactions-list').innerHTML = `
      <table class="table">
        <thead>
          <tr><th>日期</th><th>类别</th><th>金额</th><th></th></tr>
        </thead>
        <tbody>
          ${monthly.map(t => {
            const cat = categories[t.type].find(c => c.id === t.category);
            return `
              <tr>
                <td>${formatDate(t.date)}</td>
                <td>${cat?.icon || ''} ${cat?.name || t.category}</td>
                <td class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')">删除</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }
};

const renderBudget = () => {
  const month = getCurrentMonth();
  const monthly = transactions.filter(t => t.date.startsWith(month));
  const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  
  $('#budget-input').value = budgets.total || '';
  
  if (budgets.total > 0) {
    $('#budget-progress').classList.remove('hidden');
    const pct = Math.min(100, (expense / budgets.total) * 100);
    $('#budget-used').textContent = `${formatCurrency(expense)} / ${formatCurrency(budgets.total)}`;
    const bar = $('#budget-bar-fill');
    bar.style.width = pct + '%';
    bar.className = 'budget-bar-fill' + (pct > 100 ? ' red' : pct > 80 ? ' yellow' : '');
    const remaining = budgets.total - expense;
    $('#budget-status').textContent = remaining >= 0 ? `剩余 ${formatCurrency(remaining)}` : `超支 ${formatCurrency(-remaining)}`;
  } else {
    $('#budget-progress').classList.add('hidden');
  }
};

const renderStatistics = () => {
  // 饼图
  const month = getCurrentMonth();
  const monthly = transactions.filter(t => t.date.startsWith(month));
  const expenseByCat = {};
  monthly.filter(t => t.type === 'expense').forEach(t => {
    expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount;
  });
  
  const pieData = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalExpense = Object.values(expenseByCat).reduce((a, b) => a + b, 0);
  
  if (pieData.length > 0) {
    let pieHtml = '<div class="pie-chart"><div class="pie-circle" style="background:conic-gradient(';
    let start = 0;
    pieData.forEach(([cat, amount], i) => {
      const pct = amount / totalExpense;
      pieHtml += `${PIE_COLORS[i]} ${start * 360}deg ${(start + pct) * 360}deg${i < pieData.length - 1 ? ',' : ''}`;
      start += pct;
    });
    pieHtml += ');"><div class="pie-center"><div style="font-size:0.75rem;color:#6b7280;">总支出</div><div style="font-weight:bold;">' + formatCurrency(totalExpense) + '</div></div></div><div class="pie-legend">';
    
    pieData.forEach(([cat, amount], i) => {
      const c = categories.expense.find(x => x.id === cat);
      pieHtml += `<div class="legend-item"><div class="legend-color" style="background:${PIE_COLORS[i]}"></div><span style="flex:1;">${c?.icon || ''} ${c?.name || cat}</span><span style="font-weight:bold;">${formatCurrency(amount)} (${((amount / totalExpense) * 100).toFixed(1)}%)</span></div>`;
    });
    
    pieHtml += '</div></div>';
    $('#pie-chart').innerHTML = pieHtml;
  } else {
    $('#pie-chart').innerHTML = '<p class="empty-state">暂无数据</p>';
  }
  
  // 柱状图 - 最近6个月
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  
  const barData = months.map(m => {
    const mt = transactions.filter(t => t.date.startsWith(m));
    const income = mt.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = mt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { month: m.slice(5) + '月', income, expense };
  });
  
  const maxVal = Math.max(...barData.map(d => Math.max(d.income, d.expense)), 1);
  
  $('#bar-chart').innerHTML = `
    <div class="bar-chart">
      ${barData.map(d => `
        <div class="bar-item">
          <div class="bar" style="height:${(d.income / maxVal) * 150}px;background:#10b981;"></div>
          <div class="bar" style="height:${(d.expense / maxVal) * 150}px;background:#ef4444;margin-top:4px;"></div>
          <div class="bar-label">${d.month}</div>
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;font-size:0.75rem;">
      <span><span style="display:inline-block;width:12px;height:12px;background:#10b981;border-radius:2px;margin-right:4px;"></span>收入</span>
      <span><span style="display:inline-block;width:12px;height:12px;background:#ef4444;border-radius:2px;margin-right:4px;"></span>支出</span>
    </div>
  `;
};

const renderSettings = () => {
  let html = '';
  
  if (customCategories.expense.length > 0) {
    html += '<h4 style="margin:1rem 0 0.5rem;">支出类别</h4>';
    customCategories.expense.forEach(cat => {
      html += `<div class="flex flex-between" style="padding:0.5rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;">
        <span>${cat.icon} ${cat.name}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomCategory('${cat.id}','expense')">删除</button>
      </div>`;
    });
  }
  
  if (customCategories.income.length > 0) {
    html += '<h4 style="margin:1rem 0 0.5rem;">收入类别</h4>';
    customCategories.income.forEach(cat => {
      html += `<div class="flex flex-between" style="padding:0.5rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;">
        <span>${cat.icon} ${cat.name}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomCategory('${cat.id}','income')">删除</button>
      </div>`;
    });
  }
  
  if (!html) html = '<p class="empty-state">暂无自定义类别</p>';
  
  $('#custom-categories-list').innerHTML = html;
};

const renderAdmin = async () => {
  if (currentUser?.role !== 'admin') return;
  
  try {
    const users = await api.get('users', '?order=created_at.desc');
    
    const pending = users?.filter(u => u.status === 'pending') || [];
    const all = users || [];
    
    // 待审核
    if (pending.length > 0) {
      $('#pending-users').innerHTML = pending.map(u => `
        <div class="flex flex-between" style="padding:0.75rem;background:#fef3c7;border-radius:0.5rem;margin-bottom:0.5rem;">
          <span><strong>${u.username}</strong> <span class="badge badge-pending">待审核</span></span>
          <div>
            <button class="btn btn-success btn-sm" onclick="approveUser('${u.id}')">通过</button>
            <button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')">拒绝</button>
          </div>
        </div>
      `).join('');
    } else {
      $('#pending-users').innerHTML = '<p class="empty-state">暂无待审核用户</p>';
    }
    
    // 所有用户
    $('#all-users').innerHTML = all.map(u => `
      <div class="flex flex-between" style="padding:0.75rem;background:#f9fafb;border-radius:0.5rem;margin-bottom:0.5rem;">
        <span>
          <strong>${u.username}</strong>
          <span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role === 'admin' ? '管理员' : '用户'}</span>
          <span class="badge ${u.status === 'approved' ? 'badge-approved' : u.status === 'pending' ? 'badge-pending' : 'badge-rejected'}">${u.status === 'approved' ? '已通过' : u.status === 'pending' ? '待审核' : '已拒绝'}</span>
        </span>
        <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')" ${u.id === currentUser.id ? 'disabled' : ''}>删除</button>
      </div>
    `).join('');
  } catch (e) {
    $('#pending-users').innerHTML = '<p class="empty-state">加载失败</p>';
    $('#all-users').innerHTML = '<p class="empty-state">加载失败</p>';
  }
};

const renderSearch = (keyword, type) => {
  let results = transactions;
  
  if (keyword) {
    results = results.filter(t => {
      const cat = categories[t.type].find(c => c.id === t.category);
      return cat?.name.toLowerCase().includes(keyword.toLowerCase()) || 
             t.note?.toLowerCase().includes(keyword.toLowerCase());
    });
  }
  
  if (type) {
    results = results.filter(t => t.type === type);
  }
  
  const income = results.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = results.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  
  $('#search-results').innerHTML = `
    <div class="stats-grid" style="margin-bottom:1rem;">
      <div class="stat-card green"><div class="stat-label">收入合计</div><div class="stat-value green">${formatCurrency(income)}</div></div>
      <div class="stat-card red"><div class="stat-label">支出合计</div><div class="stat-value red">${formatCurrency(expense)}</div></div>
      <div class="stat-card blue"><div class="stat-label">结余</div><div class="stat-value blue">${formatCurrency(income - expense)}</div></div>
    </div>
    <p class="text-sm">共 ${results.length} 条记录</p>
    ${results.length > 0 ? `
      <table class="table" style="margin-top:1rem;">
        <thead><tr><th>日期</th><th>类别</th><th>金额</th></tr></thead>
        <tbody>
          ${results.slice(0, 20).map(t => {
            const cat = categories[t.type].find(c => c.id === t.category);
            return `<tr><td>${formatDate(t.date)}</td><td>${cat?.icon || ''} ${cat?.name || t.category}</td><td class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    ` : ''}
  `;
};

// ==================== 页面切换 ====================
const switchTab = tab => {
  currentTab = tab;
  $$('.nav-tab').forEach(t => t.classList.remove('active'));
  $(`.nav-tab[data-tab="${tab}"]`)?.classList.add('active');
  $$('.page').forEach(p => p.classList.add('hidden'));
  $(`#${tab}`)?.classList.remove('hidden');
  
  const fab = $('#fab-add');
  fab.classList.toggle('hidden', ['statistics', 'budget', 'settings', 'admin'].includes(tab));
  
  switch (tab) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'statistics': renderStatistics(); break;
    case 'budget': renderBudget(); break;
    case 'settings': renderSettings(); break;
    case 'admin': renderAdmin(); break;
  }
};

// ==================== 模态框 ====================
const openModal = (edit = null) => {
  editingId = edit?.id || null;
  $('#modal-title').textContent = edit ? '编辑记录' : '添加记录';
  
  if (edit) {
    currentType = edit.type;
    selectedCategory = edit.category;
    $('#transaction-id').value = edit.id;
    $('#amount').value = edit.amount;
    $('#date').value = edit.date;
    $('#note').value = edit.note || '';
  } else {
    currentType = 'expense';
    selectedCategory = 'food';
    $('#transaction-id').value = '';
    $('#amount').value = '';
    $('#date').value = new Date().toISOString().split('T')[0];
    $('#note').value = '';
  }
  
  $$('.type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === currentType));
  renderCategories(currentType);
  $('#transaction-modal').classList.remove('hidden');
};

const closeModal = () => {
  $('#transaction-modal').classList.add('hidden');
  editingId = null;
};

const openCategoryModal = () => {
  selectedIcon = '🍔';
  $('#preview-emoji').textContent = '🍔';
  $('#category-name').value = '';
  $('#category-type').value = 'expense';
  
  const picker = $('#icon-picker');
  picker.innerHTML = ICON_LIST.map(icon => 
    `<span class="icon-option ${icon === '🍔' ? 'selected' : ''}" data-icon="${icon}">${icon}</span>`
  ).join('');
  
  picker.querySelectorAll('.icon-option').forEach(opt => {
    opt.onclick = () => {
      picker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedIcon = opt.dataset.icon;
      $('#preview-emoji').textContent = selectedIcon;
    };
  });
  
  $('#category-modal').classList.remove('hidden');
};

const closeCategoryModal = () => {
  $('#category-modal').classList.add('hidden');
};

// ==================== 数据操作 ====================
const saveTransaction = async (data) => {
  const tx = { ...data, user_id: currentUser.id };
  
  try {
    if (editingId) {
      await api.put('transactions', tx, '?id=eq.' + editingId);
      transactions = transactions.map(t => t.id === editingId ? { ...tx, id: editingId } : t);
    } else {
      tx.id = generateId();
      await api.post('transactions', tx);
      transactions.unshift(tx);
    }
    localStorage.setItem('transactions', JSON.stringify(transactions));
    closeModal();
    renderCurrentPage();
    alert('保存成功');
  } catch (e) {
    // API失败也保存到本地
    if (editingId) {
      transactions = transactions.map(t => t.id === editingId ? { ...tx, id: editingId } : t);
    } else {
      tx.id = generateId();
      transactions.unshift(tx);
    }
    localStorage.setItem('transactions', JSON.stringify(transactions));
    closeModal();
    renderCurrentPage();
    alert('已保存到本地');
  }
};

window.deleteTransaction = async (id) => {
  if (!confirm('确定删除？')) return;
  try {
    await api.delete('transactions', '?id=eq.' + id);
    transactions = transactions.filter(t => t.id !== id);
  } catch (e) {
    transactions = transactions.filter(t => t.id !== id);
  }
  localStorage.setItem('transactions', JSON.stringify(transactions));
  renderCurrentPage();
};

const saveBudget = async () => {
  budgets.total = Number($('#budget-input').value) || 0;
  localStorage.setItem('budgets', JSON.stringify(budgets));
  
  try {
    const existing = await api.get('budgets', '?user_id=eq.' + currentUser.id + '&limit=1');
    if (existing && existing.length > 0) {
      await api.put('budgets', { total: budgets.total }, '?id=eq.' + existing[0].id);
    } else {
      await api.post('budgets', { id: generateId(), user_id: currentUser.id, total: budgets.total });
    }
  } catch (e) {}
  
  renderBudget();
  alert('保存成功');
};

const addCustomCategory = async () => {
  const type = $('#category-type').value;
  const name = $('#category-name').value.trim();
  if (!name) return alert('请输入类别名称');
  
  const cat = { id: generateId(), user_id: currentUser.id, type, name, icon: selectedIcon };
  
  try {
    await api.post('custom_categories', cat);
    customCategories[type].push({ id: cat.id, name, icon: selectedIcon, custom: true });
  } catch (e) {
    customCategories[type].push({ id: cat.id, name, icon: selectedIcon, custom: true });
  }
  
  localStorage.setItem('customCategories', JSON.stringify(customCategories));
  mergeCategories();
  closeCategoryModal();
  renderSettings();
  alert('添加成功');
};

window.deleteCustomCategory = async (id, type) => {
  if (!confirm('确定删除？')) return;
  try {
    await api.delete('custom_categories', '?id=eq.' + id);
    customCategories[type] = customCategories[type].filter(c => c.id !== id);
  } catch (e) {
    customCategories[type] = customCategories[type].filter(c => c.id !== id);
  }
  localStorage.setItem('customCategories', JSON.stringify(customCategories));
  mergeCategories();
  renderSettings();
};

// 用户管理
window.approveUser = async (id) => {
  try {
    await api.put('users', { status: 'approved' }, '?id=eq.' + id);
    renderAdmin();
    alert('已通过');
  } catch (e) {
    alert('操作失败');
  }
};

window.rejectUser = async (id) => {
  try {
    await api.put('users', { status: 'rejected' }, '?id=eq.' + id);
    renderAdmin();
    alert('已拒绝');
  } catch (e) {
    alert('操作失败');
  }
};

window.deleteUser = async (id) => {
  if (id === currentUser.id) return alert('不能删除自己');
  if (!confirm('确定删除该用户？')) return;
  try {
    await api.delete('users', '?id=eq.' + id);
    renderAdmin();
    alert('已删除');
  } catch (e) {
    alert('删除失败');
  }
};

const renderCurrentPage = () => {
  switch (currentTab) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'statistics': renderStatistics(); break;
    case 'budget': renderBudget(); break;
    case 'settings': renderSettings(); break;
    case 'admin': renderAdmin(); break;
  }
};

// ==================== 初始化 ====================
const initApp = async () => {
  const month = getCurrentMonth();
  $('#dashboard-month').value = month;
  $('#transactions-month').value = month;
  
  // 绑定事件
  $$('.nav-tab').forEach(tab => {
    tab.onclick = () => switchTab(tab.dataset.tab);
  });
  
  $('#btn-add').onclick = () => openModal();
  $('#fab-add').onclick = () => openModal();
  $('#btn-cancel').onclick = closeModal;
  
  $$('.type-btn').forEach(btn => {
    btn.onclick = () => {
      currentType = btn.dataset.type;
      $$('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = categories[currentType][0].id;
      renderCategories(currentType);
    };
  });
  
  $('#transaction-form').onsubmit = e => {
    e.preventDefault();
    saveTransaction({
      type: currentType,
      amount: Number($('#amount').value),
      category: selectedCategory,
      date: $('#date').value,
      note: $('#note').value
    });
  };
  
  $('#btn-save-budget').onclick = saveBudget;
  
  $('#btn-search').onclick = () => {
    const keyword = $('#search-keyword').value;
    const type = $('#search-type').value;
    renderSearch(keyword, type);
  };
  
  $('#btn-settings').onclick = () => switchTab('settings');
  $('#btn-admin').onclick = () => switchTab('admin');
  $('#btn-logout').onclick = logout;
  
  $('#user-btn').onclick = () => $('#user-dropdown').classList.toggle('show'));
  document.addEventListener('click', e => {
    if (!e.target.closest('.user-menu')) $('#user-dropdown').classList.remove('show');
  });
  
  $('#btn-add-category').onclick = openCategoryModal;
  $('#btn-category-cancel').onclick = closeCategoryModal;
  
  $('#category-form').onsubmit = e => {
    e.preventDefault();
    addCustomCategory();
  };
  
  $('#transaction-modal').onclick = e => { if (e.target.id === 'transaction-modal') closeModal(); };
  $('#category-modal').onclick = e => { if (e.target.id === 'category-modal') closeCategoryModal(); };
  
  // 月份选择
  $('#dashboard-month').onchange = renderDashboard;
  $('#transactions-month').onchange = renderTransactions;
  
  await loadData();
  renderDashboard();
};

// ==================== 登录表单 ====================
document.addEventListener('DOMContentLoaded', () => {
  // 标签切换
  $$('.login-tab').forEach(tab => {
    tab.onclick = () => {
      $$('.login-tab').forEach(t => t.classList.remove('active'));
      $$('.login-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      $(`#${tab.dataset.tab}-form`).classList.add('active');
    };
  });
  
  // 登录表单
  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    const result = await login($('#login-username').value, $('#login-password').value);
    if (result.success) {
      $('#login-error').style.display = 'none';
      showApp();
    } else {
      $('#login-error').textContent = result.error;
      $('#login-error').style.display = 'block';
    }
  };
  
  // 注册表单
  $('#register-form').onsubmit = async e => {
    e.preventDefault();
    const pw = $('#reg-password').value;
    if (pw !== $('#reg-password2').value) {
      $('#reg-error').textContent = '两次密码不一致';
      $('#reg-error').style.display = 'block';
      return;
    }
    const result = await register($('#reg-username').value, pw);
    if (result.success) {
      $('#reg-success').textContent = '注册成功！请等待管理员审核';
      $('#reg-success').style.display = 'block';
      $('#reg-error').style.display = 'none';
    } else {
      $('#reg-error').textContent = result.error;
      $('#reg-error').style.display = 'block';
      $('#reg-success').style.display = 'none';
    }
  };
  
  // 重置密码表单
  $('#reset-form').onsubmit = async e => {
    e.preventDefault();
    const pw = $('#reset-password').value;
    if (pw !== $('#reset-password2').value) {
      $('#reset-error').textContent = '两次密码不一致';
      $('#reset-error').style.display = 'block';
      return;
    }
    const result = await resetPassword($('#reset-username').value, pw);
    if (result.success) {
      $('#reset-success').textContent = '密码重置成功！';
      $('#reset-success').style.display = 'block';
      $('#reset-error').style.display = 'none';
    } else {
      $('#reset-error').textContent = result.error;
      $('#reset-error').style.display = 'block';
      $('#reset-success').style.display = 'none';
    }
  };
  
  // 检查登录状态
  if (checkAuth()) {
    showApp();
  }
});