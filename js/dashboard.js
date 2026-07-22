/**
 * Sistema de Recibos de Pagamento - Controller do Dashboard
 */
import * as db from './db.js';
import * as utils from './utils.js';
import { EXCEL_RECEIPTS } from './excel_data.js';

export async function initDashboard(navigateToView) {
    const employees = await db.getEmployees();
    const receipts = await db.getReceipts();
    const settings = await db.getSettings();
    
    renderMetrics(employees, receipts);
    renderRecentReceipts(receipts, navigateToView);
    renderAlerts(employees, receipts);
    
    // Verificar importação pendente do Excel
    checkExcelImport(navigateToView);
    
    // Configurar botões da tela
    document.getElementById('dash-btn-view-history').onclick = () => {
        navigateToView('historico');
    };
}

function renderMetrics(employees, receipts) {
    // 1. Total de funcionários
    document.getElementById('dash-metric-employees').innerText = employees.length;
    
    // 2. Total da folha do mês (último mês com recibos)
    let totalPayroll = 0;
    if (receipts.length > 0) {
        // Encontrar a competência mais recente lançada
        const competencies = receipts.map(r => r.competencia).filter(Boolean);
        if (competencies.length > 0) {
            // Classificar competências no formato MM/AAAA (converter para AAAA-MM para ordenação lógica)
            competencies.sort((a, b) => {
                const partsA = a.split('/');
                const partsB = b.split('/');
                return `${partsB[1]}-${partsB[0]}`.localeCompare(`${partsA[1]}-${partsA[0]}`);
            });
            
            const latestCompetency = competencies[0];
            const latestReceipts = receipts.filter(r => r.competencia === latestCompetency);
            totalPayroll = latestReceipts.reduce((sum, r) => sum + r.valor_liquido, 0);
            
            // Atualizar legenda da métrica de folha
            const label = document.querySelector('.metric-info h3');
            if (label) {
                label.innerText = `Folha Mensal (${latestCompetency})`;
            }
        }
    } else {
        const label = document.querySelector('.metric-info h3');
        if (label) {
            label.innerText = 'Folha Mensal';
        }
    }
    document.getElementById('dash-metric-payroll').innerText = utils.formatCurrency(totalPayroll);
    
    // 3. Em Férias (status = 'andamento')
    const employeesOnVacation = employees.filter(e => e.ferias_status === 'andamento').length;
    document.getElementById('dash-metric-vacation').innerText = employeesOnVacation;
}

function renderRecentReceipts(receipts, navigateToView) {
    const tbody = document.querySelector('#dash-table-receipts tbody');
    tbody.innerHTML = '';
    
    // Pegar no máximo os 5 mais recentes
    const recent = receipts.slice(0, 5);
    
    if (recent.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:var(--text-muted); padding: 30px 0;">
                    Nenhum recibo emitido até o momento.
                </td>
            </tr>
        `;
        return;
    }
    
    recent.forEach(receipt => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${receipt.funcionario_nome}</strong></td>
            <td>${receipt.competencia || 'N/A'}</td>
            <td>${utils.formatDateBR(receipt.data_emissao)}</td>
            <td style="font-weight: bold; color: var(--primary-color);">${utils.formatCurrency(receipt.valor_liquido)}</td>
            <td>
                <button class="btn btn-secondary btn-sm btn-open-rec" data-id="${receipt.id}">Ver Recibo</button>
            </td>
        `;
        
        tr.querySelector('.btn-open-rec').onclick = () => {
            // Disparar evento para abrir recibo específico
            window.dispatchEvent(new CustomEvent('editReceipt', { detail: receipt.id }));
            navigateToView('recibo');
        };
        
        tbody.appendChild(tr);
    });
}

function renderAlerts(employees, receipts) {
    const container = document.getElementById('dash-alerts-container');
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
                        cargo: 'Auxiliar de Produção', // cargo padrão
                        cpf: '000.000.000-00',
                        salario_base: salario_base,
                        data_admissao: '2026-01-01',
                        ferias_status: 'pendente',
                        observacoes: 'Cadastrado automaticamente via importação de planilha Excel.'
                    });
                    // Atualizar lista local de funcionários para evitar duplicar na mesma rodada
                    employees.push(emp);
                }
                
                // Vincular ID do funcionário e salvar recibo
                rec.funcionario_id = emp.id;
                await db.saveReceipt(rec);
            }
            
            alert('Importação concluída com sucesso!');
            // Esconder o banner
            const banner = document.getElementById('import-excel-banner');
            if (banner) banner.style.display = 'none';
            // Ir para o Histórico para que o usuário veja os recibos importados imediatamente
            navigateToView('historico');
        };
        
    } catch (e) {
        console.error("Erro ao verificar importação do Excel:", e);
    }
}
