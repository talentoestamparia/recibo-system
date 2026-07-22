/**
 * Sistema de Recibos de Pagamento - Camada de Banco de Dados (Supabase Ready)
 * 
 * Este arquivo abstrai todas as operações de banco de dados do sistema.
 * Inicialmente, ele utiliza o localStorage para armazenar as informações, mas todas as
 * funções retornam Promises e são assíncronas.
 * 
 * PARA MIGRAR PARA O SUPABASE:
 * 1. Adicione a biblioteca do Supabase no index.html:
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * 
 * 2. Inicialize o cliente do Supabase:
 *    const supabase = supabase.createClient('SUA_URL_SUPABASE', 'SUA_CHAVE_ANONIMA')
 * 
 * 3. Substitua o corpo das funções abaixo pelas consultas correspondentes do Supabase:
 *    Ex:
 *    export async function getEmployees() {
 *        const { data, error } = await supabase.from('funcionarios').select('*').order('nome');
 *        if (error) throw error;
 *        return data;
 *    }
 */

// Chaves do LocalStorage
const KEYS = {
    EMPLOYEES: 'recibos_db_employees',
    RECEIPTS: 'recibos_db_receipts',
    SETTINGS: 'recibos_db_settings'
};

// Dados padrão iniciais (Seed)
const DEFAULT_SETTINGS = {
    empresa_nome: 'ESTAMPARIA JL LTDA - ME',
    empresa_cnpj: '25.140.946/0001-84',
    empresa_cidade: 'Sarandi-PR',
    empresa_logo: '', // Base64 ou URL
    cor_principal: '#1e3f20' // Verde elegante floresta
};

const DEFAULT_EMPLOYEES = [
    {
        id: 'emp-1',
        nome: 'Kevin Eduardo',
        cpf: '123.456.789-00',
        cargo: 'Auxiliar de Estamparia',
        data_admissao: '2024-02-15',
        salario_base: 1621.00,
        telefone: '(44) 99876-5432',
        observacoes: 'Funcionário excelente, pontual.',
        ferias_data_prevista: '2026-08-10', // ~20 dias a partir da data atual (2026-07-21)
        ferias_dias: 30,
        ferias_status: 'programada'
    },
    {
        id: 'emp-2',
        nome: 'Ana Julia Santos',
        cpf: '987.654.321-11',
        cargo: 'Designer de Estampas',
        data_admissao: '2023-05-10',
        salario_base: 2450.00,
        telefone: '(44) 99123-4567',
        observacoes: 'Necessita agendar período de férias.',
        ferias_data_prevista: '2026-05-01', // Férias vencidas
        ferias_dias: 30,
        ferias_status: 'pendente'
    },
    {
        id: 'emp-3',
        nome: 'Carlos Henrique Lima',
        cpf: '456.789.123-22',
        cargo: 'Supervisor de Produção',
        data_admissao: '2022-10-01',
        salario_base: 3200.00,
        telefone: '(44) 98888-7777',
        observacoes: 'Em gozo de férias atualmente.',
        ferias_data_prevista: '2026-07-10', // Começou dia 10 de Julho
        ferias_dias: 15,
        ferias_status: 'andamento'
    },
    {
        id: 'emp-4',
        nome: 'Mariana Souza Cruz',
        cpf: '321.654.987-33',
        cargo: 'Assistente Administrativo',
        data_admissao: '2025-01-20',
        salario_base: 1800.00,
        telefone: '(44) 99777-6666',
        observacoes: 'Férias previstas para Setembro.',
        ferias_data_prevista: '2026-09-15', // ~55 dias a partir da data atual
        ferias_dias: 30,
        ferias_status: 'programada'
    }
];

