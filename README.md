# GRUPAMENTO · site + sistema de inscrições

Site institucional e cadastro de membros da **Liga Acadêmica de Práticas e Estudos Policiais
(GRUPAMENTO)** da PUC Goiás.

Esta é a reescrita da versão que estava no Netlify (`grupamento.netlify.app`). O conteúdo foi
mantido, a página única de 280 KB virou um projeto organizado e o formulário — que dependia do
Netlify Forms — passou a ter **backend próprio, banco de dados e painel da coordenação**, pronto
para rodar no Render.

## O que mudou em relação à versão do Netlify

| Antes | Agora |
| --- | --- |
| Um único `index.html` de 280 KB com CSS, JS e fotos em base64 | Páginas separadas, CSS/JS por arquivo, imagens em `public/assets/` |
| Formulário gigante numa tela só | Cadastro em 6 etapas + revisão, com menu lateral, salvamento automático e máscaras |
| Envio pelo Netlify Forms (some se sair do Netlify) | `POST /api/inscricoes` gravando em banco, com validação no servidor |
| Sem lugar para consultar as fichas | Painel `/admin` com busca, filtros, status, observações e exportação CSV |
| Sem validação real | CPF conferido por dígito verificador, e-mail, telefone, matrícula, anti-duplicidade por CPF |

## Como rodar localmente

```bash
npm install
cp .env.example .env      # ajuste ADMIN_PASSWORD e SESSION_SECRET
npm run dev               # http://localhost:3000
```

Sem `DATABASE_URL` o projeto usa **SQLite** (`data/grupamento.db`, criado sozinho) através do
módulo `node:sqlite` — não há dependência nativa para compilar. Requer **Node 24 ou superior**.

Páginas:

- `/` — site institucional
- `/inscricao` — ficha de inscrição em etapas
- `/admin` — painel da coordenação (usuário e senha do `.env`)
- `/healthz` — health check usado pelo Render

## Deploy no Render

### Opção 1 — Blueprint (recomendada)

O arquivo [`render.yaml`](render.yaml) já descreve o serviço web e um Postgres.

1. Suba este projeto para um repositório no GitHub.
2. No Render: **New → Blueprint** e aponte para o repositório.
3. O Render vai criar o serviço `grupamento` e o banco `grupamento-db`, preenchendo
   `DATABASE_URL` e gerando `SESSION_SECRET` automaticamente.
4. Defina o valor de **`ADMIN_PASSWORD`** (marcado como `sync: false`, ou seja, é digitado no
   painel) e, se quiser, troque `ADMIN_USER`.
5. Deploy. O serviço sobe com `npm ci --omit=dev` + `npm start`.

### Opção 2 — manual

1. **New → Web Service**, conectando o repositório.
2. Runtime **Node**, Build Command `npm ci --omit=dev`, Start Command `npm start`.
3. Health Check Path: `/healthz`.
4. Variáveis de ambiente:

| Variável | Valor |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | connection string do Postgres do Render |
| `ADMIN_USER` | usuário do painel |
| `ADMIN_PASSWORD` | senha do painel (obrigatória em produção) |
| `SESSION_SECRET` | string aleatória longa (obrigatória em produção) |
| `RATE_LIMIT_MAX` | opcional, padrão `5` envios por IP a cada 15 min |

`PORT` é injetada pelo Render automaticamente.

> **Importante:** em produção use Postgres. O disco do plano free do Render é efêmero — com SQLite
> as inscrições seriam perdidas a cada deploy. O servidor recusa subir em produção sem
> `ADMIN_PASSWORD` e `SESSION_SECRET`, justamente para não deixar o painel aberto.

### Domínio

Em **Settings → Custom Domain** dá para apontar o domínio da liga. Se o `grupamento.netlify.app`
continuar no ar, vale deixar só um dos dois publicado para não dividir as inscrições.

## Estrutura

```
src/
  server.js            Express: middlewares, rotas, arquivos estáticos, encerramento limpo
  config.js            Configuração por ambiente e checagem do que é obrigatório em produção
  schema.js            FONTE ÚNICA da ficha: etapas, campos, validações, opções
  db/index.js          Postgres (DATABASE_URL) ou SQLite; mesmo SQL para os dois
  routes/publico.js    GET /api/form-schema · POST /api/inscricoes
  routes/admin.js      Login, listagem, detalhe, status, exclusão, CSV
  lib/validacao.js     Validação no servidor (inclusive dígito verificador do CPF)
  lib/auth.js          Sessão por cookie assinado com HMAC (sem dependência extra)
  lib/middlewares.js   Cookies, rate limit em memória, cabeçalhos de segurança/CSP
  lib/csv.js           Exportação CSV com separador ';' e BOM (abre direto no Excel)
public/
  index.html           Site institucional
  inscricao.html       Ficha em etapas
  admin.html           Painel da coordenação
  404.html
  css/                 base (tokens e componentes) + site + form + admin
  js/                  nav · inscricao (assistente) · admin (painel)
  assets/              brasão e fotos da diretoria
```

### O schema é o centro do projeto

`src/schema.js` descreve as etapas e os campos da ficha. A partir dele:

- o navegador monta o formulário (`GET /api/form-schema`);
- o servidor valida o envio;
- o painel monta o detalhe da inscrição;
- o CSV monta as colunas.

Para **incluir, remover ou renomear uma pergunta**, edite apenas esse arquivo — os quatro lugares
acompanham sozinhos. Tipos disponíveis: `text`, `email`, `date`, `cpf`, `telefone`, `matricula`,
`select`, `radio`, `checkboxes`, `textarea`, `consentimento`. Um campo pode aparecer só quando
outro tem certo valor, via `dependeDe`.

## Painel da coordenação

Em `/admin`, após o login:

- números do topo: total, últimos 7 dias e quantidade por status;
- busca por nome, e-mail, CPF, matrícula ou protocolo, com filtros de status, carreira e período;
- clique em qualquer linha para ver a ficha completa, mudar o status (novo, em análise, aprovado,
  recusado), registrar observações internas ou excluir;
- **Exportar CSV** baixa exatamente o que está filtrado na tela.

A sessão dura 8 horas e usa cookie `httpOnly` assinado.

## Dados dos candidatos

- Cada inscrição recebe um protocolo (`GRP-2026-XXXX`) mostrado na tela de conclusão.
- O CPF é único: uma segunda tentativa com o mesmo CPF é recusada com mensagem explicativa.
- A etapa "Integração e acompanhamento" é opcional e sensível — ela existe para acolhimento e só
  aparece para quem tem acesso ao painel.
- O rascunho da ficha fica no `localStorage` do próprio candidato e é apagado após o envio.

## Manutenção rápida

- **Trocar fotos da diretoria:** substitua os arquivos em `public/assets/diretoria/` mantendo os
  nomes, ou ajuste os caminhos em `public/index.html`.
- **Mudar textos do site:** `public/index.html` (seções marcadas por comentários).
- **Mudar cores e tipografia:** variáveis no topo de `public/css/base.css`.
- **Datas do evento:** seção `#evento` em `public/index.html`.
