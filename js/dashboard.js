/**
 * Sistema de Recibos de Pagamento - Controller do Dashboard
 */
import * as db from './db.js';
import * as utils from './utils.js';
import { EXCEL_RECEIPTS } from './excel_data.js';

let cachedEmployees = [];
let cachedReceipts = [];
let currentNavigateToView = null;

export async function initDashboard(navigateToView) {
    currentNavigateToView = navigateToView;
    
    // Inicializar o seletor com o mês atual caso ainda não esteja preenchido
    const monthInput = document.getElementById('dash-competencia-select');
    if (monthInput && !monthInput.value) {
        monthInput.value = getCurrentMonthValue();
    }
    
    // Configurar ouvintes de eventos da barra de competência e botões
    setupDashboardEventListeners();
    
    // Carregar e renderizar os dados
    await loadAndRenderDashboard();
    
    // Verificar importação pendente do Excel
    checkExcelImport(navigateToView);
}

function getCurrentMonthValue() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
}

function getCompetenciaFromMonthValue(monthValue) {
    if (!monthValue) return '';
    const parts = monthValue.split('-');
    if (parts.length !== 2) return '';
    return `${parts[1]}/${parts[0]}`;
}

function normalizeCompetencia(comp) {
    if (!comp) return '';
    const parts = comp.split('/');
    if (parts.length === 2) {
        const m = parts[0].padStart(2, '0');
        const y = parts[1];
        return `${m}/${y}`;
    }
    return comp;
}

function setupDashboardEventListeners() {
    const monthInput = document.getElementById('dash-competencia-select');
    const btnPrev = document.getElementById('dash-btn-prev-month');
    const btnNext = document.getElementById('dash-btn-next-month');
    const btnHistory = document.getElementById('dash-btn-view-history');
    
    if (monthInput) {
        monthInput.onchange = () => {
            renderDashboardForSelectedMonth();
        };
    }
    
    if (btnPrev && monthInput) {
        btnPrev.onclick = () => {
            const currentVal = monthInput.value || getCurrentMonthValue();
            const [y, m] = currentVal.split('-').map(Number);
            const prevDate = new Date(y, m - 2, 1);
            const prevY = prevDate.getFullYear();
            const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${prevY}-${prevM}`;
            renderDashboardForSelectedMonth();
        };
    }
    
    if (btnNext && monthInput) {
        btnNext.onclick = () => {
            const currentVal = monthInput.value || getCurrentMonthValue();
            const [y, m] = currentVal.split('-').map(Number);
            const nextDate = new Date(y, m, 1);
            const nextY = nextDate.getFullYear();
            const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${nextY}-${nextM}`;
            renderDashboardForSelectedMonth();
        };
    }
    
    if (btnHistory && currentNavigateToView) {
        btnHistory.onclick = () => {
            currentNavigateToView('historico');
        };
    }
}

async function loadAndRenderDashboard() {
    cachedEmployees = await db.getEmployees();
    cachedReceipts = await db.getReceipts();
    
    renderDashboardForSelectedMonth();
    renderAlerts(cachedEmployees, cachedReceipts);
}

function renderDashboardForSelectedMonth() {
    const monthInput = document.getElementById('dash-competencia-select');
    const monthVal = monthInput?.value || getCurrentMonthValue();
    const selectedComp = getCompetenciaFromMonthValue(monthVal);
    
    // Filtrar recibos pertencentes à competência selecionada
    const filteredReceipts = cachedReceipts.filter(r => normalizeCompetencia(r.competencia) === selectedComp);
    
    renderMetrics(cachedEmployees, filteredReceipts, monthVal, selectedComp);
    renderReceiptsTable(filteredReceipts, selectedComp, currentNavigateToView);
}

function renderMetrics(employees, filteredReceipts, monthVal, selectedComp) {
    // 1. Quantidade de recibos de folha emitidos na competência (evitar dupla contagem com adiantamentos)
    const payrollReceipts = filteredReceipts.filter(r => (r.tipo_recibo || r.receipt_type || 'payroll') === 'payroll');
    const countReceipts = payrollReceipts.length;
    const card1Title = document.getElementById('dash-metric-card1-title');
    if (card1Title) {
        card1Title.innerText = `Folha Mensal (${selectedComp})`;
    }
    const card1Value = document.getElementById('dash-metric-employees');
    if (card1Value) {
        card1Value.innerText = countReceipts;
    }
    
    // 2. Total pago no mês (soma dos valores líquidos da folha da competência selecionada)
    const totalPayroll = payrollReceipts.reduce((sum, r) => sum + (Number(r.valor_liquido) || 0), 0);
    const payrollEl = document.getElementById('dash-metric-payroll');
    if (payrollEl) {
        payrollEl.innerText = utils.formatCurrency(totalPayroll);
    }
    
    // 3. Em Férias durante a competência selecionada
    const [yStr, mStr] = monthVal.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const employeesOnVacation = countEmployeesOnVacationForMonth(employees, year, month);
    
    const vacationEl = document.getElementById('dash-metric-vacation');
    if (vacationEl) {
        vacationEl.innerText = employeesOnVacation;
    }
}

