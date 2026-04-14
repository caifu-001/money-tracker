import { useEffect, useState, useRef } from 'react'
  const [showAbout, setShowAbout] = useState(false)
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Check, Trash2, Copy, UserPlus, Users, Download, Upload, FileText, Shield } from 'lucide-react'

// ── 导入导出面板 ─────────────────────────────────────────────────────────────
function ImportExportPanel() {
  const { currentLedger, user } = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exportRange, setExportRange] = useState<'month' | 'all'>('all')
  const [exportMonth, setExportMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [importing, setImporting] = useState(false)
  const [importingMsg, setImportingMsg] = useState('')
  const [importingOk, setImportingOk] = useState<number | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [importData, setImportData] = useState<any>(null)
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge')
  const [exporting, setExporting] = useState(false)

  const fmt = (n: number) => (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // 导出 CSV（仅当前账本的交易）
  const handleExportCSV = async () => {
    if (!currentLedger) { alert('请先选择一个账本'); return }
    setExporting(true)
    try {
      let query = supabase
        .from('transactions').select('*')
        .eq('ledger_id', currentLedger.id)
        .order('date', { ascending: false })

      if (exportRange === 'month') {
        const [y, m] = exportMonth.split('-')
        const start = `${y}-${m}-01`
        const end = `${y}-${m}-31`
        query = query.gte('date', start).lte('date', end)
      }

      const { data } = await query
      const rows = (data || []).map((t: any) => [
        t.date, t.type === 'income' ? '收入' : '支出',
        t.category || '', t.amount, t.note || '', t.payment_method || ''
      ])
      const csv = [
        ['日期', '类型', '类别', '金额', '备注', '支付方式'].join(','),
        ...rows.map((r: any[]) => r.map((c: any) => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `游游记账_${currentLedger.name}_${exportRange === 'month' ? exportMonth : '全部'}.csv`
      a.click(); URL.revokeObjectURL(url)
    } catch (e: any) { alert('导出失败：' + e.message) }
    finally { setExporting(false) }
  }

  // 导出 JSON（全量备份：账本+类别+交易+预算）
  const handleExportJSON = async () => {
    if (!user) return
    setExporting(true)
    try {
      const [{ data: ledgers }, { data: cats }, { data: txs }, { data: budgets }] = await Promise.all([
        supabase.from('ledgers').select('*').eq('owner_id', user.id),
        currentLedger ? supabase.from('categories').select('*').eq('ledger_id', currentLedger.id) : Promise.resolve({ data: [] }),
        currentLedger ? supabase.from('transactions').select('*').eq('ledger_id', currentLedger.id).order('date') : Promise.resolve({ data: [] }),
        currentLedger ? supabase.from('budgets').select('*').eq('ledger_id', currentLedger.id) : Promise.resolve({ data: [] }),
      ])
      const backup = {
        version: 1, app: '游游记账', exportedAt: new Date().toISOString(),
        ledgerName: currentLedger?.name || '',
        ledgers, categories: cats, transactions: txs, budgets
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `游游记账_备份_${new Date().toISOString().slice(0,10)}.json`
      a.click(); URL.revokeObjectURL(url)
    } catch (e: any) { alert('导出失败：' + e.message) }
    finally { setExporting(false) }
  }

  // 选择文件，准备导入
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setImportingMsg('正在读取文件...')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.version || !data.transactions) throw new Error('文件格式无效，不是游游记账备份文件')
      setImportData(data)
      setImportingOk(null)
      setShowImportConfirm(true)
      setImportingMsg('')
    } catch (e: any) { alert('读取失败：' + e.message); setImportingMsg('') }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // 执行导入
  const handleImport = async () => {
    if (!importData || !user) return
    setImporting(true)
    setImportingMsg('正在导入...')
    let ok = 0
    try {
      // 找到匹配账本或用第一个
      let targetLedger = importData.ledgers?.find((l: any) => l.owner_id === user.id) || importData.ledgers?.[0]
      if (!targetLedger) { alert('备份中没有找到可导入的账本'); return }
      const ledgerId = targetLedger.id

      if (importMode === 'overwrite') {
        // 删除旧数据
        await Promise.all([
          supabase.from('transactions').delete().eq('ledger_id', ledgerId),
          supabase.from('categories').delete().eq('ledger_id', ledgerId),
          supabase.from('budgets').delete().eq('ledger_id', ledgerId),
        ])
      }

      // 导入类别
      if (importData.categories?.length) {
        const catsToInsert = importData.categories.map((c: any) => ({
          id: c.id, ledger_id: ledgerId, name: c.name, icon: c.icon || '📌',
          type: c.type, parent_id: c.parent_id || null, level: c.level || 1
        })).filter((c: any) => !c.id?.includes('__'))  // 过滤掉 __default 等占位符
        const { error: catErr } = await supabase.from('categories').upsert(catsToInsert, { onConflict: 'id' })
        if (catErr) console.error('类别导入错误:', catErr)
        ok += catsToInsert.length
      }

      // 导入交易
      if (importData.transactions?.length) {
        const txsToInsert = importData.transactions.map((t: any) => ({
          id: t.id, ledger_id: ledgerId, date: t.date, type: t.type,
          category: t.category, amount: t.amount, note: t.note || '',
          payment_method: t.payment_method || null, created_at: t.created_at || new Date().toISOString()
        })).filter((t: any) => !t.id?.includes('__'))
        const { error: txErr } = await supabase.from('transactions').upsert(txsToInsert, { onConflict: 'id' })
        if (txErr) console.error('交易导入错误:', txErr)
        ok += txsToInsert.length
      }

      // 导入预算
      if (importData.budgets?.length) {
        const budgetsToInsert = importData.budgets.map((b: any) => ({
          id: b.id, ledger_id: ledgerId, category: b.category, type: b.type,
          amount: b.amount, month: b.month
        })).filter((b: any) => !b.id?.includes('__'))
        await supabase.from('budgets').upsert(budgetsToInsert, { onConflict: 'id' })
        ok += budgetsToInsert.length
      }

      setImportingOk(ok)
      setImportingMsg(`导入完成！共导入 ${ok} 条记录`)
    } catch (e: any) { alert('导入失败：' + e.message); setImportingMsg('') }
    finally { setImporting(false) }
  }

  const preview = importData
    ? {
        txs: importData.transactions?.length || 0,
        cats: importData.categories?.length || 0,
        budgets: importData.budgets?.length || 0,
        ledger: importData.ledgerName || importData.ledgers?.[0]?.name || '未知',
        date: importData.exportedAt ? new Date(importData.exportedAt).toLocaleDateString('zh-CN') : '未知'
      }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 导出卡片 */}
      <div style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Download size={18} color="#6366f1"/>
          </div>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>导出数据</p>
        </div>

        {/* 导出范围（CSV 专用） */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>CSV 导出范围</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setExportRange('all')} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: exportRange === 'all' ? '#eef2ff' : '#f3f4f6', color: exportRange === 'all' ? '#6366f1' : '#6b7280' }}>
              全部
            </button>
            <button onClick={() => setExportRange('month')} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: exportRange === 'month' ? '#eef2ff' : '#f3f4f6', color: exportRange === 'month' ? '#6366f1' : '#6b7280' }}>
              按月份
            </button>
          </div>
          {exportRange === 'month' && (
            <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
          )}
        </div>

        {/* 导出按钮组 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={handleExportCSV} disabled={exporting || !currentLedger}
            style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, fontSize: 14, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting || !currentLedger ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <FileText size={16}/> {exporting ? '导出中...' : '📊 导出 CSV'}
            <span style={{ fontSize: 12, opacity: 0.8 }}>（交易记录，Excel可打开）</span>
          </button>
          <button onClick={handleExportJSON} disabled={exporting || !currentLedger}
            style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: 14, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting || !currentLedger ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Download size={16}/> {exporting ? '导出中...' : '💾 导出 JSON 备份'}
            <span style={{ fontSize: 12, opacity: 0.8 }}>（含所有数据，可恢复）</span>
          </button>
        </div>
        {!currentLedger && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>⚠️ 请先选择账本</p>}
      </div>

      {/* 导入卡片 */}
      <div style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={18} color="#16a34a"/>
          </div>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>导入数据</p>
        </div>

        <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }}/>

        {!showImportConfirm ? (
          <div style={{ border: '2px dashed #d1d5db', borderRadius: 16, padding: '28px 16px', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); fileRef.current?.files?.length === 0 }}
          >
            <Upload size={28} color="#9ca3af" style={{ margin: '0 auto 10px', display: 'block' }}/>
            <p style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>点击选择 JSON 备份文件</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>仅支持游游记账导出的 .json 文件</p>
          </div>
        ) : (
          <div style={{ background: '#f9fafb', borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontWeight: 700, color: '#1f2937', fontSize: 14 }}>📁 {preview?.ledger}</p>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>{preview?.date} 导出</p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
              <span>📝 {preview?.txs} 笔交易</span>
              <span>📂 {preview?.cats} 个类别</span>
              <span>💰 {preview?.budgets} 条预算</span>
            </div>

            {/* 导入模式 */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>导入模式</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setImportMode('merge')} style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: importMode === 'merge' ? '#dcfce7' : '#f3f4f6', color: importMode === 'merge' ? '#16a34a' : '#6b7280' }}>
                  🤝 合并（保留现有数据）
                </button>
                <button onClick={() => setImportMode('overwrite')} style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: importMode === 'overwrite' ? '#fee2e2' : '#f3f4f6', color: importMode === 'overwrite' ? '#dc2626' : '#6b7280' }}>
                  ⚠️ 覆盖（清空现有数据）
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowImportConfirm(false); setImportData(null) }}
                style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={handleImport} disabled={importing}
                style={{ flex: 2, padding: '10px', borderRadius: 12, border: 'none', background: importMode === 'overwrite' ? '#ef4444' : '#16a34a', color: 'white', fontWeight: 700, fontSize: 14, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1 }}>
                {importing ? importingMsg || '导入中...' : '✓ 确认导入'}
              </button>
            </div>

            {importingOk !== null && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#dcfce7', color: '#16a34a', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                ✅ {importingMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 安全提示 */}
      <div style={{ background: '#f0f9ff', borderRadius: 16, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Shield size={16} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }}/>
        <div>
          <p style={{ fontWeight: 600, fontSize: 13, color: '#0369a1', marginBottom: 4 }}>数据安全提示</p>
          <p style={{ fontSize: 12, color: '#075985', lineHeight: 1.6 }}>备份文件包含您的所有账目数据，请妥善保管。导入时选择"合并"模式可避免数据丢失。建议定期备份重要数据。</p>
        </div>
      </div>
    </div>
  )
}

