/**
 * Sistema de Recibos de Pagamento - SPA App Core
 */
import * as db from './db.js?v=11';
import { applyThemeSettings, initSettings } from './configuracoes.js?v=11';
import { initDashboard, checkExcelImport } from './dashboard.js?v=11';
import { initEmployees } from './funcionarios.js?v=11';
import { initHistory } from './historico.js?v=11';
import { initVacations } from './ferias.js?v=11';
import { initReceipt } from './recibo.js?v=11';

import { supabase, login, logout, getSession, onAuthStateChange } from './supabase.js?v=11';

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

function hideAllScreens() {
  document.getElementById('login-container')?.classList.add('d-none');
  if (document.getElementById('login-container')) {
    document.getElementById('login-container').style.display = 'none';
  }
  document.getElementById('recovery-container')?.classList.add('d-none');
  if (document.getElementById('recovery-container')) {
    document.getElementById('recovery-container').style.display = 'none';
  }
  document.getElementById('app-container')?.classList.add('d-none');
  document.getElementById('supabase-error-container')?.classList.add('d-none');
  if (document.getElementById('supabase-error-container')) {
    document.getElementById('supabase-error-container').style.display = 'none';
  }
}

function showLoginScreen() {
  hideAllScreens();
  const loginContainer = document.getElementById('login-container');
  if (!loginContainer) {
    console.error('[LOGIN ERROR] container não encontrado');
    return;
  }

  loginContainer.classList.remove('d-none');
  loginContainer.style.display = 'flex';
  
  // Garantir que inicie com o bloco de login ativo e bloco de forgot oculto
  document.getElementById('login-block')?.classList.remove('d-none');
  document.getElementById('forgot-block')?.classList.add('d-none');
  
  console.log('[LOGIN] exibindo tela');
}

function showRecoveryScreen() {
  hideAllScreens();
  const recovery = document.getElementById('recovery-container');
  if (recovery) {
    recovery.classList.remove('d-none');
    recovery.style.display = 'flex';
    console.log('[RECOVERY] exibindo tela');
  }
}

function showApplicationScreen() {
  hideAllScreens();
  const app = document.getElementById('app-container');
  if (!app) {
    console.error('[APP ERROR] container não encontrado');
    return;
  }

  app.classList.remove('d-none');
}

function showConfigurationErrorScreen() {
  hideAllScreens();
  const errorScreen = document.getElementById('supabase-error-container');
  if (errorScreen) {
    errorScreen.classList.remove('d-none');
    errorScreen.style.display = 'flex';
  }
}

function initializeAppOnce() {
  if (!isAppInitialized) {
    initializeApp();
  }
}

