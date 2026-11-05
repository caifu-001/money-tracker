-- 020_settlement_status.sql
-- 外币「待结算」状态：解决境外刷卡时本位币金额无法当场确定的记账准确性问题
--
-- 背景：
--   境外刷信用卡消费（如 USD 50）时，最终扣多少人民币由银行决定
--   （卡组织汇率 + 货币转换费 + 入账日汇率），记账当天无从得知。
--   此时若用市场参考汇率硬算 base_amount，必然与银行实际扣款不一致。
--
-- 口径（在 019 三条口径之上追加）：
--   4) 外币记账默认进入「待结算」：base_amount 留空，不计入任何汇总
--   5) 银行账单出来后，用实际扣款金额结算：写入 base_amount 并置 settled
--   6) settlement_status：'pending' 待结算 / 'settled' 已结算 / NULL 历史数据（视为已结算）
--
-- 部署：Supabase Dashboard → SQL Editor → 粘贴全文 → Run
-- 前置：019_currency_support.sql 已执行
-- 可重复执行：DDL 均为 IF NOT EXISTS / DROP-then-ADD

-- ============================================================
-- 1. transactions 新增结算相关字段
--    settlement_status  结算状态：pending / settled，NULL 视为历史已结算
--    settled_at         结算时间（写入实际扣款金额的时刻）
--    reference_amount   记账时的参考本位币金额（按参考汇率估算，仅展示与差额分析用，
--                       永远不参与汇总）
-- ============================================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS settlement_status text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS settled_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference_amount numeric;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_settlement_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_settlement_status_check
  CHECK (settlement_status IS NULL OR settlement_status IN ('pending', 'settled'));

-- 待结算期间 base_amount 允许为空（这是「未确定」，不是「数据缺失」）
ALTER TABLE public.transactions ALTER COLUMN base_amount DROP NOT NULL;

-- ============================================================
-- 2. 历史数据回填：019 之前/之后的既有记录都有 base_amount，一律视为已结算
-- ============================================================
UPDATE public.transactions SET settlement_status = 'settled' WHERE settlement_status IS NULL;
UPDATE public.transactions
   SET settled_at = COALESCE(created_at, now())
 WHERE settled_at IS NULL AND settlement_status = 'settled';

-- ============================================================
-- 3. 索引：待结算账目是高频查询（首页提示、结算校正入口）
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_pending
  ON public.transactions (ledger_id, date DESC)
  WHERE settlement_status = 'pending';

-- ============================================================
-- 4. 验证
-- ============================================================
SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'transactions'
   AND column_name IN ('settlement_status', 'settled_at', 'reference_amount', 'base_amount')
 ORDER BY ordinal_position;

-- 自检 1：历史数据必须已全部标记为 settled（unsettled_legacy 必须为 0）
-- 自检 2：pending_missing_base 必须为 0 —— 待结算记录本就该没有 base_amount，
--         但「已结算却没有 base_amount」是异常，必须为 0
SELECT count(*)                                                      AS tx_total,
       count(*) FILTER (WHERE settlement_status IS NULL)              AS unsettled_legacy,
       count(*) FILTER (WHERE settlement_status = 'pending')          AS pending_tx,
       count(*) FILTER (WHERE settlement_status = 'settled'
                          AND base_amount IS NULL)                    AS settled_missing_base
  FROM public.transactions;
