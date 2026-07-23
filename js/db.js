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
import { supabase } from './supabase.js?v=2';
import * as remoteDb from './db_supabase.js?v=2';

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

function showConnectionWarning(message) {
    console.warn(message);
    const banner = document.createElement('div');
    banner.className = 'connection-warning-banner';
    banner.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #f59e0b;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 0.85rem;
        font-family: sans-serif;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    banner.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <span>${message}</span>
        <button style="background:none; border:none; color:white; cursor:pointer; font-weight:bold; font-size: 1.1rem; line-height: 1;" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(banner);
    setTimeout(() => {
        if (banner.parentElement) banner.remove();
    }, 6000);
}

export async function getEmployees() {
    // Verificar se existe cliente Supabase e sessão ativa
    if (supabase) {
        let session = null;
        try {
            const res = await supabase.auth.getSession();
            session = res.data.session;
        } catch (err) {
            console.error('[AUTH ERROR] Falha ao recuperar sessão:', err.message);
        }

        if (session) {
            try {
                const remoteList = await remoteDb.fetchEmployeesFromSupabase();
                if (remoteList) {
                    console.log('[DB STATUS] Funcionários sincronizados com sucesso.');
                    // Recuperar lista local atual para preservar os dados de férias (não migrados nesta etapa)
                    const localData = localStorage.getItem(KEYS.EMPLOYEES);
                    const localList = localData ? JSON.parse(localData) : [];
                    
                    const syncedList = remoteList.map(remote => {
                        // Tentar achar correspondente local por ID ou por nome
                        const localItem = localList.find(l => l.id === remote.id || l.nome === remote.name);
                        return {
                            id: remote.id,
                            nome: remote.name,
                            cpf: remote.cpf || '',
                            cargo: remote.job_title || '',
                            data_admissao: remote.admission_date || '',
                            salario_base: parseFloat(remote.base_salary || 0),
                            telefone: remote.phone || '',
                            observacoes: remote.notes || '',
                            created_at: remote.created_at,
                            updated_at: remote.updated_at,
                            // Preservar propriedades de férias no LocalStorage
                            ferias_data_prevista: localItem?.ferias_data_prevista || '',
                            ferias_dias: localItem?.ferias_dias || 30,
                            ferias_status: localItem?.ferias_status || 'pendente'
                        };
                    });
                    
                    // Atualizar cache
                    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(syncedList));
                    return syncedList.sort((a, b) => a.nome.localeCompare(b.nome));
                }
            } catch (err) {
                console.error('[DB ERROR] Falha ao buscar funcionários do Supabase:', err.message);
                showConnectionWarning('Não foi possível sincronizar os dados com o Supabase. Exibindo cópia local do cache.');
                
                // Retornar cache local (nunca substituir o cache com lista vazia se der erro de conexão)
                const data = localStorage.getItem(KEYS.EMPLOYEES);
                const list = data ? JSON.parse(data) : [];
                return list.sort((a, b) => a.nome.localeCompare(b.nome));
            }
        }
    }
    
    // Modo offline completo (sem cliente Supabase ou sem login ativo)
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    const list = data ? JSON.parse(data) : [];
    return list.sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function getEmployeeById(id) {
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    const list = data ? JSON.parse(data) : [];
    const emp = list.find(e => e.id === id);
    return emp || null;
}

export async function saveEmployee(employee) {
    if (supabase) {
        let session = null;
        try {
            const res = await supabase.auth.getSession();
            session = res.data.session;
        } catch (err) {
            console.error('[AUTH ERROR] Falha ao obter sessão para salvar:', err.message);
        }

        if (session) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Sessão inválida ou expirada no Supabase.');
            
            const remoteData = {
                name: employee.nome,
                cpf: employee.cpf || null,
                job_title: employee.cargo || null,
                phone: employee.telefone || null,
                admission_date: employee.data_admissao || null,
                base_salary: employee.salario_base || 0,
                notes: employee.observacoes || null,
                user_id: user.id
            };
            
            // Verificar se o ID já é um UUID (já existia no Supabase)
            const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(employee.id);
            let savedRemote;
            
            try {
                if (employee.id && isUuid) {
                    savedRemote = await remoteDb.updateEmployeeInSupabase(employee.id, remoteData);
                } else {
                    savedRemote = await remoteDb.insertEmployeeToSupabase(remoteData);
                    employee.id = savedRemote.id;
                }
                employee.created_at = savedRemote.created_at;
                employee.updated_at = savedRemote.updated_at;
                console.log('[DB STATUS] Funcionário salvo com sucesso no Supabase.');
            } catch (err) {
                console.error('[DB ERROR] Falha ao salvar no Supabase:', err.message);
                // Bloquear gravação local e lançar erro claro
                throw new Error('O banco de dados remoto está indisponível ou você não tem permissão para esta alteração. As alterações exigem uma conexão ativa.');
            }
            
            // Salvar no LocalStorage cache (somente após sucesso no Supabase)
            const data = localStorage.getItem(KEYS.EMPLOYEES);
            let list = data ? JSON.parse(data) : [];
            
            const index = list.findIndex(e => e.id === employee.id || e.nome === employee.nome);
            if (index !== -1) {
                list[index] = { ...list[index], ...employee };
            } else {
                list.push(employee);
            }
            
            localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(list));
            return employee;
        }
    }
    
    // Modo offline completo (sem Supabase ou sem login ativo)
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    let list = data ? JSON.parse(data) : [];
    
    if (employee.id) {
        const index = list.findIndex(e => e.id === employee.id || e.nome === employee.nome);
        if (index !== -1) {
            list[index] = { ...list[index], ...employee };
        } else {
            list.push(employee);
        }
    } else {
        employee.id = 'emp_' + Math.random().toString(36).substr(2, 9);
        employee.created_at = new Date().toISOString();
        list.push(employee);
    }
    
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(list));
    return employee;
}

export async function deleteEmployee(id) {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
    
    if (supabase) {
        let session = null;
        try {
            const res = await supabase.auth.getSession();
            session = res.data.session;
        } catch (err) {
            console.error('[AUTH ERROR] Falha ao obter sessão para excluir:', err.message);
        }

        if (session) {
            if (isUuid) {
                try {
                    await remoteDb.deleteEmployeeFromSupabase(id);
                    console.log('[DB STATUS] Funcionário excluído com sucesso do Supabase.');
                } catch (err) {
                    console.error('[DB ERROR] Falha ao excluir no Supabase:', err.message);
                    // Bloquear exclusão local e lançar erro claro
                    throw new Error('O banco de dados remoto está indisponível ou você não tem permissão para esta exclusão. As alterações exigem uma conexão ativa.');
                }
            } else {
                console.log('[DB STATUS] Excluindo funcionário local herdado.');
            }
            
            // Remover do LocalStorage cache
            const data = localStorage.getItem(KEYS.EMPLOYEES);
            let list = data ? JSON.parse(data) : [];
            list = list.filter(e => e.id !== id);
            localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(list));
            return true;
        }
    }
    
    // Modo offline completo (sem Supabase ou sem login ativo)
    const data = localStorage.getItem(KEYS.EMPLOYEES);
    let list = data ? JSON.parse(data) : [];
    list = list.filter(e => e.id !== id);
    localStorage.setItem(KEYS.EMPLOYEES, JSON.stringify(list));
    return true;
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
