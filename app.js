// app.js - 全局入口
const { supabase } = require('./utils/supabase')
const { resolveBaseCurrency } = require('./utils/currency')
const { getRateMap } = require('./utils/rates')

App({
  globalData: {
    user: null,
    currentLedger: null,
    supabase,
    appName: '游游记账',
    sessionDate: null,
  },

  onLaunch() {
    this.restoreSession()
    this.prefetchRates()
  },

  // 静默预热汇率表（本位币非 CNY 或需要记外币时省一次等待）
  // 失败不影响启动：记账页会按需重试，并有离线参考汇率兜底
  prefetchRates() {
    try {
      const ledger = this.globalData.currentLedger || this.getDefaultLedger()
      const base = resolveBaseCurrency(ledger)
      getRateMap(base)
        .then(res => console.log('[app] 汇率预热完成 base=', base, 'source=', res.source, 'stale=', res.stale))
        .catch(() => {})
    } catch (e) {
      console.warn('[app] 汇率预热跳过', e)
    }
  },

  // 静默恢复登录态 — 老用户秒进，不等任何 DB 请求
  restoreSession() {
    const userInfo = wx.getStorageSync('user_info')
    const sessionDate = wx.getStorageSync('session_date')

    if (!userInfo || !sessionDate) {
      this.globalData.user = null
      this.globalData.currentLedger = null
      return
    }

    // session 有效期 7 天，过期才清除
    const SESSION_TTL_DAYS = 7
    const sessionMs = new Date(sessionDate + 'T00:00:00').getTime()
    const nowMs = Date.now()
    if (nowMs - sessionMs > SESSION_TTL_DAYS * 86400000) {
      console.log('[app] session 已过期，清除登录态')
      wx.removeStorageSync('session_date')
      wx.removeStorageSync('user_info')
      wx.removeStorageSync('sb_access_token')
      wx.removeStorageSync('sb_refresh_token')
      this.globalData.user = null
      this.globalData.currentLedger = null
      return
    }

    // 有效期内直接恢复，零网络请求
    this.globalData.user = userInfo
    const cachedLedger = this.getDefaultLedger()
    if (cachedLedger) {
      this.globalData.currentLedger = cachedLedger
    }
    console.log('[app] 静默恢复 session，user=', userInfo.name, 'ledger=', cachedLedger?.name)

    // 跨天时静默续期 session_date
    const today = (() => { const d = new Date(Date.now() + 8*3600000); return d.toISOString().split('T')[0] })()
    if (sessionDate !== today) {
      wx.setStorageSync('session_date', today)
    }
  },

  // 登录成功后调用
  onLoginSuccess(user, ledger) {
    const today = (() => { const d = new Date(Date.now() + 8*3600000); return d.toISOString().split('T')[0] })()
    wx.setStorageSync('session_date', today)
    wx.setStorageSync('user_info', user)
    this.globalData.user = user
    this.globalData.currentLedger = ledger
    // 同时保存默认账本到 storage，确保其他页面能恢复
    if (ledger) {
      wx.setStorageSync('default_ledger_id', ledger.id)
      wx.setStorageSync('default_ledger_name', ledger.name)
      wx.setStorageSync('default_ledger_type', ledger.type)
      wx.setStorageSync('default_ledger_owner', ledger.owner_id)
      wx.setStorageSync('default_ledger_currency', ledger.base_currency || 'CNY')
    }
  },

  // 保存默认账本
  saveDefaultLedger(ledger) {
    if (ledger) {
      wx.setStorageSync('default_ledger_id', ledger.id)
      wx.setStorageSync('default_ledger_name', ledger.name)
      wx.setStorageSync('default_ledger_type', ledger.type)
      wx.setStorageSync('default_ledger_owner', ledger.owner_id)
      wx.setStorageSync('default_ledger_currency', ledger.base_currency || 'CNY')
    } else {
      wx.removeStorageSync('default_ledger_id')
      wx.removeStorageSync('default_ledger_name')
      wx.removeStorageSync('default_ledger_type')
      wx.removeStorageSync('default_ledger_owner')
      wx.removeStorageSync('default_ledger_currency')
    }
  },

  // 获取默认账本
  getDefaultLedger() {
    const id = wx.getStorageSync('default_ledger_id')
    const name = wx.getStorageSync('default_ledger_name')
    const type = wx.getStorageSync('default_ledger_type')
    const owner_id = wx.getStorageSync('default_ledger_owner')
    const base_currency = wx.getStorageSync('default_ledger_currency')
    if (id && name) {
      return { id, name, type, owner_id, base_currency: base_currency || 'CNY' }
    }
    return null
  },

  // 检查用户是否有账本
  async checkUserHasLedger(userId) {
    const { data } = await supabase.from('ledgers').select('id').eq('owner_id', userId).limit(1)
    return data && data.length > 0
  },

  // 退出登录
  logout() {
    wx.clearStorageSync()
    this.globalData.user = null
    this.globalData.currentLedger = null
    wx.reLaunch({ url: '/pages/login/login' })
  },

  // 静默检查当前登录用户账号状态：
  //   - deleted（15天内）→ 自动恢复并刷新登录态
  //   - disabled → 当场踢下线
  // 节流 60s；返回 'deleted' | 'disabled' | null
  async checkAccountStatus() {
    const user = this.globalData.user
    if (!user || !user.id) return null
    const now = Date.now()
    if (this._lastStatusCheck && now - this._lastStatusCheck < 60000) return null
    this._lastStatusCheck = now
    try {
      const { data, error } = await supabase.from('users').select('status').eq('id', user.id).maybeSingle()
      if (error || !data) return null
      if (data.status === 'deleted') {
        // 15天内登录 → 自动恢复
        const res = await supabase.rpc('user_self_restore', {})
        if (res.statusCode >= 400) {
          // 恢复失败（可能已超15天）→ 踢下线
          this._kickOut('deleted')
          return 'deleted'
        }
        // 恢复成功，刷新登录态（用户数据保留）
        wx.showToast({ title: '账号已恢复', icon: 'success' })
        return null
      }
      if (data.status === 'disabled') {
        this._kickOut('disabled')
        return 'disabled'
      }
      return null
    } catch (e) {
      console.error('[checkAccountStatus]', e)
      return null
    }
  },

  // 当场踢下线：清登录态 + 弹窗 + 回登录页
  _kickOut(reason) {
    if (this._kickingOut) return
    this._kickingOut = true
    const msg = reason === 'deleted' ? '您的账号已被删除' : '您的账号已被禁用'
    wx.removeStorageSync('user_info')
    wx.removeStorageSync('session_date')
    wx.removeStorageSync('sb_access_token')
    wx.removeStorageSync('sb_refresh_token')
    this.globalData.user = null
    this.globalData.currentLedger = null
    supabase.auth.signOut()  // fire-and-forget，不阻塞弹窗
    wx.showModal({
      title: '账号状态异常',
      content: msg + '，已为您退出登录。',
      showCancel: false,
      success: () => {
        this._kickingOut = false
        wx.reLaunch({ url: '/pages/login/login' })
      }
    })
  },
})
