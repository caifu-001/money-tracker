// utils/accounts.js
// 资金账户（资产 / 负债）与转账的工具层
//
// 口径（与数据库 021 迁移一致）：
//   · 余额一律用「本位币口径」计算 —— 即经由 baseAmountOf()，
//     因此外币「待结算」账目（base_amount 为空 → 0）天然不计入余额
//   · 统一累加公式：
//       余额 = 期初
//            + 该账户的收入 − 该账户的支出
//            + 作为转入方的转账 − 作为转出方的转账
//   · 负债账户（信用卡/花呗）余额为负 = 欠款；还款是从资产账户
//     transfer 到负债账户，只改变余额、不产生新的支出

const { baseAmountOf, round2 } = require('./currency')

// 账户类型
const ACCOUNT_KINDS = {
  asset:     { code: 'asset',     label: '资产', icon: '💰', desc: '现金、储蓄卡、电子钱包等' },
  liability: { code: 'liability', label: '负债', icon: '💳', desc: '信用卡、花呗等需要偿还的账户' },
}
const ACCOUNT_KIND_LIST = [ACCOUNT_KINDS.asset, ACCOUNT_KINDS.liability]

// 新账本默认账户模板（与 021 迁移、ledgers 触发器保持一致）
const DEFAULT_ACCOUNTS = [
  { name: '现金',     kind: 'asset',     kind_code: 'cash',     icon: '💵', sort_order: 1 },
  { name: '微信零钱', kind: 'asset',     kind_code: 'wechat',   icon: '💚', sort_order: 2 },
  { name: '支付宝',   kind: 'asset',     kind_code: 'alipay',   icon: '💙', sort_order: 3 },
  { name: '银行卡',   kind: 'asset',     kind_code: 'bankcard', icon: '🏦', sort_order: 4 },
  { name: '信用卡',   kind: 'liability', kind_code: 'credit',   icon: '💳', sort_order: 5 },
]

const ACCOUNT_ICONS = ['💵', '💚', '💙', '🏦', '💳', '📱', '🪙', '💰', '🧧', '🏧', '📈', '🎁', '👛', '🏢']

// 旧 payment_method 枚举 ↔ 账户 kind_code 的映射（导出兼容用）
const LEGACY_PAYMENT_CODES = ['cash', 'wechat', 'alipay', 'bankcard']

// ── 基础判断 ────────────────────────────────────────────────
function isTransfer(tx) {
  return !!tx && tx.type === 'transfer'
}

function kindLabel(kind) {
  return (ACCOUNT_KINDS[kind] || ACCOUNT_KINDS.asset).label
}

function kindIcon(kind) {
  return (ACCOUNT_KINDS[kind] || ACCOUNT_KINDS.asset).icon
}

// ── 余额计算 ────────────────────────────────────────────────
// 单账户余额（本位币口径）
function accountBalance(account, txs) {
  if (!account) return 0
  let bal = Number(account.initial_balance) || 0
  ;(txs || []).forEach(t => {
    if (!t) return
    const amt = baseAmountOf(t)          // 待结算 → 0，自动跳过
    if (!amt) return
    if (t.type === 'income' && t.account_id === account.id) {
      bal += amt
    } else if (t.type === 'expense' && t.account_id === account.id) {
      bal -= amt
    } else if (t.type === 'transfer') {
      if (t.to_account_id === account.id) bal += amt   // 转入
      if (t.account_id === account.id)    bal -= amt   // 转出
    }
  })
  return round2(bal)
}

// 批量：给账户数组补上 balance
function computeBalances(accounts, txs) {
  return (accounts || []).map(a => ({ ...a, balance: accountBalance(a, txs) }))
}

// 汇总：总资产 / 总负债 / 净资产（已归档账户不计入）
function summarize(accountsWithBalance) {
  const list = (accountsWithBalance || []).filter(a => !a.is_archived)
  const totalAssets = round2(
    list.filter(a => a.kind !== 'liability').reduce((s, a) => s + (Number(a.balance) || 0), 0)
  )
  // 负债账户余额为负（欠款）→ 取正数作为负债额；溢缴（余额为正）自然抵减
  const totalLiabilities = round2(
    list.filter(a => a.kind === 'liability').reduce((s, a) => s - (Number(a.balance) || 0), 0)
  )
  return {
    totalAssets,
    totalLiabilities,
    netWorth: round2(totalAssets - totalLiabilities),
    count: list.length,
  }
}

// 按类型分组（资产在前，组内按 sort_order、余额绝对值降序）
function groupByKind(accountsWithBalance) {
  const list = (accountsWithBalance || []).filter(a => !a.is_archived)
  const bySort = (a, b) => {
    const so = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    if (so !== 0) return so
    return Math.abs(Number(b.balance) || 0) - Math.abs(Number(a.balance) || 0)
  }
  return {
    assets: list.filter(a => a.kind !== 'liability').sort(bySort),
    liabilities: list.filter(a => a.kind === 'liability').sort(bySort),
  }
}

// ── 查询辅助 ────────────────────────────────────────────────
function accountById(accounts, id) {
  if (!id) return null
  return (accounts || []).find(a => a.id === id) || null
}

function accountNameOf(accounts, id) {
  const a = accountById(accounts, id)
  return a ? a.name : ''
}

// 找账户对应的旧 payment_method 值（用于兼容导出 / 旧字段回填）
function legacyPaymentOf(account) {
  if (!account) return null
  return LEGACY_PAYMENT_CODES.includes(account.kind_code) ? account.kind_code : 'other'
}

// ── 转账校验 ────────────────────────────────────────────────
// 返回 null 表示合法，否则返回错误提示文案
function validateTransfer(fromId, toId) {
  if (!fromId || !toId) return '请选择转出与转入账户'
  if (fromId === toId) return '转出与转入账户不能相同'
  return null
}

// ── 展示辅助 ────────────────────────────────────────────────
// 账户余额展示：负债账户欠款用负数原文，前端按 kind 决定颜色
function balanceText(balance) {
  const n = Number(balance) || 0
  return round2(Math.abs(n))
}

// 交易上的账户标签：如「银行卡 → 信用卡」「微信零钱」
function accountTagOf(tx, accounts) {
  if (!tx) return ''
  if (isTransfer(tx)) {
    const from = accountNameOf(accounts, tx.account_id) || '账户'
    const to = accountNameOf(accounts, tx.to_account_id) || '账户'
    return `${from} → ${to}`
  }
  return accountNameOf(accounts, tx.account_id)
}

module.exports = {
  ACCOUNT_KINDS,
  ACCOUNT_KIND_LIST,
  DEFAULT_ACCOUNTS,
  ACCOUNT_ICONS,
  LEGACY_PAYMENT_CODES,
  isTransfer,
  kindLabel,
  kindIcon,
  accountBalance,
  computeBalances,
  summarize,
  groupByKind,
  accountById,
  accountNameOf,
  legacyPaymentOf,
  validateTransfer,
  balanceText,
  accountTagOf,
}
