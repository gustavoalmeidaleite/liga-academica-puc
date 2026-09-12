import { Router } from 'express';
import { ETAPAS } from '../schema.js';
import { validarInscricao, etapaDoErro } from '../lib/validacao.js';
import { criarInscricao, cpfJaInscrito } from '../db/index.js';
import { limitarRequisicoes } from '../lib/middlewares.js';
import { config } from '../config.js';

export function rotasPublicas() {
  const router = Router();

  // O formulário do navegador é montado a partir deste schema.
  router.get('/form-schema', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ etapas: ETAPAS });
  });

  router.post('/inscricoes', limitarRequisicoes(config.rateLimit), async (req, res, next) => {
    try {
      // Campo-armadilha: bots preenchem, humanos não veem.
      if (req.body?.website) return res.status(202).json({ ok: true, protocolo: 'GRP-0000-0000' });

      const { ok, erros, dados } = validarInscricao(req.body);
      if (!ok) {
        return res.status(422).json({
          erro: 'Confira os campos destacados.',
          erros,
          etapa: etapaDoErro(erros, ETAPAS),
        });
      }

      if (await cpfJaInscrito(dados.cpf)) {
        return res.status(409).json({
          erro: 'Já existe uma inscrição com este CPF. Se precisar corrigir algo, fale com a coordenação.',
          erros: { cpf: 'CPF já inscrito.' },
          etapa: 0,
        });
      }

      const inscricao = await criarInscricao({
        dados,
        ip: req.ip,
      });

      return res.status(201).json({
        ok: true,
        protocolo: inscricao.protocolo,
        nome: dados.nome_completo,
        email: dados.email,
      });
    } catch (erro) {
      return next(erro);
    }
  });

  return router;
}
