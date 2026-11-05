// utils/rates.js - 汇率获取与缓存（前端直连公开汇率源）
//
// ⚠️ 部署前必做：把下面两个域名加入
//    微信公众平台 → 开发管理 → 服务器域名 → request 合法域名
//        https://open.er-api.com
//        https://api.frankfurter.app
//    否则真机请求会全部失败。开发者工具勾选了「不校验合法域名」时不会暴露该问题。
//
// 语义：getRateMap(base) 返回 map[原币] = 「1 单位原币折合多少 base（本位币）」
//   例：base = CNY 时 map.USD ≈ 7.12，于是 base_amount = amount * map.USD
//   （上游接口给的是「1 base = ? 原币」，这里统一取倒数，避免调用方混淆方向）

const { DEFAULT_CURRENCY } = require('./currency')

const SOURCES = [
  { name: 'er-api',      url: (b) => `https://open.er-api.com/v6/latest/${b}` },
  { name: 'frankfurter', url: (b) => `https://api.frankfurter.app/latest?from=${b}` },
]

const CACHE_PREFIX = 'fx_rates_'
const CACHE_TTL_MS = 12 * 3600 * 1000
const REQUEST_TIMEOUT = 8000

// 完全离线时的兜底参考汇率（以 CNY 为基准的近似值）
// 仅用于避免记账流程被网络问题完全阻断，界面上会明确提示「参考汇率」
const OFFLINE_CNY_RATES = {
  CNY: 1, USD: 7.15, EUR: 7.75, JPY: 0.047, HKD: 0.92, GBP: 9.05,
  KRW: 0.0052, AUD: 4.70, CAD: 5.20, SGD: 5.35, THB: 0.21, MYR: 1.62,
  PHP: 0.125, VND: 0.00028, TWD: 0.22,
}

function bjToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function readCache(base) {
  try { return wx.getStorageSync(CACHE_PREFIX + base) || null } catch (e) { return null }
}

function writeCache(base, payload) {
  try { wx.setStorageSync(CACHE_PREFIX + base, payload) } catch (e) {}
}

function httpGet(url) {
  return new Promise((resolve) => {
    wx.request({
      url,
      method: 'GET',
      timeout: REQUEST_TIMEOUT,
      success: (res) => resolve(res),
      fail: (err) => resolve({ statusCode: 0, data: null, err }),
    })
  })
}

// 「1 base = rate[X] X」→「1 X = ? base」
function invertRates(rates) {
  const map = {}
  Object.keys(rates || {}).forEach((code) => {
    const r = Number(rates[code])
    if (!r || r <= 0) return
    map[code] = r === 1 ? 1 : Math.round((1 / r) * 1e6) / 1e6
  })
  return map
}

// 依次尝试各汇率源，任一成功即返回
async function fetchFromSources(base) {
  for (let i = 0; i < SOURCES.length; i++) {
    const src = SOURCES[i]
    const res = await httpGet(src.url(base))
    if (!res || res.statusCode !== 200 || !res.data) continue
    const data = res.data
    if (data.result && data.result !== 'success') continue

    const returnedBase = data.base_code || data.base
    if (returnedBase && returnedBase !== base) continue
    if (!data.rates || typeof data.rates !== 'object') continue

    const map = invertRates(data.rates)
    map[base] = 1
    if (Object.keys(map).length <= 1) continue

    return { map, source: src.name, date: data.date || bjToday() }
  }
  return null
}

// 兜底：基于 CNY 参考表反推任意本位币的映射
function buildOfflineMap(base) {
  const baseRate = OFFLINE_CNY_RATES[base]
  if (!baseRate) return { map: { [base]: 1 }, source: 'none', date: bjToday() }
  const map = {}
  Object.keys(OFFLINE_CNY_RATES).forEach((code) => {
    map[code] = Math.round((OFFLINE_CNY_RATES[code] / baseRate) * 1e6) / 1e6
  })
  map[base] = 1
  return { map, source: 'offline', date: bjToday() }
}

const _inflight = {}

/**
 * 取「以 base 为本位币」的汇率表
 * @param {string}  base  本位币代码，默认 CNY
 * @param {boolean} force 忽略新鲜缓存强制刷新
 * @returns {Promise<{map:Object, source:string, date:string, cached:boolean, stale:boolean}>}
 *          source: 'er-api' | 'frankfurter' | 'offline' | 'none'
 */
function getRateMap(base, force) {
  const code = base || DEFAULT_CURRENCY
  const cached = readCache(code)
  const fresh = cached && cached.fetchedAt && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS

  if (fresh && !force) {
    return Promise.resolve({ ...cached, cached: true, stale: false })
  }
  if (_inflight[code]) return _inflight[code]

  const task = (async () => {
    const fetched = await fetchFromSources(code)
    if (fetched) {
      const payload = {
        map: fetched.map,
        source: fetched.source,
        date: fetched.date,
        fetchedAt: Date.now(),
      }
      writeCache(code, payload)
      return { ...payload, cached: false, stale: false }
    }
    // 网络失败：降级用过期缓存
    if (cached && cached.map) {
      return { ...cached, cached: true, stale: true }
    }
    // 再兜底到离线参考表
    return { ...buildOfflineMap(code), fetchedAt: 0, cached: false, stale: true }
  })()

  _inflight[code] = task.then(
    (r) => { delete _inflight[code]; return r },
    (e) => { delete _inflight[code]; throw e }
  )
  return _inflight[code]
}

/**
 * 取单一汇率：1 单位 from = ? 单位 to
 * 取不到时返回 1（调用方应结合 getRateMap 的 source 判断是否可信）
 */
async function getRate(from, to) {
  if (!from || !to || from === to) return 1
  const { map } = await getRateMap(to)
  const r = map && map[from]
  return (r && r > 0) ? r : 1
}

function clearRatesCache(base) {
  try {
    if (base) {
      wx.removeStorageSync(CACHE_PREFIX + base)
      return
    }
    const info = wx.getStorageInfoSync()
    ;(info.keys || []).forEach((k) => {
      if (k.indexOf(CACHE_PREFIX) === 0) wx.removeStorageSync(k)
    })
  } catch (e) {}
}

module.exports = {
  getRateMap,
  getRate,
  clearRatesCache,
  CACHE_TTL_MS,
  OFFLINE_CNY_RATES,
  SOURCES,
}
