-- 011_get_user_names_rpc.sql
-- 绕过 users 表 SELECT RLS（auth.uid()=id），获取任意用户姓名
-- 用于记账记录显示记录者

CREATE OR REPLACE FUNCTION get_user_names(p_user_ids UUID[])
RETURNS TABLE(user_id UUID, user_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, COALESCE(u.name, SPLIT_PART(u.email, '@', 1), u.id::TEXT)
  FROM public.users u
  WHERE u.id = ANY(p_user_ids);
END;
$$;

-- 匿名用户也需要调用权限
GRANT EXECUTE ON FUNCTION get_user_names(UUID[]) TO anon, authenticated;
