-- 20260722174000_create_receipt_system.sql
-- Migration inicial para o sistema de recibos

-- 1. Criação da Função para Atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Tabela de Funcionários (employees)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cpf TEXT,
    job_title TEXT,
    phone TEXT,
    admission_date DATE,
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para employees
CREATE TRIGGER trigger_update_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Tabela de Recibos (receipts)
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    reference_month DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    issue_date DATE NOT NULL,
    total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    source_receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_employee_month UNIQUE(user_id, employee_id, reference_month)
);

-- Trigger para receipts
CREATE TRIGGER trigger_update_receipts_updated_at
BEFORE UPDATE ON receipts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Tabela de Itens de Recibo (receipt_items)
CREATE TABLE IF NOT EXISTS receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('earning', 'deduction')),
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela de Férias (vacations)
CREATE TABLE IF NOT EXISTS vacations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    days INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para vacations
CREATE TRIGGER trigger_update_vacations_updated_at
BEFORE UPDATE ON vacations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Criação de Índices para Otimização de Consultas
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_employee_id ON receipts(employee_id);
CREATE INDEX IF NOT EXISTS idx_receipts_reference_month ON receipts(reference_month);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_vacations_employee_id ON vacations(employee_id);

-- 7. Ativação do RLS (Row Level Security) em Todas as Tabelas
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

-- 8. Criação de Políticas de Segurança (Apenas Usuários Autenticados e Acesso Restrito ao próprio user_id)

-- Políticas para 'employees'
CREATE POLICY select_employees_policy ON employees
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_employees_policy ON employees
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY update_employees_policy ON employees
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_employees_policy ON employees
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Políticas para 'receipts'
CREATE POLICY select_receipts_policy ON receipts
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_receipts_policy ON receipts
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY update_receipts_policy ON receipts
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_receipts_policy ON receipts
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Políticas para 'receipt_items'
CREATE POLICY select_receipt_items_policy ON receipt_items
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_receipt_items_policy ON receipt_items
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY update_receipt_items_policy ON receipt_items
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_receipt_items_policy ON receipt_items
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Políticas para 'vacations'
CREATE POLICY select_vacations_policy ON vacations
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY insert_vacations_policy ON vacations
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY update_vacations_policy ON vacations
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY delete_vacations_policy ON vacations
    FOR DELETE TO authenticated USING (user_id = auth.uid());
