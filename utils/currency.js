// utils/currency.js - 币种定义 + 金额格式化（全项目唯一收口点）
//
// 约定：所有金额展示都必须经由 formatMoney()，
//      禁止再在页面/WXML 里散写 toFixed(2) 和「¥」。

const DEFAULT_CURRENCY = 'CNY'

// decimals = 0 表示该币种不带小数（日元 / 韩元 / 越南盾）
const CURRENCIES = [
  { code: 'CNY', symbol: '¥',   name: '人民币',       decimals: 2 },
  { code: 'USD', symbol: '$',   name: '美元',         decimals: 2 },
  { code: 'EUR', symbol: '€',   name: '欧元',         decimals: 2 },
  { code: 'JPY', symbol: '¥',   name: '日元',         decimals: 0 },
  { code: 'HKD', symbol: 'HK$', name: '港币',         decimals: 2 },
  { code: 'GBP', symbol: '£',   name: '英镑',         decimals: 2 },
  { code: 'KRW', symbol: '₩',   name: '韩元',         decimals: 0 },
  { code: 'AUD', symbol: 'A$',  name: '澳元',         decimals: 2 },
  { code: 'CAD', symbol: 'C$',  name: '加元',         decimals: 2 },
  { code: 'SGD', symbol: 'S$',  name: '新加坡元',     decimals: 2 },
  { code: 'THB', symbol: '฿',   name: '泰铢',         decimals: 2 },
  { code: 'MYR', symbol: 'RM',  name: '林吉特',       decimals: 2 },
  { code: 'PHP', symbol: '₱',   name: '菲律宾比索',   decimals: 2 },
  { code: 'VND', symbol: '₫',   name: '越南盾',       decimals: 0 },
  { code: 'TWD', symbol: 'NT$', name: '新台币',       decimals: 2 },
]

const CURRENCY_MAP = {}
CURRENCIES.forEach(c => { CURRENCY_MAP[c.code] = c })

const CURRENCY_CODES = CURRENCIES.map(c => c.code)

function getCurrency(code) {
  return CURRENCY_MAP[code] || CURRENCY_MAP[DEFAULT_CURRENCY]
}

function getSymbol(code) { return getCurrency(code).symbol }

function getDecimals(code) { return getCurrency(code).decimals }

// 币种下拉用的展示文案，如 "¥ 人民币 CNY"
function getLabel(code) {
  const c = getCurrency(code)
  return `${c.symbol} ${c.name} ${c.code}`
}

// 账本本位币：优先账本字段 → 本地缓存 → CNY
function resolveBaseCurrency(ledger) {
  if (ledger && ledger.base_currency) return ledger.base_currency
  try {
    const cached = wx.getStorageSync('default_ledger_currency')
    if (cached) return cached
  } catch (e) {}
  return DEFAULT_CURRENCY
}

// ── 金额格式化（唯一收口点）──────────────────────────────
// formatMoney(1234.5, 'USD')              → "US$1,234.50"
// formatMoney(-20, 'CNY')                 → "-¥20.00"
// formatMoney(20, 'CNY', { plus: true })  → "+¥20.00"
// formatMoney(20, 'CNY', { symbol: false }→ "20.00"
// formatMoney(1200, 'JPY')                → "¥1,200"
function formatMoney(amount, code, opts) {
  opts = opts || {}
  const cur = getCurrency(code)
  const n = Number(amount)
  const v = isNaN(n) ? 0 : n
  const d = opts.decimals != null ? opts.decimals : cur.decimals

  const absStr = Math.abs(v).toFixed(d)
  const dot = absStr.indexOf('.')
  const intPart = dot < 0 ? absStr : absStr.slice(0, dot)
  const decPart = dot < 0 ? '' : absStr.slice(dot)
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const sign = v < 0 ? '-' : (opts.plus && v > 0 ? '+' : '')
  const sym = opts.symbol === false ? '' : cur.symbol
  return sign + sym + grouped + decPart
}

// 纯数字（无符号、无千分位）：用于 input 回填、CSV、写库
function formatNumber(amount, decimals) {
  const n = Number(amount)
  const d = decimals != null ? decimals : 2
  return (isNaN(n) ? 0 : n).toFixed(d)
}

// ── 换算与读取 ──────────────────────────────────────────
function round2(n) { return Math.round(n * 100) / 100 }

// 原币金额 → 本位币金额
function convertToBase(amount, rate) {
  const n = Number(amount)
  const r = Number(rate)
  if (isNaN(n)) return 0
  if (isNaN(r) || r <= 0) return round2(n)
  return round2(n * r)
}