async function initializeAuthentication() {
  try {
    hideAllScreens();

    // Configurar ação do botão Sair (logout)
    const logoutBtn = document.getElementById('sidebar-btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            await logout();
        };
    }

    const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && location.protocol !== 'file:';

    if (!supabase) {
      if (isProduction) {
        console.error('[SUPABASE ERROR] configuração ausente');
        showConfigurationErrorScreen();
      } else {
        console.log('Supabase não conectado. Executando em modo LocalStorage offline.');
        showApplicationScreen();
        initializeAppOnce();
      }
      return;
    }

    // Alternar entre login e solicitação de recuperação de senha
    const forgotLink = document.getElementById('login-forgot-link');
    const backLink = document.getElementById('forgot-back-link');
    const loginBlock = document.getElementById('login-block');
    const forgotBlock = document.getElementById('forgot-block');
    
    if (forgotLink && backLink && loginBlock && forgotBlock) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            loginBlock.classList.add('d-none');
            forgotBlock.classList.remove('d-none');
            // Resetar mensagens anteriores
            document.getElementById('forgot-error-alert')?.classList.add('d-none');
            document.getElementById('forgot-success-alert')?.classList.add('d-none');
        };
        
        backLink.onclick = (e) => {
            e.preventDefault();
            forgotBlock.classList.add('d-none');
            loginBlock.classList.remove('d-none');
            document.getElementById('login-error-alert')?.classList.add('d-none');
        };
    }

    // Configurar comportamento do formulário de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
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
    }

    // Configurar comportamento do formulário de envio de link de recuperação
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const errorAlert = document.getElementById('forgot-error-alert');
            const successAlert = document.getElementById('forgot-success-alert');
            const spinner = document.getElementById('forgot-spinner');
            const submitBtn = document.getElementById('forgot-btn-submit');
            
            errorAlert.classList.add('d-none');
            successAlert.classList.add('d-none');
            spinner.classList.remove('d-none');
            submitBtn.disabled = true;
            
            const { resetPassword } = await import('./supabase.js?v=11');
            const { error } = await resetPassword(email);
            
            spinner.classList.add('d-none');
            submitBtn.disabled = false;
            
            if (error) {
                errorAlert.innerText = error.message || 'Erro ao solicitar recuperação.';
                errorAlert.classList.remove('d-none');
            } else {
                successAlert.classList.remove('d-none');
                forgotForm.reset();
            }
        };
    }

    // Configurar comportamento do formulário de redefinição de senha
    const recoveryForm = document.getElementById('recovery-form');
    if (recoveryForm) {
        recoveryForm.onsubmit = async (e) => {
            e.preventDefault();
            const password = document.getElementById('recovery-password').value;
            const confirmPassword = document.getElementById('recovery-password-confirm').value;
            const errorAlert = document.getElementById('recovery-error-alert');
            const successAlert = document.getElementById('recovery-success-alert');
            const spinner = document.getElementById('recovery-spinner');
            const submitBtn = document.getElementById('recovery-btn-submit');
            
            errorAlert.classList.add('d-none');
            successAlert.classList.add('d-none');
            
            if (password.length < 8) {
                errorAlert.innerText = 'A senha deve ter no mínimo 8 caracteres.';
                errorAlert.classList.remove('d-none');
                return;
            }
            
            if (password !== confirmPassword) {
                errorAlert.innerText = 'As senhas não coincidem.';
                errorAlert.classList.remove('d-none');
                return;
            }
            
            spinner.classList.remove('d-none');
            submitBtn.disabled = true;
            
            const { updatePassword } = await import('./supabase.js?v=11');
            const { error } = await updatePassword(password);
            
            spinner.classList.add('d-none');
            submitBtn.disabled = false;
            
            if (error) {
                errorAlert.innerText = error.message || 'O link de recuperação está inválido ou expirado.';
                errorAlert.classList.remove('d-none');
            } else {
                successAlert.classList.remove('d-none');
                setTimeout(async () => {
                    await logout();
                    // Limpar parâmetros de busca da URL
                    const cleanUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                    showLoginScreen();
                }, 3000);
            }
        };
    }

    // Conectar o listener
    onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[AUTH] modo recovery detectado');
        showRecoveryScreen();
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'recovery') {
        showRecoveryScreen();
        return;
      }

      if (session) {
        console.log('[AUTH] sessão encontrada');
        showApplicationScreen();
        initializeAppOnce();
      } else {
        console.log('[AUTH] nenhuma sessão');
        showLoginScreen();
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('[AUTH] logout concluído');
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'recovery') {
      console.log('[AUTH] fluxo de recuperação ativo via URL');
      showRecoveryScreen();
      return;
    }

    const session = await getSession();

    if (!session) {
      console.log('[AUTH] nenhuma sessão');
      showLoginScreen();
      return;
    }

    console.log('[AUTH] sessão encontrada');
    showApplicationScreen();
    initializeAppOnce();
  } catch (error) {
    console.error('[AUTH INIT ERROR]', error?.message || error);
    showConfigurationErrorScreen();
  }
}

document.addEventListener('DOMContentLoaded', initializeAuthentication);

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
