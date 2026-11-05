// pages/analytics/analytics.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } = require('../../utils/categories')
const { formatMoney, baseAmountOf, resolveBaseCurrency, getSymbol, isPending, getReferenceAmount, currencyOf, round2 } = require('../../utils/currency')
const { isTransfer } = require('../../utils/accounts')
const { isLoan, isLoanOut, counterpartyOf, loanDirectionOf, summarizeLoans, groupByCounterparty } = require('../../utils/loans')

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#64748b','#84cc16']
const INCOME_COLORS = ['#22c55e','#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#064e3b','#052e16']
const PAYMENT_COLORS = ['#3b82f6','#06b6d4','#8b5cf6','#ec4899']
const ACCOUNT_COLORS = ['#6366f1','#f59e0b','#10b981','#06b6d4','#ec4899','#8b5cf6','#84cc16','#f97316','#14b8a6','#64748b']

// 账户维度里「未绑定账户」的占位 key（历史数据可能 account_id 为空）
const NO_ACCOUNT_KEY = '__none__'

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
    // 多币种：所有统计统一按账本本位币口径（base_amount）
    baseCurrency: 'CNY', baseSymbol: '¥',
    // 外币待结算（未入账，不计入统计）
    pendingCount: 0, pendingRefTotal: 0, pendingRefText: '0.00',
    // 待结算明细弹窗（点上方提示条打开）
    showPending: false,
    pendingDetailList: [],
    expenseBreakdown: [],
    incomeBreakdown: [],
    paymentBreakdown: [],
    searchResultList: null,
    searchResultKind: '',
    dailyTrend: [],
    expenseCats: [],
    budgetStatus: [],
    // 资金账户维度（转账不计收支，单独成区展示）
    accountColors: ACCOUNT_COLORS,
    accountBreakdown: [],        // 支出按资金账户
    accountIncomeBreakdown: [],  // 收入按资金账户
    transferList: [],            // 转账流水（账户 → 账户）
    transferCount: 0,
    transferTotalNum: 0,
    transferTotalText: '0.00',
    monthLabel: '',
    // 筛选
    searchCat: '',
    allCategories: [],
    // 分类目录筛选
    showCatFilter: false,
    filterType: 'expense',
    filterExpenseTree: [],
    filterIncomeTree: [],
    catFilterId: '',
    catFilterName: '',
    catFilterType: '',
    catFilterNames: [],
    // 一级视图：💸 支出 / 💰 收入 / 🏦 账户 / 🤝 借款
    // （支付方式降级为支出内的分组维度）
    viewType: 'expense',  // expense | income | account | loan
    // 支出视图内的分组维度：category=按分类 | payment=按支付方式
    expenseDim: 'category',
    // 搜索框提示（随当前视图/维度变化，避免"搜索类别"却搜支付方式的困惑）
    searchPlaceholder: '搜索类别…',
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
    // ── 借款（022）──
    // 欠款是存量概念：用**全量**借款计算，不受月份/时间段筛选影响，
    // 否则切到某个月就只能看到那个月借出去的钱，得不出「张三欠我多少」。
    loanSummary: {
      lendTotal: 0, borrowTotal: 0, net: 0,
      lendCount: 0, borrowCount: 0, count: 0,
      lendText: '0.00', borrowText: '0.00', netText: '0.00', netPositive: false,
      receivableText: '0.00', payableText: '0.00',
    },
    loanParties: [],
    loanPartyCount: 0,
    loanOpenCount: 0,
    // 单个对方的借款明细弹窗
    showLoanDetail: false,
    loanDetailTitle: '',
    loanDetailList: [],
    loanDetailNetText: '',
    loanDetailNetLabel: '',
    loanDetailKind: 'settled',
  },

  // 账本本位币字段
  _baseFields(ledger) {
    const baseCurrency = resolveBaseCurrency(ledger)
    return { baseCurrency, baseSymbol: getSymbol(baseCurrency) }
  },

  onLoad() {
    const now = new Date()
    const user = app.globalData.user
    this.setData({
      isGuest: !user,
      user: user || null,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      monthLabel: `${now.getFullYear()}年${now.getMonth()+1}月`,
      ...this._baseFields(app.globalData.currentLedger),
    })
    if (user) this.loadData()
  },

  onShow() {
    if (app.globalData.currentLedger) this.setData(this._baseFields(app.globalData.currentLedger))
    // 首页「借款明细」入口：分析页是 tabBar 页面，switchTab 不能带 query，
    // 用 globalData 传递「进来后切到哪个视图」的意图，消费后立刻清空。
    const pendingTab = app.globalData.analyticsPendingTab
    if (pendingTab) {
      app.globalData.analyticsPendingTab = null
      this.setData({
        viewType: pendingTab,
        searchPlaceholder: pendingTab === 'loan' ? '搜索对方…' : this.data.searchPlaceholder,
      })
    }
    console.log('[Analytics onShow] globalData.currentLedger:', app.globalData.currentLedger)
    console.log('[Analytics onShow] this.data.year/month:', this.data.year, this.data.month)
    const user = app.globalData.user
    if (user && user.id) app.checkAccountStatus()
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
    if (type === this.data.viewType) return
    const searchPlaceholder =
      type === 'income' ? '搜索收入类别…'
      : type === 'account' ? '搜索账户…'
      : type === 'loan' ? '搜索对方…'
      : (this.data.expenseDim === 'payment' ? '搜索支付方式…' : '搜索类别…')
    this.setData({ viewType: type, searchPlaceholder }, () => this.applySearchFilter())
  },

  // 支出视图内切换分组维度：按分类 / 按支付方式
  switchExpenseDim(e) {
    const dim = e.currentTarget.dataset.dim
    if (dim === this.data.expenseDim) return
    this.setData({
      expenseDim: dim,
      searchPlaceholder: dim === 'payment' ? '搜索支付方式...' : '搜索类别...',
    }, () => this.applySearchFilter())
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

  // 统一的搜索过滤：按当前视图（+支出分组维度）决定匹配维度，产出单一结果列表
  applySearchFilter() {
    const { searchCat, viewType, expenseDim,
      expenseBreakdown = [], incomeBreakdown = [], paymentBreakdown = [],
      accountBreakdown = [], accountIncomeBreakdown = [] } = this.data
    const sc = (searchCat || '').trim()
    if (!sc) {
      this.setData({ searchResultList: null, searchResultKind: '' })
      return
    }
    const lower = sc.toLowerCase()
    // 借款视图：按「对方」搜索，结果是净欠款而不是占比
    if (viewType === 'loan') {
      const list = (this.data.loanParties || []).filter(p => p && p.party && p.party.toLowerCase().includes(lower))
      this.setData({
        searchResultKind: 'loan',
        searchResultList: list.map(p => ({
          name: p.party,
          icon: '🤝',
          amount: p.netText,
          percent: p.netLabel,
          cls: 'loan',
          sign: '',
        })),
      })
      return
    }
    let raw = []
    let kind = 'expense'
    let cls = 'expense'
    let sign = '-'
    if (viewType === 'expense') {
      if (expenseDim === 'payment') {
        kind = 'payment'
        raw = paymentBreakdown.filter(e => e && ((e.method && e.method.toLowerCase().includes(lower)) || (e.label && e.label.toLowerCase().includes(lower))))
      } else {
        raw = expenseBreakdown.filter(e => e && e.category && e.category.toLowerCase().includes(lower))
      }
    } else if (viewType === 'income') {
      kind = 'income'; cls = 'income'; sign = '+'
      raw = incomeBreakdown.filter(e => e && e.category && e.category.toLowerCase().includes(lower))
    } else {
      kind = 'account'; cls = 'account'; sign = ''
      raw = []
        .concat(accountBreakdown, accountIncomeBreakdown)
        .filter(e => e && e.category && e.category.toLowerCase().includes(lower))
        // 同一账户可能在收支两侧各出现一次，合并成一条
        .filter((e, i, arr) => arr.findIndex(x => x.accId === e.accId) === i)
    }
    const searchResultList = raw.map(e => ({
      name: e.category || e.label,
      icon: e.icon || '📌',
      amount: e.amount,
      percent: e.percent,
      cls,
      sign,
    }))
    this.setData({ searchResultList, searchResultKind: kind })
  },

  clearSearch() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.setData({ searchCat: '', searchResultList: null, searchResultKind: '' })
    this.loadData()
  },

  switchStatMode(e) {
    const mode = e.currentTarget.dataset.mode
    console.log('[switchStatMode] clicked mode=', mode, 'current=', this.data.statMode)
    if (mode === this.data.statMode) return
    this.setData({ statMode: mode })
    this.loadData()
  },

  // ── 分类目录筛选 ──
  // 构建分类树（用于筛选选择器）
  _buildTree(cats, type) {
    const map = {}
    const roots = []
    const filtered = (cats || []).filter(c => c.type === type)
    filtered.forEach(c => {
      map[c.id] = { id: c.id, name: c.name, icon: c.icon || '📌', type: c.type, children: [], expanded: false, depth: 0 }
    })
    filtered.forEach(c => {
      const node = map[c.id]
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(node)
      else if (!c.parent_id) roots.push(node)
    })
    // 递归标注层级深度（根=1），供缩进 + WXML 字面量属性访问
    const setDepth = (node, depth) => {
      node.depth = depth
      node.children.forEach(ch => setDepth(ch, depth + 1))
    }
    roots.forEach(r => setDepth(r, 1))
    return roots
  },

  // 收集某分类节点 + 所有后代的名字集合（用于过滤流水）
  _collectCategoryNames(id) {
    const cats = this._cats || []
    const names = []
    const queue = [id]
    while (queue.length) {
      const cid = queue.shift()
      const node = cats.find(c => c.id === cid)
      if (node) {
        names.push(node.name)
        cats.filter(c => c.parent_id === cid).forEach(ch => queue.push(ch.id))
      }
    }
    return names
  },

  toggleCatFilter() {
    const { viewType } = this.data
    this.setData({
      showCatFilter: true,
      filterType: viewType === 'income' ? 'income' : 'expense',
    })
  },

  closeCatFilter() {
    this.setData({ showCatFilter: false })
  },

  setFilterType(e) {
    this.setData({ filterType: e.currentTarget.dataset.type })
  },

  toggleFilterExpand(e) {
    const id = e.currentTarget.dataset.id
    const treeKey = this.data.filterType === 'income' ? 'filterIncomeTree' : 'filterExpenseTree'
    const tree = this.data[treeKey] || []
    // 递归定位节点并翻转 expanded（WXML 用 n.expanded 字面量属性读取，不能用 filterExpanded[id] 动态键）
    const update = (nodes) => nodes.map(n => {
      if (n.id === id) return { ...n, expanded: !n.expanded }
      if (n.children && n.children.length) return { ...n, children: update(n.children) }
      return n
    })
    this.setData({ [treeKey]: update(tree) })
  },

  selectFilterNode(e) {
    const { id, name, type } = e.currentTarget.dataset
    const names = this._collectCategoryNames(id)
    this.setData({
      catFilterId: id,
      catFilterName: name,
      catFilterType: type,
      catFilterNames: names,
      showCatFilter: false,
    })
    this.loadData()
  },

  clearCatFilter() {
    this.setData({
      catFilterId: '', catFilterName: '', catFilterType: '', catFilterNames: [],
    })
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
      amount: formatMoney(baseAmountOf(t), this.data.baseCurrency, { symbol: false }),
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

  // 账户明细：点击某资金账户 → 展示该账户下的支出/收入流水
  openAccountDetail(e) {
    const { id, name, flow } = e.currentTarget.dataset
    const all = this._allTx || []
    const key = id || NO_ACCOUNT_KEY
    const list = all
      .filter(t => t.type === flow && (t.account_id || NO_ACCOUNT_KEY) === key)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    const PM_DISPLAY = { cash:'现金', wechat:'微信', alipay:'支付宝', bankcard:'银行卡', other:'其他' }
    const detailList = list.map(t => ({
      id: t.id,
      amount: formatMoney(baseAmountOf(t), this.data.baseCurrency, { symbol: false }),
      type: t.type,
      date: t.date,
      note: t.note || '',
      paymentDisplay: PM_DISPLAY[t.payment_method] || '其他',
    }))
    this.setData({
      showDetail: true,
      detailTitle: `${name} · ${flow === 'income' ? '收入' : '支出'}账单`,
      detailType: 'account',
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

  // 点「外币待结算」提示条 → 查看是哪几笔（不计入统计的账目）
  openPendingDetail() {
    if (!this.data.pendingDetailList || this.data.pendingDetailList.length === 0) return
    this.setData({ showPending: true })
  },

  closePending() {
    this.setData({ showPending: false })
  },

  // ── 借款明细（按对方看每一笔借出 / 借入）──
  openLoanDetail(e) {
    const party = e.currentTarget.dataset.party
    const p = (this.data.loanParties || []).find(x => x.party === party)
    if (!p) return
    this.setData({
      showLoanDetail: true,
      loanDetailTitle: p.party,
      loanDetailList: p.items || [],
      loanDetailNetText: p.netText,
      loanDetailNetLabel: p.netLabel,
      loanDetailKind: p.kind,
    })
  },
  closeLoanDetail() { this.setData({ showLoanDetail: false }) },

  // 点某笔借款 → 回首页编辑（与其它明细一致，走 globalData 传递）
  editLoanTx(e) {
    const { id, date } = e.currentTarget.dataset
    app.globalData.pendingEditTxId = id
    app.globalData.pendingEditTxDate = date || ''
    this.setData({ showLoanDetail: false })
    wx.switchTab({ url: '/pages/home/home' })
  },

  // 点「转账」提示条 → 直接跳到账户视图看转账流水
  goAccountView() {
    this.setData({ viewType: 'account', searchPlaceholder: '搜索账户...' }, () => this.applySearchFilter())
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
    const { catFilterNames } = this.data

    let q = supabase.from('transactions').select('id,amount,base_amount,reference_amount,currency,settlement_status,type,category,date,user_id,payment_method,note,account_id,to_account_id')
      .eq('ledger_id', currentLedger.id).order('date')
    // 非「全部」时才加日期范围过滤
    if (start && end) {
      q = q.gte('date', start).lte('date', end)
    }
    
    // 分类目录筛选：选中分类 + 所有后代的名字集合
    if (catFilterNames && catFilterNames.length > 0) {
      q = q.in('category', catFilterNames)
    }

    const { data: txs } = await q

    const all = txs || []
    // 缓存完整流水列表，供分类明细弹窗过滤
    this._allTx = all
    // 借款不是消费也不是收入：从收支两侧剔除，只在「借款」视图出现。
    // 这样下面所有聚合（占比 / 趋势 / 支付方式 / 账户）自动不受借款影响，
    // 不需要逐个聚合点加判断。
    const loans = all.filter(t => isLoan(t))
    const income  = all.filter(t => t.type === 'income' && !isLoan(t))
    const expense = all.filter(t => t.type === 'expense' && !isLoan(t))

    const totalIncome  = income.reduce((s,t)=>s+baseAmountOf(t),0)
    const totalExpense = expense.reduce((s,t)=>s+baseAmountOf(t),0)
    const balanceNum = totalIncome - totalExpense

    // 外币待结算：银行尚未入账，baseAmountOf 返回 0，天然不计入任何统计。
    // 单独统计出来提示用户，避免误以为报表金额就是全部花费。
    const pendingList = all.filter(t => isPending(t))
    const pendingCount = pendingList.length
    const pendingRefTotal = round2(pendingList.reduce((s, t) => {
      const r = getReferenceAmount(t)
      return s + (r != null ? r : 0)
    }, 0))

    // 收集所有类别
    const catSet = new Set()
    all.forEach(t => catSet.add(t.category))
    const allCategories = Array.from(catSet)

    // 获取该账本的类别（含自定义 + 默认）
    const { data: cats } = await supabase.from('categories')
      .select('*').eq('ledger_id', currentLedger.id)
    this._cats = cats || []
    // 构建分类树供筛选选择器使用
    const filterExpenseTree = this._buildTree(cats || [], 'expense')
    const filterIncomeTree = this._buildTree(cats || [], 'income')

    // 资金账户（**含已归档**：归档账户的历史账目仍需解析出账户名）
    const { data: accs } = await supabase.from('accounts')
      .select('*').eq('ledger_id', currentLedger.id).order('sort_order')
    this._accounts = accs || []
    this._accById = {}
    this._accounts.forEach(a => { this._accById[a.id] = a })

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
        expMap[topKey] = (expMap[topKey]||0) + baseAmountOf(t)
        if (!expenseSubMap[topKey]) expenseSubMap[topKey] = {}
        expenseSubMap[topKey][key] = (expenseSubMap[topKey][key]||0) + baseAmountOf(t)
      })
    } else {
      expense.forEach(t => {
        const key = t.category || '其他'
        expMap[key] = (expMap[key]||0) + baseAmountOf(t)
      })
    }
    const expenseBreakdown = Object.entries(expMap)
      // 仅含待结算账目的类别金额为 0，过滤掉避免出现无意义的 0 行
      .filter(e => e[1] > 0)
      .sort((a,b)=>b[1]-a[1])
      .map(([category, amount], i) => {
        const preset = DEFAULT_EXPENSE_CATEGORIES.find(c=>c.name===category)
        return { category, icon: preset ? preset.icon : '📌', amount: formatMoney(amount, this.data.baseCurrency, { symbol: false }), percent: totalExpense ? Math.round(amount/totalExpense*100) : 0, color: COLORS[i%COLORS.length] }
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
              amount: formatMoney(subAmt, this.data.baseCurrency, { symbol: false }),
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
        incMap[topKey] = (incMap[topKey]||0) + baseAmountOf(t)
      })
    } else {
      income.forEach(t => {
        const key = t.category || '其他'
        incMap[key] = (incMap[key]||0) + baseAmountOf(t)
      })
    }
    const incomeBreakdown = Object.entries(incMap)
      .filter(e => e[1] > 0)
      .sort((a,b)=>b[1]-a[1])
      .map(([category, amount], i) => {
        const preset = DEFAULT_INCOME_CATEGORIES.find(c=>c.name===category)
        return { category, icon: preset ? preset.icon : '💰', amount: formatMoney(amount, this.data.baseCurrency, { symbol: false }), percent: totalIncome ? Math.round(amount/totalIncome*100) : 0, index: i }
      })

    // 每日支出趋势
    const dayMap = {}
    expense.forEach(t => {
      const d = t.date
      dayMap[d] = (dayMap[d]||0) + baseAmountOf(t)
    })
    const today = (() => { const d = new Date(Date.now() + 8*3600000); return d.toISOString().split('T')[0] })()
    const days = Object.keys(dayMap).filter(d => dayMap[d] > 0).sort().slice(-15)
    const maxDayAmt = Math.max(...days.map(d=>dayMap[d]), 1)
    const dailyTrend = days.map(d => ({
      date: d, day: d.slice(-2), amount: formatMoney(dayMap[d], this.data.baseCurrency, { symbol: false }),
      barHeight: Math.max(4, Math.round(dayMap[d]/maxDayAmt*80)),
      isToday: d === today
    }))

    // 每日收入趋势
    const incomeDayMap = {}
    income.forEach(t => {
      const d = t.date
      incomeDayMap[d] = (incomeDayMap[d]||0) + baseAmountOf(t)
    })
    const incomeDays = Object.keys(incomeDayMap).filter(d => incomeDayMap[d] > 0).sort().slice(-15)
    const maxIncomeDayAmt = Math.max(...incomeDays.map(d=>incomeDayMap[d]), 1)
    const incomeTrend = incomeDays.map(d => ({
      date: d, day: d.slice(-2), amount: formatMoney(incomeDayMap[d], this.data.baseCurrency, { symbol: false }),
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
      return { category, icon: preset ? preset.icon : '📌', amount, spent: formatMoney(spent, this.data.baseCurrency, { symbol: false }), percent: amount ? Math.round(spent/amount*100) : 0 }
    })

    // 支付方式统计（仅支出）
    const PM_MAP = { cash:'💵 现金', wechat:'💚 微信', alipay:'💙 支付宝', bankcard:'💳 银行卡', other:'💠 其他' }
    const pmColors = { cash:'#f59e0b', wechat:'#22c55e', alipay:'#3b82f6', bankcard:'#8b5cf6', other:'#6b7280' }
    const pmMap = {}
    expense.forEach(t => {
      const pm = t.payment_method || 'other'
      pmMap[pm] = (pmMap[pm]||0) + baseAmountOf(t)
    })
    const paymentBreakdown = Object.entries(pmMap)
      .filter(e => e[1] > 0)
      .sort((a,b)=>b[1]-a[1])
      .map(([method, amount], i) => ({
        method, label: PM_MAP[method] || method,
        icon: (PM_MAP[method] || '💠').split(' ')[0],
        amount: formatMoney(amount, this.data.baseCurrency, { symbol: false }),
        percent: totalExpense ? Math.round(amount/totalExpense*100) : 0,
        color: pmColors[method] || pmColors.other,
        index: i
      }))

    // ── 外币待结算明细 ──
    // baseAmountOf 对待结算返回 0，所以这些账目天然不进任何汇总；
    // 单独列出来让用户知道「报表金额之外还有哪几笔没算进去」。
    const pendingDetailList = pendingList
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(t => {
        const cur = currencyOf(t)
        const ref = getReferenceAmount(t)
        return {
          id: t.id,
          date: t.date,
          category: t.category || '其他',
          note: t.note || '',
          curCode: cur,
          originalText: (t.type === 'expense' ? '-' : '+') + formatMoney(t.amount, cur),
          refText: ref != null ? formatMoney(ref, this.data.baseCurrency) : '',
          payText: PM_MAP[t.payment_method] || PM_MAP.other,
        }
      })

    // ── 资金账户维度 ──
    // 支出/收入按资金账户聚合。账户名从 this._accById 解析（含归档账户），
    // 解析不到（历史数据 account_id 为空）归入「未指定账户」，不丢数据。
    const accById = this._accById || {}
    const accLabel = (id) => {
      const a = id ? accById[id] : null
      return { name: a ? a.name : '未指定账户', icon: a ? (a.icon || '💳') : '❓' }
    }
    const buildAccBreakdown = (list, total) => {
      const map = {}
      list.forEach(t => {
        const key = t.account_id || NO_ACCOUNT_KEY
        map[key] = (map[key] || 0) + baseAmountOf(t)
      })
      return Object.entries(map)
        // 仅含待结算账目的账户金额为 0，过滤掉避免出现无意义的 0 行
        .filter(e => e[1] > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([key, amount], i) => {
          const info = accLabel(key === NO_ACCOUNT_KEY ? null : key)
          return {
            accId: key,
            category: info.name,
            icon: info.icon,
            amount: formatMoney(amount, this.data.baseCurrency, { symbol: false }),
            percent: total ? Math.round(amount / total * 100) : 0,
            color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
          }
        })
    }
    const accountBreakdown = buildAccBreakdown(expense, totalExpense)
    const accountIncomeBreakdown = buildAccBreakdown(income, totalIncome)

    // 转账：既不是收入也不是支出，不进上面任何占比，只能单独成区展示
    const transfers = all.filter(t => isTransfer(t))
    const transferList = transfers
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(t => {
        const from = accLabel(t.account_id)
        const to = accLabel(t.to_account_id)
        return {
          id: t.id,
          date: t.date,
          note: t.note || '',
          fromName: from.name, fromIcon: from.icon,
          toName: to.name, toIcon: to.icon,
          amount: formatMoney(baseAmountOf(t), this.data.baseCurrency, { symbol: false }),
        }
      })
    const transferTotalNum = round2(transfers.reduce((s, t) => s + baseAmountOf(t), 0))

    // ── 借款维度（022）──
    // 欠款是**存量**概念，必须用全量借款算：切到 3 月时也要能看到「张三还欠我 200」。
    // 因此这里单独查一次全量 is_loan 账目，不受上面的月份 / 自定义时间段筛选影响。
    // 借款是低频子集，且有部分索引 idx_transactions_loan，开销很小。
    const baseCur = this.data.baseCurrency
    const { data: loanRows } = await supabase.from('transactions')
      .select('id,type,amount,base_amount,currency,exchange_rate,settlement_status,is_loan,loan_counterparty,date,note,account_id,to_account_id')
      .eq('ledger_id', currentLedger.id)
      .eq('is_loan', true)
      .order('date', { ascending: false })
    const loanAll = loanRows || []
    const loanSum = summarizeLoans(loanAll)
    const loanGroups = groupByCounterparty(loanAll)

    // 应收 / 应付：净额法下逐人取正负号再合计
    let receivable = 0, payable = 0
    loanGroups.forEach(g => {
      if (g.net < 0) receivable += -g.net
      else payable += g.net
    })
    receivable = round2(receivable)
    payable = round2(payable)

    const loanSummary = {
      lendTotal: loanSum.lendTotal,
      borrowTotal: loanSum.borrowTotal,
      net: loanSum.net,
      lendCount: loanSum.lendCount,
      borrowCount: loanSum.borrowCount,
      count: loanSum.count,
      lendText: formatMoney(loanSum.lendTotal, baseCur),
      borrowText: formatMoney(loanSum.borrowTotal, baseCur),
      netText: formatMoney(Math.abs(loanSum.net), baseCur),
      netPositive: loanSum.net > 0,
      receivableText: formatMoney(receivable, baseCur),
      payableText: formatMoney(payable, baseCur),
    }

    const loanParties = loanGroups.map(g => ({
      party: g.party,
      net: g.net,
      open: g.open,
      count: g.count,
      lastDate: g.lastDate,
      lendText: g.lendTotal ? formatMoney(g.lendTotal, baseCur) : '',
      borrowText: g.borrowTotal ? formatMoney(g.borrowTotal, baseCur) : '',
      netText: formatMoney(Math.abs(g.net), baseCur),
      // kind 决定颜色：receivable=对方欠我（青）/ payable=我欠对方（橙）/ settled=已结清（灰）
      kind: g.net > 0 ? 'payable' : (g.net < 0 ? 'receivable' : 'settled'),
      netLabel: g.net > 0 ? '我欠对方' : (g.net < 0 ? '对方欠我' : '已结清'),
      // 该对方的流水（供明细弹窗）
      items: g.items.map(t => ({
        id: t.id,
        date: t.date,
        note: t.note || '',
        dir: loanDirectionOf(t),
        dirLabel: isLoanOut(t) ? '借出' : '借入',
        amountText: formatMoney(baseAmountOf(t), baseCur),
        sign: isLoanOut(t) ? '-' : '+',
      })),
    }))
    const loanOpenCount = loanParties.filter(p => p.open).length


    // 先写入全量数据，再走统一的 applySearchFilter 过滤
    this.setData({
      loading: false,
      totalIncome: formatMoney(totalIncome, this.data.baseCurrency, { symbol: false }),
      totalExpense: formatMoney(totalExpense, this.data.baseCurrency, { symbol: false }),
      balance: formatMoney(balanceNum, this.data.baseCurrency, { symbol: false }),
      balanceNum,
      pendingCount,
      pendingRefTotal,
      pendingRefText: formatMoney(pendingRefTotal, this.data.baseCurrency, { symbol: false }),
      pendingDetailList,
      expenseBreakdown: expenseBreakdown,
      incomeBreakdown: incomeBreakdown,
      dailyTrend,
      incomeTrend,
      expenseCats,
      budgetStatus,
      allCategories,
      paymentBreakdown,
      accountBreakdown,
      accountIncomeBreakdown,
      transferList,
      transferCount: transferList.length,
      transferTotalNum,
      transferTotalText: formatMoney(transferTotalNum, this.data.baseCurrency, { symbol: false }),
      loanSummary,
      loanParties,
      loanPartyCount: loanParties.length,
      loanOpenCount,
      filterExpenseTree,
      filterIncomeTree,
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
