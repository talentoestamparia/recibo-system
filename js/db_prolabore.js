/**
 * Camada de Acesso a Dados do Supabase para o Módulo de Pró-labore (Multi-sócio)
 */
import { supabase } from './supabase.js?v=12';

/**
 * Cria ou busca os sócios padrão iniciais se a lista estiver vazia
 * @returns {Promise<Array>} Lista de sócios
 */
export async function getOrCreateDefaultPartners() {
    if (!supabase) return [];
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    const { data, error } = await supabase
        .from('prolabore_partners')
        .select('*')
        .eq('user_id', userId)
        .order('name');

    if (error) {
        throw new Error(error.message);
    }

    if (data.length > 0) return data;

    // Se não houver sócios cadastrados, cria os dois iniciais exigidos
    const { data: inserted, error: insertError } = await supabase
        .from('prolabore_partners')
        .insert([
            { user_id: userId, name: 'Juliano Henrique da Silva', cpf: '', is_active: true },
            { user_id: userId, name: 'Luan Henrique da Silva', cpf: '', is_active: true }
        ])
        .select();

    if (insertError) {
        throw new Error(insertError.message);
    }
    
    // Buscar novamente ordenado por nome
    const { data: refetched } = await supabase
        .from('prolabore_partners')
        .select('*')
        .eq('user_id', userId)
        .order('name');
        
    return refetched || inserted;
}

/**
 * Busca todos os sócios cadastrados
 * @returns {Promise<Array>} Lista de sócios
 */
export async function getProlaborePartners() {
    if (!supabase) return [];
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    const { data, error } = await supabase
        .from('prolabore_partners')
        .select('*')
        .eq('user_id', userId)
        .order('name');

    if (error) {
        throw new Error(error.message);
    }
    return data;
}

/**
 * Salva (cria ou edita) um sócio
 * @param {Object} partnerData - Dados do sócio
 * @returns {Promise<Object>} Sócio salvo
 */
export async function saveProlaborePartner(partnerData) {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    const payload = {
        ...partnerData,
        user_id: userId
    };

    if (payload.id) {
        const { data, error } = await supabase
            .from('prolabore_partners')
            .update(payload)
            .eq('id', payload.id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    } else {
        const { data, error } = await supabase
            .from('prolabore_partners')
            .insert(payload)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }
}

/**
 * Exclui um sócio se ele não possuir nenhum período de pró-labore vinculado
 * @param {string} partnerId - ID do sócio
 * @returns {Promise<boolean>}
 */
export async function deleteProlaborePartner(partnerId) {
    if (!supabase) return false;

    // Verificar se já possui algum período de pró-labore cadastrado
    const { count, error: countError } = await supabase
        .from('prolabore_periods')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', partnerId);

    if (countError) {
        throw new Error(countError.message);
    }

    if (count && count > 0) {
        throw new Error('Não é possível excluir o sócio pois ele possui períodos de pró-labore vinculados. Por favor, apenas desative-o.');
    }

    const { error } = await supabase
        .from('prolabore_partners')
        .delete()
        .eq('id', partnerId);

    if (error) {
        throw new Error(error.message);
    }
    return true;
}

/**
 * Busca ou cria o período de pró-labore para um sócio e mês de referência
 * @param {string} partnerId - ID do sócio
 * @param {string} monthStr - Mês de referência (ex: '2026-07')
 * @returns {Promise<Object>} Período de pró-labore
 */
export async function getOrCreateProlaborePeriod(partnerId, monthStr) {
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
        .eq('partner_id', partnerId)
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
            partner_id: partnerId,
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
 * Copia todas as transações de um período anterior para o atual para o mesmo sócio
 * @param {string} currentPeriodId - ID do período atual
 * @param {string} partnerId - ID do sócio atual
 * @param {string} previousMonthStr - Mês de referência anterior (ex: '2026-06')
 * @returns {Promise<boolean>} Retorna true se houver sucesso na cópia
 */
export async function copyPreviousMonthTransactions(currentPeriodId, partnerId, previousMonthStr) {
    if (!supabase) return false;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Usuário não autenticado.');

    const prevDateStr = previousMonthStr.substring(0, 7) + '-01';

    // Buscar período anterior DO MESMO SÓCIO
    const { data: prevPeriod, error: periodError } = await supabase
        .from('prolabore_periods')
        .select('id')
        .eq('partner_id', partnerId)
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
