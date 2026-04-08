import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, ChevronRight, Check, X } from 'lucide-react'
import { DEFAULT_CATEGORIES } from '../lib/categories'

interface CatNode {
  id: string
  name: string
  icon: string
  type: 'income' | 'expense'
  parent_id: string | null
  level: number
  children: CatNode[]
  isEditing?: boolean
  editName?: string
  editIcon?: string
}

function buildTree(data: any[]): CatNode[] {
  const map = new Map()
  data.forEach((c: any) => map.set(c.id, { ...c, children: [] }))
  const roots: any[] = []
  data.forEach((c: any) => {
    const node = map.get(c.id)
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

export function Categories() {
  const { currentLedger } = useAppStore()
  const [expenseTree, setExpenseTree] = useState<CatNode[]>([])
  const [incomeTree, setIncomeTree] = useState<CatNode[]>([])
  const [allCats, setAllCats] = useState<CatNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<'expense' | 'income'>('expense')
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'income' | 'expense'>('expense')
  const [formName, setFormName] = useState('')
  const [formIcon, setFormIcon] = useState('📌')
  const [formParentId, setFormParentId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = async () => {
    if (!currentLedger) return
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from('categories').select('*').eq('ledger_id', currentLedger.id).order('level')

      // DB 为空 → 初始化预置
      if (!data || data.length === 0) {
        const rows: any[] = []
        ;(DEFAULT_CATEGORIES.expense as any[]).forEach(c => rows.push({
          ledger_id: currentLedger.id, name: c.name,
          icon: c.icon || '📌', type: 'expense', parent_id: null, level: 1,
        }))
        ;(DEFAULT_CATEGORIES.income as any[]).forEach(c => rows.push({
          ledger_id: currentLedger.id, name: c.name,
          icon: c.icon || '📌', type: 'income', parent_id: null, level: 1,
        }))
        await supabase.from('categories').insert(rows).then(r => { if (r.error) console.error(r.error) })
        const { data: fresh } = await supabase.from('categories').select('*').eq('ledger_id', currentLedger.id).order('level')
        apply(fresh || [])
      } else {
        apply(data)
      }
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  function apply(data: any[]) {
    const exp = (data || []).filter((c: any) => c.type === 'expense')
    const inc = (data || []).filter((c: any) => c.type === 'income')
    setExpenseTree(buildTree(exp))
    setIncomeTree(buildTree(inc))
    setAllCats(buildTree(data || []))
  }

  useEffect(() => { load() }, [currentLedger])

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('删除该类别？其所有子类别也会被删除。')) return
    const del = async (catId: string) => {
      const { data } = await supabase.from('categories').select('id').eq('parent_id', catId)
      if (data) for (const k of data) await del(k.id)
      const { error } = await supabase.from('categories').delete().eq('id', catId).eq('ledger_id', currentLedger?.id)
      if (error) { alert('删除失败：' + (error.message || error)); return }
    }
    await del(id)
    load()
  }

  // 递归查找节点（用于扁平化查找所有层级）
  const findNode = (nodes: CatNode[], id: string): CatNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children.length > 0) {
        const found = findNode(n.children, id)
        if (found) return found
      }
    }
    return null
  }

  const handleEditSave = async (node: CatNode) => {
    console.log('[handleEditSave] node.id:', node.id)
    const n = findNode(allCats, node.id)
    console.log('[handleEditSave] found node:', n)
    if (!n?.editName?.trim()) { alert('名称不能为空'); return }
    const { error } = await supabase.from('categories')
      .update({ name: n.editName.trim(), icon: n.editIcon || '📌' })
      .eq('id', node.id)
      .eq('ledger_id', currentLedger?.id)
    if (error) { alert('保存失败：' + (error.message || error)); return }
    load()
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) { alert('请输入类别名称'); return }
    const parentLevel = formParentId ? (allCats.find(c => c.id === formParentId)?.level || 0) : 0
    const level = formParentId ? parentLevel + 1 : 1
    if (level > 5) { alert('最多5级'); return }
    const { error } = await supabase.from('categories').insert([{
      ledger_id: currentLedger?.id, name: formName.trim(), icon: formIcon, type: formType,
      parent_id: formParentId, level,
    }])
    if (error) { alert('添加失败：' + (error.message || error)); return }
    setShowForm(false); setFormName(''); setFormIcon('📌'); setFormParentId(null)
    load()
  }

  // 递归更新节点
  const updateNodeInTree = (nodes: CatNode[], id: string, updater: (n: CatNode) => CatNode): CatNode[] => {
    return nodes.map(n => {
      if (n.id === id) return updater(n)
      if (n.children.length > 0) {
        return { ...n, children: updateNodeInTree(n.children, id, updater) }
      }
      return n
    })
  }

  const handleEditStart = (node: CatNode) => {
    console.log('[handleEditStart] node.id:', node.id, 'node.type:', node.type)
    const updater = (c: CatNode) => ({ ...c, isEditing: true, editName: c.name, editIcon: c.icon })
    setAllCats(prev => updateNodeInTree(prev, node.id, updater))
    if (node.type === 'expense') {
      setExpenseTree(prev => {
        const updated = updateNodeInTree(prev, node.id, updater)
        console.log('[handleEditStart] expenseTree updated, checking first node:', JSON.stringify(updated[0]?.isEditing))
        return updated
      })
    } else {
      setIncomeTree(prev => updateNodeInTree(prev, node.id, updater))
    }
  }

  const handleEditCancel = (node: CatNode) => {
    const updater = (c: CatNode) => ({ ...c, isEditing: false })
    setAllCats(prev => updateNodeInTree(prev, node.id, updater))
    if (node.type === 'expense') {
      setExpenseTree(prev => updateNodeInTree(prev, node.id, updater))
    } else {
      setIncomeTree(prev => updateNodeInTree(prev, node.id, updater))
    }
  }

  function renderNode(node: CatNode, depth = 0): React.ReactNode {
    const isExp = node.type === 'expense'
    const accent = isExp ? '#ef4444' : '#22c55e'
    const hasSubs = node.children.length > 0
    const isExpanded = expanded.has(node.id)
    const isEditing = node.isEditing
    const maxLevel = 5

    return (
      <div key={node.id} style={{ marginLeft: depth * 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', padding: '12px 14px', marginBottom: 4, borderRadius: 14,
          background: isEditing ? '#f5f3ff' : '#f9f9f9',
          transition: 'all 0.15s',
        }}>
          {/* 展开/折叠 */}
          {hasSubs ? (
            <button onClick={() => toggleExpand(node.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <ChevronRight size={16} color="#9ca3af" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '0.15s' }}/>
            </button>
          ) : <div style={{ width: 24 }}/>}

          {/* 图标 */}
          {isEditing ? (
            <input value={node.editIcon || ''} onChange={e => {
              const val = e.target.value
              const updater = (c: CatNode) => ({ ...c, editIcon: val })
              setAllCats(prev => updateNodeInTree(prev, node.id, updater))
              if (node.type === 'expense') setExpenseTree(prev => updateNodeInTree(prev, node.id, updater))
              else setIncomeTree(prev => updateNodeInTree(prev, node.id, updater))
            }}
              style={{ width: 36, textAlign: 'center', fontSize: 18, border: '1.5px solid #c7d2fe', borderRadius: 8, background: 'white', outline: 'none', marginRight: 8, flexShrink: 0 }}/>
          ) : (
            <span style={{ fontSize: 20, marginRight: 8, flexShrink: 0 }}>{node.icon}</span>
          )}

          {/* 名称 */}
          {isEditing ? (
            <input value={node.editName || ''} onChange={e => {
              const val = e.target.value
              const updater = (c: CatNode) => ({ ...c, editName: val })
              setAllCats(prev => updateNodeInTree(prev, node.id, updater))
              if (node.type === 'expense') setExpenseTree(prev => updateNodeInTree(prev, node.id, updater))
              else setIncomeTree(prev => updateNodeInTree(prev, node.id, updater))
            }}
              style={{ flex: 1, padding: '6px 10px', border: '1.5px solid #c7d2fe', borderRadius: 8, fontSize: 14, outline: 'none', marginRight: 8 }}/>
          ) : (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 14, color: '#1f2937', margin: 0 }}>{node.name}</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>第{node.level}级 {hasSubs ? `· ${node.children.length}个子类` : ''}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {isEditing ? (
              <>
                <button onClick={() => handleEditSave(node)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#dcfce7', color: '#16a34a' }}>
                  <Check size={14}/>
                </button>
                <button onClick={() => handleEditCancel(node)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f3f4f6', color: '#6b7280' }}>
                  <X size={14}/>
                </button>
              </>
            ) : (
              <>
                {node.level < maxLevel && (
                  <button onClick={() => { setFormParentId(node.id); setFormType(node.type); setShowForm(true) }}
                    title="添加子类" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#eef2ff', color: '#6366f1' }}>
                    <Plus size={13}/>
                  </button>
                )}
                <button onClick={() => handleEditStart(node)} title="编辑" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#dbeafe', color: '#2563eb' }}>
                  <span style={{ fontSize: 12 }}>✏️</span>
                </button>
                <button onClick={() => handleDelete(node.id)} title="删除" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fef2f2', color: '#ef4444' }}>
                  <Trash2 size={13}/>
                </button>
              </>
            )}
          </div>
        </div>

        {hasSubs && isExpanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  const tree = tab === 'expense' ? expenseTree : incomeTree

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '16px 16px 100px' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937' }}>📂 类别管理</h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>✏️ 编辑 · ➕ 添加子类 · 🗑 删除</p>
        </div>
        <button onClick={() => { setFormParentId(null); setFormType(tab); setShowForm(!showForm) }}
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
          + 新建
        </button>
      </div>

      {/* 新建表单 */}
      {showForm && (
        <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginBottom: 16 }}>
            {formParentId ? `➕ 添加为子类别（第 ${(allCats.find(c => c.id === formParentId)?.level || 0) + 1} 级）` : '➕ 新建一级类别'}
          </p>
          {formParentId && (() => {
            const p = allCats.find(c => c.id === formParentId)
            return p ? (
              <div style={{ background: '#eef2ff', borderRadius: 12, padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <span style={{ fontWeight: 700, color: '#4338ca' }}>{p.name}</span>
                <span style={{ fontSize: 12, color: '#818cf8' }}>的子类别</span>
              </div>
            ) : null
          })()}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['expense','income'] as const).map(t => (
              <button key={t} onClick={() => setFormType(t)} disabled={!!formParentId}
                style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 13, cursor: formParentId ? 'not-allowed' : 'pointer', opacity: formParentId ? 0.5 : 1,
                  background: formType === t ? (t === 'expense' ? '#fee2e2' : '#dcfce7') : '#f3f4f6',
                  color: formType === t ? (t === 'expense' ? '#dc2626' : '#16a34a') : '#9ca3af' }}>
                {t === 'expense' ? '💸 支出' : '💰 收入'}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>图标</label>
              <input type="text" value={formIcon} onChange={e => setFormIcon(e.target.value)}
                style={{ width: '100%', padding: '8px 4px', textAlign: 'center', fontSize: 20, border: '1.5px solid #e5e7eb', borderRadius: 10, outline: 'none' }}/>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>名称</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="例如：餐饮、工资"
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" onClick={handleAdd}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
              ✓ 确认添加
            </button>
            <button onClick={() => { setShowForm(false); setFormParentId(null) }}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 收支切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['expense','income'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
              background: tab === t ? (t === 'expense' ? '#ef4444' : '#22c55e') : 'white',
              color: tab === t ? 'white' : '#9ca3af',
              boxShadow: tab === t ? (t === 'expense' ? '0 4px 14px rgba(239,68,68,0.3)' : '0 4px 14px rgba(34,197,94,0.3)') : '0 1px 4px rgba(0,0,0,0.06)',
            }}>
            {t === 'expense' ? `💸 支出（${expenseTree.length}）` : `💰 收入（${incomeTree.length}）`}
          </button>
        ))}
      </div>

      {/* 类别列表 */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}/>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>加载中...</p>
        </div>
      ) : tree.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 20 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
          <p style={{ color: '#9ca3af', fontWeight: 600, fontSize: 15 }}>暂无{t === 'expense' ? '支出' : '收入'}类别</p>
          <p style={{ color: '#d1d5db', fontSize: 13, marginTop: 6 }}>点击右上角「新建」添加</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 20, padding: 8, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          {tree.map(node => renderNode(node))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
