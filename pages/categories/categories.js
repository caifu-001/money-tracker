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

  async handleDelete() {
    const { editCat } = this.data
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除该分类吗？',
      success: async (res) => {
        if (!res.confirm) return
        const { error } = await supabase.from('categories').delete().eq('id', editCat.id)
        if (error) return wx.showToast({ title: error.message || '删除失败', icon: 'none' })
        this.setData({ showEdit: false })
        wx.showToast({ title: '删除成功', icon: 'success' })
        this.loadCategories()
      }
    })
  },
})
