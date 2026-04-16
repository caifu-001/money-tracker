// Supabase 云同步服务
// 用户需要替换为自己的 Supabase 配置

import type { Transaction, Budget } from '../types'

// Supabase 配置
// 用户需要在 .env.local 中设置:
// VITE_SUPABASE_URL=your-project-url
// VITE_SUPABASE_ANON_KEY=your-anon-key

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

interface SupabaseUser {
  id: string
  email: string
}

interface SyncStatus {
  lastSync: string | null
  pending: number
}

class SupabaseService {
  private accessToken: string | null = null
  private user: SupabaseUser | null = null

  // 检查是否已配置
  isConfigured(): boolean {
    return SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''
  }

  // 注册
  async signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Supabase 未配置' }
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()
      
      if (response.ok) {
        return { success: true }
      } else {
        return { success: false, error: data.message || data.error_description || '注册失败' }
      }
    } catch (error) {
      return { success: false, error: '网络错误' }
    }
  }

  // 登录
  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Supabase 未配置' }
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()
      
      if (response.ok) {
        this.accessToken = data.access_token
        this.user = {
          id: data.user.id,
          email: data.user.email
        }
        return { success: true }
      } else {
        return { success: false, error: data.message || data.error_description || '登录失败' }
      }
    } catch (error) {
      return { success: false, error: '网络错误' }
    }
  }

  // 登出
  async signOut(): Promise<void> {
    this.accessToken = null
    this.user = null
  }

  // 获取当前用户
  getCurrentUser(): SupabaseUser | null {
    return this.user
  }

  // 同步交易记录到云端
  async syncTransactions(transactions: Transaction[]): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken || !this.user) {
      return { success: false, error: '未登录' }
    }

    try {
      const unsyncedTransactions = transactions.filter(t => !t.synced)
      
      if (unsyncedTransactions.length === 0) {
        return { success: true }
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${this.accessToken}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(unsyncedTransactions.map(t => ({
          id: t.id,
          user_id: this.user!.id,
          type: t.type,
          amount: t.amount,
          category: t.category,
          date: t.date,
          note: t.note,
          synced: true
        })))
      })

      if (response.ok) {
        return { success: true }
      } else {
        return { success: false, error: '同步失败' }
      }
    } catch (error) {
      return { success: false, error: '网络错误' }
    }
  }

  // 从云端获取交易记录
  async fetchTransactions(startDate?: string, endDate?: string): Promise<Transaction[]> {
    if (!this.accessToken || !this.user) {
      return []
    }

    try {
      let query = `${SUPABASE_URL}/rest/v1/transactions?user_id=eq.${this.user.id}&select=*&order=date.desc`
      
      if (startDate) {
        query += `&date=gte.${startDate}`
      }
      if (endDate) {
        query += `&date=lte.${endDate}`
      }

      const response = await fetch(query, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (response.ok) {
        return await response.json()
      }
      return []
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
      return []
    }
  }

  // 同步预算
  async syncBudgets(budgets: Budget[]): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken || !this.user) {
      return { success: false, error: '未登录' }
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/budgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${this.accessToken}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(budgets.map(b => ({
          id: b.id,
          user_id: this.user!.id,
          category: b.category,
          amount: b.amount,
          month: b.month
        })))
      })

      return { success: response.ok }
    } catch (error) {
      return { success: false, error: '网络错误' }
    }
  }

  // 获取同步状态
  async getSyncStatus(): Promise<SyncStatus> {
    if (!this.user) {
      return { lastSync: null, pending: 0 }
    }

    // 这里可以扩展实现更详细的同步状态
    return { lastSync: null, pending: 0 }
  }
}

export const supabaseService = new SupabaseService()
