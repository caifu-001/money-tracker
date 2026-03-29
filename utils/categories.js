// utils/categories.js - 默认类别（兜底）
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '食物', icon: '🍔' }, { name: '交通', icon: '🚗' },
  { name: '娱乐', icon: '🎮' }, { name: '购物', icon: '🛍️' },
  { name: '医疗', icon: '⚕️' }, { name: '教育', icon: '📚' },
  { name: '住房', icon: '🏠' }, { name: '水电', icon: '💡' },
  { name: '通讯', icon: '📱' }, { name: '保险', icon: '🛡️' },
  { name: '旅游', icon: '✈️' }, { name: '其他', icon: '📌' },
]

const DEFAULT_INCOME_CATEGORIES = [
  { name: '工资', icon: '💰' }, { name: '奖金', icon: '🎁' },
  { name: '投资', icon: '📈' }, { name: '兼职', icon: '💼' },
  { name: '其他', icon: '📌' },
]

module.exports = { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES }
