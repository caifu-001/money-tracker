// pages/home/home.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { initDefaultCategories } = require('../../utils/categories')

const PAYMENT_METHODS = [
  { id: 'cash',    name: '现金',    icon: '💵' },
  { id: 'wechat',  name: '微信',    icon: '💚' },
  { id: 'alipay',  name: '支付宝',  icon: '💙' },
  { id: 'bankcard',name: '银行卡',  icon: '💳' },
]

Page({
  data: {
    user: null, 
    isGuest: true,  // 游客模式标记
    // 微信一键注册
    wechatOpenid: '',
    showWechatRegister: false,
    agreedPrivacy: false,
    loading: false,
    currentLedger: null,
    transactions: [], loading: true,
    totalIncome: '0.00', totalExpense: '0.00', balance: '0.00',
    monthLabel: '',
    paymentMethods: PAYMENT_METHODS,
    // 记账弹窗
    showQuickAdd: false,
    qaType: 'expense', qaAmount: '', qaCategory: '', qaNote: '', qaDate: '', qaLoading: false,
    qaExpandedKey: null, subCats: [], qaSubExpandedKey: null, subSubCats: [],
    currentCats: [],
    qaPaymentMethod: 'cash',
    // 编辑弹窗
    showEdit: false, editTx: null,
    editType: 'expense', editAmount: '', editCategory: '', editNote: '', editDate: '', editLoading: false,
    editCats: [],
    editExpandedKey: null, editSubCats: [], editSubExpandedKey: null, editSubSubCats: [],
    editPaymentMethod: 'cash',
    // 类别树
    catTree: [],
    // 创建账本
    showCreateLedger: false,
    newLedgerName: '',
    creatingLedger: false,
  },

  onLoad() {
    // 游客模式下，首页直接发起微信静默登录
    const user = app.globalData.user
    if (!user) {
      this.tryWechatLogin()
    }
    const ledger = app.globalData.currentLedger
    const now = new Date()
    
    this.setData({
      user: user || null,
      isGuest: !user,  // 无 user 就是游客
      currentLedger: ledger || { id: null, name: '暂无账本' },
      monthLabel: `${now.getFullYear()}年${now.getMonth()+1}月`,
      showCreateLedger: !ledger && user  // 已登录但无账本时显示创建界面
    })
    
    if (user && ledger) {
      this.loadData()
      this.loadCatTree()
    } else {
      this.setData({ loading: false })
    }
  },

  onShow() {
    // 每次显示时刷新用户状态（可能从登录页返回）
    const user = app.globalData.user
    const ledger = app.globalData.currentLedger
    
    this.setData({
      user: user || null,
      isGuest: !user
    })
    
    if (!user) {
      this.setData({ loading: false, currentLedger: { id: null, name: '暂无账本' }, showCreateLedger: false })
      return
    }
    
    if (!ledger) {
      this.setData({ currentLedger: { id: null, name: '暂无账本' }, showCreateLedger: true })
      return
    }
    
    const prevId = this.data.currentLedger ? this.data.currentLedger.id : null
    if (ledger.id !== prevId) {
      this.setData({ currentLedger: ledger, showCreateLedger: false })
    }
    this.loadData()
    this.loadCatTree()
  },

  // 游客点击登录（邮箱方式）
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
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
    const now = new Date()
    const start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const end = now.toISOString().split('T')[0]
    let q = supabase.from('transactions').select('*').eq('ledger_id', currentLedger.id).gte('date', start).lte('date', end)
    if (user.role !== 'admin') q = q.eq('user_id', user.id)
    q = q.order('date', { ascending: false }).order('created_at', { ascending: false })
    const { data } = await q

    const PM_DISPLAY = { cash:'现金', wechat:'微信', alipay:'支付宝', bankcard:'银行卡', other:'其他' }
    const txs = (data || []).map(t => ({
      ...t,
      amountStr: Number(t.amount).toFixed(2),
      categoryIcon: t.category.match(/\p{Emoji}/u) && t.category.match(/\p{Emoji}/u)[0] || (t.type==='income'?'💰':'💸'),
      dateLabel: this.formatDate(t.date, t.created_at),
      canEdit: user.role === 'admin' || t.user_id === user.id,
      paymentDisplay: PM_DISPLAY[t.payment_method] || '现金'
    }))
    const totalIncome  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
    const totalExpense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
    this.setData({
      transactions: txs, loading: false,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      balance: (totalIncome - totalExpense).toFixed(2)
    })
  },

  async loadCatTree() {
    const { currentLedger } = this.data
    if (!currentLedger || !currentLedger.id) return
    const { data } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
      .eq('ledger_id', currentLedger.id).order('level').order('name')

    if (!data || data.length === 0) {
      const { initDefaultCategories } = require('../../utils/categories')
      await initDefaultCategories(supabase, currentLedger.id)
      const { data: fresh } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
        .eq('ledger_id', currentLedger.id).order('level').order('name')
      this.buildTree(fresh || [])
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
      this.buildTree(fresh || [])
      return
    }

    this.buildTree(data)
  },

  buildTree(data) {
    const map = {}; const roots = []
    ;(data||[]).forEach(c => { map[c.id] = {...c, children: []} })
    ;(data||[]).forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id])
      else if (!c.parent_id) roots.push(map[c.id])
    })
    this.setData({ catTree: roots })
    this.updateCurrentCats('expense')
  },

  updateCurrentCats(type) {
    const cats = this.data.catTree.filter(c=>c.type===type).map(c=>({...c, hasChildren: c.children&&c.children.length>0}))
    this.setData({ currentCats: cats })
  },

  formatDate(dateStr, createdAt) {
    const d = new Date(dateStr)
    const t = new Date(createdAt)
    const h = String(t.getHours()).padStart(2, '0')
    const m = String(t.getMinutes()).padStart(2, '0')
    return `${d.getMonth()+1}月${d.getDate()}日 ${h}:${m}`
  },

  // ── 记账弹窗 ──
  openQuickAdd() {
    if (!this.requireLogin('记账')) return  // 检查登录
    this.setData({
      showQuickAdd: true, qaType: 'expense', qaAmount: '', qaCategory: '', qaNote: '',
      qaDate: new Date().toISOString().split('T')[0],
      qaExpandedKey: null, subCats: [], qaPaymentMethod: 'cash'
    })
    this.updateCurrentCats('expense')
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
    const { currentLedger, user, qaType, qaAmount, qaCategory, qaNote, qaDate, qaPaymentMethod } = this.data
    if (!qaAmount || !qaCategory) return wx.showToast({ title: '请填写金额并选择分类', icon: 'none' })
    this.setData({ qaLoading: true })
    try {
      const { error } = await supabase.from('transactions').insert([{
        ledger_id: currentLedger.id, user_id: user.id,
        amount: parseFloat(qaAmount), type: qaType,
        category: qaCategory, note: qaNote, date: qaDate,
        payment_method: qaPaymentMethod
      }])
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
    const tx = this.data.transactions[e.currentTarget.dataset.index]
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

  async handleEdit() {
    const { editTx, editType, editAmount, editCategory, editNote, editDate, editPaymentMethod } = this.data
    if (!editAmount || !editCategory) return wx.showToast({ title: '请填写金额并选择分类', icon: 'none' })
    this.setData({ editLoading: true })
    try {
      const { error } = await supabase.from('transactions').update({
        type: editType, amount: parseFloat(editAmount),
        category: editCategory, note: editNote, date: editDate,
        payment_method: editPaymentMethod
      }).eq('id', editTx.id)
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
      this.setData({ showCreateLedger: false, currentLedger: ledger })
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
              t.date || '', t.created_at ? t.created_at.slice(11, 16) : '',
              t.type === 'income' ? '收入' : '支出', t.amount || '0',
              t.category || '', t.sub_category || '',
              (t.note || '').replace(/"/g, '""'),
              PM_MAP[t.payment_method] || t.payment_method || '',
              t.users ? t.users.name : ''
            ])
          })
          const csv = rows.map(r => r.map(c => '"' + c + '"').join(',')).join('\n')
          const fs = wx.getFileSystemManager()
          const fileName = `${currentLedger.name}_${new Date().toISOString().split('T')[0]}.csv`
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
