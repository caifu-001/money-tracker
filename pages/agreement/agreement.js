Page({
  data: { reachedBottom: false },

  onLoad() {},

  // 监听滚动位置
  onScroll(e) {
    // 粗略检测是否已滚动一段距离
    if (e.detail.scrollTop > 80) {
      this.setData({ reachedBottom: true })
    }
  },

  // 滚动到底部时触发
  onReachBottom() {
    this.setData({ reachedBottom: true })
  },

  handleConfirm() {
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    if (prevPage) {
      prevPage.setData({ agreedPrivacy: true })
    }
    wx.navigateBack()
  },

  goBack() {
    wx.navigateBack()
  }
})
