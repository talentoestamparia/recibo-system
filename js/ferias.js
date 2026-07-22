/**
 * Sistema de Recibos de Pagamento - Controller do Painel de Férias
 */
import * as db from './db.js';
import * as utils from './utils.js';

export async function initVacations() {
    await loadVacationBoards();
}

async function loadVacationBoards() {
    const employees = await db.getEmployees();
    
    // Categorias de Férias
    const overdue = [];
    const in15Days = [];
    const in30Days = [];
    const in60Days = [];
    
    employees.forEach(emp => {
        if (!emp.ferias_data_prevista) return;
        
        const daysRemaining = utils.getDaysRemaining(emp.ferias_data_prevista);
        
        if (emp.ferias_status === 'pendente' && daysRemaining < 0) {
            overdue.push({ emp, daysRemaining });
        } else if (emp.ferias_status === 'programada') {
            if (daysRemaining >= 0 && daysRemaining <= 15) {
                in15Days.push({ emp, daysRemaining });
            } else if (daysRemaining > 15 && daysRemaining <= 30) {
                in30Days.push({ emp, daysRemaining });
            } else if (daysRemaining > 30 && daysRemaining <= 60) {
                in60Days.push({ emp, daysRemaining });
            }
        }
    });
    
    // Atualizar Contadores
    document.getElementById('ferias-count-overdue').innerText = overdue.length;
    document.getElementById('ferias-count-15').innerText = in15Days.length;
    document.getElementById('ferias-count-30').innerText = in30Days.length;
    document.getElementById('ferias-count-60').innerText = in60Days.length;
    
    // Renderizar Listas
    renderBoardList('ferias-list-overdue', overdue, 'vencida');
    renderBoardList('ferias-list-15', in15Days, '15d');
    renderBoardList('ferias-list-30', in30Days, '30d');
    renderBoardList('ferias-list-60', in60Days, '60d');
}

function renderBoardList(containerId, list, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding: 20px 0; border: 1px dashed var(--border-color); border-radius: var(--radius-sm);">
                Nenhum funcionário
            </div>
        `;
        return;
    }
    
    // Ordenar por proximidade das férias (dias restantes de forma crescente)
    list.sort((a, b) => a.daysRemaining - b.daysRemaining);
    
    list.forEach(({ emp, daysRemaining }) => {
        const card = document.createElement('div');
        card.className = 'vacation-card';
        
        let remainingText = '';
        let remainingColor = 'inherit';
        
        if (daysRemaining < 0) {
            remainingText = `Vencida há ${Math.abs(daysRemaining)} dias`;
            remainingColor = 'var(--danger-color)';
        } else if (daysRemaining === 0) {
            remainingText = 'Inicia hoje!';
            remainingColor = 'var(--success-color)';
        } else {
            remainingText = `${daysRemaining} dias restantes`;
            if (daysRemaining <= 15) {
                remainingColor = 'var(--danger-color)';
            } else if (daysRemaining <= 30) {
                remainingColor = 'var(--warning-color)';
            } else {
                remainingColor = 'var(--success-color)';
            }
        }
        
        card.innerHTML = `
            <div class="name">${emp.nome}</div>
            <div class="date-info">
                <div><strong>Cargo:</strong> ${emp.cargo}</div>
                <div><strong>Previsto:</strong> ${utils.formatDateBR(emp.ferias_data_prevista)} (${emp.ferias_dias} dias)</div>
            </div>
            <div class="days-remaining" style="color: ${remainingColor}; font-weight: bold;">
                ${remainingText}
            </div>
            
            <div class="form-group" style="margin-top: 8px; margin-bottom: 0;">
                <label style="font-size: 0.75rem; font-weight: 600; margin-bottom: 3px; display: block; color: var(--text-muted);">Status</label>
                <select class="status-select-inline" style="padding: 4px 8px; font-size:0.8rem; border-radius:var(--radius-sm); width: 100%; border: 1px solid var(--border-color);">
                    <option value="pendente" ${emp.ferias_status === 'pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="programada" ${emp.ferias_status === 'programada' ? 'selected' : ''}>Programada</option>
                    <option value="andamento" ${emp.ferias_status === 'andamento' ? 'selected' : ''}>Em Andamento</option>
                    <option value="concluida" ${emp.ferias_status === 'concluida' ? 'selected' : ''}>Concluída</option>
                </select>
            </div>
        `;
        
        // Listener para atualizar o status diretamente do card
        const select = card.querySelector('.status-select-inline');
        select.onchange = async (e) => {
            const newStatus = e.target.value;
            emp.ferias_status = newStatus;
            
            // Se mudou para concluída ou andamento e as férias passaram, ou quer manter o histórico, salva
            await db.saveEmployee(emp);
            
            // Notificar alteração para atualizar outras telas (dashboard)
            window.dispatchEvent(new CustomEvent('employeeSaved', { detail: emp }));
            
            // Recarregar os quadros
            await loadVacationBoards();
        };
        
        container.appendChild(card);
    });
}
