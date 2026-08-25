// pages/family/family.js
const app = getApp()
const { supabase } = require('../../utils/supabase')

Page({
  data: {
    loading: false,
    user: null,
    currentLedger: null,
    inviteCode: '',
    members: [],
    copied: false,
    // 加入账本
    showJoin: false,
    joinCode: '',
    joining: false,
    joinResult: null,  // { ok: bool, msg: string }
  },

  onLoad(options) {
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    this.setData({ user, currentLedger: app.globalData.currentLedger })
    this.loadData()
    // 如果从账本管理页通过"加入他人账本"进入，直接打开加入表单
    if (options && options.mode === 'join') {
      this.setData({ showJoin: true })
    }
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const { currentLedger } = app.globalData
    if (!currentLedger) {
      this.setData({ loading: false })
      return
    }
    this.setData({ loading: true, currentLedger })

    // 查询成员列表
    const { data: members, error } = await supabase.from('ledger_members')
      .select('id, role, users(id, name, email)')
      .eq('ledger_id', currentLedger.id)

    // 邀请码 = 账本ID前8位大写
    const inviteCode = currentLedger.id.replace(/-/g, '').substring(0, 8).toUpperCase()

    this.setData({
      members: members || [],
      inviteCode,
      loading: false
    })
  },

  copyCode() {
    const { inviteCode } = this.data
    wx.setClipboardData({
      data: inviteCode,
      success: () => {
        this.setData({ copied: true })
        wx.showToast({ title: '已复制', icon: 'success' })
        setTimeout(() => this.setData({ copied: false }), 2000)
      }
    })
  },

  // === 加入他人账本 ===
  toggleJoin() {
    this.setData({
      showJoin: !this.data.showJoin,
      joinCode: '',
      joinResult: null
    })
  },

  onJoinCodeInput(e) {
    this.setData({ joinCode: e.detail.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })
  },

  async handleJoin() {
    const { joinCode, user } = this.data
    if (!user?.id) {
      this.setData({ joinResult: { ok: false, msg: '请先登录' } })
      return
    }
    const code = joinCode.trim().toUpperCase().replace(/-/g, '')
    if (!code || code.length < 6) {
      this.setData({ joinResult: { ok: false, msg: '邀请码格式不正确（至少6位）' } })
      return
    }

    this.setData({ joining: true, joinResult: null })

    try {
      // 1. 查找匹配的账本
      console.log('[family] handleJoin code:', code)
      console.log('[family] user.id:', user.id)
      const { data: allLedgers, error: ledgersErr } = await supabase.from('ledgers').select('*')
      console.log('[family] allLedgers count:', allLedgers?.length, 'err:', ledgersErr)
      if (ledgersErr) throw new Error('查询账本失败：' + ledgersErr.message)

      const matched = (allLedgers || []).find(l => {
        const lid = l.id.replace(/-/g, '').toUpperCase()
        const match = lid.startsWith(code) || code.startsWith(lid.substring(0, 8))
        if (match) console.log('[family] matched ledger:', l.id, l.name)
        return match
      })

      if (!matched) {
        this.setData({ joinResult: { ok: false, msg: '邀请码无效，请确认后重试' }, joining: false })
        return
      }

      // 2. 检查是否已是成员
      const { data: existing, error: existingErr } = await supabase.from('ledger_members').select('id')
        .eq('ledger_id', matched.id).eq('user_id', user.id)
      console.log('[family] existing check:', existing, 'err:', existingErr)
      if (existingErr) throw new Error('检查成员失败：' + existingErr.message)
      if (existing && existing.length > 0) {
        this.setData({ joinResult: { ok: false, msg: '你已经是「' + matched.name + '」的成员了' }, joining: false })
        return
      }

      // 3. 加入账本
      console.log('[family] inserting with ledger_id:', matched.id, 'user_id:', user.id, 'role: editor')
      const { error: insertErr } = await supabase.from('ledger_members').insert([{
        ledger_id: matched.id,
        user_id: user.id,
        role: 'editor'
      }])
      console.log('[family] insert result error:', insertErr)

      if (insertErr) {
        const msg = insertErr.message || JSON.stringify(insertErr)
        console.error('[family] insert failed:', msg)
        this.setData({ joinResult: { ok: false, msg: '加入失败：' + msg }, joining: false })
        return
      }

      // 4. 成功 → 切换到该账本
      app.globalData.currentLedger = matched
      this.setData({
        joinResult: { ok: true, msg: '✅ 成功加入「' + matched.name + '」！' },
        joinCode: '',
        showJoin: false,
        currentLedger: matched,
        inviteCode: matched.id.replace(/-/g, '').substring(0, 8).toUpperCase()
      })
      this.loadData()
      wx.showToast({ title: '已加入账本', icon: 'success' })

    } catch (err) {
      console.error('[family] join exception:', err)
      this.setData({ joinResult: { ok: false, msg: '加入失败：' + (err.message || '未知错误') }, joining: false })
    }
  }
})
