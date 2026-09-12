import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const producao = process.env.NODE_ENV === 'production';

export const config = {
  raiz,
  publicDir: path.join(raiz, 'public'),
  producao,
  porta: Number(process.env.PORT) || 3000,

  // Postgres quando DATABASE_URL existe (Render); SQLite local caso contrário.
  databaseUrl: process.env.DATABASE_URL || '',
  sqlitePath: path.resolve(raiz, process.env.SQLITE_PATH || './data/grupamento.db'),

  admin: {
    usuario: process.env.ADMIN_USER || 'coordenacao',
    senha: process.env.ADMIN_PASSWORD || (producao ? '' : 'grupamento'),
    // Em producao o segredo precisa vir do ambiente; em dev geramos um efemero.
    segredo: process.env.SESSION_SECRET || (producao ? '' : crypto.randomBytes(32).toString('hex')),
    duracaoSessaoMs: 1000 * 60 * 60 * 8,
  },

  rateLimit: {
    janelaMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 5,
  },
};

/** Avisa cedo sobre configuracao faltando em producao. */
export function validarConfig() {
  const erros = [];
  if (config.producao && !config.admin.senha) erros.push('ADMIN_PASSWORD nao definida');
  if (config.producao && !config.admin.segredo) erros.push('SESSION_SECRET nao definida');
  return erros;
}
