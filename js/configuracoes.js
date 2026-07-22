/**
 * Sistema de Recibos de Pagamento - Controller de Configurações
 */
import * as db from './db.js';
import * as utils from './utils.js';

let currentLogoBase64 = '';

export async function initSettings() {
    const settings = await db.getSettings();
    
    // Preencher campos
    document.getElementById('settings-empresa-nome').value = settings.empresa_nome || '';
    document.getElementById('settings-empresa-cnpj').value = settings.empresa_cnpj || '';
    document.getElementById('settings-empresa-cidade').value = settings.empresa_cidade || '';
    document.getElementById('settings-cor-picker').value = settings.cor_principal || '#1e3f20';
    document.getElementById('settings-cor-text').value = settings.cor_principal || '#1e3f20';
    
    currentLogoBase64 = settings.empresa_logo || '';
    updateLogoUI();
    
    setupEventListeners();
}

function setupEventListeners() {
    const form = document.getElementById('settings-form');
    form.onsubmit = handleSaveSettings;
    
    // Máscara CNPJ
    const cnpjInput = document.getElementById('settings-empresa-cnpj');
    cnpjInput.oninput = (e) => {
        e.target.value = utils.maskCNPJ(e.target.value);
    };
    
    // Sincronizar Color Picker e Color Text
    const colorPicker = document.getElementById('settings-cor-picker');
    const colorText = document.getElementById('settings-cor-text');
    
    colorPicker.oninput = (e) => {
        colorText.value = e.target.value;
    };
    
    colorText.oninput = (e) => {
        let val = e.target.value;
        // Adicionar hash se não tiver e validar formato
        if (!val.startsWith('#')) {
            val = '#' + val;
        }
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            colorPicker.value = val;
            e.target.value = val;
        }
    };
    
    // Logo Upload
    const logoPreview = document.getElementById('settings-logo-preview');
    const logoFileInput = document.getElementById('settings-logo-file');
    const logoRemoveBtn = document.getElementById('settings-logo-remove-btn');
    
    logoPreview.onclick = () => {
        logoFileInput.click();
    };
    
    logoFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            currentLogoBase64 = event.target.result;
            updateLogoUI();
        };
        reader.readAsDataURL(file);
    };
    
    logoRemoveBtn.onclick = (e) => {
        e.stopPropagation(); // Evitar disparar click do preview
        currentLogoBase64 = '';
        logoFileInput.value = '';
        updateLogoUI();
    };
}

function updateLogoUI() {
    const placeholder = document.getElementById('settings-logo-placeholder');
    const img = document.getElementById('settings-logo-img');
    const removeBtn = document.getElementById('settings-logo-remove-btn');
    
    if (currentLogoBase64) {
        placeholder.style.display = 'none';
        img.src = currentLogoBase64;
        img.style.display = 'block';
        removeBtn.style.display = 'block';
    } else {
        placeholder.style.display = 'flex';
        img.src = '';
        img.style.display = 'none';
        removeBtn.style.display = 'none';
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    const empresa_nome = document.getElementById('settings-empresa-nome').value;
    const empresa_cnpj = document.getElementById('settings-empresa-cnpj').value;
    const empresa_cidade = document.getElementById('settings-empresa-cidade').value;
    const cor_principal = document.getElementById('settings-cor-picker').value;
    
    const settings = {
        empresa_nome,
        empresa_cnpj,
        empresa_cidade,
        empresa_logo: currentLogoBase64,
        cor_principal
    };
    
    await db.saveSettings(settings);
    alert('Configurações salvas com sucesso! As alterações serão aplicadas em todo o sistema.');
}

/**
 * Aplica as configurações do tema (cor principal, marca, etc.) no DOM global
 */
export function applyThemeSettings(settings) {
    if (!settings) return;
    
    const root = document.documentElement;
    
    // Definir cor principal
    root.style.setProperty('--primary-color', settings.cor_principal);
    
    // Gerar uma cor de hover ligeiramente mais escura (simples escurecimento de HEX)
    const hoverColor = darkenColor(settings.cor_principal, 20);
    root.style.setProperty('--primary-hover', hoverColor);
    
    // Gerar cor clara com opacidade
    const lightColor = settings.cor_principal + '1a'; // 10% opacidade em HEX
    root.style.setProperty('--primary-light', lightColor);
    
    // Atualizar marca no sidebar
    const brandName = document.getElementById('sidebar-brand-name');
    if (brandName) {
        brandName.innerText = settings.empresa_nome.split(' ')[0] || 'SISTEMA';
    }
    
    const brandIcon = document.querySelector('.brand-icon');
    if (brandIcon) {
        if (settings.empresa_logo) {
            brandIcon.innerHTML = `<img src="${settings.empresa_logo}" style="width:100%; height:100%; object-fit:contain; border-radius:inherit;">`;
            brandIcon.style.background = 'transparent';
        } else {
            brandIcon.innerHTML = settings.empresa_nome.charAt(0);
            brandIcon.style.background = settings.cor_principal;
        }
    }
}

// Auxiliar para escurecer cores hexadecimais
function darkenColor(hex, percent) {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    r = Math.max(0, Math.min(255, r - (r * percent / 100)));
    g = Math.max(0, Math.min(255, g - (g * percent / 100)));
    b = Math.max(0, Math.min(255, b - (b * percent / 100)));
    
    const rHex = Math.round(r).toString(16).padStart(2, '0');
    const gHex = Math.round(g).toString(16).padStart(2, '0');
    const bHex = Math.round(b).toString(16).padStart(2, '0');
    
    return `#${rHex}${gHex}${bHex}`;
}
