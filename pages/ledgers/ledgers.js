// pages/ledgers/ledgers.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { initDefaultCategories } = require('../../utils/categories')

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
    // 检查并恢复默认账本
    this.checkDefaultLedger()
    this.loadData()
  },

  // 检查并恢复默认账本
  checkDefaultLedger() {
    const defaultId = wx.getStorageSync('default_ledger_id')
    if (!defaultId) return
    
    const { ledgers, user } = this.data
    if (ledgers.length === 0) return
    
    // 查找默认账本
    const defaultLedger = ledgers.find(l => l.id === defaultId)
    
    // 如果找到默认账本且当前没有选中账本，就恢复（成员账本也可以是默认）
    if (defaultLedger && !app.globalData.currentLedger) {
      app.globalData.currentLedger = defaultLedger
      this.setData({ currentLedger: defaultLedger })
      console.log('[checkDefaultLedger] 恢复默认账本:', defaultLedger.name)
    }
  },

  async loadData() {
    this.setData({ loading: true })
    const { user } = this.data
    let allLedgers = []
    if (user.role === 'admin') {
      const { data } = await supabase.from('ledgers').select('*').order('created_at', { ascending: false })
      allLedgers = data || []
    } else {
      // 自己的账本 + 作为成员的账本
      const [ownResult, memberResult] = await Promise.all([
        supabase.from('ledgers').select('*').eq('owner_id', user.id),
        supabase.from('ledger_members').select('ledger_id').eq('user_id', user.id)
      ])
      const memberIds = (memberResult.data || []).map(m => m.ledger_id)
      let memberLedgers = []
      if (memberIds.length > 0) {
        const { data: ml } = await supabase.from('ledgers').select('*').in('id', memberIds)
        memberLedgers = ml || []
      }
      // 合并去重，按创建时间排序
      const map = new Map()
      ;[...(ownResult.data || []), ...memberLedgers].forEach(l => map.set(l.id, l))
      allLedgers = Array.from(map.values()).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }
    this.setData({ ledgers: allLedgers, loading: false })
    // 账本加载后再次检查默认账本
    this.checkDefaultLedger()
  },

  async handleCreate() {
    const { newName, user, creating } = this.data
    if (!newName.trim() || creating) return
    this.setData({ creating: true })
    try {
      const { data, error } = await supabase.from('ledgers').insert([{ name: newName, owner_id: user.id }])
      if (error) throw new Error(error.message)
      const newLedger = data[0]
      // 初始化预置分类
      await initDefaultCategories(supabase, newLedger.id)
      this.setData({ showCreate: false, newName: '' })
      wx.showToast({ title: '账本创建成功', icon: 'success' })
      this.loadData()
      // 如果是第一个账本，自动切换
      if (!app.globalData.currentLedger && data[0]) {
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

  // 设为默认账本
  setDefault(e) {
    const ledger = this.data.ledgers[e.currentTarget.dataset.index]
    wx.setStorageSync('default_ledger_id', ledger.id)
    wx.setStorageSync('default_ledger_name', ledger.name)
    wx.setStorageSync('default_ledger_type', ledger.type)
    wx.setStorageSync('default_ledger_owner', ledger.owner_id)
    // 自动切换到该账本
    app.globalData.currentLedger = ledger
    this.setData({ currentLedger: ledger })
    this.setData({ ledgers: this.data.ledgers }) // 触发重新渲染
    wx.showToast({ title: '已设为默认', icon: 'success' })
  },

  // 获取默认账本ID
  getDefaultId() {
    return wx.getStorageSync('default_ledger_id')
  },

  async handleDelete(e) {
    const ledger = this.data.ledgers[e.currentTarget.dataset.index]
    const defaultId = this.getDefaultId()
    if (ledger.id === defaultId) {
      wx.showToast({ title: '默认账本不能删除', icon: 'none' })
      return
    }
    if (app.globalData.currentLedger && app.globalData.currentLedger.id === ledger.id) {
      wx.showToast({ title: '当前账本不能删除', icon: 'none' })
      return
    }
    wx.showModal({ title: '确认删除', content: `删除账本「${ledger.name}」？所有账目数据将被永久删除！`, success: async res => {
      if (!res.confirm) return
      // 删除账本（级联删除 transactions/categories/budgets）
      await supabase.from('ledgers').delete().eq('id', ledger.id)
      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadData()
    }})
  },
})
