/**
 * Sistema de Recibos de Pagamento - Controller do Histórico de Recibos
 */
import * as db from './db.js?v=13';
import * as utils from './utils.js?v=13';
import { supabase } from './supabase.js?v=13';

let unifiedList = [];
let navigateToViewFn = null;

export async function initHistory(navigateToView) {
    navigateToViewFn = navigateToView;
    setupEventListeners();
    await loadHistory();
}

function setupEventListeners() {
    const originFilter = document.getElementById('hist-filter-origin');
    const typeFilter = document.getElementById('hist-filter-type');

    if (originFilter) {
        originFilter.onchange = () => {
            const origin = originFilter.value;
            // Atualizar opções de Tipo
            if (origin === 'partners') {
                if (typeFilter) {
                    typeFilter.innerHTML = `
                        <option value="">Todos</option>
                        <option value="prolabore">Pró-labore</option>
                    `;
                }
            } else if (origin === 'employees') {
                if (typeFilter) {
                    typeFilter.innerHTML = `
                        <option value="">Todos</option>
                        <option value="payroll">Folha</option>
                        <option value="advance">Adiantamento</option>
                    `;
                }
            } else {
                if (typeFilter) {
                    typeFilter.innerHTML = `
                        <option value="">Todos</option>
                        <option value="payroll">Folha</option>
                        <option value="advance">Adiantamento</option>
                        <option value="prolabore">Pró-labore</option>
                    `;
                }
            }
            filterHistory();
        };
    }

    document.getElementById('hist-filter-name').oninput = filterHistory;
    document.getElementById('hist-filter-month').onchange = filterHistory;
    document.getElementById('hist-filter-year').onchange = filterHistory;
    document.getElementById('hist-filter-period').oninput = filterHistory;
    if (typeFilter) {
        typeFilter.onchange = filterHistory;
    }
    
    // Botão Limpar Filtros
    document.getElementById('hist-btn-clear-filters').onclick = () => {
        if (originFilter) originFilter.value = '';
        document.getElementById('hist-filter-name').value = '';
        document.getElementById('hist-filter-month').value = '';
        document.getElementById('hist-filter-year').value = '';
        document.getElementById('hist-filter-period').value = '';
        if (typeFilter) {
            typeFilter.innerHTML = `
                <option value="">Todos</option>
                <option value="payroll">Folha</option>
                <option value="advance">Adiantamento</option>
                <option value="prolabore">Pró-labore</option>
            `;
            typeFilter.value = '';
        }
        renderHistoryTable(unifiedList);
    };
}

