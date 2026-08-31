// pages/home/home.js
const app = getApp()
const { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } = require('../../utils/supabase')
const { initDefaultCategories } = require('../../utils/categories')

const PAYMENT_METHODS = [
  { id: 'cash',    name: '现金',    icon: '💵' },
  { id: 'wechat',  name: '微信',    icon: '💚' },
  { id: 'alipay',  name: '支付宝',  icon: '💙' },
  { id: 'bankcard',name: '银行卡',  icon: '💳' },
]

// 北京时间工具函数
const bjNow = () => {
  const utc = Date.now()
  return new Date(utc + 8 * 3600000)
}
const bjDateStr = (d) => {
  return d.toISOString().split('T')[0]
}
const bjToday = () => bjDateStr(bjNow())
const bjDaysAgo = (n) => {
  const d = bjNow()
  d.setDate(d.getDate() - n)
  return bjDateStr(d)
}

const LOGGED_IN = (() => {
  const userInfo = wx.getStorageSync('user_info')
  const sessionDate = wx.getStorageSync('session_date')
  const SESSION_TTL_DAYS = 7
  if (userInfo && sessionDate) {
    const sessionMs = new Date(sessionDate + 'T00:00:00').getTime()
    const elapsed = Date.now() - sessionMs
    if (elapsed <= SESSION_TTL_DAYS * 86400000) {
      return { user: userInfo || null, isGuest: false, guestBrowsing: false }
    }
  }
  return { user: null, isGuest: true, guestBrowsing: false }
})()

