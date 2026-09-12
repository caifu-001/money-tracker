-- 017_secure_users_rls.sql
-- 用户隐私安全加固
--   1. users 表启用 RLS，收紧 SELECT（仅「自己」+「同账本成员」+「admin/manager」）
--   2. 列级保护：wechat_openid 是密码派生基础，收回 authenticated/anon 的读权限
--   3. 列级保护：仅允许 update name（防普通用户提权改 role/status/deleted_at）
--   4. 注册下沉到 SECURITY DEFINER RPC（后端强制 role='user'、status 由 auto_approve 决定）
--   5. 登录前 name→email 反查下沉到 SECURITY DEFINER RPC（仅返回 email）
-- 部署：Supabase Dashboard → SQL Editor → 粘贴全文 → Run
--
-- ⚠️ 必须与前端（login.js/home.js/family.js/admin.js/supabase.js）
--    及 wechat-auth Edge Function 同步上线，否则线上会登录失败。

-- ============================================================
-- 0. 清理 users 表上所有旧 policy（避免残留「全开放」策略）
-- ============================================================
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname='public' AND tablename='users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

-- ============================================================
-- 1. 启用 RLS
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. 可见性判断函数（SECURITY DEFINER，绕过 RLS 自引用递归）
--    返回 true 当：目标=自己 / 目标与自己同账本 / 自己是 admin/manager
-- ============================================================
CREATE OR REPLACE FUNCTION user_visible_to(auth_uid uuid, target_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    auth_uid = target_id
    OR EXISTS (
      SELECT 1 FROM public.ledger_members lm
      JOIN public.ledger_members me ON me.ledger_id = lm.ledger_id
      WHERE lm.user_id = target_id AND me.user_id = auth_uid
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth_uid AND u.role IN ('admin','manager')
    )
$$;

REVOKE ALL ON FUNCTION public.user_visible_to(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_visible_to(uuid, uuid) TO anon, authenticated;

-- ============================================================
-- 3. SELECT 策略：读自己 / 同账本成员 / admin-manager
-- ============================================================
CREATE POLICY "users_select_visible" ON public.users
  FOR SELECT
  USING (user_visible_to(auth.uid(), id));

-- ============================================================
-- 4. UPDATE 策略：只能改自己
-- ============================================================
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 5. INSERT：禁止 authenticated/anon 直接插入（走 register_user RPC）
--    不建任何 INSERT policy → RLS 默认拒绝
-- ============================================================

-- ============================================================
-- 6. DELETE：禁止直接删除（走软删除 RPC）
-- ============================================================
DROP POLICY IF EXISTS "block_direct_delete_users" ON public.users;
CREATE POLICY "block_direct_delete_users" ON public.users
  FOR DELETE
  USING (false);

-- ============================================================
-- 7. 列级保护：wechat_openid = 密码派生基础，禁止 authenticated/anon 读取
--    （只有 SECURITY DEFINER 函数 / service_role 能读）
-- ============================================================
REVOKE SELECT (wechat_openid) ON public.users FROM authenticated, anon;

-- ============================================================
-- 8. 列级保护：仅允许 update name（防提权改 role/status/deleted_at/openid）
-- ============================================================
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (name) ON public.users TO authenticated, anon;

-- ============================================================
-- 9. 注册 RPC：后端强制 role='user'，status 由 auto_approve 决定，防前端提权
--    id 取 auth.uid()（调用者必须在 signUp 后用派生密码换到 token）
-- ============================================================
CREATE OR REPLACE FUNCTION register_user(p_name text, p_email text, p_openid text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_auto  boolean := false;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  SELECT (value = 'true') INTO v_auto
    FROM public.app_settings
   WHERE key = 'auto_approve'
   LIMIT 1;
  v_status := CASE WHEN v_auto THEN 'active' ELSE 'pending' END;

  INSERT INTO public.users (id, email, name, role, status, wechat_openid)
  VALUES (v_uid, p_email, p_name, 'user', v_status, p_openid)
  ON CONFLICT (id) DO NOTHING;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.register_user(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO authenticated;

-- ============================================================
-- 10. 登录前 name→email 反查（邮箱登录用「用户名」时）
--     SECURITY DEFINER，仅返回 email，不泄露 openid/role/status
-- ============================================================
CREATE OR REPLACE FUNCTION find_user_email_by_name(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email
    FROM public.users
   WHERE lower(name) = lower(p_name)
   ORDER BY created_at ASC
   LIMIT 1;
  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_email_by_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_email_by_name(text) TO anon, authenticated;

-- ============================================================
-- 11. 用户自助软删除：settings 页「删除我的账号」走这里
--     软删（status='deleted' + deleted_at=now()），数据保留 15 天，可自助恢复
--     （替代 settings.js 里直接物理删 users 的旧逻辑）
-- ============================================================
CREATE OR REPLACE FUNCTION user_self_delete()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;
  UPDATE public.users
     SET status = 'deleted', deleted_at = now()
   WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.user_self_delete() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_self_delete() TO authenticated;

-- ============================================================
-- 12. update_last_login：登录后更新最后登录时间
--     SECURITY DEFINER（RLS 收紧后 last_login 列普通用户无法直接 update，只能走这里）
-- ============================================================
CREATE OR REPLACE FUNCTION update_last_login(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION '未登录';
  END IF;
  UPDATE public.users SET last_login = now() WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_last_login(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_last_login(uuid) TO authenticated;

-- ============================================================
-- 13. 验证：查看 users 表现有 policy
-- ============================================================
SELECT tablename, policyname, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname='public' AND tablename='users';
