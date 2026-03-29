// pages/home/home.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } = require('../../utils/categories')

const PAYMENT_METHODS = [
  { id: 'cash',    name: '现金',    icon: '💵' },
  { id: 'wechat',  name: '微信',    icon: '💚' },
  { id: 'alipay',  name: '支付宝',  icon: '💙' },
  { id: 'bankcard',name: '银行卡',  icon: '💳' },
]

Page({
  data: {
    user: null, currentLedger: null,
    transactions: [], loading: true,
    totalIncome: '0.00', totalExpense: '0.00', balance: '0.00',
    monthLabel: '',
    // 记账弹窗
    showQuickAdd: false,
    qaType: 'expense', qaAmount: '', qaCategory: '', qaNote: '', qaLoading: false,
    qaExpandedKey: null, subCats: [],
    currentCats: [],
    qaPaymentMethod: 'cash',  // 新增
    // 编辑弹窗
    showEdit: false, editTx: null,
    editType: 'expense', editAmount: '', editCategory: '', editNote: '', editDate: '', editLoading: false,
    editCats: [],
    editPaymentMethod: 'cash',  // 新增
    // 类别树
    catTree: [],
  },

  onLoad() {
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    const ledger = app.globalData.currentLedger
    const now = new Date()
    this.setData({
      user,
      currentLedger: ledger || { id: null, name: '暂无账本' },
      monthLabel: `${now.getFullYear()}年${now.getMonth()+1}月`
    })
    this.loadData()
    this.loadCatTree()
  },

  onShow() {
    const ledger = app.globalData.currentLedger
    if (!ledger || ledger.id !== this.data.currentLedger?.id) {
      this.setData({ currentLedger: ledger || { id: null, name: '暂无账本' } })
      this.loadData()
      this.loadCatTree()
    }
  },

  async loadData() {
    const { currentLedger, user } = this.data
    if (!currentLedger || !currentLedger.id) { this.setData({ loading: false }); return }
    this.setData({ loading: true })
    const now = new Date()
    const start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const end = now.toISOString().split('T')[0]
    let q = supabase.from('transactions').select('*').eq('ledger_id', currentLedger.id).gte('date', start).lte('date', end)
    if (user.role !== 'admin') q = q.eq('user_id', user.id)
    // ✅ 按时间降序排列，最新在前
    q = q.order('date', { ascending: false })
    const { data } = await q

    const PM_DISPLAY = { cash:'现金', wechat:'微信', alipay:'支付宝', bankcard:'银行卡', other:'其他' }
    const txs = (data || []).map(t => ({
      ...t,
      amountStr: Number(t.amount).toFixed(2),
      categoryIcon: t.category?.match(/\p{Emoji}/u)?.[0] || (t.type==='income'?'💰':'💸'),
      dateLabel: this.formatDate(t.date),
      canEdit: user.role === 'admin' || t.user_id === user.id,
      paymentDisplay: PM_DISPLAY[t.payment_method] || '现金'
    }))
    const totalIncome  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
    const totalExpense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
    this.setData({
      transactions: txs, loading: false,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: (totalIncome - totalExpense).toFixed(2)
    })
  },

  async loadCatTree() {
    const { currentLedger } = this.data
    if (!currentLedger || !currentLedger.id) return
    let expensePresets = DEFAULT_EXPENSE_CATEGORIES
    let incomePresets  = DEFAULT_INCOME_CATEGORIES
    try {
      const { data: cfgData } = await supabase.from('system_config').select('key,value')
      if (cfgData) {
        const map = {}
        cfgData.forEach(row => { map[row.key] = row.value })
        if (map['default_expense_categories']) expensePresets = map['default_expense_categories']
        if (map['default_income_categories'])  incomePresets  = map['default_income_categories']
      }
    } catch(e) {}
    const { data } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
      .eq('ledger_id', currentLedger.id).order('level').order('name')
    const map = {}; const roots = []
    ;(data||[]).forEach(c => { map[c.id] = {...c, children: []} })
    ;(data||[]).forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id])
      else if (!c.parent_id) roots.push(map[c.id])
    })
    const presetNames = new Set([...expensePresets, ...incomePresets].map(p=>p.name))
    const presetNodes = [
      ...expensePresets.map(p => { const db = roots.find(r=>r.name===p.name&&r.type==='expense'); return { name:p.name, icon:p.icon, type:'expense', children:db?.children||[], id:db?.id } }),
      ...incomePresets.map(p  => { const db = roots.find(r=>r.name===p.name&&r.type==='income'); return { name:p.name, icon:p.icon, type:'income', children:db?.children||[], id:db?.id } }),
    ]
    const customRoots = roots.filter(r=>!presetNames.has(r.name))
    this.setData({ catTree: [...presetNodes, ...customRoots] })
    this.updateCurrentCats('expense')
  },

  updateCurrentCats(type) {
    const cats = this.data.catTree.filter(c=>c.type===type).map(c=>({...c, hasChildren: c.children&&c.children.length>0}))
    this.setData({ currentCats: cats })
  },

  formatDate(dateStr) {
    const d = new Date(dateStr)
    const days = ['日','一','二','三','四','五','六']
    return `${d.getMonth()+1}月${d.getDate()}日 周${days[d.getDay()]}`
  },

  // ── 记账弹窗 ──
  openQuickAdd() {
    this.setData({
      showQuickAdd: true, qaType: 'expense', qaAmount: '', qaCategory: '', qaNote: '',
      qaExpandedKey: null, subCats: [], qaPaymentMethod: 'cash'
    })
    this.updateCurrentCats('expense')
  },
  closeQuickAdd() { this.setData({ showQuickAdd: false }) },
  setQaType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ qaType: type, qaCategory: '', qaExpandedKey: null, subCats: [] })
    this.updateCurrentCats(type)
  },
  onAmountInput(e) { this.setData({ qaAmount: e.detail.value }) },
  onNoteInput(e)   { this.setData({ qaNote: e.detail.value }) },
  onQaPaymentChange(e) { this.setData({ qaPaymentMethod: e.currentTarget.dataset.id }) },

  onCatTap(e) {
    const { name, hasChildren } = e.currentTarget.dataset
    const h = hasChildren === 'true' || hasChildren === true
    if (h) {
      const parent = this.data.catTree.find(c=>c.name===name)
      if (this.data.qaExpandedKey === name) {
        this.setData({ qaExpandedKey: null, subCats: [] })
      } else {
        this.setData({ qaExpandedKey: name, subCats: parent?.children || [] })
      }
    } else {
      this.setData({ qaCategory: name, qaExpandedKey: null, subCats: [] })
    }
  },
  onSubCatTap(e) { this.setData({ qaCategory: e.currentTarget.dataset.name }) },
  selectParentSelf() { this.setData({ qaCategory: this.data.qaExpandedKey, qaExpandedKey: null, subCats: [] }) },

  async handleQuickAdd() {
    const { currentLedger, user, qaType, qaAmount, qaCategory, qaNote, qaPaymentMethod } = this.data
    if (!qaAmount || !qaCategory) return wx.showToast({ title: '请填写金额并选择分类', icon: 'none' })
    this.setData({ qaLoading: true })
    try {
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('transactions').insert([{
        ledger_id: currentLedger.id, user_id: user.id,
        amount: parseFloat(qaAmount), type: qaType,
        category: qaCategory, note: qaNote, date: today,
        payment_method: qaPaymentMethod
      }])
      if (error) throw new Error(error.message)
      this.setData({ showQuickAdd: false })
      wx.showToast({ title: '记账成功', icon: 'success' })
      this.loadData()
    } catch(e) {
      wx.showToast({ title: e.message || '记账失败', icon: 'none' })
    } finally {
      this.setData({ qaLoading: false })
    }
  },

  // ── 编辑 ──
  onEditTap(e) {
    const tx = this.data.transactions[e.currentTarget.dataset.index]
    const editCats = this.data.catTree.filter(c=>c.type===tx.type).map(c=>({name:c.name, icon:c.icon}))
    this.setData({
      showEdit: true, editTx: tx,
      editType: tx.type, editAmount: String(tx.amount),
      editCategory: tx.category, editNote: tx.note||'', editDate: tx.date,
      editCats, editPaymentMethod: tx.payment_method || 'cash'
    })
  },
  closeEdit() { this.setData({ showEdit: false }) },
  setEditType(e) {
    const type = e.currentTarget.dataset.type
    const editCats = this.data.catTree.filter(c=>c.type===type).map(c=>({name:c.name, icon:c.icon}))
    this.setData({ editType: type, editCategory: '', editCats, editPaymentMethod: 'cash' })
  },
  onEditAmountInput(e) { this.setData({ editAmount: e.detail.value }) },
  onEditNoteInput(e)  { this.setData({ editNote: e.detail.value }) },
  onEditDateChange(e) { this.setData({ editDate: e.detail.value }) },
  onEditCatTap(e)     { this.setData({ editCategory: e.currentTarget.dataset.name }) },
  onEditPaymentChange(e) { this.setData({ editPaymentMethod: e.currentTarget.dataset.id }) },

  async handleEdit() {
    const { editTx, editType, editAmount, editCategory, editNote, editDate, editPaymentMethod } = this.data
    if (!editAmount || !editCategory) return wx.showToast({ title: '请填写金额并选择分类', icon: 'none' })
    this.setData({ editLoading: true })
    try {
      const { error } = await supabase.from('transactions').update({
        type: editType, amount: parseFloat(editAmount), category: editCategory,
        note: editNote, date: editDate, payment_method: editPaymentMethod
      }).eq('id', editTx.id)
      if (error) throw new Error(error.message)
      this.setData({ showEdit: false })
      wx.showToast({ title: '修改成功', icon: 'success' })
      this.loadData()
    } catch(e) {
      wx.showToast({ title: e.message || '修改失败', icon: 'none' })
    } finally {
      this.setData({ editLoading: false })
    }
  },

  onDeleteTap(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除', content: '确定删除这条账目吗？',
      success: async res => {
        if (!res.confirm) return
        await supabase.from('transactions').delete().eq('id', id)
        wx.showToast({ title: '已删除', icon: 'success' })
        this.loadData()
      }
    })
  },

  goAdmin()    { wx.navigateTo({ url: '/pages/admin/admin' }) },
  goFamily()  { wx.navigateTo({ url: '/pages/family/family' }) },
  goSettings(){ wx.navigateTo({ url: '/pages/settings/settings' }) },
})
