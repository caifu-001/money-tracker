-- 013_soft_delete_user.sql
-- 用户软删除：删除后数据保留15天，15天内可恢复，15天后物理清除
-- 部署方式：Supabase Dashboard → SQL Editor → 粘贴全文 → Run

-- ============================================================
-- 0. users 表加 deleted_at 字段（软删除时间标记）
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ============================================================
-- 1. 软删除用户（仅管理员/经理，禁删自己，仅限普通用户）
--    标记 status='deleted' + deleted_at=now()，数据全部保留
-- ============================================================
CREATE OR REPLACE FUNCTION admin_soft_delete_user(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
  v_target_status text;
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

  SELECT role, status INTO v_target_role, v_target_status FROM public.users WHERE id = p_target_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
  IF v_target_role <> 'user' THEN
    RAISE EXCEPTION '不能删除管理员账户';
  END IF;
  IF v_target_status = 'deleted' THEN
    RAISE EXCEPTION '该账户已被删除';
  END IF;

  UPDATE public.users
     SET status = 'deleted', deleted_at = now()
   WHERE id = p_target_id;
END;
$$;

-- ============================================================
-- 2. 恢复已删除用户（15天内可恢复）
--    清空 deleted_at，状态恢复为 active
-- ============================================================
CREATE OR REPLACE FUNCTION admin_restore_user(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_target_status text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION '无权限执行此操作';
  END IF;

  SELECT status INTO v_target_status FROM public.users WHERE id = p_target_id;
  IF v_target_status IS NULL THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
  IF v_target_status <> 'deleted' THEN
    RAISE EXCEPTION '该账户不在已删除状态';
  END IF;

  UPDATE public.users
     SET status = 'active', deleted_at = NULL
   WHERE id = p_target_id;
END;
$$;

-- ============================================================
-- 3. 物理清理：删除 deleted_at 超过 15 天的用户及其全部数据
--    幂等；被前端懒触发或定时任务调用
--
--    清理顺序（关键，已按实际 schema 验证）：
--      ① 共享账本流水「重指向」账本主人
--         —— transactions.user_id 是 NOT NULL 且外键为 SET NULL，
--            直接删 users 会因无法置空而失败；先把 user_id 改成 owner
--      ② 删除待删用户「拥有账本」下的全部数据（随账户清除）
--      ③ 删除他们拥有的账本本身
--      ④ 删除他们的成员关系（他们加入的账本，不影响账本）
--      ⑤ 最后删 users（此时已无任何外键引用）
-- ============================================================
CREATE OR REPLACE FUNCTION admin_purge_deleted_users()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int := 0;
  v_expired uuid[];
BEGIN
  -- 找出所有已删除超 15 天的用户
  SELECT array_agg(id) INTO v_expired
    FROM public.users
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - interval '15 days';

  IF v_expired IS NULL THEN
    RETURN 0;
  END IF;

  -- ① 共享账本里的流水重指向账本主人
  UPDATE public.transactions t
     SET user_id = l.owner_id
    FROM public.ledgers l
   WHERE t.ledger_id = l.id
     AND t.user_id = ANY(v_expired)
     AND l.owner_id <> t.user_id;

  -- ② 删除待删用户拥有账本下的全部数据
  DELETE FROM public.transactions
   WHERE ledger_id IN (SELECT id FROM public.ledgers WHERE owner_id = ANY(v_expired));

  DELETE FROM public.categories
   WHERE ledger_id IN (SELECT id FROM public.ledgers WHERE owner_id = ANY(v_expired));

  DELETE FROM public.budgets
   WHERE ledger_id IN (SELECT id FROM public.ledgers WHERE owner_id = ANY(v_expired));

  DELETE FROM public.ledger_members
   WHERE ledger_id IN (SELECT id FROM public.ledgers WHERE owner_id = ANY(v_expired));

  -- ③ 删除他们拥有的账本本身
  DELETE FROM public.ledgers WHERE owner_id = ANY(v_expired);

  -- ④ 删除他们的成员关系（他们加入的账本）
  DELETE FROM public.ledger_members WHERE user_id = ANY(v_expired);

  -- ⑤ 最后删除 users 行（此时已无引用）
  DELETE FROM public.users WHERE id = ANY(v_expired);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 4. 授权：仅 authenticated 可调用（anon 调不到，auth.uid()=null 会被拦）
-- ============================================================
REVOKE ALL ON FUNCTION public.admin_soft_delete_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_restore_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_purge_deleted_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_deleted_users() TO authenticated;

-- ============================================================
-- 5. 定时清理：每天北京时间凌晨 4 点自动跑一次
--    pg_cron 按 UTC 计时：北京 04:00 = UTC 前一日 20:00 → '0 20 * * *'
--    首次执行会启用 pg_cron 扩展（若未启用）并注册任务
--    ⚠ 若重复执行报「duplicate key」，先跑：
--      select cron.unschedule('purge-deleted-users-daily');
-- ============================================================
create extension if not exists pg_cron;

select cron.schedule(
  'purge-deleted-users-daily',
  '0 20 * * *',
  $$ select admin_purge_deleted_users(); $$
);
