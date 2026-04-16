-- 在 Supabase SQL Editor 执行（https://supabase.com/dashboard/project/abkscyijuvkfeazhlquz/sql/new）
-- 1. 添加支付方式字段
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

-- 2. 创建支付方式字典表
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 3. 插入默认支付方式
INSERT INTO payment_methods (id, name, icon, color, sort_order) VALUES
  ('cash',    '现金',     '💵', '#22c55e', 1),
  ('wechat',  '微信支付', '💚', '#22c55e', 2),
  ('alipay',  '支付宝',   '💙', '#3b82f6', 3),
  ('bankcard','银行卡',   '💳', '#6366f1', 4),
  ('other',   '其他',     '📌', '#9ca3af', 5)
ON CONFLICT (id) DO NOTHING;

-- 4. 给旧数据按类别猜一个支付方式（较合理的默认值）
UPDATE transactions SET payment_method = 'wechat' WHERE payment_method = 'cash' AND category IN ('食物','餐饮','交通','购物');
UPDATE transactions SET payment_method = 'alipay' WHERE payment_method = 'cash' AND category IN ('水电','通讯','住房');
UPDATE transactions SET payment_method = 'bankcard' WHERE payment_method = 'cash' AND category IN ('教育','医疗','保险');

-- 5. 允许 users 表删除时触发清理（软清理：不清 auth.users，保留记录）
-- 重新注册提示"用户已存在"是因为 auth.users 里还有记录，需要手动清理：
-- UPDATE auth.users SET deleted_at = NOW() WHERE id = '要清理的用户ID';
-- 或者在 Supabase Auth 设置里关闭"确认用户邮箱"以允许同一邮箱重新注册
