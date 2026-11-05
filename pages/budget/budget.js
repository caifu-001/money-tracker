// pages/budget/budget.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES } = require('../../utils/categories')
const { formatMoney, baseAmountOf, statAmountOf, resolveBaseCurrency, getSymbol, round2, isPending, getReferenceAmount } = require('../../utils/currency')

// 把树形预置类别展平为 { name, icon } 数组（含所有层级）
function flattenCategories(cats, parentIcon) {
  const result = []
  ;(cats || []).forEach(c => {
    const icon = c.icon || parentIcon || '📌'
    result.push({ name: c.name, icon })
    if (c.children && c.children.length > 0) {
      result.push(...flattenCategories(c.children, icon))
    }
  })
  return result
}

Page({
  data: {
    loading: true,
    isGuest: true,
    user: null,
    saving: false,
    budgetList: [],
    catList: [],
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    overallPercent: 0,
    monthLabel: '',
    year: 2026,
    month: 1,
    // 多币种：预算与支出统一按账本本位币口径
    baseCurrency: 'CNY',
    baseSymbol: '¥',
    totalBudgetText: '0.00',
    totalSpentText: '0.00',
    totalRemainingText: '0.00',
    showEditModal: false,
    editCatName: '',
    editCatIcon: '',
    editAmount: '',
    showMonthPicker: false,
  },

  // 账本本位币字段
  _baseFields(ledger) {
    const baseCurrency = resolveBaseCurrency(ledger)
    return { baseCurrency, baseSymbol: getSymbol(baseCurrency) }
  },

  onLoad() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const user = app.globalData.user
    const ledger = app.globalData.currentLedger
    this.setData({ user: user || null, isGuest: !user, year, month, monthLabel: `${year}年${month}月`, currentLedger: ledger || null, loading: !user, ...this._baseFields(ledger) })
    if (user) this.loadData(year, month)
  },

  onShow() {
    const user = app.globalData.user
    this.setData({ user: user || null, isGuest: !user })
    if (user && user.id) app.checkAccountStatus()
    const ledger = app.globalData.currentLedger
    const { year, month } = this.data
    if (ledger && ledger.id !== this.data.currentLedger?.id) {
      this.setData({ currentLedger: ledger, ...this._baseFields(ledger) })
    }
    if (user) this.loadData(year, month)
  },

  prevMonth() {
    let { year, month } = this.data
    month--; if (month < 1) { month = 12; year-- }
    this.setData({ year, month, monthLabel: `${year}年${month}月` })
    this.loadData(year, month)
  },

  nextMonth() {
    let { year, month } = this.data
    month++; if (month > 12) { month = 1; year++ }
    this.setData({ year, month, monthLabel: `${year}年${month}月` })
    this.loadData(year, month)
  },

  async loadData(year, month) {
    let { currentLedger } = app.globalData
    console.log('[Budget loadData] ledger:', currentLedger ? { id: currentLedger.id, name: currentLedger.name } : null)
    if (!currentLedger) {
      const id = wx.getStorageSync('default_ledger_id') || wx.getStorageSync('qianji_default_ledger_id')
      const name = wx.getStorageSync('default_ledger_name') || wx.getStorageSync('qianji_default_ledger_name')
      const type = wx.getStorageSync('default_ledger_type') || wx.getStorageSync('qianji_default_ledger_type')
      const owner_id = wx.getStorageSync('default_ledger_owner') || wx.getStorageSync('qianji_default_ledger_owner')
      if (id) { currentLedger = { id, name, type, owner_id }; app.globalData.currentLedger = currentLedger }
    }
    if (!currentLedger) { this.setData({ loading: false }); return }
    this.setData({ loading: true })

    const now = new Date()
    if (!year || !month || year < 2020 || month < 1 || month > 12) { year = now.getFullYear(); month = now.getMonth() + 1 }
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    // 查询预算
    const { data: budgets, error: budgetError } = await supabase.from('budgets')
      .select('category, amount').eq('ledger_id', currentLedger.id).eq('year', year).eq('month', month)
    if (budgetError) console.error('[Budget] 预算查询错误:', budgetError)
    const budgetMap = {}
    ;(budgets || []).forEach(b => { budgetMap[b.category] = Number(b.amount) })
    console.log('[Budget] 预算设置:', budgetMap)

    // 查询支出（base_amount = 本位币口径，预算与本位币同基准才能比）
    const { data: txs, error: txError } = await supabase.from('transactions')
      .select('amount, base_amount, reference_amount, currency, settlement_status, type, category')
      .eq('ledger_id', currentLedger.id)
      .eq('type', 'expense')
      .gte('date', startDate).lte('date', endDate)
    console.log('[Budget] 交易 ledger=' + currentLedger.id + ' ' + startDate + '~' + endDate + ' 结果=' + (txs ? txs.length : 0) + ' 笔, error=' + (txError && txError.message))
    if (txs && txs.length > 0) console.log('[Budget] 前5条:', txs.slice(0, 5))

    // 按类别聚合：取 category 字段值直接作 key（记账时存的就是类别 name，无 emoji）
    // 用 statAmountOf：借款（借出）不算消费，不能撑爆预算
    const spentMap = {}
    ;(txs || []).forEach(t => {
      const key = (t.category || '其他').trim()
      spentMap[key] = round2((spentMap[key] || 0) + statAmountOf(t))
    })
    console.log('[Budget] spentMap:', spentMap)

    // 待结算：外币消费银行尚未入账，本位币金额未知，不计入已花金额。
    // 必须显式提示，否则用户会误以为预算还剩很多。
    const pendingList = (txs || []).filter(t => isPending(t))
    const pendingCount = pendingList.length
    const pendingRefTotal = round2(pendingList.reduce((s, t) => {
      const r = getReferenceAmount(t)
      return s + (r != null ? r : 0)
    }, 0))

    // 查询数据库自定义类别
    const { data: customCats } = await supabase.from('categories')
      .select('name, icon').eq('ledger_id', currentLedger.id).eq('type', 'expense')

    // 展平预置类别（含所有层级）+ 合并自定义类别，用类别 name 作 key
    const allCatsMap = {}
    flattenCategories(DEFAULT_EXPENSE_CATEGORIES).forEach(c => { allCatsMap[c.name] = c.icon })
    ;(customCats || []).forEach(c => { allCatsMap[c.name] = c.icon || '📌' })
    console.log('[Budget] allCatsMap keys:', Object.keys(allCatsMap), '共', Object.keys(allCatsMap).length, '个')

    // 构建列表（预算金额与支出同为本位币口径）
    const baseCurrency = this.data.baseCurrency
    const catList = Object.entries(allCatsMap).map(([name, icon]) => {
      const amount = budgetMap[name] || 0
      const spent = spentMap[name] || 0  // 直接精确匹配类别名
      const remaining = round2(amount - spent)
      return {
        category: name, icon, amount, spent, remaining,
        amountText: formatMoney(amount, baseCurrency, { symbol: false }),
        spentText: formatMoney(spent, baseCurrency, { symbol: false }),
        remainingText: formatMoney(remaining, baseCurrency, { symbol: false }),
        percent: amount > 0 ? Math.round(spent / amount * 100) : 0
      }
    })

    // 有预算的排前，再按支出排序
    catList.sort((a, b) => {
      if (a.amount > 0 && b.amount === 0) return -1
      if (a.amount === 0 && b.amount > 0) return 1
      return b.spent - a.spent
    })

    const totalBudgetSaved = budgetMap['__TOTAL__'] || 0
    const totalBudget = catList.reduce((s, i) => s + i.amount, 0)
    const totalSpent = round2(catList.reduce((s, i) => s + (i.spent || 0), 0))
    const budgetForPercent = totalBudget > 0 ? totalBudget : totalBudgetSaved
    const totalRemaining = round2(budgetForPercent - totalSpent)
    const overallPercent = budgetForPercent > 0 ? Math.round(totalSpent / budgetForPercent * 100) : 0

    this.setData({
      catList, loading: false,
      totalBudget: budgetForPercent, totalBudgetSaved, totalSpent,
      totalRemaining, overallPercent,
      totalBudgetText: formatMoney(budgetForPercent, baseCurrency, { symbol: false }),
      overviewBudgetText: formatMoney(totalBudgetSaved || totalBudget, baseCurrency, { symbol: false }),
      totalSpentText: formatMoney(totalSpent, baseCurrency, { symbol: false }),
      totalRemainingText: formatMoney(totalRemaining, baseCurrency, { symbol: false }),
      pendingCount,
      pendingRefTotal,
      pendingRefText: formatMoney(pendingRefTotal, baseCurrency, { symbol: false }),
    })
    console.log('[Budget] 最终结果 totalSpent=' + totalSpent + ' overallPercent=' + overallPercent + '%'
      + ' 待结算=' + pendingCount + ' 笔')
  },

  openEdit(e) {
    const { cat, icon, amount } = e.currentTarget.dataset
    this.setData({ showEditModal: true, editCatName: cat, editCatIcon: icon, editAmount: amount ? String(amount) : '' })
  },
  openTotalBudget() {
    this.setData({ showEditModal: true, editCatName: '__TOTAL__', editCatIcon: '💰',
                   editAmount: this.data.totalBudgetSaved ? String(this.data.totalBudgetSaved) : '' })
  },
  closeEditModal() { this.setData({ showEditModal: false, editCatName: '', editCatIcon: '', editAmount: '' }) },
  onAmountInput(e) { this.setData({ editAmount: e.detail.value }) },

  async handleSave() {
    const { editCatName, editAmount, saving, year, month } = this.data
    if (saving) return
    const { currentLedger } = app.globalData
    if (!currentLedger) return
    this.setData({ saving: true })
    try {
      if (editAmount && parseFloat(editAmount) > 0) {
        const { error } = await supabase.from('budgets').upsert([{
          ledger_id: currentLedger.id, category: editCatName,
          amount: parseFloat(editAmount), month, year
        }], { onConflict: 'ledger_id,category,month,year' })
        if (error) throw new Error(error.message)
      } else {
        await supabase.from('budgets').delete()
          .eq('ledger_id', currentLedger.id).eq('category', editCatName).eq('month', month).eq('year', year)
      }
      this.setData({ showEditModal: false })
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.loadData(this.data.year, this.data.month)
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },
})
