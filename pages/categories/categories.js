// pages/categories/categories.js
const app = getApp()
const { supabase } = require('../../utils/supabase')
const { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } = require('../../utils/categories')

Page({
  data: {
    loading: true,
    user: null,
    currentLedger: null,
    // 预置类别（从 system_config 读取，管理员修改后实时生效）
    expensePresets: [],
    incomePresets: [],
    // 自定义类别（DB 中的树形结构）
    expenseCats: [],
    incomeCats: [],
    // 新增表单
    showForm: false,
    formType: 'expense',
    formName: '',
    formIcon: '📌',
    // 子类别内联表单
    inlineParentId: null,
    inlineParentName: '',
    inlineName: '',
    inlineIcon: '📌',
    // 展开状态
    expandedIds: [],
    // 编辑
    editId: null,
    editName: '',
    editIcon: '',
  },

  onLoad() {
    const user = app.globalData.user
    if (!user) return wx.reLaunch({ url: '/pages/login/login' })
    this.setData({ user, currentLedger: app.globalData.currentLedger })
    this.loadSystemPresets()
    this.loadCategories()
  },

  // 从 system_config 加载预置类别（管理员修改后实时生效）
  async loadSystemPresets() {
    try {
      const { data } = await supabase.from('system_config').select('key,value')
      if (data) {
        const map = {}
        data.forEach(row => { map[row.key] = row.value })
        this.setData({
          expensePresets: map['default_expense_categories'] || DEFAULT_EXPENSE_CATEGORIES,
          incomePresets:  map['default_income_categories']  || DEFAULT_INCOME_CATEGORIES,
        })
      } else {
        this.setData({ expensePresets: DEFAULT_EXPENSE_CATEGORIES, incomePresets: DEFAULT_INCOME_CATEGORIES })
      }
    } catch(e) {
      this.setData({ expensePresets: DEFAULT_EXPENSE_CATEGORIES, incomePresets: DEFAULT_INCOME_CATEGORIES })
    }
  },

  // 加载自定义类别（DB）
  async loadCategories() {
    const { currentLedger } = this.data
    if (!currentLedger) { this.setData({ loading: false }); return }
    this.setData({ loading: true })
    const { data } = await supabase.from('categories').select('id,name,icon,type,parent_id,level')
      .eq('ledger_id', currentLedger.id).order('level').order('name')

    const map = {}; const roots = []
    ;(data||[]).forEach(c => { map[c.id] = {...c, children: []} })
    ;(data||[]).forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id])
      else if (!c.parent_id) roots.push(map[c.id])
    })
    this.setData({
      expenseCats: roots.filter(c => c.type === 'expense'),
      incomeCats:  roots.filter(c => c.type === 'income'),
      loading: false
    })
  },

  // 添加顶级类别
  async handleAddTop() {
    const { formName, formIcon, formType, currentLedger } = this.data
    if (!formName.trim()) return wx.showToast({ title: '请输入类别名称', icon: 'none' })
    const { error } = await supabase.from('categories').insert([{
      ledger_id: currentLedger.id, name: formName, icon: formIcon,
      type: formType, parent_id: null, level: 1
    }])
    if (error) return wx.showToast({ title: error.message, icon: 'none' })
    this.setData({ showForm: false, formName: '', formIcon: '📌' })
    this.loadCategories()
  },

  // 添加子类别
  async handleAddChild() {
    const { inlineParentId, inlineName, inlineIcon, currentLedger, expenseCats, incomeCats } = this.data
    if (!inlineName.trim()) return wx.showToast({ title: '请输入类别名称', icon: 'none' })
    // 找父级 level
    const findLevel = (cats, id) => {
      for (const c of cats) {
        if (c.id === id) return c.level
        if (c.children) { const f = findLevel(c.children, id); if (f > 0) return f }
      }
      return 0
    }
    const parentLevel = findLevel([...expenseCats, ...incomeCats], inlineParentId)
    if (parentLevel >= 5) return wx.showToast({ title: '最多5级子类别', icon: 'none' })

    // 找父级 type
    const findType = (cats, id) => {
      for (const c of cats) {
        if (c.id === id) return c.type
        if (c.children) { const f = findType(c.children, id); if (f) return f }
      }
      return null
    }
    const parentType = findType([...expenseCats, ...incomeCats], inlineParentId)

    const { error } = await supabase.from('categories').insert([{
      ledger_id: currentLedger.id, name: inlineName, icon: inlineIcon,
      type: parentType, parent_id: inlineParentId, level: parentLevel + 1
    }])
    if (error) return wx.showToast({ title: error.message, icon: 'none' })
    this.setData({ inlineParentId: null, inlineParentName: '', inlineName: '', inlineIcon: '📌' })
    this.loadCategories()
  },

  // 编辑类别
  async handleEdit() {
    const { editId, editName, editIcon } = this.data
    if (!editName.trim()) return wx.showToast({ title: '名称不能为空', icon: 'none' })
    const { error } = await supabase.from('categories').update({ name: editName, icon: editIcon }).eq('id', editId)
    if (error) return wx.showToast({ title: error.message, icon: 'none' })
    this.setData({ editId: null })
    this.loadCategories()
  },

  // 删除类别
  onDeleteTap(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '确认删除', content: '子类别也会一并删除', success: async res => {
      if (!res.confirm) return
      const del = async (cid) => {
        const { data: ch } = await supabase.from('categories').select('id').eq('parent_id', cid)
        if (ch) for (const c of ch) await del(c.id)
        await supabase.from('categories').delete().eq('id', cid)
      }
      await del(id)
      this.loadCategories()
    }})
  },

  // 展开/折叠
  toggleExpand(e) {
    const id = e.currentTarget.dataset.id
    const { expandedIds } = this.data
    if (expandedIds.includes(id)) {
      this.setData({ expandedIds: expandedIds.filter(x => x !== id) })
    } else {
      this.setData({ expandedIds: [...expandedIds, id] })
    }
  },

  // 内联子类别表单
  openInlineForm(e) {
    const { id, name } = e.currentTarget.dataset
    this.setData({ inlineParentId: id, inlineParentName: name, inlineName: '', inlineIcon: '📌', expandedIds: [...this.data.expandedIds, id] })
  },
  closeInlineForm() { this.setData({ inlineParentId: null }) },

  // 编辑表单
  openEdit(e) {
    const { id, name, icon } = e.currentTarget.dataset
    this.setData({ editId: id, editName: name, editIcon: icon })
  },
  closeEdit() { this.setData({ editId: null }) },

  // 表单输入
  onFormNameInput(e)   { this.setData({ formName: e.detail.value }) },
  onFormIconInput(e)   { this.setData({ formIcon: e.detail.value }) },
  onInlineNameInput(e) { this.setData({ inlineName: e.detail.value }) },
  onInlineIconInput(e) { this.setData({ inlineIcon: e.detail.value }) },
  onEditNameInput(e)   { this.setData({ editName: e.detail.value }) },
  onEditIconInput(e)   { this.setData({ editIcon: e.detail.value }) },
  setFormType(e)       { this.setData({ formType: e.currentTarget.dataset.type }) },
  toggleForm()         { this.setData({ showForm: !this.data.showForm, formName: '', formIcon: '📌' }) },
})
