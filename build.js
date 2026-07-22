const fs = require('fs');
const path = require('path');

// Criar pasta dist se não existir
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
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

// Limpar conteúdo anterior de dist para evitar lixo
if (fs.existsSync('dist')) {
    fs.readdirSync('dist').forEach((file) => {
        const curPath = path.join('dist', file);
        if (fs.lstatSync(curPath).isDirectory()) {
            // Deletar diretório recursivamente
            fs.rmSync(curPath, { recursive: true, force: true });
        } else {
            // Deletar arquivo
            fs.unlinkSync(curPath);
        }
    });
}

// Copiar index.html, style.css e as pastas js/recibo
copyRecursiveSync('index.html', 'dist/index.html');
copyRecursiveSync('style.css', 'dist/style.css');
copyRecursiveSync('js', 'dist/js');
copyRecursiveSync('recibo', 'dist/recibo');

console.log('Build finalizado com sucesso! Pasta dist pronta para publicação.');
