// pages/analytics/analytics.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } = require('../../utils/categories')

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#64748b','#84cc16']
const INCOME_COLORS = ['#22c55e','#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#064e3b','#052e16']
const PAYMENT_COLORS = ['#3b82f6','#06b6d4','#8b5cf6','#ec4899']

Page({
  data: {
    loading: true,
    pieSize: 140,  // rpx -> px 换算（140rpx ≈ 70px，在2.6.1版本canvas宽高用px）
    incomeColors: INCOME_COLORS,
    paymentColors: PAYMENT_COLORS,
    timeRange: 'month',
    totalIncome: '0.00', totalExpense: '0.00', balance: '0.00', balanceNum: 0,
    expenseBreakdown: [],
    incomeBreakdown: [],
    dailyTrend: [],
    expenseCats: [],
    budgetStatus: [],
    paymentBreakdown: [],  // 支付方式统计
    monthLabel: '',
    // 筛选
    searchCat: '',
    catFilter: '',
    allCategories: [],
    showCatFilter: false,
    // 分析类型切换
    viewType: 'expense',  // expense | income | payment
    // 设预算弹窗
    showBudgetModal: false,
    budgetCat: '',
    budgetIcon: '',
    budgetAmount: '',
    budgetSaving: false,
    // 月份切换
    year: 2026,
    month: 1,
    showMonthPicker: false,
    // 自定义时间段
    showDateRange: false,
    customStartDate: '',
    customEndDate: '',
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

  onShow() {
    console.log('[Analytics onShow] globalData.currentLedger:', app.globalData.currentLedger)
    console.log('[Analytics onShow] this.data.year/month:', this.data.year, this.data.month)
    // 兜底：确保年月已初始化，防止 onShow 先于 onLoad 的 setData 执行
    if (!this.data.year || !this.data.month) {
      const now = new Date()
      this.setData({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        monthLabel: `${now.getFullYear()}年${now.getMonth()+1}月`
      })
    }
    this.loadData()
  },

  setTime(e) {
    const range = e.currentTarget.dataset.range
    if (range === 'custom') {
      this.setData({ timeRange: 'custom', showDateRange: true })
    } else {
      this.setData({ timeRange: range, showDateRange: false })
      this.loadData()
    }
  },

  onStartDateChange(e) {
    this.setData({ customStartDate: e.detail.value })
  },

  onEndDateChange(e) {
    this.setData({ customEndDate: e.detail.value })
  },

  applyCustomRange() {
    const { customStartDate, customEndDate } = this.data
    if (!customStartDate || !customEndDate) {
      wx.showToast({ title: '请选择日期范围', icon: 'none' })
      return
    }
    this.setData({ timeRange: 'custom', showDateRange: false, monthLabel: `${customStartDate} 至 ${customEndDate}` })
    this.loadData()
  },

  cancelCustomRange() {
    this.setData({ showDateRange: false })
  },

  switchView(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ viewType: type })
  },

  prevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month, monthLabel: `${year}年${month}月` })
    this.loadData()
  },

  nextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month, monthLabel: `${year}年${month}月` })
    this.loadData()
  },

  getDateRange() {
    const { year, month, timeRange, customStartDate, customEndDate } = this.data
    const now = new Date()
    let start, end
    if (timeRange === 'custom') {
      start = customStartDate
      end = customEndDate
    } else if (timeRange === 'month') {
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

  // 筛选相关
  onSearchInput(e) {
    this.setData({ searchCat: e.detail.value })
  },

  clearSearch() {
    this.setData({ searchCat: '', catFilter: '' })
    this.loadData()
  },

  toggleCatFilter() {
    this.setData({ showCatFilter: !this.data.showCatFilter })
  },

  selectCatFilter(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ catFilter: this.data.catFilter === cat ? '' : cat, showCatFilter: false })
    this.loadData()
  },

  async loadData() {
    const { currentLedger, user } = app.globalData
    const { year, month, timeRange } = this.data
    const { start, end } = this.getDateRange()
    console.log('[Analytics loadData]', {
      currentLedger: currentLedger ? { id: currentLedger.id, name: currentLedger.name } : null,
      year, month, timeRange,
      dateRange: { start, end }
    })
    if (!currentLedger) {
      console.log('[Analytics] ❌ currentLedger 为空，退出')
      this.setData({ loading: false })
      return
    }
    this.setData({ loading: true })
    const { catFilter } = this.data

    let q = supabase.from('transactions').select('amount,type,category,date,user_id,payment_method')
      .eq('ledger_id', currentLedger.id).gte('date', start).lte('date', end).order('date')
    
    // 类别筛选
    if (catFilter) {
      q = q.eq('category', catFilter)
    }

    const { data: txs } = await q

    const all = txs || []
    const income  = all.filter(t => t.type === 'income')
    const expense = all.filter(t => t.type === 'expense')

    const totalIncome  = income.reduce((s,t)=>s+Number(t.amount),0)
    const totalExpense = expense.reduce((s,t)=>s+Number(t.amount),0)
    const balanceNum = totalIncome - totalExpense

    // 收集所有类别
    const catSet = new Set()
    all.forEach(t => catSet.add(t.category))
    const allCategories = Array.from(catSet)

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
        return { category, icon: preset ? preset.icon : '📌', amount: amount.toFixed(2), percent: totalExpense ? Math.round(amount/totalExpense*100) : 0, color: COLORS[i%COLORS.length] }
      })

    // 收入分类统计
    const incMap = {}
    income.forEach(t => {
      const key = t.category || '其他'
      incMap[key] = (incMap[key]||0) + Number(t.amount)
    })
    const incomeBreakdown = Object.entries(incMap)
      .sort((a,b)=>b[1]-a[1])
      .map(([category, amount], i) => {
        const preset = DEFAULT_INCOME_CATEGORIES.find(c=>c.name===category)
        return { category, icon: preset ? preset.icon : '💰', amount: amount.toFixed(2), percent: totalIncome ? Math.round(amount/totalIncome*100) : 0, index: i }
      })

    // 搜索过滤（仅影响列表，不影响饼图）
    const { searchCat } = this.data
    const filteredExpenses = searchCat ? expenseBreakdown.filter(e => e.category.includes(searchCat)) : null
    // 每日支出趋势
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

    // 每日收入趋势
    const incomeDayMap = {}
    income.forEach(t => {
      const d = t.date
      incomeDayMap[d] = (incomeDayMap[d]||0) + Number(t.amount)
    })
    const incomeDays = Object.keys(incomeDayMap).sort().slice(-15)
    const maxIncomeDayAmt = Math.max(...incomeDays.map(d=>incomeDayMap[d]), 1)
    const incomeTrend = incomeDays.map(d => ({
      date: d, day: d.slice(-2), amount: incomeDayMap[d].toFixed(2),
      barHeight: Math.max(4, Math.round(incomeDayMap[d]/maxIncomeDayAmt*80)),
      isToday: d === today
    }))

    // 支出类别 + 是否已有预算（year, month 已在函数开头声明）
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
      return { category, icon: preset ? preset.icon : '📌', amount, spent: spent.toFixed(2), percent: amount ? Math.round(spent/amount*100) : 0 }
    })

    // 支付方式统计（仅支出）
    const PM_MAP = { cash:'💵 现金', wechat:'💚 微信', alipay:'💙 支付宝', bankcard:'💳 银行卡', other:'💠 其他' }
    const pmColors = { cash:'#f59e0b', wechat:'#22c55e', alipay:'#3b82f6', bankcard:'#8b5cf6', other:'#6b7280' }
    const pmMap = {}
    expense.forEach(t => {
      const pm = t.payment_method || 'other'
      pmMap[pm] = (pmMap[pm]||0) + Number(t.amount)
    })
    const paymentBreakdown = Object.entries(pmMap)
      .sort((a,b)=>b[1]-a[1])
      .map(([method, amount], i) => ({
        method, label: PM_MAP[method] || method,
        icon: (PM_MAP[method] || '💠').split(' ')[0],
        amount: amount.toFixed(2),
        percent: totalExpense ? Math.round(amount/totalExpense*100) : 0,
        color: pmColors[method] || pmColors.other,
        index: i
      }))

    this.setData({
      loading: false,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: balanceNum.toFixed(2),
      balanceNum,
      expenseBreakdown: expenseBreakdown,     // 全部数据（饼图+图例）
      filteredExpenseList: filteredExpenses, // 搜索过滤后的列表（无搜索时为null）
      incomeBreakdown: incomeBreakdown,
      dailyTrend,
      incomeTrend,  // 收入趋势
      expenseCats,
      budgetStatus,
      allCategories,
      paymentBreakdown,
    })
  },



  // ── 预算设置 ──
  openBudgetSet(e) {
    const { name, icon, has } = e.currentTarget.dataset
    this.setData({ showBudgetModal: true, budgetCat: name, budgetIcon: icon, budgetAmount: '', hasBudget: has })
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
