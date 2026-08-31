-- 012_admin_user_management_rpc.sql
-- 用户管理后端防线：删除/禁用/启用 通过 SECURITY DEFINER RPC 执行，
-- 内部做权限校验，即使前端被绕过、直接调 REST API 也无法越权。
--
-- 权限规则（与前端一致）：
--   1. 调用者必须是 admin / manager，否则拒绝
--   2. 禁止操作自己的账户
--   3. 删除/禁用 属于降权操作，只允许针对普通用户（role='user'）
--   4. 启用/通过 属于恢复操作，可针对任何角色（含管理员），但禁止对自己
--
-- 部署方式：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run

-- ============================================================
-- 1. 删除用户：仅管理员可删普通用户，禁止删自己 / 管理员 / 超级管理员
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_user(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION '无权限执行此操作';
  END IF;

  IF p_target_id = v_caller_id THEN
    RAISE EXCEPTION '不能删除自己的账户';
  END IF;

  SELECT role INTO v_target_role FROM public.users WHERE id = p_target_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
  IF v_target_role <> 'user' THEN
    RAISE EXCEPTION '不能删除管理员账户';
  END IF;

  DELETE FROM public.users WHERE id = p_target_id;
END;
$$;

-- ============================================================
-- 2. 设置用户状态：禁用（降权，仅限普通用户）/ 启用 / 通过
-- ============================================================
CREATE OR REPLACE FUNCTION admin_set_user_status(p_target_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION '无权限执行此操作';
  END IF;

  IF p_target_id = v_caller_id THEN
    RAISE EXCEPTION '不能操作自己的账户';
  END IF;

  SELECT role INTO v_target_role FROM public.users WHERE id = p_target_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  IF p_status NOT IN ('active', 'disabled', 'pending') THEN
    RAISE EXCEPTION '非法状态值';
  END IF;

  -- 禁用属于降权操作，只允许针对普通用户
  IF p_status = 'disabled' AND v_target_role <> 'user' THEN
    RAISE EXCEPTION '不能禁用管理员账户';
  END IF;

  UPDATE public.users SET status = p_status WHERE id = p_target_id;
END;
$$;

-- ============================================================
-- 3. RLS：阻止 authenticated 用户直接 DELETE users 表（必须走 RPC）
--    SECURITY DEFINER 函数以 owner 身份运行，不受此 policy 限制，仍可删除。
-- ============================================================
DROP POLICY IF EXISTS "block_direct_delete_users" ON public.users;
CREATE POLICY "block_direct_delete_users" ON public.users
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- 4. 授权：仅 authenticated 可调用（anon 调不到，auth.uid() 为 null 会被拦截）
-- ============================================================
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) TO authenticated;
