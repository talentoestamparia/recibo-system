/**
 * Controlador de Interface para o Módulo de Pró-labore
 */
import { formatCurrency, formatDateBR } from './utils.js?v=12';
import { supabase } from './supabase.js?v=12';
import {
    getOrCreateProlaborePeriod,
    updateProlaboreGrossAmount,
    getProlaboreTransactions,
    saveProlaboreTransaction,
    deleteProlaboreTransaction,
    copyPreviousMonthTransactions
} from './db_prolabore.js?v=12';

let currentPeriod = null;
let currentTransactions = [];

/**
 * Inicializa a tela de Pró-labore
 */
export async function initProlabore() {
    const monthSelect = document.getElementById('prolabore-month-select');
    if (!monthSelect) return;

    // Setar mês atual como padrão se estiver vazio
    if (!monthSelect.value) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        monthSelect.value = `${year}-${month}`;
    }

    // Configurar listeners se ainda não estiverem configurados
    setupListeners();

    // Carregar dados iniciais
    await loadProlaboreData(monthSelect.value);
}

/**
 * Registra os listeners da interface
 */
function setupListeners() {
    const monthSelect = document.getElementById('prolabore-month-select');
    const btnEditGross = document.getElementById('prolabore-btn-edit-gross');
    const btnSaveGross = document.getElementById('prolabore-btn-save-gross');
    const btnCopyModel = document.getElementById('prolabore-btn-copy-model');
    const btnAddExpense = document.getElementById('prolabore-btn-add-expense');
    const btnAddReceivable = document.getElementById('prolabore-btn-add-receivable');
    
    // Modal
    const transModal = document.getElementById('modal-prolabore-transaction');
    const transModalClose = document.getElementById('modal-prolabore-transaction-close');
    const transModalCancel = document.getElementById('modal-prolabore-transaction-cancel');
    const transForm = document.getElementById('form-prolabore-transaction');
    const transTypeSelect = document.getElementById('prolabore-trans-type');

    if (monthSelect) {
        monthSelect.onchange = async () => {
            await loadProlaboreData(monthSelect.value);
        };
    }

    if (btnEditGross) {
        btnEditGross.onclick = () => {
            const display = document.getElementById('prolabore-gross-display');
            const wrapper = document.getElementById('prolabore-gross-edit-wrapper');
            const input = document.getElementById('prolabore-gross-input');
            
            if (display && wrapper && input && currentPeriod) {
                display.classList.add('d-none');
                wrapper.classList.remove('d-none');
                input.value = currentPeriod.gross_amount;
                input.focus();
            }
        };
    }

    if (btnSaveGross) {
        btnSaveGross.onclick = async () => {
            const display = document.getElementById('prolabore-gross-display');
            const wrapper = document.getElementById('prolabore-gross-edit-wrapper');
            const input = document.getElementById('prolabore-gross-input');
            
            if (display && wrapper && input && currentPeriod) {
                const amount = parseFloat(input.value) || 0;
                try {
                    await updateProlaboreGrossAmount(currentPeriod.id, amount);
                    wrapper.classList.add('d-none');
                    display.classList.remove('d-none');
                    await loadProlaboreData(monthSelect.value);
                } catch (err) {
                    alert('Erro ao atualizar retirada bruta: ' + err.message);
                }
            }
        };
    }

    if (btnCopyModel) {
        btnCopyModel.onclick = async () => {
            if (!currentPeriod) return;
            
            // Obter mês anterior
            const [year, month] = monthSelect.value.split('-').map(Number);
            let prevYear = year;
            let prevMonth = month - 1;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear -= 1;
            }
            const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

            if (confirm(`Deseja copiar todos os lançamentos do mês anterior (${prevMonthStr}) como modelo para este mês?`)) {
                try {
                    const copied = await copyPreviousMonthTransactions(currentPeriod.id, prevMonthStr);
                    if (copied) {
                        alert('Lançamentos do mês anterior copiados com sucesso!');
                        await loadProlaboreData(monthSelect.value);
                    } else {
                        alert('Nenhum lançamento encontrado no mês anterior para copiar.');
                    }
                } catch (err) {
                    alert('Erro ao copiar modelo: ' + err.message);
                }
            }
        };
    }

    if (transTypeSelect) {
        transTypeSelect.onchange = () => {
            toggleModalFormFields(transTypeSelect.value);
        };
    }

    if (btnAddExpense) {
        btnAddExpense.onclick = () => {
            openTransactionModal('expense');
        };
    }

    if (btnAddReceivable) {
        btnAddReceivable.onclick = () => {
            openTransactionModal('receivable');
        };
    }

    if (transModalClose) transModalClose.onclick = closeTransactionModal;
    if (transModalCancel) transModalCancel.onclick = closeTransactionModal;

    if (transForm) {
        transForm.onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction();
        };
        
        // Listener do botão de salvar na footer do modal
        const btnSaveTrans = document.getElementById('modal-prolabore-transaction-save');
        if (btnSaveTrans) {
            btnSaveTrans.onclick = () => {
                // Dispara a submissão nativa do form para rodar as validações de HTML5
                transForm.requestSubmit();
            };
        }
    }
}

