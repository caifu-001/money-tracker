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
