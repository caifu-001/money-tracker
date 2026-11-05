import { supabase } from './supabase'

// 将用户名转换为内部邮箱格式
function usernameToEmail(username: string): string {
  // 如果已经是邮箱格式，直接返回
  if (username.includes('@')) {
    return username.toLowerCase()
  }
  // 用户名转为小写+@qianji.app后缀
  return username.toLowerCase() + '@qianji.app'
}

export const authService = {
  async signUp(usernameOrEmail: string, password: string, name: string) {
    const email = usernameToEmail(usernameOrEmail)
    const displayName = name || usernameOrEmail

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: displayName, username: usernameOrEmail }
      }
    })

    if (data.user && !error) {
      try {
        await supabase
          .from('users')
          .insert([{
            id: data.user.id,
            email: email,
            name: displayName,
            username: usernameOrEmail,
            role: 'user',
            status: 'pending'
          }])
      } catch (err) {
        console.error('Failed to create user record:', err)
      }
    }

    return { data, error }
  },

  async signIn(usernameOrEmail: string, password: string) {
    const email = usernameToEmail(usernameOrEmail)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    // 检查用户状态
    if (data.user && !error) {
      const { data: userData } = await supabase
        .from('users')
        .select('status')
        .eq('id', data.user.id)
        .single()
      
      if (userData?.status === 'pending') {
        await supabase.auth.signOut()
        return { data: null, error: new Error('账号正在等待管理员审核，请耐心等待') }
      }
      if (userData?.status === 'disabled') {
        await supabase.auth.signOut()
        return { data: null, error: new Error('账号已被禁用，请联系管理员') }
      }
    }

    return { data, error }
  },

  async signOut() {
    return await supabase.auth.signOut()
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  async resetPassword(usernameOrEmail: string) {
    const email = usernameToEmail(usernameOrEmail)
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`
    })
  },

  async updatePassword(newPassword: string) {
    return await supabase.auth.updateUser({ password: newPassword })
  },

  async sendOtp(email: string, username: string, password: string) {
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'
    const res = await fetch('https://abkscyijuvkfeazhlquz.supabase.co/functions/v1/send-otp', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ email, username, password })
    })
    return await res.json()
  },

  async verifyOtp(email: string, code: string) {
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'
    const res = await fetch('https://abkscyijuvkfeazhlquz.supabase.co/functions/v1/verify-otp', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ email, code })
    })
    return await res.json()
  }
}

export const ledgerService = {
  async createLedger(name: string, type: 'personal' | 'family' | 'project', userId: string) {
    try {
      // 1. 创建账本
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('ledgers')
        .insert([{ name, type, owner_id: userId }])
        .select()
      
      if (ledgerError) throw ledgerError
      if (!ledgerData || ledgerData.length === 0) throw new Error('Failed to create ledger')
      
      const ledgerId = ledgerData[0].id
      
      // 2. 自动添加创建者为账本所有者
      const { error: memberError } = await supabase
        .from('ledger_members')
        .insert([{ ledger_id: ledgerId, user_id: userId, role: 'owner' }])
      
      if (memberError) throw memberError
      
      return { data: ledgerData, error: null }
    } catch (error: any) {
      console.error('Create ledger error:', error)
      return { data: null, error }
    }
  },

  async getLedgers(userId: string) {
    try {
      // 查询用户拥有或是成员的所有账本
      const { data, error } = await supabase
        .from('ledger_members')
        .select('ledger_id, ledgers(id, name, type, owner_id, created_at)')
        .eq('user_id', userId)
      
      if (error) throw error
      
      // 提取账本数据
      const ledgers = data?.map((item: any) => item.ledgers).filter(Boolean) || []
      return { data: ledgers, error: null }
    } catch (error: any) {
      console.error('Get ledgers error:', error)
      return { data: null, error }
    }
  },

  async addMember(ledgerId: string, userId: string, role: 'owner' | 'editor' | 'viewer') {
    const { data, error } = await supabase
      .from('ledger_members')
      .insert([{ ledger_id: ledgerId, user_id: userId, role }])
      .select()
    return { data, error }
  },

  async updateMemberRole(ledgerId: string, userId: string, role: 'owner' | 'editor' | 'viewer') {
    const { data, error } = await supabase
      .from('ledger_members')
      .update({ role })
      .eq('ledger_id', ledgerId)
      .eq('user_id', userId)
      .select()
    return { data, error }
  },

  async removeMember(ledgerId: string, userId: string) {
    const { error } = await supabase
      .from('ledger_members')
      .delete()
      .eq('ledger_id', ledgerId)
      .eq('user_id', userId)
    return { error }
  }
}

export const transactionService = {
  async addTransaction(
    ledgerId: string,
    userId: string,
    amount: number,
    type: 'income' | 'expense',
    category: string,
    note: string,
    date: string,
    paymentMethod: string = 'cash'
  ) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          ledger_id: ledgerId,
          user_id: userId,
          amount,
          type,
          category,
          note,
          date,
          payment_method: paymentMethod
        }])
        .select()
      
      if (error) {
        console.error('Transaction insert error:', error)
        return { data: null, error }
      }
      
      return { data, error: null }
    } catch (err: any) {
      console.error('Transaction exception:', err)
      return { data: null, error: err }
    }
  },

  async getTransactions(ledgerId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('date', { ascending: false })

    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query
    return { data, error }
  },

  async updateTransaction(id: string, updates: any) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
    return { data, error }
  },

  async deleteTransaction(id: string) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
    return { error }
  }
}

export const budgetService = {
  async setBudget(ledgerId: string, category: string, amount: number, month: number, year: number) {
    const { data, error } = await supabase
      .from('budgets')
      .upsert([{
        ledger_id: ledgerId,
        category,
        amount,
        month,
        year
      }], { onConflict: 'ledger_id,category,month,year' })
      .select()
    return { data, error }
  },

  async getBudgets(ledgerId: string, month: number, year: number) {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('ledger_id', ledgerId)
      .eq('month', month)
      .eq('year', year)
    return { data, error }
  }
}
