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
    this.checkDailySession()
  },

  // 每日强制登录检查
  checkDailySession() {
    const today = new Date().toISOString().split('T')[0]
    const lastDate = wx.getStorageSync('session_date')
    if (lastDate && lastDate !== today) {
      // 跨天，清除登录状态（但保留默认账本设置）
      wx.removeStorageSync('session_date')
      wx.removeStorageSync('user_info')
      this.globalData.user = null
      this.globalData.currentLedger = null
    }
  },

  // 登录成功后调用
  onLoginSuccess(user, ledger) {
    const today = new Date().toISOString().split('T')[0]
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
