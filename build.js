import fs from 'fs';
import path from 'path';

// 1. Ler arquivo .env local se existir
let localEnv = {};
if (fs.existsSync('.env')) {
    try {
        const dotenvContent = fs.readFileSync('.env', 'utf8');
        dotenvContent.split('\n').forEach(line => {
            const parts = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (parts) {
                const key = parts[1];
                let value = parts[2] || '';
                value = value.trim().replace(/^['"]|['"]$/g, '');
                localEnv[key] = value;
            }
        });
    } catch (err) {
        console.warn('Erro ao ler arquivo .env local:', err.message);
    }
}

// 2. Aplicar prioridades
const supabaseUrl = process.env.SUPABASE_URL || localEnv.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || localEnv.SUPABASE_ANON_KEY || '';

// 3. Validação no build sem exibir valores sensíveis
console.log('[BUILD] SUPABASE_URL:', supabaseUrl ? 'OK' : 'AUSENTE');
console.log('[BUILD] SUPABASE_ANON_KEY:', supabaseAnonKey ? 'OK' : 'AUSENTE');

// 4. Bloquear build em produção (GitHub Actions) se as variáveis essenciais estiverem ausentes
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
if (isGithubActions) {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Variáveis do Supabase ausentes no build de produção');
    }
}

// 5. Escrever o arquivo js/env.js na pasta de origem (para desenvolvimento local)
const envContent = `// Arquivo gerado automaticamente no build. Não edite manualmente.
export const env = {
    SUPABASE_URL: "${supabaseUrl}",
    SUPABASE_ANON_KEY: "${supabaseAnonKey}"
};
`;

if (!fs.existsSync('js')) {
    fs.mkdirSync('js');
}
fs.writeFileSync('js/env.js', envContent);

// 6. Criar pasta dist se não existir
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Limpar conteúdo anterior de dist para evitar lixo
if (fs.existsSync('dist')) {
    fs.readdirSync('dist').forEach((file) => {
        const curPath = path.join('dist', file);
        if (fs.lstatSync(curPath).isDirectory()) {
            fs.rmSync(curPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(curPath);
        }
    });
}

// Copiar arquivos e pastas recursivamente
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Copiar arquivos base
copyRecursiveSync('index.html', 'dist/index.html');
copyRecursiveSync('style.css', 'dist/style.css');
copyRecursiveSync('js', 'dist/js');
copyRecursiveSync('recibo', 'dist/recibo');

// 7. Validar se dist/index.html contém todos os elementos de login necessários
const distIndexPath = 'dist/index.html';
if (!fs.existsSync(distIndexPath)) {
    throw new Error('Erro: dist/index.html não foi criado durante o build.');
}
const distIndexContent = fs.readFileSync(distIndexPath, 'utf8');
const requiredElements = [
    'id="login-container"',
    'class="login-card"',
    'id="login-form"',
    'id="login-email"',
    'id="login-password"',
    'id="forgot-form"',
    'id="recovery-form"'
];

requiredElements.forEach(elem => {
    if (!distIndexContent.includes(elem)) {
        throw new Error(`Erro de Validação de Produção: dist/index.html está incompleto, faltando a tag: ${elem}`);
    }
});

console.log('[BUILD VALIDATION] dist/index.html validado com sucesso! Todos os elementos de login estão presentes.');
console.log('Build finalizado com sucesso! Pasta dist pronta para publicação.');
