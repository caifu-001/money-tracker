// pages/categories/categories.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { initDefaultCategories } = require('../../utils/categories')

Page({
  data: {
    user: null,
    isGuest: true,
    currentLedger: null,
    loading: false,
    expenseCats: [],
    incomeCats: [],
    type: 'expense',
    // 编辑弹窗
    showEdit: false,
    editCat: null,
    editName: '',
    editIcon: '',
    editParentId: null,
    // 新增弹窗
    showAdd: false,
    addName: '',
    addIcon: '',
    addParentId: null,
    // 移动弹窗
    showMove: false,
    moveCat: null,
    moveTargets: [],
    moveTargetId: null,
  },

  onLoad() {
    const user = app.globalData.user
    this.setData({ 
      user: user || null, 
      isGuest: !user,
      currentLedger: app.globalData.currentLedger 
    })
    if (user) this.loadCategories()
  },

  onShow() {
    // 刷新用户状态
    const user = app.globalData.user
    this.setData({ user: user || null, isGuest: !user })
    
    const currentLedger = app.globalData.currentLedger
    if (currentLedger && currentLedger.id !== this.data.currentLedger?.id) {
      this.setData({ currentLedger })
      if (user) this.loadCategories()
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  async loadCategories() {
    const { currentLedger } = this.data
    if (!currentLedger) { this.setData({ loading: false }); return }
    this.setData({ loading: true })
    const { data } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
      .eq('ledger_id', currentLedger.id).order('level').order('name')

    if (!data || data.length === 0) {
      await initDefaultCategories(supabase, currentLedger.id)
      const { data: retry } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
        .eq('ledger_id', currentLedger.id).order('level').order('name')
      this._applyData(retry || [])
      return
    }

    this._applyData(data)
  },

  _applyData(data) {
    const map = {}; const roots = []
    ;(data||[]).forEach(c => { map[c.id] = {...c, children: []} })
    ;(data||[]).forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id])
      else if (!c.parent_id) roots.push(map[c.id])
    })
    const addExpanded = (nodes) => nodes.map(n => ({...n, expanded: false, children: n.children ? addExpanded(n.children) : []}))
    this.setData({
      expenseCats: addExpanded(roots.filter(c => c.type === 'expense')),
      incomeCats:  addExpanded(roots.filter(c => c.type === 'income')),
      loading: false
    })
  },

  setType(e) {
    this.setData({ type: e.currentTarget.dataset.type })
  },

  toggleExpand(e) {
    const { id } = e.currentTarget.dataset
    const updateNode = (nodes) => nodes.map(n => {
      if (n.id === id) return {...n, expanded: !n.expanded}
      if (n.children) return {...n, children: updateNode(n.children)}
      return n
    })
    if (this.data.type === 'expense') {
      this.setData({ expenseCats: updateNode(this.data.expenseCats) })
    } else {
      this.setData({ incomeCats: updateNode(this.data.incomeCats) })
    }
  },

  openAdd(e) {
    if (!this.data.user) {
      wx.showModal({ title: '请先登录', content: '登录后即可管理分类', confirmText: '去登录', success: (r) => { if (r.confirm) this.goLogin() } })
      return
    }
    const parentId = e.currentTarget.dataset.parent || null
    this.setData({ showAdd: true, addName: '', addIcon: '📌', addParentId: parentId })
  },

  closeAdd() { this.setData({ showAdd: false }) },
  onAddNameInput(e) { this.setData({ addName: e.detail.value }) },
  onAddIconInput(e) { this.setData({ addIcon: e.detail.value }) },

  async handleAdd() {
    const { addName, addIcon, addParentId, type, currentLedger } = this.data
    if (!addName.trim()) return wx.showToast({ title: '请输入分类名称', icon: 'none' })
    
    // 查重：同级不能重名
    const siblings = addParentId 
      ? this._getChildren(addParentId) 
      : (type === 'expense' ? this.data.expenseCats : this.data.incomeCats)
    if (siblings.some(s => s.name === addName.trim())) {
      return wx.showToast({ title: '该分类名称已存在', icon: 'none' })
    }

    // 计算层级
    let level = 1
    if (addParentId) {
      const parent = this._findNode(addParentId)
      if (parent) level = parent.level + 1
    }

    const { error } = await supabase.from('categories').insert([{
      ledger_id: currentLedger.id,
      name: addName.trim(),
      icon: addIcon || '📌',
      type,
      parent_id: addParentId,
      level
    }])
    if (error) return wx.showToast({ title: error.message || '添加失败', icon: 'none' })
    this.setData({ showAdd: false })
    wx.showToast({ title: '添加成功', icon: 'success' })
    this.loadCategories()
  },

  _getChildren(parentId) {
    const find = (nodes) => {
      for (const n of nodes) {
        if (n.id === parentId) return n.children || []
        if (n.children) {
          const found = find(n.children)
          if (found) return found
        }
      }
      return []
    }
    return find(this.data.type === 'expense' ? this.data.expenseCats : this.data.incomeCats)
  },

  _findNode(id) {
    const find = (nodes) => {
      for (const n of nodes) {
        if (n.id === id) return n
        if (n.children) {
          const found = find(n.children)
          if (found) return found
        }
      }
      return null
    }
    return find(this.data.type === 'expense' ? this.data.expenseCats : this.data.incomeCats)
  },

  openEdit(e) {
    if (!this.data.user) {
      wx.showModal({ title: '请先登录', content: '登录后即可管理分类', confirmText: '去登录', success: (r) => { if (r.confirm) this.goLogin() } })
      return
    }
    const cat = e.currentTarget.dataset.cat
    this.setData({ showEdit: true, editCat: cat, editName: cat.name, editIcon: cat.icon, editParentId: cat.parent_id })
  },

  closeEdit() { this.setData({ showEdit: false }) },
  onEditNameInput(e) { this.setData({ editName: e.detail.value }) },
  onEditIconInput(e) { this.setData({ editIcon: e.detail.value }) },

  async handleEdit() {
    const { editCat, editName, editIcon } = this.data
    if (!editName.trim()) return wx.showToast({ title: '请输入分类名称', icon: 'none' })
    const { error } = await supabase.from('categories').update({ name: editName.trim(), icon: editIcon || '📌' }).eq('id', editCat.id)
    if (error) return wx.showToast({ title: error.message || '修改失败', icon: 'none' })
    this.setData({ showEdit: false })
    wx.showToast({ title: '修改成功', icon: 'success' })
    this.loadCategories()
  },

  // ── 移动分类 ──
  // 收集该分类自己及所有后代 id（防止移到自己的子节点下造成环）
  _collectSubtreeIds(node, acc = []) {
    acc.push(node.id)
    if (node.children && node.children.length > 0) {
      node.children.forEach(c => this._collectSubtreeIds(c, acc))
    }
    return acc
  },

  openMove(e) {
    if (!this.data.user) {
      wx.showModal({ title: '请先登录', content: '登录后即可管理分类', confirmText: '去登录', success: (r) => { if (r.confirm) this.goLogin() } })
      return
    }
    const cat = e.currentTarget.dataset.cat
    if (!cat) return
    const forbidden = new Set(this._collectSubtreeIds(cat))
    const type = cat.type

    // 移动目标：同类型下所有节点，排除自己及后代，排除直接父节点（移到原位置无意义）
    const all = type === 'expense' ? this.data.expenseCats : this.data.incomeCats
    const targets = []
    const walk = (nodes, depth) => {
      nodes.forEach(n => {
        if (forbidden.has(n.id)) return
        if (n.id === cat.parent_id) { /* 跳过直接父节点，但继续遍历其子 */
          if (n.children) walk(n.children, depth + 1)
          return
        }
        targets.push({ id: n.id, name: n.name, depth })
        if (n.children) walk(n.children, depth + 1)
      })
    }
    walk(all, 0)
    // 顶层移动目标（移到根级）
    if (cat.parent_id) {
      targets.unshift({ id: '', name: '（顶层 / 无父级）', depth: 0 })
    }

    this.setData({ showMove: true, moveCat: cat, moveTargets: targets, moveTargetId: '' })
  },

  closeMove() { this.setData({ showMove: false }) },

  onMoveTargetTap(e) {
    this.setData({ moveTargetId: e.currentTarget.dataset.id })
  },

  async handleMoveConfirm() {
    const { moveCat, moveTargetId, currentLedger } = this.data
    if (!moveCat) return
    // moveTargetId === '' 表示移到根级；否则移到指定父级
    const newParentId = moveTargetId === '' ? null : moveTargetId
    // 移到当前位置（原父级）则无需操作
    if ((newParentId || null) === (moveCat.parent_id || null)) {
      return wx.showToast({ title: '未改变位置', icon: 'none' })
    }
    // 计算新层级
    let newLevel = 1
    if (newParentId) {
      const parent = this._findNode(newParentId)
      if (parent) newLevel = parent.level + 1
    }
    // 目标父级层级不能太深（最多4级）
    if (newLevel > 4) {
      return wx.showToast({ title: '最多支持4级分类', icon: 'none' })
    }

    // 提示：移动会导致该分类及其子分类的层级变化
    const hasChildren = moveCat.children && moveCat.children.length > 0
    wx.showModal({
      title: '确认移动',
      content: hasChildren
        ? `将「${moveCat.name}」及其 ${moveCat.children.length} 个子分类一起移动，确定吗？`
        : `确定将「${moveCat.name}」移动到新位置吗？`,
      success: async (res) => {
        if (!res.confirm) return
        // 收集整个子树（自己 + 后代），计算各自新 level，逐条更新 parent_id / level
        const updates = []
        const collect = (node, level) => {
          updates.push({ id: node.id, parent_id: null, level })
          if (node.children && node.children.length > 0) {
            node.children.forEach(c => collect(c, level + 1))
          }
        }
        collect(moveCat, newLevel)
        // 根节点（自己）的 parent_id 用 newParentId，后代保持原 parent_id
        updates[0].parent_id = newParentId

        let failed = null
        for (const u of updates) {
          const { error } = await supabase.from('categories').update({ parent_id: u.parent_id, level: u.level }).eq('id', u.id)
          if (error) { failed = error; break }
        }
        if (failed) return wx.showToast({ title: failed.message || '移动失败', icon: 'none' })
        this.setData({ showMove: false })
        wx.showToast({ title: '移动成功', icon: 'success' })
        this.loadCategories()
      }
    })
  },

  async handleDelete(e) {
    // 两个入口：列表项直删（data-id）优先；编辑弹窗删（editCat）回退
    let catId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || null
    if (!catId && this.data.editCat) catId = this.data.editCat.id
    if (!catId) return wx.showToast({ title: '未选择分类', icon: 'none' })

    // 定位完整分类节点（含 name/type/children）
    let cat = this._findNode(catId)
    if (!cat && this.data.editCat) cat = this.data.editCat
    if (!cat) return wx.showToast({ title: '分类不存在', icon: 'none' })

    // 1. 有子分类 → 拦截，必须先处理子分类
    if (cat.children && cat.children.length > 0) {
      return wx.showModal({
        title: '无法删除',
        content: `该分类下还有 ${cat.children.length} 个子分类，请先删除或移动子分类再删除本分类。`,
        showCancel: false
      })
    }

    // 2. 检查流水 / 预算引用（按 name + type 匹配）
    const { currentLedger } = this.data
    const [txRes, budgetRes] = await Promise.all([
      supabase.from('transactions').select('id').eq('ledger_id', currentLedger.id).eq('category', cat.name).eq('type', cat.type),
      supabase.from('budgets').select('id').eq('ledger_id', currentLedger.id).eq('category', cat.name)
    ])
    const txCount = (txRes.data || []).length
    const budgetCount = (budgetRes.data || []).length
    const refCount = txCount + budgetCount

    let content = '删除后无法恢复，确定删除该分类吗？'
    if (refCount > 0) {
      const parts = []
      if (txCount > 0) parts.push(`${txCount} 笔记账`)
      if (budgetCount > 0) parts.push(`${budgetCount} 条预算`)
      content = `该分类被 ${parts.join('、')} 引用，删除后相关数据将失去分类关联。确定删除吗？`
    }

    wx.showModal({
      title: '确认删除',
      content,
      success: async (res) => {
        if (!res.confirm) return
        const { error } = await supabase.from('categories').delete().eq('id', catId)
        if (error) return wx.showToast({ title: error.message || '删除失败', icon: 'none' })
        this.setData({ showEdit: false })
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.loadCategories()
      }
    })
  },
})
