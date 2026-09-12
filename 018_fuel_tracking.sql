-- 018_fuel_tracking.sql
-- 油耗统计功能：车辆管理 + 加油记账（升数/里程）+ 自动算油耗
-- 部署：Supabase Dashboard → SQL Editor → 粘贴全文 → Run

-- ============================================================
-- 1. 车辆表：每个账本可有多辆车，分开统计油耗
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id  uuid NOT NULL REFERENCES public.ledgers(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 车辆 RLS：账本 owner + 成员可见/可管理
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='vehicles_select') THEN
    CREATE POLICY "vehicles_select" ON public.vehicles
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.ledgers l WHERE l.id = vehicles.ledger_id AND l.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.ledger_members lm WHERE lm.ledger_id = vehicles.ledger_id AND lm.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='vehicles_insert') THEN
    CREATE POLICY "vehicles_insert" ON public.vehicles
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.ledgers l WHERE l.id = vehicles.ledger_id AND l.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.ledger_members lm WHERE lm.ledger_id = vehicles.ledger_id AND lm.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='vehicles_update') THEN
    CREATE POLICY "vehicles_update" ON public.vehicles
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.ledgers l WHERE l.id = vehicles.ledger_id AND l.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.ledger_members lm WHERE lm.ledger_id = vehicles.ledger_id AND lm.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='vehicles_delete') THEN
    CREATE POLICY "vehicles_delete" ON public.vehicles
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.ledgers l WHERE l.id = vehicles.ledger_id AND l.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.ledger_members lm WHERE lm.ledger_id = vehicles.ledger_id AND lm.user_id = auth.uid())
      );
  END IF;
END $$;

-- ============================================================
-- 2. transactions 表新增油耗相关字段（可空，非油费记录不填）
--    fuel_liters        本次加油升数（L）
--    odometer           加油时总里程表读数（km）
--    vehicle_id         关联车辆（多车区分）
--    fuel_consumption   本次单次油耗（L/100km），保存时计算存储
-- ============================================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fuel_liters numeric;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS odometer numeric;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fuel_consumption numeric;

-- ============================================================
-- 3. 验证
-- ============================================================
SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('vehicles','transactions')
   AND column_name IN ('fuel_liters','odometer','vehicle_id','fuel_consumption','name','ledger_id')
 ORDER BY table_name, column_name;
