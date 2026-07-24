/**
 * Camada de Acesso a Dados do Supabase para o Módulo de Pró-labore
 */
import { supabase } from './supabase.js?v=11';

/**
 * Busca ou cria o período de pró-labore para um determinado mês de referência
 * @param {string} monthStr - Mês de referência (ex: '2026-07' ou '2026-07-01')
 * @returns {Promise<Object>} Período de pró-labore
 */
export async function getOrCreateProlaborePeriod(monthStr) {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    // Garantir o formato YYYY-MM-01
    const dateStr = monthStr.substring(0, 7) + '-01';

    // Tentar buscar primeiro
    const { data, error } = await supabase
        .from('prolabore_periods')
        .select('*')
        .eq('reference_month', dateStr)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (data) return data;

    // Criar se não existir
    const { data: newPeriod, error: insertError } = await supabase
        .from('prolabore_periods')
        .insert({
            user_id: userId,
            reference_month: dateStr,
            gross_amount: 0
        })
        .select()
        .single();

    if (insertError) {
        throw new Error(insertError.message);
    }
    return newPeriod;
}

/**
 * Atualiza o valor bruto do pró-labore de um período
 * @param {string} periodId - ID do período
 * @param {number} amount - Novo valor bruto
 * @returns {Promise<Object>} Período atualizado
 */
export async function updateProlaboreGrossAmount(periodId, amount) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('prolabore_periods')
        .update({ gross_amount: amount })
        .eq('id', periodId)
        .select()
        .single();

    if (error) {
        throw new Error(error.message);
    }
    return data;
}

/**
 * Busca todas as transações vinculadas a um período
 * @param {string} periodId - ID do período
 * @returns {Promise<Array>} Lista de transações
 */
export async function getProlaboreTransactions(periodId) {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('prolabore_transactions')
        .select('*')
        .eq('period_id', periodId)
        .order('display_order')
        .order('created_at');

    if (error) {
        throw new Error(error.message);
    }
    return data;
}

/**
 * Cria ou edita uma transação de pró-labore
 * @param {Object} transactionData - Dados da transação
 * @returns {Promise<Object>} Transação salva
 */
export async function saveProlaboreTransaction(transactionData) {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    const payload = {
        ...transactionData,
        user_id: userId
    };

    if (payload.id) {
        const { data, error } = await supabase
            .from('prolabore_transactions')
            .update(payload)
            .eq('id', payload.id)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }
        return data;
    } else {
        const { data, error } = await supabase
            .from('prolabore_transactions')
            .insert(payload)
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }
        return data;
    }
}

/**
 * Exclui uma transação
 * @param {string} transactionId - ID da transação
 * @returns {Promise<boolean>}
 */
export async function deleteProlaboreTransaction(transactionId) {
    if (!supabase) return false;
    const { error } = await supabase
        .from('prolabore_transactions')
        .delete()
        .eq('id', transactionId);

    if (error) {
        throw new Error(error.message);
    }
    return true;
}

/**
 * Copia todas as transações de um período anterior para o atual
 * @param {string} currentPeriodId - ID do período atual
 * @param {string} previousMonthStr - Mês de referência anterior (ex: '2026-06')
 * @returns {Promise<boolean>} Retorna true se houver sucesso na cópia
 */
export async function copyPreviousMonthTransactions(currentPeriodId, previousMonthStr) {
    if (!supabase) return false;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    const prevDateStr = previousMonthStr.substring(0, 7) + '-01';

    // Buscar período anterior
    const { data: prevPeriod, error: periodError } = await supabase
        .from('prolabore_periods')
        .select('id')
        .eq('reference_month', prevDateStr)
        .maybeSingle();

    if (periodError) {
        throw new Error(periodError.message);
    }
    if (!prevPeriod) {
        return false;
    }

    // Buscar transações
    const { data: prevTransactions, error: transError } = await supabase
        .from('prolabore_transactions')
        .select('*')
        .eq('period_id', prevPeriod.id);

    if (transError) {
        throw new Error(transError.message);
    }
    if (prevTransactions.length === 0) {
        return false;
    }

    // Inserir as novas
    const newTransactions = prevTransactions.map(t => ({
        user_id: userId,
        period_id: currentPeriodId,
        type: t.type,
        transaction_date: t.transaction_date,
        description: t.description,
        supplier_name: t.supplier_name,
        category: t.category,
        installment: t.installment,
        total_installments: t.total_installments,
        attachment_url: t.attachment_url,
        amount: t.amount,
        is_received: t.is_received,
        display_order: t.display_order
    }));

    const { error: insertError } = await supabase
        .from('prolabore_transactions')
        .insert(newTransactions);

    if (insertError) {
        throw new Error(insertError.message);
    }
    return true;
}
