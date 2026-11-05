-- 022_loans.sql
-- 借款记账：借出 / 借入 的标记与对手方（谁欠谁）
--
-- 背景：
--   借出 500 给朋友、向同事借 1000，本质是「债权债务」而不是消费/收入。
--   若按普通收支记账，当月支出/收入会虚高，预算也会被撑爆。
--
-- 口径（在 019~021 的口径之上追加）：
--   7) is_loan = true 的账目**不计入任何收支统计 / 预算 / 分析占比**，
--      但仍照常影响资金账户余额（借出后银行卡确实少了钱）
--   8) 借款方向由 type 推断，不额外存字段：
--        type = 'expense' + is_loan  → 资金流出：借出 / 归还欠款
--        type = 'income'  + is_loan  → 资金流入：借入 / 收回欠款
--   9) 欠款按「对方」净额法计算，无需配对：
--        净额 = 该对方的借款收入合计 − 借款支出合计
--        净额 < 0 → 对方欠我 | 净额 > 0 → 我欠对方 | 净额 = 0 → 已结清
--      因此还款/收回只需反向记一笔，自动抵消，不需要「已还清」状态字段
--
-- 部署：Supabase Dashboard → SQL Editor → 粘贴全文 → Run
-- 前置：021_accounts_transfer.sql 已执行
-- 可重复执行：ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS

-- ============================================================
-- 1. transactions 新增借款字段
--    is_loan            是否借款账目
--    loan_counterparty  借款对手方（"张三" / "招商银行"），用于按人汇总欠款
-- ============================================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_loan boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS loan_counterparty text;

-- 对方名去空白，避免「张三」与「张三 」被算成两个人
CREATE OR REPLACE FUNCTION public.normalize_loan_counterparty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_loan IS TRUE THEN
    NEW.loan_counterparty := NULLIF(btrim(COALESCE(NEW.loan_counterparty, '')), '');
  ELSE
    -- 非借款账目一律清空借款字段，避免开关来回切留下脏数据
    NEW.loan_counterparty := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_loan_counterparty ON public.transactions;
CREATE TRIGGER trg_normalize_loan_counterparty
  BEFORE INSERT OR UPDATE OF is_loan, loan_counterparty ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.normalize_loan_counterparty();

-- ============================================================
-- 2. 索引：借款账目是低频子集，用部分索引即可
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_loan
  ON public.transactions (ledger_id, date DESC)
  WHERE is_loan = true;

CREATE INDEX IF NOT EXISTS idx_transactions_loan_party
  ON public.transactions (ledger_id, loan_counterparty)
  WHERE is_loan = true AND loan_counterparty IS NOT NULL;

-- ============================================================
-- 3. PostgREST 架构缓存刷新（否则新列可能报 PGRST204）
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 4. 验证
-- ============================================================
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'transactions'
   AND column_name IN ('is_loan', 'loan_counterparty')
 ORDER BY column_name;

-- 自检 1：loan_total 应为 0（新功能上线前没有任何借款记录）
-- 自检 2：loan_without_party 必须为 0（借款必须有对方，否则无法汇总欠款）
-- 自检 3：loan_bad_direction 必须为 0（借款只能是 income / expense，不能是 transfer）
SELECT count(*) FILTER (WHERE is_loan)                                        AS loan_total,
       count(*) FILTER (WHERE is_loan AND loan_counterparty IS NULL)          AS loan_without_party,
       count(*) FILTER (WHERE is_loan AND type NOT IN ('income', 'expense'))  AS loan_bad_direction
  FROM public.transactions;
