// pages/budget/budget.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES } = require('../../utils/categories')

Page({
  data: {
    loading: true,
    saving: false,
    budgetList: [],
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    overallPercent: 0,
    monthLabel: '',
    editIndex: -1,
    editAmount: '',
    editingLedgerId: '',
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

  async loadData() {
    const { user, currentLedger } = app.globalData
    if (!currentLedger) { this.setData({ loading: false }); return }
    this.setData({ loading: true })

    const { year, month } = this.data

    // 直接查 budgets 表，不依赖预置类别名称
    const { data: budgets } = await supabase.from('budgets')
      .select('category, amount')
      .eq('ledger_id', currentLedger.id)
      .eq('year', year)
      .eq('month', month)

    // 加载支出
    let tq = supabase.from('transactions')
      .select('amount, type, category')
      .eq('ledger_id', currentLedger.id)
      .eq('type', 'expense')
    if (user.role !== 'admin') tq = tq.eq('user_id', user.id)

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const { data: txs } = await tq.gte('date', startDate)

    // 按类别聚合支出
    const spentMap = {}
    ;(txs || []).forEach(t => {
      const key = t.category || '其他'
      spentMap[key] = (spentMap[key] || 0) + Number(t.amount)
    })

    // 构建列表：直接用 budgets 表里的数据（数据库有什么就显示什么）
    const list = (budgets || []).map(b => {
      const name = b.category
      const amount = Number(b.amount)
      const spent = spentMap[name] || 0
      // 尝试找预置图标，找不到用 emoji
      const preset = DEFAULT_EXPENSE_CATEGORIES.find(c => c.name === name)
      const icon = preset ? preset.icon : this.catEmoji(name)
      return {
        category: name,
        icon,
        amount,
        spent,
        remaining: amount - spent,
        percent: amount > 0 ? Math.round(spent / amount * 100) : 0
      }
    })

    const totalBudget     = list.reduce((s, i) => s + i.amount, 0)
    const totalSpent     = list.reduce((s, i) => s + i.spent, 0)
    const totalRemaining = totalBudget - totalSpent
    const overallPercent = totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0

    this.setData({
      budgetList: list,
      loading: false,
      totalBudget,
      totalSpent,
      totalRemaining,
      overallPercent
    })
  },

  // 根据类别名猜 emoji
  catEmoji(name) {
    const map = {
      '食物': '🍔', '餐饮': '🍜', '交通': '🚗', '娱乐': '🎮',
      '购物': '🛍️', '医疗': '⚕️', '教育': '📚', '住房': '🏠',
      '水电': '💡', '通讯': '📱', '旅游': '✈️', '服装': '👔',
      '护肤': '💄', '运动': '🏃', '宠物': '🐶', '其他': '📌',
    }
    return map[name] || '📌'
  },

  openEdit(e) {
    const { index, amount } = e.currentTarget.dataset
    this.setData({ editIndex: index, editAmount: String(amount), editingLedgerId: this.data.currentLedger.id })
  },

  closeEdit() {
    this.setData({ editIndex: -1, editAmount: '', editingLedgerId: '' })
  },

  onAmountInput(e) {
    this.setData({ editAmount: e.detail.value })
  },

  async handleSave() {
    const { editIndex, editAmount, budgetList, saving } = this.data
    if (saving) return
    const item = budgetList[editIndex]
    if (!item) return
    if (!editAmount) {
      wx.showToast({ title: '请输入预算金额', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      const { currentLedger, year, month } = app.globalData
      const { error } = await supabase.from('budgets').upsert([{
        ledger_id: currentLedger.id,
        category: item.category,
        amount: parseFloat(editAmount),
        month,
        year
      }], { onConflict: 'ledger_id,category,month,year' })
      if (error) throw new Error(error.message)
      this.setData({ editIndex: -1, editAmount: '' })
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.loadData()
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  handleDelete(e) {
    const { index, category } = e.currentTarget.dataset
    const { currentLedger, year, month } = app.globalData
    wx.showModal({
      title: '删除预算',
      content: `删除「${category}」的预算？`,
      success: (res) => {
        if (!res.confirm) return
        supabase.from('budgets').delete()
          .eq('ledger_id', currentLedger.id)
          .eq('category', category)
          .eq('month', month)
          .eq('year', year)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadData()
          })
      }
    })
  },

  goAnalytics() {
    wx.switchTab({ url: '/pages/analytics/analytics' })
  },
})
