/**
 * Sistema de Recibos de Pagamento - Controller do Editor de Recibo
 */
import * as db from './db.js';
import * as utils from './utils.js';

let currentReceipt = createEmptyReceipt();
let settings = {};

export async function initReceipt(receiptIdToEdit = null, duplicateFromId = null) {
    settings = await db.getSettings();
    
    const copiaSalva = sessionStorage.getItem('reciboDuplicado');
    if (copiaSalva) {
        currentReceipt = JSON.parse(copiaSalva);
        sessionStorage.removeItem('reciboDuplicado');
        
        currentReceipt.tipo_recibo = currentReceipt.tipo_recibo || currentReceipt.receipt_type || 'payroll';
        currentReceipt.receipt_type = currentReceipt.tipo_recibo;
        
        renderReceiptEditor();
        setupEventListeners();
        recalculateTotals();
        return;
    }
    
    if (receiptIdToEdit === null && duplicateFromId === null && window.skipReceiptInit) {
        window.skipReceiptInit = false;
        return;
    }
    
    if (receiptIdToEdit) {
        const rec = await db.getReceiptById(receiptIdToEdit);
        if (rec) {
            currentReceipt = JSON.parse(JSON.stringify(rec)); // Deep copy
            currentReceipt.tipo_recibo = currentReceipt.tipo_recibo || currentReceipt.receipt_type || 'payroll';
            currentReceipt.receipt_type = currentReceipt.tipo_recibo;
        }
    } else if (duplicateFromId) {
        const source = await db.getReceiptById(duplicateFromId);
        if (source) {
            currentReceipt = performDuplication(source);
        }
    } else {
        currentReceipt = createEmptyReceipt();
    }
    
    renderReceiptEditor();
    setupEventListeners();
    recalculateTotals();
}

function createEmptyReceipt() {
    return {
        id: '',
        tipo_recibo: 'payroll', // 'payroll' | 'advance'
        receipt_type: 'payroll',
        funcionario_id: '',
        funcionario_nome: '',
        competencia: '',
        periodo: '',
        data_emissao: '',
        vencimentos: [],
        descontos: [],
        adiantamentos: [],
        valor_liquido: 0,
        observacoes: ''
    };
}

function performDuplication(source) {
    const tipo = source.tipo_recibo || source.receipt_type || 'payroll';
    const vencs = JSON.parse(JSON.stringify(source.vencimentos || []));
    const descs = JSON.parse(JSON.stringify(source.descontos || []));
    const adiants = JSON.parse(JSON.stringify(source.adiantamentos || []));
    
    return {
        id: '', // Novo recibo
        tipo_recibo: tipo,
        receipt_type: tipo,
        funcionario_id: source.funcionario_id,
        funcionario_nome: source.funcionario_nome,
        competencia: '', // Limpar para atualização
        periodo: '', // Limpar para atualização
        data_emissao: '', // Limpar para atualização
        vencimentos: vencs,
        descontos: descs,
        adiantamentos: adiants,
        valor_liquido: 0,
        observacoes: source.observacoes || ''
    };
}

function renderReceiptEditor() {
    const isAdvance = (currentReceipt.tipo_recibo === 'advance' || currentReceipt.receipt_type === 'advance');
    
    // Sincronizar seletor de tipo de recibo
    const typeSelect = document.getElementById('recibo-type-select');
    if (typeSelect) {
        typeSelect.value = isAdvance ? 'advance' : 'payroll';
    }
    
    // Atualizar títulos dos recibos
    const titleText = isAdvance ? 'RECIBO DE ADIANTAMENTO' : 'RECIBO';
    const title1 = document.getElementById('receipt-title-1');
    const title2 = document.getElementById('receipt-title-2');
    if (title1) title1.innerText = titleText;
    if (title2) title2.innerText = titleText;
    
    // Alternar visibilidade das seções (Folha vs Adiantamento)
    const payroll1 = document.getElementById('payroll-sections-1');
    const payroll2 = document.getElementById('payroll-sections-2');
    const advance1 = document.getElementById('advance-sections-1');
    const advance2 = document.getElementById('advance-sections-2');
    
    if (payroll1) payroll1.style.display = isAdvance ? 'none' : 'block';
    if (payroll2) payroll2.style.display = isAdvance ? 'none' : 'block';
    if (advance1) advance1.style.display = isAdvance ? 'block' : 'none';
    if (advance2) advance2.style.display = isAdvance ? 'block' : 'none';
    
    // Sincronizar dados da empresa nos recibos
    document.querySelectorAll('[data-field="empresa_nome"]').forEach(el => {
        el.innerText = settings.empresa_nome || 'ESTAMPARIA JL LTDA - ME';
    });
    document.querySelectorAll('[data-field="empresa_cnpj"]').forEach(el => {
        el.innerText = settings.empresa_cnpj || '25.140.946/0001-84';
    });
    
    // Preencher Cidade automaticamente
    const cityText = settings.empresa_cidade || 'Sarandi-PR';
    const city1 = document.getElementById('city-text-1');
    const city2 = document.getElementById('city-text-2');
    if (city1) city1.innerText = cityText;
    if (city2) city2.innerText = cityText;
    
    // Preencher campos do funcionário e período
    document.querySelectorAll('[data-field="funcionario_nome"]').forEach(el => {
        el.innerText = currentReceipt.funcionario_nome || '';
    });
    
    document.querySelectorAll('[data-field="funcionario_nome_upper"]').forEach(el => {
        el.innerText = (currentReceipt.funcionario_nome || '').toUpperCase();
    });
    
    document.querySelectorAll('[data-field="periodo"]').forEach(el => {
        el.innerText = currentReceipt.periodo || '';
    });
    
    // Data de emissão (exibida formatada)
    const dataBR = utils.formatDateBR(currentReceipt.data_emissao);
    document.querySelectorAll('[data-field="data_emissao_formatada"]').forEach(el => {
        el.innerText = dataBR;
    });
    
    // Renderizar linhas dependendo do tipo
    if (isAdvance) {
        renderLines('adiantamentos');
    } else {
        renderLines('vencimentos');
        renderLines('descontos');
    }
    
    // Mostrar/Ocultar botões de ferramentas
    const dupBtn = document.getElementById('recibo-btn-duplicate');
    if (dupBtn) {
        dupBtn.style.display = currentReceipt.id ? 'inline-flex' : 'none';
    }
}

