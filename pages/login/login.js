// pages/login/login.js
const app = getApp()
const { supabase } = require('../../utils/supabase')

Page({
  data: {
    appName: '钱迹',
    mode: 'login',   // login | signup | forgot
    loginId: '',
    username: '',
    email: '',
    password: '',
    showPwd: false,
    loading: false,
  },

  onLoad() {
    this.setData({ appName: app.globalData.appName || '钱迹' })
    // 已登录且今天已登录过，直接跳首页
    const today = new Date().toISOString().split('T')[0]
    const lastDate = wx.getStorageSync('session_date')
    const userInfo = wx.getStorageSync('user_info')
    if (lastDate === today && userInfo) {
      app.globalData.user = userInfo
      wx.switchTab({ url: '/pages/home/home' })
    }
  },

  switchMode(e) { this.setData({ mode: e.currentTarget.dataset.mode, password: '' }) },
  onLoginIdInput(e)  { this.setData({ loginId: e.detail.value }) },
  onUsernameInput(e) { this.setData({ username: e.detail.value }) },
  onEmailInput(e)    { this.setData({ email: e.detail.value }) },
  onPasswordInput(e) { this.setData({ password: e.detail.value }) },
  togglePwd()        { this.setData({ showPwd: !this.data.showPwd }) },

  async handleLogin() {
    const { loginId, password } = this.data
    if (!loginId || !password) return wx.showToast({ title: '请填写账号和密码', icon: 'none' })
    this.setData({ loading: true })
    try {
      // 支持用户名登录：用户名转邮箱格式
      let email = loginId
      if (!loginId.includes('@')) email = `${loginId.toLowerCase()}@qianji.app`

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)

      // 查 users 表检查状态
      const { data: userData } = await supabase.from('users').select('*').eq('id', data.user.id).single()
      if (!userData) {
        // 自动补全 users 表
        await supabase.from('users').insert([{
          id: data.user.id, email: data.user.email,
          name: data.user.user_metadata?.name || loginId,
          role: 'user', status: 'active'
        }])
      } else if (userData.status === 'pending') {
        await supabase.auth.signOut()
        throw new Error('账号正在等待管理员审核，请耐心等待')
      }

      // 加载账本（如果没有就自动创建一个）
      let ledger = null
      const { data: ledgers } = await supabase.from('ledgers').select('id,name').eq('owner_id', data.user.id).order('created_at')
      if (ledgers && ledgers.length > 0) {
        ledger = ledgers[0]
      } else {
        // 自动创建第一个账本
        try {
          const { data: newLedger } = await supabase.from('ledgers').insert([{
            name: '我的账本', owner_id: data.user.id
          }]).select('id,name').single()
          ledger = newLedger
        } catch(e2) {
          console.error('create ledger failed', e2)
        }
      }

      // 如果仍然没有账本，创建一个空壳账本对象
      if (!ledger) {
        ledger = { id: null, name: '我的账本' }
      }

      const user = { id: data.user.id, email: data.user.email, name: userData?.name || loginId, role: userData?.role || 'user' }
      app.onLoginSuccess(user, ledger)
      await app.loadSystemConfig()

      wx.switchTab({ url: '/pages/home/home' })
    } catch(e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none', duration: 3000 })
    } finally {
      this.setData({ loading: false })
    }
  },

  async handleSignup() {
    const { username, password } = this.data
    if (!username || !password) return wx.showToast({ title: '请填写用户名和密码', icon: 'none' })
    if (password.length < 6) return wx.showToast({ title: '密码至少6位', icon: 'none' })
    this.setData({ loading: true })
    try {
      const email = `${username.toLowerCase()}@qianji.app`
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: username } } })
      if (error) throw new Error(error.message)

      // 写入 users 表（pending 状态）
      const { data: existing } = await supabase.from('users').select('id').eq('id', data.user.id).single()
      if (!existing) {
        await supabase.from('users').insert([{
          id: data.user.id, email, name: username, role: 'user', status: 'pending'
        }])
      }
      await supabase.auth.signOut()
      wx.showModal({ title: '注册成功', content: '您的账号正在等待管理员审核，审核通过后即可登录', showCancel: false })
      this.setData({ mode: 'login' })
    } catch(e) {
      wx.showToast({ title: e.message || '注册失败', icon: 'none', duration: 3000 })
    } finally {
      this.setData({ loading: false })
    }
  },

  async handleForgot() {
    const { email } = this.data
    if (!email) return wx.showToast({ title: '请输入邮箱', icon: 'none' })
    this.setData({ loading: true })
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw new Error(error.message)
      wx.showModal({ title: '已发送', content: '重置密码邮件已发送，请查收邮箱', showCancel: false })
      this.setData({ mode: 'login' })
    } catch(e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
