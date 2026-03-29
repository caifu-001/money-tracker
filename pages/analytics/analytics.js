// pages/analytics/analytics.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } = require('../../utils/categories')

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#64748b','#84cc16']

Page({
  data: {
    loading: true,
    timeRange: 'month',
    totalIncome: '0.00', totalExpense: '0.00', balance: '0.00', balanceNum: 0,
    expenseBreakdown: [],
    incomeBreakdown: [],
    dailyTrend: [],
    expenseCats: [],
    budgetStatus: [],
    monthLabel: '',
    // 设预算弹窗
    showBudgetModal: false,
    budgetCat: '',
    budgetIcon: '',
    budgetAmount: '',
    budgetSaving: false,
  },

  onLoad() {
    const now = new Date()
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      monthLabel: `${now.getFullYear()}年${now.getMonth()+1}月`
    })
    this.loadData()
  },

  setTime(e) {
    this.setData({ timeRange: e.currentTarget.dataset.range })
    this.loadData()
  },

  getDateRange() {
    const { year, month, timeRange } = this.data
    const now = new Date()
    let start, end
    if (timeRange === 'month') {
      start = `${year}-${String(month).padStart(2,'0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      end = `${year}-${String(month).padStart(2,'0')}-${lastDay}`
    } else if (timeRange === 'quarter') {
      const q = Math.floor((month - 1) / 3)
      start = `${year}-${String(q*3+1).padStart(2,'0')}-01`
      const lastDay = new Date(year, q*3+3, 0).getDate()
      end = `${year}-${String(q*3+3).padStart(2,'0')}-${lastDay}`
    } else {
      start = `${year}-01-01`
      end = `${year}-12-31`
    }
    return { start, end }
  },

  async loadData() {
    const { currentLedger, user } = app.globalData
    // user 可用于权限判断（部分查询已改为不过滤 user_id）
    = app.globalData
    if (!currentLedger) { this.setData({ loading: false }); return }
    this.setData({ loading: true })

    const { start, end } = this.getDateRange()

    let q = supabase.from('transactions').select('amount,type,category,date,user_id')
      .eq('ledger_id', currentLedger.id).gte('date', start).lte('date', end).order('date')
        const { data: txs } = await q

    const all = txs || []
    const income  = all.filter(t => t.type === 'income')
    const expense = all.filter(t => t.type === 'expense')

    const totalIncome  = income.reduce((s,t)=>s+Number(t.amount),0)
    const totalExpense = expense.reduce((s,t)=>s+Number(t.amount),0)
    const balanceNum = totalIncome - totalExpense

    // 支出分类统计
    const expMap = {}
    expense.forEach(t => {
      const key = t.category || '其他'
      expMap[key] = (expMap[key]||0) + Number(t.amount)
    })
    const expenseBreakdown = Object.entries(expMap)
      .sort((a,b)=>b[1]-a[1])
      .map(([category, amount], i) => {
        const preset = DEFAULT_EXPENSE_CATEGORIES.find(c=>c.name===category)
        return { category, icon: preset?.icon||'📌', amount: amount.toFixed(2), percent: Math.round(amount/totalExpense*100), color: COLORS[i%COLORS.length] }
      })

    // 收入分类统计
    const incMap = {}
    income.forEach(t => {
      const key = t.category || '其他'
      incMap[key] = (incMap[key]||0) + Number(t.amount)
    })
    const incomeBreakdown = Object.entries(incMap)
      .sort((a,b)=>b[1]-a[1])
      .map(([category, amount]) => {
        const preset = DEFAULT_INCOME_CATEGORIES.find(c=>c.name===category)
        return { category, icon: preset?.icon||'💰', amount: amount.toFixed(2), percent: Math.round(amount/totalIncome*100) }
      })

    // 每日趋势（最近15天）
    const dayMap = {}
    expense.forEach(t => {
      const d = t.date
      dayMap[d] = (dayMap[d]||0) + Number(t.amount)
    })
    const today = new Date().toISOString().split('T')[0]
    const days = Object.keys(dayMap).sort().slice(-15)
    const maxDayAmt = Math.max(...days.map(d=>dayMap[d]), 1)
    const dailyTrend = days.map(d => ({
      date: d, day: d.slice(-2), amount: dayMap[d].toFixed(2),
      barHeight: Math.max(4, Math.round(dayMap[d]/maxDayAmt*80)),
      isToday: d === today
    }))

    // 支出类别 + 是否已有预算
    const { year, month } = this.data
    const { data: budgets } = await supabase.from('budgets')
      .select('category,amount')
      .eq('ledger_id', currentLedger.id).eq('year',year).eq('month',month)
    const budgetMap = {}
    ;(budgets||[]).forEach(b => { budgetMap[b.category] = Number(b.amount) })

    const expenseCats = DEFAULT_EXPENSE_CATEGORIES.map(c => ({
      ...c, hasBudget: !!budgetMap[c.name]
    }))
    const budgetStatus = Object.entries(budgetMap).map(([category, amount]) => {
      const spent = expMap[category] || 0
      const preset = DEFAULT_EXPENSE_CATEGORIES.find(c=>c.name===category)
      return { category, icon: preset?.icon||'📌', amount, spent: spent.toFixed(2), percent: Math.round(spent/amount*100) }
    })

    this.setData({
      loading: false,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: balanceNum.toFixed(2),
      balanceNum,
      expenseBreakdown, incomeBreakdown,
      dailyTrend,
      expenseCats,
      budgetStatus,
    })
  },

  // ── 预算设置 ──
  openBudgetSet(e) {
    const { name, icon, has } = e.currentTarget.dataset
    this.setData({ showBudgetModal: true, budgetCat: name, budgetIcon: icon, budgetAmount: has ? '' : '', hasBudget: has })
  },
  closeBudgetModal() { this.setData({ showBudgetModal: false }) },
  onBudgetInput(e)  { this.setData({ budgetAmount: e.detail.value }) },

  async handleBudgetSave() {
    const { budgetAmount, budgetCat, budgetSaving } = this.data
    if (!budgetAmount) return wx.showToast({ title: '请输入预算金额', icon: 'none' })
    if (budgetSaving) return
    this.setData({ budgetSaving: true })
    try {
      const { currentLedger } = app.globalData
      const { year, month } = this.data
      const { error } = await supabase.from('budgets').upsert([{
        ledger_id: currentLedger.id, category: budgetCat,
        amount: parseFloat(budgetAmount), year, month
      }], { onConflict: 'ledger_id,category,month,year' })
      if (error) throw new Error(error.message)
      this.setData({ showBudgetModal: false })
      wx.showToast({ title: '预算已保存', icon: 'success' })
      this.loadData()
    } catch(e) {
      wx.showToast({ title: e.message||'保存失败', icon: 'none' })
    } finally {
      this.setData({ budgetSaving: false })
    }
  },
})
