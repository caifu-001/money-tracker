// pages/fuel/fuel.js - 油耗统计页（每辆车独立统计）
const app = getApp()
const { supabase } = require('../../utils/supabase')

const fmtDate = (d) => {
  if (!d) return ''
  const parts = String(d).split('-')
  if (parts.length < 3) return d
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日`
}

// 对某辆车（或未指定车辆）的油费记录做完整统计
function computeVehicle(tx) {
  // 仅取有有效里程的记录用于油耗/每公里计算，按里程升序
  const valid = tx
    .filter(t => t.odometer != null && !isNaN(Number(t.odometer)))
    .map(t => ({
      ...t,
      odometer: Number(t.odometer),
      amount: Number(t.amount),
      fuel_liters: (t.fuel_liters != null && !isNaN(Number(t.fuel_liters))) ? Number(t.fuel_liters) : null,
    }))
    .sort((a, b) => a.odometer - b.odometer)

  let totalLiters = 0, totalAmount = 0
  valid.forEach(r => {
    totalAmount += r.amount
    if (r.fuel_liters != null) totalLiters += r.fuel_liters
  })
  const totalDist = valid.length > 1 ? valid[valid.length - 1].odometer - valid[0].odometer : 0

  const summary = {
    count: valid.length,
    totalAmount: totalAmount.toFixed(2),
    totalLiters: totalLiters > 0 ? totalLiters.toFixed(2) : '--',
    totalDist: totalDist > 0 ? totalDist.toFixed(0) : '--',
    avgConsumption: (totalDist > 0 && totalLiters > 0) ? (totalLiters / totalDist * 100).toFixed(2) : null,
    avgPerKm: totalDist > 0 ? (totalAmount / totalDist).toFixed(3) : null,
  }

  const records = valid.map((r, i) => {
    let dist = null, consumption = null, perKm = null
    if (i > 0) {
      const prev = valid[i - 1]
      dist = r.odometer - prev.odometer
      if (dist > 0) {
        consumption = r.fuel_liters != null ? (r.fuel_liters / dist * 100).toFixed(2) : null
        perKm = (r.amount / dist).toFixed(3)
      }
    }
    return {
      id: r.id,
      date: r.date,
      dateLabel: fmtDate(r.date),
      amount: r.amount.toFixed(2),
      liters: r.fuel_liters != null ? r.fuel_liters.toFixed(2) : '--',
      odometer: r.odometer,
      dist: (dist != null && dist > 0) ? dist.toFixed(0) : null,
      consumption,
      perKm,
      note: r.note || '',
      isFirst: i === 0,
    }
  })

  // 每月油费小计（含无里程记录，按 date 月份分组）
  const monthMap = {}
  tx.forEach(t => {
    const m = (t.date || '').slice(0, 7)
    if (!m) return
    monthMap[m] = (monthMap[m] || 0) + Number(t.amount)
  })
  const monthlyStats = Object.entries(monthMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, amount]) => {
      const p = month.split('-')
      return { month, monthLabel: `${p[0]}年${parseInt(p[1])}月`, amount: amount.toFixed(2) }
    })

  return { summary, records, monthlyStats, recordCount: tx.length }
}

Page({
  data: {
    loading: true,
    isGuest: true,
    user: null,
    tabs: [],            // [{ id, name, vehicleId }] vehicleId 为 null 表示未指定车辆
    activeTab: 0,
    summary: null,
    monthlyStats: [],
    records: [],
    hasData: false,
  },

  onLoad() {
    const user = app.globalData.user
    this.setData({ isGuest: !user, user: user || null })
    if (user) this.loadData()
  },

  onShow() {
    const user = app.globalData.user
    if (user && user.id) app.checkAccountStatus()
    if (user) this.loadData()
  },

  onTabTap(e) {
    this.setData({ activeTab: Number(e.currentTarget.dataset.index) })
    this.renderActive()
  },

  async loadData() {
    const { currentLedger } = app.globalData
    if (!currentLedger || !currentLedger.id) {
      this.setData({ loading: false })
      return
    }
    this.setData({ loading: true })
    try {
      const { data: vehicles } = await supabase.from('vehicles')
        .select('id,name').eq('ledger_id', currentLedger.id).order('created_at')
      const { data: fuelTx } = await supabase.from('transactions')
        .select('id,amount,date,vehicle_id,fuel_liters,odometer,fuel_consumption,note')
        .eq('ledger_id', currentLedger.id).eq('category', '油费').order('date')

      this._vehicles = vehicles || []
      this._fuelTx = fuelTx || []

      // 按 vehicle_id 分组：每辆车一个 tab，未绑定车辆的分到「未指定车辆」
      const groups = []  // [{ vehicleId, name, tx:[] }]
      const byId = {}
      ;(this._fuelTx || []).forEach(t => {
        const key = t.vehicle_id || '__none__'
        if (!byId[key]) byId[key] = []
        byId[key].push(t)
      })

      // 先按车辆顺序建 tab
      const tabs = []
      this._vehicles.forEach(v => {
        const key = v.id
        if (byId[key]) {
          tabs.push({ id: key, vehicleId: v.id, name: v.name, tx: byId[key] })
          delete byId[key]
        } else {
          // 车辆存在但还没有加油记录：也展示（空统计）
          tabs.push({ id: key, vehicleId: v.id, name: v.name, tx: [] })
        }
      })
      // 剩余未绑定车辆的记录
      if (byId['__none__']) {
        tabs.push({ id: '__none__', vehicleId: null, name: '未指定车辆', tx: byId['__none__'] })
      }

      this._tabs = tabs
      const hasData = (this._fuelTx || []).length > 0
      this.setData({ tabs, activeTab: 0, hasData })
      this.renderActive()
    } catch (e) {
      console.error('[fuel] loadData error', e)
      this.setData({ loading: false })
    }
  },

  renderActive() {
    const { activeTab } = this.data
    const tabs = this._tabs || []
    if (!tabs.length) {
      this.setData({ loading: false, summary: null, records: [], monthlyStats: [] })
      return
    }
    const cur = tabs[activeTab] || tabs[0]
    const r = computeVehicle(cur.tx || [])
    this.setData({
      loading: false,
      summary: r.summary,
      records: r.records,
      monthlyStats: r.monthlyStats,
    })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },
})
