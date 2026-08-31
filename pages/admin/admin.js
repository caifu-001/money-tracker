// pages/admin/admin.js
const app = getApp()
const { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } = require('../../utils/supabase')
const { initDefaultCategories } = require('../../utils/categories')

// 北京时间格式化：数据库存 UTC，展示统一 +8
// 返回 { date: 'YYYY-MM-DD', datetime: 'YYYY-MM-DD HH:mm' }
function fmtBJ(isoStr) {
  if (!isoStr) return { date: '--', datetime: '--' }
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return { date: '--', datetime: '--' }
  const bj = new Date(d.getTime() + 8 * 3600000)
  const pad = n => String(n).padStart(2, '0')
  const date = `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}`
  const datetime = `${date} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`
  return { date, datetime }
}

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
    editingLedgerId: null,
    editLedgerName: '',
    showCreate: false,
    newLedgerName: '',
    creating: false,
    editName: '',
    savingProfile: false,
    // 用户管理
    users: [],
    autoApprove: false,
    // 加入账本
    inputInviteCode: '',
    // 账户详情
    profile: {
      idShown: '',
      email: '',
      roleName: '',
      roleClass: '',
      statusName: '',
      createdDate: '',
      loginDate: '',
      ledgerCount: 0,
    },
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
    } else if (tab === 'account') {
      await this.loadProfile()
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

  // ── 账本 Tab 增删改 ──
  goLedgersPage() {
    wx.navigateTo({ url: '/pages/ledgers/ledgers' })
  },
  toggleCreate() { this.setData({ showCreate: !this.data.showCreate, newLedgerName: '' }) },
  onNewLedgerNameInput(e) { this.setData({ newLedgerName: e.detail.value }) },
  async handleCreateLedger() {
    const { newLedgerName, user, creating } = this.data
    if (!newLedgerName || !newLedgerName.trim() || creating) return
    this.setData({ creating: true })
    try {
      const { data, error } = await supabase.from('ledgers').insert([{ name: newLedgerName.trim(), owner_id: user.id, type: 'personal' }]).select()
      if (error) throw new Error(error.message)
      this.setData({ showCreate: false, newLedgerName: '' })
      // 初始化预置分类
      if (data && data[0]) await initDefaultCategories(supabase, data[0].id)
      await this.loadMyLedgers()
      wx.showToast({ title: '创建成功', icon: 'success' })
    } catch(e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' })
    } finally {
      this.setData({ creating: false })
    }
  },
  startEditLedger(e) {
    const ledger = this.data.myLedgers[e.currentTarget.dataset.index]
    this.setData({ editingLedgerId: ledger.id, editLedgerName: ledger.name })
  },
  onEditLedgerNameInput(e) { this.setData({ editLedgerName: e.detail.value }) },
  cancelEditLedger() { this.setData({ editingLedgerId: null, editLedgerName: '' }) },
  async saveLedgerName(e) {
    const id = e.currentTarget.dataset.id
    const newName = (this.data.editLedgerName || '').trim()
    if (!newName) { this.cancelEditLedger(); return }
    const { error } = await supabase.from('ledgers').update({ name: newName }).eq('id', id)
    if (error) { wx.showToast({ title: error.message || '修改失败', icon: 'none' }); return }
    this.setData({ editingLedgerId: null, editLedgerName: '' })
    await this.loadMyLedgers()
    wx.showToast({ title: '已修改', icon: 'success' })
  },
  async handleDeleteLedger(e) {
    const ledger = this.data.myLedgers[e.currentTarget.dataset.index]
    wx.showModal({
      title: '⚠️ 确认删除',
      content: `确定删除账本「${ledger.name}」？所有数据将被永久删除！`,
      success: async res => {
        if (!res.confirm) return
        wx.showModal({
          title: '再次确认',
          content: `输入「${ledger.name}」以确认删除:`,
          editable: true,
          placeholderText: ledger.name,
          success: async r2 => {
            if (!r2.confirm || r2.content !== ledger.name) {
              wx.showToast({ title: '已取消', icon: 'none' })
              return
            }
            try {
              await supabase.from('ledgers').delete().eq('id', ledger.id)
              if (app.globalData.currentLedger && app.globalData.currentLedger.id === ledger.id) {
                app.globalData.currentLedger = null
                wx.removeStorageSync('default_ledger_id')
              }
              wx.showToast({ title: '已删除', icon: 'success' })
              await this.loadMyLedgers()
            } catch(e) {
              wx.showToast({ title: '删除失败: ' + (e.message || ''), icon: 'none' })
            }
          }
        })
      }
    })
  },

  async loadProfile() {
    const { user } = this.data
    if (!user) return
    try {
      // 查询用户详细信息
      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
      // 查询账本数量
      const { data: ledgers } = await supabase.from('ledgers').select('id').eq('owner_id', user.id)
      const ledgerCount = (ledgers || []).length

      const roleMap = { admin: '管理员', manager: '管理员', user: '普通用户' }
      const roleClassMap = { admin: 'role-admin', manager: 'role-admin', user: 'role-user' }
      const statusMap = { active: '正常', pending: '待审核', disabled: '已禁用' }

      this.setData({
        profile: {
          idShown: (user.id || '').slice(0, 8) + '...',
          email: profile?.email || user.email || '',
          roleName: roleMap[user.role] || user.role || '--',
          roleClass: roleClassMap[user.role] || 'role-user',
          status: profile?.status || user.status || 'active',
          statusName: statusMap[profile?.status || user.status] || '--',
          createdDate: fmtBJ(profile?.created_at).date,
          loginDate: fmtBJ(profile?.last_login).datetime,
          ledgerCount: ledgerCount,
        }
      })
    } catch (e) {
      console.error('[loadProfile]', e)
    }
  },

  async loadUsers() {
    // 懒触发：清理已删除超 15 天的用户（不阻塞列表渲染，fire-and-forget）
    this._purgeDeletedUsersLazy()
    const { data, error } = await supabase.from('users').select('id,name,email,role,status,created_at,last_login,deleted_at')
    if (error) { console.error('loadUsers error:', error); wx.showToast({ title: '加载用户失败:' + error.message, icon: 'none', duration: 3000 }); return }
    console.log('[loadUsers] users count:', data?.length || 0)
    if (data?.[0]) {
      console.log('[loadUsers] first user keys:', Object.keys(data[0]).join(', '))
      console.log('[loadUsers] first user created_at:', data[0].created_at)
      console.log('[loadUsers] first user last_login:', data[0].last_login)
      console.log('[loadUsers] first user status:', data[0].status)
      console.log('[loadUsers] first user role:', data[0].role)
    }
    // 按最后登录时间倒序（越新越靠前）；从未登录（last_login 为空）排最后
    // tiebreaker：登录时间相同（含都为 null）时，按注册时间倒序，保证排序稳定
    const sorted = (data || []).slice().sort((a, b) => {
      const ta = a.last_login ? new Date(a.last_login).getTime() : -Infinity
      const tb = b.last_login ? new Date(b.last_login).getTime() : -Infinity
      if (tb !== ta) return tb - ta
      const ca = a.created_at ? new Date(a.created_at).getTime() : -Infinity
      const cb = b.created_at ? new Date(b.created_at).getTime() : -Infinity
      return cb - ca
    })
    // 计算活跃度 + 预处理日期格式
    const now = Date.now()
    const withActivity = sorted.map(u => {
      let activity = '从未登录'
      let activityClass = 'zombie'
      if (u.status === 'deleted') {
        // 已删除账户：活跃度位置改为显示剩余保留天数
        activity = '已删除'
        activityClass = 'deleted'
      } else if (u.last_login) {
        const diff = now - new Date(u.last_login).getTime()
        const days = Math.floor(diff / 86400000)
        if (days <= 7)  { activity = '在线';    activityClass = 'online' }
        else if (days <= 30) { activity = '活跃';   activityClass = 'active' }
        else if (days <= 90) { activity = '一般';   activityClass = 'normal' }
        else if (days <= 180){ activity = '不活跃'; activityClass = 'inactive' }
        else               { activity = '僵尸';   activityClass = 'zombie' }
      }
      // 预处理日期格式（WXML 不支持 .slice() 方法调用）；统一北京时间
      const createdDate = fmtBJ(u.created_at).date
      const loginDate = fmtBJ(u.last_login).datetime
      // 已删除账户：计算剩余保留天数（15天内可恢复）
      let remainDays = null
      if (u.status === 'deleted' && u.deleted_at) {
        const elapsed = Math.floor((now - new Date(u.deleted_at).getTime()) / 86400000)
        remainDays = Math.max(0, 15 - elapsed)
      }
      return { ...u, activity, activityClass, createdDate, loginDate, remainDays }
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
    
    // 先尝试 upsert
    const updateResult = await supabase.from('app_settings').upsert(
      { key: 'auto_approve', value: String(newVal) },
      { onConflict: 'key' }
    )
    console.log('[toggleAutoApprove] upsert result:', JSON.stringify(updateResult))
    
    // 如果 upsert 失败，使用 REST API 直接调用（绕过 RLS）
    if (updateResult.error) {
      console.log('[toggleAutoApprove] upsert 失败，尝试 REST API...')
      const token = wx.getStorageSync('sb_access_token')
      const result = await new Promise((resolve) => {
        wx.request({
          url: 'https://abkscyijuvkfeazhlquz.supabase.co/rest/v1/app_settings?on_conflict=key',
          method: 'POST',
          data: { key: 'auto_approve', value: String(newVal) },
          header: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4',
            'Authorization': 'Bearer ' + token,
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          success: (res) => {
            console.log('[toggleAutoApprove] REST API success:', res.statusCode)
            resolve({ success: res.statusCode === 200 || res.statusCode === 201 })
          },
          fail: (err) => {
            console.error('[toggleAutoApprove] REST API fail:', err)
            resolve({ success: false })
          }
        })
      })
      
      if (!result.success) {
        wx.showModal({
          title: '更新失败',
          content: '数据库权限限制，请检查 RLS 策略',
          showCancel: false
        })
        return
      }
    }
    
    this.setData({ autoApprove: newVal })
    wx.showToast({ title: newVal ? '已开启自动审核' : '已关闭自动审核', icon: 'success' })
  },

  // 调用后端 SECURITY DEFINER RPC（内部做最终权限校验，前端被绕过也无法越权）
  _callAdminRpc(fnName, params) {
    return new Promise((resolve) => {
      wx.request({
        url: SUPABASE_URL + '/rest/v1/rpc/' + fnName,
        method: 'POST',
        data: params,
        header: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + (wx.getStorageSync('sb_access_token') || SUPABASE_ANON_KEY),
        },
        success: r => resolve(r),
        fail: e => resolve({ statusCode: 0, data: { error: '网络异常' } })
      })
    })
  },

  // 用户操作权限守卫：禁止操作自己；默认禁止操作管理员（仅普通用户可被降权/删除）
  // opts.forbidAdmin=false 时允许操作管理员（用于恢复类操作：启用/通过）
  _guardUserOp(userId, action, opts = {}) {
    const { user, users } = this.data
    if (user && userId === user.id) {
      return `不能${action}自己的账户`
    }
    const target = (users || []).find(u => u.id === userId)
    if (!target) {
      return '用户不存在'
    }
    if (opts.forbidAdmin !== false && target.role !== 'user') {
      return `不能${action}管理员账户`
    }
    return null
  },

  // 懒触发：清理已删除超 15 天的用户（不阻塞，失败静默）
  async _purgeDeletedUsersLazy() {
    try {
      const res = await this._callAdminRpc('admin_purge_deleted_users', {})
      if (res.statusCode < 400 && res.data != null) {
        console.log('[purge] 已清理过期账户数:', res.data)
      }
    } catch (e) {
      console.log('[purge] 清理调用失败（忽略）:', e)
    }
  },

  async handleApproveUser(e) {
    const userId = e.currentTarget.dataset.id
    const err = this._guardUserOp(userId, '通过', { forbidAdmin: false })
    if (err) return wx.showToast({ title: err, icon: 'none' })
    const res = await this._callAdminRpc('admin_set_user_status', { p_target_id: userId, p_status: 'active' })
    if (res.statusCode >= 400) return wx.showToast({ title: (res.data && res.data.message) || '操作失败', icon: 'none' })
    wx.showToast({ title: '已通过', icon: 'success' })
    this.loadUsers()
  },

  async handleDisableUser(e) {
    const userId = e.currentTarget.dataset.id
    const err = this._guardUserOp(userId, '禁用')
    if (err) return wx.showToast({ title: err, icon: 'none' })
    const res = await this._callAdminRpc('admin_set_user_status', { p_target_id: userId, p_status: 'disabled' })
    if (res.statusCode >= 400) return wx.showToast({ title: (res.data && res.data.message) || '操作失败', icon: 'none' })
    wx.showToast({ title: '已禁用', icon: 'success' })
    this.loadUsers()
  },

  async handleEnableUser(e) {
    const userId = e.currentTarget.dataset.id
    const err = this._guardUserOp(userId, '启用', { forbidAdmin: false })
    if (err) return wx.showToast({ title: err, icon: 'none' })
    const res = await this._callAdminRpc('admin_set_user_status', { p_target_id: userId, p_status: 'active' })
    if (res.statusCode >= 400) return wx.showToast({ title: (res.data && res.data.message) || '操作失败', icon: 'none' })
    wx.showToast({ title: '已启用', icon: 'success' })
    this.loadUsers()
  },

  async handleDeleteUser(e) {
    const userId = e.currentTarget.dataset.id
    const err = this._guardUserOp(userId, '删除')
    if (err) return wx.showToast({ title: err, icon: 'none' })
    wx.showModal({
      title: '确认删除',
      content: '删除后账户数据将保留 15 天，期间可恢复；15 天后永久清除。确定删除吗？',
      success: async (res) => {
        if (!res.confirm) return
        const rpcRes = await this._callAdminRpc('admin_soft_delete_user', { p_target_id: userId })
        if (rpcRes.statusCode >= 400) return wx.showToast({ title: (rpcRes.data && rpcRes.data.message) || '删除失败', icon: 'none' })
        wx.showToast({ title: '已删除（15天内可恢复）', icon: 'success' })
        this.loadUsers()
      }
    })
  },

  async handleRestoreUser(e) {
    const userId = e.currentTarget.dataset.id
    const err = this._guardUserOp(userId, '恢复', { forbidAdmin: false })
    if (err) return wx.showToast({ title: err, icon: 'none' })
    wx.showModal({
      title: '确认恢复',
      content: '恢复后该账户将重新启用，确定恢复吗？',
      success: async (res) => {
        if (!res.confirm) return
        const rpcRes = await this._callAdminRpc('admin_restore_user', { p_target_id: userId })
        if (rpcRes.statusCode >= 400) return wx.showToast({ title: (rpcRes.data && rpcRes.data.message) || '恢复失败', icon: 'none' })
        wx.showToast({ title: '已恢复', icon: 'success' })
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
      content: '版本：v5.1.1\n\n一款简洁的家庭记账工具\n支持多账本、预算管理、数据分析\n\n© 2026 游游记账团队',
      showCancel: false
    })
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' })
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },
})
