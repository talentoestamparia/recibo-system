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
        funcionario_id: '',
        funcionario_nome: '',
        competencia: '',
        periodo: '',
        data_emissao: '',
        vencimentos: [],
        descontos: [],
        valor_liquido: 0,
        observacoes: ''
    };
}

function performDuplication(source) {
    // Fazer cópia completa de todos os vencimentos e descontos (recorrentes e variáveis)
    const vencs = JSON.parse(JSON.stringify(source.vencimentos || []));
    const descs = JSON.parse(JSON.stringify(source.descontos || []));
    
    return {
        id: '', // Novo recibo
        funcionario_id: source.funcionario_id,
        funcionario_nome: source.funcionario_nome,
        competencia: '', // Limpar para atualização
        periodo: '', // Limpar para atualização
        data_emissao: '', // Limpar para atualização
        vencimentos: vencs,
        descontos: descs,
        valor_liquido: 0,
        observacoes: source.observacoes || ''
    };
}

function renderReceiptEditor() {
    // Sincronizar dados da empresa nos recibos (a partir das configurações globais)
    document.querySelectorAll('[data-field="empresa_nome"]').forEach(el => {
        el.innerText = settings.empresa_nome || 'ESTAMPARIA JL LTDA - ME';
    });
    document.querySelectorAll('[data-field="empresa_cnpj"]').forEach(el => {
        el.innerText = settings.empresa_cnpj || '25.140.946/0001-84';
    });
    
    // Preencher Cidade automaticamente
    document.getElementById('city-text-1').innerText = settings.empresa_cidade || 'Sarandi-PR';
    document.getElementById('city-text-2').innerText = settings.empresa_cidade || 'Sarandi-PR';
    
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
    
    // Renderizar Vencimentos e Descontos
    renderLines('vencimentos');
    renderLines('descontos');
    
    // Mostrar/Ocultar botões de ferramentas
    const dupBtn = document.getElementById('recibo-btn-duplicate');
    
    if (currentReceipt.id) {
        dupBtn.style.display = 'inline-flex';
    } else {
        dupBtn.style.display = 'none';
    }
}