function isProlaboreTransaction(item) {
    const desc = (item.description || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    return desc.includes('prolabore') || desc.includes('pró-labore') || cat.includes('prolabore') || cat.includes('pró-labore');
}

async function loadHistory() {
    // 1. Obter os recibos de funcionários
    let receipts = [];
    try {
        receipts = await db.getReceipts();
        receipts = receipts.map(r => ({
            ...r,
            tipo_origem: 'employees',
            tipo_recibo: r.tipo_recibo || r.receipt_type || 'payroll'
        }));
    } catch (err) {
        console.error('[HISTÓRICO] Erro ao carregar recibos locais:', err);
    }

    // 2. Obter dados de Pró-labore do Supabase (se autenticado)
    let proLabores = [];
    if (supabase) {
        try {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData?.user?.id;
            if (userId) {
                // Carregar sócios, períodos e transações em paralelo
                const [partnersRes, periodsRes, transactionsRes] = await Promise.all([
                    supabase.from('prolabore_partners').select('*').eq('user_id', userId),
                    supabase.from('prolabore_periods').select('*').eq('user_id', userId),
                    supabase.from('prolabore_transactions').select('*').eq('user_id', userId)
                ]);

                if (partnersRes.error) throw partnersRes.error;
                if (periodsRes.error) throw periodsRes.error;
                if (transactionsRes.error) throw transactionsRes.error;

                const partners = partnersRes.data || [];
                const periods = periodsRes.data || [];
                const transactions = transactionsRes.data || [];

                const partnersMap = new Map(partners.map(p => [p.id, p]));
                const transactionsByPeriod = new Map();
                transactions.forEach(t => {
                    if (!transactionsByPeriod.has(t.period_id)) {
                        transactionsByPeriod.set(t.period_id, []);
                    }
                    transactionsByPeriod.get(t.period_id).push(t);
                });

                proLabores = periods.map(period => {
                    const partner = partnersMap.get(period.partner_id);
                    if (!partner) return null;

                    const periodTrans = transactionsByPeriod.get(period.id) || [];
                    const expenses = periodTrans.filter(t => (t.type === 'expense' || t.type === 'tax' || t.type === 'withdraw') && !isProlaboreTransaction(t));
                    const receivables = periodTrans.filter(t => (t.type === 'receivable' || t.type === 'income') && !isProlaboreTransaction(t));

                    const grossProlabore = parseFloat(period.gross_amount || 0);
                    const despesas = expenses.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                    const receitas = receivables.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                    const valorLiquido = grossProlabore + receitas - despesas;

                    // Mapeamento de data de competência
                    let mm = '';
                    let yyyy = '';
                    let lastDay = 30;
                    if (period.reference_month) {
                        const parts = period.reference_month.split('-'); // [YYYY, MM, DD]
                        yyyy = parts[0];
                        mm = parts[1];
                        lastDay = new Date(parseInt(yyyy, 10), parseInt(mm, 10), 0).getDate();
                    }

                    const competencia = (mm && yyyy) ? `${mm}/${yyyy}` : 'N/A';
                    const periodoLabel = (mm && yyyy) ? `01/${mm}/${yyyy} à ${lastDay}/${mm}/${yyyy}` : 'N/A';

                    const dataEmissao = period.updated_at || period.created_at || new Date().toISOString();

                    return {
                        id: period.id,
                        partner_id: period.partner_id,
                        tipo_origem: 'partners',
                        tipo_recibo: 'prolabore',
                        funcionario_nome: partner.name,
                        competencia: competencia,
                        periodo: periodoLabel,
                        data_emissao: dataEmissao,
                        valor_liquido: valorLiquido,
                        raw_reference_month: period.reference_month?.substring(0, 7)
                    };
                }).filter(Boolean);
            }
        } catch (err) {
            console.error('[HISTÓRICO] Erro ao carregar dados do Supabase:', err);
        }
    }

    // 3. Mesclar e ordenar
    unifiedList = [...receipts, ...proLabores];
    unifiedList.sort((a, b) => new Date(b.data_emissao || b.created_at) - new Date(a.data_emissao || a.created_at));

    // 4. Filtrar e exibir
    filterHistory();
}

function renderHistoryTable(list) {
    const tbody = document.querySelector('#hist-table tbody');
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:var(--text-muted); padding: 30px 0;">
                    Nenhum registro de pagamento encontrado no histórico.
                </td>
            </tr>
        `;
        return;
    }
    
    list.forEach(rec => {
        const tr = document.createElement('tr');
        
        if (rec.tipo_recibo === 'prolabore') {
            const badgeClass = 'badge-info';
            const badgeText = 'Pró-labore';
            
            tr.innerHTML = `
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td><strong>${rec.funcionario_nome}</strong></td>
                <td>${rec.competencia || 'N/A'}</td>
                <td>${rec.periodo || 'N/A'}</td>
                <td>${utils.formatDateBR(rec.data_emissao)}</td>
                <td style="font-weight: bold; color: var(--primary-color);">${utils.formatCurrency(rec.valor_liquido)}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm btn-view-prolabore">Ver</button>
                        <button class="btn btn-secondary btn-sm btn-edit-prolabore">Editar</button>
                    </div>
                </td>
            `;
            
            const handleNavigation = () => {
                sessionStorage.setItem('selectedProlaborePartner', rec.partner_id);
                sessionStorage.setItem('selectedProlaboreMonth', rec.raw_reference_month);
                if (typeof navigateToViewFn === 'function') {
                    navigateToViewFn('prolabore');
                } else {
                    const link = document.querySelector('.sidebar-menu [data-view="prolabore"] a');
                    if (link) link.click();
                }
            };
            
            tr.querySelector('.btn-view-prolabore').onclick = handleNavigation;
            tr.querySelector('.btn-edit-prolabore').onclick = handleNavigation;
        } else {
            const isAdvance = (rec.tipo_recibo === 'advance' || rec.receipt_type === 'advance');
            const badgeClass = isAdvance ? 'badge-advance' : 'badge-payroll';
            const badgeText = isAdvance ? 'Adiantamento' : 'Folha';
            
            tr.innerHTML = `
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td><strong>${rec.funcionario_nome}</strong></td>
                <td>${rec.competencia || 'N/A'}</td>
                <td>${rec.periodo || 'N/A'}</td>
                <td>${utils.formatDateBR(rec.data_emissao)}</td>
                <td style="font-weight: bold; color: var(--primary-color);">${utils.formatCurrency(rec.valor_liquido)}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm btn-open" data-id="${rec.id}">Editar</button>
                        <button class="btn btn-secondary btn-sm btn-duplicate" data-id="${rec.id}">Usar como modelo</button>
                        <button class="btn btn-danger btn-sm btn-delete" data-id="${rec.id}">Excluir</button>
                    </div>
                </td>
            `;
            
            // Editar
            tr.querySelector('.btn-open').onclick = () => {
                window.dispatchEvent(new CustomEvent('editReceipt', { detail: rec.id }));
                const link = document.querySelector('.sidebar-menu [data-view="recibo"] a');
                if (link) link.click();
            };
            
            // Usar como modelo
            tr.querySelector('.btn-duplicate').onclick = async () => {
                await duplicarRecibo(rec.id);
            };
            
            // Excluir
            tr.querySelector('.btn-delete').onclick = async () => {
                const tipoLabel = isAdvance ? 'de adiantamento' : 'de folha';
                if (confirm(`Deseja excluir permanentemente o recibo ${tipoLabel} de ${rec.funcionario_nome} referente a ${rec.competencia}?`)) {
                    await db.deleteReceipt(rec.id);
                    await loadHistory();
                }
            };
        }
        
        tbody.appendChild(tr);
    });
}

function filterHistory() {
    const originQuery = document.getElementById('hist-filter-origin')?.value || '';
    const nameQuery = document.getElementById('hist-filter-name').value.toLowerCase();
    const monthQuery = document.getElementById('hist-filter-month').value;
    const yearQuery = document.getElementById('hist-filter-year').value;
    const periodQuery = document.getElementById('hist-filter-period').value.toLowerCase();
    const typeQuery = document.getElementById('hist-filter-type')?.value || '';
    
    const filtered = unifiedList.filter(rec => {
        // 1. Filtrar Origem
        if (originQuery && rec.tipo_origem !== originQuery) {
            return false;
        }
        
        // 2. Filtrar Tipo
        if (typeQuery && rec.tipo_recibo !== typeQuery) {
            return false;
        }
        
        // 3. Filtrar Nome
        if (nameQuery && !(rec.funcionario_nome || '').toLowerCase().includes(nameQuery)) {
            return false;
        }
        
        // 4. Filtrar Competência
        let matchesMonth = true;
        let matchesYear = true;
        if (rec.competencia) {
            const parts = rec.competencia.split('/'); // MM/AAAA
            if (monthQuery) {
                matchesMonth = parts[0] === monthQuery;
            }
            if (yearQuery) {
                matchesYear = parts[1] === yearQuery;
            }
        } else {
            if (monthQuery || yearQuery) {
                matchesMonth = false;
                matchesYear = false;
            }
        }
        if (!matchesMonth || !matchesYear) return false;
        
        // 5. Filtrar Período de Competência
        if (periodQuery) {
            const matchesPeriod = (rec.periodo && rec.periodo.toLowerCase().includes(periodQuery)) ||
                                  (rec.competencia && rec.competencia.toLowerCase().includes(periodQuery));
            if (!matchesPeriod) return false;
        }
        
        return true;
    });
    
    renderHistoryTable(filtered);
}

async function duplicarRecibo(id) {
    const reciboOriginal = await db.getReceiptById(id);
    
    if (!reciboOriginal) {
        alert('Recibo não encontrado');
        return;
    }
    
    const copia = JSON.parse(JSON.stringify(reciboOriginal));
    
    delete copia.id;
    delete copia.created_at;
    delete copia.updated_at;
    delete copia.numero_recibo;
    delete copia.numeroRecibo;
    
    copia.modo = 'novo';
    copia.origemReciboId = id;
    
    sessionStorage.setItem('reciboDuplicado', JSON.stringify(copia));
    
    window.skipReceiptInit = true;
    
    const link = document.querySelector('.sidebar-menu [data-view="recibo"] a');
    if (link) link.click();
}
