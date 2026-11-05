// 预置记账类别（支持最多4级）
export interface CategoryNode {
  name: string
  icon?: string
  children?: CategoryNode[]
}

export const DEFAULT_CATEGORIES: Record<'expense' | 'income', CategoryNode[]> = {
  income: [
    { name: '工资收入', icon: '💰' },
    { name: '兼职收入', icon: '💼' },
    { name: '废品回收', icon: '♻️' },
    { name: '人情往来', icon: '🎁', children: [
      { name: '红包礼金' },
    ]},
  ],
  expense: [
    {
      name: '居家', icon: '🏠', children: [
        { name: '买菜原料' },
        { name: '物业管理费' },
        { name: '水电气费', children: [
          { name: '水费' },
          { name: '电费' },
          { name: '天然气费' },
        ]},
        { name: '衣物', children: [
          { name: '衣裤' },
          { name: '鞋子' },
        ]},
        { name: '交通', children: [
          { name: '公交地铁' },
          { name: '火车客运' },
          { name: '飞机' },
          { name: '打车费' },
        ]},
        { name: '日化用品' },
        { name: '电器' },
        { name: '家具' },
        { name: '房贷月供' },
        { name: '工具' },
        { name: '装备' },
      ]
    },
    {
      name: '旅游', icon: '✈️', children: [
        { name: '门票' },
        { name: '住宿' },
        { name: '交通' },
        { name: '装备' },
        { name: '购物' },
      ]
    },
    {
      name: '养车', icon: '🚗', children: [
        { name: '保险费' },
        { name: '停车费' },
        { name: '过路费' },
        { name: '油费' },
        { name: '保养费' },
        { name: '年检费' },
        { name: '配件费' },
        { name: '罚款费' },
      ]
    },
    {
      name: '医疗', icon: '🏥', children: [
        { name: '挂号费' },
        { name: '检车费' },
        { name: '药品费' },
        { name: '住院费' },
      ]
    },
    {
      name: '人情往来', icon: '🎁', children: [
        { name: '红包礼金' },
        { name: '礼品' },
      ]
    },
  ]
}

function genId(): string {
  return typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function buildDefaultCategoryRows(ledgerId: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  function flatten(
    nodes: CategoryNode[],
    type: 'income' | 'expense',
    level: number,
    parentId: string | null
  ) {
    for (const node of nodes) {
      const id = genId()
      rows.push({
        id,
        ledger_id: ledgerId,
        name: node.name,
        icon: node.icon || '📌',
        type,
        parent_id: parentId,
        level,
      })
      if (node.children && node.children.length > 0) {
        flatten(node.children, type, level + 1, id)
      }
    }
  }

  flatten(DEFAULT_CATEGORIES.income, 'income', 1, null)
  flatten(DEFAULT_CATEGORIES.expense, 'expense', 1, null)
  return rows
}
