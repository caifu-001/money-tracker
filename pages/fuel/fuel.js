// pages/fuel/fuel.js - 油耗统计页
const app = getApp()
const { supabase } = require('../../utils/supabase')

const fmtDate = (d) => {
  if (!d) return ''
  const parts = String(d).split('-')
  if (parts.length < 3) return d
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日`
}

Page({
  data: {
    loading: true,
    isGuest: true,
    user: null,
    vehicleOptions: [],   // ['全部车辆', ...车名]
    vehicleIndex: 0,
    summary: null,        // { count, totalAmount, totalLiters, totalDist, avgConsumption, avgPerKm }
    monthlyStats: [],     // [{ month, monthLabel, amount }]
    records: [],          // 加油明细
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

  onVehicleChange(e) {
    this.setData({ vehicleIndex: Number(e.detail.value) })
    this.renderByVehicle()
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

      const vehicleOptions = ['全部车辆', ...this._vehicles.map(v => v.name)]
      this.setData({
        vehicleOptions,
        vehicleIndex: 0,
        hasData: (this._fuelTx || []).length > 0,
      })
      this.renderByVehicle()
    } catch (e) {
      console.error('[fuel] loadData error', e)
      this.setData({ loading: false })
    }
  },

  renderByVehicle() {
    const { vehicleIndex } = this.data
    const vehicles = this._vehicles || []
    const allTx = this._fuelTx || []

    let tx = allTx
    if (vehicleIndex > 0) {
      const v = vehicles[vehicleIndex - 1]
      if (v) tx = allTx.filter(t => t.vehicle_id === v.id)
    }

    const vName = {}
    vehicles.forEach(v => { vName[v.id] = v.name })

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
    const firstOdo = valid.length ? valid[0].odometer : null
    const lastOdo = valid.length ? valid[valid.length - 1].odometer : null
    const totalDist = (firstOdo != null && lastOdo != null) ? (lastOdo - firstOdo) : 0

    const avgConsumption = (totalDist > 0 && totalLiters > 0) ? totalLiters / totalDist * 100 : null
    const avgPerKm = totalDist > 0 ? totalAmount / totalDist : null

    const summary = {
      count: valid.length,
      totalAmount: totalAmount.toFixed(2),
      totalLiters: totalLiters > 0 ? totalLiters.toFixed(2) : '--',
      totalDist: totalDist > 0 ? totalDist.toFixed(0) : '--',
      avgConsumption: avgConsumption != null ? avgConsumption.toFixed(2) : null,
      avgPerKm: avgPerKm != null ? avgPerKm.toFixed(3) : null,
    }

    // 明细：按里程升序，第 i 条相对前一条计算单次油耗 + 每公里花费
    const records = valid.map((r, i) => {
      let dist = null, consumption = null, perKm = null
      if (i > 0) {
        const prev = valid[i - 1]
        dist = r.odometer - prev.odometer
        if (dist > 0) {
          consumption = r.fuel_liters != null ? r.fuel_liters / dist * 100 : null
          perKm = r.amount / dist
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
        consumption: consumption != null ? consumption.toFixed(2) : null,
        perKm: perKm != null ? perKm.toFixed(3) : null,
        note: r.note || '',
        vehicleName: vName[r.vehicle_id] || '',
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

    this.setData({ loading: false, summary, records, monthlyStats })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },
})
