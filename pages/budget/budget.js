// pages/budget/budget.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES } = require('../../utils/categories')

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
    showEditModal: false,
    editCatName: '',
    editCatIcon: '',
    editAmount: '',
    showMonthPicker: false,
  },

  onLoad() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const ledger = app.globalData.currentLedger
    this.setData({ year, month, monthLabel: `${year}年${month}月`, currentLedger: ledger || null })
    this.loadData(year, month)
  },

  onShow() {
    const ledger = app.globalData.currentLedger
    const { year, month } = this.data
    if (!this.data.currentLedger || !this.data.currentLedger.id) {
      if (ledger && ledger.id) { this.setData({ currentLedger: ledger }); this.loadData(year, month) }
      return
    }
    if (ledger && ledger.id !== this.data.currentLedger.id) {
      this.setData({ currentLedger: ledger }); this.loadData(year, month)
    }
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

    // 查询支出
    const { data: txs, error: txError } = await supabase.from('transactions')
      .select('amount, type, category')
      .eq('ledger_id', currentLedger.id)
      .eq('type', 'expense')
      .gte('date', startDate).lte('date', endDate)
    console.log('[Budget] 交易 ledger=' + currentLedger.id + ' ' + startDate + '~' + endDate + ' 结果=' + (txs ? txs.length : 0) + ' 笔, error=' + (txError && txError.message))
    if (txs && txs.length > 0) console.log('[Budget] 前5条:', txs.slice(0, 5))

    // 按类别聚合：取 category 字段值直接作 key（记账时存的就是类别 name，无 emoji）
    const spentMap = {}
    ;(txs || []).forEach(t => {
      const key = (t.category || '其他').trim()
      spentMap[key] = Math.round(((spentMap[key] || 0) + Number(t.amount)) * 100) / 100
    })
    console.log('[Budget] spentMap:', spentMap)

    // 查询数据库自定义类别
    const { data: customCats } = await supabase.from('categories')
      .select('name, icon').eq('ledger_id', currentLedger.id).eq('type', 'expense')

    // 展平预置类别（含所有层级）+ 合并自定义类别，用类别 name 作 key
    const allCatsMap = {}
    flattenCategories(DEFAULT_EXPENSE_CATEGORIES).forEach(c => { allCatsMap[c.name] = c.icon })
    ;(customCats || []).forEach(c => { allCatsMap[c.name] = c.icon || '📌' })
    console.log('[Budget] allCatsMap keys:', Object.keys(allCatsMap), '共', Object.keys(allCatsMap).length, '个')

    // 构建列表
    const catList = Object.entries(allCatsMap).map(([name, icon]) => {
      const amount = budgetMap[name] || 0
      const spent = spentMap[name] || 0  // 直接精确匹配类别名
      return { category: name, icon, amount, spent, remaining: amount - spent,
               percent: amount > 0 ? Math.round(spent / amount * 100) : 0 }
    })

    // 有预算的排前，再按支出排序
    catList.sort((a, b) => {
      if (a.amount > 0 && b.amount === 0) return -1
      if (a.amount === 0 && b.amount > 0) return 1
      return b.spent - a.spent
    })

    const totalBudgetSaved = budgetMap['__TOTAL__'] || 0
    const totalBudget = catList.reduce((s, i) => s + i.amount, 0)
    const totalSpent = Math.round(catList.reduce((s, i) => s + (i.spent || 0), 0) * 100) / 100
    const totalRemaining = totalBudget - totalSpent
    const budgetForPercent = totalBudget > 0 ? totalBudget : totalBudgetSaved
    const overallPercent = budgetForPercent > 0 ? Math.round(totalSpent / budgetForPercent * 100) : 0

    this.setData({
      catList, loading: false,
      totalBudget: budgetForPercent, totalBudgetSaved, totalSpent,
      totalRemaining: budgetForPercent - totalSpent, overallPercent
    })
    console.log('[Budget] 最终结果 totalSpent=' + totalSpent + ' overallPercent=' + overallPercent + '%')
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
})
