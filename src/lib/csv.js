import { CAMPOS, STATUS_ROTULOS } from '../schema.js';

function escapar(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return '"' + texto.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

function formatarValor(campo, valor) {
  if (Array.isArray(valor)) return valor.join(' | ');
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (campo?.tipo === 'cpf' && valor) {
    return String(valor).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (campo?.tipo === 'telefone' && valor) {
    const d = String(valor);
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return valor ?? '';
}

/** Gera o CSV das inscrições (separador ';' para abrir direto no Excel em pt-BR). */
export function inscricoesParaCsv(inscricoes) {
  const cabecalho = ['Protocolo', 'Recebida em', 'Status', ...CAMPOS.map((c) => c.rotulo)];
  const linhas = inscricoes.map((inscricao) => {
    const dados = inscricao.dados || {};
    return [
      inscricao.protocolo,
      new Date(inscricao.criado_em).toLocaleString('pt-BR'),
      STATUS_ROTULOS[inscricao.status] || inscricao.status,
      ...CAMPOS.map((campo) => formatarValor(campo, dados[campo.nome])),
    ];
  });

  // BOM para o Excel reconhecer o UTF-8.
  return '﻿' + [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(';')).join('\r\n');
}
