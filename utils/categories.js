// utils/categories.js - 预置记账类别（支持最多4级）
const DEFAULT_INCOME_CATEGORIES = [
  { name: '工资收入', icon: '💰' },
  { name: '兼职收入', icon: '💼' },
  { name: '废品回收', icon: '♻️' },
  { name: '人情往来', icon: '🎁', children: [
    { name: '红包礼金' },
  ]},
]

const DEFAULT_EXPENSE_CATEGORIES = [
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

// 递归插入，返回当前层级 ID 映射 { name -> dbId }
// 跳过已存在的分类（不删除用户自定义分类）
async function flattenAndInsert(supabase, ledgerId, type, nodes, parentId, level) {
  if (!nodes || nodes.length === 0) return
  // 查询当前层级已有分类名
  let query = supabase.from('categories')
    .select('id,name').eq('ledger_id', ledgerId).eq('type', type).eq('level', level)
  if (parentId) {
    query = query.eq('parent_id', parentId)
  } else {
    query = query.is('parent_id', null)
  }
  const { data: existing } = await query
  const existNames = new Set((existing || []).map(r => r.name))

  const toInsert = nodes.filter(n => !existNames.has(n.name))
  if (toInsert.length === 0) {
    // 全部已存在，但仍需递归子级
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        const parentRow = (existing || []).find(r => r.name === node.name)
        if (parentRow) {
          await flattenAndInsert(supabase, ledgerId, type, node.children, parentRow.id, level + 1)
        }
      }
    }
    return
  }

  const rows = toInsert.map(n => ({
    ledger_id: ledgerId,
    name: n.name,
    icon: n.icon || '📌',
    type,
    parent_id: parentId || null,
    level,
  }))
  const { data, error } = await supabase.from('categories').insert(rows).select('id,name')
  if (error) { console.error('insert categories error:', error); return }

  // 合并已有和新建的数据
  const allRows = [...(existing || []), ...(data || [])]

  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const parentRow = allRows.find(r => r.name === node.name)
      if (parentRow) {
        await flattenAndInsert(supabase, ledgerId, type, node.children, parentRow.id, level + 1)
      }
    }
  }
}

/**
 * 初始化账本默认分类（支持最多4级）
 */
async function initDefaultCategories(supabase, ledgerId) {
  await flattenAndInsert(supabase, ledgerId, 'income',  DEFAULT_INCOME_CATEGORIES,  null, 1)
  await flattenAndInsert(supabase, ledgerId, 'expense', DEFAULT_EXPENSE_CATEGORIES, null, 1)
  return true
}

module.exports = { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, initDefaultCategories }