Page({
  data: {
    user: LOGGED_IN.user,
    isGuest: LOGGED_IN.isGuest,
    guestBrowsing: LOGGED_IN.guestBrowsing,
    // 微信一键注册
    wechatOpenid: '',
    showWechatRegister: false,
    agreedPrivacy: false,
    showPrivacyConsent: false,  // 隐私授权弹窗
    loading: !!LOGGED_IN.user,  // 老用户立即显示 loading
    dailyChecked: wx.getStorageSync('last_ping_date') === bjToday(),  // 签到状态
    currentLedger: null,
    transactions: [],
    totalIncome: '0.00', totalExpense: '0.00', balance: '0.00',
    currentYear: 0,
    currentMonth: 0,
    monthLabel: '',
    monthPickerVisible: false,
    monthPickerRange: [],
    monthPickerValue: [0, 0],
    paymentMethods: PAYMENT_METHODS,
    // 记账弹窗
    showQuickAdd: false,
    qaType: 'expense', qaAmount: '', qaCategory: '', qaNote: '', qaDate: '', qaLoading: false, qaReimbursable: false,
    qaExpandedKey: null, subCats: [], qaSubExpandedKey: null, subSubCats: [],
    currentCats: [],
    qaPaymentMethod: 'cash',
    // 编辑弹窗
    showEdit: false, editTx: null,
    editType: 'expense', editAmount: '', editCategory: '', editNote: '', editDate: '', editLoading: false, editReimbursable: false,
    editCats: [],
    editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [],
    editPaymentMethod: 'cash',
    // 类别树
    catTree: [],
    catFreq: {},  // 分类使用频次 {name: count}
    // 报销筛选
    showReimbursableOnly: false,
    pendingReimburseTotal: '0.00',
    dailyGroups: [], // 按日分组 [{date, dateLabel, income, expense, items:[]}]
    // 创建账本
    showCreateLedger: false,
    newLedgerName: '',
    creatingLedger: false,
  },

  onLoad() {
    // 隐私授权检查（所有用户，跟登录状态无关）
    if (!wx.getStorageSync('privacy_agreed')) {
      this.setData({ showPrivacyConsent: true })
    }

    const user = app.globalData.user
    const ledger = app.globalData.currentLedger
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    
    // 记录当前账本ID，避免 onShow 重复加载
    this._lastShownLedgerId = ledger ? ledger.id : null
    
    // 尝试从缓存恢复数据，立即可见
    let cached = null
    if (user && ledger) {
      try {
        cached = wx.getStorageSync('home_cache')
        if (cached && cached.ledgerId === ledger.id && cached.year === y && cached.month === m) {
          this.setData({
            user, isGuest: false, guestBrowsing: false,
            currentLedger: { ...ledger },
            currentYear: cached.year, currentMonth: cached.month, monthLabel: cached.monthLabel,
            totalIncome: cached.totalIncome, totalExpense: cached.totalExpense, balance: cached.balance,
            dailyGroups: cached.dailyGroups, transactions: cached.transactions,
            catTree: cached.catTree, catFreq: cached.catFreq,
            showCreateLedger: false, loading: false  // 缓存命中 → 直接展示
          })
        }
      } catch(e) { cached = null }
    }
    
    this.setData({
      user: user || null,
      isGuest: !user,
      guestBrowsing: !user,
      currentLedger: ledger ? { ...ledger } : { id: null, name: '暂无账本' },
      currentYear: y,
      currentMonth: m,
      monthLabel: `${y}年${m}月`,
      showCreateLedger: !ledger && user,
      loading: !!user && !cached  // 无缓存才显示 loading
    })
    
    if (user && ledger) {
      // 后台静默刷新（不阻塞界面）
      const t0 = Date.now()
      Promise.all([
        this.loadCatFreq().then(() => this.loadCatTree()),
        this.loadData().then(() => {
          const d = this.data
          wx.setStorageSync('home_cache', {
            ledgerId: ledger.id, year: d.currentYear, month: d.currentMonth, monthLabel: d.monthLabel,
            totalIncome: d.totalIncome, totalExpense: d.totalExpense, balance: d.balance,
            dailyGroups: d.dailyGroups, transactions: d.transactions,
            catTree: d.catTree, catFreq: d.catFreq
          })
        })
      ]).then(() => {
        console.log('[home] 首页加载耗时', Date.now() - t0, 'ms')
      })
    } else {
      this.setData({ loading: false })
    }
  },

  // 签到：用户主动点击 + 自动静默打卡
  handleCheckin() {
    const today = bjToday()
    if (this.data.dailyChecked) {
      wx.showToast({ title: '今天已签到', icon: 'none' })
      return
    }
    wx.setStorageSync('last_ping_date', today)
    this.setData({ dailyChecked: true })
    wx.request({
      url: SUPABASE_URL + '/rest/v1/rpc/update_last_login',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + (wx.getStorageSync('sb_access_token') || SUPABASE_ANON_KEY)
      },
      data: { p_user_id: app.globalData.user?.id },
      success: () => wx.showToast({ title: '签到成功 ✅', icon: 'success' }),
      fail: () => wx.showToast({ title: '网络异常，稍后重试', icon: 'none' })
    })
  },

  // 静默自动打卡，onShow 调用，不弹 toast
  _autoCheckin() {
    const today = bjToday()
    if (wx.getStorageSync('last_ping_date') === today) return
    wx.setStorageSync('last_ping_date', today)
    this.setData({ dailyChecked: true })
    wx.request({
      url: SUPABASE_URL + '/rest/v1/rpc/update_last_login',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + (wx.getStorageSync('sb_access_token') || SUPABASE_ANON_KEY)
      },
      data: { p_user_id: app.globalData.user?.id }
    })
  },

  // 上次 onShow 时浏览的账本 ID，用于避免同账本重复刷新
  _lastShownLedgerId: null,

  onShow() {
    const user = app.globalData.user
    const ledger = app.globalData.currentLedger
    
    this.setData({
      user: user || null,
      isGuest: !user
    })

    // 处理从分析页跳转来的待编辑账单
    if (app.globalData.pendingEditTxId) {
      const txId = app.globalData.pendingEditTxId
      const txDate = app.globalData.pendingEditTxDate || ''
      app.globalData.pendingEditTxId = null
      app.globalData.pendingEditTxDate = null
      // 等数据加载完成后打开编辑弹窗
      this._pendingOpenEdit = txId
      // 切到账单所在月份，避免目标账单不在当前月份
      this._pendingEditNeedReload = false
      if (txDate && /^\d{4}-\d{2}/.test(txDate)) {
        const y = parseInt(txDate.slice(0, 4), 10)
        const m = parseInt(txDate.slice(5, 7), 10)
        if (y && m && (y !== this.data.currentYear || m !== this.data.currentMonth)) {
          this.setData({
            currentYear: y, currentMonth: m,
            monthLabel: `${y}年${m}月`
          })
          this._pendingEditNeedReload = true
        }
      }
    }
    
    if (!user) {
      this.setData({ loading: false, currentLedger: { id: null, name: '暂无账本' }, showCreateLedger: false })
      return
    }

    // 每日自动打卡（静默，不弹 toast）
    this._autoCheckin()
    
    if (!ledger) {
      this.setData({ currentLedger: { id: null, name: '暂无账本' }, showCreateLedger: true })
      return
    }
    
    const prevId = this.data.currentLedger ? this.data.currentLedger.id : null
    const needReload = this._pendingEditNeedReload
    this._pendingEditNeedReload = false
    if (ledger.id !== prevId) {
      this.setData({ currentLedger: { ...ledger }, showCreateLedger: false })
      Promise.all([
        this.loadCatFreq().then(() => this.loadCatTree()),
        this.loadData().then(() => this._openPendingEdit())
      ])
    } else if (this._lastShownLedgerId !== ledger.id) {
      // 同账本但首次进入（从登录页跳来）
      this._lastShownLedgerId = ledger.id
      Promise.all([
        this.loadCatFreq().then(() => this.loadCatTree()),
        this.loadData().then(() => this._openPendingEdit())
      ])
    } else {
      // 同账本 tab 切换回来，若有待编辑账单则处理
      if (needReload) {
        // 从分析页跳转且月份已切换，需重新加载该月份数据
        Promise.all([
          this.loadCatFreq().then(() => this.loadCatTree()),
          this.loadData().then(() => this._openPendingEdit())
        ])
      } else {
        this._openPendingEdit()
      }
    }
    // 否则是 tab 切换回来，不需要重复加载
  },

  // 打开从分析页跳转来的待编辑账单
  _openPendingEdit() {
    const txId = this._pendingOpenEdit
    if (!txId) return
    this._pendingOpenEdit = null
    const tx = (this.data.transactions || []).find(t => t.id === txId)
    if (!tx) {
      // 目标账单不在当前月份列表（可能是其他月份/其他账本）
      wx.showToast({ title: '账单不在当前月份，请调整月份后重试', icon: 'none' })
      return
    }
    this.openEditByTx(tx)
  },

  // 直接打开编辑弹窗（供 _openPendingEdit 复用）
  openEditByTx(tx) {
    const editCats = this.data.catTree.filter(c => c.type === tx.type)
    let matchedCategory = tx.category || ''
    if (!editCats.find(c => c.name === tx.category)) {
      let clean = tx.category || ''
      clean = clean.replace(/^[^\s]+\s*/, '').replace(/\s*›\s*[^\s]+\s*/g, ' › ').trim()
      const found = editCats.find(c => c.name === clean || (c.children && c.children.find(sc => sc.name === clean)))
      if (found) matchedCategory = clean
    }
    this.setData({
      showEdit: true, editTx: tx,
      editType: tx.type, editAmount: String(tx.amount),
      editCategory: matchedCategory, editNote: tx.note || '', editDate: tx.date,
      editCats, editPaymentMethod: tx.payment_method || 'cash',
      editReimbursable: !!tx.is_reimbursable,
      editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [],
    })
  },

  // 游客点击登录（邮箱方式）
  goLogin() {
    if (!this.data.agreedPrivacy) return wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' })
    wx.navigateTo({ url: '/pages/login/login' })
  },

  // 游客选择暂不注册，进入浏览模式
  dismissRegister() {
    if (!this.data.agreedPrivacy) return wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' })
    this.setData({ guestBrowsing: true, showWechatRegister: false })
  },

  // 跳转账本管理
  goLedgers() {
    wx.navigateTo({ url: '/pages/ledgers/ledgers' })
  },

  // 微信静默登录（首页游客模式专用）
  async tryWechatLogin() {
    const { SUPABASE_URL } = require('../../utils/supabase')
    const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'
    try {
      const { code } = await new Promise((res, rej) => {
        wx.login({ success: r => res(r), fail: rej })
      })
      if (!code) return
      const resp = await new Promise((resolve) => {
        wx.request({
          url: SUPABASE_URL + '/functions/v1/wechat-auth',
          method: 'POST',
          header: { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': 'Bearer ' + ANON },
          data: { code, appid: 'wx30ef5296dd2cd8f7' },
          success: r => resolve({ ok: true, data: r }),
          fail: e => resolve({ ok: false, err: e })
        })
      })
      if (!resp.ok || resp.data.statusCode !== 200) return
      const result = typeof resp.data.data === 'string' ? JSON.parse(resp.data.data) : resp.data.data
      if (!result.openid) return

      // 查用户
      const { data: userList } = await supabase.from('users').select('*').eq('wechat_openid', result.openid).limit(1)
      if (userList && userList.length > 0) {
        const userData = userList[0]
        if (userData.status !== 'active') return
        const user = { id: userData.id, email: userData.email, name: userData.name, role: userData.role }
        const [ownRes, memberRes] = await Promise.all([
          supabase.from('ledgers').select('*').eq('owner_id', userData.id).order('created_at'),
          supabase.from('ledger_members').select('ledger_id').eq('user_id', userData.id)
        ])
        const ownLedgers = ownRes.data || []
        const memberLedgerIds = (memberRes.data || []).map(m => m.ledger_id)
        let allLedgers = [...ownLedgers]
        if (memberLedgerIds.length > 0) {
          const { data: shared } = await supabase.from('ledgers').select('*').in('id', memberLedgerIds)
          if (shared) {
            const ownIds = new Set(ownLedgers.map(l => l.id))
            allLedgers = [...allLedgers, ...shared.filter(l => !ownIds.has(l.id))]
          }
        }
        const ledger = allLedgers.length > 0 ? allLedgers[0] : null
        this._updateLastLogin(user.id)
        app.onLoginSuccess(user, ledger)
        this.setData({ user, isGuest: false })
        this.loadData()
        this.loadCatTree()
      } else {
        // 新微信用户，显示一键注册
        this.setData({ wechatOpenid: result.openid, showWechatRegister: true })
      }
    } catch(e) {
      console.error('[tryWechatLogin]', e)
    }
  },

  // 切换协议同意
  toggleAgree() {
    this.setData({ agreedPrivacy: !this.data.agreedPrivacy })
  },

  // 隐私授权：同意
  acceptPrivacy() {
    if (!this.data.agreedPrivacy) return
    wx.setStorageSync('privacy_agreed', true)
    this.setData({ showPrivacyConsent: false })
  },

  // 隐私授权：拒绝（退出程序）
  rejectPrivacy() {
    wx.showModal({
      title: '提示',
      content: '您需要同意用户协议和隐私政策才能使用本服务。',
      showCancel: false,
      confirmText: '好的',
      success: () => {
        wx.reLaunch({ url: '/pages/home/home' })
      }
    })
  },

  // 更新用户最后登录时间
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

  // 微信一键注册
  async handleWechatRegister() {
    const { wechatOpenid, agreedPrivacy } = this.data
    if (!wechatOpenid) return
    if (!agreedPrivacy) return wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' })
    this.setData({ loading: true })
    try {
      const randomId = Math.random().toString(36).slice(2, 10)
      const name = '微信用户' + randomId
      const email = `wx_${randomId}@wechat.local`
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
      if (authError) throw new Error(authError.message)
      const settingRes = await supabase.from('app_settings').select('value').eq('key', 'auto_approve').single()
      const autoApprove = settingRes.data && settingRes.data.value === 'true'
      await supabase.from('users').insert([{ id: authData.user.id, email, name, role: 'user', status: autoApprove ? 'active' : 'pending', wechat_openid: wechatOpenid }])
      this.setData({ loading: false, showWechatRegister: false })
      if (autoApprove) {
        const user = { id: authData.user.id, email, name, role: 'user' }
        this._updateLastLogin(user.id)
        app.onLoginSuccess(user, null)
        this.setData({ user, isGuest: false })
        wx.showToast({ title: '注册成功', icon: 'success' })
      } else {
        wx.showModal({ title: '✅ 注册成功，请等待审核', content: '您的账号已创建，正在等待管理员审核。审核通过后，打开小程序即可自动登录使用。', showCancel: false, confirmText: '我知道了' })
      }
    } catch(e) {
      wx.showToast({ title: e.message || '注册失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  goAgreement() { wx.navigateTo({ url: '/pages/agreement/agreement' }) },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },

  // 检查登录状态，未登录则跳转
  requireLogin(action) {
    if (!this.data.user) {
      wx.showModal({
        title: '请先登录',
        content: '登录后即可使用记账功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return false
    }
    return true
  },

  async loadData() {
    const { currentLedger, user } = this.data
    if (!currentLedger || !currentLedger.id || !user) { 
      this.setData({ loading: false }); 
      return 
    }
    this.setData({ loading: true })
    const { currentYear, currentMonth } = this.data
    const start = `${currentYear}-${String(currentMonth).padStart(2,'0')}-01`
    // 计算当月最后一天
    const lastDay = new Date(currentYear, currentMonth, 0).getDate()
    const end = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

    // 查当前账本是否有其他成员（用于共同标识）
    const { data: members } = await supabase.from('ledger_members').select('user_id').eq('ledger_id', currentLedger.id)
    const hasMembers = members && members.length > 0
    let q = supabase.from('transactions').select('*').eq('ledger_id', currentLedger.id).gte('date', start).lte('date', end)
    // 共享账本中应能看到所有成员交易
    q = q.order('date', { ascending: false }).order('created_at', { ascending: false })
    const { data, error } = await q
    
    // 通过 RPC 获取用户名（绕过 users 表 auth.uid()=id 的 SELECT RLS）
    let userNameMap = {}
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(t => t.user_id).filter(Boolean))]
      console.log('[home] unique user_ids:', userIds)
      if (userIds.length > 0) {
        try {
          const rpcRes = await new Promise((resolve) => {
            wx.request({
              url: SUPABASE_URL + '/rest/v1/rpc/get_user_names',
              method: 'POST',
              data: { p_user_ids: userIds.slice(0, 50) },
              header: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + (wx.getStorageSync('sb_access_token') || SUPABASE_ANON_KEY),
              },
              success: r => resolve(r),
              fail: e => resolve({ statusCode: 0, data: null })
            })
          })
          console.log('[home] get_user_names RPC status:', rpcRes.statusCode, 'data:', JSON.stringify(rpcRes.data))
          if (rpcRes.data && Array.isArray(rpcRes.data)) {
            rpcRes.data.forEach(u => { userNameMap[u.user_id] = u.user_name || '' })
          }
        } catch(e) {
          console.error('[home] get_user_names RPC failed:', e)
        }
      }
    }
    const showRecorder = Object.keys(userNameMap).length > 1
    console.log('[home] userNameMap:', JSON.stringify(userNameMap), 'showRecorder:', showRecorder)

    const PM_DISPLAY = { cash:'现金', wechat:'微信', alipay:'支付宝', bankcard:'银行卡', other:'其他' }
    const txs = (data || []).map(t => ({
      ...t,
      amountStr: Number(t.amount).toFixed(2),
      categoryIcon: t.category.match(/\p{Emoji}/u) && t.category.match(/\p{Emoji}/u)[0] || (t.type==='income'?'💰':'💸'),
      dateLabel: this.formatDate(t.date, t.created_at),
      canEdit: user.role === 'admin' || t.user_id === user.id,
      recorderName: userNameMap[t.user_id] || '',
      paymentDisplay: PM_DISPLAY[t.payment_method] || '现金'
    }))
    const totalIncome  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
    const totalExpense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
    const pendingReimburse = txs.filter(t=>t.is_reimbursable && t.reimbursement_status==='pending' && t.type==='expense')
      .reduce((s,t)=>s+Number(t.amount),0)
    // 按日分组（挖财风格）
    const groupMap = new Map()
    txs.forEach(t => {
      if (!groupMap.has(t.date)) {
        groupMap.set(t.date, { date: t.date, items: [] })
      }
      groupMap.get(t.date).items.push(t)
    })
    const weekDays = ['周日','周一','周二','周三','周四','周五','周六']
    const dailyGroups = []
    // 保持按日期降序
    const sortedDates = [...groupMap.keys()].sort((a, b) => b.localeCompare(a))
    for (const d of sortedDates) {
      const items = groupMap.get(d).items
      const dInc = items.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
      const dExp = items.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
      const dObj = new Date(d + 'T00:00:00')
      const md = `${dObj.getMonth()+1}/${dObj.getDate()}`
      const wd = weekDays[dObj.getDay()]
      dailyGroups.push({
        date: d,
        dateLabel: `${md} ${wd}`,
        income: dInc.toFixed(2),
        expense: dExp.toFixed(2),
        items
      })
    }
    this.setData({
      transactions: txs, dailyGroups, loading: false,
      currentLedger: { ...currentLedger, isShared: hasMembers, displayName: (hasMembers ? '[共同]' : '') + (currentLedger.name || '') },
      showRecorder,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: (totalIncome - totalExpense).toFixed(2),
      pendingReimburseTotal: pendingReimburse.toFixed(2)
    })

    // 副产物：统计近期类别使用频次（仅当月数据，用于 buildTree 排序）
    this._updateCatFreq(txs)
  },

  // 独立查询近 7 天全量事务，按类别名统计频次
  async loadCatFreq() {
    const { currentLedger } = this.data
    if (!currentLedger || !currentLedger.id) return
    const start7 = bjDaysAgo(7)
    const end = bjToday()
    const { data } = await supabase.from('transactions')
      .select('category,date')
      .eq('ledger_id', currentLedger.id)
      .gte('date', start7)
      .lte('date', end)
      .limit(2000)
    if (!data || data.length === 0) return
    const freq = {}
    data.forEach(t => {
      if (!t.category) return
      freq[t.category] = (freq[t.category] || 0) + 1
    })
    this.setData({ catFreq: freq })
  },

  // 按当前月份条目统计类别使用频次（fallback，不衰减）
  _updateCatFreq(txs) {
    const freq = {}
    txs.forEach(t => {
      if (!t.category) return
      freq[t.category] = (freq[t.category] || 0) + 1
    })
    const prevFreq = this.data.catFreq || {}
    Object.entries(prevFreq).forEach(([k, v]) => {
      if (!freq[k]) freq[k] = v
    })
    this.setData({ catFreq: freq })
  },

  // ── 月份切换 ──
  prevMonth() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 1) {
      currentMonth = 12
      currentYear -= 1
    } else {
      currentMonth -= 1
    }
    this.setData({
      currentYear, currentMonth,
      monthLabel: `${currentYear}年${currentMonth}月`
    })
    this.loadData()
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data
    const now = new Date()
    const nowY = now.getFullYear()
    const nowM = now.getMonth() + 1
    // 不允许超过当月
    if (currentYear === nowY && currentMonth >= nowM) return
    if (currentMonth === 12) {
      currentMonth = 1
      currentYear += 1
    } else {
      currentMonth += 1
    }
    // 二次校验
    if (currentYear > nowY || (currentYear === nowY && currentMonth > nowM)) return
    this.setData({
      currentYear, currentMonth,
      monthLabel: `${currentYear}年${currentMonth}月`
    })
    this.loadData()
  },

  openMonthPicker() {
    const now = new Date()
    const nowY = now.getFullYear()
    // 从当前年份往前10年，往后0年（不允许超当月）
    const years = []
    for (let y = nowY; y >= nowY - 10; y--) {
      years.push(`${y}年`)
    }
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
    // 计算当前选中值在 picker 中的索引
    const yearIndex = nowY - this.data.currentYear
    const monthIndex = this.data.currentMonth - 1
    this.setData({
      monthPickerVisible: true,
      monthPickerRange: [years, months],
      monthPickerValue: [Math.min(yearIndex, years.length - 1), monthIndex]
    })
  },

  closeMonthPicker() {
    this.setData({ monthPickerVisible: false })
  },

  onMonthPickerChange(e) {
    const [yearIdx, monthIdx] = e.detail.value
    const years = this.data.monthPickerRange[0]
    const yearStr = years[yearIdx].replace('年', '')
    const year = parseInt(yearStr)
    const month = monthIdx + 1
    this.setData({
      currentYear: year,
      currentMonth: month,
      monthLabel: `${year}年${month}月`,
      monthPickerVisible: false,
      monthPickerValue: [yearIdx, monthIdx]
    })
    this.loadData()
  },

  async loadCatTree() {
    const { currentLedger, catFreq } = this.data
    if (!currentLedger || !currentLedger.id) return
    const { data } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
      .eq('ledger_id', currentLedger.id).order('level').order('name')

    if (!data || data.length === 0) {
      const { initDefaultCategories } = require('../../utils/categories')
      await initDefaultCategories(supabase, currentLedger.id)
      const { data: fresh } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
        .eq('ledger_id', currentLedger.id).order('level').order('name')
      this.buildTree(fresh || [], catFreq)
      return
    }

    const { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, initDefaultCategories } = require('../../utils/categories')
    const presetNames = []
    const collectNames = (list) => {
      for (const item of list) {
        presetNames.push(item.name)
        if (item.children) collectNames(item.children)
      }
    }
    collectNames(DEFAULT_INCOME_CATEGORIES)
    collectNames(DEFAULT_EXPENSE_CATEGORIES)

    const existingNames = new Set(data.map(c => c.name))
    const hasMissing = presetNames.some(n => !existingNames.has(n))
    if (hasMissing) {
      await initDefaultCategories(supabase, currentLedger.id)
      const { data: fresh } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
        .eq('ledger_id', currentLedger.id).order('level').order('name')
      this.buildTree(fresh || [], catFreq)
      return
    }

    this.buildTree(data, catFreq)
  },

  buildTree(data, freqMap) {
    const freq = freqMap || this.data.catFreq || {}
    const map = {}; const roots = []
    ;(data||[]).forEach(c => { map[c.id] = {...c, children: [], freq: freq[c.name] || 0} })
    ;(data||[]).forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id])
      else if (!c.parent_id) roots.push(map[c.id])
    })
    // 自底向上聚合：子节点频次累加到父节点
    const aggregateUp = (node) => {
      if (node.children && node.children.length > 0) {
        for (const child of node.children) aggregateUp(child)
        node.freq += node.children.reduce((s, c) => s + c.freq, 0)
      }
    }
    roots.forEach(r => aggregateUp(r))
    // 按频次降序排列
    const sortByFreq = (nodes) => {
      nodes.sort((a, b) => b.freq - a.freq)
      for (const n of nodes) {
        if (n.children && n.children.length > 0) sortByFreq(n.children)
      }
    }
    sortByFreq(roots)
    this.setData({ catTree: roots })
    this.updateCurrentCats('expense')
  },

  updateCurrentCats(type) {
    const cats = this.data.catTree
      .filter(c => c.type === type)
      .map(c => ({...c, hasChildren: c.children && c.children.length > 0}))
    this.setData({ currentCats: cats })
  },

  formatDate(dateStr, createdAt) {
    const d = new Date(dateStr)
    let h, m
    // ES6把无时区datetime当本地时间解析，所以不能用 new Date() 直接取
    // 用正则从原始字符串取值，统一按UTC→+8北京处理
    if (createdAt && createdAt.includes('T')) {
      const parts = createdAt.split('T')[1].split(':').map(Number)
      h = String((parts[0] + 8) % 24).padStart(2, '0')
      m = String(isNaN(parts[1]) ? 0 : parts[1]).padStart(2, '0')
    } else {
      const t = new Date(Date.now())
      h = String((t.getUTCHours() + 8) % 24).padStart(2, '0')
      m = String(t.getUTCMinutes()).padStart(2, '0')
    }
    return `${d.getMonth()+1}月${d.getDate()}日 ${h}:${m}`
  },

  // ── 记账弹窗 ──
  openQuickAdd() {
    // 游客也可以打开记账弹窗浏览，保存时才检查登录
    this.updateCurrentCats('expense')  // 每次打开弹窗按最新频次排序
    this.setData({
      showQuickAdd: true, qaType: 'expense', qaAmount: '', qaCategory: '', qaNote: '',
      qaDate: bjToday(),
      qaExpandedKey: null, subCats: [], qaPaymentMethod: 'cash', qaReimbursable: false
    })
  },
  closeQuickAdd() { this.setData({ showQuickAdd: false }) },
  setQaType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ qaType: type, qaCategory: '', qaExpandedKey: null, subCats: [] })
    this.updateCurrentCats(type)
  },
  onAmountInput(e) { this.setData({ qaAmount: e.detail.value }) },
  onNoteInput(e)   { this.setData({ qaNote: e.detail.value }) },
  onQaDateChange(e) { this.setData({ qaDate: e.detail.value }) },
  onQaReimburseTap() { this.setData({ qaReimbursable: !this.data.qaReimbursable }) },
  onQaPaymentChange(e) { this.setData({ qaPaymentMethod: e.currentTarget.dataset.id }) },

  onCatTap(e) {
    const { name, hasChildren } = e.currentTarget.dataset
    const h = hasChildren === 'true' || hasChildren === true
    if (h) {
      const parent = this.data.catTree.find(c => c.name === name)
      if (this.data.qaExpandedKey === name) {
        this.setData({ qaExpandedKey: null, subCats: [], qaSubExpandedKey: null, subSubCats: [] })
      } else {
        this.setData({ qaExpandedKey: name, subCats: (parent && parent.children) || [], qaSubExpandedKey: null, subSubCats: [] })
      }
    } else {
      this.setData({ qaCategory: name, qaExpandedKey: null, subCats: [], qaSubExpandedKey: null, subSubCats: [] })
    }
  },
  onSubCatTap(e) {
    const name = e.currentTarget.dataset.name
    const subCats = this.data.subCats
    const sub = subCats.find(c => c.name === name)
    if (sub && sub.children && sub.children.length > 0) {
      if (this.data.qaSubExpandedKey === name) {
        this.setData({ qaSubExpandedKey: null, subSubCats: [] })
      } else {
        this.setData({ qaSubExpandedKey: name, subSubCats: sub.children })
      }
    } else {
      this.setData({ qaCategory: name, qaSubExpandedKey: null, subSubCats: [] })
    }
  },
  onSubSubCatTap(e) {
    const name = e.currentTarget.dataset.name
    this.setData({ qaCategory: name, qaSubExpandedKey: null, subSubCats: [] })
  },
  selectParentSelf() { 
    this.setData({ qaCategory: this.data.qaExpandedKey, qaExpandedKey: null, subCats: [], qaSubExpandedKey: null, subSubCats: [] }) 
  },

  async handleQuickAdd() {
    // 游客点保存时检查登录
    if (!this.requireLogin('保存')) return
    const { currentLedger, user, qaType, qaAmount, qaCategory, qaNote, qaDate, qaPaymentMethod, qaReimbursable } = this.data
    if (!qaAmount || !qaCategory) return wx.showToast({ title: '请填写金额并选择分类', icon: 'none' })
    this.setData({ qaLoading: true })
    try {
      const record = {
        ledger_id: currentLedger.id, user_id: user.id,
        amount: parseFloat(qaAmount), type: qaType,
        category: qaCategory, note: qaNote, date: qaDate,
        payment_method: qaPaymentMethod
      }
      if (qaType === 'expense' && qaReimbursable) {
        record.is_reimbursable = true
        record.reimbursement_status = 'pending'
      }
      const { error } = await supabase.from('transactions').insert([record])
      if (error) throw new Error(error.message)
      this.setData({ showQuickAdd: false })
      wx.showToast({ title: '记账成功', icon: 'success' })
      this.loadData()
    } catch(e) {
      wx.showToast({ title: e.message || '记账失败', icon: 'none' })
    } finally {
      this.setData({ qaLoading: false })
    }
  },

  // ── 编辑 ──
  onEditTap(e) {
    if (!this.requireLogin('编辑')) return
    const { date, index } = e.currentTarget.dataset
    const group = this.data.dailyGroups.find(g => g.date === date)
    const tx = group ? group.items[index] : null
    if (!tx) return
    const editCats = this.data.catTree.filter(c=>c.type===tx.type)
    let matchedCategory = tx.category || ''
    if (!editCats.find(c=>c.name===tx.category)) {
      let clean = tx.category||''
      clean = clean.replace(/^[^\s]+\s*/, '').replace(/\s*›\s*[^\s]+\s*/g, ' › ').trim()
      const found = editCats.find(c=>c.name===clean||(c.children&&c.children.find(sc=>sc.name===clean)))
      if (found) matchedCategory = clean
    }
    this.setData({
      showEdit: true, editTx: tx,
      editType: tx.type, editAmount: String(tx.amount),
      editCategory: matchedCategory, editNote: tx.note||'', editDate: tx.date,
      editCats, editPaymentMethod: tx.payment_method || 'cash',
      editReimbursable: !!tx.is_reimbursable,
      editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [],
    })
  },
  closeEdit() { this.setData({ showEdit: false }) },
  setEditType(e) {
    const type = e.currentTarget.dataset.type
    const editCats = this.data.catTree.filter(c=>c.type===type)
    this.setData({ editType: type, editCategory: '', editCats, editPaymentMethod: 'cash',
      editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [] })
  },
  onEditAmountInput(e) { this.setData({ editAmount: e.detail.value }) },
  onEditNoteInput(e)  { this.setData({ editNote: e.detail.value }) },
  onEditDateChange(e) { this.setData({ editDate: e.detail.value }) },
  onEditCatTap(e) {
    const name = e.currentTarget.dataset.name
    const parent = this.data.editCats.find(c => c.name === name)
    if (parent && parent.children && parent.children.length > 0) {
      if (this.data.editExpandedKey === name) {
        this.setData({ editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [] })
      } else {
        this.setData({ editExpandedKey: name, editSubCats: parent.children, editSubExpandedKey: null, editSubSubCats: [] })
      }
    } else {
      this.setData({ editCategory: name, editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [] })
    }
  },
  onEditSubCatTap(e) {
    const name = e.currentTarget.dataset.name
    const sub = this.data.editSubCats.find(c => c.name === name)
    if (sub && sub.children && sub.children.length > 0) {
      if (this.data.editSubExpandedKey === name) {
        this.setData({ editSubExpandedKey: null, editSubSubCats: [] })
      } else {
        this.setData({ editSubExpandedKey: name, editSubSubCats: sub.children })
      }
    } else {
      this.setData({ editCategory: name, editSubExpandedKey: null, editSubSubCats: [] })
    }
  },
  onEditSubSubCatTap(e) {
    const name = e.currentTarget.dataset.name
    this.setData({ editCategory: name, editSubExpandedKey: null, editSubSubCats: [] })
  },
  selectEditParentSelf() {
    this.setData({ editCategory: this.data.editExpandedKey, editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [] })
  },
  onEditPaymentChange(e) { this.setData({ editPaymentMethod: e.currentTarget.dataset.id }) },
  onEditReimburseTap() { this.setData({ editReimbursable: !this.data.editReimbursable }) },

  async handleEdit() {
    const { editTx, editType, editAmount, editCategory, editNote, editDate, editPaymentMethod, editReimbursable } = this.data
    if (!editAmount || !editCategory) return wx.showToast({ title: '请填写金额并选择分类', icon: 'none' })
    this.setData({ editLoading: true })
    try {
      const update = {
        type: editType, amount: parseFloat(editAmount),
        category: editCategory, note: editNote, date: editDate,
        payment_method: editPaymentMethod
      }
      if (editType === 'expense' && editReimbursable) {
        update.is_reimbursable = true
        if (!editTx.reimbursement_status) update.reimbursement_status = 'pending'
      } else if (!editReimbursable) {
        update.is_reimbursable = false
        update.reimbursement_status = null
      }
      const { error } = await supabase.from('transactions').update(update).eq('id', editTx.id)
      if (error) throw new Error(error.message)
      this.setData({ showEdit: false })
      wx.showToast({ title: '修改成功', icon: 'success' })
      this.loadData()
    } catch(e) {
      wx.showToast({ title: e.message || '修改失败', icon: 'none' })
    } finally {
      this.setData({ editLoading: false })
    }
  },

  async handleDelete() {
    const { editTx } = this.data
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除这条记录吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const { error } = await supabase.from('transactions').delete().eq('id', editTx.id)
          if (error) throw new Error(error.message)
          this.setData({ showEdit: false })
          wx.showToast({ title: '删除成功', icon: 'success' })
          this.loadData()
        } catch(e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      }
    })
  },

  onDeleteTap(e) {
    if (!this.requireLogin('删除')) return
    const { date, index } = e.currentTarget.dataset
    const group = this.data.dailyGroups.find(g => g.date === date)
    const tx = group ? group.items[index] : null
    if (!tx) return
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除这条记录吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
          if (error) throw new Error(error.message)
          wx.showToast({ title: '删除成功', icon: 'success' })
          this.loadData()
        } catch(e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      }
    })
  },

  // 已报销状态切换
  async onReimburseStatusTap(e) {
    if (!this.requireLogin('操作')) return
    const { date, index } = e.currentTarget.dataset
    const group = this.data.dailyGroups.find(g => g.date === date)
    const tx = group ? group.items[index] : null
    if (!tx) return
    const nextStatus = tx.reimbursement_status === 'pending' ? 'paid' : 'pending'
    const statusLabel = nextStatus === 'paid' ? '已到账' : '待报销'
    wx.showModal({
      title: '报销状态',
      content: `将这笔报销标记为「${statusLabel}」吗？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          const { error } = await supabase.from('transactions').update({
            reimbursement_status: nextStatus
          }).eq('id', tx.id)
          if (error) throw new Error(error.message)
          wx.showToast({ title: '已更新', icon: 'success' })
          this.loadData()
        } catch(e) {
          wx.showToast({ title: e.message || '操作失败', icon: 'none' })
        }
      }
    })
  },

  toggleReimbursableFilter() {
    this.setData({ showReimbursableOnly: !this.data.showReimbursableOnly })
  },

  // 月度报销核销
  async settleAllReimburse() {
    if (!this.requireLogin('操作')) return
    const pending = []
    ;(this.data.dailyGroups||[]).forEach(g => {
      (g.items||[]).forEach(t => {
        if (t.is_reimbursable && t.reimbursement_status === 'pending') pending.push(t)
      })
    })
    if (pending.length === 0) {
      wx.showToast({ title: '没有待核销的报销', icon: 'none' })
      return
    }
    const totalAmount = pending.reduce((s, t) => s + Number(t.amount), 0)
    wx.showModal({
      title: '月度核销',
      content: `共 ${pending.length} 笔待报销，合计 ¥${totalAmount.toFixed(2)}\n确认全部核销为已到账？`,
      success: async res => {
        if (!res.confirm) return
        try {
          const ids = pending.map(t => t.id)
          for (const id of ids) {
            await supabase.from('transactions').update({ reimbursement_status: 'paid' }).eq('id', id)
          }
          wx.showToast({ title: `已核销 ${ids.length} 笔`, icon: 'success' })
          this.loadData()
        } catch(e) {
          wx.showToast({ title: e.message || '核销失败', icon: 'none' })
        }
      }
    })
  },

  // ── 创建账本 ──
  showCreateLedgerModal() { this.setData({ showCreateLedger: true, newLedgerName: '' }) },
  hideCreateLedger() { this.setData({ showCreateLedger: false }) },
  onLedgerNameInput(e) { this.setData({ newLedgerName: e.detail.value }) },

  async createLedger() {
    const { newLedgerName, user } = this.data
    if (!newLedgerName.trim()) return wx.showToast({ title: '请输入账本名称', icon: 'none' })
    this.setData({ creatingLedger: true })
    try {
      const { data, error } = await supabase.from('ledgers').insert([{
        name: newLedgerName.trim(),
        type: 'personal',
        owner_id: user.id
      }]).select()
      if (error) throw new Error(error.message)
      const ledger = data[0]
      app.globalData.currentLedger = ledger
      app.saveDefaultLedger(ledger)
      // 初始化预置分类
      await initDefaultCategories(supabase, ledger.id)
      this.setData({ showCreateLedger: false, currentLedger: { ...ledger, isShared: false, displayName: ledger.name || '' } })
      wx.showToast({ title: '创建成功', icon: 'success' })
      this.loadData()
      this.loadCatTree()
    } catch(e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' })
    } finally {
      this.setData({ creatingLedger: false })
    }
  },

  async handleExport() {
    if (!this.requireLogin('导出')) return
    const { currentLedger } = this.data
    if (!currentLedger || !currentLedger.id) return wx.showToast({ title: '请先选择账本', icon: 'none' })
    wx.showModal({
      title: '导出确认',
      content: `确认导出「${currentLedger.name}」的全部记录？`,
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '导出中...' })
        try {
          const { data, error } = await supabase
            .from('transactions')
            .select('*, users(name)')
            .eq('ledger_id', currentLedger.id)
            .order('date', { ascending: true })
          if (error) throw error
          if (!data || data.length === 0) {
            wx.hideLoading()
            return wx.showToast({ title: '暂无账目可导出', icon: 'none' })
          }
          const PM_MAP = { cash:'现金', wechat:'微信', alipay:'支付宝', bankcard:'银行卡', other:'其他' }
          const rows = [['日期', '时间', '类型', '金额', '类别', '子类别', '备注', '支付方式', '记账人']]
          data.forEach(t => {
            rows.push([
              t.date || '', t.created_at ? (() => { const parts = t.created_at.split('T')[1].split(':').map(Number); return String((parts[0] + 8) % 24).padStart(2, '0') + ':' + String(parts[1] || 0).padStart(2, '0') })() : '',
              t.type === 'income' ? '收入' : '支出', t.amount || '0',
              t.category || '', t.sub_category || '',
              (t.note || '').replace(/"/g, '""'),
              PM_MAP[t.payment_method] || t.payment_method || '',
              t.users ? t.users.name : ''
            ])
          })
          const csv = rows.map(r => r.map(c => '"' + c + '"').join(',')).join('\n')
          const fs = wx.getFileSystemManager()
          const fileName = `${currentLedger.name}_${bjToday()}.csv`
          const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
          fs.writeFile({
            filePath, data: '\uFEFF' + csv, encoding: 'utf8',
            success: () => {
              wx.hideLoading()
              wx.showModal({
                title: '导出成功', content: `文件已保存：${fileName}`,
                showCancel: false, confirmText: '分享',
                success: (r) => {
                  if (r.confirm) {
                    wx.shareFileMessage ? wx.shareFileMessage({ filePath }) : wx.showToast({ title: '请在文件管理中查看', icon: 'none' })
                  }
                }
              })
            },
            fail: e => { wx.hideLoading(); wx.showToast({ title: '导出失败', icon: 'none' }) }
          })
        } catch(e) {
          wx.hideLoading()
          wx.showToast({ title: '导出失败', icon: 'none' })
        }
      }
    })
  },
})
