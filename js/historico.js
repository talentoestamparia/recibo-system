/**
 * Sistema de Recibos de Pagamento - Controller do Histórico de Recibos
 */
import * as db from './db.js';
import * as utils from './utils.js';

let receiptsList = [];

export async function initHistory(navigateToView) {
    setupEventListeners();
    await loadHistory();
}

function setupEventListeners() {
    // Escutar inputs de filtros
    document.getElementById('hist-filter-name').oninput = filterHistory;
    document.getElementById('hist-filter-month').onchange = filterHistory;
    document.getElementById('hist-filter-year').onchange = filterHistory;
    document.getElementById('hist-filter-period').oninput = filterHistory;
    const typeFilter = document.getElementById('hist-filter-type');
    if (typeFilter) {
        typeFilter.onchange = filterHistory;
    }
    
    // Botão Limpar Filtros
    document.getElementById('hist-btn-clear-filters').onclick = () => {
        document.getElementById('hist-filter-name').value = '';
        document.getElementById('hist-filter-month').value = '';
        document.getElementById('hist-filter-year').value = '';
        document.getElementById('hist-filter-period').value = '';
        if (typeFilter) typeFilter.value = '';
        renderHistoryTable(receiptsList);
    };
}

async function loadHistory() {
    receiptsList = await db.getReceipts();
    renderHistoryTable(receiptsList);
}

function renderHistoryTable(list) {
    const tbody = document.querySelector('#hist-table tbody');
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:var(--text-muted); padding: 30px 0;">
                    Nenhum recibo de pagamento encontrado no histórico.
                </td>
            </tr>
        `;
        return;
    }
    
    list.forEach(rec => {
        const isAdvance = (rec.tipo_recibo === 'advance' || rec.receipt_type === 'advance');
        const badgeClass = isAdvance ? 'badge-advance' : 'badge-payroll';
        const badgeText = isAdvance ? 'Adiantamento' : 'Folha';
        
        const tr = document.createElement('tr');
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
        
        tbody.appendChild(tr);
    });
}

function filterHistory() {
    const nameQuery = document.getElementById('hist-filter-name').value.toLowerCase();
    const monthQuery = document.getElementById('hist-filter-month').value;
    const yearQuery = document.getElementById('hist-filter-year').value;
    const periodQuery = document.getElementById('hist-filter-period').value.toLowerCase();
    const typeQuery = document.getElementById('hist-filter-type')?.value || '';
    
    const filtered = receiptsList.filter(rec => {
        // Filtrar Tipo
        if (typeQuery) {
            const recType = rec.tipo_recibo || rec.receipt_type || 'payroll';
            if (recType !== typeQuery) return false;
        }
        
        // Filtrar Nome
        const matchesName = (rec.funcionario_nome || '').toLowerCase().includes(nameQuery);
        
        // Filtrar Competência
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
        
        // Filtrar Período de Competência
        const matchesPeriod = !periodQuery || 
                             (rec.periodo && rec.periodo.toLowerCase().includes(periodQuery)) ||
                             (rec.competencia && rec.competencia.toLowerCase().includes(periodQuery));
        
        return matchesName && matchesMonth && matchesYear && matchesPeriod;
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
    
    // Configurar flag para evitar que initReceipt limpe a cópia
    window.skipReceiptInit = true;
    
    // Navegar para o editor de recibo
    const link = document.querySelector('.sidebar-menu [data-view="recibo"] a');
    if (link) link.click();
}
