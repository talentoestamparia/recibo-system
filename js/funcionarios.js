/**
 * Sistema de Recibos de Pagamento - Controller de Funcionários
 */
import * as db from './db.js';
import * as utils from './utils.js';

let employeesList = [];

export async function initEmployees() {
    setupEventListeners();
    await loadEmployees();
}

function setupEventListeners() {
    // Abrir Modal de Novo Funcionário
    document.getElementById('func-btn-add').onclick = () => {
        openModal();
    };
    
    // Fechar Modal
    document.getElementById('modal-funcionario-close').onclick = closeModal;
    document.getElementById('modal-funcionario-cancel').onclick = closeModal;
    
    // Salvar no Modal
    document.getElementById('modal-funcionario-save').onclick = handleSaveEmployee;
    
    // Pesquisa por Nome
    const searchInput = document.getElementById('func-search-input');
    searchInput.oninput = (e) => {
        filterEmployees(e.target.value);
    };
    
    // Máscaras de CPF e Telefone no Form
    const cpfInput = document.getElementById('func-cpf');
    cpfInput.oninput = (e) => {
        e.target.value = utils.maskCPF(e.target.value);
    };
    
    const phoneInput = document.getElementById('func-telefone');
    phoneInput.oninput = (e) => {
        e.target.value = utils.maskPhone(e.target.value);
    };
}

async function loadEmployees() {
    employeesList = await db.getEmployees();
    renderEmployeesTable(employeesList);
}

function renderEmployeesTable(list) {
    const tbody = document.querySelector('#func-table tbody');
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color:var(--text-muted); padding: 30px 0;">
                    Nenhum funcionário encontrado.
                </td>
            </tr>
        `;
        return;
    }
    
    list.forEach(emp => {
        const tr = document.createElement('tr');
        
        let statusClass = 'badge-success';
        let statusText = 'Pendente';
        
        if (emp.ferias_status === 'programada') {
            statusClass = 'badge-info';
            statusText = 'Programada';
        } else if (emp.ferias_status === 'andamento') {
            statusClass = 'badge-warning';
            statusText = 'Em Andamento';
        } else if (emp.ferias_status === 'concluida') {
            statusClass = 'badge-success';
            statusText = 'Concluída';
        } else {
            statusClass = 'badge-danger';
            statusText = 'Pendente';
        }
        
        tr.innerHTML = `
            <td><strong>${emp.nome}</strong></td>
            <td>${emp.cargo}</td>
            <td>${emp.cpf}</td>
            <td>${utils.formatDateBR(emp.data_admissao)}</td>
            <td>${utils.formatCurrency(emp.salario_base)}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary btn-sm btn-edit" data-id="${emp.id}">Editar</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${emp.id}">Excluir</button>
                </div>
            </td>
        `;
        
        // Ação de Editar
        tr.querySelector('.btn-edit').onclick = () => {
            openModal(emp);
        };
        
        // Ação de Excluir
        tr.querySelector('.btn-delete').onclick = async () => {
            if (confirm(`Deseja realmente excluir o funcionário ${emp.nome}?`)) {
                try {
                    await db.deleteEmployee(emp.id);
                    // Disparar evento para atualizar outras telas
                    window.dispatchEvent(new CustomEvent('employeeDeleted', { detail: emp.id }));
                    await loadEmployees();
                } catch (err) {
                    alert(err.message);
                }
            }
        };
        
        tbody.appendChild(tr);
    });
}

function filterEmployees(query) {
    if (!query) {
        renderEmployeesTable(employeesList);
        return;
    }
    const filtered = employeesList.filter(emp => 
        emp.nome.toLowerCase().includes(query.toLowerCase()) || 
        emp.cargo.toLowerCase().includes(query.toLowerCase()) ||
        emp.cpf.includes(query)
    );
    renderEmployeesTable(filtered);
}

function openModal(employee = null) {
    const modal = document.getElementById('modal-funcionario');
    const title = document.getElementById('modal-funcionario-title');
    const form = document.getElementById('form-funcionario');
    
    form.reset();
    document.getElementById('func-id').value = '';
    
    if (employee) {
        title.innerText = 'Editar Funcionário';
        document.getElementById('func-id').value = employee.id;
        document.getElementById('func-nome').value = employee.nome;
        document.getElementById('func-cpf').value = employee.cpf;
        document.getElementById('func-cargo').value = employee.cargo;
        document.getElementById('func-admissao').value = employee.data_admissao || '';
        document.getElementById('func-salario').value = employee.salario_base;
        document.getElementById('func-telefone').value = employee.telefone || '';
        document.getElementById('func-ferias-status').value = employee.ferias_status || 'pendente';
        document.getElementById('func-ferias-prevista').value = employee.ferias_data_prevista || '';
        document.getElementById('func-ferias-dias').value = employee.ferias_dias || 30;
        document.getElementById('func-observacoes').value = employee.observacoes || '';
    } else {
        title.innerText = 'Cadastrar Funcionário';
        document.getElementById('func-ferias-status').value = 'pendente';
        document.getElementById('func-ferias-dias').value = 30;
    }
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('modal-funcionario').classList.remove('active');
}

async function handleSaveEmployee() {
    const form = document.getElementById('form-funcionario');
    if (!form.reportValidity()) return;
    
    const id = document.getElementById('func-id').value;
    const nome = document.getElementById('func-nome').value;
    const cpf = document.getElementById('func-cpf').value;
    const cargo = document.getElementById('func-cargo').value;
    const data_admissao = document.getElementById('func-admissao').value;
    const salario_base = parseFloat(document.getElementById('func-salario').value);
    const telefone = document.getElementById('func-telefone').value;
    const ferias_status = document.getElementById('func-ferias-status').value;
    const ferias_data_prevista = document.getElementById('func-ferias-prevista').value;
    const ferias_dias = parseInt(document.getElementById('func-ferias-dias').value);
    const observacoes = document.getElementById('func-observacoes').value;
    
    const employeeData = {
        nome,
        cpf,
        cargo,
        data_admissao,
        salario_base,
        telefone,
        ferias_status,
        ferias_data_prevista,
        ferias_dias,
        observacoes
    };
    
    if (id) {
        employeeData.id = id;
    }
    
    try {
        await db.saveEmployee(employeeData);
        // Notificar mudança para outras telas (como recibo, dashboard)
        window.dispatchEvent(new CustomEvent('employeeSaved', { detail: employeeData }));
        
        closeModal();
        await loadEmployees();
    } catch (err) {
        alert(err.message);
    }
}
