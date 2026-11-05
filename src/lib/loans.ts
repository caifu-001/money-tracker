// src/lib/loans.ts
// 借款记账工具层 —— 与小程序 utils/loans.js 同一套口径，供 Web 端复用。
//
// 口径（与数据库 022_loans.sql 一致）：
//   · 借款账目的 type 仍是 income / expense，用 is_loan 标记区分
//   · 方向由 type 推断：
//       expense + is_loan → 资金流出：借出 / 归还欠款
//       income  + is_loan → 资金流入：借入 / 收回欠款
//   · 净额法汇总欠款，不需要把「借出」和「还款」配对：
//       净额 = 该对方借款收入合计 − 该对方借款支出合计
//       净额 > 0 → 我欠对方（应付）  净额 < 0 → 对方欠我（应收）  净额 = 0 → 已结清
//     所以「还钱」只需反向记一笔，两条自动抵消，无需状态字段
//   · 借款不计入收支统计（见 statAmount），但仍会真实改变资金（账户余额口径）

export type LoanDirection = 'out' | 'in'

export interface LoanTransaction {
  id?: string
  amount?: number | string
  base_amount?: number | string | null
  type?: string
  category?: string
  note?: string
  date?: string
  is_loan?: boolean | string | null
  loan_counterparty?: string | null
  [key: string]: any
}

export const LOAN_OUT: LoanDirection = 'out'
export const LOAN_IN: LoanDirection = 'in'

export const LOAN_DIRECTIONS: Record<LoanDirection, {
  code: LoanDirection
  label: string
  icon: string
  debtLabel: string
  hint: string
}> = {
  out: { code: LOAN_OUT, label: '借出', icon: '📤', debtLabel: '待收回', hint: '钱借给别人，对方欠你' },
  in:  { code: LOAN_IN,  label: '借入', icon: '📥', debtLabel: '待偿还', hint: '向别人借钱，你欠对方' },
}

// 借款专用分类名（分类网格被隐藏，直接写死一个可识别的名字）
export const LOAN_CATEGORY: Record<LoanDirection, string> = {
  out: '🤝 借出',
  in:  '🤝 借入',
}

function num(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ── 基础判断 ────────────────────────────────────────────────
export function isLoan(tx: LoanTransaction | null | undefined): boolean {
  if (!tx) return false
  return tx.is_loan === true || tx.is_loan === 'true'
}

export function loanDirectionOf(tx: LoanTransaction): LoanDirection | null {
  if (!isLoan(tx)) return null
  if (tx.type === 'expense') return LOAN_OUT
  if (tx.type === 'income') return LOAN_IN
  return null
}

export const isLoanOut = (tx: LoanTransaction) => loanDirectionOf(tx) === LOAN_OUT
export const isLoanIn  = (tx: LoanTransaction) => loanDirectionOf(tx) === LOAN_IN

// 对方名称（去空白，防止「张三 」和「张三」被当成两个人）
export function counterpartyOf(tx: LoanTransaction): string {
  if (!isLoan(tx)) return ''
  return String(tx.loan_counterparty || '').trim()
}

export function loanLabel(tx: LoanTransaction): string {
  const d = loanDirectionOf(tx)
  return d ? LOAN_DIRECTIONS[d].label : ''
}

export function loanBadge(tx: LoanTransaction): string {
  const d = loanDirectionOf(tx)
  return d ? `🤝${LOAN_DIRECTIONS[d].label}` : ''
}

// ── 金额口径 ────────────────────────────────────────────────
// 借款的真实金额：优先 base_amount（小程序记的外币账会带），否则 amount
export function loanAmountOf(tx: LoanTransaction): number {
  const base = tx.base_amount
  if (base !== null && base !== undefined && base !== '') return num(base)
  return num(tx.amount)
}

// 统计口径：借款一律返回 0，从而天然排除在所有收支汇总之外。
// 非借款保持 Web 端原有行为（直接用 amount），避免改变历史数字。
export function statAmount(tx: LoanTransaction): number {
  if (isLoan(tx)) return 0
  return num(tx.amount)
}

// 带符号的借款金额：借入为正、借出为负 → 直接累加即得净头寸
export function signedLoanAmount(tx: LoanTransaction): number {
  const d = loanDirectionOf(tx)
  if (!d) return 0
  const amt = loanAmountOf(tx)
  return d === LOAN_IN ? amt : -amt
}

export const isReceivable = (tx: LoanTransaction) => isLoanOut(tx)

// ── 汇总 ────────────────────────────────────────────────────
export interface LoanSummary {
  lendTotal: number
  borrowTotal: number
  net: number
  lendCount: number
  borrowCount: number
  count: number
}

export function summarizeLoans(txs: LoanTransaction[] | null | undefined): LoanSummary {
  const s: LoanSummary = { lendTotal: 0, borrowTotal: 0, net: 0, lendCount: 0, borrowCount: 0, count: 0 }
  ;(txs || []).forEach(t => {
    if (!isLoan(t)) return
    const amt = loanAmountOf(t)
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

export interface CounterpartyGroup {
  party: string
  lendTotal: number
  borrowTotal: number
  net: number
  count: number
  lastDate: string
  open: boolean
  items: LoanTransaction[]
}

// 按对方聚合净欠款：未结清优先，其次按欠款绝对额降序
export function groupByCounterparty(txs: LoanTransaction[] | null | undefined): CounterpartyGroup[] {
  const map: Record<string, CounterpartyGroup> = {}
  ;(txs || []).forEach(t => {
    if (!isLoan(t)) return
    const party = counterpartyOf(t) || '未填写对方'
    const amt = loanAmountOf(t)
    if (!map[party]) {
      map[party] = { party, lendTotal: 0, borrowTotal: 0, net: 0, count: 0, lastDate: '', open: false, items: [] }
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
    g.items.sort((a, b) => (String(a.date) < String(b.date) ? 1 : String(a.date) > String(b.date) ? -1 : 0))
    return g
  }).sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1
    return Math.abs(b.net) - Math.abs(a.net)
  })
}

export interface LoanOverview {
  parties: CounterpartyGroup[]
  partyCount: number
  receivable: number   // 别人欠我
  payable: number      // 我欠别人
  net: number          // > 0 净欠人
  open: boolean
}

export function openLoanOverview(txs: LoanTransaction[] | null | undefined): LoanOverview {
  const parties = groupByCounterparty(txs).filter(p => p.open)
  let receivable = 0
  let payable = 0
  parties.forEach(p => {
    if (p.net < 0) receivable += -p.net
    else payable += p.net
  })
  return {
    parties,
    partyCount: parties.length,
    receivable: round2(receivable),
    payable: round2(payable),
    net: round2(payable - receivable),
    open: parties.length > 0,
  }
}

// 最近用过的对方，供输入联想
export function recentCounterparties(txs: LoanTransaction[] | null | undefined, limit = 8): string[] {
  const seen: Record<string, boolean> = {}
  const list: string[] = []
  ;(txs || [])
    .filter(t => isLoan(t) && !!counterpartyOf(t))
    .sort((a, b) => (String(a.date) < String(b.date) ? 1 : String(a.date) > String(b.date) ? -1 : 0))
    .forEach(t => {
      const p = counterpartyOf(t)
      if (seen[p]) return
      seen[p] = true
      list.push(p)
    })
  return list.slice(0, limit)
}