function countEmployeesOnVacationForMonth(employees, year, month) {
    // Definir intervalo da competência (primeiro e último dia do mês)
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    
    return employees.filter(emp => {
        if (emp.ferias_data_prevista) {
            const start = new Date(emp.ferias_data_prevista + 'T00:00:00');
            const days = parseInt(emp.ferias_dias) || 30;
            const end = new Date(start.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
            
            const overlaps = (start <= monthEnd && end >= monthStart);
            const validStatus = ['andamento', 'programada', 'concluida', 'pendente'].includes(emp.ferias_status);
            if (overlaps && validStatus) {
                return true;
            }
        }
        
        // Se status estiver 'andamento' e a competência for o mês atual do sistema
        const now = new Date();
        if (emp.ferias_status === 'andamento' && now.getFullYear() === year && (now.getMonth() + 1) === month) {
            return true;
        }
        
        return false;
    }).length;
}

function renderReceiptsTable(receipts, selectedComp, navigateToView) {
    const tbody = document.querySelector('#dash-table-receipts tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (receipts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:var(--text-muted); padding: 30px 0;">
                    Nenhum recibo emitido para a competência <strong>${selectedComp}</strong>.
                </td>
            </tr>
        `;
        return;
    }
    
    // Ordenar do mais recente para o mais antigo por data de emissão ou criação
    const sorted = [...receipts].sort((a, b) => {
        const dateA = a.data_emissao ? new Date(a.data_emissao) : (a.created_at ? new Date(a.created_at) : new Date(0));
        const dateB = b.data_emissao ? new Date(b.data_emissao) : (b.created_at ? new Date(b.created_at) : new Date(0));
        return dateB - dateA;
    });
    
    sorted.forEach(receipt => {
        const isAdvance = (receipt.tipo_recibo === 'advance' || receipt.receipt_type === 'advance');
        const typeBadge = `<span class="badge ${isAdvance ? 'badge-advance' : 'badge-payroll'}" style="margin-right: 6px; font-size: 0.72rem; padding: 2px 6px;">${isAdvance ? 'Adiantamento' : 'Folha'}</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${typeBadge}<strong>${receipt.funcionario_nome}</strong></td>
            <td>${receipt.competencia || selectedComp || 'N/A'}</td>
            <td>${utils.formatDateBR(receipt.data_emissao)}</td>
            <td style="font-weight: bold; color: var(--primary-color);">${utils.formatCurrency(receipt.valor_liquido)}</td>
            <td>
                <button class="btn btn-secondary btn-sm btn-open-rec" data-id="${receipt.id}">Ver Recibo</button>
            </td>
        `;
        
        tr.querySelector('.btn-open-rec').onclick = () => {
            // Disparar evento para abrir recibo específico
            window.dispatchEvent(new CustomEvent('editReceipt', { detail: receipt.id }));
            if (navigateToView) {
                navigateToView('recibo');
            }
        };
        
        tbody.appendChild(tr);
    });
}

function renderAlerts(employees, receipts) {
    const container = document.getElementById('dash-alerts-container');
    if (!container) return;
    container.innerHTML = '';
    
    const alerts = [];
    
    // Verificar férias vencidas ou próximas
    employees.forEach(emp => {
        if (emp.ferias_data_prevista) {
            const daysLeft = utils.getDaysRemaining(emp.ferias_data_prevista);
            
            if (emp.ferias_status === 'pendente' && daysLeft < 0) {
                alerts.push({
                    type: 'danger',
                    text: `Férias vencidas para <strong>${emp.nome}</strong> (Admissão: ${utils.formatDateBR(emp.data_admissao)}).`
                });
            } else if (emp.ferias_status === 'programada' && daysLeft >= 0 && daysLeft <= 15) {
                alerts.push({
                    type: 'danger',
                    text: `Férias programadas de <strong>${emp.nome}</strong> iniciam em <strong>${daysLeft} dias</strong> (${utils.formatDateBR(emp.ferias_data_prevista)}).`
                });
            } else if (emp.ferias_status === 'programada' && daysLeft > 15 && daysLeft <= 30) {
                alerts.push({
                    type: 'warning',
                    text: `Férias programadas de <strong>${emp.nome}</strong> em <strong>${daysLeft} dias</strong>.`
                });
            } else if (emp.ferias_status === 'andamento') {
                alerts.push({
                    type: 'info',
                    text: `<strong>${emp.nome}</strong> está em período de férias atualmente.`
                });
            }
        }
    });
    
    // Se não houver nenhum funcionário cadastrado
    if (employees.length === 0) {
        alerts.push({
            type: 'info',
            text: 'Bem-vindo! Comece cadastrando os primeiros funcionários na aba <strong>Funcionários</strong>.'
        });
    }
    
    // Se não houver alertas, exibir mensagem de sucesso
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="alert-item info" style="border-left-color: var(--success-color); background-color: #f0fdf4; color: #166534;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                Tudo em ordem na folha de pagamento. Sem avisos urgentes!
            </div>
        `;
        return;
    }
    
    // Renderizar alertas limitando a 5 na tela do dashboard
    alerts.slice(0, 5).forEach(alert => {
        const div = document.createElement('div');
        div.className = `alert-item ${alert.type}`;
        div.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>${alert.text}</span>
        `;
        container.appendChild(div);
    });
}

export async function checkExcelImport(navigateToView) {
    try {
        if (!EXCEL_RECEIPTS || EXCEL_RECEIPTS.length === 0) return;
        
        // Verificar se algum já existe no BD
        const currentReceipts = await db.getReceipts();
        const pendingImport = EXCEL_RECEIPTS.filter(imported => {
            return !currentReceipts.some(curr => 
                curr.funcionario_nome.toUpperCase().trim() === imported.funcionario_nome.toUpperCase().trim() &&
                curr.competencia === imported.competencia
            );
        });
        
        const banner = document.getElementById('import-excel-banner');
        if (!banner) return;
        
        if (pendingImport.length === 0) {
            banner.style.display = 'none';
            return;
        }
        
        banner.style.display = 'block';
        banner.className = 'import-banner-container';
        banner.innerHTML = `
            <div class="import-banner-content">
                <div class="import-banner-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <div class="import-banner-text">
                    <h4>Planilha de Salários Detectada!</h4>
                    <p>Encontramos <strong>${pendingImport.length}</strong> recibos (de Fevereiro a Junho de 2026) prontos para importação.</p>
                </div>
            </div>
            <button class="btn btn-primary" id="btn-do-import">Importar Agora</button>
        `;
        
        document.getElementById('btn-do-import').onclick = async () => {
            const btn = document.getElementById('btn-do-import');
            btn.disabled = true;
            btn.innerText = 'Importando...';
            
            // Importar funcionários e recibos
            const employees = await db.getEmployees();
            
            for (const rec of pendingImport) {
                // 1. Verificar se funcionário existe
                let emp = employees.find(e => e.nome.toUpperCase().trim() === rec.funcionario_nome.toUpperCase().trim());
                if (!emp) {
                    // Encontrar o salário base nas linhas de vencimento
                    let salario_base = 1620.0;
                    const baseVenc = rec.vencimentos.find(v => v.descricao.toLowerCase().includes('salário base') || v.descricao.toLowerCase().includes('salario base'));
                    if (baseVenc) {
                        salario_base = baseVenc.valor;
                    }
                    
                    // Criar funcionário
                    emp = await db.saveEmployee({
                        nome: rec.funcionario_nome,
                        cargo: 'Auxiliar de Produção',
                        cpf: '000.000.000-00',
                        salario_base: salario_base,
                        data_admissao: '2026-01-01',
                        ferias_status: 'pendente',
                        observacoes: 'Cadastrado automaticamente via importação de planilha Excel.'
                    });
                    employees.push(emp);
                }
                
                // Vincular ID do funcionário e salvar recibo
                rec.funcionario_id = emp.id;
                await db.saveReceipt(rec);
            }
            
            alert('Importação concluída com sucesso!');
            const banner = document.getElementById('import-excel-banner');
            if (banner) banner.style.display = 'none';
            navigateToView('historico');
        };
        
    } catch (e) {
        console.error("Erro ao verificar importação do Excel:", e);
    }
}
