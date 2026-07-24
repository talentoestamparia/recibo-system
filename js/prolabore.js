/**
 * Controlador de Interface para o Módulo de Pró-labore (Suporte Multi-sócio)
 */
import { formatCurrency, formatDateBR } from './utils.js?v=12';
import { supabase } from './supabase.js?v=12';
import {
    getOrCreateDefaultPartners,
    getProlaborePartners,
    saveProlaborePartner,
    deleteProlaborePartner,
    getOrCreateProlaborePeriod,
    updateProlaboreGrossAmount,
    getProlaboreTransactions,
    saveProlaboreTransaction,
    deleteProlaboreTransaction,
    copyPreviousMonthTransactions
} from './db_prolabore.js?v=12';

let currentPartnerId = null;
let currentPeriod = null;
let currentTransactions = [];
let allPartners = [];

/**
 * Inicializa a tela de Pró-labore
 */
export async function initProlabore() {
    const partnerSelect = document.getElementById('prolabore-partner-select');
    const monthSelect = document.getElementById('prolabore-month-select');
    if (!partnerSelect || !monthSelect) return;

    try {
        // 1. Carregar/Inicializar sócios padrão
        allPartners = await getOrCreateDefaultPartners();
        
        // 2. Preencher select de sócios
        renderPartnersDropdown();

        // 3. Setar sócio inicial se não houver selecionado
        if (!partnerSelect.value && allPartners.length > 0) {
            // Preferir o primeiro ativo
            const firstActive = allPartners.find(p => p.is_active);
            partnerSelect.value = firstActive ? firstActive.id : allPartners[0].id;
        }
        currentPartnerId = partnerSelect.value;

        // 4. Setar mês atual como padrão se estiver vazio
        if (!monthSelect.value) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            monthSelect.value = `${year}-${month}`;
        }

        // 5. Configurar todos os listeners
        setupListeners();

        // 6. Carregar dados do sócio e competência atuais
        if (currentPartnerId) {
            await loadProlaboreData(currentPartnerId, monthSelect.value);
        }
    } catch (err) {
        console.error('Erro na inicialização do Pró-labore:', err);
        alert('Erro ao inicializar o módulo de Pró-labore.');
    }
}

/**
 * Preenche o select de sócios com a lista atualizada
 */
function renderPartnersDropdown() {
    const partnerSelect = document.getElementById('prolabore-partner-select');
    if (!partnerSelect) return;

    partnerSelect.innerHTML = allPartners.map(p => {
        const statusLabel = p.is_active ? '' : ' (Inativo)';
        return `<option value="${p.id}">${p.name}${statusLabel}</option>`;
    }).join('');
}

/**
 * Registra os listeners da interface
 */
