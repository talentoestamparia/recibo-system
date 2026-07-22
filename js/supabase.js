/**
 * Integração Supabase - Cliente Centralizado
 */
import { env } from './env.js?v=2';

const supabaseUrl = env.SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;

// Verifica se as credenciais são válidas e não apenas placeholders de exemplo
const hasValidCredentials = 
    supabaseUrl && 
    supabaseAnonKey && 
    !supabaseUrl.includes('placeholder') && 
    supabaseAnonKey !== 'placeholder-anon-key';

// Inicializa o cliente do Supabase
export const supabase = (window.supabase && hasValidCredentials)
    ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * Verifica se a conexão com o Supabase está ativa e funcional
 * @returns {Promise<boolean>}
 */
export async function isSupabaseConnected() {
    if (!supabase) {
        console.log('Cliente do Supabase não inicializado (credenciais em falta ou inválidas).');
        return false;
    }
    
    try {
        // Tenta fazer uma consulta simples na tabela de funcionários
        const { error } = await supabase.from('employees').select('id').limit(1);
        if (error) {
            // Se for erro de autenticação (ex: JWT expirado ou RLS bloqueando), a conexão está ativa mas sem login, o que é válido
            if (error.code === 'PGRST301' || error.status === 401) {
                console.log('Supabase conectado com sucesso (requer autenticação).');
                return true;
            }
            console.warn('Supabase respondeu com erro ao testar conexão:', error.message);
            return false;
        }
        console.log('Supabase conectado e pronto para uso!');
        return true;
    } catch (err) {
        console.error('Erro ao verificar conexão do Supabase:', err);
        return false;
    }
}
