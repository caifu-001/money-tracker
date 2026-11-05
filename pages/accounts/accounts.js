// pages/accounts/accounts.js - 资金账户管理（资产 / 负债）
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { resolveBaseCurrency, getSymbol, formatMoney } = require('../../utils/currency')
const {
  ACCOUNT_KIND_LIST, ACCOUNT_ICONS,
  computeBalances, summarize, groupByKind, accountById,
} = require('../../utils/accounts')

Page({
  data: {
    isGuest: false,
    loading: true,
    currentLedger: null,
    baseCurrency: 'CNY',
    baseSymbol: '¥',

    assets: [],
    liabilities: [],
    netWorthText: '0.00',
    totalAssetsText: '0.00',
    totalLiabilitiesText: '0.00',
    netWorthNegative: false,

    // 新增 / 编辑弹窗
    showModal: false,
    editingId: null,
    kindOptions: ACCOUNT_KIND_LIST,
    iconOptions: ACCOUNT_ICONS,
    form: {
      name: '', kind: 'asset', icon: '💵',
      initial_balance: '', card_tail: '',
    },
    saving: false,
  },

  onLoad() {
    const user = app.globalData.user
    this.setData({ isGuest: !user })
    if (user) this.loadData()
    else this.setData({ loading: false })
  },

  onShow() {
    const user = app.globalData.user
    this.setData({ isGuest: !user })
    if (user) this.loadData()
  },

  async loadData() {
    const ledger = app.globalData.currentLedger
    if (!ledger || !ledger.id) {
      this.setData({ loading: false })
      return
    }
    const baseCurrency = resolveBaseCurrency(ledger)
    const baseSymbol = getSymbol(baseCurrency)
    this.setData({ loading: true, currentLedger: ledger, baseCurrency, baseSymbol })

    try {
      const [accRes, txRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('ledger_id', ledger.id).order('sort_order'),
        supabase.from('transactions')
          .select('type,account_id,to_account_id,amount,currency,base_amount,settlement_status')
          .eq('ledger_id', ledger.id)
          .limit(5000),
      ])
      const accounts = accRes.data || []
      const txs = txRes.data || []

      // 余额一律本位币口径；待结算账目 baseAmountOf 为 0，天然不计入
      const withBal = computeBalances(accounts, txs)

      // 每账户关联账目数（用于删除前提示）
      const counts = {}
      txs.forEach(t => {
        if (t.account_id) counts[t.account_id] = (counts[t.account_id] || 0) + 1
        if (t.to_account_id) counts[t.to_account_id] = (counts[t.to_account_id] || 0) + 1
      })

      const decorated = withBal.map(a => ({
        ...a,
        balanceText: formatMoney(Math.abs(a.balance), baseCurrency, { symbol: false }),
        negative: Number(a.balance) < 0,
        txCount: counts[a.id] || 0,
      }))

      const grouped = groupByKind(decorated)
      const sum = summarize(withBal)

      this.setData({
        assets: grouped.assets,
        liabilities: grouped.liabilities,
        netWorthText: formatMoney(Math.abs(sum.netWorth), baseCurrency, { symbol: false }),
        totalAssetsText: formatMoney(sum.totalAssets, baseCurrency, { symbol: false }),
        totalLiabilitiesText: formatMoney(sum.totalLiabilities, baseCurrency, { symbol: false }),
        netWorthNegative: sum.netWorth < 0,
        loading: false,
      })
    } catch (e) {
      console.error('[accounts] loadData failed:', e)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请检查 021 迁移是否已执行', icon: 'none', duration: 3000 })
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  // ── 弹窗 ──
  openAdd(e) {
    const kind = (e && e.currentTarget.dataset.kind) || 'asset'
    this.setData({
      showModal: true, editingId: null,
      form: {
        name: '', kind,
        icon: kind === 'liability' ? '💳' : '💵',
        initial_balance: '', card_tail: '',
      },
    })
  },

  openEdit(e) {
    const acc = accountById([...this.data.assets, ...this.data.liabilities], e.currentTarget.dataset.id)
    if (!acc) return
    this.setData({
      showModal: true, editingId: acc.id,
      form: {
        name: acc.name || '',
        kind: acc.kind || 'asset',
        icon: acc.icon || '💳',
        initial_balance: acc.initial_balance != null ? String(acc.initial_balance) : '',
        card_tail: acc.card_tail || '',
      },
    })
  },

  closeModal() { this.setData({ showModal: false, editingId: null }) },
  noop() {},

  onNameInput(e)      { this.setData({ 'form.name': e.detail.value }) },
  onBalanceInput(e)   { this.setData({ 'form.initial_balance': e.detail.value }) },
  onCardTailInput(e)  { this.setData({ 'form.card_tail': e.detail.value }) },
  onKindTap(e)        { this.setData({ 'form.kind': e.currentTarget.dataset.kind }) },
  onIconTap(e)        { this.setData({ 'form.icon': e.currentTarget.dataset.icon }) },

  async saveAccount() {
    const { form, editingId, currentLedger, baseCurrency, saving } = this.data
    if (saving) return
    if (!currentLedger || !currentLedger.id) { wx.showToast({ title: '请先选择账本', icon: 'none' }); return }
    const name = String(form.name || '').trim()
    if (!name) { wx.showToast({ title: '请输入账户名称', icon: 'none' }); return }

    const payload = {
      ledger_id: currentLedger.id,
      name,
      kind: form.kind === 'liability' ? 'liability' : 'asset',
      icon: form.icon || '💳',
      currency: baseCurrency,
      initial_balance: Number(form.initial_balance) || 0,
      card_tail: String(form.card_tail || '').trim() || null,
    }

    this.setData({ saving: true })
    try {
      if (editingId) {
        const { error } = await supabase.from('accounts').update(payload).eq('id', editingId)
        if (error) throw new Error(error.message)
      } else {
        payload.sort_order = (this.data.assets.length + this.data.liabilities.length) + 1
        const { error } = await supabase.from('accounts').insert([payload])
        if (error) throw new Error(error.message)
      }
      this.setData({ showModal: false, editingId: null })
      wx.showToast({ title: editingId ? '已保存' : '已添加', icon: 'success' })
      this.loadData()
    } catch (e) {
      const msg = (e.message || '').includes('uniq_accounts_ledger_name')
        ? '已有同名账户' : (e.message || '保存失败')
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 删除：有账目则改为归档，保留历史记录
  deleteAccount() {
    const acc = accountById([...this.data.assets, ...this.data.liabilities], this.data.editingId)
    if (!acc) return

    if (acc.txCount > 0) {
      wx.showModal({
        title: '该账户已有账目',
        content: `「${acc.name}」下有 ${acc.txCount} 笔账目，直接删除会导致这些账目失去账户归属。建议改为「归档」：账目保留，账户不再出现在记账选择器中。`,
        confirmText: '归档',
        cancelText: '取消',
        success: async res => {
          if (!res.confirm) return
          const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', acc.id)
          if (error) return wx.showToast({ title: error.message || '归档失败', icon: 'none' })
          this.setData({ showModal: false, editingId: null })
          wx.showToast({ title: '已归档', icon: 'success' })
          this.loadData()
        },
      })
      return
    }

    wx.showModal({
      title: '确认删除',
      content: `确定删除账户「${acc.name}」？`,
      success: async res => {
        if (!res.confirm) return
        const { error } = await supabase.from('accounts').delete().eq('id', acc.id)
        if (error) return wx.showToast({ title: error.message || '删除失败', icon: 'none' })
        this.setData({ showModal: false, editingId: null })
        wx.showToast({ title: '已删除', icon: 'success' })
        this.loadData()
      },
    })
  },
})