function setupListeners() {
    const partnerSelect = document.getElementById('prolabore-partner-select');
    const monthSelect = document.getElementById('prolabore-month-select');
    const btnEditGross = document.getElementById('prolabore-btn-edit-gross');
    const btnSaveGross = document.getElementById('prolabore-btn-save-gross');
    const btnCopyModel = document.getElementById('prolabore-btn-copy-model');
    const btnAddExpense = document.getElementById('prolabore-btn-add-expense');
    const btnAddReceivable = document.getElementById('prolabore-btn-add-receivable');
    
    // Botão de Gerência de Sócios
    const btnManagePartners = document.getElementById('prolabore-btn-manage-partners');

    // Modais
    const transModal = document.getElementById('modal-prolabore-transaction');
    const transModalClose = document.getElementById('modal-prolabore-transaction-close');
    const transModalCancel = document.getElementById('modal-prolabore-transaction-cancel');
    const transForm = document.getElementById('form-prolabore-transaction');
    const transTypeSelect = document.getElementById('prolabore-trans-type');

    // Modal de Sócios
    const partnersModal = document.getElementById('modal-prolabore-partners-list');
    const partnersModalClose = document.getElementById('modal-prolabore-partners-list-close');
    const partnersModalCloseBtn = document.getElementById('modal-prolabore-partners-list-close-btn');
    const partnerForm = document.getElementById('form-prolabore-partner');
    const partnerCancelEdit = document.getElementById('prolabore-partner-btn-cancel-edit');

    // Listeners do topo
    if (partnerSelect) {
        partnerSelect.onchange = async () => {
            currentPartnerId = partnerSelect.value;
            await loadProlaboreData(currentPartnerId, monthSelect.value);
        };
    }

    if (monthSelect) {
        monthSelect.onchange = async () => {
            if (currentPartnerId) {
                await loadProlaboreData(currentPartnerId, monthSelect.value);
            }
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
                    await loadProlaboreData(currentPartnerId, monthSelect.value);
                } catch (err) {
                    alert('Erro ao atualizar retirada bruta: ' + err.message);
                }
            }
        };
    }

    if (btnCopyModel) {
        btnCopyModel.onclick = async () => {
            if (!currentPeriod || !currentPartnerId) return;
            
            // Obter mês anterior
            const [year, month] = monthSelect.value.split('-').map(Number);
            let prevYear = year;
            let prevMonth = month - 1;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear -= 1;
            }
            const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

            if (confirm(`Deseja copiar os lançamentos do mês anterior (${prevMonthStr}) como modelo para este sócio?`)) {
                try {
                    const copied = await copyPreviousMonthTransactions(currentPeriod.id, currentPartnerId, prevMonthStr);
                    if (copied) {
                        alert('Lançamentos do mês anterior copiados com sucesso!');
                        await loadProlaboreData(currentPartnerId, monthSelect.value);
                    } else {
                        alert('Nenhum lançamento do mês anterior encontrado para este sócio.');
                    }
                } catch (err) {
                    alert('Erro ao copiar modelo: ' + err.message);
                }
            }
        };
    }

    const btnPdf = document.getElementById('btn-prolabore-pdf');
    console.log('Botão PDF encontrado:', btnPdf);
    if (btnPdf) {
        btnPdf.addEventListener('click', handleProlaborePrint);
    }

    // Modal Transações
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
        
        const btnSaveTrans = document.getElementById('modal-prolabore-transaction-save');
        if (btnSaveTrans) {
            btnSaveTrans.onclick = () => {
                transForm.requestSubmit();
            };
        }
    }

    // Modal Sócios
    if (btnManagePartners) {
        btnManagePartners.onclick = () => {
            openPartnersModal();
        };
    }

    if (partnersModalClose) partnersModalClose.onclick = closePartnersModal;
    if (partnersModalCloseBtn) partnersModalCloseBtn.onclick = closePartnersModal;

    if (partnerForm) {
        partnerForm.onsubmit = async (e) => {
            e.preventDefault();
            await savePartner();
        };
    }

    if (partnerCancelEdit) {
        partnerCancelEdit.onclick = () => {
            resetPartnerForm();
        };
    }
}

/**
 * Alterna a visibilidade dos campos específicos de transações
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

function closeTransactionModal() {
    const modal = document.getElementById('modal-prolabore-transaction');
    if (modal) modal.classList.remove('active');
}

/**
 * Salva transação
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
        await loadProlaboreData(currentPartnerId, monthSelect.value);
    } catch (err) {
        alert('Erro ao salvar lançamento: ' + err.message);
    }
}

/**
 * Métodos de gerenciamento de sócios
 */
function openPartnersModal() {
    const modal = document.getElementById('modal-prolabore-partners-list');
    if (!modal) return;

    resetPartnerForm();
    renderPartnersTable();
    modal.classList.add('active');
}

function closePartnersModal() {
    const modal = document.getElementById('modal-prolabore-partners-list');
    if (modal) modal.classList.remove('active');
}

/**
 * Renderiza a lista de sócios na tabela do modal
 */
