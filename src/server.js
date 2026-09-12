import express from 'express';
import path from 'node:path';
import { config, validarConfig } from './config.js';
import { iniciar, saude, driverEmUso, fechar } from './db/index.js';
import { rotasPublicas } from './routes/publico.js';
import { rotasAdmin } from './routes/admin.js';
import { lerCookies, cabecalhosSeguranca } from './lib/middlewares.js';

const app = express();

// No Render a aplicação fica atrás de um proxy: sem isto req.ip vem errado.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cabecalhosSeguranca);
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(lerCookies);

app.get('/healthz', async (_req, res) => {
  try {
    await saude();
    res.json({ ok: true, banco: driverEmUso(), ts: new Date().toISOString() });
  } catch (erro) {
    res.status(503).json({ ok: false, erro: erro.message });
  }
});

app.use('/api', rotasPublicas());
app.use('/api/admin', rotasAdmin());

app.use(
  express.static(config.publicDir, {
    maxAge: config.producao ? '7d' : 0,
    extensions: ['html'],
  }),
);

// Páginas com URL limpa.
const paginas = {
  '/': 'index.html',
  '/inscricao': 'inscricao.html',
  '/admin': 'admin.html',
};
for (const [rota, arquivo] of Object.entries(paginas)) {
  app.get(rota, (_req, res) => res.sendFile(path.join(config.publicDir, arquivo)));
}

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'Rota não encontrada.' });
  return res.status(404).sendFile(path.join(config.publicDir, '404.html'));
});

// eslint-disable-next-line no-unused-vars -- o Express identifica o handler de erro pela aridade
app.use((erro, _req, res, _next) => {
  console.error('[erro]', erro);
  res.status(500).json({ erro: 'Erro interno. Tente novamente em instantes.' });
});

const avisos = validarConfig();
if (avisos.length) {
  console.error('Configuração incompleta:', avisos.join(', '));
  process.exit(1);
}

const banco = await iniciar();
const servidor = app.listen(config.porta, () => {
  console.log(`GRUPAMENTO no ar em http://localhost:${config.porta} (banco: ${banco})`);
});

for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, () => {
    servidor.close(async () => {
      await fechar();
      process.exit(0);
    });
  });
}

export default app;
