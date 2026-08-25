// app.js - 全局入口
const { supabase } = require('./utils/supabase')

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
    }
  },

  // 保存默认账本
  saveDefaultLedger(ledger) {
    if (ledger) {
      wx.setStorageSync('default_ledger_id', ledger.id)
      wx.setStorageSync('default_ledger_name', ledger.name)
      wx.setStorageSync('default_ledger_type', ledger.type)
      wx.setStorageSync('default_ledger_owner', ledger.owner_id)
    } else {
      wx.removeStorageSync('default_ledger_id')
      wx.removeStorageSync('default_ledger_name')
      wx.removeStorageSync('default_ledger_type')
      wx.removeStorageSync('default_ledger_owner')
    }
  },

  // 获取默认账本
  getDefaultLedger() {
    const id = wx.getStorageSync('default_ledger_id')
    const name = wx.getStorageSync('default_ledger_name')
    const type = wx.getStorageSync('default_ledger_type')
    const owner_id = wx.getStorageSync('default_ledger_owner')
    if (id && name) {
      return { id, name, type, owner_id }
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
})
