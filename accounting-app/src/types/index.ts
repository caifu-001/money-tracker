// 类型定义

export interface Transaction {
  id: string;
  userId?: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  synced?: number;
}

export interface Category {
  id: string;
  type: 'income' | 'expense';
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface Budget {
  id: string;
  userId?: string;
  category: string;
  amount: number;
  month: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Statistics {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categoryStats: Record<string, { income: number; expense: number }>;
  transactions: Transaction[];
}

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

// 扩展 Window 接口以包含 Electron API
declare global {
  interface Window {
    electronAPI?: {
      getTransactions: (filters?: TransactionFilters) => Promise<Transaction[]>;
      addTransaction: (transaction: Transaction) => Promise<void>;
      updateTransaction: (transaction: Transaction) => Promise<void>;
      deleteTransaction: (id: string) => Promise<void>;
      getCategories: (type?: 'income' | 'expense') => Promise<Category[]>;
      getBudgets: (month: string) => Promise<Budget[]>;
      setBudget: (budget: Budget) => Promise<void>;
      getStatistics: (startDate: string, endDate: string) => Promise<Statistics>;
      exportData: (format: string, startDate: string, endDate: string) => Promise<Transaction[]>;
    };
  }
}

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  type?: 'income' | 'expense';
}