function renderLines(type) {
    const list = currentReceipt[type] || [];
    
    // Renderizar na Via 1 e Via 2
    for (let via = 1; via <= 2; via++) {
        const container = document.getElementById(`${type}-container-${via}`);
        if (!container) continue;
        container.innerHTML = '';
        
        list.forEach((item, index) => {
            // Garantir que a propriedade recorrente existe (padrão true)
            if (item.recorrente === undefined) {
                item.recorrente = true;
            }
            
            const row = document.createElement('div');
            row.className = 'receipt-row';
            row.innerHTML = `
                <span class="row-description" contenteditable="true" data-type="${type}" data-index="${index}" data-prop="descricao">${item.descricao}</span>
                <span class="row-dots"></span>
                <div class="row-value-wrapper">
                    <span>R$</span>
                    <span class="row-val-input" contenteditable="true" data-type="${type}" data-index="${index}" data-prop="valor">${utils.formatNumber(item.valor)}</span>
                    <span class="recurrent-indicator no-print ${item.recorrente ? 'recorrente' : 'variavel'}" data-type="${type}" data-index="${index}" title="${item.recorrente ? 'Item Recorrente' : 'Item Variável'}">
                        ${item.recorrente ? '●' : '○'}
                    </span>
                </div>
                <button class="row-delete-btn no-print" data-type="${type}" data-index="${index}">&times;</button>
            `;
            
            // Evento para deletar linha
            row.querySelector('.row-delete-btn').onclick = () => {
                deleteLine(type, index);
            };
            
            // Evento para alterar recorrência
            row.querySelector('.recurrent-indicator').onclick = () => {
                item.recorrente = !item.recorrente;
                renderLines(type);
            };
            
            container.appendChild(row);
        });
    }
}

function addLine(type) {
    let defaultDesc = 'Novo Item';
    if (type === 'vencimentos') defaultDesc = 'Novo Vencimento';
    else if (type === 'descontos') defaultDesc = 'Novo Desconto';
    else if (type === 'adiantamentos') defaultDesc = 'Adiantamento salarial';
    
    if (!currentReceipt[type]) {
        currentReceipt[type] = [];
    }
    
    currentReceipt[type].push({
        descricao: defaultDesc,
        valor: 0,
        recorrente: true
    });
    renderLines(type);
    recalculateTotals();
}

function deleteLine(type, index) {
    if (currentReceipt[type]) {
        currentReceipt[type].splice(index, 1);
    }
    renderLines(type);
    recalculateTotals();
}

