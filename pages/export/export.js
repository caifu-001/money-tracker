const app = getApp()
const { supabase } = require('../../utils/supabase')
const { formatNumber, baseAmountOf, currencyOf, resolveBaseCurrency, isPending } = require('../../utils/currency')

Page({
  data: {
    user: null, currentLedger: null,
    exportRange: 'all',  // 'all' | 'month'
    exportMonth: '',
    exporting: false,
    importing: false, showImportConfirm: false,
    importMode: 'merge',
    preview: null,
  },

  onLoad() {
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    const ledger = app.globalData.currentLedger
    const now = new Date()
    const m = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    this.setData({ user, currentLedger: ledger, exportMonth: m })
  },

  onShow() {
    const ledger = app.globalData.currentLedger
    if (!ledger) return wx.reLaunch({ url: '/pages/login/login' })
    this.setData({ currentLedger: ledger })
  },

  setExportRange(e) {
    this.setData({ exportRange: e.currentTarget.dataset.val })
  },

  setExportMonth(e) {
    this.setData({ exportMonth: e.detail.value })
  },

  // 导出 CSV
  async handleExportCSV() {
    if (!this.data.currentLedger) { wx.showToast({ title: '请先选择账本', icon: 'none' }); return }
    this.setData({ exporting: true })
    wx.showLoading({ title: '导出中...' })

    try {
      let query = supabase
        .from('transactions')
        .select('date,type,category,amount,currency,exchange_rate,base_amount,reference_amount,settlement_status,note,payment_method,account_id,to_account_id')
        .eq('ledger_id', this.data.currentLedger.id)
        .order('date', { ascending: false })

      if (this.data.exportRange === 'month') {
        const [y, m] = this.data.exportMonth.split('-')
        query = query.gte('date', `${y}-${m}-01`).lte('date', `${y}-${m}-31`)
      }

      const { data } = await query

      // 账户名映射（资金账户 / 转账对方账户），导出后仍能看懂钱从哪来、到哪去
      const { data: accData } = await supabase.from('accounts')
        .select('id,name').eq('ledger_id', this.data.currentLedger.id)
      const accName = {}
      ;(accData || []).forEach(a => { accName[a.id] = a.name })

      // 本位币取自账本；金额同时导出原币与换算后的本位币，避免导出后无法对账
      const baseCurrency = resolveBaseCurrency(this.data.currentLedger)
      const rows = (data || []).map(t => [
        t.date,
        t.type === 'transfer' ? '转账' : (t.type === 'income' ? '收入' : '支出'),
        currencyOf(t, baseCurrency),
        formatNumber(t.amount),
        t.exchange_rate != null ? t.exchange_rate : 1,
        // 待结算：本位币金额尚未确定，留空而不是写 0，避免导出后被当成 0 元
        isPending(t) ? '' : formatNumber(baseAmountOf(t)),
        isPending(t) ? '待结算' : '已结算',
        t.category || '',
        (t.note || '').replace(/"/g, '""'),
        t.payment_method || '',
        accName[t.account_id] || '',
        accName[t.to_account_id] || '',
        // 借款标记：借款不计入收支统计，导出后需要能一眼分辨
        t.is_loan === true ? '借款' : '',
        t.is_loan === true ? (t.loan_counterparty || '') : ''
      ])
      const csv = [
        `日期,类型,币种,金额(原币),汇率,金额(${baseCurrency}),结算状态,类别,备注,支付方式,资金账户,转入账户,借款,借款对方`,
        ...rows.map(r => r.map(c => `"${c}"`).join(','))
      ].join('\n')

      const blob = '\ufeff' + csv
      const name = this.data.currentLedger.name
      const period = this.data.exportRange === 'month' ? this.data.exportMonth : '全部'
      const fileName = `游游记账_${name}_${period}.csv`

      const fs = wx.getFileSystemManager()
      const filePath = wx.env.USER_DATA_PATH + '/' + fileName
      await new Promise((res, rej) => {
        fs.writeFile({ filePath, data: blob, encoding: 'utf8', success: res, fail: rej })
      })
      wx.hideLoading()
      this.setData({ exporting: false })
      wx.openDocument({
        filePath, fileType: 'csv',
        success: () => {},
        fail: () => wx.showToast({ title: '文件已保存到' + fileName, icon: 'none', duration: 3000 })
      })
    } catch (err) {
      console.error(err)
      wx.hideLoading()
      this.setData({ exporting: false })
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  // 导出 JSON 备份
  async handleExportJSON() {
    if (!this.data.currentLedger) { wx.showToast({ title: '请先选择账本', icon: 'none' }); return }
    this.setData({ exporting: true })
    wx.showLoading({ title: '导出中...' })

    try {
      const [txRes, catRes, budRes, accRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('ledger_id', this.data.currentLedger.id).order('date'),
        supabase.from('categories').select('*').eq('ledger_id', this.data.currentLedger.id),
        supabase.from('budgets').select('*').eq('ledger_id', this.data.currentLedger.id),
        supabase.from('accounts').select('*').eq('ledger_id', this.data.currentLedger.id),
      ])

      const backup = {
        version: "6.0.0", app: '游游记账',
        exportedAt: new Date(Date.now() + 8*3600000).toISOString(),
        ledgerName: this.data.currentLedger.name,
        transactions: txRes.data || [],
        categories: catRes.data || [],
        budgets: budRes.data || [],
        // 资金账户：备份账目的同时保留账户与余额口径
        accounts: accRes.data || [],
      }
      const jsonStr = JSON.stringify(backup, null, 2)
      const fileName = `游游记账_备份_${(() => { const d = new Date(Date.now() + 8*3600000); return d.toISOString().slice(0,10) })()}.json`

      const fs = wx.getFileSystemManager()
      const filePath = wx.env.USER_DATA_PATH + '/' + fileName
      await new Promise((res, rej) => {
        fs.writeFile({ filePath, data: jsonStr, encoding: 'utf8', success: res, fail: rej })
      })
      wx.hideLoading()
      this.setData({ exporting: false })
      wx.openDocument({
        filePath, fileType: 'json',
        success: () => {},
        fail: () => wx.showToast({ title: '文件已保存', icon: 'none', duration: 2500 })
      })
    } catch (err) {
      console.error(err)
      wx.hideLoading()
      this.setData({ exporting: false })
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  // 选择 JSON 文件导入
  chooseFile() {
    wx.chooseMessageFile({
      count: 1, type: 'file',
      extension: ['json'],
      success: res => {
        const file = res.tempFiles[0]
        if (!file.name.endsWith('.json')) {
          wx.showToast({ title: '仅支持JSON文件', icon: 'none' }); return
        }
        wx.showLoading({ title: '读取文件...' })
        const fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: file.path, encoding: 'utf8',
          success: readRes => {
            try {
              const data = JSON.parse(readRes.data)
              if (!data.version || !data.transactions) {
                wx.showToast({ title: '文件格式无效', icon: 'none' }); wx.hideLoading(); return
              }
              this.setData({
                preview: {
                  ledger: data.ledgerName || '未知账本',
                  txs: (data.transactions || []).length,
                  cats: (data.categories || []).length,
                  budgets: (data.budgets || []).length,
                  date: data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('zh-CN') : '未知',
                },
                importData: data,
                showImportConfirm: true,
              })
              wx.hideLoading()
            } catch {
              wx.showToast({ title: 'JSON 解析失败', icon: 'none' }); wx.hideLoading()
            }
          },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '读取文件失败', icon: 'none' }) }
        })
      }
    })
  },

  setImportMode(e) {
    this.setData({ importMode: e.currentTarget.dataset.val })
  },

  cancelImport() {
    this.setData({ showImportConfirm: false, preview: null, importData: null })
  },

  // 执行导入
  async doImport() {
    const { importData, importMode } = this.data
    if (!importData) return
    const ledger = this.data.currentLedger
    if (!ledger) { wx.showToast({ title: '请先选择账本', icon: 'none' }); return }

    this.setData({ importing: true })
    wx.showLoading({ title: '导入中...' })

    try {
      if (importMode === 'overwrite') {
        // 串行删除：transactions 的外键 account_id 依赖 accounts，必须先删账目再删账户
        await supabase.from('transactions').delete().eq('ledger_id', ledger.id)
        await supabase.from('categories').delete().eq('ledger_id', ledger.id)
        await supabase.from('budgets').delete().eq('ledger_id', ledger.id)
        await supabase.from('accounts').delete().eq('ledger_id', ledger.id)
      }

      let ok = 0

      const cats = (importData.categories || []).filter(c => !c.id?.includes('__'))
      const txs = (importData.transactions || []).filter(t => !t.id?.includes('__'))
      const budgets = (importData.budgets || []).filter(b => !b.id?.includes('__'))
      const accounts = (importData.accounts || []).filter(a => !a.id?.includes('__'))

      // 账户必须先于账目导入（transactions.account_id 有外键约束）
      if (accounts.length) {
        const toInsert = accounts.map(a => ({
          id: a.id, ledger_id: ledger.id, name: a.name,
          kind: a.kind === 'liability' ? 'liability' : 'asset',
          currency: a.currency || 'CNY',
          initial_balance: a.initial_balance != null ? a.initial_balance : 0,
          icon: a.icon || '💳', kind_code: a.kind_code || null,
          card_tail: a.card_tail || null, sort_order: a.sort_order || 0,
          is_archived: !!a.is_archived,
        }))
        await supabase.from('accounts').upsert(toInsert, { onConflict: 'id' })
        ok += accounts.length
      }

      if (cats.length) {
        const toInsert = cats.map(c => ({
          id: c.id, ledger_id: ledger.id, name: c.name, icon: c.icon || '📌',
          type: c.type, parent_id: c.parent_id || null, level: c.level || 1
        }))
        await supabase.from('categories').upsert(toInsert, { onConflict: 'id' })
        ok += cats.length
      }

      if (txs.length) {
        const toInsert = txs.map(t => {
          // 待结算记录（外币尚未入账）：base_amount 必须保持为空，
          // 否则回退成原币金额会凭空产生一个错误的汇总数字
          const pending = t.settlement_status === 'pending'
          return {
            id: t.id, ledger_id: ledger.id, date: t.date, type: t.type,
            category: t.category, amount: t.amount, note: t.note || '',
            // 兼容旧版备份文件：无币种字段时视为本位币、汇率 1
            currency: t.currency || 'CNY',
            exchange_rate: t.exchange_rate != null ? t.exchange_rate : 1,
            reference_amount: t.reference_amount != null ? t.reference_amount : null,
            base_amount: pending ? null : (t.base_amount != null ? t.base_amount : t.amount),
            settlement_status: pending ? 'pending' : 'settled',
            // 资金账户 / 转账对方账户（旧备份无此字段则为 null）
            account_id: t.account_id || null,
            to_account_id: t.type === 'transfer' ? (t.to_account_id || null) : null,
            payment_method: t.payment_method || null, created_at: t.created_at || new Date(Date.now() + 8*3600000).toISOString()
          }
        })
        await supabase.from('transactions').upsert(toInsert, { onConflict: 'id' })
        ok += txs.length
      }

      if (budgets.length) {
        const toInsert = budgets.map(b => ({
          id: b.id, ledger_id: ledger.id, category: b.category, type: b.type,
          amount: b.amount, month: b.month
        }))
        await supabase.from('budgets').upsert(toInsert, { onConflict: 'id' })
        ok += budgets.length
      }

      wx.hideLoading()
      this.setData({ importing: false })
      wx.showModal({
        title: '导入完成', content: `共导入${ok} 条记录`,
        showCancel: false, confirmText: '好的'
      })
      this.cancelImport()
    } catch (err) {
      console.error(err)
      wx.hideLoading()
      this.setData({ importing: false })
      wx.showToast({ title: '导入失败', icon: 'none' })
    }
  },
})