/**
 * Alterna a visibilidade dos campos específicos do formulário do modal com base no tipo
 * @param {string} type 
 */
function toggleModalFormFields(type) {
    const supplierGroup = document.getElementById('prolabore-trans-supplier-group');
    const receivedGroup = document.getElementById('prolabore-trans-received-group');
    const installmentGroup = document.getElementById('prolabore-trans-installment-group');
    const totalInstallmentsGroup = document.getElementById('prolabore-trans-total-installments-group');

    if (type === 'expense' || type === 'tax' || type === 'withdraw') {
        if (supplierGroup) supplierGroup.style.display = 'block';
        if (installmentGroup) installmentGroup.style.display = 'block';
        if (totalInstallmentsGroup) totalInstallmentsGroup.style.display = 'block';
        if (receivedGroup) receivedGroup.style.display = 'none';
    } else {
        if (supplierGroup) supplierGroup.style.display = 'none';
        if (installmentGroup) installmentGroup.style.display = 'none';
        if (totalInstallmentsGroup) totalInstallmentsGroup.style.display = 'none';
        if (receivedGroup) receivedGroup.style.display = 'flex';
    }
}

/**
 * Abre o modal de transação
 * @param {string} defaultType - Tipo padrão ('expense' ou 'receivable')
 * @param {Object} [editData] - Dados da transação caso seja edição
 */