const DEFAULT_RECEIPTS = [
    {
        id: 'rec-1',
        funcionario_id: 'emp-1',
        funcionario_nome: 'Kevin Eduardo',
        competencia: '06/2026',
        periodo: '01/06/2026 à 30/06/2026',
        data_emissao: '2026-06-30',
        vencimentos: [
            { descricao: 'Salário Base 01/06/2026 à 30/06/2026', valor: 1621.00, recorrente: true },
            { descricao: 'cesta', valor: 300.00, recorrente: true },
            { descricao: 'Hora-Extra', valor: 52.15, recorrente: false }
        ],
        descontos: [
            { descricao: 'vale', valor: 500.00, recorrente: false },
            { descricao: 'INSS', valor: 126.01, recorrente: true },
            { descricao: 'FALTAS', valor: 2.80, recorrente: false }
        ],
        valor_liquido: 1344.34,
        observacoes: 'Pagamento referente à competência Junho/2026.',
        created_at: '2026-06-30T17:00:00.000Z'
    }
];

// Helper: Inicializa banco de dados com dados padrão se estiver vazio
function initializeDB() {
    if (!localStorage.getItem(KEYS.SETTINGS)) {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(KEYS.EMPLOYEES)) {
        localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(DEFAULT_EMPLOYEES));
    }
    if (!localStorage.getItem(KEYS.RECEIPTS)) {
        localStorage.setItem(KEYS.RECEIPTS, JSON.stringify(DEFAULT_RECEIPTS));
    }
}

// Inicializar na importação
initializeDB();

// --- CONFIGURAÇÕES ---

export async function getSettings() {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.SETTINGS);
        resolve(data ? JSON.parse(data) : DEFAULT_SETTINGS);
    });
}

export async function saveSettings(settings) {
    return new Promise((resolve) => {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
        // Disparar evento customizado para notificar mudança de tema/configurações
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings }));
        resolve(settings);
    });
}

// --- FUNCIONÁRIOS ---

export async function getEmployees() {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.EMPLOYEES);
        const list = data ? JSON.parse(data) : [];
        // Ordenar por nome
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        resolve(list);
    });
}

export async function getEmployeeById(id) {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.EMPLOYEES);
        const list = data ? JSON.parse(data) : [];
        const emp = list.find(e => e.id === id);
        resolve(emp || null);
    });
}

export async function saveEmployee(employee) {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.EMPLOYEES);
        let list = data ? JSON.parse(data) : [];
        
        if (employee.id) {
            // Editando existente
            list = list.map(e => e.id === employee.id ? { ...e, ...employee } : e);
        } else {
            // Novo
            employee.id = 'emp_' + Math.random().toString(36).substr(2, 9);
            employee.created_at = new Date().toISOString();
            list.push(employee);
        }
        
        localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(list));
        resolve(employee);
    });
}

export async function deleteEmployee(id) {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.EMPLOYEES);
        let list = data ? JSON.parse(data) : [];
        list = list.filter(e => e.id !== id);
        localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(list));
        resolve(true);
    });
}

// --- RECIBOS ---

export async function getReceipts() {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.RECEIPTS);
        const list = data ? JSON.parse(data) : [];
        // Ordenar por data de criação descrescente (mais recentes primeiro)
        list.sort((a, b) => new Date(b.created_at || b.data_emissao) - new Date(a.created_at || a.data_emissao));
        resolve(list);
    });
}

export async function getReceiptById(id) {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.RECEIPTS);
        const list = data ? JSON.parse(data) : [];
        const receipt = list.find(r => r.id === id);
        resolve(receipt || null);
    });
}

export async function saveReceipt(receipt) {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.RECEIPTS);
        let list = data ? JSON.parse(data) : [];
        
        if (receipt.id) {
            // Editando existente
            list = list.map(r => r.id === receipt.id ? { ...r, ...receipt } : r);
        } else {
            // Novo
            receipt.id = 'rec_' + Math.random().toString(36).substr(2, 9);
            receipt.created_at = new Date().toISOString();
            list.push(receipt);
        }
        
        localStorage.setItem(KEYS.RECEIPTS, JSON.stringify(list));
        resolve(receipt);
    });
}

export async function deleteReceipt(id) {
    return new Promise((resolve) => {
        const data = localStorage.getItem(KEYS.RECEIPTS);
        let list = data ? JSON.parse(data) : [];
        list = list.filter(r => r.id !== id);
        localStorage.setItem(KEYS.RECEIPTS, JSON.stringify(list));
        resolve(true);
    });
}
