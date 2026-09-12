-- 016_fix_users_status_check.sql
-- 修复：users 表的 status CHECK 约束不包含 'deleted'，导致软删除报错
-- 报错：new row for relation "users" violates check constraint "users_status_check"
-- 部署：Supabase Dashboard → SQL Editor → 粘贴 → Run

-- ============================================================
-- 1. 先查看当前约束定义（执行后看结果，确认包含哪些值）
-- ============================================================
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.users'::regclass
   AND contype = 'c';

-- ============================================================
-- 2. 删除旧的 status 约束，重建（加入 'deleted'）
--    现状 status 应包含：pending / active / disabled
--    新增：deleted
-- ============================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('pending', 'active', 'disabled', 'deleted'));

-- ============================================================
-- 3. 验证：确认约束已更新
-- ============================================================
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.users'::regclass
   AND contype = 'c';
