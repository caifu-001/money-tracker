-- 015_self_restore_user.sql
-- 被删用户自助恢复：删除后数据保留15天，15天内该用户登录即自动恢复
-- 部署方式：Supabase Dashboard → SQL Editor → 粘贴全文 → Run

-- ============================================================
-- 用户自助恢复：仅允许「已删除且未超15天」的用户恢复自己
-- SECURITY DEFINER，auth.uid() 必须等于被恢复的用户本人
-- ============================================================
CREATE OR REPLACE FUNCTION user_self_restore()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_status     text;
  v_deleted_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  SELECT status, deleted_at INTO v_status, v_deleted_at
    FROM public.users WHERE id = v_uid;

  IF v_status IS NULL THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  IF v_status <> 'deleted' THEN
    RAISE EXCEPTION '账户不在已删除状态';
  END IF;

  -- 超过 15 天不允许恢复（数据可能已被清理）
  IF v_deleted_at IS NOT NULL AND v_deleted_at < now() - interval '15 days' THEN
    RAISE EXCEPTION '账户删除已超过15天，无法恢复';
  END IF;

  UPDATE public.users
     SET status = 'active', deleted_at = NULL
   WHERE id = v_uid;
END;
$$;

-- 授权：仅 authenticated 可调用
REVOKE ALL ON FUNCTION public.user_self_restore() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_self_restore() TO authenticated;