function recalculateTotals() {
    const isAdvance = (currentReceipt.tipo_recibo === 'advance' || currentReceipt.receipt_type === 'advance');
    let net = 0;
    
    if (isAdvance) {
        net = (currentReceipt.adiantamentos || []).reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
    } else {
        const sumVencimentos = (currentReceipt.vencimentos || []).reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
        const sumDescontos = (currentReceipt.descontos || []).reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
        net = sumVencimentos - sumDescontos;
    }
    
    currentReceipt.valor_liquido = net;
    const formattedNet = utils.formatCurrency(net);
    
    // Atualizar displays de total nas duas vias
    const tot1 = document.getElementById('receipt-total-val-1');
    const tot2 = document.getElementById('receipt-total-val-2');
    if (tot1) tot1.innerText = formattedNet;
    if (tot2) tot2.innerText = formattedNet;
    
    // Atualizar texto e valor declarado nas duas vias
    const decl1 = document.getElementById('receipt-declaration-text-1');
    const decl2 = document.getElementById('receipt-declaration-text-2');
    
    if (isAdvance) {
        const declHtml = `Declaro que recebi do empregador acima qualificado o valor líquido de <span class="declaration-val-inline" id="receipt-declaration-val-1">${formattedNet}</span> referente a adiantamento salarial.`;
        const declHtml2 = `Declaro que recebi do empregador acima qualificado o valor líquido de <span class="declaration-val-inline" id="receipt-declaration-val-2">${formattedNet}</span> referente a adiantamento salarial.`;
        if (decl1) decl1.innerHTML = declHtml;
        if (decl2) decl2.innerHTML = declHtml2;
    } else {
        const declHtml = `Declaro que recebi do empregado acima qualificado, o valor líquido de <span class="declaration-val-inline" id="receipt-declaration-val-1">${formattedNet}</span>`;
        const declHtml2 = `Declaro que recebi do empregado acima qualificado, o valor líquido de <span class="declaration-val-inline" id="receipt-declaration-val-2">${formattedNet}</span>`;
        if (decl1) decl1.innerHTML = declHtml;
        if (decl2) decl2.innerHTML = declHtml2;
    }
}

function setupEventListeners() {
    // Seletor de Tipo de Recibo
    const typeSelect = document.getElementById('recibo-type-select');
    if (typeSelect) {
        typeSelect.onchange = (e) => {
            const newType = e.target.value;
            currentReceipt.tipo_recibo = newType;
            currentReceipt.receipt_type = newType;
            
            if (newType === 'advance') {
                if (!currentReceipt.adiantamentos || currentReceipt.adiantamentos.length === 0) {
                    currentReceipt.adiantamentos = [{
                        descricao: 'Adiantamento salarial',
                        valor: 0,
                        recorrente: true
                    }];
                }
            } else {
                if ((!currentReceipt.vencimentos || currentReceipt.vencimentos.length === 0) && currentReceipt.funcionario_id) {
                    db.getEmployeeById(currentReceipt.funcionario_id).then(emp => {
                        if (emp) {
                            selectEmployee(emp);
                        }
                    });
                }
            }
            
            renderReceiptEditor();
            recalculateTotals();
        };
    }
    
    // Adicionar vencimento
    const btnVenc1 = document.getElementById('btn-add-vencimento-1');
    const btnVenc2 = document.getElementById('btn-add-vencimento-2');
    if (btnVenc1) btnVenc1.onclick = () => addLine('vencimentos');
    if (btnVenc2) btnVenc2.onclick = () => addLine('vencimentos');
    
    // Adicionar desconto
    const btnDesc1 = document.getElementById('btn-add-desconto-1');
    const btnDesc2 = document.getElementById('btn-add-desconto-2');
    if (btnDesc1) btnDesc1.onclick = () => addLine('descontos');
    if (btnDesc2) btnDesc2.onclick = () => addLine('descontos');
    
    // Adicionar adiantamento
    const btnAdv1 = document.getElementById('btn-add-adiantamento-1');
    const btnAdv2 = document.getElementById('btn-add-adiantamento-2');
    if (btnAdv1) btnAdv1.onclick = () => addLine('adiantamentos');
    if (btnAdv2) btnAdv2.onclick = () => addLine('adiantamentos');
    
    // Autocomplete do Funcionário
    setupEmployeeAutocomplete();
    
    // Ações do Topo
    const btnClear = document.getElementById('recibo-btn-clear');
    const btnSave = document.getElementById('recibo-btn-save');
    const btnPrint = document.getElementById('btn-print-receipt') || document.getElementById('recibo-btn-print');
    const btnPdf = document.getElementById('btn-pdf-receipt') || document.getElementById('recibo-btn-pdf');
    
    if (btnClear) btnClear.onclick = handleClear;
    if (btnSave) btnSave.onclick = handleSave;
    if (btnPrint) btnPrint.onclick = printReceiptIsolated;
    if (btnPdf) btnPdf.onclick = printReceiptIsolated;
    
    const btnDup = document.getElementById('recibo-btn-duplicate');
    if (btnDup) {
        btnDup.onclick = () => {
            if (currentReceipt.id) {
                window.skipReceiptInit = true;
                duplicateReceiptWorkflow(currentReceipt.id);
            }
        };
    }
    
    // Sincronização em tempo real das edições (via contenteditable)
    const workspace = document.getElementById('receipts-workspace-container');
    if (!workspace) return;
    
    workspace.oninput = (e) => {
        const target = e.target;
        
        // 1. Caso seja campo do cabeçalho
        if (target.dataset.field) {
            const field = target.dataset.field;
            let value = target.innerText;
            
            // Sincronizar com o objeto interno
            if (field === 'funcionario_nome') {
                currentReceipt.funcionario_nome = value;
                document.querySelectorAll('[data-field="funcionario_nome_upper"]').forEach(el => {
                    el.innerText = value.toUpperCase();
                });
            } else if (field === 'periodo') {
                currentReceipt.periodo = value;
            } else if (field === 'data_emissao_formatada') {
                currentReceipt.data_emissao = utils.brDateToIso(value);
            }
            
            // Replicar o valor para a outra via imediatamente
            document.querySelectorAll(`[data-field="${field}"]`).forEach(el => {
                if (el !== target) {
                    el.innerText = value;
                }
            });
        }
        
        // 2. Caso seja campo da tabela de vencimentos/descontos/adiantamentos
        if (target.dataset.prop) {
            const type = target.dataset.type; // vencimentos / descontos / adiantamentos
            const index = parseInt(target.dataset.index);
            const prop = target.dataset.prop; // descricao / valor
            
            let value = target.innerText;
            
            if (!currentReceipt[type]) {
                currentReceipt[type] = [];
            }
            if (!currentReceipt[type][index]) {
                currentReceipt[type][index] = { descricao: '', valor: 0, recorrente: true };
            }
            
            if (prop === 'valor') {
                currentReceipt[type][index].valor = utils.parseCurrency(value);
                recalculateTotals();
            } else {
                currentReceipt[type][index].descricao = value;
            }
            
            // Sincronizar na outra via
            const currentVia = target.closest('.receipt')?.dataset.via;
            const targetVia = currentVia === '1' ? '2' : '1';
            
            const counterpart = document.querySelector(
                `.via-${targetVia} [data-type="${type}"][data-index="${index}"][data-prop="${prop}"]`
            );
            
            if (counterpart && counterpart.innerText !== value) {
                counterpart.innerText = value;
            }
        }
    };
    
    // Formatar moeda ao sair (blur) do campo de valor
    workspace.addEventListener('focusout', (e) => {
        const target = e.target;
        if (target.dataset.prop === 'valor') {
            const type = target.dataset.type;
            const index = parseInt(target.dataset.index);
            if (currentReceipt[type] && currentReceipt[type][index]) {
                const formatted = utils.formatNumber(currentReceipt[type][index].valor);
                document.querySelectorAll(`[data-type="${type}"][data-index="${index}"][data-prop="valor"]`).forEach(el => {
                    el.innerText = formatted;
                });
            }
        }
        
        if (target.dataset.field === 'data_emissao_formatada') {
            let raw = target.innerText.replace(/\D/g, '');
            if (raw.length === 8) {
                const formatted = raw.replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3');
                currentReceipt.data_emissao = utils.brDateToIso(formatted);
                document.querySelectorAll('[data-field="data_emissao_formatada"]').forEach(el => {
                    el.innerText = formatted;
                });
            }
        }
    });
}

