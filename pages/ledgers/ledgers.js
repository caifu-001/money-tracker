// pages/ledgers/ledgers.js
const app = getApp()
const { supabase } = require('../../utils/supabase')

Page({
  data: {
    loading: true,
    ledgers: [],
    currentLedger: null,
    user: null,
    // 新建
    showCreate: false,
    newName: '',
    creating: false,
    // 切换确认
    confirmLedgerId: null,
  },

  onLoad() {
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    this.setData({ user, currentLedger: app.globalData.currentLedger })
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    const { user } = this.data
    // 管理员看到所有账本，普通用户只看到自己的
    let q = supabase.from('ledgers').select('*').order('created_at', { ascending: false })
    if (user.role !== 'admin') q = q.eq('owner_id', user.id)
    const { data } = await q
    this.setData({ ledgers: data || [], loading: false })
  },

  async handleCreate() {
    const { newName, user, creating } = this.data
    if (!newName.trim() || creating) return
    this.setData({ creating: true })
    try {
      const { data, error } = await supabase.from('ledgers').insert([{ name: newName, owner_id: user.id }])
      if (error) throw new Error(error.message)
      this.setData({ showCreate: false, newName: '' })
      wx.showToast({ title: '账本创建成功', icon: 'success' })
      this.loadData()
      // 如果是第一个账本，自动切换
      if (!app.globalData.currentLedger && data?.[0]) {
        app.globalData.currentLedger = data[0]
        this.setData({ currentLedger: data[0] })
      }
    } catch(e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' })
    } finally {
      this.setData({ creating: false })
    }
  },

  onNameInput(e) { this.setData({ newName: e.detail.value }) },
  toggleCreate() { this.setData({ showCreate: !this.data.showCreate, newName: '' }) },

  switchLedger(e) {
    const ledger = this.data.ledgers[e.currentTarget.dataset.index]
    app.globalData.currentLedger = ledger
    this.setData({ currentLedger: ledger, confirmLedgerId: ledger.id })
    wx.showToast({ title: `已切换到「${ledger.name}」`, icon: 'success' })
    setTimeout(() => { this.setData({ confirmLedgerId: null }) }, 2000)
  },

  async handleDelete(e) {
    const ledger = this.data.ledgers[e.currentTarget.dataset.index]
    wx.showModal({ title: '确认删除', content: `删除账本「${ledger.name}」？所有账目数据将被永久删除！`, success: async res => {
      if (!res.confirm) return
      // 删除账本（级联删除 transactions/categories/budgets）
      await supabase.from('ledgers').delete().eq('id', ledger.id)
      wx.showToast({ title: '已删除', icon: 'success' })
      // 如果删除的是当前账本，清除切换
      if (app.globalData.currentLedger?.id === ledger.id) {
        app.globalData.currentLedger = null
        this.setData({ currentLedger: null })
      }
      this.loadData()
    }})
  },
})
