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

document.addEventListener('DOMContentLoaded', async () => {
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
});

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
