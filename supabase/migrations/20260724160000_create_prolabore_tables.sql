-- 20260724160000_create_prolabore_tables.sql
-- Migration para criação do módulo de Pró-labore

-- 1. Tabela de Períodos de Pró-labore (prolabore_periods)
CREATE TABLE IF NOT EXISTS prolabore_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reference_month DATE NOT NULL,
    gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_prolabore_user_month UNIQUE(user_id, reference_month)
);

-- Trigger para atualizar updated_at em prolabore_periods
CREATE TRIGGER trigger_update_prolabore_periods_updated_at
BEFORE UPDATE ON prolabore_periods
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Tabela Única de Transações de Pró-labore (prolabore_transactions)
CREATE TABLE IF NOT EXISTS prolabore_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES prolabore_periods(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('expense', 'receivable', 'income', 'tax', 'withdraw')),
    transaction_date DATE,
    description TEXT NOT NULL,
    supplier_name TEXT,
    category TEXT,
    installment INTEGER,
    total_installments INTEGER,
    attachment_url TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_received BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar updated_at em prolabore_transactions
CREATE TRIGGER trigger_update_prolabore_transactions_updated_at
BEFORE UPDATE ON prolabore_transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Criação de Índices para Otimização de Consultas
CREATE INDEX IF NOT EXISTS idx_prolabore_periods_user_id ON prolabore_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_prolabore_periods_reference_month ON prolabore_periods(reference_month);
CREATE INDEX IF NOT EXISTS idx_prolabore_transactions_period_id ON prolabore_transactions(period_id);

-- 4. Ativação do RLS (Row Level Security) em Ambas as Tabelas
ALTER TABLE prolabore_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE prolabore_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Criação de Políticas de Segurança (Acesso Restrito ao próprio user_id do usuário autenticado)

-- Políticas para 'prolabore_periods'
CREATE POLICY select_prolabore_periods_policy ON prolabore_periods
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_prolabore_periods_policy ON prolabore_periods
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY update_prolabore_periods_policy ON prolabore_periods
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_prolabore_periods_policy ON prolabore_periods
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Políticas para 'prolabore_transactions'
CREATE POLICY select_prolabore_transactions_policy ON prolabore_transactions
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_prolabore_transactions_policy ON prolabore_transactions
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY update_prolabore_transactions_policy ON prolabore_transactions
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_prolabore_transactions_policy ON prolabore_transactions
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 6. Configuração de Grants (Apenas role authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON prolabore_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON prolabore_transactions TO authenticated;

REVOKE ALL ON prolabore_periods FROM anon;
REVOKE ALL ON prolabore_transactions FROM anon;
