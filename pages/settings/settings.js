// pages/settings/settings.js
const app = getApp()
const { supabase } = require('../../utils/supabase')

Page({
  data: {
    user: null,
    appName: '游游记账',
    showChangeName: false,
    newName: '',
    saving: false,
    showResetPwd: false,
    oldPwd: '',
    newPwd: '',
    confirmPwd: '',
    pwdSaving: false,
  },

  onLoad() {
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    this.setData({
      user,
      appName: app.globalData.appName || '游游记账'
    })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) return
        app.logout()
      }
    })
  },

  // 修改昵称
  openChangeName() {
    this.setData({ showChangeName: true, newName: this.data.user.name || '' })
  },
  closeChangeName() { this.setData({ showChangeName: false }) },
  onNewNameInput(e) { this.setData({ newName: e.detail.value }) },

  async handleChangeName() {
    const { newName, saving } = this.data
    if (saving || !newName.trim()) return
    this.setData({ saving: true })
    try {
      const { error } = await supabase.from('users').update({ name: newName.trim() }).eq('id', this.data.user.id)
      if (error) throw new Error(error.message)
      const updatedUser = { ...this.data.user, name: newName.trim() }
      app.globalData.user = updatedUser
      wx.setStorageSync('user_info', updatedUser)
      this.setData({ user: updatedUser, showChangeName: false })
      wx.showToast({ title: '昵称修改成功', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || '修改失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 修改密码
  openResetPwd() { this.setData({ showResetPwd: true, oldPwd: '', newPwd: '', confirmPwd: '' }) },
  closeResetPwd() { this.setData({ showResetPwd: false }) },
  onOldPwdInput(e)   { this.setData({ oldPwd: e.detail.value }) },
  onNewPwdInput(e)   { this.setData({ newPwd: e.detail.value }) },
  onConfirmPwdInput(e) { this.setData({ confirmPwd: e.detail.value }) },

  async handleResetPwd() {
    const { oldPwd, newPwd, confirmPwd, pwdSaving } = this.data
    if (pwdSaving) return
    if (!oldPwd || !newPwd || !confirmPwd) return wx.showToast({ title: '请填写完整', icon: 'none' })
    if (newPwd.length < 6) return wx.showToast({ title: '新密码至少6位', icon: 'none' })
    if (newPwd !== confirmPwd) return wx.showToast({ title: '两次密码不一致', icon: 'none' })

    this.setData({ pwdSaving: true })
    try {
      // 通过更新用户元数据方式修改密码
      const token = wx.getStorageSync('sb_access_token')
      const res = await wx.request({
        url: 'https://abkscyijuvkfeazhlquz.supabase.co/auth/v11/users/' + this.data.user.id,
        method: 'PUT',
        header: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4',
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({ password: newPwd })
      })
      if (res.statusCode >= 400) throw new Error('修改密码失败')
      this.setData({ showResetPwd: false })
      wx.showToast({ title: '密码修改成功', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || '修改失败', icon: 'none' })
    } finally {
      this.setData({ pwdSaving: false })
    }
  },

  goAgreement() { wx.navigateTo({ url: '/pages/agreement/agreement' }) },
  goPrivacy()   { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  goAdmin()     { wx.switchTab({ url: '/pages/admin/admin' }) },
  goAbout()     { wx.showModal({ title: '游游记账 v5.1.1', content: '家庭协同记账工具\n支持多账本、预算管理、数据分析', showCancel: false }) },

  // 删除我的账号
  handleDeleteAccount() {
    wx.showModal({
      title: '危险操作',
      content: '确定永久删除账号？所有数据将被清空且无法恢复！',
      success: (res) => {
        if (!res.confirm) return
        wx.showModal({
          title: '再次确认',
          content: '删除后无法恢复，请确认是否继续',
          success: async (r) => {
            if (!r.confirm) return
            // 删除用户所有数据
            const { user, currentLedger } = app.globalData
            await supabase.from('transactions').delete().eq('user_id', user.id)
            await supabase.from('categories').delete().eq('ledger_id', currentLedger.id)
            await supabase.from('budgets').delete().eq('ledger_id', currentLedger.id)
            await supabase.from('ledger_members').delete().eq('user_id', user.id)
            await supabase.from('ledgers').delete().eq('owner_id', user.id)
            await supabase.from('users').delete().eq('id', user.id)
            await supabase.auth.signOut()
            app.logout()
          }
        })
      }
    })
  },
})