function setupEmployeeAutocomplete() {
    const searchInput = document.getElementById('recibo-employee-search');
    const dropdown = document.getElementById('recibo-employee-dropdown');
    if (!searchInput || !dropdown) return;
    
    searchInput.onfocus = async () => {
        const employees = await db.getEmployees();
        renderEmployeeDropdown(employees);
    };
    
    searchInput.oninput = async (e) => {
        const query = e.target.value.toLowerCase();
        const employees = await db.getEmployees();
        const filtered = employees.filter(emp => emp.nome.toLowerCase().includes(query));
        renderEmployeeDropdown(filtered);
    };
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function renderEmployeeDropdown(list) {
    const dropdown = document.getElementById('recibo-employee-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';
    
    if (list.length === 0) {
        dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem;">Nenhum funcionário encontrado.</div>';
        dropdown.classList.add('active');
        return;
    }
    
    list.forEach(emp => {
        const item = document.createElement('div');
        item.className = 'employee-dropdown-item';
        item.innerHTML = `
            <span>${emp.nome}</span>
            <span class="cargo">${emp.cargo}</span>
        `;
        
        item.onclick = () => {
            selectEmployee(emp);
            dropdown.classList.remove('active');
            const searchInput = document.getElementById('recibo-employee-search');
            if (searchInput) searchInput.value = '';
        };
        
        dropdown.appendChild(item);
    });
    
    dropdown.classList.add('active');
}

function selectEmployee(emp) {
    currentReceipt.funcionario_id = emp.id;
    currentReceipt.funcionario_nome = emp.nome;
    
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    
    currentReceipt.competencia = `${mm}/${yyyy}`;
    currentReceipt.periodo = `01/${mm}/${yyyy} à ${lastDay}/${mm}/${yyyy}`;
    
    const isAdvance = (currentReceipt.tipo_recibo === 'advance' || currentReceipt.receipt_type === 'advance');
    
    if (isAdvance) {
        // Data padrão de pagamento para adiantamento (ex: dia 15 ou hoje)
        currentReceipt.data_emissao = today.toISOString().split('T')[0];
        currentReceipt.adiantamentos = [
            {
                descricao: 'Adiantamento salarial',
                valor: 0,
                recorrente: true
            }
        ];
        currentReceipt.vencimentos = [];
        currentReceipt.descontos = [];
    } else {
        currentReceipt.data_emissao = today.toISOString().split('T')[0];
        currentReceipt.vencimentos = [
            {
                descricao: `Salário Base 01/${mm}/${yyyy} à ${lastDay}/${mm}/${yyyy}`,
                valor: emp.salario_base,
                recorrente: true
            }
        ];
        currentReceipt.descontos = [];
        currentReceipt.adiantamentos = [];
    }
    
    renderReceiptEditor();
    recalculateTotals();
}

function handleClear() {
    if (confirm('Deseja limpar todos os campos do recibo atual?')) {
        const keepType = currentReceipt.tipo_recibo || 'payroll';
        currentReceipt = createEmptyReceipt();
        currentReceipt.tipo_recibo = keepType;
        currentReceipt.receipt_type = keepType;
        
        if (keepType === 'advance') {
            currentReceipt.adiantamentos = [{
                descricao: 'Adiantamento salarial',
                valor: 0,
                recorrente: true
            }];
        }
        
        renderReceiptEditor();
        recalculateTotals();
    }
}

async function handleSave() {
    if (!currentReceipt.funcionario_nome) {
        alert('Por favor, selecione ou digite o nome de um funcionário para o recibo.');
        return;
    }
    
    // Se o recibo foi carregado como modelo (Usar como modelo) e ainda não selecionou a competência
    if (currentReceipt.origemReciboId && currentReceipt.modo === 'novo') {
        openNewCompetencyModalForSave();
        return;
    }
    
    // Tentar extrair competência se estiver vazia
    if (!currentReceipt.competencia) {
        const pMatch = currentReceipt.periodo?.match(/(\d{2})\/(\d{4})/);
        if (pMatch) {
            currentReceipt.competencia = `${pMatch[1]}/${pMatch[2]}`;
        } else if (currentReceipt.data_emissao) {
            const parts = currentReceipt.data_emissao.split('-'); // yyyy-mm-dd
            currentReceipt.competencia = `${parts[1]}/${parts[0]}`;
        } else {
            const today = new Date();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            currentReceipt.competencia = `${mm}/${today.getFullYear()}`;
        }
    }
    
    currentReceipt.tipo_recibo = currentReceipt.tipo_recibo || currentReceipt.receipt_type || 'payroll';
    currentReceipt.receipt_type = currentReceipt.tipo_recibo;
    
    // Salvar no BD
    const saved = await db.saveReceipt(currentReceipt);
    currentReceipt.id = saved.id;
    
    alert('Recibo de pagamento salvo com sucesso!');
    
    // Habilitar botão de duplicação
    const dupBtn = document.getElementById('recibo-btn-duplicate');
    if (dupBtn) dupBtn.style.display = 'inline-flex';
}

function openNewCompetencyModalForSave() {
    const modal = document.getElementById('modal-new-competency');
    const closeBtn = document.getElementById('modal-new-competency-close');
    const cancelBtn = document.getElementById('modal-new-competency-cancel');
    const submitBtn = document.getElementById('modal-new-competency-submit');
    
    const monthSelect = document.getElementById('dup-month');
    const yearSelect = document.getElementById('dup-year');
    
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.innerText = String(y);
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    monthSelect.value = currentMonth;
    
    modal.classList.add('active');
    
    const closeAll = () => {
        modal.classList.remove('active');
        closeBtn.onclick = null;
        cancelBtn.onclick = null;
        submitBtn.onclick = null;
    };
    
    closeBtn.onclick = closeAll;
    cancelBtn.onclick = closeAll;
    
    submitBtn.onclick = async () => {
        const newCompetency = `${monthSelect.value}/${yearSelect.value}`;
        closeAll();
        
        const parts = newCompetency.split('/');
        const month = parseInt(parts[0]);
        const year = parseInt(parts[1]);
        const lastDay = new Date(year, month, 0).getDate();
        
        const newPeriod = `01/${parts[0]}/${parts[1]} à ${String(lastDay).padStart(2, '0')}/${parts[0]}/${parts[1]}`;
        const newEmissionDate = `${parts[1]}-${parts[0]}-${String(lastDay).padStart(2, '0')}`;
        
        currentReceipt.competencia = newCompetency;
        currentReceipt.periodo = newPeriod;
        currentReceipt.data_emissao = newEmissionDate;
        
        if (currentReceipt.vencimentos) {
            currentReceipt.vencimentos.forEach(v => {
                if (v.descricao.toLowerCase().includes('salário base') || v.descricao.toLowerCase().includes('salario base')) {
                    v.descricao = `Salário Base ${newPeriod}`;
                }
            });
        }
        
        delete currentReceipt.modo;
        delete currentReceipt.origemReciboId;
        
        currentReceipt.tipo_recibo = currentReceipt.tipo_recibo || currentReceipt.receipt_type || 'payroll';
        currentReceipt.receipt_type = currentReceipt.tipo_recibo;
        
        const saved = await db.saveReceipt(currentReceipt);
        currentReceipt.id = saved.id;
        
        alert('Recibo de pagamento salvo com sucesso!');
        renderReceiptEditor();
        recalculateTotals();
        
        const dupBtn = document.getElementById('recibo-btn-duplicate');
        if (dupBtn) dupBtn.style.display = 'inline-flex';
    };
}

function clearPrintFitting() {
    const wrapper = document.getElementById('receipt-print-area') || document.getElementById('print-area');
    if (!wrapper) return;
    wrapper.classList.remove('measuring-print');
    const via1 = wrapper.querySelector('.via-1');
    const via2 = wrapper.querySelector('.via-2');
    if (via1 && via2) {
        via1.classList.remove('compact', 'very-compact', 'extra-compact');
        via2.classList.remove('compact', 'very-compact', 'extra-compact');
        via1.style.transform = '';
        via1.style.width = '';
        via1.style.height = '';
        via2.style.transform = '';
        via2.style.width = '';
        via2.style.height = '';
    }
}

async function testReceiptFitting() {
    const wrapper = document.getElementById('receipt-print-area') || document.getElementById('print-area');
    const via1 = wrapper ? wrapper.querySelector('.via-1') : null;
    const via2 = wrapper ? wrapper.querySelector('.via-2') : null;
    
    if (!via1 || !via2) return true;
    
    clearPrintFitting();
    
    const measuringContainer = document.createElement('div');
    measuringContainer.id = 'receipt-print-area';
    measuringContainer.className = 'measuring-print';
    
    const clone = via1.cloneNode(true);
    clone.querySelectorAll('.no-print, button, .add-row, .recurrent-indicator, .recurrent-indicator-variable').forEach(el => el.remove());
    
    const isAdv = (currentReceipt.tipo_recibo === 'advance' || currentReceipt.receipt_type === 'advance');
    const totalLines = isAdv 
        ? (currentReceipt.adiantamentos || []).length 
        : ((currentReceipt.vencimentos || []).length + (currentReceipt.descontos || []).length);
    
    let appliedClass = '';
    if (totalLines > 10) {
        appliedClass = 'very-compact';
    } else if (totalLines > 6) {
        appliedClass = 'compact';
    }
    
    clone.classList.remove('compact', 'very-compact');
    if (appliedClass) {
        clone.classList.add(appliedClass);
    }
    
    measuringContainer.appendChild(clone);
    document.body.appendChild(measuringContainer);
    
    let receiptHeight = clone.getBoundingClientRect().height;
    const availableHeight = 190 * 3.7795275591;
    
    if (receiptHeight > availableHeight && appliedClass !== 'very-compact') {
        clone.classList.remove('compact');
        clone.classList.add('very-compact');
        appliedClass = 'very-compact';
    }
    
    measuringContainer.remove();
    
    if (appliedClass) {
        via1.classList.add(appliedClass);
        via2.classList.add(appliedClass);
    }
    
    return true;
}

function showPrintTip() {
    const existing = document.getElementById('print-tip-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'print-tip-toast';
    toast.className = 'no-print';
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #1e293b;
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        z-index: 99999;
        font-size: 0.88rem;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1px solid rgba(255,255,255,0.15);
    `;
    toast.innerHTML = `
        <span style="font-size: 1.2rem; flex-shrink: 0;">💡</span>
        <span>Na tela de impressão, desmarque <strong>"Cabeçalhos e rodapés"</strong> para remover a URL e a numeração da página.</span>
        <button style="background: rgba(255,255,255,0.15); border: none; color: white; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.75rem; font-weight: 600; margin-left: 8px;" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 10000);
}

export function printReceiptIsolated(e) {
    if (e && e.preventDefault) e.preventDefault();
    console.log('[PRINT] printReceiptIsolated acionado');

    const receiptArea = document.getElementById('receipt-print-area') || document.getElementById('print-area');

    if (!receiptArea) {
        console.error('[PRINT] receipt-print-area não encontrado');
        return;
    }

    // Exibe dica sutil na interface do sistema
    showPrintTip();

    // Cria clone limpo removendo botões e controles interativos
    const clone = receiptArea.cloneNode(true);
    clone.querySelectorAll('.no-print, button, .add-row-btn, .row-delete-btn, .recurrent-indicator, .recurrent-indicator-variable').forEach(el => el.remove());

    const cleanHtml = clone.innerHTML;

    // Remove qualquer iframe de impressão anterior
    const oldIframe = document.getElementById('receipt-print-iframe');
    if (oldIframe) oldIframe.remove();

    // Cria iframe off-screen com dimensões renderizáveis para garantir foco de impressão
    const iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '1024px';
    iframe.style.height = '768px';
    iframe.style.border = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibo</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .receipt-print-pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 5mm;
      width: 100%;
      align-items: start;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .receipt {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      padding: 2mm 3mm;
      box-sizing: border-box;
      background: #ffffff;
      font-size: 10.5px;
      line-height: 1.2;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .receipt.via-2 {
      border-left: 1px dashed #666;
      padding-left: 4mm;
    }

    .receipt-title {
      font-size: 16px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 2mm;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000000;
    }

    .receipt-header-info {
      margin-bottom: 2.5mm;
      font-size: 10px;
      line-height: 1.25;
    }

    .info-line {
      display: flex;
      gap: 4px;
      margin-bottom: 0.6mm;
    }

    .info-label {
      font-weight: 700;
      color: #000000;
    }

    .info-val {
      color: #000000;
    }

    .receipt-body {
      border: 1px solid #000000;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      margin-bottom: 2.5mm;
    }

    .receipt-body-title {
      background-color: #e5e7eb;
      border-bottom: 1px solid #000000;
      font-weight: 700;
      text-align: center;
      padding: 1mm 2mm;
      font-size: 10px;
    }

    .receipt-section-header {
      border-bottom: 1px solid #000000;
      font-weight: 700;
      padding: 0.8mm 2mm;
      font-size: 9.5px;
      background-color: #f9fafb;
    }

    .receipt-rows-container {
      padding: 1mm 2mm;
    }

    .receipt-row {
      display: grid;
      grid-template-columns: auto minmax(10px, 1fr) auto;
      align-items: center;
      column-gap: 4px;
      width: 100%;
      white-space: nowrap;
      padding: 0.5mm 0;
      font-size: 10px;
      line-height: 1.15;
    }

    .row-description {
      min-width: 0;
      white-space: nowrap;
    }

    .row-dots {
      display: block;
      min-width: 8px;
      border-bottom: 1px dotted #000000;
      height: 0;
      margin-bottom: 2px;
    }

    .row-value-wrapper {
      display: flex;
      align-items: center;
      gap: 2px;
      white-space: nowrap;
      font-weight: 700;
    }

    .receipt-total-row {
      display: flex;
      align-items: center;
      border-top: 1px solid #000000;
      background-color: #f3f4f6;
      padding: 1mm 2mm;
      font-weight: 700;
      font-size: 10.5px;
      margin-top: auto;
    }

    .total-label {
      font-weight: 700;
    }

    .total-dots {
      flex: 1;
      margin: 0 4px;
      border-bottom: 1px dotted #000000;
      height: 0;
      margin-bottom: 2px;
    }

    .total-val {
      font-weight: 700;
    }

    .receipt-footer {
      font-size: 9.5px;
      line-height: 1.25;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .declaration-text {
      margin-bottom: 2mm;
      font-size: 9.5px;
      text-align: justify;
    }

    .declaration-val-inline {
      font-weight: 700;
    }

    .footer-bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: end;
      gap: 6mm;
      margin-top: 2.5mm;
    }

    .city-date-wrapper {
      text-align: left;
      white-space: nowrap;
      font-size: 9.5px;
    }

    .signature-wrapper {
      text-align: center;
    }

    .signature-line {
      border-top: 1px solid #000000;
      margin-bottom: 1.5mm;
    }

    .signature-name {
      font-size: 9px;
      font-weight: 700;
    }

    .no-print, button, .add-row-btn, .row-delete-btn, .recurrent-indicator, .recurrent-indicator-variable {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="receipt-print-pair">
    ${cleanHtml}
  </div>
</body>
</html>`);
    doc.close();

    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (err) {
            console.error('[PRINT] Erro ao disparar impressão no iframe:', err);
        }
        setTimeout(() => {
            if (iframe.parentElement) iframe.remove();
        }, 3000);
    }, 300);
}

// Aliases para garantir compatibilidade
export function printReceipt(e) {
    printReceiptIsolated(e);
}

export function openReceiptPrint(e) {
    printReceiptIsolated(e);
}

export function handlePrint(e) {
    printReceiptIsolated(e);
}

export function handlePDF(e) {
    printReceiptIsolated(e);
}

// Registro global após o carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    const printBtn = document.getElementById('btn-print-receipt') || document.getElementById('recibo-btn-print');
    const pdfBtn = document.getElementById('btn-pdf-receipt') || document.getElementById('recibo-btn-pdf');
    
    console.log('[PRINT] botão imprimir:', !!printBtn);
    console.log('[PRINT] botão pdf:', !!pdfBtn);
    
    if (printBtn) {
        printBtn.onclick = printReceiptIsolated;
    }
    if (pdfBtn) {
        pdfBtn.onclick = printReceiptIsolated;
    }
});

// Ouvinte de evento customizado para abrir recibo para edição
window.addEventListener('editReceipt', async (e) => {
    const id = e.detail;
    window.skipReceiptInit = true;
    await initReceipt(id);
});

// Ouvinte de evento customizado para duplicar recibo
window.addEventListener('duplicateReceipt', async (e) => {
    const id = e.detail;
    window.skipReceiptInit = true;
    await duplicateReceiptWorkflow(id);
});

/* ==========================================================================
   FUNÇÕES DE DUPLICAÇÃO E CÓPIA DE RECIBO ANTERIOR (MODAIS)
   ========================================================================== */

export async function duplicateReceiptWorkflow(sourceReceiptId) {
    const source = await db.getReceiptById(sourceReceiptId);
    if (!source) return;
    
    const modal = document.getElementById('modal-new-competency');
    const closeBtn = document.getElementById('modal-new-competency-close');
    const cancelBtn = document.getElementById('modal-new-competency-cancel');
    const submitBtn = document.getElementById('modal-new-competency-submit');
    
    const monthSelect = document.getElementById('dup-month');
    const yearSelect = document.getElementById('dup-year');
    
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.innerText = String(y);
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    monthSelect.value = currentMonth;
    
    modal.classList.add('active');
    
    const closeAll = () => {
        modal.classList.remove('active');
        closeBtn.onclick = null;
        cancelBtn.onclick = null;
        submitBtn.onclick = null;
    };
    
    const handleCancel = () => {
        closeAll();
        window.skipReceiptInit = false;
    };
    
    closeBtn.onclick = handleCancel;
    cancelBtn.onclick = handleCancel;
    
    submitBtn.onclick = async () => {
        const newCompetency = `${monthSelect.value}/${yearSelect.value}`;
        closeAll();
        
        const sourceType = source.tipo_recibo || source.receipt_type || 'payroll';
        const allReceipts = await db.getReceipts();
        const existing = allReceipts.find(r => 
            r.funcionario_id === source.funcionario_id && 
            r.competencia === newCompetency &&
            (r.tipo_recibo || r.receipt_type || 'payroll') === sourceType
        );
        
        if (existing) {
            openCollisionModal(existing, source, newCompetency);
        } else {
            await createDuplicatedReceipt(source, newCompetency);
        }
    };
}

function openCollisionModal(existingReceipt, sourceReceipt, newCompetency) {
    const modal = document.getElementById('modal-collision');
    const closeBtn = document.getElementById('modal-collision-close');
    const openBtn = document.getElementById('modal-collision-open');
    const createBtn = document.getElementById('modal-collision-create');
    const cancelBtn = document.getElementById('modal-collision-cancel');
    
    modal.classList.add('active');
    
    const closeAll = () => {
        modal.classList.remove('active');
        closeBtn.onclick = null;
        openBtn.onclick = null;
        createBtn.onclick = null;
        cancelBtn.onclick = null;
    };
    
    const handleCancel = () => {
        closeAll();
        window.skipReceiptInit = false;
    };
    
    closeBtn.onclick = handleCancel;
    cancelBtn.onclick = handleCancel;
    
    openBtn.onclick = async () => {
        closeAll();
        await initReceipt(existingReceipt.id);
        const link = document.querySelector('.sidebar-menu [data-view="recibo"] a');
        if (link) link.click();
    };
    
    createBtn.onclick = async () => {
        closeAll();
        await createDuplicatedReceipt(sourceReceipt, newCompetency);
    };
}

async function createDuplicatedReceipt(source, newCompetency) {
    const duplicated = performDuplication(source);
    duplicated.competencia = newCompetency;
    
    const parts = newCompetency.split('/');
    const month = parseInt(parts[0]);
    const year = parseInt(parts[1]);
    const lastDay = new Date(year, month, 0).getDate();
    
    duplicated.periodo = `01/${parts[0]}/${parts[1]} à ${String(lastDay).padStart(2, '0')}/${parts[0]}/${parts[1]}`;
    duplicated.data_emissao = new Date().toISOString().split('T')[0];
    
    if (duplicated.vencimentos) {
        duplicated.vencimentos.forEach(v => {
            if (v.descricao.toLowerCase().includes('salário base') || v.descricao.toLowerCase().includes('salario base')) {
                v.descricao = `Salário Base ${duplicated.periodo}`;
            }
        });
    }
    
    currentReceipt = duplicated;
    
    renderReceiptEditor();
    recalculateTotals();
    
    const link = document.querySelector('.sidebar-menu [data-view="recibo"] a');
    if (link) link.click();
}
