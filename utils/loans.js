// utils/loans.js
// 借款记账工具层：借出 / 借入 的识别、按对方汇总净欠款
//
// 口径（与数据库 022_loans.sql 一致）：
//   · 借款账目的 type 仍是 income / expense，用 is_loan 标记区分
//   · 方向由 type 推断：
//       expense + is_loan → 资金流出：借出 / 归还欠款
//       income  + is_loan → 资金流入：借入 / 收回欠款
//   · **净额法**汇总欠款，不需要把「借出」和「还款」配对：
//       净额 = 该对方借款收入合计 − 该对方借款支出合计
//       净额 > 0 → 我欠对方（应付）
//       净额 < 0 → 对方欠我（应收）
//       净额 = 0 → 已结清
//     所以「还钱」只需反向记一笔，两条自动抵消，无需状态字段
//   · 借款不计入收支统计（见 currency.statAmountOf），但计入账户余额
//     （见 accounts.accountBalance，它刻意用的是 baseAmountOf）

const { baseAmountOf, round2 } = require('./currency')

const LOAN_OUT = 'out'   // 资金流出：借出 / 还债
const LOAN_IN = 'in'     // 资金流入：借入 / 收回

const LOAN_DIRECTIONS = {
  out: {
    code: LOAN_OUT,
    label: '借出',
    icon: '📤',
    // 借出时对方欠我 → 应收
    debtLabel: '待收回',
    hint: '钱借给别人，对方欠你',
  },
  in: {
    code: LOAN_IN,
    label: '借入',
    icon: '📥',
    debtLabel: '待偿还',
    hint: '向别人借钱，你欠对方',
  },
}

// ── 基础判断 ────────────────────────────────────────────────
function isLoan(tx) {
  return !!tx && tx.is_loan === true
}

// 借款方向：'out' | 'in' | null（非借款）
function loanDirectionOf(tx) {
  if (!isLoan(tx)) return null
  if (tx.type === 'expense') return LOAN_OUT
  if (tx.type === 'income') return LOAN_IN
  return null
}

function isLoanOut(tx) { return loanDirectionOf(tx) === LOAN_OUT }
function isLoanIn(tx)  { return loanDirectionOf(tx) === LOAN_IN }

// 对方名称（去掉空白，防止「张三 」「张三」被当成两个人）
function counterpartyOf(tx) {
  if (!isLoan(tx)) return ''
  return String(tx.loan_counterparty || '').trim()
}

// 借款方向文案：借出 / 借入
function loanLabel(tx) {
  const d = loanDirectionOf(tx)
  return d ? LOAN_DIRECTIONS[d].label : ''
}

// 借款徽章文案：🤝借出 / 🤝借入
function loanBadge(tx) {
  const d = loanDirectionOf(tx)
  return d ? `🤝${LOAN_DIRECTIONS[d].label}` : ''
}

// ── 金额 ────────────────────────────────────────────────────
// 带符号的借款金额（本位币）：
//   借入（我欠人）→ 正数
//   借出（人欠我）→ 负数
// 这个符号约定让「直接累加」就等于净头寸
function signedLoanAmount(tx) {
  const d = loanDirectionOf(tx)
  if (!d) return 0
  const amt = baseAmountOf(tx)
  return d === LOAN_IN ? amt : -amt
}

// 是否「对方欠我」侧
function isReceivable(tx) { return isLoanOut(tx) }

// ── 汇总 ────────────────────────────────────────────────────
function emptySummary() {
  return {
    lendTotal: 0,      // 借出合计（正数）
    borrowTotal: 0,    // 借入合计（正数）
    net: 0,            // 净头寸：> 0 我欠人，< 0 人欠我
    lendCount: 0,
    borrowCount: 0,
    count: 0,
  }
}

// 一个账本（或任意交易数组）的全部借款汇总
function summarizeLoans(txs) {
  const s = emptySummary()
  ;(txs || []).forEach(t => {
    if (!isLoan(t)) return
    const amt = baseAmountOf(t)
    if (!amt) return
    s.count += 1
    if (isLoanOut(t)) { s.lendTotal += amt; s.lendCount += 1 }
    else if (isLoanIn(t)) { s.borrowTotal += amt; s.borrowCount += 1 }
  })
  s.lendTotal = round2(s.lendTotal)
  s.borrowTotal = round2(s.borrowTotal)
  s.net = round2(s.borrowTotal - s.lendTotal)
  return s
}

// 按对方聚合净欠款。
// 返回按「未结清且金额绝对值大」排前的数组；已结清（net = 0）的排到最后。
//   { party, lendTotal, borrowTotal, net, count, lastDate, open, items[] }
function groupByCounterparty(txs) {
  const map = {}
  ;(txs || []).forEach(t => {
    if (!isLoan(t)) return
    const party = counterpartyOf(t) || '未填写对方'
    const amt = baseAmountOf(t)
    if (!map[party]) {
      map[party] = {
        party, lendTotal: 0, borrowTotal: 0, net: 0,
        count: 0, lastDate: '', items: [],
      }
    }
    const g = map[party]
    g.count += 1
    if (amt) {
      if (isLoanOut(t)) g.lendTotal += amt
      else if (isLoanIn(t)) g.borrowTotal += amt
    }
    if (t.date && t.date > g.lastDate) g.lastDate = t.date
    g.items.push(t)
  })

  return Object.keys(map).map(k => {
    const g = map[k]
    g.lendTotal = round2(g.lendTotal)
    g.borrowTotal = round2(g.borrowTotal)
    g.net = round2(g.borrowTotal - g.lendTotal)
    g.open = g.net !== 0
    g.items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return g
  }).sort((a, b) => {
    // 未结清优先，其次按欠款绝对额降序
    if (a.open !== b.open) return a.open ? -1 : 1
    return Math.abs(b.net) - Math.abs(a.net)
  })
}

// 未结清概览：给首页提示条用
function openLoanOverview(txs) {
  const parties = groupByCounterparty(txs).filter(p => p.open)
  let receivable = 0   // 应收：别人欠我（净额 < 0，取正数）
  let payable = 0      // 应付：我欠别人（净额 > 0）
  parties.forEach(p => {
    if (p.net < 0) receivable += -p.net
    else payable += p.net
  })
  return {
    parties,
    partyCount: parties.length,
    receivable: round2(receivable),
    payable: round2(payable),
    net: round2(payable - receivable),   // > 0 净欠人
    open: parties.length > 0,
  }
}

// 从历史交易里提取「最近用过的对方」，供输入框联想
function recentCounterparties(txs, limit) {
  const max = limit || 8
  const seen = {}
  const list = []
  ;(txs || [])
    .filter(t => isLoan(t) && counterpartyOf(t))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .forEach(t => {
      const p = counterpartyOf(t)
      if (seen[p]) return
      seen[p] = true
      list.push(p)
    })
  return list.slice(0, max)
}

module.exports = {
  LOAN_IN,
  LOAN_OUT,
  LOAN_DIRECTIONS,
  isLoan,
  loanDirectionOf,
  isLoanIn,
  isLoanOut,
  counterpartyOf,
  loanLabel,
  loanBadge,
  signedLoanAmount,
  isReceivable,
  emptySummary,
  summarizeLoans,
  groupByCounterparty,
  openLoanOverview,
  recentCounterparties,
}
