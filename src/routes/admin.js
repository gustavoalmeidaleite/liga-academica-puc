import { Router } from 'express';
import { STATUS, ETAPAS, CARREIRAS, PERIODOS, STATUS_ROTULOS } from '../schema.js';
import { credenciaisValidas, criarSessao, encerrarSessao, exigirSessao, sessaoValida } from '../lib/auth.js';
import { inscricoesParaCsv } from '../lib/csv.js';
import { limitarRequisicoes } from '../lib/middlewares.js';
import {
  listarInscricoes,
  listarTodas,
  buscarPorProtocolo,
  atualizarInscricao,
  excluirInscricao,
  resumo,
} from '../db/index.js';

export function rotasAdmin() {
  const router = Router();

  // Tentativas de login limitadas para dificultar força bruta.
  const limiteLogin = limitarRequisicoes({ janelaMs: 10 * 60 * 1000, max: 10 });

  router.post('/login', limiteLogin, (req, res) => {
    const { usuario, senha } = req.body || {};
    if (!credenciaisValidas(usuario, senha)) {
      return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
    }
    criarSessao(res);
    return res.json({ ok: true, usuario });
  });

  router.post('/logout', (_req, res) => {
    encerrarSessao(res);
    res.json({ ok: true });
  });

  router.get('/sessao', (req, res) => {
    res.json({ autenticado: sessaoValida(req) });
  });

  // Tudo abaixo exige sessão válida.
  router.use(exigirSessao);

  router.get('/opcoes', (_req, res) => {
    res.json({
      status: STATUS.map((valor) => ({ valor, rotulo: STATUS_ROTULOS[valor] })),
      carreiras: CARREIRAS,
      periodos: PERIODOS,
      etapas: ETAPAS,
    });
  });

  router.get('/resumo', async (_req, res, next) => {
    try {
      res.json(await resumo());
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/inscricoes', async (req, res, next) => {
    try {
      const { busca, status, carreira, periodo, pagina, porPagina } = req.query;
      res.json(await listarInscricoes({ busca, status, carreira, periodo, pagina, porPagina }));
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/inscricoes.csv', async (req, res, next) => {
    try {
      const { busca, status, carreira, periodo } = req.query;
      const inscricoes = await listarTodas({ busca, status, carreira, periodo });
      const arquivo = `inscricoes-grupamento-${new Date().toISOString().slice(0, 10)}.csv`;
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${arquivo}"`);
      res.send(inscricoesParaCsv(inscricoes));
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/inscricoes/:protocolo', async (req, res, next) => {
    try {
      const inscricao = await buscarPorProtocolo(req.params.protocolo);
      if (!inscricao) return res.status(404).json({ erro: 'Inscrição não encontrada.' });
      return res.json(inscricao);
    } catch (erro) {
      return next(erro);
    }
  });

  router.patch('/inscricoes/:protocolo', async (req, res, next) => {
    try {
      const { status, observacoes } = req.body || {};
      if (status && !STATUS.includes(status)) {
        return res.status(422).json({ erro: 'Status inválido.' });
      }
      const inscricao = await atualizarInscricao(req.params.protocolo, {
        status,
        observacoes: typeof observacoes === 'string' ? observacoes.slice(0, 2000) : undefined,
      });
      if (!inscricao) return res.status(404).json({ erro: 'Inscrição não encontrada.' });
      return res.json(inscricao);
    } catch (erro) {
      return next(erro);
    }
  });

  router.delete('/inscricoes/:protocolo', async (req, res, next) => {
    try {
      const removida = await excluirInscricao(req.params.protocolo);
      if (!removida) return res.status(404).json({ erro: 'Inscrição não encontrada.' });
      return res.json({ ok: true });
    } catch (erro) {
      return next(erro);
    }
  });

  return router;
}