function openTransactionModal(defaultType, editData = null) {
    const modal = document.getElementById('modal-prolabore-transaction');
    const title = document.getElementById('modal-prolabore-transaction-title');
    const form = document.getElementById('form-prolabore-transaction');
    
    if (!modal || !form) return;

    form.reset();

    const idInput = document.getElementById('prolabore-trans-id');
    const typeSelect = document.getElementById('prolabore-trans-type');
    const dateInput = document.getElementById('prolabore-trans-date');
    const catInput = document.getElementById('prolabore-trans-category');
    const supInput = document.getElementById('prolabore-trans-supplier');
    const descInput = document.getElementById('prolabore-trans-description');
    const amountInput = document.getElementById('prolabore-trans-amount');
    const recInput = document.getElementById('prolabore-trans-received');
    const instInput = document.getElementById('prolabore-trans-installment');
    const totalInstInput = document.getElementById('prolabore-trans-total-installments');
    const attachInput = document.getElementById('prolabore-trans-attachment');

    // Configurar data padrão (hoje)
    if (dateInput) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${y}-${m}-${d}`;
    }

    if (editData) {
        if (title) title.innerText = 'Editar Lançamento';
        if (idInput) idInput.value = editData.id;
        if (typeSelect) typeSelect.value = editData.type;
        if (dateInput && editData.transaction_date) dateInput.value = editData.transaction_date;
        if (catInput) catInput.value = editData.category || '';
        if (supInput) supInput.value = editData.supplier_name || '';
        if (descInput) descInput.value = editData.description;
        if (amountInput) amountInput.value = editData.amount;
        if (recInput) recInput.checked = editData.is_received;
        if (instInput) instInput.value = editData.installment || '';
        if (totalInstInput) totalInstInput.value = editData.total_installments || '';
        if (attachInput) attachInput.value = editData.attachment_url || '';
        
        toggleModalFormFields(editData.type);
    } else {
        if (title) title.innerText = 'Adicionar Lançamento';
        if (idInput) idInput.value = '';
        if (typeSelect) typeSelect.value = defaultType;
        
        toggleModalFormFields(defaultType);
    }

    modal.classList.add('active');
}

/**
 * Fecha o modal de transação
 */
function closeTransactionModal() {
    const modal = document.getElementById('modal-prolabore-transaction');
    if (modal) modal.classList.remove('active');
}

/**
 * Salva a transação do modal
 */
async function saveTransaction() {
    if (!currentPeriod) return;

    const id = document.getElementById('prolabore-trans-id').value;
    const type = document.getElementById('prolabore-trans-type').value;
    const date = document.getElementById('prolabore-trans-date').value;
    const category = document.getElementById('prolabore-trans-category').value;
    const supplier = document.getElementById('prolabore-trans-supplier').value;
    const description = document.getElementById('prolabore-trans-description').value;
    const amount = parseFloat(document.getElementById('prolabore-trans-amount').value) || 0;
    const isReceived = document.getElementById('prolabore-trans-received').checked;
    const installment = parseInt(document.getElementById('prolabore-trans-installment').value) || null;
    const totalInstallments = parseInt(document.getElementById('prolabore-trans-total-installments').value) || null;
    const attachment = document.getElementById('prolabore-trans-attachment').value;

    const transData = {
        period_id: currentPeriod.id,
        type,
        transaction_date: date || null,
        category: category || null,
        description,
        amount,
        is_received: isReceived
    };

    if (id) transData.id = id;
    if (type === 'expense' || type === 'tax' || type === 'withdraw') {
        transData.supplier_name = supplier || null;
        transData.installment = installment;
        transData.total_installments = totalInstallments;
    } else {
        transData.supplier_name = null;
        transData.installment = null;
        transData.total_installments = null;
    }
    if (attachment) transData.attachment_url = attachment;

    try {
        await saveProlaboreTransaction(transData);
        closeTransactionModal();
        const monthSelect = document.getElementById('prolabore-month-select');
        await loadProlaboreData(monthSelect.value);
    } catch (err) {
        alert('Erro ao salvar lançamento: ' + err.message);
    }
}

/**
 * Carrega e renderiza todos os dados de Pró-labore da competência
 * @param {string} monthStr - Formato 'YYYY-MM'
 */
async function loadProlaboreData(monthStr) {
    if (!supabase) {
        alert('Supabase offline. A gestão de Pró-labore está bloqueada temporariamente.');
        return;
    }

    try {
        // Obter ou criar o período
        currentPeriod = await getOrCreateProlaborePeriod(monthStr);
        if (!currentPeriod) return;

        // Obter transações
        currentTransactions = await getProlaboreTransactions(currentPeriod.id);

        // Renderizar a tela
        renderScreen();
    } catch (err) {
        console.error('Erro ao carregar dados do Pró-labore:', err);
        alert('Falha ao carregar dados do Pró-labore.');
    }
}

/**
 * Renderiza os dados do Pró-labore no DOM
 */
function renderScreen() {
    if (!currentPeriod) return;

    // Retirada Bruta
    const grossDisplay = document.getElementById('prolabore-gross-display');
    if (grossDisplay) grossDisplay.innerText = formatCurrency(currentPeriod.gross_amount);

    // Separar despesas de receitas
    const expenses = currentTransactions.filter(t => t.type === 'expense' || t.type === 'tax' || t.type === 'withdraw');
    const receivables = currentTransactions.filter(t => t.type === 'receivable' || t.type === 'income');

    // Somar Totais
    const expensesTotal = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const receivablesTotal = receivables.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const netBalance = parseFloat(currentPeriod.gross_amount) - expensesTotal + receivablesTotal;

    // Atualizar displays de métricas
    const expensesDisplay = document.getElementById('prolabore-expenses-display');
    if (expensesDisplay) expensesDisplay.innerText = formatCurrency(expensesTotal);

    const receivablesDisplay = document.getElementById('prolabore-receivables-display');
    if (receivablesDisplay) receivablesDisplay.innerText = formatCurrency(receivablesTotal);

    const netDisplay = document.getElementById('prolabore-net-display');
    if (netDisplay) {
        netDisplay.innerText = formatCurrency(netBalance);
        // Mudar cor do saldo de acordo com o saldo líquido
        if (netBalance < 0) {
            netDisplay.style.color = '#ef4444';
        } else if (netBalance > 0) {
            netDisplay.style.color = 'var(--primary-color)';
        } else {
            netDisplay.style.color = 'var(--text-color)';
        }
    }

    // Renderizar Tabelas
    renderExpensesTable(expenses);
    renderReceivablesTable(receivables);
}

/**
 * Mapeia o tipo da transação para um badge amigável
 * @param {string} type 
 * @returns {string} HTML do badge
 */
function getTypeBadge(type) {
    let color = '';
    let text = '';
    
    switch (type) {
        case 'expense':
            color = '#fee2e2; color: #ef4444';
            text = 'Despesa';
            break;
        case 'tax':
            color = '#fef3c7; color: #d97706';
            text = 'Imposto';
            break;
        case 'withdraw':
            color = '#e0f2fe; color: #0284c7';
            text = 'Retirada Extra';
            break;
        case 'receivable':
            color = '#d1fae5; color: #10b981';
            text = 'A Receber';
            break;
        case 'income':
            color = '#e0e7ff; color: #4f46e5';
            text = 'Receita';
            break;
    }
    
    return `<span class="badge" style="background-color: ${color}; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600;">${text}</span>`;
}

/**
 * Renderiza a tabela de despesas
 * @param {Array} list 
 */
function renderExpensesTable(list) {
    const tbody = document.querySelector('#prolabore-expenses-table tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum gasto ou despesa lançado para este mês.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => {
        const dateBR = item.transaction_date ? formatDateBR(item.transaction_date) : '-';
        const installmentText = (item.installment && item.total_installments) 
            ? `${item.installment}/${item.total_installments}` 
            : '-';
            
        // Se houver anexo/comprovante
        const attachmentHtml = item.attachment_url
            ? `<a href="${item.attachment_url}" target="_blank" title="Ver Comprovante" style="margin-left: 8px; color: var(--primary-color);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
               </a>`
            : '';

        return `
            <tr>
                <td>${dateBR}</td>
                <td>${getTypeBadge(item.type)}</td>
                <td>${item.category || '-'}</td>
                <td>${item.supplier_name || '-'}</td>
                <td>
                    ${item.description}
                    ${attachmentHtml}
                </td>
                <td>${installmentText}</td>
                <td style="font-weight: 600; color: #ef4444;">${formatCurrency(item.amount)}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-action edit-btn" data-id="${item.id}" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-action delete-btn" data-id="${item.id}" title="Excluir">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Bind de ações nas linhas
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => {
            const trans = currentTransactions.find(t => t.id === btn.dataset.id);
            if (trans) openTransactionModal(trans.type, trans);
        };
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Tem certeza de que deseja excluir este lançamento?')) {
                try {
                    await deleteProlaboreTransaction(btn.dataset.id);
                    const monthSelect = document.getElementById('prolabore-month-select');
                    await loadProlaboreData(monthSelect.value);
                } catch (err) {
                    alert('Erro ao excluir lançamento: ' + err.message);
                }
            }
        };
    });
}

