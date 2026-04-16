// 预置的记账类别（含子分类）
export const DEFAULT_CATEGORIES = {
  expense: [
    { name: '食物', icon: '🍔', children: [
      { name: '早午晚餐', icon: '🍜' }, { name: '水果零食', icon: '🍎' },
      { name: '饮料咖啡', icon: '☕' }, { name: '外卖', icon: '📦' },
    ]},
    { name: '交通', icon: '🚗', children: [
      { name: '油费', icon: '⛽' }, { name: '停车费', icon: '🅿️' },
      { name: '公交地铁', icon: '🚇' }, { name: '打车', icon: '🚕' }, { name: '保养维修', icon: '🔧' },
    ]},
    { name: '购物', icon: '🛍️', children: [
      { name: '服装', icon: '👔' }, { name: '日用品', icon: '🧴' },
      { name: '数码', icon: '📱' }, { name: '美妆护肤', icon: '💄' },
    ]},
    { name: '娱乐', icon: '🎮', children: [
      { name: '电影', icon: '🎬' }, { name: '游戏', icon: '🎯' },
      { name: '聚餐社交', icon: '🍻' }, { name: '健身', icon: '💪' },
    ]},
    { name: '医疗', icon: '⚕️', children: [
      { name: '门诊', icon: '🏥' }, { name: '药店', icon: '💊' }, { name: '体检', icon: '🩺' },
    ]},
    { name: '教育', icon: '📚', children: [
      { name: '学费', icon: '🎓' }, { name: '培训', icon: '📖' }, { name: '书籍文具', icon: '✏️' },
    ]},
    { name: '住房', icon: '🏠', children: [
      { name: '房租', icon: '🔑' }, { name: '房贷', icon: '🏦' },
      { name: '物业费', icon: '🏢' }, { name: '装修', icon: '🛠️' },
    ]},
    { name: '水电', icon: '💡', children: [
      { name: '电费', icon: '⚡' }, { name: '水费', icon: '💧' }, { name: '燃气费', icon: '🔥' },
    ]},
    { name: '通讯', icon: '📱', children: [
      { name: '手机费', icon: '📲' }, { name: '宽带费', icon: '📡' },
    ]},
    { name: '保险', icon: '🛡️', children: [
      { name: '医疗险', icon: '🏥' }, { name: '车险', icon: '🚗' }, { name: '寿险', icon: '👤' },
    ]},
    { name: '旅游', icon: '✈️', children: [
      { name: '机票火车', icon: '🎫' }, { name: '酒店民宿', icon: '🏨' }, { name: '景点门票', icon: '🎟️' },
    ]},
    { name: '其他', icon: '📌', children: [] },
  ],
  income: [
    { name: '工资', icon: '💰', children: [
      { name: '基本工资', icon: '💵' }, { name: '绩效', icon: '📊' }, { name: '补贴', icon: '🎁' },
    ]},
    { name: '奖金', icon: '🏆', children: [
      { name: '年终奖', icon: '🎄' }, { name: '项目奖', icon: '⭐' }, { name: '全勤奖', icon: '🌟' },
    ]},
    { name: '投资', icon: '📈', children: [
      { name: '股票', icon: '📉' }, { name: '基金', icon: '📊' },
      { name: '理财', icon: '💹' }, { name: '利息', icon: '💸' },
    ]},
    { name: '兼职', icon: '💼', children: [
      { name: '副业', icon: '🖥️' }, { name: '外包', icon: '📐' },
    ]},
    { name: '其他', icon: '📌', children: [] },
  ]
}

export const getCategoryIcon = (categoryName: string, type: 'income' | 'expense') => {
  const categories = DEFAULT_CATEGORIES[type]
  const category = categories.find(c => c.name === categoryName)
  return category?.icon || '📌'
}

export const getCategoryColor = (categoryName: string, type: 'income' | 'expense') => {
  const categories = DEFAULT_CATEGORIES[type]
  const category = (categories as any[]).find((c: any) => c.name === categoryName)
  return (category as any)?.color || '#B4A7D6'
}