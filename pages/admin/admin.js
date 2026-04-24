// pages/admin/admin.js
const app = getApp()
const { supabase } = require('../../utils/supabase')

Page({
  data: {
    user: null,
    isGuest: true,
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
    // 用户管理
    users: [],
    autoApprove: false,
    // 加入账本
    inputInviteCode: '',
  },

  onLoad() {
    const user = app.globalData.user
    const currentLedger = app.globalData.currentLedger
    this.setData({ 
      user: user || null, 
      isGuest: !user,
      editName: user?.name || '', 
      currentLedger 
    })
    if (user) this.loadData()
  },

  onShow() {
    // 刷新用户状态
    const user = app.globalData.user
    this.setData({ user: user || null, isGuest: !user })
    
    const currentLedger = app.globalData.currentLedger
    this.setData({ currentLedger })
    if (user) this.loadData()
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  onNameInput(e) { this.setData({ editName: e.detail.value }) },

  async handleSaveProfile() {
    const { editName, user } = this.data
    if (!editName || !editName.trim()) return wx.showToast({ title: '昵称不能为空', icon: 'none' })
    const { error } = await supabase.from('users').update({ name: editName.trim() }).eq('id', user.id)
    if (error) return wx.showToast({ title: error.message || '修改失败', icon: 'none' })
    const updatedUser = { ...user, name: editName.trim() }
    app.globalData.user = updatedUser
    wx.setStorageSync('user_info', updatedUser)
    this.setData({ user: updatedUser })
    wx.showToast({ title: '昵称已修改', icon: 'success' })
  },

  handleLogout() {
    app.logout()
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
    if (!user) { this.setData({ loading: false }); return }

    this.setData({ loading: true })
    if (tab === 'family') {
      await this.loadMembers()
      await this.loadMyLedgers()
    } else if (tab === 'ledgers') {
      await this.loadLedgers()
    }
    if (tab === 'users' && (user.role === 'admin' || user.role === 'manager')) {
      await this.loadUsers()
      await this.loadAutoApprove()
    }
    this.setData({ loading: false })
  },

  async loadMembers() {
    const ledger = app.globalData.currentLedger
    if (!ledger) return
    const { data } = await supabase.from('ledger_members').select('user_id, role, users(name)').eq('ledger_id', ledger.id)
    this.setData({ members: data || [] })
    // 生成邀请码：账本ID去横线前8位
    this.setData({ inviteCode: ledger.id.replace(/-/g, '').slice(0, 8).toUpperCase() })
  },

  async loadMyLedgers() {
    const { user } = this.data
    // 自己创建的账本
    const { data: owned } = await supabase.from('ledgers').select('*').eq('owner_id', user.id)
    // 加入的账本
    const { data: memberOf } = await supabase.from('ledger_members').select('ledgers(*)').eq('user_id', user.id)
    const joined = (memberOf || []).map(m => m.ledgers).filter(Boolean)
    const all = [...(owned || []), ...joined]
    // 去重
    const map = new Map()
    all.forEach(l => { if (l && l.id) map.set(l.id, l) })
    this.setData({ myLedgers: Array.from(map.values()) })
  },

  async loadLedgers() {
    await this.loadMyLedgers()
  },

  async loadUsers() {
    const { data, error } = await supabase.from('users').select('id,name,email,role,status,created_at,last_login').order('created_at', { ascending: false })
    if (error) { console.error('loadUsers error:', error); wx.showToast({ title: '加载用户失败:' + error.message, icon: 'none', duration: 3000 }); return }
    console.log('[loadUsers] users count:', data?.length || 0)
    if (data?.[0]) {
      console.log('[loadUsers] first user keys:', Object.keys(data[0]).join(', '))
      console.log('[loadUsers] first user created_at:', data[0].created_at)
      console.log('[loadUsers] first user last_login:', data[0].last_login)
      console.log('[loadUsers] first user status:', data[0].status)
      console.log('[loadUsers] first user role:', data[0].role)
    }
    // 计算活跃度 + 预处理日期格式
    const now = Date.now()
    const withActivity = (data || []).map(u => {
      let activity = '从未登录'
      let activityClass = 'zombie'
      if (u.last_login) {
        const diff = now - new Date(u.last_login).getTime()
        const days = Math.floor(diff / 86400000)
        if (days <= 7)  { activity = '在线';    activityClass = 'online' }
        else if (days <= 30) { activity = '活跃';   activityClass = 'active' }
        else if (days <= 90) { activity = '一般';   activityClass = 'normal' }
        else if (days <= 180){ activity = '不活跃'; activityClass = 'inactive' }
        else               { activity = '僵尸';   activityClass = 'zombie' }
      }
      // 预处理日期格式（WXML 不支持 .slice() 方法调用）
      const createdDate = u.created_at ? u.created_at.slice(0, 10) : '--'
      const loginDate = u.last_login ? u.last_login.slice(0, 10) : '--'
      return { ...u, activity, activityClass, createdDate, loginDate }
    })
    console.log('[loadUsers] setting users:', withActivity.length)
    if (withActivity[0]) {
      console.log('[loadUsers] first user activity:', withActivity[0].activity)
      console.log('[loadUsers] first user activityClass:', withActivity[0].activityClass)
    }
    this.setData({ users: withActivity })
  },

  async loadAutoApprove() {
    try {
      // 使用 maybeSingle 避免 406 错误（行不存在时返回 null 而非报错）
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'auto_approve').maybeSingle()
      if (error) {
        console.log('[loadAutoApprove] error:', error.message)
        this.setData({ autoApprove: false })
        return
      }
      console.log('[loadAutoApprove] value:', data?.value)
      this.setData({ autoApprove: data?.value === 'true' })
    } catch (e) {
      console.log('[loadAutoApprove] catch:', e)
      this.setData({ autoApprove: false })
    }
  },

  copyInviteCode() {
    wx.setClipboardData({ data: this.data.inviteCode, success: () => {
      this.setData({ copied: true })
      setTimeout(() => this.setData({ copied: false }), 2000)
    }})
  },

  openJoin() { this.setData({ showJoin: true, joinCode: '', joinResult: null }) },
  closeJoin() { this.setData({ showJoin: false }) },
  onJoinCodeInput(e) { this.setData({ joinCode: e.detail.value.toUpperCase() }) },

  async handleJoin() {
    const { joinCode, user } = this.data
    if (!joinCode || joinCode.length < 8) return wx.showToast({ title: '请输入8位邀请码', icon: 'none' })
    this.setData({ joining: true })
    try {
      // 通过邀请码查找账本
      const { data: ledgers } = await supabase.from('ledgers').select('*')
      const target = (ledgers || []).find(l => l.id.replace(/-/g, '').slice(0, 8).toUpperCase() === joinCode.toUpperCase())
      if (!target) throw new Error('邀请码无效')
      
      // 加入账本
      const { error } = await supabase.from('ledger_members').insert([{
        ledger_id: target.id, user_id: user.id, role: 'editor'
      }])
      if (error) throw new Error(error.message)
      
      this.setData({ showJoin: false, joinResult: { success: true, ledger: target } })
      wx.showToast({ title: '加入成功', icon: 'success' })
      this.loadMyLedgers()
    } catch (e) {
      this.setData({ joinResult: { success: false, error: e.message || '加入失败' } })
      wx.showToast({ title: e.message || '加入失败', icon: 'none' })
    } finally {
      this.setData({ joining: false })
    }
  },

  async toggleAutoApprove() {
    const { autoApprove, user } = this.data
    const newVal = !autoApprove
    console.log('[toggleAutoApprove] current:', autoApprove, 'new:', newVal, 'user:', user?.id, 'role:', user?.role)
    
    // 检查权限
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      wx.showToast({ title: '权限不足，需要管理员身份', icon: 'none' })
      return
    }
    
    // 先尝试 upsert（绕过 UPDATE RLS 限制）
    const updateResult = await supabase.from('app_settings').upsert(
      { key: 'auto_approve', value: String(newVal) },
      { onConflict: 'key' }
    )
    console.log('[toggleAutoApprove] upsert result:', JSON.stringify(updateResult))
    
    // 立即查询确认
    let { data: checkData } = await supabase.from('app_settings').select('value').eq('key', 'auto_approve').single()
    console.log('[toggleAutoApprove] DB value after direct update:', checkData?.value)
    
    // 如果直接更新未生效，可能是 RLS 问题，提示用户
    if (checkData?.value !== String(newVal)) {
      console.error('[toggleAutoApprove] 直接更新未生效！当前用户角色:', user?.role)
      console.error('[toggleAutoApprove] 请在 Supabase Dashboard 执行: ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;')
      wx.showModal({
        title: '更新失败',
        content: '数据库权限限制，请联系超级管理员在 Supabase 中设置 RLS 策略',
        showCancel: false
      })
      return
    }
    
    this.setData({ autoApprove: checkData?.value === 'true' })
    wx.showToast({ title: checkData?.value === 'true' ? '已开启自动审核' : '已关闭自动审核', icon: 'success' })
  },

  async handleApproveUser(e) {
    const userId = e.currentTarget.dataset.id
    const { error } = await supabase.from('users').update({ status: 'active' }).eq('id', userId)
    if (error) return wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    wx.showToast({ title: '已通过', icon: 'success' })
    this.loadUsers()
  },

  async handleDisableUser(e) {
    const userId = e.currentTarget.dataset.id
    const { error } = await supabase.from('users').update({ status: 'disabled' }).eq('id', userId)
    if (error) return wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    wx.showToast({ title: '已禁用', icon: 'success' })
    this.loadUsers()
  },

  async handleEnableUser(e) {
    const userId = e.currentTarget.dataset.id
    const { error } = await supabase.from('users').update({ status: 'active' }).eq('id', userId)
    if (error) return wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    wx.showToast({ title: '已启用', icon: 'success' })
    this.loadUsers()
  },

  async handleDeleteUser(e) {
    const userId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除用户后其数据将无法恢复，确定删除吗？',
      success: async (res) => {
        if (!res.confirm) return
        const { error } = await supabase.from('users').delete().eq('id', userId)
        if (error) return wx.showToast({ title: error.message || '删除失败', icon: 'none' })
        wx.showToast({ title: '已删除', icon: 'success' })
        this.loadUsers()
      }
    })
  },

  switchLedger(e) {
    const ledger = e.currentTarget.dataset.ledger
    app.globalData.currentLedger = ledger
    app.saveDefaultLedger(ledger)
    this.setData({ currentLedger: ledger })
    wx.showToast({ title: '已切换账本', icon: 'success' })
  },

  goAbout() {
    wx.showModal({
      title: '游游记账',
      content: '版本：v4.0.4\n\n一款简洁的家庭记账工具\n支持多账本、预算管理、数据分析\n\n© 2026 游游记账团队',
      showCancel: false
    })
  },
})