// ── 结算状态（外币「待结算」口径）────────────────────────
// 境外刷卡当天并不知道银行最终扣多少本位币，此时该笔交易
// settlement_status = 'pending'、base_amount 为空，**不计入任何汇总**。
// 账单出来后由用户填入实际扣款金额，才转为 'settled'。
const SETTLE_PENDING = 'pending'
const SETTLE_SETTLED = 'settled'

// 是否待结算（本位币金额尚未确定）
function isPending(tx) {
  if (!tx) return false
  return tx.settlement_status === SETTLE_PENDING
}

// 读取一条交易的「本位币口径金额」：
//   待结算 → 0（让所有 reduce/sum 自动跳过，无需逐页改聚合代码）
//   已结算 → base_amount
//   历史数据（无 settlement_status）→ 回退 amount，等价于本位币记账
function baseAmountOf(tx) {
  if (!tx) return 0
  if (isPending(tx)) return 0
  if (tx.base_amount != null && tx.base_amount !== '') return Number(tx.base_amount) || 0
  return Number(tx.amount) || 0
}

// ── 统计口径（收支 / 预算 / 分析）──────────────────────
// 借款（借出 / 借入）本质是债权债务，不是消费也不是收入：
//   借出 500 不该让本月支出 +500，借入 1000 也不该让收入虚高。
// 因此所有「收支类」聚合一律用 statAmountOf()，借款返回 0 自动跳过。
//
// 注意：账户余额必须继续用 baseAmountOf()——借出后银行卡是真的少了钱，
//      这是资金流，不是收支。两者不可混用。
function statAmountOf(tx) {
  if (!tx) return 0
  if (tx.is_loan === true) return 0
  return baseAmountOf(tx)
}

// 待结算交易的参考本位币金额（仅用于展示提示，永不参与汇总）
// 优先用记账时落库的 reference_amount，缺失则按传入汇率现算
function getReferenceAmount(tx, rate) {
  if (!tx) return null
  if (tx.reference_amount != null && tx.reference_amount !== '') {
    return Number(tx.reference_amount) || 0
  }
  const r = Number(rate)
  if (r > 0) return round2(Number(tx.amount) * r)
  return null
}

// 由「实际扣款本位币金额」反算实际隐含汇率：1 原币 = ? 本位币
// 银行实际汇率会高于市场参考价（含货币转换费与点差），这里如实记录
function impliedRate(baseAmount, amount) {
  const a = Number(amount)
  const b = Number(baseAmount)
  if (!(a > 0) || isNaN(b) || b < 0) return 1
  return Math.round((b / a) * 1e6) / 1e6
}

// 结算状态徽标文案（待结算才需要提示）
function settlementLabel(tx) {
  return isPending(tx) ? '待结算' : ''
}

function currencyOf(tx, fallback) {
  return (tx && tx.currency) || fallback || DEFAULT_CURRENCY
}

// 是否外币交易（需要额外展示换算）
function isForeign(tx, baseCurrency) {
  const base = baseCurrency || DEFAULT_CURRENCY
  return currencyOf(tx, base) !== base
}

// 交易明细上的一行换算文案：
//   本币        → ""
//   外币已结算  → "US$10.00 ≈ ¥72.30"
//   外币待结算  → "US$50.00 · 待结算（参考约 ¥356.00）"
function convertHint(tx, baseCurrency, rate) {
  const base = baseCurrency || DEFAULT_CURRENCY
  const cur = currencyOf(tx, base)
  if (cur === base) return ''
  if (isPending(tx)) {
    const ref = getReferenceAmount(tx, rate)
    return ref == null
      ? `${formatMoney(tx.amount, cur)} · 待结算`
      : `${formatMoney(tx.amount, cur)} · 待结算（参考约 ${formatMoney(ref, base)}）`
  }
  return `${formatMoney(tx.amount, cur)} ≈ ${formatMoney(baseAmountOf(tx), base)}`
}

module.exports = {
  DEFAULT_CURRENCY,
  SETTLE_PENDING,
  SETTLE_SETTLED,
  isPending,
  getReferenceAmount,
  impliedRate,
  settlementLabel,
  CURRENCIES,
  CURRENCY_CODES,
  CURRENCY_MAP,
  getCurrency,
  getSymbol,
  getDecimals,
  getLabel,
  resolveBaseCurrency,
  formatMoney,
  formatNumber,
  convertToBase,
  round2,
  baseAmountOf,
  statAmountOf,
  currencyOf,
  isForeign,
  convertHint,
}