function renderPartnersTable() {
    const tbody = document.querySelector('#prolabore-partners-table tbody');
    if (!tbody) return;

    if (allPartners.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:12px; color:var(--text-muted);">Nenhum sócio cadastrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = allPartners.map(p => {
        const badgeColor = p.is_active ? 'background-color: #d1fae5; color: #065f46;' : 'background-color: #fee2e2; color: #991b1b;';
        const badgeLabel = p.is_active ? 'Ativo' : 'Inativo';
        const statusBadge = `<span class="badge" style="${badgeColor} padding: 2px 6px; border-radius: var(--radius-sm); font-size: 0.7rem; font-weight:600;">${badgeLabel}</span>`;

        return `
            <tr>
                <td>${p.name}</td>
                <td>${p.cpf || '-'}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap: 8px;">
                        <button class="btn-action partner-edit-btn" data-id="${p.id}" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-action partner-delete-btn" data-id="${p.id}" title="Excluir">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Binds das ações dos sócios
    tbody.querySelectorAll('.partner-edit-btn').forEach(btn => {
        btn.onclick = () => {
            const partner = allPartners.find(p => p.id === btn.dataset.id);
            if (partner) {
                document.getElementById('prolabore-partner-id').value = partner.id;
                document.getElementById('prolabore-partner-name').value = partner.name;
                document.getElementById('prolabore-partner-cpf').value = partner.cpf || '';
                document.getElementById('prolabore-partner-active').checked = partner.is_active;

                document.getElementById('prolabore-partner-form-title').innerText = 'Editar Sócio';
                document.getElementById('prolabore-partner-btn-cancel-edit').classList.remove('d-none');
            }
        };
    });

    tbody.querySelectorAll('.partner-delete-btn').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Tem certeza de que deseja excluir este sócio?')) {
                try {
                    await deleteProlaborePartner(btn.dataset.id);
                    allPartners = await getProlaborePartners();
                    renderPartnersDropdown();
                    renderPartnersTable();
                } catch (err) {
                    alert(err.message);
                }
            }
        };
    });
}

/**
 * Reseta o formulário de sócios
 */
function resetPartnerForm() {
    const form = document.getElementById('form-prolabore-partner');
    if (form) form.reset();

    const idInput = document.getElementById('prolabore-partner-id');
    if (idInput) idInput.value = '';

    const title = document.getElementById('prolabore-partner-form-title');
    if (title) title.innerText = 'Novo Sócio';

    const cancelEdit = document.getElementById('prolabore-partner-btn-cancel-edit');
    if (cancelEdit) cancelEdit.classList.add('d-none');
}

/**
 * Salva um sócio (inserção/edição)
 */
async function savePartner() {
    const id = document.getElementById('prolabore-partner-id').value;
    const name = document.getElementById('prolabore-partner-name').value;
    const cpf = document.getElementById('prolabore-partner-cpf').value;
    const isActive = document.getElementById('prolabore-partner-active').checked;

    const partnerData = {
        name,
        cpf: cpf || null,
        is_active: isActive
    };
    if (id) partnerData.id = id;

    try {
        await saveProlaborePartner(partnerData);
        resetPartnerForm();
        
        // Atualizar lista local
        allPartners = await getProlaborePartners();
        renderPartnersDropdown();
        renderPartnersTable();
        
        // Manter o selecionado se possível
        const partnerSelect = document.getElementById('prolabore-partner-select');
        if (partnerSelect && id === currentPartnerId) {
            partnerSelect.value = id;
        }
    } catch (err) {
        alert('Erro ao salvar sócio: ' + err.message);
    }
}

/**
 * Carrega dados de Pró-labore por Sócio e Competência
 * @param {string} partnerId 
 * @param {string} monthStr - Formato 'YYYY-MM'
 */
async function loadProlaboreData(partnerId, monthStr) {
    if (!supabase) {
        alert('Supabase offline. A gestão de Pró-labore está bloqueada temporariamente.');
        return;
    }
    if (!partnerId) return;

    try {
        // Buscar/Criar período associado ao SÓCIO
        currentPeriod = await getOrCreateProlaborePeriod(partnerId, monthStr);
        if (!currentPeriod) return;

        // Obter transações
        currentTransactions = await getProlaboreTransactions(currentPeriod.id);

        // Renderizar
        renderScreen();
    } catch (err) {
        console.error('Erro ao carregar dados do Pró-labore:', err);
        alert('Falha ao carregar dados de Pró-labore deste sócio.');
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
 */
function renderExpensesTable(list) {
    const tbody = document.querySelector('#prolabore-expenses-table tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum gasto ou despesa lançado para este sócio neste mês.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => {
        const dateBR = item.transaction_date ? formatDateBR(item.transaction_date) : '-';
        const installmentText = (item.installment && item.total_installments) 
            ? `${item.installment}/${item.total_installments}` 
            : '-';
            
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
                    await loadProlaboreData(currentPartnerId, monthSelect.value);
                } catch (err) {
                    alert('Erro ao excluir lançamento: ' + err.message);
                }
            }
        };
    });
}

/**
 * Renderiza a tabela de recebíveis e receitas
 */
function renderReceivablesTable(list) {
    const tbody = document.querySelector('#prolabore-receivables-table tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum valor a receber ou receita lançado para este sócio neste mês.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => {
        const dateBR = item.transaction_date ? formatDateBR(item.transaction_date) : '-';
        const checkedAttribute = item.is_received ? 'checked' : '';
        
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
                    await loadProlaboreData(currentPartnerId, monthSelect.value);
                } catch (err) {
                    alert('Erro ao alterar status recebido: ' + err.message);
                    chk.checked = !chk.checked;
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
                    await loadProlaboreData(currentPartnerId, monthSelect.value);
                } catch (err) {
                    alert('Erro ao excluir lançamento: ' + err.message);
                }
            }
        };
    });
}

/**
 * Converte data da competência (YYYY-MM) para formato amigável (Mês de Ano)
 * @param {string} monthStr - Ex: '2026-07'
 * @returns {string} Ex: 'Julho de 2026'
 */
function getHumanMonthYear(monthStr) {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthIdx = parseInt(month, 10) - 1;
    return `${monthNames[monthIdx]} de ${year}`;
}

/**
 * Prepara o HTML e dispara a impressão do relatório em PDF
 */
function handleProlaborePrint() {
    console.log('Clique em Salvar em PDF');
    const partnerSelect = document.getElementById('prolabore-partner-select');
    const monthInput = document.getElementById('prolabore-month-select');

    if (!partnerSelect || !monthInput || !monthInput.value) {
        alert('Selecione um sócio e uma competência para gerar o PDF.');
        return;
    }

    if (!currentPeriod) {
        alert('Nenhum dado de período carregado.');
        return;
    }

    const partnerName = partnerSelect.options[partnerSelect.selectedIndex]?.text?.trim() || 'Socio';
    const referenceMonth = monthInput.value || '';

    const safePartnerName = partnerName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const safeMonth = referenceMonth.replace('-', '_');
    const originalTitle = document.title;

    document.title = `Prolabore_${safePartnerName}_${safeMonth}`;

    // Filtrar e calcular diretamente das variáveis de estado carregadas (currentTransactions / currentPeriod)
    const expenses = currentTransactions.filter(item => item.type === 'expense' || item.type === 'tax' || item.type === 'withdraw');
    const receivables = currentTransactions.filter(item => item.type === 'receivable' || item.type === 'income');

    // Ordenar ambas as listas por data
    expenses.sort((a, b) => new Date(a.transaction_date || '') - new Date(b.transaction_date || ''));
    receivables.sort((a, b) => new Date(a.transaction_date || '') - new Date(b.transaction_date || ''));

    const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const totalReceived = receivables.filter(item => item.is_received === true).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const totalPending = receivables.filter(item => item.is_received !== true).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const grossAmount = parseFloat(currentPeriod.gross_amount || 0);
    const netAmount = grossAmount - totalExpenses + totalReceived;

    const totalReceivablesGeral = totalReceived + totalPending;

    // Gerar mapeamento amigável de tipos para exibição
    const typeLabels = {
        expense: 'Despesa',
        tax: 'Imposto',
        withdraw: 'Retirada Extra',
        receivable: 'A Receber',
        income: 'Receita'
    };

    // Montar as linhas de despesas
    let expensesRowsHtml = '';
    if (expenses.length === 0) {
        expensesRowsHtml = `<tr><td colspan="7" style="text-align: center; color: #555; padding: 10px;">Nenhuma despesa lançada para este sócio neste mês.</td></tr>`;
    } else {
        expensesRowsHtml = expenses.map(item => {
            const dateStr = item.transaction_date ? formatDateBR(item.transaction_date) : '-';
            const typeLabel = typeLabels[item.type] || item.type;
            const installmentText = (item.installment && item.total_installments) 
                ? `${item.installment}/${item.total_installments}` 
                : '-';
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${typeLabel}</td>
                    <td>${item.category || '-'}</td>
                    <td>${item.supplier_name || '-'}</td>
                    <td>${item.description || '-'}</td>
                    <td>${installmentText}</td>
                    <td style="font-weight: 600; color: #ef4444; text-align: right;">${formatCurrency(item.amount)}</td>
                </tr>
            `;
        }).join('');
    }

    // Montar as linhas de receitas e recebíveis
    let receivablesRowsHtml = '';
    if (receivables.length === 0) {
        receivablesRowsHtml = `<tr><td colspan="6" style="text-align: center; color: #555; padding: 10px;">Nenhuma receita ou valor a receber lançado para este sócio neste mês.</td></tr>`;
    } else {
        receivablesRowsHtml = receivables.map(item => {
            const dateStr = item.transaction_date ? formatDateBR(item.transaction_date) : '-';
            const typeLabel = typeLabels[item.type] || item.type;
            const statusLabel = item.is_received ? 'Recebido' : 'Pendente';
            const statusStyle = item.is_received ? 'color: #10b981; font-weight: 600;' : 'color: #d97706; font-weight: 600;';
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${typeLabel}</td>
                    <td>${item.category || '-'}</td>
                    <td>${item.description || '-'}</td>
                    <td style="${statusStyle}">${statusLabel}</td>
                    <td style="font-weight: 600; color: #10b981; text-align: right;">${formatCurrency(item.amount)}</td>
                </tr>
            `;
        }).join('');
    }

    const competencyLabel = getHumanMonthYear(referenceMonth);
    const todayStr = new Date().toLocaleDateString('pt-BR');

    const printReportContainer = document.getElementById('prolabore-print-report');
    if (printReportContainer) {
        printReportContainer.innerHTML = `
            <!-- CABEÇALHO DO RELATÓRIO EM DUAS COLUNAS -->
            <div class="print-header">
                <div class="print-header-left">
                    <h1 style="font-family: Outfit, Arial, sans-serif; font-weight: 700; margin: 0 0 2mm; font-size: 16px;">ESTAMPARIA JL LTDA - ME</h1>
                    <p style="margin: 0;">CNPJ: 25.140.946/0001-84</p>
                    <p style="margin: 0;">Sarandi-PR</p>
                </div>
                <div class="print-header-right">
                    <h1 style="font-family: Outfit, Arial, sans-serif; font-weight: 700; margin: 0 0 2mm; font-size: 16px;">RELATÓRIO DE PRÓ-LABORE</h1>
                    <p style="margin: 0;"><strong>Sócio:</strong> <span>${partnerName.replace(/\s*\(inativo\)\s*/i, '')}</span></p>
                    <p style="margin: 0;"><strong>Competência:</strong> <span>${competencyLabel}</span></p>
                    <p style="margin: 0;"><strong>Data de Emissão:</strong> <span>${todayStr}</span></p>
                </div>
            </div>

            <!-- RESUMO FINANCEIRO EM TABELA COMPACTA -->
            <div class="print-section financial-summary">
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Descrição</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Retirada bruta</td>
                            <td>${formatCurrency(grossAmount)}</td>
                        </tr>
                        <tr>
                            <td>Total de despesas</td>
                            <td>${formatCurrency(totalExpenses)}</td>
                        </tr>
                        <tr>
                            <td>Total de valores a receber pendentes</td>
                            <td>${formatCurrency(totalPending)}</td>
                        </tr>
                        <tr>
                            <td>Total de receitas recebidas</td>
                            <td>${formatCurrency(totalReceived)}</td>
                        </tr>
                        <tr class="net-row">
                            <td>Saldo líquido</td>
                            <td>${formatCurrency(netAmount)}</td>
                        </tr>
                    </tbody>
                </table>
                <p style="font-size: 7.5px; color: #555; font-style: italic; margin-top: 1mm; margin-bottom: 2mm;">
                    Fórmula de cálculo: Saldo líquido = Retirada bruta - Despesas + Receitas recebidas
                </p>
            </div>

            <!-- TABELA GASTOS E DESPESAS -->
            <div class="print-section">
                <h2>Despesas</h2>
                <table class="expenses-table">
                    <colgroup>
                        <col>
                        <col>
                        <col>
                        <col>
                        <col>
                        <col>
                        <col>
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Tipo</th>
                            <th>Categoria</th>
                            <th>Fornecedor</th>
                            <th>Descrição</th>
                            <th>Parcela</th>
                            <th style="text-align: right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expensesRowsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6" style="text-align: right; font-weight: bold; text-transform: uppercase;">Total de despesas</td>
                            <td style="text-align: right; font-weight: bold; color: #ef4444;">${formatCurrency(totalExpenses)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- TABELA RECEITAS E VALORES A RECEBER -->
            <div class="print-section">
                <h2>Receitas e Valores a Receber</h2>
                <table class="receivables-table">
                    <colgroup>
                        <col>
                        <col>
                        <col>
                        <col>
                        <col>
                        <col>
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Tipo</th>
                            <th>Categoria</th>
                            <th>Descrição</th>
                            <th>Situação</th>
                            <th style="text-align: right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${receivablesRowsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" style="text-align: right; font-weight: bold; text-transform: uppercase;">Total recebido</td>
                            <td style="text-align: right; font-weight: bold; color: #10b981;">${formatCurrency(totalReceived)}</td>
                        </tr>
                        <tr>
                            <td colspan="5" style="text-align: right; font-weight: bold; text-transform: uppercase;">Total pendente</td>
                            <td style="text-align: right; font-weight: bold; color: #d97706;">${formatCurrency(totalPending)}</td>
                        </tr>
                        <tr style="background-color: #f3f4f6;">
                            <td colspan="5" style="text-align: right; font-weight: bold; text-transform: uppercase;">Total geral</td>
                            <td style="text-align: right; font-weight: bold;">${formatCurrency(totalReceivablesGeral)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- RODAPÉ SIMPLES -->
            <div class="print-footer">
                <div>ESTAMPARIA JL LTDA - ME | CNPJ: 25.140.946/0001-84</div>
                <div>Emissão em: ${todayStr} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
    }

    // Ativar a classe de impressão de Pró-labore no body
    document.body.classList.add('printing-prolabore');

    const restoreTitle = () => {
        document.title = originalTitle;
        document.body.classList.remove('printing-prolabore');
        if (printReportContainer) printReportContainer.innerHTML = '';
        window.removeEventListener('afterprint', restoreTitle);
    };

    window.addEventListener('afterprint', restoreTitle);

    // Garantir renderização completa dos frames antes de abrir janela de impressão
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.print();
        });
    });
}
