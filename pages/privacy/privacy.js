Page({
  data: { reachedBottom: false },

  onLoad() {},

  onScroll(e) {
    if (e.detail.scrollTop > 80) {
      this.setData({ reachedBottom: true })
    }
  },

  onReachBottom() {
    this.setData({ reachedBottom: true })
  },

  // 仅返回，不自动勾选复选框 — 用户须回到主页面手动勾选
  goBack() {
    wx.navigateBack()
  }
})
