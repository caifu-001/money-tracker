import { supabase } from './supabase'

// 将用户名转换为内部邮箱格式
function usernameToEmail(username: string): string {
  // 如果已经是邮箱格式，直接返回
  if (username.includes('@') && !username.endsWith('@qianji.app')) {
    return username
  }
  // 否则转换为内部邮箱
  return `${username.toLowerCase().replace(/\s+/g, '_')}@qianji.app`
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
      // 先检查是否已存在（避免重复插入）
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!existing) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            id: data.user.id,
            email: email,
            name: displayName,
            role: 'user',
            status: 'pending'   // 新用户默认待审核
          }])
        if (insertError) {
          console.error('Failed to create user record:', insertError)
        }
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
