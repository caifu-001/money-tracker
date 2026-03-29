// app.js - 全局入口
const { supabase } = require('./utils/supabase')

App({
  globalData: {
    user: null,
    currentLedger: null,
    supabase,
    appName: '游游记账',
    sessionDate: null,   // 每日登录检查
  },

  onLaunch() {
    this.checkDailySession()
  },

  // 每日强制登录检查
  checkDailySession() {
    const today = new Date().toISOString().split('T')[0]
    const lastDate = wx.getStorageSync('session_date')
    if (lastDate && lastDate !== today) {
      // 跨天，清除登录状态
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
  },

  // 退出登录
  logout() {
    wx.removeStorageSync('session_date')
    wx.removeStorageSync('user_info')
    this.globalData.user = null
    this.globalData.currentLedger = null
    wx.reLaunch({ url: '/pages/login/login' })
  },

  // 加载系统配置
  async loadSystemConfig() {
    try {
      const { data } = await supabase.from('system_config').select('key, value')
      if (data) {
        const map = {}
        data.forEach(row => { map[row.key] = row.value })
        if (map['app_name']) this.globalData.appName = map['app_name']
        if (map['default_expense_categories']) this.globalData.expenseCats = map['default_expense_categories']
        if (map['default_income_categories']) this.globalData.incomeCats = map['default_income_categories']
      }
    } catch(e) { console.error('loadSystemConfig', e) }
  }
})
