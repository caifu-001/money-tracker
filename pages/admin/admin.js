// pages/admin/admin.js
const app = getApp()
const { supabase } = require('../../utils/supabase')

Page({
  data: {
    user: null,
    currentLedger: null,
    loading: true,
    tab: 'family',
    members: [],
    inviteCode: '',
    copied: false,
    showJoin: false,
    joinCode: '',
    joining: false,
    joinResult: null,
    myLedgers: [],
    editName: '',
    savingProfile: false,
    showPasswordForm: false,
    newPassword: '',
    changingPwd: false,
    ledgers: [],
    showCreateLedger: false,
    newLedgerName: '',
    newLedgerType: 'personal',
    creating: false,
    users: [],
    showApprove: false,
    approveUserId: '',
    approveName: '',
    approveRole: 'user',
  },

  onLoad() {
    console.log('admin onLoad')
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    const currentLedger = app.globalData.currentLedger
    this.setData({ user, editName: user.name || '', currentLedger })
    this.loadData()
  },

  handleLogout() {
    console.log('logout tapped')
    app.logout()
  },

  onShow() {
    const currentLedger = app.globalData.currentLedger
    this.setData({ currentLedger })
    this.loadData()
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
    this.loadData()
  },

  goExport() {
    wx.navigateTo({ url: '/pages/export/export' })
  },

  async loadData() {
    const { tab, user } = this.data
    this.setData({ loading: true })
    if (tab === 'family') {
      await this.loadMembers()
      await this.loadMyLedgers()
    } else if (tab === 'ledgers') {
      await this.loadLedgers()
    } else if (tab === 'users' && (user.role === 'admin' || user.role === 'manager')) {
      await this.loadUsers()
    }
    this.setData({ loading: false })
  },

  async loadMembers() {
    const ledger = app.globalData.currentLedger
    if (!ledger) return
    const { data } = await supabase.from('ledger_members').select('*').eq('ledger_id', ledger.id)
    const { data: allLedgers } = await supabase.from('ledgers').select('*')
    this.setData({ 
      members: data || [], 
      allLedgers: allLedgers || [],
      inviteCode: ledger.id
    })
  },

  async loadMyLedgers() {
    const user = app.globalData.user
    if (!user) return
    const { data } = await supabase.from('ledgers').select('*').eq('owner_id', user.id)
    this.setData({ myLedgers: data || [] })
  },

  async loadLedgers() {
    const user = app.globalData.user
    if (!user) return
    const { data } = await supabase.from('ledgers').select('*').eq('owner_id', user.id)
    this.setData({ ledgers: data || [] })
  },

  async loadUsers() {
    const { data } = await supabase.from('users').select('*')
    this.setData({ users: data || [] })
  },

  async handleJoin() {
    const { joinCode } = this.data
    if (!joinCode) return wx.showToast({ title: '请输入邀请码', icon: 'none' })
    this.setData({ joining: true })
    // 先用邀请码查找对应账本
    const { data: allLedgers } = await supabase.from('ledgers').select('*')
    const code = joinCode.trim().toUpperCase().replace(/-/g, '')
    const matched = (allLedgers || []).find(l => {
      const lid = l.id.replace(/-/g, '').toUpperCase()
      return lid.startsWith(code) || code.startsWith(lid.substring(0, 8))
    })
    if (!matched) {
      this.setData({ joining: false })
      return wx.showToast({ title: '邀请码无效', icon: 'none' })
    }
    // 检查是否已是成员
    const { data: existing } = await supabase.from('ledger_members').select('id')
      .eq('ledger_id', matched.id).eq('user_id', app.globalData.user.id)
    if (existing && existing.length > 0) {
      this.setData({ joining: false })
      return wx.showToast({ title: '你已是该账本成员', icon: 'none' })
    }
    // 加入账本，role 必须是 owner/editor/viewer 之一
    const { error } = await supabase.from('ledger_members').insert([{ ledger_id: matched.id, user_id: app.globalData.user.id, role: 'editor' }])
    this.setData({ joining: false })
    if (error) return wx.showToast({ title: error.message || '加入失败', icon: 'none' })
    this.setData({ showJoin: false, joinCode: '' })
    wx.showToast({ title: '加入成功', icon: 'success' })
    this.loadMembers()
  },

  async handleCreateLedger() {
    const { newLedgerName, newLedgerType } = this.data
    if (!newLedgerName) return wx.showToast({ title: '请输入账本名称', icon: 'none' })
    this.setData({ creating: true })
    const { data, error } = await supabase.from('ledgers').insert([{ name: newLedgerName, type: newLedgerType, owner_id: app.globalData.user.id }])
    this.setData({ creating: false })
    if (error) return wx.showToast({ title: error.message, icon: 'none' })
    this.setData({ showCreateLedger: false, newLedgerName: '' })
    wx.showToast({ title: '创建成功', icon: 'success' })
    if (data && data[0]) {
      app.saveDefaultLedger(data[0])
      app.globalData.currentLedger = data[0]
    }
    this.loadData()
  },

  async handleDeleteLedger(e) {
    const { id, name } = e.currentTarget.dataset
    const res = await wx.showModal({ title: '删除账本', content: '确定删除账本「' + name + '」？' })
    if (!res.confirm) return
    await supabase.from('ledger_members').delete().eq('ledger_id', id)
    await supabase.from('transactions').delete().eq('ledger_id', id)
    await supabase.from('categories').delete().eq('ledger_id', id)
    await supabase.from('budgets').delete().eq('ledger_id', id)
    await supabase.from('ledgers').delete().eq('id', id)
    if (app.globalData.currentLedger && app.globalData.currentLedger.id === id) {
      const d = app.getDefaultLedger()
      app.globalData.currentLedger = d || null
    }
    wx.showToast({ title: '已删除', icon: 'success' })
    this.loadData()
  },

  async handleResetPassword(e) {
    const { id, name } = e.currentTarget.dataset
    const res = await wx.showModal({
      title: '重置密码',
      content: '为「' + name + '」设置新密码',
      editable: true,
      placeholderText: '输入新密码（至少6位）'
    })
    if (!res.confirm || !res.content) return
    if (res.content.length < 6) return wx.showToast({ title: '密码至少6位', icon: 'none' })
    wx.showLoading({ title: '重置中...' })
    const result = await new Promise((resolve) => {
      wx.request({
        url: 'https://abkscyijuvkfeazhlquz.supabase.co/auth/v1/admin/users/' + id,
        method: 'PUT',
        header: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxMjU0MiwiZXhwIjoyMDg5OTg4NTQyfQ.tVBp64EO05d6ADTv7Mb9PvSPgPdmXF-_fiYoA2tzpow',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxMjU0MiwiZXhwIjoyMDg5OTg4NTQyfQ.tVBp64EO05d6ADTv7Mb9PvSPgPdmXF-_fiYoA2tzpow'
        },
        data: { password: res.content },
        success: (res) => resolve({ ok: true, data: res }),
        fail: (err) => resolve({ ok: false, err: err })
      })
    })
    wx.hideLoading()
    if (!result.ok) {
      wx.showToast({ title: '请求失败', icon: 'none' })
      return
    }
    var r = result.data
    if (r.statusCode >= 200 && r.statusCode < 300) {
      wx.showToast({ title: '密码重置成功', icon: 'success' })
    } else {
      wx.showToast({ title: '重置失败', icon: 'none' })
    }
  },

  async handleApproveUser() {
    const { approveUserId, approveRole } = this.data
    wx.showLoading({ title: '处理中...' })
    const { error } = await supabase.from('users').update({ status: 'active', role: approveRole }).eq('id', approveUserId)
    wx.hideLoading()
    if (error) return wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    this.setData({ showApprove: false })
    this.loadUsers()
    wx.showToast({ title: '操作成功', icon: 'success' })
  },

  async handleDisableUser(e) {
    const { id } = e.currentTarget.dataset
    const res = await wx.showModal({ title: '确认禁用', content: '确定禁用该用户？' })
    if (!res.confirm) return
    const { error } = await supabase.from('users').update({ status: 'disabled' }).eq('id', id)
    if (error) return wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    this.loadUsers()
    wx.showToast({ title: '已禁用', icon: 'success' })
  },

  async handleEnableUser(e) {
    const { id } = e.currentTarget.dataset
    const { error } = await supabase.from('users').update({ status: 'active' }).eq('id', id)
    if (error) return wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    this.loadUsers()
    wx.showToast({ title: '已启用', icon: 'success' })
  },

  async handleDeleteUser(e) {
    const { id } = e.currentTarget.dataset
    const res = await wx.showModal({ title: '删除用户', content: '确定删除该用户？' })
    if (!res.confirm) return
    await supabase.from('users').delete().eq('id', id)
    this.loadUsers()
    wx.showToast({ title: '已删除', icon: 'success' })
  },

  async handleDeleteMember(e) {
    const { id } = e.currentTarget.dataset
    await supabase.from('ledger_members').delete().eq('id', id)
    this.loadMembers()
  },

  async handleLeaveLedger(e) {
    const { id } = e.currentTarget.dataset
    const res = await wx.showModal({ title: '退出账本', content: '确定退出该账本？' })
    if (!res.confirm) return
    await supabase.from('ledger_members').delete().eq('id', id)
    if (app.globalData.currentLedger && app.globalData.currentLedger.id === id) app.globalData.currentLedger = null
    this.loadMembers()
    wx.showToast({ title: '已退出', icon: 'success' })
  },

  handleApproveOpen(e) {
    const { id, name, role } = e.currentTarget.dataset
    this.setData({ showApprove: true, approveUserId: id, approveName: name, approveRole: role || 'user' })
  },
  closeApprove() { this.setData({ showApprove: false }) },
  onApproveRoleChange(e) { this.setData({ approveRole: e.detail.value }) },
  onJoinCodeInput(e) { this.setData({ joinCode: e.detail.value }) },
  onNewLedgerInput(e) { this.setData({ newLedgerName: e.detail.value }) },
  onNewLedgerTypeChange(e) { this.setData({ newLedgerType: e.currentTarget.dataset.value }) },
  toggleJoin() { this.setData({ showJoin: !this.data.showJoin, joinCode: '' }) },
  toggleCreateLedger() { this.setData({ showCreateLedger: !this.data.showCreateLedger, newLedgerName: '', newLedgerType: 'personal' }) },
  copyInviteCode() {
    const { inviteCode } = this.data
    wx.setClipboardData({ data: inviteCode, success: () => wx.showToast({ title: '已复制', icon: 'success' }) })
    this.setData({ copied: true })
    setTimeout(() => this.setData({ copied: false }), 2000)
  },

  handleSwitchLedger(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return
    const ledger = this.data.ledgers ? this.data.ledgers.find(l => l.id === id) : null
    if (!ledger) { console.error('Ledger not found, id:', id, 'ledgers:', this.data.ledgers); return }
    app.globalData.currentLedger = ledger
    app.saveDefaultLedger(ledger)
    this.setData({ currentLedger: ledger })
    wx.showToast({ title: '已切换到「' + ledger.name + '」', icon: 'success' })
  },

  handleSetDefaultLedger(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return
    const ledger = this.data.ledgers ? this.data.ledgers.find(l => l.id === id) : null
    if (!ledger) return
    app.saveDefaultLedger(ledger)
    app.globalData.currentLedger = ledger
    this.setData({ currentLedger: ledger })
    wx.showToast({ title: '已设为默认', icon: 'success' })
  }
})
console.log('admin.js loaded OK')