function renderLines(type) {
    const list = currentReceipt[type] || [];
    
    // Renderizar na Via 1 e Via 2
    for (let via = 1; via <= 2; via++) {
        const container = document.getElementById(`${type}-container-${via}`);
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
    const defaultDesc = type === 'vencimentos' ? 'Novo Vencimento' : 'Novo Desconto';
    currentReceipt[type].push({
        descricao: defaultDesc,
        valor: 0,
        recorrente: true
    });
    renderLines(type);
    recalculateTotals();
}

function deleteLine(type, index) {
    currentReceipt[type].splice(index, 1);
    renderLines(type);
    recalculateTotals();
}

function recalculateTotals() {
    const sumVencimentos = currentReceipt.vencimentos.reduce((sum, item) => sum + item.valor, 0);
    const sumDescontos = currentReceipt.descontos.reduce((sum, item) => sum + item.valor, 0);
    const net = sumVencimentos - sumDescontos;
    
    currentReceipt.valor_liquido = net;
    
    const formattedNet = utils.formatCurrency(net);
    
    // Atualizar displays de total nas duas vias
    document.getElementById('receipt-total-val-1').innerText = formattedNet;
    document.getElementById('receipt-total-val-2').innerText = formattedNet;
    
    // Atualizar valor por extenso/declarado nas duas vias
    document.getElementById('receipt-declaration-val-1').innerText = formattedNet;
    document.getElementById('receipt-declaration-val-2').innerText = formattedNet;
}

function setupEventListeners() {
    // Adicionar vencimento
    document.getElementById('btn-add-vencimento-1').onclick = () => addLine('vencimentos');
    document.getElementById('btn-add-vencimento-2').onclick = () => addLine('vencimentos');
    
    // Adicionar desconto
    document.getElementById('btn-add-desconto-1').onclick = () => addLine('descontos');
    document.getElementById('btn-add-desconto-2').onclick = () => addLine('descontos');
    
    // Autocomplete do Funcionário
    setupEmployeeAutocomplete();
    
    // Ações do Topo
    document.getElementById('recibo-btn-clear').onclick = handleClear;
    document.getElementById('recibo-btn-save').onclick = handleSave;
    document.getElementById('recibo-btn-print').onclick = handlePrint;
    document.getElementById('recibo-btn-pdf').onclick = handlePDF;
    

    
    document.getElementById('recibo-btn-duplicate').onclick = () => {
        if (currentReceipt.id) {
            window.skipReceiptInit = true;
            duplicateReceiptWorkflow(currentReceipt.id);
        }
    };
    
    // Sincronização em tempo real das edições (via contenteditable)
    const workspace = document.getElementById('receipts-workspace-container');
    
    // Interceptar input em tempo real nos campos editáveis
    workspace.oninput = (e) => {
        const target = e.target;
        
        // 1. Caso seja campo do cabeçalho
        if (target.dataset.field) {
            const field = target.dataset.field;
            let value = target.innerText;
            
            // Sincronizar com o objeto interno
            if (field === 'funcionario_nome') {
                currentReceipt.funcionario_nome = value;
                // Atualizar também assinatura
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
        
        // 2. Caso seja campo da tabela de vencimentos/descontos
        if (target.dataset.prop) {
            const type = target.dataset.type; // vencimentos / descontos
            const index = parseInt(target.dataset.index);
            const prop = target.dataset.prop; // descricao / valor
            
            let value = target.innerText;
            
            if (prop === 'valor') {
                currentReceipt[type][index].valor = utils.parseCurrency(value);
                recalculateTotals();
            } else {
                currentReceipt[type][index].descricao = value;
            }
            
            // Sincronizar na outra via
            // Identificar qual via foi editada (1 ou 2) e atualizar o correspondente na outra via
            const currentVia = target.closest('.receipt').dataset.via;
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
            const formatted = utils.formatNumber(currentReceipt[type][index].valor);
            
            // Formata o texto em ambas as vias
            document.querySelectorAll(`[data-type="${type}"][data-index="${index}"][data-prop="valor"]`).forEach(el => {
                el.innerText = formatted;
            });
        }
        
        if (target.dataset.field === 'data_emissao_formatada') {
            // Se o usuário digitou uma data, garantir que esteja na máscara correta ao sair
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
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function renderEmployeeDropdown(list) {
    const dropdown = document.getElementById('recibo-employee-dropdown');
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
            document.getElementById('recibo-employee-search').value = '';
        };
        
        dropdown.appendChild(item);
    });
    
    dropdown.classList.add('active');
}

function selectEmployee(emp) {
    currentReceipt.funcionario_id = emp.id;
    currentReceipt.funcionario_nome = emp.nome;
    
    // Preencher período sugerido (mês atual)
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    
    currentReceipt.competencia = `${mm}/${yyyy}`;
    currentReceipt.periodo = `01/${mm}/${yyyy} à ${lastDay}/${mm}/${yyyy}`;
    
    // Preencher vencimento básico (Salário Base)
    currentReceipt.vencimentos = [
        {
            descricao: `Salário Base 01/${mm}/${yyyy} à ${lastDay}/${mm}/${yyyy}`,
            valor: emp.salario_base,
            recorrente: true
        }
    ];
    
    // Limpar descontos para evitar acúmulo de dados antigos
    currentReceipt.descontos = [];
    
    // Data de emissão padrão para hoje
    const todayIso = today.toISOString().split('T')[0];
    currentReceipt.data_emissao = todayIso;
    
    renderReceiptEditor();
    recalculateTotals();
}

function handleClear() {
    if (confirm('Deseja limpar todos os campos do recibo atual?')) {
        currentReceipt = createEmptyReceipt();
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
        // Tentar buscar do período
        const pMatch = currentReceipt.periodo.match(/(\d{2})\/(\d{4})/);
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
    
    // Salvar no BD
    const saved = await db.saveReceipt(currentReceipt);
    currentReceipt.id = saved.id;
    
    alert('Recibo de pagamento salvo com sucesso!');
    
    // Habilitar botão de duplicação
    document.getElementById('recibo-btn-duplicate').style.display = 'inline-flex';
}

function openNewCompetencyModalForSave() {
    const modal = document.getElementById('modal-new-competency');
    const closeBtn = document.getElementById('modal-new-competency-close');
    const cancelBtn = document.getElementById('modal-new-competency-cancel');
    const submitBtn = document.getElementById('modal-new-competency-submit');
    
    const monthSelect = document.getElementById('dup-month');
    const yearSelect = document.getElementById('dup-year');
    
    // Preencher anos
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.innerText = String(y);
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    
    // Configurar padrão de mês
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
        
        // Calcular período e data de emissão
        const parts = newCompetency.split('/');
        const month = parseInt(parts[0]);
        const year = parseInt(parts[1]);
        const lastDay = new Date(year, month, 0).getDate();
        
        const newPeriod = `01/${parts[0]}/${parts[1]} à ${String(lastDay).padStart(2, '0')}/${parts[0]}/${parts[1]}`;
        const newEmissionDate = `${parts[1]}-${parts[0]}-${String(lastDay).padStart(2, '0')}`;
        
        // Atualizar informações de período e emissão no recibo ativo
        currentReceipt.competencia = newCompetency;
        currentReceipt.periodo = newPeriod;
        currentReceipt.data_emissao = newEmissionDate;
        
        // Atualizar também na descrição do Salário Base se houver
        if (currentReceipt.vencimentos) {
            currentReceipt.vencimentos.forEach(v => {
                if (v.descricao.toLowerCase().includes('salário base') || v.descricao.toLowerCase().includes('salario base')) {
                    v.descricao = `Salário Base ${newPeriod}`;
                }
            });
        }
        
        // Remover propriedades temporárias de modelo para futuros salvamentos
        delete currentReceipt.modo;
        delete currentReceipt.origemReciboId;
        
        // Salvar como NOVO recibo no banco de dados (garantindo que o original não seja alterado)
        const saved = await db.saveReceipt(currentReceipt);
        currentReceipt.id = saved.id;
        
        alert('Recibo de pagamento salvo com sucesso!');
        
        // Re-renderizar o editor e recalcular somas na tela
        renderReceiptEditor();
        recalculateTotals();
        
        // Habilitar botão interno de duplicação
        document.getElementById('recibo-btn-duplicate').style.display = 'inline-flex';
    };
}

function clearPrintFitting() {
    const wrapper = document.getElementById('print-area');
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
    const wrapper = document.getElementById('print-area');
    const via1 = wrapper.querySelector('.via-1');
    const via2 = wrapper.querySelector('.via-2');
    
    if (!via1 || !via2) return true;
    
    // Limpar estados anteriores
    clearPrintFitting();
    
    // Criar uma cópia temporária (clone) para medição correta dos estilos de impressão
    const measuringContainer = document.createElement('div');
    measuringContainer.id = 'print-area';
    measuringContainer.className = 'measuring-print';
    
    const clone = via1.cloneNode(true);
    // Limpar elementos não imprimíveis para medir apenas o conteúdo real
    clone.querySelectorAll('.no-print, button, .add-row, .recurrent-indicator, .recurrent-indicator-variable').forEach(el => el.remove());
    
    const totalLines = currentReceipt.vencimentos.length + currentReceipt.descontos.length;
    
    // 1. Aplicar classe sugerida com base no número de linhas
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
    
    // Medir altura real do recibo
    let receiptHeight = clone.getBoundingClientRect().height;
    
    // Altura útil da folha A4 Landscape com margem de 5mm (200mm = ~755.9px)
    // Deixando uma margem de segurança segura de 10mm (190mm = ~718.11px)
    const availableHeight = 190 * 3.7795275591;
    
    // 2. Se ultrapassar a altura útil e ainda pudermos compactar mais, tentar very-compact
    if (receiptHeight > availableHeight && appliedClass !== 'very-compact') {
        clone.classList.remove('compact');
        clone.classList.add('very-compact');
        receiptHeight = clone.getBoundingClientRect().height;
        appliedClass = 'very-compact';
    }
    
    // Remover o clone temporário do DOM
    measuringContainer.remove();
    
    // Aplicar a classe definitiva nas duas vias do editor para a impressão
    if (appliedClass) {
        via1.classList.add(appliedClass);
        via2.classList.add(appliedClass);
    }
    
    // Validação desativada temporariamente conforme solicitação para testes livres
    /*
    if (receiptHeight > availableHeight) {
        alert("O recibo possui muitos itens para uma única folha. Remova algumas linhas ou permita a impressão em duas páginas.");
        clearPrintFitting();
        return false;
    }
    */
    return true;
}

async function handlePrint() {
    if (!currentReceipt.funcionario_nome) {
        alert('Por favor, monte o recibo antes de imprimir.');
        return;
    }
    
    const ok = await testReceiptFitting();
    if (!ok) return;
    
    const printArea = document.getElementById('print-area');
    const originalParent = printArea.parentNode;
    const originalSibling = printArea.nextSibling;
    
    // Mover temporariamente para a raiz do body para isolar de qualquer contêiner SPA restritivo
    document.body.appendChild(printArea);
    
    window.print();
    
    // Devolver ao posicionamento original no DOM da SPA
    if (originalSibling) {
        originalParent.insertBefore(printArea, originalSibling);
    } else {
        originalParent.appendChild(printArea);
    }
    
    // Retornar tudo ao normal na tela após 1 segundo
    setTimeout(clearPrintFitting, 1000);
}

async function handlePDF() {
    if (!currentReceipt.funcionario_nome) {
        alert('Por favor, monte o recibo antes de salvar em PDF.');
        return;
    }
    
    const ok = await testReceiptFitting();
    if (!ok) return;
    
    const printArea = document.getElementById('print-area');
    const originalParent = printArea.parentNode;
    const originalSibling = printArea.nextSibling;
    
    document.body.appendChild(printArea);
    
    window.print();
    
    if (originalSibling) {
        originalParent.insertBefore(printArea, originalSibling);
    } else {
        originalParent.appendChild(printArea);
    }
    
    setTimeout(clearPrintFitting, 1000);
}

// Ouvinte de evento customizado para abrir recibo para edição a partir de outra tela
window.addEventListener('editReceipt', async (e) => {
    const id = e.detail;
    window.skipReceiptInit = true;
    await initReceipt(id);
});

// Ouvinte de evento customizado para duplicar recibo a partir de outra tela
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
    
    // Preencher anos
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.innerText = String(y);
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    
    // Setar mês atual por padrão
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
        
        // Verificar colisão
        const allReceipts = await db.getReceipts();
        const existing = allReceipts.find(r => r.funcionario_id === source.funcionario_id && r.competencia === newCompetency);
        
        if (existing) {
            // Mostrar modal de colisão
            openCollisionModal(existing, source, newCompetency);
        } else {
            // Criar cópia direta
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
    
    currentReceipt = duplicated;
    
    renderReceiptEditor();
    recalculateTotals();
    
    const link = document.querySelector('.sidebar-menu [data-view="recibo"] a');
    if (link) link.click();
}