/**
 * Renderiza a tabela de recebíveis e receitas
 * @param {Array} list 
 */
function renderReceivablesTable(list) {
    const tbody = document.querySelector('#prolabore-receivables-table tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum valor a receber ou receita lançado para este mês.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => {
        const dateBR = item.transaction_date ? formatDateBR(item.transaction_date) : '-';
        const checkedAttribute = item.is_received ? 'checked' : '';
        
        // Comprovante
        const attachmentHtml = item.attachment_url
            ? `<a href="${item.attachment_url}" target="_blank" title="Ver Comprovante" style="margin-left: 8px; color: var(--primary-color);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
               </a>`
            : '';

        return `
            <tr>
                <td>${dateBR}</td>
                <td>${getTypeBadge(item.type)}</td>
                <td>${item.category || '-'}</td>
                <td>
                    ${item.description}
                    ${attachmentHtml}
                </td>
                <td style="font-weight: 600; color: #10b981;">${formatCurrency(item.amount)}</td>
                <td>
                    <input type="checkbox" class="received-chk" data-id="${item.id}" ${checkedAttribute} style="width: 18px; height: 18px; cursor: pointer;">
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-action edit-btn" data-id="${item.id}" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-action delete-btn" data-id="${item.id}" title="Excluir">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Bind de ações nas linhas
    tbody.querySelectorAll('.received-chk').forEach(chk => {
        chk.onchange = async () => {
            const trans = currentTransactions.find(t => t.id === chk.dataset.id);
            if (trans) {
                try {
                    await saveProlaboreTransaction({
                        id: trans.id,
                        period_id: trans.period_id,
                        type: trans.type,
                        description: trans.description,
                        amount: trans.amount,
                        is_received: chk.checked
                    });
                    const monthSelect = document.getElementById('prolabore-month-select');
                    await loadProlaboreData(monthSelect.value);
                } catch (err) {
                    alert('Erro ao alterar status recebido: ' + err.message);
                    chk.checked = !chk.checked; // Reverter visualmente em caso de falha
                }
            }
        };
    });

    tbody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => {
            const trans = currentTransactions.find(t => t.id === btn.dataset.id);
            if (trans) openTransactionModal(trans.type, trans);
        };
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Tem certeza de que deseja excluir este lançamento?')) {
                try {
                    await deleteProlaboreTransaction(btn.dataset.id);
                    const monthSelect = document.getElementById('prolabore-month-select');
                    await loadProlaboreData(monthSelect.value);
                } catch (err) {
                    alert('Erro ao excluir lançamento: ' + err.message);
                }
            }
        };
    });
}
