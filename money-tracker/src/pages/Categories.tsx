import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { DEFAULT_CATEGORIES } from '../lib/categories'

interface Category {
  id: string
  name: string
  icon: string
  type: 'income' | 'expense'
  parent_id: string | null
  level: number
  children?: Category[]
}

export function Categories() {
  const { currentLedger } = useAppStore()
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([])
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formType, setFormType] = useState<'income' | 'expense'>('expense')
  const [formName, setFormName] = useState('')
  const [formIcon, setFormIcon] = useState('📌')
  const [formParentId, setFormParentId] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!currentLedger) return
    loadCategories()
  }, [currentLedger])

  const loadCategories = async () => {
    setIsLoading(true)
    try {
      // 获取自定义类别
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('ledger_id', currentLedger?.id)
        .order('level', { ascending: true })
        .order('name', { ascending: true })

      if (data) {
        // 构建树形结构
        const categoryMap = new Map<string, Category>()
        const rootCategories: Category[] = []

        data.forEach((cat: any) => {
          const category: Category = {
            ...cat,
            children: []
          }
          categoryMap.set(cat.id, category)
        })

        data.forEach((cat: any) => {
          if (cat.parent_id) {
            const parent = categoryMap.get(cat.parent_id)
            if (parent) {
              if (!parent.children) parent.children = []
              parent.children.push(categoryMap.get(cat.id)!)
            }
          } else {
            rootCategories.push(categoryMap.get(cat.id)!)
          }
        })

        const expense = rootCategories.filter(c => c.type === 'expense')
        const income = rootCategories.filter(c => c.type === 'income')
        setExpenseCategories(expense)
        setIncomeCategories(income)
      }
    } catch (error) {
      console.error('加载类别失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getMaxLevel = (parentId: string | null): number => {
    if (!parentId) return 1
    const findLevel = (id: string): number => {
      const allCats = [...expenseCategories, ...incomeCategories]
      const findInTree = (cats: Category[]): number => {
        for (const cat of cats) {
          if (cat.id === id) return cat.level
          if (cat.children) {
            const level = findInTree(cat.children)
            if (level > 0) return level
          }
        }
        return 0
      }
      return findInTree(allCats)
    }
    return findLevel(parentId) + 1
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentLedger || !formName) {
      alert('请输入类别名称')
      return
    }

    const level = formParentId ? getMaxLevel(formParentId) : 1
    if (level > 5) {
      alert('最多只能创建5级子类别')
      return
    }

    try {
      const { error } = await supabase
        .from('categories')
        .insert([{
          ledger_id: currentLedger.id,
          name: formName,
          icon: formIcon,
          type: formType,
          parent_id: formParentId,
          level: level
        }])

      if (error) {
        alert(`添加失败: ${error.message}`)
        return
      }

      await loadCategories()
      setFormName('')
      setFormIcon('📌')
      setFormParentId(null)
      setShowAddForm(false)
      alert('类别添加成功！')
    } catch (error: any) {
      alert(`添加失败: ${error.message}`)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('确定删除这个类别吗？')) return

    try {
      // 删除该类别及其所有子类别
      const deleteRecursive = async (categoryId: string) => {
        const { data: children } = await supabase
          .from('categories')
          .select('id')
          .eq('parent_id', categoryId)

        if (children) {
          for (const child of children) {
            await deleteRecursive(child.id)
          }
        }

        await supabase
          .from('categories')
          .delete()
          .eq('id', categoryId)
      }

      await deleteRecursive(id)
      await loadCategories()
      alert('类别已删除')
    } catch (error: any) {
      alert(`删除失败: ${error.message}`)
    }
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedCategories(newExpanded)
  }

  const renderCategoryTree = (categories: Category[], type: 'income' | 'expense') => {
    return (
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <div className="flex items-center gap-2 flex-1">
                {cat.children && cat.children.length > 0 && (
                  <button
                    onClick={() => toggleExpanded(cat.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {expandedCategories.has(cat.id) ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>
                )}
                {!cat.children || cat.children.length === 0 && <div className="w-6" />}
                <span className="text-2xl">{cat.icon}</span>
                <div>
                  <p className="font-medium">{cat.name}</p>
                  <p className="text-xs text-gray-500">第 {cat.level} 级</p>
                </div>
              </div>
              <div className="flex gap-2">
                {cat.level < 5 && (
                  <button
                    onClick={() => {
                      setFormParentId(cat.id)
                      setFormType(type)
                      setShowAddForm(true)
                    }}
                    className="p-2 hover:bg-blue-100 rounded text-blue-600 transition"
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="p-2 hover:bg-red-100 rounded text-red-600 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* 子类别 */}
            {cat.children && cat.children.length > 0 && expandedCategories.has(cat.id) && (
              <div className="ml-6 space-y-2 mt-2">
                {renderCategoryTree(cat.children, type)}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (!currentLedger) {
    return <div className="p-4 text-center text-gray-500">请先选择账本</div>
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📂 类别管理</h1>
        <button
          onClick={() => {
            setFormParentId(null)
            setShowAddForm(!showAddForm)
          }}
          className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* 添加类别表单 */}
      {showAddForm && (
        <form onSubmit={handleAddCategory} className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">类型</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">类别名称</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：餐饮、交通"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">图标</label>
              <input
                type="text"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder="输入 emoji 图标"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {formParentId && (
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                ℹ️ 添加为子类别（最多5级）
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
              >
                添加类别
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setFormParentId(null)
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        <>
          {/* 支出类别 */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-red-600">支出类别</h2>

            {/* 预置类别 */}
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">预置类别</p>
              <div className="grid grid-cols-3 gap-2">
                {DEFAULT_CATEGORIES.expense.map((cat) => (
                  <div
                    key={cat.name}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center hover:bg-gray-100 transition"
                  >
                    <p className="text-2xl mb-1">{cat.icon}</p>
                    <p className="text-sm font-medium">{cat.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 自定义类别 */}
            {expenseCategories.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-3">自定义类别</p>
                {renderCategoryTree(expenseCategories, 'expense')}
              </div>
            )}
          </div>

          {/* 收入类别 */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-green-600">收入类别</h2>

            {/* 预置类别 */}
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">预置类别</p>
              <div className="grid grid-cols-3 gap-2">
                {DEFAULT_CATEGORIES.income.map((cat) => (
                  <div
                    key={cat.name}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center hover:bg-gray-100 transition"
                  >
                    <p className="text-2xl mb-1">{cat.icon}</p>
                    <p className="text-sm font-medium">{cat.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 自定义类别 */}
            {incomeCategories.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-3">自定义类别</p>
                {renderCategoryTree(incomeCategories, 'income')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
