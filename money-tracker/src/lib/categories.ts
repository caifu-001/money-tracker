// 预置的记账类别
export const DEFAULT_CATEGORIES = {
  expense: [
    { name: '食物', icon: '🍔', color: '#FF6B6B' },
    { name: '交通', icon: '🚗', color: '#4ECDC4' },
    { name: '娱乐', icon: '🎮', color: '#FFE66D' },
    { name: '购物', icon: '🛍️', color: '#FF69B4' },
    { name: '医疗', icon: '⚕️', color: '#95E1D3' },
    { name: '教育', icon: '📚', color: '#A8E6CF' },
    { name: '住房', icon: '🏠', color: '#FFD3B6' },
    { name: '水电', icon: '💡', color: '#FFAAA5' },
    { name: '通讯', icon: '📱', color: '#AA96DA' },
    { name: '保险', icon: '🛡️', color: '#FCBAD3' },
    { name: '旅游', icon: '✈️', color: '#A1D3B0' },
    { name: '其他', icon: '📌', color: '#B4A7D6' },
  ],
  income: [
    { name: '工资', icon: '💰', color: '#52B788' },
    { name: '奖金', icon: '🎁', color: '#74C69D' },
    { name: '投资', icon: '📈', color: '#40916C' },
    { name: '兼职', icon: '💼', color: '#2D6A4F' },
    { name: '其他', icon: '📌', color: '#1B4332' },
  ]
}

export const getCategoryIcon = (categoryName: string, type: 'income' | 'expense') => {
  const categories = DEFAULT_CATEGORIES[type]
  const category = categories.find(c => c.name === categoryName)
  return category?.icon || '📌'
}

export const getCategoryColor = (categoryName: string, type: 'income' | 'expense') => {
  const categories = DEFAULT_CATEGORIES[type]
  const category = categories.find(c => c.name === categoryName)
  return category?.color || '#B4A7D6'
}
