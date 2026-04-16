import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'admin' | 'user'
          status: 'active' | 'pending'
          created_at: string
        }
      }
      ledgers: {
        Row: {
          id: string
          name: string
          type: 'personal' | 'family' | 'project'
          owner_id: string
          created_at: string
        }
      }
      ledger_members: {
        Row: {
          id: string
          ledger_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          created_at: string
        }
      }
      transactions: {
        Row: {
          id: string
          ledger_id: string
          user_id: string
          amount: number
          type: 'income' | 'expense'
          category: string
          note: string
          date: string
          created_at: string
        }
      }
      budgets: {
        Row: {
          id: string
          ledger_id: string
          category: string
          amount: number
          month: number
          year: number
          created_at: string
        }
      }
      categories: {
        Row: {
          id: string
          ledger_id: string
          name: string
          icon: string
          type: 'income' | 'expense'
          created_at: string
        }
      }
    }
  }
}
