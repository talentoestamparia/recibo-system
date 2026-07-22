# Sistema de Recibos de Pagamento

Um aplicativo web moderno, elegante e de página única (SPA) para emissão, gerenciamento e controle de recibos de pagamento de salários (holerites) em duas vias. Ele foi desenvolvido com HTML5 semântico, CSS3 customizado e JavaScript ES6 estruturado.

## 🎯 Objetivo do Sistema

Facilitar a emissão de recibos de pagamento para pequenas e médias empresas. O sistema gera automaticamente duas vias idênticas alinhadas lado a lado em uma folha A4 horizontal (modo Paisagem), realizando todos os cálculos de vencimentos, descontos, totais e valor líquido por extenso automaticamente em tempo real, além de gerenciar férias e histórico de pagamentos sem a necessidade imediata de infraestrutura de banco de dados no servidor.

---

## 🛠️ Principais Funções do Sistema

1. **Painel Administrativo (Dashboard)**:
   - Apresenta métricas em tempo real sobre a folha de pagamento.
   - Mostra o valor total de gastos com a folha mensal líquida do último período lançado.
   - Lista alertas urgentes sobre funcionários com férias pendentes ou próximas de vencer.
   - Possui banner inteligente para detectar e importar dados de salários históricos diretamente de planilhas Excel compiladas em JSON/JS.

2. **Cadastro e Gestão de Funcionários**:
   - Registro de informações essenciais (Nome, Cargo, CPF, Telefone, Salário-Base e Data de Admissão).
   - Controle programado de dias de férias.

3. **Editor Interativo em Duas Vias**:
   - **Sincronização em Tempo Real**: Qualquer texto ou valor editado na Via 1 (esquerda) é replicado instantaneamente na Via 2 (direita) e vice-versa.
   - **Marcadores de Recorrência**: Permite sinalizar itens fixos (`●` - recorrente) ou variáveis (`○` - temporário) nas linhas de vencimento ou desconto de forma discreta ao lado dos valores.
   - **Cálculo Automático**: Soma os totais e preenche a declaração líquida por extenso em tempo real enquanto os valores são preenchidos.
   - **Compactação e Escala Inteligente**: Adapta o espaçamento, paddings de tabela e fontes conforme o número de linhas para assegurar que os dois recibos caibam em uma única folha A4 horizontal sem quebra de página ou cortes na assinatura.
   - **Ocultação de Ferramentas na Impressão**: Oculta automaticamente todos os botões, links de adição de linhas e marcadores de edição durante a visualização de impressão (`window.print()`).

4. **Histórico de Pagamentos**:
   - Tabela de buscas com filtros avançados por nome do funcionário, mês/ano da competência e período.
   - Possibilita abrir recibos antigos para edição, exclusão ou uso como modelo.

5. **Função "Usar como Modelo"**:
   - Permite duplicar a estrutura de vencimentos, descontos, recorrências e observações de um recibo antigo para preencher um novo lançamento na tela.
   - **Segurança**: A cópia é aberta no editor em modo de novo recibo, mantendo o registro histórico original intacto.
   - **Ajuste de Competência**: Solicita a nova competência (mês/ano) antes de salvar e calcula automaticamente a data inicial/final do período (respeitando bissextos em fevereiro) e a data de emissão correspondente.

6. **Gestão Visual de Férias**:
   - Quadro Kanban de organização visual de funcionários divididos por status de férias (*Pendente*, *Programada*, *Em Andamento* e *Concluída*).

7. **Configurações Globais**:
   - Edição de dados da empresa emissora (Nome do Empregador, CNPJ, Cidade de emissão e logotipo).
   - Seletor de cores de tema que sincroniza instantaneamente as cores principais e as tonalidades de destaque em toda a interface do aplicativo.

---

## 💾 Armazenamento Local (Offline-First)

Para simplicidade e privacidade de dados, a persistência é feita inteiramente via **LocalStorage** do navegador. O banco de dados está modelado de forma assíncrona baseada em Promises e possui três chaves principais:
*   `recibos_db_employees`: Cadastro de funcionários.
*   `recibos_db_receipts`: Histórico de recibos emitidos.
*   `recibos_db_settings`: Dados da empresa e configurações visuais do tema.

O arquivo `js/db.js` foi estruturado para ser *Supabase Ready*. Caso decida migrar para um banco de dados em nuvem futuramente, basta substituir o corpo das funções locais pelas chamadas correspondentes da API do Supabase sem necessidade de alterar o restante das telas e controllers da aplicação.

---

## 🚀 Como Executar o Projeto

Como o aplicativo é uma aplicação web estática baseada em módulos ES6 (`type="module"`), o navegador exige a execução sob o protocolo HTTP (não permite abrir diretamente usando `file:///` devido a restrições de CORS locais em imports de scripts).

### Requisitos:
*   Ter um interpretador de Python instalado (para o servidor estático simples) ou qualquer servidor HTTP local.

### Passos para executar:

1. Abra a pasta do projeto no terminal ou PowerShell.
2. Execute o servidor estático nativo do Python:
   ```bash
   python -m http.server 3000
   ```
3. Abra o seu navegador e acesse:
   ```
   http://localhost:3000
   ```

---

## 🏗️ Como Gerar a Versão de Produção

Por ser uma aplicação baseada inteiramente em arquivos estáticos (HTML, CSS, JS), a versão de produção consiste apenas em fazer o deploy destes mesmos arquivos em qualquer servidor HTTP estático, por exemplo:

*   **GitHub Pages**:
    1. Suba o projeto para o seu repositório no GitHub.
    2. Vá nas configurações do repositório (*Settings*), acesse a aba *Pages*.
    3. Em *Build and deployment*, selecione a branch `main` e a pasta `/` (root), depois clique em *Save*.
    4. O GitHub gerará o link seguro da aplicação automaticamente.
*   **Vercel / Netlify / Cloudflare Pages**:
    - Basta conectar seu repositório do GitHub na plataforma escolhida e clicar em Deploy (não há necessidade de configurar comandos de compilação ou pastas de build, use apenas a raiz `./` do projeto).
