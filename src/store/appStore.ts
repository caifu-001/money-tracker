import { create } from 'zustand'

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

  isQuickAddOpen: boolean
  openQuickAdd: () => void
  closeQuickAdd: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  currentLedger: null,
  setCurrentLedger: (ledger) => set({ currentLedger: ledger }),

  transactions: [],
  setTransactions: (transactions) => set({ transactions }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  isQuickAddOpen: false,
  openQuickAdd: () => set({ isQuickAddOpen: true }),
  closeQuickAdd: () => set({ isQuickAddOpen: false }),
}))