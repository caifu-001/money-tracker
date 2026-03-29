// pages/family/family.js
const app = getApp()
const { supabase } = require('../../utils/supabase')

Page({
  data: { loading: false, user: null },
  onLoad() {
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    this.setData({ user })
    this.loadData()
  },
  async loadData() {
    // TODO: 实现具体功能
  }
})
