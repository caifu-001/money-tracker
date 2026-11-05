interface BudgetBarProps {
  category: string
  spent: number
  budget: number
}

export function BudgetBar({ category, spent, budget }: BudgetBarProps) {
  const percentage = Math.min((spent / budget) * 100, 100)
  const isOverBudget = spent > budget

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">{category}</span>
        <span className={`text-sm font-semibold ${isOverBudget ? 'text-red-500' : 'text-gray-600'}`}>
          ¥{spent.toFixed(2)} / ¥{budget.toFixed(2)}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {percentage.toFixed(0)}% 已使用
      </div>
    </div>
  )
}