// ── 家庭协同面板 ─────────────────────────────────────────────────────────────
function FamilyPanel() {
  const { currentLedger, user, setCurrentLedger } = useAppStore()
  const [members, setMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinResult, setJoinResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [myLedgers, setMyLedgers] = useState<any[]>([])

  const inviteCode = currentLedger?.id?.replace(/-/g, '').substring(0, 8).toUpperCase() || ''
  const inviteLink = `https://caifu-001.github.io/money-tracker/?join=${inviteCode}`

  const loadMembers = async () => {
    if (!currentLedger) return
    setIsLoading(true)
    const { data } = await supabase
      .from('ledger_members')
      .select('id, role, user_id, users(id, name, email)')
      .eq('ledger_id', currentLedger.id)
    // 过滤掉 admin 角色的成员，普通用户看不到管理员
    const filtered = (data || []).filter((m: any) => m.role !== 'admin')
    setMembers(filtered)
    setIsLoading(false)
  }

  const loadMyLedgers = async () => {
    if (!user) return
    const { data } = await supabase.from('ledgers').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
    setMyLedgers(data || [])
  }

  useEffect(() => { loadMembers(); loadMyLedgers() }, [currentLedger, user])

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(inviteLink) } catch {
      const el = document.createElement('textarea')
      el.value = inviteLink; document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase().replace(/-/g, '')
    if (!code || code.length < 6) { setJoinResult({ ok: false, msg: '邀请码至少6位' }); return }
    setJoining(true); setJoinResult(null)
    try {
      const { data: all } = await supabase.from('ledgers').select('*')
      const matched = (all || []).find((l: any) => l.id.replace(/-/g, '').toUpperCase().startsWith(code))
      if (!matched) { setJoinResult({ ok: false, msg: '邀请码无效' }); setJoining(false); return }
      const { data: existing } = await supabase.from('ledger_members').select('id').eq('ledger_id', matched.id).eq('user_id', user?.id)
      if (existing && existing.length > 0) { setJoinResult({ ok: false, msg: '你已经是该账本成员了' }); setJoining(false); return }
      const { error } = await supabase.from('ledger_members').insert([{ ledger_id: matched.id, user_id: user?.id, role: 'editor' }])
      if (error) throw error
      setJoinResult({ ok: true, msg: `成功加入「${matched.name}」！` })
      setJoinCode(''); setCurrentLedger(matched); loadMembers()
    } catch (err: any) { setJoinResult({ ok: false, msg: `失败：${err.message}` }) }
    finally { setJoining(false) }
  }

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`确定移除「${name}」？`)) return
    await supabase.from('ledger_members').delete().eq('id', memberId)
    loadMembers()
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    await supabase.from('ledger_members').update({ role: newRole }).eq('id', memberId)
    loadMembers()
  }

  const handleLeave = async () => {
    if (!confirm('确定退出该账本？')) return
    const my = members.find((m: any) => m.users?.id === user?.id)
    if (my) { await supabase.from('ledger_members').delete().eq('id', my.id); setMembers(prev => prev.filter(m => m.id !== my.id)) }
  }

  const amIOwner = currentLedger?.owner_id === user?.id

  const ROLE_MAP: Record<string, { label: string; color: string; bg: string }> = {
    owner: { label: '所有者', color: '#f59e0b', bg: '#fffbeb' },
    editor: { label: '编辑者', color: '#6366f1', bg: '#eef2ff' },
    viewer: { label: '查看者', color: '#16a34a', bg: '#dcfce7' },
  }

  if (!currentLedger) return (
    <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 20 }}>
      <p style={{ fontSize: 36, marginBottom: 12 }}>请先选择账本</p>
      {myLedgers.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {myLedgers.map(l => (
            <button key={l.id} onClick={() => setCurrentLedger(l)}
              style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: '#eef2ff', color: '#6366f1', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      {/* 邀请卡片 */}
      <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 20, padding: '18px', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}/>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>账本：{currentLedger.name}</p>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 10 }}>邀请码（发给家人）</p>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'white', fontSize: 22, fontWeight: 900, letterSpacing: 4 }}>{inviteCode}</span>
          <button onClick={handleCopy} style={{ background: copied ? '#22c55e' : 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 10, padding: '8px 12px', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>
        <button onClick={() => setShowJoin(!showJoin)} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {showJoin ? '收起' : '输入邀请码加入账本'}
        </button>
      </div>

      {showJoin && (
        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <form onSubmit={handleJoin}>
            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="输入邀请码" maxLength={8} required
              style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 16, fontWeight: 700, outline: 'none', marginBottom: 10, boxSizing: 'border-box', letterSpacing: 3, textAlign: 'center' }}/>
            {joinResult && (
              <div style={{ padding: '8px 12px', borderRadius: 10, marginBottom: 10, background: joinResult.ok ? '#f0fdf4' : '#fef2f2', color: joinResult.ok ? '#16a34a' : '#ef4444', fontSize: 13, fontWeight: 600 }}>{joinResult.msg}</div>
            )}
            <button type="submit" disabled={joining || joinCode.length < 6}
              style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: joining || joinCode.length < 6 ? '#d1d5db' : '#6366f1', color: 'white', fontWeight: 700, fontSize: 14, cursor: joining || joinCode.length < 6 ? 'not-allowed' : 'pointer' }}>
              {joining ? '加入中...' : '确认加入'}
            </button>
          </form>
        </div>
      )}

      {/* 成员列表 */}
      <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>成员（共{members.length}人）</p>
          {!amIOwner && <button onClick={handleLeave} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>退出账本</button>}
        </div>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }}/>
          </div>
        ) : members.map((m: any) => {
          const u = m.users
          const isMe = u?.id === user?.id
          const cfg = ROLE_MAP[m.role] || ROLE_MAP.viewer
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f9fafb' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: isMe ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: isMe ? 'white' : '#6b7280', marginRight: 10, flexShrink: 0 }}>
                {u?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>{u?.name || '未知'}{isMe && <span style={{ fontSize: 10, background: '#eef2ff', color: '#6366f1', padding: '1px 6px', borderRadius: 10, fontWeight: 700, marginLeft: 6 }}>我</span>}</p>
                <p style={{ fontSize: 11, color: '#9ca3af' }}>{u?.email}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {m.role === 'owner' ? (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                ) : amIOwner && !isMe ? (
                  <select value={m.role} onChange={e => handleChangeRole(m.id, e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 11, fontWeight: 600, outline: 'none', cursor: 'pointer', background: cfg.bg, color: cfg.color }}>
                    <option value="editor">编辑者</option>
                    <option value="viewer">查看者</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                )}
                {amIOwner && m.role !== 'owner' && !isMe && (
                  <button onClick={() => handleRemoveMember(m.id, u?.name || '该成员')}
                    style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={12}/>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 管理后台主组件 ─────────────────────────────────────────────────────────
export function Admin() {
  const { user, currentLedger, setCurrentLedger } = useAppStore()
  const [tab, setTab] = useState<'family' | 'account' | 'ledgers' | 'import' | 'users'>('family')
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [ledgers, setLedgers] = useState<any[]>([])
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'
  const isSuperAdmin = user?.role === 'admin'  // 超级管理员才能授权其他管理员
  const [editName, setEditName] = useState(user?.name || '')
  const [editEmail, setEditEmail] = useState(user?.email || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [changingPwdValue, setChangingPwdValue] = useState('')
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetTarget, setResetTarget] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [showCreateLedger, setShowCreateLedger] = useState(false)
  const [newLedgerName, setNewLedgerName] = useState('')
  const [newLedgerType, setNewLedgerType] = useState<'personal' | 'family' | 'project'>('personal')
  const [creating, setCreating] = useState(false)

  const loadUsers = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers((data || []) as any[]); setIsLoading(false)
  }

  const loadLedgers = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('ledgers').select('*').eq('owner_id', user?.id).order('created_at', { ascending: false })
    setLedgers(data || []); setIsLoading(false)
  }

  useEffect(() => {
    if (!user) return
    if (tab === 'users') loadUsers()
    else if (tab === 'ledgers') loadLedgers()
    else setIsLoading(false)
  }, [tab, user])

  const handleApprove = async (id: string, role: string) => {
    const { error } = await supabase.from('users').update({ status: 'active', role }).eq('id', id)
    if (error) { alert('操作失败：' + error.message); return }
    alert('操作成功')
    loadUsers()
  }

  // 授权为管理员（仅超级管理员可操作）
  const handlePromoteToManager = async (id: string) => {
    if (!confirm('确定授权该用户为管理员？\n\n管理员权限：\n- 审核新用户\n- 重置普通用户密码\n- 禁用/启用普通用户\n\n注意：管理员不能管理其他管理员')) return
    const { error } = await supabase.from('users').update({ role: 'manager' }).eq('id', id)
    if (error) { alert('授权失败：' + error.message); return }
    alert('已授权为管理员')
    loadUsers()
  }

  // 撤销管理员权限
  const handleDemoteToUser = async (id: string) => {
    if (!confirm('确定撤销该用户的管理员权限？')) return
    const { error } = await supabase.from('users').update({ role: 'user' }).eq('id', id)
    if (error) { alert('撤销失败：' + error.message); return }
    alert('已撤销管理员权限')
    loadUsers()
  }
  const handleDisable = async (id: string) => {
    if (!confirm('确定禁用该用户？')) return
    const { error } = await supabase.from('users').update({ status: 'disabled' }).eq('id', id)
    if (error) { alert('禁用失败：' + error.message); return }
    alert('已禁用')
    loadUsers()
  }
  const handleDeleteUser = async (id: string) => {
    if (!confirm('确定删除该用户？')) return
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) { alert('删除失败：' + error.message); return }
    alert('已删除')
    loadUsers()
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) { alert('昵称不能为空'); return }
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('users').update({ name: editName.trim() }).eq('id', user?.id)
      if (error) throw error
      alert('昵称修改成功！')
    } catch (err: any) { alert(`保存失败：${err.message}`) }
    finally { setSavingProfile(false) }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (changingPwdValue.length < 6) { alert('新密码至少6位'); return }
    setChangingPwd(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: changingPwdValue })
      if (error) throw error
      alert('密码修改成功！'); setChangingPwdValue(''); setShowPasswordForm(false)
    } catch (err: any) { alert(`修改失败：${err.message}`) }
    finally { setChangingPwd(false) }
  }

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLedgerName.trim()) { alert('请输入账本名称'); return }
    setCreating(true)
    const { error } = await supabase.from('ledgers').insert([{ name: newLedgerName.trim(), type: newLedgerType, owner_id: user?.id }])
    setCreating(false)
    if (error) { alert(`创建失败：${error.message}`); return }
    setNewLedgerName(''); setShowCreateLedger(false); loadLedgers()
  }

  const handleDeleteLedger = async (ledger: any) => {
    if (ledger.id === currentLedger?.id) { alert('当前账本不能删除'); return }
    if (!confirm(`确定删除账本「${ledger.name}」？所有数据将被删除！`)) return
    await supabase.from('transactions').delete().eq('ledger_id', ledger.id)
    await supabase.from('categories').delete().eq('ledger_id', ledger.id)
    await supabase.from('budgets').delete().eq('ledger_id', ledger.id)
    await supabase.from('ledger_members').delete().eq('ledger_id', ledger.id)
    const { error } = await supabase.from('ledgers').delete().eq('id', ledger.id)
    if (error) alert(`删除失败：${error.message}`)
    else setLedgers(prev => prev.filter(l => l.id !== ledger.id))
  }

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) { alert('密码至少6位'); return }
    setResetting(true)
    try {
      // 直接用 service_role key 调用 Auth Admin API
      const res = await fetch(`https://abkscyijuvkfeazhlquz.supabase.co/auth/v1/admin/users/${resetTarget.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxMjU0MiwiZXhwIjoyMDg5OTg4NTQyfQ.tVBp64EO05d6ADTv7Mb9PvSPgPdmXF-_fiYoA2tzpow',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxMjU0MiwiZXhwIjoyMDg5OTg4NTQyfQ.tVBp64EO05d6ADTv7Mb9PvSPgPdmXF-_fiYoA2tzpow',
        },
        body: JSON.stringify({ password: newPassword })
      })
      const result = await res.json()
      if (!res.ok) {
        alert(`重置失败：${result.message || result.error || '未知错误'}`)
        return
      }
      alert('密码重置成功！')
      setShowResetForm(false); setNewPassword(''); setResetTarget(null)
    } catch (e: any) {
      alert(`重置失败：${e.message}`)
    } finally {
      setResetting(false)
    }
  }

  const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    active: { label: '已激活', bg: '#dcfce7', color: '#16a34a' },
    pending: { label: '待审核', bg: '#fef9c3', color: '#ca8a04' },
    disabled: { label: '已禁用', bg: '#fee2e2', color: '#dc2626' },
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <p style={{ color: '#6b7280', fontWeight: 600, fontSize: 16 }}>请先登录</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '16px 16px 100px' }}>
      {/* 标题卡片 */}
      <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 20, padding: '18px 20px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}/>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 4 }}>{isAdmin ? '管理后台' : '我的账户'}</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{isAdmin ? '管理用户、账本与家庭协同' : '管理个人信息与账本'}</p>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>用户</p>
              <p style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>{users.length}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px' }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>账本</p>
              <p style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>{ledgers.length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(isAdmin
          ? [['family','家庭'],['account','账户'],['ledgers','账本'],['import','导入导出'],['users','用户']]
          : [['family','家庭'],['account','账户'],['ledgers','账本'],['import','导入导出']]
        ).map((item: any) => (
          <button key={item[0]} onClick={() => setTab(item[0] as any)}
            style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              background: tab === item[0] ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'white',
              color: tab === item[0] ? 'white' : '#9ca3af',
              boxShadow: tab === item[0] ? '0 4px 14px rgba(99,102,241,0.3)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
            {item[1]}
          </button>
        ))}
      </div>

      {/* ── 家庭协同 ── */}
      {tab === 'family' && <FamilyPanel />}

      {/* ── 导入导出 ── */}
      {tab === 'import' && <ImportExportPanel />}

      {/* ── 账户管理 ── */}
      {tab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', marginBottom: 14 }}>基本信息</p>
            <form onSubmit={handleSaveProfile}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 4 }}>昵称</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 4 }}>邮箱（不可修改）</label>
                <input type="email" value={editEmail} readOnly
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#f9fafb', color: '#9ca3af' }}/>
              </div>
              <button type="submit" disabled={savingProfile}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: 14, cursor: savingProfile ? 'not-allowed' : 'pointer', opacity: savingProfile ? 0.6 : 1 }}>
                {savingProfile ? '保存中...' : '保存修改'}
              </button>
            </form>
          </div>
          <div style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', marginBottom: 14 }}>修改密码</p>
            {showPasswordForm ? (
              <form onSubmit={handleChangePassword}>
                <div style={{ marginBottom: 12 }}>
                  <input type="password" value={changingPwdValue} onChange={e => setChangingPwdValue(e.target.value)}
                    placeholder="新密码（至少6位）" minLength={6} required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" disabled={changingPwd} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, fontSize: 14, cursor: changingPwd ? 'not-allowed' : 'pointer', opacity: changingPwd ? 0.6 : 1 }}>
                    {changingPwd ? '修改中...' : '确认修改'}
                  </button>
                  <button type="button" onClick={() => { setShowPasswordForm(false); setChangingPwdValue('') }}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>取消</button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowPasswordForm(true)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>设置新密码</button>
            )}
          </div>
        </div>
      )}

      {/* ── 账本管理 ── */}
      {tab === 'ledgers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showCreateLedger ? (
            <form onSubmit={handleCreateLedger} style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', marginBottom: 14 }}>新建账本</p>
              <div style={{ marginBottom: 12 }}>
                <input type="text" value={newLedgerName} onChange={e => setNewLedgerName(e.target.value)} placeholder="账本名称"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}/>
                <select value={newLedgerType} onChange={e => setNewLedgerType(e.target.value as any)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                  <option value="personal">个人账本</option>
                  <option value="family">家庭账本</option>
                  <option value="project">项目账本</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={creating} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: 14, cursor: creating ? 'not-allowed' : 'pointer' }}>{creating ? '创建中...' : '创建账本'}</button>
                <button type="button" onClick={() => { setShowCreateLedger(false); setNewLedgerName('') }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>取消</button>
              </div>
            </form>
          ) : (
            <button onClick={() => { setShowCreateLedger(true); loadLedgers() }}
              style={{ padding: '14px', borderRadius: 16, border: '2px dashed #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              + 新建账本
            </button>
          )}

          {ledgers.map(l => {
            const typeMap: Record<string, { icon: string; color: string; bg: string }> = {
              personal: { icon: '个人', color: '#6366f1', bg: '#eef2ff' },
              family: { icon: '家庭', color: '#ec4899', bg: '#fdf2f8' },
              project: { icon: '项目', color: '#f59e0b', bg: '#fffbeb' },
            }
            const cfg = typeMap[l.type] || typeMap.personal
            const isCurrent = currentLedger?.id === l.id
            return (
              <div key={l.id} style={{ background: 'white', borderRadius: 16, padding: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', border: isCurrent ? '2px solid #6366f1' : '2px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{l.name}{isCurrent && <span style={{ fontSize: 11, color: '#6366f1', marginLeft: 6 }}>当前</span>}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{cfg.icon} {l.type === 'personal' ? '个人' : l.type === 'family' ? '家庭' : '项目'} · {new Date(l.created_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isCurrent ? (
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 600, background: '#eef2ff', color: '#6366f1' }}>当前默认</span>
                    ) : (
                      <button onClick={() => {
                        setCurrentLedger(l)
                        localStorage.setItem('qianji_default_ledger_id', l.id)
                        localStorage.setItem('qianji_default_ledger_name', l.name)
                        localStorage.setItem('qianji_default_ledger_type', l.type)
                        localStorage.setItem('qianji_default_ledger_owner', l.owner_id)
                      }} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: '#6366f1', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>设为默认</button>
                    )}
                    <button onClick={() => handleDeleteLedger(l)} style={{ padding: '6px 10px', borderRadius: 10, border: 'none', background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>删除</button>
                  </div>
                </div>
              </div>
            )
          })}

          {ledgers.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 20 }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>还没有账本，点击上方创建</p>
            </div>
          )}
        </div>
      )}

      {/* ── 用户管理（仅管理员） ── */}
      {tab === 'users' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}/>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>加载中...</p>
            </div>
          ) : users.map(u => {
            const sc = statusConfig[u.status] || statusConfig.pending
            const isAdminUser = u.role === 'admin'
            const isManagerUser = u.role === 'manager'
            const isPrivileged = isAdminUser || isManagerUser
            const canManage = isSuperAdmin || (user?.role === 'manager' && !isPrivileged)  // 超级管理员可管理所有人，普通管理员只能管理普通用户
            return (
              <div key={u.id} style={{ background: 'white', borderRadius: 16, padding: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: isAdminUser ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : isManagerUser ? 'linear-gradient(135deg,#8b5cf6,#a78bfa)' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: isPrivileged ? 'white' : '#6b7280', flexShrink: 0 }}>
                    {u.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '未设置昵称'}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{u.email}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    {isAdminUser && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: '#ede9fe', color: '#7c3aed' }}>超级管理员</span>}
                    {isManagerUser && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: '#ddd6fe', color: '#6d28d9' }}>管理员</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {u.status === 'pending' && canManage && (
                    <>
                      <button onClick={() => handleApprove(u.id, 'user')} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', background: '#dcfce7', color: '#16a34a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>通过-普通</button>
                      {isSuperAdmin && (
                        <button onClick={() => handleApprove(u.id, 'manager')} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', background: '#ede9fe', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>通过-管理</button>
                      )}
                    </>
                  )}
                  {u.status === 'active' && canManage && (
                    <>
                      {/* 重置密码：管理员可重置普通用户，超级管理员可重置所有人 */}
                      {(isSuperAdmin || !isPrivileged) && (
                        <button onClick={() => { setResetTarget(u); setNewPassword(''); setShowResetForm(true) }} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', background: '#eef2ff', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>重置密码</button>
                      )}
                      {/* 授权/撤销管理员：仅超级管理员可操作 */}
                      {isSuperAdmin && u.role === 'user' && (
                        <button onClick={() => handlePromoteToManager(u.id)} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', background: '#ede9fe', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>授权管理</button>
                      )}
                      {isSuperAdmin && isManagerUser && (
                        <button onClick={() => handleDemoteToUser(u.id)} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', background: '#f3e8ff', color: '#9333ea', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>撤销权限</button>
                      )}
                      {/* 禁用：不能禁用超级管理员，不能禁用自己 */}
                      {(!isAdminUser || (isSuperAdmin && u.id !== user?.id)) && (
                        <button onClick={() => handleDisable(u.id)} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', background: '#fef9c3', color: '#ca8a04', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>禁用</button>
                      )}
                    </>
                  )}
                  {u.status === 'disabled' && canManage && (
                    <button onClick={() => handleApprove(u.id, u.role || 'user')} style={{ flex: 1, padding: '7px', borderRadius: 10, border: 'none', background: '#dcfce7', color: '#16a34a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>启用</button>
                  )}
                  {/* 删除：超级管理员可删除所有人（除自己），普通管理员只能删除普通用户 */}
                  {u.id !== user?.id && (isSuperAdmin || (!isPrivileged && user?.role === 'manager')) && (
                    <button onClick={() => handleDeleteUser(u.id)} style={{ padding: '7px 12px', borderRadius: 10, border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>删除</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 重置密码弹窗 */}
      {showResetForm && resetTarget && (
        <div>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => setShowResetForm(false)}/>
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 101, background: 'white', borderRadius: 24, padding: 24, width: '90%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontWeight: 800, fontSize: 17, color: '#1f2937', marginBottom: 8 }}>重置密码</h3>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>为「{resetTarget.name || resetTarget.email}」设置新密码（至少6位）</p>
            <form onSubmit={handleAdminResetPassword}>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="输入新密码" minLength={6} required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}/>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowResetForm(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>取消</button>
                <button type="submit" disabled={resetting} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                  {resetting ? '重置中...' : '确认重置'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 底部法律信息和版本 */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#9ca3af' }}>
          <a href="#agreement" style={{ color: '#6366f1', textDecoration: 'none' }}>用户协议</a>
          <span>·</span>
          <a href="#privacy" style={{ color: '#6366f1', textDecoration: 'none' }}>隐私政策</a>
        </div>
        <span style={{ fontSize: 12, color: '#d1d5db' }}>游游记账 v3.0.3</span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

function AboutSection({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'about'|'agreement'|'privacy'>('about')
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300}} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:'white',borderRadius:'20px',width:'90%',maxWidth:'400px',maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 50px rgba(0,0,0,0.25)',overflow:'hidden'}}>
        <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:'16px',fontWeight:700,color:'#1f2937'}}>📖 关于系统</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'20px',color:'#9ca3af',padding:'4px'}}>✕</button>
        </div>
        <div style={{display:'flex',borderBottom:'1px solid #f3f4f6',flexShrink:0}}>
          {(['about','agreement','privacy'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{flex:1,padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:tab===t?700:400,color:tab===t?'#6366f1':'#9ca3af',borderBottom:tab===t?'2px solid #6366f1':'2px solid transparent'}}>
              {t==='about'?'关于':t==='agreement'?'用户协议':'隐私政策'}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px',fontSize:'13px',color:'#4b5563',lineHeight:'1.9'}}>
          {tab==='about' && <div><div style={{textAlign:'center',marginBottom:'20px'}}><div style={{fontSize:'40px',marginBottom:'8px'}}>💰</div><h2 style={{fontSize:'18px',fontWeight:800,color:'#1f2937',margin:'0 0 4px'}}>游游记账</h2><p style={{color:'#6366f1',fontSize:'14px',fontWeight:600}}>Version 3.0.3</p></div><p style={{marginBottom:'10px'}}>游游记账是一款简洁高效的<strong>家庭协同记账应用</strong>，支持多账本管理、分类统计、预算控制和数据导入导出。</p><p style={{marginBottom:'10px'}}>支持网页版和小程序双端使用，数据实时同步，随时随地管理家庭财务。</p><p>由 <strong>游游工作室</strong> 开发维护 · 2026</p></div>}
          {tab==='agreement' && <div><h3 style={{fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px'}}>用户协议</h3><p style={{marginBottom:'8px'}}>1. 使用本应用即表示您同意以下条款。</p><p style={{marginBottom:'8px'}}>2. 请勿使用本应用从事违法活动。</p><p style={{marginBottom:'8px'}}>3. 注册后需管理员审核通过方可使用完整功能。</p><p style={{marginBottom:'8px'}}>4. 用户数据归用户本人所有，平台不会用于商业目的。</p><p>5. 如有疑问请联系管理员。</p></div>}
          {tab==='privacy' && <div><h3 style={{fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px'}}>隐私政策</h3><p style={{marginBottom:'8px'}}>1. 我们收集您注册时提供的邮箱、昵称信息。</p><p style={{marginBottom:'8px'}}>2. 记账数据仅用于生成报表和统计分析。</p><p style={{marginBottom:'8px'}}>3. 账户注销后15个工作日内删除全部个人数据。</p><p style={{marginBottom:'8px'}}>4. 您的数据存储在中华人民共和国境内服务器。</p><p>5. 如有隐私问题请联系管理员。</p></div>}
        </div>
        <div style={{padding:'14px 20px 18px',textAlign:'center',borderTop:'1px solid #f3f4f6'}}><p style={{color:'#9ca3af',fontSize:'12px',margin:'0'}}>游游记账 v3.0.3 · 游游工作室</p></div>
      </div>
    {showAbout && <AboutSection onClose={()=>setShowAbout(false)} />}
</div>
  )
}

}

export default Admin
