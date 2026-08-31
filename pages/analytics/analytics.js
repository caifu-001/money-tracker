// pages/analytics/analytics.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } = require('../../utils/categories')

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#64748b','#84cc16']
const INCOME_COLORS = ['#22c55e','#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#064e3b','#052e16']
const PAYMENT_COLORS = ['#3b82f6','#06b6d4','#8b5cf6','#ec4899']

// 构建子分类名→一级大类映射（递归遍历4级分类树）
// 从数据库类别扁平列表构建 子分类→一级分类 映射
function buildCategoryToTopLevelMap(cats) {
  const catById = {}
  ;(cats || []).forEach(c => { catById[c.id] = c })
  function getTop(cat) {
    if (!cat.parent_id) return cat
    const parent = catById[cat.parent_id]
    return parent ? getTop(parent) : cat
  }
  const map = {}
  ;(cats || []).forEach(c => {
    const top = getTop(c)
    map[c.name] = { topName: top.name, topIcon: top.icon || '' }
  })
  return map
}

Page({
  data: {
    loading: true,
    isGuest: true,
    user: null,
    pieSize: 140,  // rpx -> px 换算（140rpx ≈ 70px，在2.6.1版本canvas宽高用px）
    incomeColors: INCOME_COLORS,
    paymentColors: PAYMENT_COLORS,
    timeRange: 'month',
    statMode: 'detail',  // detail=小类统计 summary=大类汇总
    totalIncome: '0.00', totalExpense: '0.00', balance: '0.00', balanceNum: 0,
    expenseBreakdown: [],
    incomeBreakdown: [],
    paymentBreakdown: [],
    filteredExpenseList: null,
    filteredIncomeList: null,
    filteredPaymentList: null,
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
    // 分类明细账单弹窗
    showDetail: false,
    detailTitle: '',
    detailType: '',   // expense | income | payment
    detailList: [],
  },

  onLoad() {
    const now = new Date()
    const user = app.globalData.user
    this.setData({
      isGuest: !user,
      user: user || null,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      monthLabel: `${now.getFullYear()}年${now.getMonth()+1}月`
    })
    if (user) this.loadData()
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
    } else if (range === 'all') {
      this.setData({ timeRange: 'all', showDateRange: false, monthLabel: '全部时间' })
      this.loadData()
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
    if (timeRange === 'all') {
      // 全部：不加日期过滤
      return { start: null, end: null }
    } else if (timeRange === 'custom') {
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
      // year
      start = `${year}-01-01`
      end = `${year}-12-31`
    }
    return { start, end }
  },

  // 筛选相关
  onSearchInput(e) {
    const searchCat = e && e.detail && e.detail.value || ''
    this.setData({ searchCat })
    // 防抖：等用户停止输入300ms后再过滤
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => this.applySearchFilter(), 300)
  },

  // 键盘确认（搜索键）立即触发过滤，解决中文输入法拼音组合期间匹配失败问题
  onSearchConfirm() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.applySearchFilter()
  },

  applySearchFilter() {
    const { searchCat, expenseBreakdown = [], incomeBreakdown = [], paymentBreakdown = [] } = this.data
    const sc = (searchCat || '').trim()
    if (!sc) {
      this.setData({ filteredExpenseList: null, filteredIncomeList: null, filteredPaymentList: null })
      return
    }
    const lower = sc.toLowerCase()
    const filteredExpenseList = expenseBreakdown.filter(e => e && e.category && e.category.toLowerCase().includes(lower))
    const filteredIncomeList = incomeBreakdown.filter(e => e && e.category && e.category.toLowerCase().includes(lower))
    const filteredPaymentList = paymentBreakdown.filter(e => e && ((e.method && e.method.toLowerCase().includes(lower)) || (e.label && e.label.toLowerCase().includes(lower))))
    this.setData({ filteredExpenseList, filteredIncomeList, filteredPaymentList })
  },

  clearSearch() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.setData({ searchCat: '', catFilter: '', filteredExpenseList: null, filteredIncomeList: null, filteredPaymentList: null })
    this.loadData()
  },

  switchStatMode(e) {
    const mode = e.currentTarget.dataset.mode
    console.log('[switchStatMode] clicked mode=', mode, 'current=', this.data.statMode)
    if (mode === this.data.statMode) return
    this.setData({ statMode: mode })
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

  // ── 分类明细账单弹窗 ──
  // 点击分类项，展示该分类（或支付方式）下的详细账单列表
  openCategoryDetail(e) {
    const { cat, type } = e.currentTarget.dataset
    const all = this._allTx || []
    let list = []
    let title = ''
    if (type === 'payment') {
      const method = e.currentTarget.dataset.method
      list = all.filter(t => t.type === 'expense' && (t.payment_method || 'other') === method)
      const PM_MAP = { cash:'💵 现金', wechat:'💚 微信', alipay:'💙 支付宝', bankcard:'💳 银行卡', other:'💠 其他' }
      title = (PM_MAP[method] || method) + ' 账单'
    } else {
      // expense | income：按类名过滤
      // 大类（summary）模式下，把大类展开成所有后代叶子类名，避免漏掉子类流水
      const names = this._expandCategoryNames(cat, type)
      list = all.filter(t => t.type === type && names.has(t.category))
      title = cat + ' 账单'
    }
    // 按日期降序排列
    list = list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    const PM_DISPLAY = { cash:'现金', wechat:'微信', alipay:'支付宝', bankcard:'银行卡', other:'其他' }
    const detailList = list.map(t => ({
      id: t.id,
      amount: Number(t.amount).toFixed(2),
      type: t.type,
      date: t.date,
      note: t.note || '',
      paymentDisplay: PM_DISPLAY[t.payment_method] || '其他',
    }))
    this.setData({
      showDetail: true,
      detailTitle: title,
      detailType: type,
      detailList,
    })
  },

  // 展开某类名为其自身 + 所有后代叶子类名（用于大类点击时覆盖全部子类流水）
  _expandCategoryNames(cat, type) {
    const cats = this._cats || []
    const names = new Set()
    names.add(cat)
    const catById = {}
    cats.forEach(c => { catById[c.id] = c })
    // 找到该类名对应的分类节点（可能有同名，取第一个匹配 type 的）
    const node = cats.find(c => c.name === cat && c.type === type)
    if (node) {
      // BFS 收集所有后代名称
      const queue = [node.id]
      while (queue.length) {
        const id = queue.shift()
        const children = cats.filter(c => c.parent_id === id)
        children.forEach(ch => {
          names.add(ch.name)
          queue.push(ch.id)
        })
      }
    }
    return names
  },

  closeDetail() {
    this.setData({ showDetail: false })
  },

  // 点击账单跳转 home 页编辑
  editTransaction(e) {
    const id = e.currentTarget.dataset.id
    const all = this._allTx || []
    const tx = all.find(t => t.id === id)
    // 通过 globalData 传递待编辑账单 id + 日期，switchTab 到 home
    app.globalData.pendingEditTxId = id
    app.globalData.pendingEditTxDate = tx ? tx.date : ''
    wx.switchTab({ url: '/pages/home/home' })
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

    let q = supabase.from('transactions').select('id,amount,type,category,date,user_id,payment_method,note')
      .eq('ledger_id', currentLedger.id).order('date')
    // 非「全部」时才加日期范围过滤
    if (start && end) {
      q = q.gte('date', start).lte('date', end)
    }
    
    // 类别筛选
    if (catFilter) {
      q = q.eq('category', catFilter)
    }

    const { data: txs } = await q

    const all = txs || []
    // 缓存完整流水列表，供分类明细弹窗过滤
    this._allTx = all
    const income  = all.filter(t => t.type === 'income')
    const expense = all.filter(t => t.type === 'expense')

    const totalIncome  = income.reduce((s,t)=>s+Number(t.amount),0)
    const totalExpense = expense.reduce((s,t)=>s+Number(t.amount),0)
    const balanceNum = totalIncome - totalExpense

    // 收集所有类别
    const catSet = new Set()
    all.forEach(t => catSet.add(t.category))
    const allCategories = Array.from(catSet)

    // 获取该账本的类别（含自定义 + 默认）
    const { data: cats } = await supabase.from('categories')
      .select('*').eq('ledger_id', currentLedger.id)
    this._cats = cats || []

    // 支出分类统计
    const expMap = {}
    const expenseSubMap = {}
    const useSummary = this.data.statMode === 'summary'
    console.log('[loadData] statMode=', this.data.statMode, 'useSummary=', useSummary)
    if (useSummary) {
      const catMap = buildCategoryToTopLevelMap((cats || []).filter(c => c.type === 'expense'))
      expense.forEach(t => {
        const key = t.category || '其他'
        const mapped = catMap[key]
        const topKey = mapped ? mapped.topName : key
        expMap[topKey] = (expMap[topKey]||0) + Number(t.amount)
        if (!expenseSubMap[topKey]) expenseSubMap[topKey] = {}
        expenseSubMap[topKey][key] = (expenseSubMap[topKey][key]||0) + Number(t.amount)
      })
    } else {
      expense.forEach(t => {
        const key = t.category || '其他'
        expMap[key] = (expMap[key]||0) + Number(t.amount)
      })
    }
    const expenseBreakdown = Object.entries(expMap)
      .sort((a,b)=>b[1]-a[1])
      .map(([category, amount], i) => {
        const preset = DEFAULT_EXPENSE_CATEGORIES.find(c=>c.name===category)
        return { category, icon: preset ? preset.icon : '📌', amount: amount.toFixed(2), percent: totalExpense ? Math.round(amount/totalExpense*100) : 0, color: COLORS[i%COLORS.length] }
      })
    // 汇总模式下，给每个顶级类别加上子类目明细
    if (useSummary) {
      expenseBreakdown.forEach(item => {
        const subs = expenseSubMap[item.category] || {}
        item.subItems = Object.entries(subs)
          .sort((a,b)=>b[1]-a[1])
          .map(([subCat, subAmt]) => {
            const preset = DEFAULT_EXPENSE_CATEGORIES.find(c=>c.name===subCat)
            return {
              category: subCat,
              icon: preset ? preset.icon : '📌',
              amount: subAmt.toFixed(2),
              percent: item.amount > 0 ? Math.round(subAmt/Number(item.amount)*100) : 0
            }
          })
      })
    }

    // 收入分类统计
    const incMap = {}
    if (useSummary) {
      const catMap = buildCategoryToTopLevelMap((cats || []).filter(c => c.type === 'income'))
      income.forEach(t => {
        const key = t.category || '其他'
        const mapped = catMap[key]
        const topKey = mapped ? mapped.topName : key
        incMap[topKey] = (incMap[topKey]||0) + Number(t.amount)
      })
    } else {
      income.forEach(t => {
        const key = t.category || '其他'
        incMap[key] = (incMap[key]||0) + Number(t.amount)
      })
    }
    const incomeBreakdown = Object.entries(incMap)
      .sort((a,b)=>b[1]-a[1])
      .map(([category, amount], i) => {
        const preset = DEFAULT_INCOME_CATEGORIES.find(c=>c.name===category)
        return { category, icon: preset ? preset.icon : '💰', amount: amount.toFixed(2), percent: totalIncome ? Math.round(amount/totalIncome*100) : 0, index: i }
      })

    // 每日支出趋势
    const dayMap = {}
    expense.forEach(t => {
      const d = t.date
      dayMap[d] = (dayMap[d]||0) + Number(t.amount)
    })
    const today = (() => { const d = new Date(Date.now() + 8*3600000); return d.toISOString().split('T')[0] })()
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
    // 「全部」时间范围下，预算不按当前年月过滤，取该账本全部预算
    let budgetQuery = supabase.from('budgets')
      .select('category,amount,year,month')
      .eq('ledger_id', currentLedger.id)
    if (timeRange !== 'all') {
      budgetQuery = budgetQuery.eq('year', year).eq('month', month)
    }
    const { data: budgets } = await budgetQuery
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

    // 先写入全量数据，再走统一的 applySearchFilter 过滤
    this.setData({
      loading: false,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: balanceNum.toFixed(2),
      balanceNum,
      expenseBreakdown: expenseBreakdown,
      incomeBreakdown: incomeBreakdown,
      dailyTrend,
      incomeTrend,
      expenseCats,
      budgetStatus,
      allCategories,
      paymentBreakdown,
    }, () => {
      // setData 回调中执行搜索过滤，此时 this.data 已是最新
      this.applySearchFilter()
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

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },
})
