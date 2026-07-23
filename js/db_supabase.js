/**
 * Camada de Acesso a Dados do Supabase (employees)
 */
import { supabase } from './supabase.js?v=2';

/**
 * Busca a lista de funcionários cadastrados no Supabase para o usuário logado
 * @returns {Promise<Array>}
 */
export async function fetchEmployeesFromSupabase() {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');
        
    if (error) {
        throw new Error(error.message);
    }
    
    return data;
}

/**
 * Insere um novo funcionário no Supabase
 * @param {Object} remoteData 
 * @returns {Promise<Object>}
 */
export async function insertEmployeeToSupabase(remoteData) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('employees')
        .insert(remoteData)
        .select()
        .single();
        
    if (error) {
        throw new Error(error.message);
    }
    
    return data;
}

/**
 * Atualiza um funcionário existente no Supabase
 * @param {string} id 
 * @param {Object} remoteData 
 * @returns {Promise<Object>}
 */
export async function updateEmployeeInSupabase(id, remoteData) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('employees')
        .update(remoteData)
        .eq('id', id)
        .select()
        .single();
        
    if (error) {
        throw new Error(error.message);
    }
    
    return data;
}

/**
 * Exclui um funcionário no Supabase
 * @param {string} id 
 * @returns {Promise<boolean>}
 */
export async function deleteEmployeeFromSupabase(id) {
    if (!supabase) return false;
    
    const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);
        
    if (error) {
        throw new Error(error.message);
    }
    
    return true;
}
