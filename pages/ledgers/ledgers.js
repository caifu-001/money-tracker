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
    // 编辑
    editingId: null,
    editName: '',
  },

  onLoad() {
    const user = app.globalData.user
    // 游客也能进入浏览，只是不能创建/切换/编辑/删除
    this.setData({ user: user || null, currentLedger: app.globalData.currentLedger })
    // 检查并恢复默认账本
    this.checkDefaultLedger()
    this.loadData()
  },

  onShow() {
    // 首次加载由 onLoad 处理，后续显示时刷新列表
    if (this.data.ledgers.length === 0) return
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
    if (!user) {
      this.setData({ loading: false })
      return
    }
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
      const map = new Map()
      ;(ownResult.data || []).forEach(l => map.set(l.id, l))
      memberLedgers.forEach(l => map.set(l.id, l))
      allLedgers = Array.from(map.values()).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    // 查所有账本的成员数，判断是否共同账本
    if (allLedgers.length > 0) {
      const { data: members } = await supabase.from('ledger_members').select('ledger_id')
        .in('ledger_id', allLedgers.map(l => l.id))
      const sharedSet = new Set()
      if (members) members.forEach(m => sharedSet.add(m.ledger_id))
      allLedgers = allLedgers.map(l => ({
        ...l,
        isShared: sharedSet.has(l.id),
        displayName: (sharedSet.has(l.id) ? '[共同]' : '') + l.name
      }))
    }

    this.setData({ ledgers: allLedgers, loading: false })
    console.log('[ledgers] allLedgers with isShared:', allLedgers.map(l => ({ id: l.id, name: l.name, owner_id: l.owner_id, isShared: l.isShared })))
    // 账本加载后再次检查默认账本
    this.checkDefaultLedger()
  },

  async handleCreate() {
    const { newName, user, creating } = this.data
    if (!user) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    if (!newName.trim() || creating) return
    this.setData({ creating: true })
    try {
      const { error } = await supabase.from('ledgers').insert([{ name: newName.trim(), owner_id: user.id, type: 'personal' }])
      if (error) throw new Error(error.message)
      // 自研客户端 insert 不返回数据，loadData 来刷新
      this.setData({ showCreate: false, newName: '' })
      await this.loadData()
      // 加载后初始化分类
      const latest = this.data.ledgers[0]
      if (latest && latest.name === newName.trim()) {
        await initDefaultCategories(supabase, latest.id)
      }
      wx.showToast({ title: '创建成功', icon: 'success' })
    } catch(e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' })
    } finally {
      this.setData({ creating: false })
    }
  },

  onNameInput(e) { this.setData({ newName: e.detail.value }) },
  toggleCreate() { this.setData({ showCreate: !this.data.showCreate, newName: '' }) },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/family/family?mode=join' })
  },

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

  // 编辑账本名称
  startEdit(e) {
    const ledger = this.data.ledgers[e.currentTarget.dataset.index]
    this.setData({ editingId: ledger.id, editName: ledger.name })
  },
  onEditNameInput(e) { this.setData({ editName: e.detail.value }) },
  cancelEdit() { this.setData({ editingId: null, editName: '' }) },
  async saveEdit(e) {
    const ledger = this.data.ledgers[e.currentTarget.dataset.index]
    const newName = this.data.editName.trim()
    if (!newName || newName === ledger.name) { this.cancelEdit(); return }
    const { error } = await supabase.from('ledgers').update({ name: newName }).eq('id', ledger.id)
    if (error) { wx.showToast({ title: error.message || '修改失败', icon: 'none' }); return }
    // 同步更新全局状态
    ledger.name = newName
    if (app.globalData.currentLedger && app.globalData.currentLedger.id === ledger.id) {
      app.globalData.currentLedger.name = newName
    }
    // 刷新列表以更新 displayName
    this.setData({ editingId: null, editName: '' })
    this.loadData()
    wx.showToast({ title: '已修改', icon: 'success' })
  },

  // 获取默认账本ID
  getDefaultId() {
    return wx.getStorageSync('default_ledger_id')
  },

  async handleDelete(e) {
    const ledger = this.data.ledgers[e.currentTarget.dataset.index]
    wx.showModal({
      title: '⚠️ 确认删除',
      content: `确定删除账本「${ledger.name}」？\n所有账目、分类、预算数据将被永久删除，无法恢复！`,
      success: async res => {
        if (!res.confirm) return
        // 二次确认
        wx.showModal({
          title: '再次确认',
          content: `输入「${ledger.name}」以确认删除: `,
          editable: true,
          placeholderText: ledger.name,
          success: async r2 => {
            if (!r2.confirm || r2.content !== ledger.name) {
              wx.showToast({ title: '已取消', icon: 'none' })
              return
            }
            try {
              await supabase.from('ledgers').delete().eq('id', ledger.id)
              // 如果删除的是当前账本，清除全局状态
              if (app.globalData.currentLedger && app.globalData.currentLedger.id === ledger.id) {
                app.globalData.currentLedger = null
                wx.removeStorageSync('default_ledger_id')
              }
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadData()
            } catch(e) {
              wx.showToast({ title: '删除失败: ' + (e.message || '未知错误'), icon: 'none' })
            }
          }
        })
      }
    })
  },
})
