-- 20260811180000_add_receipt_type_to_receipts.sql
-- Adiciona suporte ao tipo de recibo (Folha Mensal / Adiantamento)

ALTER TABLE public.receipts
ADD COLUMN IF NOT EXISTS receipt_type TEXT NOT NULL DEFAULT 'payroll';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'receipts_receipt_type_check'
    ) THEN
        ALTER TABLE public.receipts
        ADD CONSTRAINT receipts_receipt_type_check CHECK (receipt_type IN ('payroll', 'advance'));
    END IF;
END $$;

-- Atualizar constraint única para permitir folha e adiantamento no mesmo mês para o mesmo funcionário
ALTER TABLE public.receipts
DROP CONSTRAINT IF EXISTS unique_user_employee_month;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_employee_month_type'
    ) THEN
        ALTER TABLE public.receipts
        ADD CONSTRAINT unique_user_employee_month_type UNIQUE(user_id, employee_id, reference_month, receipt_type);
    END IF;
END $$;

-- Permitir tipo de item 'advance' em receipt_items
ALTER TABLE public.receipt_items
DROP CONSTRAINT IF EXISTS receipt_items_item_type_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'receipt_items_item_type_check'
    ) THEN
        ALTER TABLE public.receipt_items
        ADD CONSTRAINT receipt_items_item_type_check CHECK (item_type IN ('earning', 'deduction', 'advance'));
    END IF;
END $$;
