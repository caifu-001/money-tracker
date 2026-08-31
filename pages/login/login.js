// pages/login/login.js
const app = getApp()
const { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } = require('../../utils/supabase')

// 微信登录配置（必填）
const WECHAT_APPID = 'wx30ef5296dd2cd8f7'  // 替换为你的小程序 AppID

Page({
  data: {
    appName: '游游记账',
    mode: 'login',
    loginId: '',
    username: '',
    email: '',
    password: '',
    verifyCode: '',
    countdown: 0,
    emailMask: '',
    loading: false,
    wechatOpenid: '',
    showWechatRegister: false,
    showPwd: false,
    agreedPrivacy: false,  // 是否已同意隐私政策
  },

  onLoad() {
    this.setData({ appName: '游游记账' })
    // 老用户：app.js 已静默恢复 → 秒跳首页，零网络请求
    if (app.globalData.user) {
      wx.switchTab({ url: '/pages/home/home' })
      return
    }
    // 兜底：app.js 未恢复但 Storage 有有效 session（7 天有效）
    const userInfo = wx.getStorageSync('user_info')
    const sessionDate = wx.getStorageSync('session_date')
    const SESSION_TTL_MS = 7 * 86400000
    if (userInfo && sessionDate && (Date.now() - new Date(sessionDate + 'T00:00:00').getTime() <= SESSION_TTL_MS)) {
      app.globalData.user = userInfo
      const cachedLedger = app.getDefaultLedger()
      if (cachedLedger) app.globalData.currentLedger = cachedLedger
      wx.switchTab({ url: '/pages/home/home' })
      return
    }
    // 新用户：尝试微信静默登录
    this.tryWechatLogin()
  },

  // 重新从数据库查最新 role
  async refreshUserRole(cachedUser, cb) {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', cachedUser.id).single()
      if (data) {
        const freshUser = { ...cachedUser, role: data.role, name: data.name, email: data.email }
        wx.setStorageSync('user_info', freshUser)  // 更新缓存
        cb(freshUser)
        return
      }
      // 用户在数据库中不存在（已被管理员删除），清除缓存，回到登录流程
      console.log('[refreshUserRole] 用户已不存在，清除缓存')
      wx.removeStorageSync('user_info')
      wx.removeStorageSync('session_date')
      wx.removeStorageSync('default_ledger_id')
      wx.removeStorageSync('default_ledger_name')
      wx.removeStorageSync('default_ledger_type')
      wx.removeStorageSync('default_ledger_owner')
      await supabase.auth.signOut()
      // 触发微信登录流程（会检测到新用户并显示一键注册）
      this.tryWechatLogin()
      return
    } catch(e) {
      console.error('[refreshUserRole] 失败:', e)
    }
    cb(cachedUser)  // 查询失败则用缓存（网络问题等）
  },

    // 更新用户最后登录时间（直接用 REST API）
    async _updateLastLogin(userId) {
    try {
      await new Promise((resolve) => {
        wx.request({
          url: SUPABASE_URL + '/rest/v1/rpc/update_last_login',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
          },
          data: { p_user_id: userId },
          success: () => resolve(),
          fail: () => resolve()
        })
      })
    } catch(e) {
      console.error('[_updateLastLogin]', e)
    }
  },

  // 微信静默登录
  async tryWechatLogin() {
    try {
      const { code } = await new Promise((res, rej) => {
        wx.login({ success: r => res(r), fail: rej })
      })
      if (!code) return

      // 调用 Edge Function 用 code 换 openid
      const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'
      const resp = await new Promise((resolve) => {
        wx.request({
          url: SUPABASE_URL + '/functions/v1/wechat-auth',
          method: 'POST',
          header: { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': 'Bearer ' + ANON },
          data: { code, appid: WECHAT_APPID },
          success: r => resolve({ ok: true, data: r }),
          fail: e => resolve({ ok: false, err: e })
        })
      })
      if (!resp.ok || resp.data.statusCode !== 200) {
        console.log('[WeChat登录] 静默登录失败，等待用户手动登录')
        return
      }
      const result = typeof resp.data.data === 'string' ? JSON.parse(resp.data.data) : resp.data.data
      if (!result.openid) {
        console.log('[WeChat登录] 未获取到 openid')
        return
      }

      // 用 openid 查用户
      const { data: userList } = await supabase.from('users').select('*').eq('wechat_openid', result.openid).limit(1)
      if (userList && userList.length > 0) {
        const userData = userList[0]
        if (userData.status === 'pending') {
          wx.showToast({ title: '账号审核中，请稍后再试', icon: 'none' })
          return
        }
        if (userData.status === 'disabled') {
          wx.showToast({ title: '账号已被禁用', icon: 'none' })
          return
        }
        if (userData.status === 'deleted') {
          wx.showToast({ title: '账号已被删除', icon: 'none' })
          return
        }
        // 自动登录成功
        const user = { id: userData.id, email: userData.email, name: userData.name, role: userData.role }
        console.log('[tryWechatLogin] 微信登录成功，准备更新 last_login，用户ID:', user.id)
        await this._updateLastLogin(user.id)
        console.log('[tryWechatLogin] last_login 更新完成')
        let ledger = null
        // 查询 own + member 账本
        const [ownRes, memberRes] = await Promise.all([
          supabase.from('ledgers').select('*').eq('owner_id', userData.id).order('created_at'),
          supabase.from('ledger_members').select('ledger_id').eq('user_id', userData.id)
        ])
        const ownLedgers = ownRes.data || []
        const memberLedgerIds = (memberRes.data || []).map(m => m.ledger_id)
        let allLedgers = [...ownLedgers]
        if (memberLedgerIds.length > 0) {
          const { data: sharedLedgers } = await supabase.from('ledgers').select('*').in('id', memberLedgerIds)
          if (sharedLedgers) {
            const ownIds = new Set(ownLedgers.map(l => l.id))
            allLedgers = [...allLedgers, ...sharedLedgers.filter(l => !ownIds.has(l.id))]
          }
        }
        if (allLedgers.length > 0) {
          const defaultLedger = app.getDefaultLedger()
          const saved = defaultLedger ? allLedgers.find(l => l.id === defaultLedger.id) : null
          ledger = saved || allLedgers[0]
        }
        app.onLoginSuccess(user, ledger)
        wx.switchTab({ url: '/pages/home/home' })
      } else {
        // openid 未关联任何用户，清除可能残留的旧登录状态
        await supabase.auth.signOut()
        wx.removeStorageSync('user_info')
        wx.removeStorageSync('session_date')
        // 新用户，显示一键注册按钮
        this.setData({ wechatOpenid: result.openid, showWechatRegister: true })
      }
    } catch(e) {
      console.error('[WeChat登录] 错误:', e)
    }
  },

  // 微信一键注册
  async handleWechatRegister() {
    const { wechatOpenid, agreedPrivacy } = this.data
    if (!wechatOpenid) return
    if (!agreedPrivacy) return wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none', duration: 2000 })
    this.setData({ loading: true })
    try {
      // 生成随机用户名和邮箱
      const randomId = Math.random().toString(36).slice(2, 10)
      const name = '微信用户' + randomId
      const email = `wx_${randomId}@wechat.local`
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

      // 创建 Supabase Auth 用户
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password,
        options: { data: { name } }
      })
      if (authError) throw authError

      // 创建 users 表记录，绑定 openid，检查自动通过设置
      const settingRes = await supabase.from('app_settings').select('value').eq('key', 'auto_approve').single()
      console.log('[handleWechatRegister] app_settings查询结果:', JSON.stringify(settingRes))
      const autoApprove = settingRes.data && settingRes.data.value === 'true'
      console.log('[handleWechatRegister] autoApprove=', autoApprove)
      const userStatus = autoApprove ? 'active' : 'pending'
      const userRecord = {
        id: authData.user.id,
        email,
        name,
        role: 'user',
        status: userStatus,
        wechat_openid: wechatOpenid
      }
      await supabase.from('users').insert([userRecord])

      this.setData({ loading: false, showWechatRegister: false })
      if (autoApprove) {
        // 自动通过，直接登录
        const user = { id: authData.user.id, email, name, role: 'user' }
        this._updateLastLogin(user.id)
        app.onLoginSuccess(user, null)
        wx.switchTab({ url: '/pages/home/home' })
      } else {
        wx.showModal({
          title: '✅ 注册成功，请等待审核',
          content: '您的账号已创建，正在等待管理员审核。\n审核通过后，打开小程序即可自动登录使用。',
          showCancel: false,
          confirmText: '我知道了'
        })
      }
    } catch(e) {
      wx.showToast({ title: e.message || '注册失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 恢复默认账本（带验证）
  async restoreDefaultLedger(user) {
    const defaultId = wx.getStorageSync('default_ledger_id')
    if (!defaultId) return
    
    try {
      // 查询默认账本是否存在（不加 owner_id 限制，因为可能是家庭账本成员）
      const { data } = await supabase.from('ledgers').select('id, name, type, owner_id').eq('id', defaultId)
      
      if (data && data.length > 0) {
        app.globalData.currentLedger = data[0]
        console.log('[restoreDefaultLedger] 恢复默认账本:', data[0].name)
      } else {
        // 账本不存在或不属于用户，清除默认设置
        wx.removeStorageSync('default_ledger_id')
        wx.removeStorageSync('default_ledger_name')
        wx.removeStorageSync('default_ledger_type')
        wx.removeStorageSync('default_ledger_owner')
      }
    } catch(e) {
      console.error('[restoreDefaultLedger] 失败:', e)
    }
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode, password: '' })
  },

  onLoginIdInput(e)  { this.setData({ loginId: e.detail.value }) },
  onUsernameInput(e) { this.setData({ username: e.detail.value }) },
  onEmailInput(e)    { this.setData({ email: e.detail.value }) },
  onPasswordInput(e) { this.setData({ password: e.detail.value }) },
  togglePwd() { this.setData({ showPwd: !this.data.showPwd }) },
  onVerifyCodeInput(e) { this.setData({ verifyCode: e.detail.value.replace(/\D/g, '').slice(0, 6) }) },

  // 发送验证码
  async handleSendCode() {
    const { username, email, password, agreedPrivacy } = this.data
    if (!agreedPrivacy) return wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none', duration: 2000 })
    if (!username || username.length < 2) return wx.showToast({ title: '用户名至少2个字符', icon: 'none' })
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return wx.showToast({ title: '请输入正确的邮箱', icon: 'none' })
    if (!password || password.length < 6) return wx.showToast({ title: '密码至少6位', icon: 'none' })

    this.setData({ loading: true })
    try {
      const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'
      const res = await new Promise((resolve) => {
        wx.request({
          url: SUPABASE_URL + '/functions/v1/send-otp',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'apikey': ANON,
            'Authorization': 'Bearer ' + ANON
          },
          data: { email, username, password },
          success: (r) => resolve({ ok: true, data: r }),
          fail: (e) => resolve({ ok: false, err: e })
        })
      })
      if (!res.ok) throw new Error('网络请求失败')
      var raw = res.data.data
      var data = raw
      if (typeof raw === 'string') {
        try { data = JSON.parse(raw) } catch(e) { data = { error: raw } }
      }
      var code = res.data.statusCode
      if (!code || code >= 400 || !data || data.error) {
        throw new Error(data && data.error || ('发送失败 HTTP ' + code))
      }
      // 临时存储注册信息
      wx.setStorageSync('reg_pending', { email, username, password })
      // 邮箱脱敏
      const at = email.indexOf('@')
      const mask = email.slice(0, 2) + '***' + email.slice(at)
      this.setData({ mode: 'verify', emailMask: mask, email, countdown: 60, verifyCode: '' })
      // 弹出验证码提示（开发模式直接显示）
      if (data.code) {
        wx.showModal({ title: '验证码（开发模式）', content: '您的验证码是：' + data.code, showCancel: false })
      }
      // 倒计时
      this._startCountdown()
    } catch(e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none', duration: 3000 })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 重新发送验证码
  async handleResendCode() {
    if (this.data.countdown > 0) return
    const pending = wx.getStorageSync('reg_pending')
    if (pending) {
      this.setData({ email: pending.email, username: pending.username, password: pending.password })
    }
    await this.handleSendCode()
  },

  // 验证注册
  async handleVerify() {
    const { email, verifyCode } = this.data
    if (!verifyCode || verifyCode.length < 6) return wx.showToast({ title: '请输入6位验证码', icon: 'none' })
    this.setData({ loading: true })
    try {
      const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'
      const res = await new Promise((resolve) => {
        wx.request({
          url: SUPABASE_URL + '/functions/v1/verify-otp',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'apikey': ANON,
            'Authorization': 'Bearer ' + ANON
          },
          data: { email, code: verifyCode },
          success: (r) => resolve({ ok: true, data: r }),
          fail: (e) => resolve({ ok: false, err: e })
        })
      })
      if (!res.ok) throw new Error('网络请求失败')
      var raw = res.data.data
      var data = raw
      if (typeof raw === 'string') {
        try { data = JSON.parse(raw) } catch(e) { data = { error: raw } }
      }
      var httpCode = res.data.statusCode
      if (!httpCode || httpCode >= 400 || !data || data.error) {
        throw new Error(data && data.error || ('验证失败 HTTP ' + httpCode))
      }
      wx.removeStorageSync('reg_pending')
      // 检查自动通过设置
      const settingRes = await supabase.from('app_settings').select('value').eq('key', 'auto_approve').single()
      const autoApprove = settingRes.data && settingRes.data.value === 'true'
      console.log('[handleVerify] app_settings:', JSON.stringify(settingRes), 'autoApprove=', autoApprove)
      wx.showModal({
        title: '注册成功',
        content: autoApprove ? '账号已创建并自动激活，请登录使用' : '账号已创建，等待管理员审核通过后即可登录',
        showCancel: false,
        success: () => this.setData({ mode: 'login', email: '', username: '', password: '', verifyCode: '' })
      })
    } catch(e) {
      wx.showToast({ title: e.message || '验证失败', icon: 'none', duration: 3000 })
    } finally {
      this.setData({ loading: false })
    }
  },

  _startCountdown() {
    if (this._timer) clearInterval(this._timer)
    this._timer = setInterval(() => {
      const n = this.data.countdown - 1
      this.setData({ countdown: n })
      if (n <= 0) clearInterval(this._timer)
    }, 1000)
  },

  // 登录
  async handleLogin() {
    const { loginId, password } = this.data
    if (!loginId || !password) return wx.showToast({ title: '请填写账号和密码', icon: 'none' })
    this.setData({ loading: true })
    try {
      // 登录：支持邮箱或用户名
      let email = loginId
      if (!loginId.includes('@')) {
        // 用户名方式：先查用户表获取邮箱
        const { data: userList } = await supabase.from('users').select('email,name').eq('name', loginId.toLowerCase()).limit(1)
        if (userList && userList.length > 0) {
          email = userList[0].email
        } else {
          // 查不到才用默认后缀（兼容旧账号）
          email = loginId.toLowerCase() + '@qianji.app'
        }
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)

      const { data: userData } = await supabase.from('users').select('*').eq('id', data.user.id).single()
      if (!userData) {
        // 新用户，检查自动通过设置
        const settingRes = await supabase.from('app_settings').select('value').eq('key', 'auto_approve').single()
        const autoApprove = settingRes.data && settingRes.data.value === 'true'
        console.log('[handleLogin] 新用户 app_settings:', JSON.stringify(settingRes), 'autoApprove=', autoApprove)
        const initStatus = autoApprove ? 'active' : 'pending'
        await supabase.from('users').insert([{ id: data.user.id, email: data.user.email, name: (data.user.user_metadata && data.user.user_metadata.name) || loginId, role: 'user', status: initStatus }])
        if (initStatus === 'pending') {
          await supabase.auth.signOut()
          throw new Error('账号正在等待管理员审核，请耐心等待')
        }
        // 自动通过，继续登录
      } else if (userData.status === 'pending') {
        await supabase.auth.signOut()
        throw new Error('账号正在等待管理员审核，请耐心等待')
      } else if (userData.status === 'disabled') {
        await supabase.auth.signOut()
        throw new Error('账号已被禁用，请联系管理员')
      } else if (userData.status === 'deleted') {
        await supabase.auth.signOut()
        throw new Error('账号已被删除，请联系管理员')
      }

      const user = { id: data.user.id, email: data.user.email, name: (userData && userData.name) || loginId, role: (userData && userData.role) || 'user' }
      console.log('[handleLogin] 登录成功，准备更新 last_login，用户ID:', user.id)
      await this._updateLastLogin(user.id)
      console.log('[handleLogin] last_login 更新完成')
      // 同时查 own + member 账本
      const [ownRes, memberRes] = await Promise.all([
        supabase.from('ledgers').select('*').eq('owner_id', data.user.id).order('created_at'),
        supabase.from('ledger_members').select('ledger_id').eq('user_id', data.user.id)
      ])
      const ownLedgers = ownRes.data || []
      const memberIds = (memberRes.data || []).map(m => m.ledger_id)
      let memberLedgers = []
      if (memberIds.length > 0) {
        const { data: ml } = await supabase.from('ledgers').select('*').in('id', memberIds)
        memberLedgers = ml || []
      }
      let allLedgers = [...ownLedgers]
      for (const ml of memberLedgers) { if (!allLedgers.find(l => l.id === ml.id)) allLedgers.push(ml) }
      let ledger = null
      if (allLedgers.length > 0) {
        const defaultLedger = app.getDefaultLedger()
        const saved = defaultLedger ? allLedgers.find(l => l.id === defaultLedger.id) : null
        ledger = saved || allLedgers[0]
      }
      app.onLoginSuccess(user, ledger)
      wx.switchTab({ url: '/pages/home/home' })
    } catch(e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none', duration: 3000 })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 忘记密码
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
  },

  goPrivacy()   { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  goAgreement() { wx.navigateTo({ url: '/pages/agreement/agreement' }) },

  // 审核要求：用户可拒绝登录/注册，返回首页浏览
  dismissLogin() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  // 切换协议同意状态
  toggleAgree() {
    this.setData({ agreedPrivacy: !this.data.agreedPrivacy })
  },
})
