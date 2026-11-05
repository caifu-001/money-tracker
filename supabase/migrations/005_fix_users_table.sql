-- 1. 给 users 表加上 username 字段（如果不存在）
alter table users add column if not exists username text;

-- 2. 确保 RLS 全部禁用（之前可能没生效）
alter table users disable row level security;
alter table ledgers disable row level security;
alter table ledger_members disable row level security;
alter table transactions disable row level security;
alter table budgets disable row level security;
alter table categories disable row level security;

-- 3. 查看 Auth 里有哪些用户还没有 users 表记录
-- 执行后你能看到缺失的用户
select 
  au.id,
  au.email,
  au.created_at,
  au.raw_user_meta_data->>'name' as name
from auth.users au
left join public.users pu on au.id = pu.id
where pu.id is null;
