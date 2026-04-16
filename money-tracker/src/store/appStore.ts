import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

interface Ledger {
  id: string
  name: string
  type: 'personal' | 'family' | 'project'
  owner_id: string
}

interface Transaction {
  id: string
  ledger_id: string
  user_id: string
  amount: number
  type: 'income' | 'expense'
  category: string
  note: string
  date: string
}

interface AppStore {
  user: User | null
  setUser: (user: User | null) => void

  currentLedger: Ledger | null
  setCurrentLedger: (ledger: Ledger | null) => void

  transactions: Transaction[]
  setTransactions: (transactions: Transaction[]) => void

  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // 弹窗状态（统一管理，解决时序问题）
  isQuickAddOpen: boolean
  openQuickAdd: () => void
  closeQuickAdd: () => void
}

// 从 localStorage 读取当前账本
function getStoredLedger(): Ledger | null {
  try {
    const raw = localStorage.getItem('qianji_current_ledger')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,

      setUser: (user) => set({ user }),

      // 初始化时尝试从 localStorage 恢复账本
      currentLedger: getStoredLedger(),

      setCurrentLedger: (ledger) => {
        if (ledger) {
          localStorage.setItem('qianji_current_ledger', JSON.stringify(ledger))
        }
        set({ currentLedger: ledger })
      },

      transactions: [],
      setTransactions: (transactions) => set({ transactions }),

      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // 弹窗状态
      isQuickAddOpen: false,
      openQuickAdd: () => set({ isQuickAddOpen: true }),
      closeQuickAdd: () => set({ isQuickAddOpen: false }),
    }),
    {
      name: 'qianji-store',
      // 只持久化 user（账本和弹窗状态不持久化）
      partialize: (state) => ({ user: state.user }),
    }
  )
)
