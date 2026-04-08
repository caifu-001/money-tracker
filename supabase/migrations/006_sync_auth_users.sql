-- 把 Auth 里有但 users 表里没有的用户全部补进来
-- 执行这段 SQL 后，所有已注册用户都会出现在管理页面
insert into public.users (id, email, name, role, status, created_at)
select 
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), '用户') as name,
  'user' as role,
  'active' as status,
  au.created_at
from auth.users au
left join public.users pu on au.id = pu.id
where pu.id is null
  and au.email not like '%@example.com';  -- 排除测试账号

-- 查看结果
select id, email, name, role, status from public.users order by created_at desc;
