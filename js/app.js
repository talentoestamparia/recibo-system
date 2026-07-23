/**
 * Sistema de Recibos de Pagamento - SPA App Core
 */
import * as db from './db.js?v=2';
import { applyThemeSettings, initSettings } from './configuracoes.js?v=2';
import { initDashboard, checkExcelImport } from './dashboard.js?v=2';
import { initEmployees } from './funcionarios.js?v=2';
import { initHistory } from './historico.js?v=2';
import { initVacations } from './ferias.js?v=2';
import { initReceipt } from './recibo.js?v=2';

import { supabase, login, logout, onAuthStateChange } from './supabase.js?v=2';

// Mapeamento de inicializadores de view
const VIEW_INITIALIZERS = {
    dashboard: () => initDashboard(navigateToView),
    recibo: () => initReceipt(), // Inicializa vazio por padrão (edit/duplicar usam ouvintes customizados)
    funcionarios: () => initEmployees(),
    historico: () => initHistory(navigateToView),
    ferias: () => initVacations(),
    configuracoes: () => initSettings()
};

let currentView = 'dashboard';
let isAppInitialized = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Configurar ação do botão Sair (logout)
    const logoutBtn = document.getElementById('sidebar-btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            await logout();
        };
    }

    // Diferenciar produção e desenvolvimento
    const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && location.protocol !== 'file:';

    // Se o cliente Supabase não estiver inicializado (ex: sem credenciais)
    if (!supabase) {
        if (isProduction) {
            console.error('[SUPABASE ERROR] configuração ausente');
            document.getElementById('supabase-error-container').classList.remove('d-none');
            document.getElementById('login-container').classList.add('d-none');
            document.getElementById('app-container').classList.add('d-none');
        } else {
            console.log('Supabase não conectado. Executando em modo LocalStorage offline.');
            document.getElementById('login-container').classList.add('d-none');
            document.getElementById('app-container').classList.remove('d-none');
            await initializeApp();
        }
        return;
    }
    
    // Configurar comportamento do formulário de login
    const loginForm = document.getElementById('login-form');
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorAlert = document.getElementById('login-error-alert');
        const spinner = document.getElementById('login-spinner');
        const submitBtn = document.getElementById('login-btn-submit');
        
        errorAlert.classList.add('d-none');
        spinner.classList.remove('d-none');
        submitBtn.disabled = true;
        
        const { error } = await login(email, password);
        
        spinner.classList.add('d-none');
        submitBtn.disabled = false;
        
        if (error) {
            errorAlert.innerText = 'E-mail ou senha incorretos.';
            errorAlert.classList.remove('d-none');
        }
    };
    
    // Observar estado da autenticação
    onAuthStateChange(async (event, session) => {
        if (session) {
            console.log('[AUTH] sessão encontrada');
            document.getElementById('login-container').classList.add('d-none');
            document.getElementById('supabase-error-container').classList.add('d-none');
            document.getElementById('app-container').classList.remove('d-none');
            
            if (!isAppInitialized) {
                await initializeApp();
            }
        } else {
            console.log('[AUTH] nenhuma sessão');
            document.getElementById('app-container').classList.add('d-none');
            document.getElementById('supabase-error-container').classList.add('d-none');
            document.getElementById('login-container').classList.remove('d-none');
            
            // Logs temporários de depuração
            console.log('[LOGIN] exibindo tela');
            console.log(document.getElementById('login-container'));
            console.log(getComputedStyle(document.getElementById('login-container')).display);
            console.log(document.getElementById('login-container').className);
        }

        if (event === 'SIGNED_OUT') {
            console.log('[AUTH] logout concluído');
        }
    });
});

async function initializeApp() {
    isAppInitialized = true;
    
    // 1. Carregar e aplicar configurações iniciais de tema
    const settings = await db.getSettings();
    applyThemeSettings(settings);
    
    // 2. Configurar cliques no menu lateral
    setupSidebarNavigation();
    
    // 3. Ouvir eventos globais de alteração de configurações
    window.addEventListener('settingsChanged', (e) => {
        applyThemeSettings(e.detail);
    });
    
    // 4. Tratar Roteamento Inicial (hash ou padrão)
    handleInitialRouting();
    
    // 5. Verificar importação pendente do Excel
    checkExcelImport(navigateToView);
}

function setupSidebarNavigation() {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.dataset.view;
            navigateToView(viewId);
            
            // Alterar hash sem disparar navegação dupla
            window.location.hash = viewId;
        });
    });
}

function handleInitialRouting() {
    let hash = window.location.hash.replace('#', '');
    if (hash && VIEW_INITIALIZERS[hash]) {
        navigateToView(hash);
    } else {
        navigateToView('dashboard');
    }
    
    // Escutar mudança de hash (ex: botões voltar/avançar do navegador)
    window.onhashchange = () => {
        const newHash = window.location.hash.replace('#', '');
        if (newHash && VIEW_INITIALIZERS[newHash] && newHash !== currentView) {
            navigateToView(newHash);
        }
    };
}

/**
 * Navega para uma determinada tela (View Panel)
 * @param {string} viewId 
 */
export function navigateToView(viewId) {
    if (!VIEW_INITIALIZERS[viewId]) return;
    
    currentView = viewId;
    
    // 1. Alternar classe ativa nos painéis do DOM
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const targetPanel = document.getElementById(`view-${viewId}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
    
    // 2. Alternar classe ativa nos itens do menu
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        if (item.dataset.view === viewId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // 3. Chamar o inicializador específico da tela
    VIEW_INITIALIZERS[viewId]();
    
    // 4. Scroll para o topo
    window.scrollTo(0, 0);
}
