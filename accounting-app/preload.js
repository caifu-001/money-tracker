const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 交易记录
  getTransactions: (filters) => ipcRenderer.invoke('get-transactions', filters),
  addTransaction: (transaction) => ipcRenderer.invoke('add-transaction', transaction),
  updateTransaction: (transaction) => ipcRenderer.invoke('update-transaction', transaction),
  deleteTransaction: (id) => ipcRenderer.invoke('delete-transaction', id),
  
  // 类别
  getCategories: (type) => ipcRenderer.invoke('get-categories', type),
  
  // 预算
  getBudgets: (month) => ipcRenderer.invoke('get-budgets', month),
  setBudget: (budget) => ipcRenderer.invoke('set-budget', budget),
  
  // 统计
  getStatistics: (startDate, endDate) => ipcRenderer.invoke('get-statistics', startDate, endDate),
  
  // 导出
  exportData: (format, startDate, endDate) => ipcRenderer.invoke('export-data', format, startDate, endDate),
});
