// pages/admin/admin.js
const app = getApp()
const { supabase } = require('../../utils/supabase')

Page({
  data: {
    loading: true,
    tab: 'users',
    users: [],
    ledgers: [],
    members: [],
    currentLedgerId: '',
    showApprove: false,
    approveUserId: '',
    approveName: '',
    approveRole: 'user',
  },

  onLoad() {
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    if (user.role !== 'admin') {
      wx.showToast({ title: '仅管理员可用', icon: 'none' })
      wx.switchTab({ url: '/pages/home/home' })
      return
    }
    this.setData({ user })
    this.loadData()
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  async loadData() {
    this.setData({ loading: true })
    await Promise.all([this.loadUsers(), this.loadLedgers()])
    this.setData({ loading: false })
  },

  async loadUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    this.setData({ users: data || [] })
  },

  async loadLedgers() {
    // 管理员直接查所有账本（不过滤 owner_id）
    const { data: ledgers } = await supabase.from('ledgers')
      .select('*, owner:owner_id(id, name, email)')
      .order('created_at', { ascending: false })

    // 加载所有账本成员
    const { data: members } = await supabase.from('ledger_members')
      .select('*, user:user_id(id, name, email), ledger:ledger_id(id, name)')

    this.setData({
      ledgers: ledgers || [],
      members: members || []
    })
  },

  // 审核用户
  openApprove(e) {
    const { id, name } = e.currentTarget.dataset
    this.setData({ showApprove: true, approveUserId: id, approveName: name, approveRole: 'user' })
  },

  closeApprove() {
    this.setData({ showApprove: false })
  },

  onRoleChange(e) {
    this.setData({ approveRole: e.detail.value })
  },

  async handleApprove() {
    const { approveUserId, approveRole, loading } = this.data
    if (loading) return
    this.setData({ loading: true, showApprove: false })
    try {
      const { error } = await supabase.from('users')
        .update({ status: 'active', role: approveRole })
        .eq('id', approveUserId)
      if (error) throw new Error(error.message)
      wx.showToast({ title: '审核通过', icon: 'success' })
      this.loadUsers()
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 禁用用户
  handleDisable(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '确认禁用',
      content: `禁用用户「${name}」？禁用后该账号无法登录。`,
      success: (res) => {
        if (!res.confirm) return
        supabase.from('users').update({ status: 'disabled' }).eq('id', id).then(() => {
          wx.showToast({ title: '已禁用', icon: 'success' })
          this.loadUsers()
        })
      }
    })
  },

  // 删除用户
  handleDeleteUser(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: `删除用户「${name}」？此操作不可恢复！`,
      success: (res) => {
        if (!res.confirm) return
        supabase.from('users').delete().eq('id', id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadUsers()
        })
      }
    })
  },

  // 同步用户数据（从 Auth 同步到 users 表）
  async handleSync() {
    wx.showLoading({ title: '同步中...' })
    try {
      // 获取 Auth 中的所有用户
      const res = await wx.request({
        url: 'https://abkscyijuvkfeazhlquz.supabase.co/auth/v1/admin/users',
        method: 'GET',
        header: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'
        }
      })
      const authUsers = (res.data || {}).users || []
      for (const au of authUsers) {
        const { data: ex } = await supabase.from('users').select('id').eq('id', au.id).single()
        if (!ex) {
          await supabase.from('users').insert([{
            id: au.id,
            email: au.email || '',
            name: au.user_metadata?.name || au.email?.split('@')[0] || '用户',
            role: 'user',
            status: 'active'
          }])
        }
      }
      wx.hideLoading()
      wx.showToast({ title: '同步完成，共 ' + authUsers.length + ' 个账号', icon: 'success' })
      this.loadUsers()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '同步失败', icon: 'none' })
    }
  },

  // 查看账本成员
  showLedgerMembers(e) {
    const ledgerId = e.currentTarget.dataset.id
    const ledger = this.data.ledgers.find(l => l.id === ledgerId)
    const ledgerMembers = (this.data.members || []).filter(m => m.ledger_id === ledgerId)
    const content = ledgerMembers.length === 0
      ? '暂无成员'
      : ledgerMembers.map(m => `${m.user?.name || '未知'} (${m.role})`).join('\n')
    wx.showModal({ title: `「${ledger?.name}」成员`, content, showCancel: false })
  },

  // 删除账本
  handleDeleteLedger(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: `删除账本「${name}」？所有账目数据将永久删除！`,
      success: (res) => {
        if (!res.confirm) return
        supabase.from('ledgers').delete().eq('id', id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadLedgers()
        })
      }
    })
  },
})
