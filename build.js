import fs from 'fs';
import path from 'path';

// 1. Resolver variáveis de ambiente (do Github Actions ou arquivo .env local)
let supabaseUrl = process.env.SUPABASE_URL || '';
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (fs.existsSync('.env')) {
    const dotenvContent = fs.readFileSync('.env', 'utf8');
    const urlMatch = dotenvContent.match(/SUPABASE_URL\s*=\s*(.*)/);
    const keyMatch = dotenvContent.match(/SUPABASE_ANON_KEY\s*=\s*(.*)/);
    if (urlMatch && !supabaseUrl) supabaseUrl = urlMatch[1].trim().replace(/^['"]|['"]$/g, '');
    if (keyMatch && !supabaseAnonKey) supabaseAnonKey = keyMatch[1].trim().replace(/^['"]|['"]$/g, '');
}

// 2. Escrever o arquivo js/env.js na pasta de origem (para desenvolvimento local)
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
console.log('Arquivo js/env.js de desenvolvimento gerado com sucesso!');

// 3. Criar pasta dist se não existir
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

console.log('Build finalizado com sucesso! Pasta dist pronta para publicação.');
