# -*- coding: utf-8 -*-
path = r'C:\Users\yinsu\.qclaw\workspace\money-tracker-miniapp\pages\home\home.wxml'
with open(path, encoding='utf-8') as f:
    c = f.read()

# Replace small admin badge with bigger button
old = '<view class="user-info" bindtap="goAdmin" wx:if="{{user.role===\'admin\'}}">\n        <text class="admin-badge">管理员</text>\n      </view>'
new = '<view class="admin-entrance-btn" bindtap="goAdmin" wx:if="{{user.role===\'admin\'}}">\n        <text>🛡️ 管理</text>\n      </view>'
c = c.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('done')
print('admin-entrance-btn found:', 'admin-entrance-btn' in c)
