// pages/home/home.js
const app = getApp()
const { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, deriveWechatPassword } = require('../../utils/supabase')
const { initDefaultCategories } = require('../../utils/categories')
const {
  CURRENCIES, CURRENCY_CODES, getSymbol, getLabel, resolveBaseCurrency,
  formatMoney, formatNumber, convertToBase, baseAmountOf, statAmountOf, currencyOf,
  isPending, getReferenceAmount, impliedRate, round2,
  SETTLE_PENDING, SETTLE_SETTLED,
} = require('../../utils/currency')
const { getRateMap } = require('../../utils/rates')
const {
  accountNameOf, isTransfer, validateTransfer,
} = require('../../utils/accounts')
const {
  isLoan, loanDirectionOf, loanBadge, counterpartyOf,
  openLoanOverview, recentCounterparties, LOAN_OUT, LOAN_IN,
} = require('../../utils/loans')

// 币种下拉项：'¥ 人民币 CNY' 形式，与 CURRENCY_CODES 下标一一对应
const CURRENCY_LABELS = CURRENCY_CODES.map(code => getLabel(code))

// 借款占位分类：借款没有消费分类，用这两个名字让列表 / 导出仍有可读的分类文案。
// 它们不写进 categories 表（借款已被排除在统计之外，不需要参与分类统计）。
const LOAN_OUT_CAT = '借出'
const LOAN_IN_CAT = '借入'

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
    // 多币种：本位币挂在账本上；明细显原币、汇总显本位币
    baseCurrency: 'CNY',
    baseSymbol: '¥',
    currencies: CURRENCIES,
    currencyLabels: CURRENCY_LABELS,
    rateSource: '',
    rateDate: '',
    rateStale: false,
    // 外币待结算：记账时本位币金额未知，不计入汇总，等银行账单出来后结算
    pendingCount: 0,
    pendingRefTotal: '0.00',
    showPendingOnly: false,
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
    // 借款（022）：qaIsLoan 开启后分类自动填「借出 / 借入」，改由对方名承担归类职责
    qaIsLoan: false, qaCounterparty: '', loanPartyHistory: [],
    qaCurrency: 'CNY', qaCurrencyIndex: 0, qaSymbol: '¥', qaRate: 1, qaConvertHint: '', qaRateWarn: false,
    qaExpandedKey: null, subCats: [], qaSubExpandedKey: null, subSubCats: [],
    currentCats: [],
    qaPaymentMethod: 'cash',
    // 资金账户（与支付方式并存）：钱从哪个账户出/进
    accounts: [],
    qaAccountIndex: 0, qaToAccountIndex: 0,
    // 油耗（油费分类专用）
    qaVehicles: [], qaVehicleIndex: 0, qaFuelLiters: '', qaOdometer: '',
    // 编辑弹窗
    showEdit: false, editTx: null,
    editType: 'expense', editAmount: '', editCategory: '', editNote: '', editDate: '', editLoading: false, editReimbursable: false,
    editIsLoan: false, editCounterparty: '',
    editCurrency: 'CNY', editCurrencyIndex: 0, editSymbol: '¥', editRate: 1, editConvertHint: '', editRateWarn: false,
    // 结算校正：待结算交易可填入银行实际扣款的本位币金额
    editIsPending: false, editRefAmount: null, settleAmount: '', settleHint: '',
    editCats: [],
    editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [],
    editPaymentMethod: 'cash',
    editAccountIndex: 0, editToAccountIndex: 0,
    // 油耗（编辑）
    editVehicles: [], editVehicleIndex: 0, editFuelLiters: '', editOdometer: '',
    // 类别树
    catTree: [],
    catFreq: {},  // 分类使用频次 {name: count}
    // 报销筛选
    showReimbursableOnly: false,
    pendingReimburseTotal: '0.00',
    // 借款（022）：未结清概览 —— 别人欠我多少、我欠别人多少
    showLoanOnly: false,
    loanOverview: {
      open: false, partyCount: 0,
      receivable: 0, payable: 0, net: 0,
      receivableText: '0.00', payableText: '0.00', netText: '0.00',
    },
    dailyGroups: [], // 按日分组 [{date, dateLabel, income, expense, items:[]}]
    // 列表筛选后的展示分组：与 dailyGroups 里的分组是同一批对象引用
    // （只做「选哪些天展示」，不改 items 内容，保证 onEditTap 的 index 仍然对得上）
    displayGroups: [],
    listFiltered: false,
    displayCount: 0,
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
          }, () => this._applyListFilters())  // 同步展示分组，否则列表会是空的
        }
      } catch(e) { cached = null }
    }
    
    this.setData({
      user: user || null,
      isGuest: !user,
      guestBrowsing: !user,
      currentLedger: ledger ? { ...ledger } : { id: null, name: '暂无账本' },
      ...this._baseFields(ledger),
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

    // 被删/被禁用用户当场踢下线（静默检查，节流 60s）
    if (user && user.id) app.checkAccountStatus()

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
      this.setData({ currentLedger: { ...ledger }, showCreateLedger: false, ...this._baseFields(ledger) })
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
      editIsLoan: isLoan(tx), editCounterparty: counterpartyOf(tx),
      editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [],
      editVehicles: [], editVehicleIndex: 0,
      editFuelLiters: tx.fuel_liters != null ? String(tx.fuel_liters) : '',
      editOdometer: tx.odometer != null ? String(tx.odometer) : '',
      editAccountIndex: this._accountIndexOf(tx.account_id),
      editToAccountIndex: this._accountIndexOf(tx.to_account_id),
      ...this._editCurrencyFields(tx),
    })
    this.loadVehiclesForEdit(tx.vehicle_id)
    this._updateEditConvert(true)   // 回显「记账时汇率」
  },

  // 编辑弹窗：币种相关字段回填
  _editCurrencyFields(tx) {
    const baseCurrency = this.data.baseCurrency
    const editCurrency = currencyOf(tx, baseCurrency)
    const idx = CURRENCY_CODES.indexOf(editCurrency)
    const pending = isPending(tx)
    const refAmt = pending ? getReferenceAmount(tx) : null
    return {
      editCurrency,
      editCurrencyIndex: idx < 0 ? 0 : idx,
      editSymbol: getSymbol(editCurrency),
      editRate: Number(tx.exchange_rate) > 0 ? Number(tx.exchange_rate) : 1,
      editConvertHint: '',
      editRateWarn: false,
      // 结算校正区：只有待结算交易显示。
      // settleAmount 故意留空 —— 必须用户主动填写银行实际扣款才会结算，
      // 避免「只改个备注」就把待结算按参考汇率误结算。
      editIsPending: pending,
      editRefAmount: refAmt,
      settleAmount: '',
      settleHint: refAmt == null
        ? '填银行账单上的实际入账金额（本位币），留空则保持待结算'
        : `记账时参考约 ${formatMoney(refAmt, baseCurrency)}；留空则保持待结算`,
    }
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

  // 跳转油耗统计页
  goFuel() {
    wx.navigateTo({ url: '/pages/fuel/fuel' })
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

      // RLS 收紧后，前端无法用 openid 直查 users；改用 wechat-auth 返回的用户信息
      if (result.email) {
        const userData = {
          id: '',
          email: result.email,
          name: result.name,
          role: result.role,
          status: result.status,
        }
        if (userData.status === 'pending') return
        if (userData.status === 'disabled') return
        // 用派生密码换 access token（RPC 写操作依赖 auth.uid()）
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithWechat(result.openid, userData.email)
        if (loginErr) {
          console.error('[tryWechatLogin] 换取 token 失败:', loginErr)
          wx.showToast({ title: '登录失败，请重试', icon: 'none' })
          return
        }
        userData.id = loginData?.user?.id || ''
        if (userData.status === 'deleted') {
          // 15天内登录 → 自动恢复（此时已有 access token）
          const restoreRes = await supabase.rpc('user_self_restore', {})
          if (restoreRes.statusCode >= 400) {
            wx.showToast({ title: '账号删除已超15天，无法恢复', icon: 'none' })
            return
          }
          wx.showToast({ title: '账号已恢复', icon: 'success' })
        }
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
            'Authorization': 'Bearer ' + (wx.getStorageSync('sb_access_token') || SUPABASE_ANON_KEY)
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
      const password = deriveWechatPassword(wechatOpenid)
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
      if (authError) throw new Error(authError.message)
      // signUp 后换 access token（register_user 依赖 auth.uid()）
      const { error: loginErr } = await supabase.auth.signInWithWechat(wechatOpenid, email)
      if (loginErr) throw new Error('注册后登录失败，请重试')
      // 走 register_user RPC（后端强制 role=user / status 由 auto_approve 决定）
      const regRes = await supabase.registerUser(name, email, wechatOpenid)
      const userStatus = regRes.data || 'pending'
      const autoApprove = userStatus === 'active'
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

    // 查当前账本是否有其他成员（用于共同标识），同时刷新可用资金账户
    const [{ data: members }, accList] = await Promise.all([
      supabase.from('ledger_members').select('user_id').eq('ledger_id', currentLedger.id),
      this.loadAccounts(),
    ])
    const hasMembers = members && members.length > 0
    const accounts = accList || this.data.accounts || []
    let q = supabase.from('transactions').select('*').eq('ledger_id', currentLedger.id).gte('date', start).lte('date', end)
    // 共享账本中应能看到所有成员交易
    q = q.order('date', { ascending: false }).order('created_at', { ascending: false })
    // 借款欠款是「累计存量」概念：不能只算当月，否则切到某月就只剩那个月借出去的钱。
    // 单独查全量 is_loan 流水（走部分索引 idx_transactions_loan，数据量很小），与主查询并行。
    const [{ data, error }, { data: loanRows }] = await Promise.all([
      q,
      supabase.from('transactions')
        .select('id,type,amount,base_amount,currency,exchange_rate,settlement_status,is_loan,loan_counterparty,date,note')
        .eq('ledger_id', currentLedger.id)
        .eq('is_loan', true),
    ])
    
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
    const baseCurrency = this.data.baseCurrency
    const txs = (data || []).map(t => {
      const cur = currencyOf(t, baseCurrency)
      const baseAmt = baseAmountOf(t)
      // 统计口径：借款返回 0（借出不是支出、借入不是收入），
      // 而 baseAmt 保留真实金额供账户余额与明细展示使用
      const statAmt = statAmountOf(t)
      const pending = isPending(t)
      const refAmt = pending ? getReferenceAmount(t) : null
      return {
        ...t,
        currency: cur,
        baseAmount: baseAmt,
        statAmount: statAmt,
        isPending: pending,
        isLoan: isLoan(t),
        loanBadge: loanBadge(t),
        loanParty: counterpartyOf(t),
        loanDir: loanDirectionOf(t),
        amountDisplay: formatMoney(t.amount, cur),       // 明细显原币
        baseDisplay: formatMoney(baseAmt, baseCurrency), // 换算后的本位币
        // 待结算：本位币金额还没确定，只给参考提示，不给「≈」换算
        pendingHint: pending
          ? (refAmt == null
              ? '待结算 · 本位币金额待银行确认'
              : `待结算 · 参考约 ${formatMoney(refAmt, baseCurrency)}`)
          : '',
        showConvert: cur !== baseCurrency && !pending,
        amountStr: formatNumber(t.amount),
        baseAmountStr: formatNumber(baseAmt),
        categoryIcon: isLoan(t) ? '🤝'
          : ((t.category && t.category.match(/\p{Emoji}/u) && t.category.match(/\p{Emoji}/u)[0])
            || (isTransfer(t) ? '🔄' : (t.type==='income'?'💰':'💸'))),
        dateLabel: this.formatDate(t.date, t.created_at),
        canEdit: user.role === 'admin' || t.user_id === user.id,
        recorderName: userNameMap[t.user_id] || '',
        paymentDisplay: PM_DISPLAY[t.payment_method] || '现金',
        // 转账：账户间划转，展示「转出 → 转入」
        isTransfer: isTransfer(t),
        actionLabel: isTransfer(t) ? '转账' : (isLoan(t) ? (t.type === 'expense' ? '借出' : '借入') : (t.type === 'income' ? '收入' : '支出')),
        accountTag: isTransfer(t)
          ? `${accountNameOf(accounts, t.account_id) || '账户'} → ${accountNameOf(accounts, t.to_account_id) || '账户'}`
          : accountNameOf(accounts, t.account_id),
        fuelInfo: (t.fuel_liters != null || t.odometer != null)
          ? `⛽${t.fuel_liters != null ? t.fuel_liters + 'L' : ''}${t.odometer != null ? ' ' + t.odometer + 'km' : ''}${t.fuel_consumption != null ? ' · 油耗' + t.fuel_consumption + 'L/100km' : ''}`
          : ''
      }
    })
    // 汇总一律走本位币「统计口径」：借款 statAmount 为 0，天然被排除在收支合计之外
    // 待结算交易 baseAmount 也为 0，两者都不会污染收支
    const totalIncome  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.statAmount,0)
    const totalExpense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.statAmount,0)
    // 待结算统计：仅作提示，提醒用户本月合计里少了这几笔
    const pendingList = txs.filter(t => t.isPending)
    const pendingRefTotal = pendingList.reduce((s, t) => {
      const r = t.reference_amount
      return s + (r != null && r !== '' ? Number(r) : 0)
    }, 0)
    const pendingReimburse = txs.filter(t=>t.is_reimbursable && t.reimbursement_status==='pending' && t.type==='expense')
      .reduce((s,t)=>s+t.statAmount,0)
    // 借款概览：别人欠我多少 / 我欠别人多少（净额法，反向记账自动抵消）
    // 口径是全量借款，不是本月 —— 欠款是存量
    const loanOv = openLoanOverview(loanRows || [])
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
      const dInc = items.filter(t=>t.type==='income').reduce((s,t)=>s+t.statAmount,0)
      const dExp = items.filter(t=>t.type==='expense').reduce((s,t)=>s+t.statAmount,0)
      // 当天借款小计：借款不进上面的收支，但日头需要说明「今天还有借款流水」
      let dLoanOut = 0, dLoanIn = 0
      items.forEach(t => {
        if (!t.isLoan) return
        if (t.type === 'expense') dLoanOut += t.baseAmount
        else if (t.type === 'income') dLoanIn += t.baseAmount
      })
      const dObj = new Date(d + 'T00:00:00')
      const md = `${dObj.getMonth()+1}/${dObj.getDate()}`
      const wd = weekDays[dObj.getDay()]
      dailyGroups.push({
        date: d,
        dateLabel: `${md} ${wd}`,
        income: dInc.toFixed(2),
        expense: dExp.toFixed(2),
        loanOutText: dLoanOut > 0 ? formatMoney(dLoanOut, baseCurrency) : '',
        loanInText: dLoanIn > 0 ? formatMoney(dLoanIn, baseCurrency) : '',
        items
      })
    }
    // 筛选条件对应的匹配数。若筛选还开着但已经没有匹配项（典型场景：开着
    // 「只看待结算」时把那笔外币删了），自动退出筛选 —— 否则列表会只剩
    // 每日统计头、一条明细都看不到。
    const reimbursePendingList = txs.filter(t => t.is_reimbursable && t.reimbursement_status === 'pending')
    const loanList = txs.filter(t => t.isLoan)
    const keepPendingFilter = this.data.showPendingOnly && pendingList.length > 0
    const keepReimburseFilter = this.data.showReimbursableOnly && reimbursePendingList.length > 0
    const keepLoanFilter = this.data.showLoanOnly && loanList.length > 0

    this.setData({
      transactions: txs, dailyGroups, loading: false,
      showPendingOnly: keepPendingFilter,
      showReimbursableOnly: keepReimburseFilter,
      showLoanOnly: keepLoanFilter,
      loanOverview: {
        open: loanOv.open,
        partyCount: loanOv.partyCount,
        receivable: loanOv.receivable,
        payable: loanOv.payable,
        net: loanOv.net,
        receivableText: formatMoney(loanOv.receivable, baseCurrency),
        payableText: formatMoney(loanOv.payable, baseCurrency),
        netText: formatMoney(Math.abs(loanOv.net), baseCurrency),
        netPositive: loanOv.net > 0,
      },
      // 记录过借款的对方，供记账时一键选择（取全量，跨月也能联想）
      loanPartyHistory: recentCounterparties(loanRows || [], 8),
      currentLedger: { ...currentLedger, isShared: hasMembers, displayName: (hasMembers ? '[共同]' : '') + (currentLedger.name || '') },
      showRecorder,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: (totalIncome - totalExpense).toFixed(2),
      pendingReimburseTotal: pendingReimburse.toFixed(2),
      pendingCount: pendingList.length,
      pendingRefTotal: pendingRefTotal.toFixed(2)
    }, () => this._applyListFilters())

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

  // ── 多币种辅助 ────────────────────────────────────────
  // 账本本位币相关字段（账本切换/登录恢复时同步）
  _baseFields(ledger) {
    const baseCurrency = resolveBaseCurrency(ledger)
    return { baseCurrency, baseSymbol: getSymbol(baseCurrency) }
  },

  // 确保拿到「以本位币为基准」的汇率表（按需加载 + storage 缓存）
  async _ensureRateMap(force) {
    const base = this.data.baseCurrency
    const cached = this._rateMapCache
    if (cached && cached.base === base && !force) return cached
    const res = await getRateMap(base, force)
    const payload = {
      base,
      map: res.map || {},
      source: res.source,
      date: res.date,
      stale: !!res.stale,
    }
    this._rateMapCache = payload
    this.setData({ rateSource: payload.source, rateDate: payload.date, rateStale: payload.stale })
    return payload
  },

  // 1 单位 code 折合多少本位币（本位币自身恒为 1）
  _rateOf(code) {
    const base = this.data.baseCurrency
    if (!code || code === base) return 1
    const cached = this._rateMapCache
    const r = cached && cached.map && cached.map[code]
    return (r && r > 0) ? r : 1
  },

  // 汇率是否真的可用 —— 不可用时禁止写库，避免用错误汇率污染账目
  _rateAvailable(code) {
    const base = this.data.baseCurrency
    if (!code || code === base) return true
    const cached = this._rateMapCache
    return !!(cached && cached.map && cached.map[code] > 0)
  },

  // 汇率来源提示后缀
  _rateNote() {
    const s = this.data.rateSource
    if (s === 'offline' || s === 'none') return '（离线参考汇率，仅供估算）'
    if (this.data.rateStale) return '（汇率已过期，建议联网刷新）'
    return ''
  },

  // 记账弹窗：换算预览
  async _updateQaConvert() {
    const { qaCurrency, baseCurrency, qaAmount } = this.data
    if (qaCurrency === baseCurrency) {
      this.setData({ qaRate: 1, qaConvertHint: '', qaRateWarn: false })
      return
    }
    await this._ensureRateMap()
    const amt = parseFloat(qaAmount)
    if (!this._rateAvailable(qaCurrency)) {
      this.setData({ qaRate: 1, qaConvertHint: '外币将记为「待结算」，银行入账后再填实际扣款', qaRateWarn: true })
      return
    }
    const rate = this._rateOf(qaCurrency)
    const unit = `1 ${qaCurrency} = ${formatMoney(rate, baseCurrency, { symbol: false })} ${baseCurrency}`
    // 外币一律待结算：这里只给参考值，不作为入账金额
    const hint = (isNaN(amt) || amt <= 0)
      ? `待结算 · ${unit}`
      : `待结算 · 参考约 ${formatMoney(convertToBase(amt, rate), baseCurrency)}`
    this.setData({ qaRate: rate, qaConvertHint: hint + this._rateNote(), qaRateWarn: this.data.rateStale })
  },

  // 编辑弹窗：换算预览（keepFrozen=true 时沿用记账当时冻结的汇率）
  async _updateEditConvert(keepFrozen) {
    const { editCurrency, baseCurrency, editAmount, editTx } = this.data
    if (editCurrency === baseCurrency) {
      this.setData({ editRate: 1, editConvertHint: '', editRateWarn: false })
      return
    }
    await this._ensureRateMap()
    const amt = parseFloat(editAmount)
    if (!this._rateAvailable(editCurrency)) {
      this.setData({ editRate: 1, editConvertHint: '汇率不可用，可在下方直接填写银行实际扣款金额', editRateWarn: true })
      return
    }
    const frozen = !!(keepFrozen && editTx && editTx.currency === editCurrency && Number(editTx.exchange_rate) > 0)
    const rate = frozen ? Number(editTx.exchange_rate) : this._rateOf(editCurrency)
    const unit = `1 ${editCurrency} = ${formatMoney(rate, baseCurrency, { symbol: false })} ${baseCurrency}` +
      (frozen ? '（记账时参考价）' : '')
    // 待结算交易：真实金额由下方「结算」区填写，此处只给参考，不写库
    if (isPending(editTx)) {
      const pendHint = (isNaN(amt) || amt <= 0)
        ? `待结算 · ${unit}`
        : `待结算 · 参考约 ${formatMoney(convertToBase(amt, rate), baseCurrency)}`
      this.setData({ editRate: rate, editConvertHint: pendHint, editRateWarn: false })
      return
    }
    const hint = (isNaN(amt) || amt <= 0)
      ? unit
      : `≈ ${formatMoney(convertToBase(amt, rate), baseCurrency)}　${unit}`
    this.setData({
      editRate: rate,
      editConvertHint: hint + (frozen ? '' : this._rateNote()),
      editRateWarn: !frozen && this.data.rateStale,
    })
  },

  // 切换币种（记账弹窗）
  async onQaCurrencyChange(e) {
    const idx = Number(e.detail.value)
    const code = CURRENCY_CODES[idx]
    if (!code) return
    this.setData({ qaCurrency: code, qaCurrencyIndex: idx, qaSymbol: getSymbol(code) })
    await this._updateQaConvert()
  },

  // 切换币种（编辑弹窗）
  async onEditCurrencyChange(e) {
    const idx = Number(e.detail.value)
    const code = CURRENCY_CODES[idx]
    if (!code) return
    const sameAsRecord = !!(this.data.editTx && this.data.editTx.currency === code)
    this.setData({ editCurrency: code, editCurrencyIndex: idx, editSymbol: getSymbol(code) })
    await this._updateEditConvert(sameAsRecord)
  },

  // ── 资金账户 ──
  // 当前账本可用账户（未归档）。首页记账/编辑弹窗与账目展示共用这一份。
  async loadAccounts() {
    const ledger = app.globalData.currentLedger
    if (!ledger || !ledger.id) { this.setData({ accounts: [] }); return [] }
    const { data } = await supabase.from('accounts')
      .select('*').eq('ledger_id', ledger.id).eq('is_archived', false).order('sort_order')
    const accounts = data || []
    this.setData({ accounts })
    return accounts
  },
  // 默认转出账户：现金优先
  _defaultFromIndex(accounts) {
    if (!accounts || !accounts.length) return 0
    const i = accounts.findIndex(a => a.kind_code === 'cash')
    return i >= 0 ? i : 0
  },
  // 默认转入账户：信用卡等负债账户优先
  _defaultToIndex(accounts) {
    if (!accounts || !accounts.length) return 0
    const i = accounts.findIndex(a => a.kind === 'liability')
    return i >= 0 ? i : (accounts.length > 1 ? 1 : 0)
  },
  // 由账户 id 反查选择器下标
  _accountIndexOf(id) {
    if (!id) return 0
    const accounts = this.data.accounts || []
    const i = accounts.findIndex(a => a.id === id)
    return i >= 0 ? i : 0
  },
  goAccounts() {
    if (this.requireLogin('管理账户')) wx.navigateTo({ url: '/pages/accounts/accounts' })
  },

  // 借款明细在分析页的「借款」视图里看。
  // 分析页是 tabBar 页面，switchTab 不能带 query，用 globalData 传递意图。
  goLoanAnalytics() {
    if (this.requireLogin('查看借款明细')) return
    app.globalData.analyticsPendingTab = 'loan'
    wx.switchTab({ url: '/pages/analytics/analytics' })
  },

  // ── 记账弹窗 ──
  openQuickAdd() {
    // 游客也可以打开记账弹窗浏览，保存时才检查登录
    this.updateCurrentCats('expense')  // 每次打开弹窗按最新频次排序
    const base = this.data.baseCurrency
    const baseIdx = CURRENCY_CODES.indexOf(base)
    const accounts = this.data.accounts || []
    this.setData({
      showQuickAdd: true, qaType: 'expense', qaAmount: '', qaCategory: '', qaNote: '',
      qaDate: bjToday(),
      qaExpandedKey: null, subCats: [], qaPaymentMethod: 'cash', qaReimbursable: false,
      qaIsLoan: false, qaCounterparty: '',
      qaVehicles: [], qaVehicleIndex: 0, qaFuelLiters: '', qaOdometer: '',
      qaCurrency: base, qaCurrencyIndex: baseIdx < 0 ? 0 : baseIdx,
      qaSymbol: getSymbol(base), qaRate: 1, qaConvertHint: '', qaRateWarn: false,
      qaAccountIndex: this._defaultFromIndex(accounts),
      qaToAccountIndex: this._defaultToIndex(accounts),
    })
    this.loadVehicles()
    // 首次进入时账户可能尚未加载，异步补齐后同步选中项
    if (!accounts.length) {
      this.loadAccounts().then(list => {
        if (!this.data.showQuickAdd) return
        this.setData({
          qaAccountIndex: this._defaultFromIndex(list),
          qaToAccountIndex: this._defaultToIndex(list),
        })
      })
    }
  },
  closeQuickAdd() { this.setData({ showQuickAdd: false }) },
  setQaType(e) {
    const type = e.currentTarget.dataset.type
    const base = this.data.baseCurrency
    const patch = {
      qaType: type, qaCategory: '', qaExpandedKey: null, subCats: [], qaFuelLiters: '', qaOdometer: '',
    }
    // 转账是账户间划转，统一按本位币计价：无需分类、汇率换算与报销
    if (type === 'transfer') {
      Object.assign(patch, {
        qaCurrency: base, qaCurrencyIndex: Math.max(0, CURRENCY_CODES.indexOf(base)),
        qaSymbol: getSymbol(base), qaRate: 1, qaConvertHint: '', qaRateWarn: false, qaReimbursable: false,
        // 转账不是借款，切换时必须把借款状态清掉
        qaIsLoan: false, qaCounterparty: '',
      })
    } else if (this.data.qaIsLoan) {
      // 借款状态下切收支方向：分类跟着变成「借出 / 借入」
      patch.qaCategory = type === 'expense' ? LOAN_OUT_CAT : LOAN_IN_CAT
    }
    this.setData(patch)
    if (type !== 'transfer') this.updateCurrentCats(type)
  },

  // ── 借款开关（022）──
  // 支出方向 = 借出（对方欠我），收入方向 = 借入（我欠对方）
  onQaLoanTap() {
    const next = !this.data.qaIsLoan
    const type = this.data.qaType
    this.setData({
      qaIsLoan: next,
      qaCounterparty: next ? this.data.qaCounterparty : '',
      // 借款没有消费分类，用「借出 / 借入」占位，让列表与导出仍有可读分类名
      qaCategory: next ? (type === 'expense' ? LOAN_OUT_CAT : LOAN_IN_CAT) : '',
      qaReimbursable: next ? false : this.data.qaReimbursable,
      qaExpandedKey: null, subCats: [], qaSubExpandedKey: null, subSubCats: [],
    })
  },
  onQaLoanPartyInput(e) { this.setData({ qaCounterparty: e.detail.value }) },
  pickLoanParty(e) { this.setData({ qaCounterparty: e.currentTarget.dataset.name }) },
  onAmountInput(e) {
    this.setData({ qaAmount: e.detail.value })
    // 外币记账时实时刷新「≈本位币」预览
    if (this.data.qaCurrency !== this.data.baseCurrency) this._updateQaConvert()
  },
  onNoteInput(e)   { this.setData({ qaNote: e.detail.value }) },
  onQaDateChange(e) { this.setData({ qaDate: e.detail.value }) },
  onQaReimburseTap() { this.setData({ qaReimbursable: !this.data.qaReimbursable }) },
  onQaPaymentChange(e) { this.setData({ qaPaymentMethod: e.currentTarget.dataset.id }) },
  // 资金账户选择（转账时分别选转出 / 转入）
  onQaAccountChange(e) { this.setData({ qaAccountIndex: Number(e.detail.value) }) },
  onQaToAccountChange(e) { this.setData({ qaToAccountIndex: Number(e.detail.value) }) },
  swapQaAccounts() {
    this.setData({ qaAccountIndex: this.data.qaToAccountIndex, qaToAccountIndex: this.data.qaAccountIndex })
  },
  // 油耗输入
  onQaFuelLitersInput(e) { this.setData({ qaFuelLiters: e.detail.value }) },
  onQaOdometerInput(e) { this.setData({ qaOdometer: e.detail.value }) },
  onQaVehicleChange(e) { this.setData({ qaVehicleIndex: Number(e.detail.value) }) },
  // 添加车辆（轻量：wx.showModal editable 输入车名）
  addVehicle() {
    const ledger = app.globalData.currentLedger
    if (!ledger || !ledger.id) return
    wx.showModal({
      title: '添加车辆',
      editable: true,
      placeholderText: '输入车辆名称（如：我的车）',
      success: async (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) return wx.showToast({ title: '车辆名不能为空', icon: 'none' })
        const { error } = await supabase.from('vehicles').insert([{ ledger_id: ledger.id, name }])
        if (error) return wx.showToast({ title: error.message || '添加失败', icon: 'none' })
        wx.showToast({ title: '已添加', icon: 'success' })
        this.loadVehicles()
        if (this.data.showEdit) this.loadVehiclesForEdit()
      }
    })
  },

  // 加载当前账本的车辆列表
  async loadVehicles() {
    const ledger = app.globalData.currentLedger
    if (!ledger || !ledger.id) return
    const { data } = await supabase.from('vehicles').select('id,name').eq('ledger_id', ledger.id).order('created_at')
    this.setData({ qaVehicles: data || [] })
  },

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

  // 判断分类是否为「油费」（叶子分类名）
  isFuelCategory(category) {
    return category === '油费'
  },

  // 计算油耗（L/100km）：本次升数 / (本次里程 - 上次里程) * 100
  // excludeId：编辑时排除当前记录自身
  // 返回 { consumption, lastOdometer } 或 null（无法计算）
  async calcFuelConsumption(vehicleId, odometer, liters, excludeId) {
    const ledger = app.globalData.currentLedger
    if (!ledger || !ledger.id) return null
    // 查该车辆上一次加油记录（有里程的）
    let q = supabase.from('transactions')
      .select('id,odometer,created_at')
      .eq('ledger_id', ledger.id)
      .eq('category', '油费')
      .notNull('odometer')
    if (vehicleId) q = q.eq('vehicle_id', vehicleId)
    if (excludeId) q = q.neq('id', excludeId)
    const { data } = await q.order('odometer', { ascending: false }).limit(1)
    const last = data && data[0]
    if (!last || last.odometer == null) return null
    const lastOdo = Number(last.odometer)
    const curOdo = Number(odometer)
    const curLiters = Number(liters)
    if (isNaN(lastOdo) || isNaN(curOdo) || isNaN(curLiters)) return null
    const dist = curOdo - lastOdo
    if (dist <= 0) return null  // 里程未增加，无法计算
    const consumption = (curLiters / dist) * 100
    return { consumption: Math.round(consumption * 100) / 100, lastOdometer: lastOdo }
  },

  async handleQuickAdd() {
    // 游客点保存时检查登录
    if (!this.requireLogin('保存')) return
    const { currentLedger, user, qaType, qaAmount, qaCategory, qaNote, qaDate, qaPaymentMethod, qaReimbursable,
      qaVehicles, qaVehicleIndex, qaFuelLiters, qaOdometer, qaCurrency, accounts,
      qaAccountIndex, qaToAccountIndex, qaIsLoan, qaCounterparty } = this.data

    // ── 转账：账户间划转，既不是收入也不是支出，不参与收支 / 预算 / 分析 ──
    if (qaType === 'transfer') {
      const transferAmt = parseFloat(qaAmount)
      if (!(transferAmt > 0)) return wx.showToast({ title: '请输入转账金额', icon: 'none' })
      const fromAcc = accounts[qaAccountIndex]
      const toAcc = accounts[qaToAccountIndex]
      const accErr = validateTransfer(fromAcc && fromAcc.id, toAcc && toAcc.id)
      if (accErr) return wx.showToast({ title: accErr, icon: 'none' })
      this.setData({ qaLoading: true })
      try {
        const record = {
          ledger_id: currentLedger.id, user_id: user.id,
          amount: round2(transferAmt), type: 'transfer',
          currency: this.data.baseCurrency, exchange_rate: 1,
          base_amount: round2(transferAmt), reference_amount: round2(transferAmt),
          settlement_status: SETTLE_SETTLED, settled_at: new Date().toISOString(),
          account_id: fromAcc.id, to_account_id: toAcc.id,
          category: '转账', note: qaNote, date: qaDate,
          payment_method: null,
        }
        const { error } = await supabase.from('transactions').insert([record])
        if (error) throw new Error(error.message)
        this.setData({ showQuickAdd: false })
        wx.showToast({ title: `已转账：${fromAcc.name} → ${toAcc.name}`, icon: 'success', duration: 2500 })
        this.loadData()
      } catch (e) {
        wx.showToast({ title: e.message || '转账失败', icon: 'none' })
      } finally {
        this.setData({ qaLoading: false })
      }
      return
    }

    if (!qaAmount || !qaCategory) return wx.showToast({ title: '请填写金额并选择分类', icon: 'none' })
    // 借款必须填对方，否则欠款无法按人汇总
    if (qaIsLoan && !String(qaCounterparty || '').trim()) {
      return wx.showToast({ title: qaType === 'expense' ? '请填写借给谁' : '请填写向谁借', icon: 'none' })
    }

    const baseCurrency = this.data.baseCurrency
    const isForeign = qaCurrency !== baseCurrency
    // 外币只用参考汇率估算提示值：取不到也不阻断记账，
    // 因为本位币金额本就留待「结算」时按银行实际扣款填写
    let rate = 1
    if (isForeign) {
      await this._ensureRateMap()
      rate = this._rateOf(qaCurrency)
    }
    const amountNum = parseFloat(qaAmount)

    this.setData({ qaLoading: true })
    try {
      const record = {
        ledger_id: currentLedger.id, user_id: user.id,
        amount: amountNum, type: qaType,
        currency: qaCurrency,
        category: qaCategory, note: qaNote, date: qaDate,
        payment_method: qaPaymentMethod,
        // 资金账户：钱从哪个账户出/进
        account_id: accounts[qaAccountIndex] ? accounts[qaAccountIndex].id : null,
      }
      if (qaIsLoan) {
        // 借款金额是确定的（借多少就是多少），不存在「银行最终扣多少」的问题，
        // 所以外币也不进待结算，当场按记账时汇率换算并结算，
        // 否则这笔借款会因为 base_amount 为空而被所有汇总漏掉。
        const loanBase = isForeign ? convertToBase(amountNum, rate) : round2(amountNum)
        record.exchange_rate = isForeign ? rate : 1
        record.reference_amount = loanBase
        record.base_amount = loanBase
        record.settlement_status = SETTLE_SETTLED
        record.settled_at = new Date().toISOString()
        record.is_loan = true
        record.loan_counterparty = String(qaCounterparty || '').trim()
      } else if (isForeign) {
        // 境外消费：刷的是外币、还的是人民币，银行入账后才知道实际扣多少。
        // 因此 base_amount 留空并置为「待结算」——不计入任何汇总，
        // 避免用市场参考汇率硬算出一个对不上账单的金额。
        record.exchange_rate = rate
        record.reference_amount = this._rateAvailable(qaCurrency) ? convertToBase(amountNum, rate) : null
        record.base_amount = null
        record.settlement_status = SETTLE_PENDING
      } else {
        // 本位币记账：金额当场确定，直接结算
        record.exchange_rate = 1
        record.reference_amount = round2(amountNum)
        record.base_amount = round2(amountNum)
        record.settlement_status = SETTLE_SETTLED
        record.settled_at = new Date().toISOString()
      }
      if (qaType === 'expense' && qaReimbursable && !qaIsLoan) {
        record.is_reimbursable = true
        record.reimbursement_status = 'pending'
      }
      // 油费：附加升数/里程/车辆，并自动算油耗
      let fuelConsumption = null
      let calcNote = ''
      if (qaType === 'expense' && this.isFuelCategory(qaCategory)) {
        const vehicleId = qaVehicles[qaVehicleIndex] ? qaVehicles[qaVehicleIndex].id : null
        if (vehicleId) record.vehicle_id = vehicleId
        if (qaFuelLiters !== '' && qaFuelLiters != null) record.fuel_liters = Number(qaFuelLiters)
        if (qaOdometer !== '' && qaOdometer != null) record.odometer = Number(qaOdometer)
        // 只有升数和里程都填了才尝试计算
        if (record.fuel_liters != null && record.odometer != null) {
          const calc = await this.calcFuelConsumption(vehicleId, record.odometer, record.fuel_liters)
          if (calc) {
            record.fuel_consumption = calc.consumption
            fuelConsumption = calc.consumption
          } else {
            calcNote = '（首次加油，下次加油后自动算油耗）'
          }
        }
      }
      const { error } = await supabase.from('transactions').insert([record])
      if (error) throw new Error(error.message)
      this.setData({ showQuickAdd: false })
      if (qaIsLoan) {
        const party = String(qaCounterparty || '').trim()
        wx.showToast({
          title: qaType === 'expense' ? `已记：借给 ${party}` : `已记：向 ${party} 借入`,
          icon: 'none', duration: 2500,
        })
      } else if (isForeign) {
        wx.showToast({ title: '已记为待结算，银行入账后点「编辑」填实际扣款', icon: 'none', duration: 3000 })
      } else if (fuelConsumption != null) {
        wx.showToast({ title: `记账成功，油耗 ${fuelConsumption}L/100km`, icon: 'none', duration: 2500 })
      } else {
        wx.showToast({ title: '记账成功' + calcNote, icon: 'success', duration: 2500 })
      }
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
      editIsLoan: isLoan(tx), editCounterparty: counterpartyOf(tx),
      editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [],
      editVehicles: [], editVehicleIndex: 0,
      editFuelLiters: tx.fuel_liters != null ? String(tx.fuel_liters) : '',
      editOdometer: tx.odometer != null ? String(tx.odometer) : '',
      editAccountIndex: this._accountIndexOf(tx.account_id),
      editToAccountIndex: this._accountIndexOf(tx.to_account_id),
      ...this._editCurrencyFields(tx),
    })
    // 加载车辆并回填车辆选中项
    this.loadVehiclesForEdit(tx.vehicle_id)
    this._updateEditConvert(true)   // 回显「记账时汇率」
  },
  // 加载车辆用于编辑弹窗
  async loadVehiclesForEdit(vehicleId) {
    const ledger = app.globalData.currentLedger
    if (!ledger || !ledger.id) return
    const { data } = await supabase.from('vehicles').select('id,name').eq('ledger_id', ledger.id).order('created_at')
    const vehicles = data || []
    const idx = vehicleId ? vehicles.findIndex(v => v.id === vehicleId) : -1
    this.setData({ editVehicles: vehicles, editVehicleIndex: idx >= 0 ? idx : 0 })
  },
  closeEdit() { this.setData({ showEdit: false }) },
  setEditType(e) {
    const type = e.currentTarget.dataset.type
    const editCats = this.data.catTree.filter(c=>c.type===type)
    const patch = { editType: type, editCategory: '', editCats, editPaymentMethod: 'cash',
      editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [] }
    if (type === 'transfer') {
      // 切到转账：本位币计价，清掉结算区、报销与换算提示
      Object.assign(patch, {
        editCurrency: this.data.baseCurrency, editSymbol: this.data.baseSymbol,
        editRate: 1, editConvertHint: '', editRateWarn: false,
        editIsPending: false, settleAmount: '', editReimbursable: false,
        editIsLoan: false, editCounterparty: '',
      })
    } else if (this.data.editTx) {
      // 从转账切回收支：按原币种状态回显
      Object.assign(patch, this._editCurrencyFields(this.data.editTx))
    }
    // 借款状态下切收支方向，分类跟着变「借出 / 借入」
    if (type !== 'transfer' && this.data.editIsLoan) {
      patch.editCategory = type === 'expense' ? LOAN_OUT_CAT : LOAN_IN_CAT
    }
    this.setData(patch)
  },
  onEditAmountInput(e) {
    this.setData({ editAmount: e.detail.value })
    if (this.data.editCurrency !== this.data.baseCurrency) this._updateEditConvert(true)
  },
  // 结算校正：银行实际扣款金额（本位币）
  onSettleAmountInput(e) { this.setData({ settleAmount: e.detail.value }) },
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
  // 资金账户选择（编辑 / 转账）
  onEditAccountChange(e) { this.setData({ editAccountIndex: Number(e.detail.value) }) },
  onEditToAccountChange(e) { this.setData({ editToAccountIndex: Number(e.detail.value) }) },
  swapEditAccounts() {
    this.setData({ editAccountIndex: this.data.editToAccountIndex, editToAccountIndex: this.data.editAccountIndex })
  },
  onEditReimburseTap() { this.setData({ editReimbursable: !this.data.editReimbursable }) },
  // 借款开关（编辑）
  onEditLoanTap() {
    const next = !this.data.editIsLoan
    const type = this.data.editType
    this.setData({
      editIsLoan: next,
      editCounterparty: next ? this.data.editCounterparty : '',
      editCategory: next ? (type === 'expense' ? LOAN_OUT_CAT : LOAN_IN_CAT) : '',
      editReimbursable: next ? false : this.data.editReimbursable,
      editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [],
    })
  },
  onEditLoanPartyInput(e) { this.setData({ editCounterparty: e.detail.value }) },
  // 编辑油耗输入
  onEditFuelLitersInput(e) { this.setData({ editFuelLiters: e.detail.value }) },
  onEditOdometerInput(e) { this.setData({ editOdometer: e.detail.value }) },
  onEditVehicleChange(e) { this.setData({ editVehicleIndex: Number(e.detail.value) }) },

  async handleEdit() {
    const { editTx, editType, editAmount, editCategory, editNote, editDate, editPaymentMethod, editReimbursable,
      editVehicles, editVehicleIndex, editFuelLiters, editOdometer, editCurrency,
      accounts, editAccountIndex, editToAccountIndex, editIsLoan, editCounterparty } = this.data

    // ── 转账：账户间划转，不涉及分类 / 支付方式 / 报销 / 汇率 ──
    if (editType === 'transfer') {
      const transferAmt = parseFloat(editAmount)
      if (!(transferAmt > 0)) return wx.showToast({ title: '请输入转账金额', icon: 'none' })
      const fromAcc = accounts[editAccountIndex]
      const toAcc = accounts[editToAccountIndex]
      const accErr = validateTransfer(fromAcc && fromAcc.id, toAcc && toAcc.id)
      if (accErr) return wx.showToast({ title: accErr, icon: 'none' })
      this.setData({ editLoading: true })
      try {
        const update = {
          type: 'transfer', amount: round2(transferAmt),
          currency: this.data.baseCurrency, exchange_rate: 1,
          base_amount: round2(transferAmt), reference_amount: round2(transferAmt),
          settlement_status: SETTLE_SETTLED, settled_at: new Date().toISOString(),
          account_id: fromAcc.id, to_account_id: toAcc.id,
          category: '转账', note: editNote, date: editDate,
          payment_method: null,
          is_reimbursable: false, reimbursement_status: null,
        }
        const { error } = await supabase.from('transactions').update(update).eq('id', editTx.id)
        if (error) throw new Error(error.message)
        this.setData({ showEdit: false })
        wx.showToast({ title: '转账已更新', icon: 'success' })
        this.loadData()
      } catch (e) {
        wx.showToast({ title: e.message || '保存失败', icon: 'none' })
      } finally {
        this.setData({ editLoading: false })
      }
      return
    }

    if (!editAmount || !editCategory) return wx.showToast({ title: '请填写金额并选择分类', icon: 'none' })
    if (editIsLoan && !String(editCounterparty || '').trim()) {
      return wx.showToast({ title: editType === 'expense' ? '请填写借给谁' : '请填写向谁借', icon: 'none' })
    }

    const baseCurrency = this.data.baseCurrency
    const amountNum = parseFloat(editAmount)
    const isForeign = editCurrency !== baseCurrency

    // 结算校正：待结算交易由用户填入银行实际扣款（本位币）后才写 base_amount
    const settleRaw = this.data.settleAmount
    const settleNum = parseFloat(settleRaw)
    const hasSettle = settleRaw !== '' && settleRaw != null && !isNaN(settleNum) && settleNum >= 0

    const wasPending = isPending(editTx)
    const prevCurrency = (editTx && editTx.currency) || baseCurrency
    const currencyChanged = prevCurrency !== editCurrency
    // 本次是否需要进入/保持「待结算」：仍是外币且用户没填实际扣款
    const becomesPending = isForeign && !hasSettle && (wasPending || currencyChanged)

    // 外币才需要汇率表（用于估算参考值）；待结算不写 base_amount，取不到也不阻断
    let rate = 1
    let referenceAmount = null
    if (isForeign) {
      await this._ensureRateMap()
      rate = this._rateOf(editCurrency)
      referenceAmount = this._rateAvailable(editCurrency) ? convertToBase(amountNum, rate) : null
    }

    this.setData({ editLoading: true })
    try {
      const update = {
        type: editType, amount: amountNum,
        currency: editCurrency,
        category: editCategory, note: editNote, date: editDate,
        payment_method: editPaymentMethod,
        account_id: accounts[editAccountIndex] ? accounts[editAccountIndex].id : null,
        to_account_id: null,   // 收支账目不允许带转入账户（021 约束）
        // 借款标记：关掉开关时一并清空对方，避免留下脏数据
        is_loan: !!editIsLoan,
        loan_counterparty: editIsLoan ? String(editCounterparty || '').trim() : null,
      }

      if (editIsLoan) {
        // 借款金额确定，外币也立即结算（与新增逻辑一致），否则会被统计漏掉
        const loanBase = isForeign ? convertToBase(amountNum, rate) : round2(amountNum)
        update.exchange_rate = isForeign ? rate : 1
        update.reference_amount = loanBase
        update.base_amount = loanBase
        update.settlement_status = SETTLE_SETTLED
        update.settled_at = new Date().toISOString()
      } else if (!isForeign) {
        // ① 改成本位币记账：金额当场确定，直接结算
        update.exchange_rate = 1
        update.reference_amount = round2(amountNum)
        update.base_amount = round2(amountNum)
        update.settlement_status = SETTLE_SETTLED
        update.settled_at = new Date().toISOString()
      } else if (hasSettle) {
        // ② 结算：以银行实际扣款为准，并反算实际隐含汇率
        //    （这个汇率通常高于市场参考价，差额就是卡组织点差 + 货币转换费）
        update.exchange_rate = impliedRate(settleNum, amountNum)
        update.reference_amount = (this.data.editRefAmount != null)
          ? this.data.editRefAmount
          : referenceAmount
        update.base_amount = round2(settleNum)
        update.settlement_status = SETTLE_SETTLED
        update.settled_at = new Date().toISOString()
      } else if (becomesPending) {
        // ③ 外币且未填实际扣款：保持待结算，本位币金额留空（不计入汇总）
        update.exchange_rate = rate
        update.reference_amount = referenceAmount
        update.base_amount = null
        update.settlement_status = SETTLE_PENDING
        update.settled_at = null
      } else {
        // ④ 已结算的外币账目、币种未变：沿用原隐含汇率，金额随输入等比调整
        const frozenRate = Number(editTx.exchange_rate) > 0 ? Number(editTx.exchange_rate) : rate
        update.exchange_rate = frozenRate
        update.base_amount = convertToBase(amountNum, frozenRate)
        update.settlement_status = SETTLE_SETTLED
      }
      if (editType === 'expense' && editReimbursable && !editIsLoan) {
        update.is_reimbursable = true
        if (!editTx.reimbursement_status) update.reimbursement_status = 'pending'
      } else if (!editReimbursable) {
        update.is_reimbursable = false
        update.reimbursement_status = null
      }
      // 油费：附加升数/里程/车辆，重算油耗
      let fuelConsumption = null
      let calcNote = ''
      if (editType === 'expense' && this.isFuelCategory(editCategory)) {
        const vehicleId = editVehicles[editVehicleIndex] ? editVehicles[editVehicleIndex].id : null
        update.vehicle_id = vehicleId
        update.fuel_liters = (editFuelLiters !== '' && editFuelLiters != null) ? Number(editFuelLiters) : null
        update.odometer = (editOdometer !== '' && editOdometer != null) ? Number(editOdometer) : null
        if (update.fuel_liters != null && update.odometer != null) {
          const calc = await this.calcFuelConsumption(vehicleId, update.odometer, update.fuel_liters, editTx.id)
          if (calc) {
            update.fuel_consumption = calc.consumption
            fuelConsumption = calc.consumption
          } else {
            calcNote = '（无法计算油耗）'
          }
        } else {
          update.fuel_consumption = null
        }
      } else {
        // 改成非油费分类：清空油耗字段
        update.vehicle_id = null
        update.fuel_liters = null
        update.odometer = null
        update.fuel_consumption = null
      }
      const { error } = await supabase.from('transactions').update(update).eq('id', editTx.id)
      if (error) throw new Error(error.message)
      this.setData({ showEdit: false })
      if (hasSettle) {
        wx.showToast({ title: '已按银行实际扣款结算', icon: 'success', duration: 2000 })
      } else if (becomesPending) {
        wx.showToast({ title: '仍为待结算，账单出来后再填实际扣款', icon: 'none', duration: 2500 })
      } else if (fuelConsumption != null) {
        wx.showToast({ title: `已保存，油耗 ${fuelConsumption}L/100km`, icon: 'none', duration: 2500 })
      } else {
        wx.showToast({ title: '修改成功' + calcNote, icon: 'success', duration: 2500 })
      }
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

  // 判断一条账目是否命中当前筛选
  _matchListFilter(t) {
    const { showPendingOnly, showReimbursableOnly, showLoanOnly } = this.data
    if (showPendingOnly && !t.isPending) return false
    if (showReimbursableOnly && !(t.is_reimbursable && t.reimbursement_status === 'pending')) return false
    if (showLoanOnly && !t.isLoan) return false
    return true
  },

  // 按筛选取出要展示的「天」。只挑分组、不改 group.items ——
  // items 仍是原数组，wx:for 的 index 与 dailyGroups 对齐，
  // onEditTap / onDeleteTap 用 data-index 定位账目才不会错位。
  _applyListFilters() {
    const { dailyGroups = [], showPendingOnly, showReimbursableOnly, showLoanOnly } = this.data
    if (!showPendingOnly && !showReimbursableOnly && !showLoanOnly) {
      const displayCount = dailyGroups.reduce((s, g) => s + ((g.items || []).length), 0)
      this.setData({ displayGroups: dailyGroups, listFiltered: false, displayCount })
      return
    }
    let displayCount = 0
    const displayGroups = dailyGroups.filter(g => {
      const hit = (g.items || []).filter(t => this._matchListFilter(t)).length
      displayCount += hit
      return hit > 0
    })
    this.setData({ displayGroups, listFiltered: true, displayCount })
  },

  // 退出所有列表筛选（空结果时的「显示全部」）
  clearListFilter() {
    this.setData(
      { showPendingOnly: false, showReimbursableOnly: false, showLoanOnly: false },
      () => this._applyListFilters()
    )
  },

  toggleReimbursableFilter() {
    const next = !this.data.showReimbursableOnly
    this.setData({
      showReimbursableOnly: next,
      showPendingOnly: next ? false : this.data.showPendingOnly,
      showLoanOnly: next ? false : this.data.showLoanOnly,
    }, () => this._applyListFilters())
  },

  // 只看待结算账目（外币消费等待银行入账）
  togglePendingFilter() {
    if (!this.data.showPendingOnly && this.data.pendingCount === 0) {
      wx.showToast({ title: '本月没有待结算账目', icon: 'none' })
      return
    }
    const next = !this.data.showPendingOnly
    this.setData({
      showPendingOnly: next,
      showReimbursableOnly: next ? false : this.data.showReimbursableOnly,
      showLoanOnly: next ? false : this.data.showLoanOnly,
    }, () => this._applyListFilters())
  },

  // 只看借款账目（借出 / 借入）
  toggleLoanFilter() {
    if (!this.data.showLoanOnly && !(this.data.transactions || []).some(t => t.isLoan)) {
      wx.showToast({ title: '本月没有借款账目', icon: 'none' })
      return
    }
    const next = !this.data.showLoanOnly
    this.setData({
      showLoanOnly: next,
      showPendingOnly: next ? false : this.data.showPendingOnly,
      showReimbursableOnly: next ? false : this.data.showReimbursableOnly,
    }, () => this._applyListFilters())
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
    const totalAmount = pending.reduce((s, t) => s + baseAmountOf(t), 0)
    wx.showModal({
      title: '月度核销',
      content: `共 ${pending.length} 笔待报销，合计 ${formatMoney(totalAmount, this.data.baseCurrency)}\n确认全部核销为已到账？`,
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
          const exportBase = this.data.baseCurrency
          // 资金账户名映射（用已加载的账户列表，无需额外请求）
          const accMap = {}
          ;(this.data.accounts || []).forEach(a => { accMap[a.id] = a.name })
          const rows = [[
            '日期', '时间', '类型', '币种', '金额(原币)', '汇率', '金额(本位币)', '结算状态',
            '类别', '子类别', '备注', '支付方式', '资金账户', '转入账户', '借款', '借款对方', '记账人'
          ]]
          data.forEach(t => {
            rows.push([
              t.date || '', t.created_at ? (() => { const parts = t.created_at.split('T')[1].split(':').map(Number); return String((parts[0] + 8) % 24).padStart(2, '0') + ':' + String(parts[1] || 0).padStart(2, '0') })() : '',
              t.type === 'transfer' ? '转账' : (t.type === 'income' ? '收入' : '支出'),
              currencyOf(t, exportBase),
              formatNumber(t.amount),
              t.exchange_rate != null ? t.exchange_rate : 1,
              // 待结算：本位币金额未确定，留空不写 0
              isPending(t) ? '' : formatNumber(baseAmountOf(t)),
              isPending(t) ? '待结算' : '已结算',
              t.category || '', t.sub_category || '',
              (t.note || '').replace(/"/g, '""'),
              PM_MAP[t.payment_method] || t.payment_method || '',
              accMap[t.account_id] || '',
              accMap[t.to_account_id] || '',
              t.is_loan === true ? '借款' : '',
              t.is_loan === true ? (t.loan_counterparty || '') : '',
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
