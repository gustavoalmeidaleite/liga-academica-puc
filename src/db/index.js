/**
 * Camada de dados com dois drivers intercambiáveis:
 *
 *  - Postgres, quando DATABASE_URL está definida (é o caso do Render);
 *  - SQLite embutido (node:sqlite), usado no desenvolvimento local.
 *
 * Todo o SQL é escrito com placeholders "?" e traduzido para "$n" no Postgres,
 * então as consultas abaixo servem para os dois bancos.
 */
import { config } from '../config.js';

let driver = null;

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

async function criarDriverPostgres() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 5,
  });

  const traduzir = (sql) => {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  };

  return {
    nome: 'postgres',
    async all(sql, params = []) {
      const { rows } = await pool.query(traduzir(sql), params);
      return rows;
    },
    async get(sql, params = []) {
      const { rows } = await pool.query(traduzir(sql), params);
      return rows[0] || null;
    },
    async run(sql, params = []) {
      await pool.query(traduzir(sql), params);
    },
    async fechar() {
      await pool.end();
    },
  };
}

async function criarDriverSqlite() {
  const { DatabaseSync } = await import('node:sqlite');
  const fs = await import('node:fs');
  const path = await import('node:path');

  fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
  const db = new DatabaseSync(config.sqlitePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const normalizar = (linha) => (linha ? { ...linha } : linha);

  return {
    nome: 'sqlite',
    async all(sql, params = []) {
      return db.prepare(sql).all(...params).map(normalizar);
    },
    async get(sql, params = []) {
      return normalizar(db.prepare(sql).get(...params)) || null;
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    async fechar() {
      db.close();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Esquema                                                             */
/* ------------------------------------------------------------------ */

const TABELA = `
CREATE TABLE IF NOT EXISTS inscricoes (
  protocolo    TEXT PRIMARY KEY,
  nome         TEXT NOT NULL,
  email        TEXT NOT NULL,
  cpf          TEXT NOT NULL,
  matricula    TEXT NOT NULL,
  curso        TEXT,
  periodo      TEXT,
  carreira     TEXT,
  status       TEXT NOT NULL DEFAULT 'novo',
  observacoes  TEXT DEFAULT '',
  dados        TEXT NOT NULL,
  ip           TEXT,
  criado_em    TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
)`;

export async function iniciar() {
  driver = config.databaseUrl ? await criarDriverPostgres() : await criarDriverSqlite();
  await driver.run(TABELA);
  await driver.run('CREATE INDEX IF NOT EXISTS idx_inscricoes_criado ON inscricoes (criado_em DESC)');
  await driver.run('CREATE INDEX IF NOT EXISTS idx_inscricoes_status ON inscricoes (status)');
  await driver.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_inscricoes_cpf ON inscricoes (cpf)');
  return driver.nome;
}

export async function fechar() {
  if (driver) await driver.fechar();
  driver = null;
}

export function driverEmUso() {
  return driver?.nome || 'nenhum';
}

/* ------------------------------------------------------------------ */
/* Operações                                                           */
/* ------------------------------------------------------------------ */

function hidratar(linha) {
  if (!linha) return null;
  return { ...linha, dados: typeof linha.dados === 'string' ? JSON.parse(linha.dados) : linha.dados };
}

/** Protocolo legível: GRP-2026-XXXX. */
function gerarProtocolo() {
  const ano = new Date().getFullYear();
  const sufixo = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `GRP-${ano}-${sufixo}`;
}

export async function cpfJaInscrito(cpf) {
  const linha = await driver.get('SELECT protocolo FROM inscricoes WHERE cpf = ?', [cpf]);
  return Boolean(linha);
}

export async function criarInscricao({ dados, ip }) {
  const agora = new Date().toISOString();
  const protocolo = gerarProtocolo();

  await driver.run(
    `INSERT INTO inscricoes
      (protocolo, nome, email, cpf, matricula, curso, periodo, carreira, status, observacoes, dados, ip, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'novo', '', ?, ?, ?, ?)`,
    [
      protocolo,
      dados.nome_completo,
      dados.email,
      dados.cpf,
      dados.matricula,
      dados.curso,
      dados.periodo,
      dados.carreira === 'Outra carreira pública' && dados.carreira_outra ? dados.carreira_outra : dados.carreira,
      JSON.stringify(dados),
      ip || '',
      agora,
      agora,
    ],
  );

  return hidratar(await driver.get('SELECT * FROM inscricoes WHERE protocolo = ?', [protocolo]));
}

function montarFiltros({ busca, status, carreira, periodo }) {
  const condicoes = [];
  const params = [];

  if (busca) {
    const alvo = `%${String(busca).toLowerCase()}%`;
    condicoes.push('(LOWER(nome) LIKE ? OR LOWER(email) LIKE ? OR cpf LIKE ? OR matricula LIKE ? OR LOWER(protocolo) LIKE ?)');
    params.push(alvo, alvo, alvo, alvo, alvo);
  }
  if (status) {
    condicoes.push('status = ?');
    params.push(status);
  }
  if (carreira) {
    condicoes.push('carreira = ?');
    params.push(carreira);
  }
  if (periodo) {
    condicoes.push('periodo = ?');
    params.push(periodo);
  }

  return { where: condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '', params };
}

export async function listarInscricoes(filtros = {}) {
  const { where, params } = montarFiltros(filtros);
  const porPagina = Math.min(Math.max(Number(filtros.porPagina) || 20, 1), 100);
  const pagina = Math.max(Number(filtros.pagina) || 1, 1);

  const total = Number(
    (await driver.get(`SELECT COUNT(*) AS total FROM inscricoes ${where}`, params))?.total || 0,
  );
  const linhas = await driver.all(
    `SELECT * FROM inscricoes ${where} ORDER BY criado_em DESC LIMIT ? OFFSET ?`,
    [...params, porPagina, (pagina - 1) * porPagina],
  );

  return { itens: linhas.map(hidratar), total, pagina, porPagina, paginas: Math.max(Math.ceil(total / porPagina), 1) };
}

export async function listarTodas(filtros = {}) {
  const { where, params } = montarFiltros(filtros);
  const linhas = await driver.all(`SELECT * FROM inscricoes ${where} ORDER BY criado_em DESC`, params);
  return linhas.map(hidratar);
}

export async function buscarPorProtocolo(protocolo) {
  return hidratar(await driver.get('SELECT * FROM inscricoes WHERE protocolo = ?', [protocolo]));
}

export async function atualizarInscricao(protocolo, { status, observacoes }) {
  const atual = await buscarPorProtocolo(protocolo);
  if (!atual) return null;
  await driver.run('UPDATE inscricoes SET status = ?, observacoes = ?, atualizado_em = ? WHERE protocolo = ?', [
    status ?? atual.status,
    observacoes ?? atual.observacoes ?? '',
    new Date().toISOString(),
    protocolo,
  ]);
  return buscarPorProtocolo(protocolo);
}

export async function excluirInscricao(protocolo) {
  const atual = await buscarPorProtocolo(protocolo);
  if (!atual) return false;
  await driver.run('DELETE FROM inscricoes WHERE protocolo = ?', [protocolo]);
  return true;
}

/** Números do topo do painel. */
export async function resumo() {
  const total = Number((await driver.get('SELECT COUNT(*) AS total FROM inscricoes'))?.total || 0);
  const porStatus = await driver.all('SELECT status, COUNT(*) AS total FROM inscricoes GROUP BY status');
  const porCarreira = await driver.all(
    'SELECT carreira, COUNT(*) AS total FROM inscricoes GROUP BY carreira ORDER BY total DESC',
  );
  const porPeriodo = await driver.all(
    'SELECT periodo, COUNT(*) AS total FROM inscricoes GROUP BY periodo ORDER BY periodo',
  );
  const limite = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const ultimos7 = Number(
    (await driver.get('SELECT COUNT(*) AS total FROM inscricoes WHERE criado_em >= ?', [limite]))?.total || 0,
  );

  const normalizar = (linhas, chave) =>
    linhas.map((linha) => ({ rotulo: linha[chave] || 'Não informado', total: Number(linha.total) }));

  return {
    total,
    ultimos7,
    porStatus: Object.fromEntries(porStatus.map((l) => [l.status, Number(l.total)])),
    porCarreira: normalizar(porCarreira, 'carreira'),
    porPeriodo: normalizar(porPeriodo, 'periodo'),
  };
}

export async function saude() {
  await driver.get('SELECT 1 AS ok');
  return true;
}
