-- 创建默认管理员账号
-- 注意：这个脚本需要在 Supabase 控制台手动执行
-- 或者通过应用程序的初始化流程执行

-- 首先，在 Supabase Auth 中创建管理员用户
-- 然后在 users 表中添加对应的记录

-- 如果需要通过 SQL 创建，可以使用以下方式：
-- 1. 先在 Supabase Auth 中创建用户 admin@example.com，密码 Admin123
-- 2. 然后执行以下 SQL：

-- INSERT INTO users (id, email, name, role, status, created_at)
-- VALUES (
--   '<admin_user_id_from_auth>',
--   'admin@example.com',
--   'Administrator',
--   'admin',
--   'active',
--   now()
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'active';
