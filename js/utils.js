/**
 * Sistema de Recibos de Pagamento - Utilitários
 */

/**
 * Formata um número para a moeda brasileira (BRL) com o prefixo R$
 * @param {number} value 
 * @returns {string}
 */
export function formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) {
        value = 0;
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

/**
 * Formata um número para o padrão brasileiro de decimais, sem o prefixo R$
 * @param {number} value 
 * @returns {string}
 */
export function formatNumber(value) {
    if (value === undefined || value === null || isNaN(value)) {
        value = 0;
    }
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Converte uma string formatada em pt-BR de volta para número float
 * @param {string} str 
 * @returns {number}
 */
export function parseCurrency(str) {
    if (!str) return 0;
    // Remove R$, espaços e pontos de milhar, depois substitui a vírgula decimal por ponto
    let cleaned = str.replace(/R\$\s?/g, '')
                     .replace(/\s/g, '')
                     .replace(/\./g, '')
                     .replace(',', '.');
    let val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

/**
 * Formata uma data ISO (yyyy-mm-dd) para o padrão brasileiro (dd/mm/yyyy)
 * @param {string} isoDate 
 * @returns {string}
 */
export function formatDateBR(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Formata uma data no formato brasileiro (dd/mm/yyyy) para o padrão ISO (yyyy-mm-dd)
 * @param {string} brDate 
 * @returns {string}
 */
export function brDateToIso(brDate) {
    if (!brDate) return '';
    const parts = brDate.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/**
 * Aplica máscara de CPF em uma string
 * @param {string} value 
 * @returns {string}
 */
export function maskCPF(value) {
    if (!value) return '';
    return value
        .replace(/\D/g, '') // remove tudo que não for dígito
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .substring(0, 14);
}

/**
 * Aplica máscara de Telefone em uma string
 * @param {string} value 
 * @returns {string}
 */
export function maskPhone(value) {
    if (!value) return '';
    const r = value.replace(/\D/g, '');
    if (r.length > 10) {
        // Celular com 9 dígitos
        return r.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3').substring(0, 15);
    } else if (r.length > 5) {
        // Fixo
        return r.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3').substring(0, 14);
    } else if (r.length > 2) {
        return r.replace(/^(\d{2})(\d*)$/, '($1) $2');
    }
    return r;
}

/**
 * Aplica máscara de CNPJ em uma string
 * @param {string} value 
 * @returns {string}
 */
export function maskCNPJ(value) {
    if (!value) return '';
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .substring(0, 18);
}

/**
 * Calcula a diferença de dias entre uma data e o dia atual
 * @param {string} targetDateIso yyyy-mm-dd
 * @returns {number}
 */
export function getDaysRemaining(targetDateIso) {
    if (!targetDateIso) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateIso);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}
