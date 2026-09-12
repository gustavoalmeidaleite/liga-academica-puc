import crypto from 'node:crypto';
import { config } from '../config.js';

const COOKIE = 'grp_sessao';

function assinar(payload) {
  return crypto.createHmac('sha256', config.admin.segredo).update(payload).digest('base64url');
}

function comparar(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Confere usuário e senha do painel sem vazar tempo de comparação. */
export function credenciaisValidas(usuario, senha) {
  if (!config.admin.senha || !config.admin.segredo) return false;
  const okUsuario = comparar(usuario || '', config.admin.usuario);
  const okSenha = comparar(senha || '', config.admin.senha);
  return okUsuario && okSenha;
}

export function criarSessao(res) {
  const expira = Date.now() + config.admin.duracaoSessaoMs;
  const payload = `${config.admin.usuario}.${expira}`;
  const token = `${Buffer.from(payload).toString('base64url')}.${assinar(payload)}`;
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.producao,
    maxAge: config.admin.duracaoSessaoMs,
    path: '/',
  });
}

export function encerrarSessao(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function sessaoValida(req) {
  const token = req.cookies?.[COOKIE];
  if (!token || !config.admin.segredo) return false;
  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) return false;
  const payload = Buffer.from(corpo, 'base64url').toString('utf8');
  if (!comparar(assinatura, assinar(payload))) return false;
  const [, expira] = payload.split('.');
  return Number(expira) > Date.now();
}

/** Middleware: protege as rotas do painel. */
export function exigirSessao(req, res, next) {
  if (sessaoValida(req)) return next();
  return res.status(401).json({ erro: 'Sessão expirada ou inexistente.' });
}
