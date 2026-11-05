-- 019_currency_support.sql
-- 多币种记账 + 汇率换算
--
-- 口径（三条，务必遵守）：
--   1) 本位币挂在账本上：ledgers.base_currency，聚合/预算/报表一律以它为准
--   2) 交易保留原币 + 冻结记账当日汇率：历史账单不随汇率波动而变值
--   3) 存双金额：amount = 原币金额（保持向后兼容），base_amount = 本位币金额
--      所有求和/占比/趋势 只用 base_amount，绝不再直接 sum(amount)
--
-- 部署：Supabase Dashboard → SQL Editor → 粘贴全文 → Run
-- 前置：018_fuel_tracking.sql 已执行
-- 可重复执行：所有 DDL 均为 IF NOT EXISTS / DROP-then-ADD

-- ============================================================
-- 1. 账本本位币
-- ============================================================
ALTER TABLE public.ledgers ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'CNY';

ALTER TABLE public.ledgers DROP CONSTRAINT IF EXISTS ledgers_base_currency_check;
ALTER TABLE public.ledgers ADD CONSTRAINT ledgers_base_currency_check
  CHECK (base_currency ~ '^[A-Z]{3}$');

-- ============================================================
-- 2. transactions 币种与换算字段
--    currency        原币种（大写 ISO 4217，3 位）
--    amount          原义不变 = 原币金额（历史数据默认视为 CNY）
--    exchange_rate   记账时冻结的汇率：1 原币 = exchange_rate 本位币
--    base_amount     换算后的本位币金额 —— 所有聚合的唯一口径
-- ============================================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CNY';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS base_amount numeric;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_currency_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_currency_check
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_exchange_rate_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_exchange_rate_check
  CHECK (exchange_rate > 0);

-- 历史数据回填：既有无币种记录一律视为本位币、汇率 1
UPDATE public.transactions SET currency = 'CNY' WHERE currency IS NULL;
UPDATE public.transactions SET base_amount = amount WHERE base_amount IS NULL;

-- 聚合查询普遍带 ledger_id + date 过滤
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_date
  ON public.transactions (ledger_id, date DESC);

-- ============================================================
-- 3. 汇率表：1 base_currency = rate quote_currency
--    仅作为「当期汇率缓存」使用；历史账单的汇率已冻结在
--    transactions.exchange_rate，不受本表更新影响。
--    客户端只读；写入走 service_role（自动绕过 RLS）。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id             bigserial PRIMARY KEY,
  base_currency  text NOT NULL,
  quote_currency text NOT NULL,
  rate           numeric NOT NULL CHECK (rate > 0),
  rate_date      date NOT NULL DEFAULT CURRENT_DATE,
  source         text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON public.exchange_rates (base_currency, quote_currency, rate_date DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- 汇率为公开数据：登录用户与游客均可读；不开放客户端写
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='exchange_rates' AND policyname='exchange_rates_select'
  ) THEN
    CREATE POLICY "exchange_rates_select" ON public.exchange_rates
      FOR SELECT USING (true);
  END IF;
END $$;

GRANT SELECT ON public.exchange_rates TO anon, authenticated;

-- ============================================================
-- 4. 验证
-- ============================================================
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (
        (table_name = 'transactions' AND column_name IN ('currency','exchange_rate','base_amount'))
     OR (table_name = 'ledgers'      AND column_name = 'base_currency')
     OR (table_name = 'exchange_rates')
   )
 ORDER BY table_name, ordinal_position;

-- 回填结果自检：base_amount_missing 必须为 0
SELECT count(*)                                   AS tx_total,
       count(*) FILTER (WHERE base_amount IS NULL) AS base_amount_missing,
       count(*) FILTER (WHERE currency <> 'CNY')   AS foreign_tx
  FROM public.transactions;
