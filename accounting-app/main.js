const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

let mainWindow;
let db;

// 初始化数据库
function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'accounting.db');
  db = new Database(dbPath);
  
  // 创建表
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_sync_at DATETIME
    );

    -- 交易记录表
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT CHECK(type IN ('income', 'expense')),
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0
    );

    -- 预算表
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      category TEXT,
      amount REAL NOT NULL,
      month TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 类别表
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('income', 'expense')),
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0
    );

    -- 插入默认类别
    INSERT OR IGNORE INTO categories (id, type, name, icon, color, sort_order) VALUES
      ('cat_income_salary', 'income', '工资', '💰', '#4CAF50', 1),
      ('cat_income_parttime', 'income', '兼职/副业', '💼', '#8BC34A', 2),
      ('cat_income_investment', 'income', '投资理财', '📈', '#CDDC39', 3),
      ('cat_income_gift', 'income', '礼金/红包', '🎁', '#FFC107', 4),
      ('cat_income_other', 'income', '其他收入', '💵', '#FF9800', 5),
      ('cat_expense_food', 'expense', '餐饮', '🍔', '#F44336', 1),
      ('cat_expense_transport', 'expense', '交通', '🚗', '#E91E63', 2),
      ('cat_expense_shopping', 'expense', '购物', '🛒', '#9C27B0', 3),
      ('cat_expense_living', 'expense', '居住', '🏠', '#673AB7', 4),
      ('cat_expense_health', 'expense', '医疗健康', '💊', '#3F51B5', 5),
      ('cat_expense_education', 'expense', '教育培训', '📚', '#2196F3', 6),
      ('cat_expense_entertainment', 'expense', '娱乐休闲', '🎮', '#00BCD4', 7),
      ('cat_expense_social', 'expense', '社交人情', '🤝', '#009688', 8),
      ('cat_expense_other', 'expense', '其他支出', '📦', '#795548', 9);

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  `);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    icon: path.join(__dirname, 'public', 'icon.png')
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});

// IPC 处理程序
// 获取所有交易记录
ipcMain.handle('get-transactions', (event, filters) => {
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];
  
  if (filters?.startDate) {
    query += ' AND date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    query += ' AND date <= ?';
    params.push(filters.endDate);
  }
  if (filters?.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }
  
  query += ' ORDER BY date DESC, created_at DESC';
  
  return db.prepare(query).all(...params);
});

// 添加交易记录
ipcMain.handle('add-transaction', (event, transaction) => {
  const stmt = db.prepare(`
    INSERT INTO transactions (id, user_id, type, amount, category, date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    transaction.id,
    transaction.userId || null,
    transaction.type,
    transaction.amount,
    transaction.category,
    transaction.date,
    transaction.note || null
  );
});

// 更新交易记录
ipcMain.handle('update-transaction', (event, transaction) => {
  const stmt = db.prepare(`
    UPDATE transactions 
    SET type = ?, amount = ?, category = ?, date = ?, note = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(
    transaction.type,
    transaction.amount,
    transaction.category,
    transaction.date,
    transaction.note,
    transaction.id
  );
});

// 删除交易记录
ipcMain.handle('delete-transaction', (event, id) => {
  return db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
});

// 获取类别
ipcMain.handle('get-categories', (event, type) => {
  let query = 'SELECT * FROM categories';
  const params = [];
  
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY sort_order';
  
  return db.prepare(query).all(...params);
});

// 预算管理
ipcMain.handle('get-budgets', (event, month) => {
  return db.prepare('SELECT * FROM budgets WHERE month = ?').all(month);
});

ipcMain.handle('set-budget', (event, budget) => {
  const existing = db.prepare('SELECT id FROM budgets WHERE category = ? AND month = ?').get(budget.category, budget.month);
  
  if (existing) {
    return db.prepare('UPDATE budgets SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(budget.amount, existing.id);
  } else {
    const stmt = db.prepare('INSERT INTO budgets (id, user_id, category, amount, month) VALUES (?, ?, ?, ?, ?)');
    return stmt.run(budget.id, budget.userId || null, budget.category, budget.amount, budget.month);
  }
});

// 统计查询
ipcMain.handle('get-statistics', (event, startDate, endDate) => {
  const transactions = db.prepare(`
    SELECT * FROM transactions 
    WHERE date >= ? AND date <= ?
    ORDER BY date
  `).all(startDate, endDate);
  
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const categoryStats = {};
  transactions.forEach(t => {
    if (!categoryStats[t.category]) {
      categoryStats[t.category] = { income: 0, expense: 0 };
    }
    categoryStats[t.category][t.type] += t.amount;
  });
  
  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    categoryStats,
    transactions
  };
});

// 导出数据
ipcMain.handle('export-data', async (event, format, startDate, endDate) => {
  const transactions = db.prepare(`
    SELECT * FROM transactions 
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
  `).all(startDate, endDate);
  
  return transactions;
});
