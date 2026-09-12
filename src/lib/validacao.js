import { CAMPOS, CAMPOS_POR_NOME } from '../schema.js';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D+/g, '');
}

/** Valida CPF pelos dois dígitos verificadores. */
export function cpfValido(entrada) {
  const cpf = somenteDigitos(entrada);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = ((soma * 10) % 11) % 10;
    if (resto !== Number(cpf[tamanho])) return false;
  }
  return true;
}

function limpar(valor, limite = 4000) {
  return String(valor ?? '')
    .split('')
    .filter((ch) => ch.charCodeAt(0) !== 0)
    .join('')
    .trim()
    .slice(0, limite);
}

/**
 * Valida o corpo enviado pelo formulário contra o schema.
 * Retorna { ok, erros: { campo: mensagem }, dados }.
 */
export function validarInscricao(corpo = {}) {
  const erros = {};
  const dados = {};

  for (const campo of CAMPOS) {
    const bruto = corpo[campo.nome];

    if (campo.tipo === 'checkboxes') {
      const lista = (Array.isArray(bruto) ? bruto : bruto ? [bruto] : [])
        .map((v) => limpar(v, 120))
        .filter((v) => campo.opcoes.includes(v));
      if (campo.obrigatorio && lista.length === 0) erros[campo.nome] = 'Selecione ao menos uma opção.';
      dados[campo.nome] = lista;
      continue;
    }

    if (campo.tipo === 'consentimento') {
      const aceito = bruto === true || bruto === 'true' || bruto === 'on' || bruto === 'Sim';
      if (campo.obrigatorio && !aceito) erros[campo.nome] = 'É necessário autorizar o uso dos dados.';
      dados[campo.nome] = aceito;
      continue;
    }

    const valor = limpar(bruto, campo.maxLength || 2000);

    if (!valor) {
      if (campo.obrigatorio) erros[campo.nome] = 'Campo obrigatório.';
      dados[campo.nome] = '';
      continue;
    }

    switch (campo.tipo) {
      case 'email':
        if (!RE_EMAIL.test(valor)) erros[campo.nome] = 'Informe um e-mail válido.';
        dados[campo.nome] = valor.toLowerCase();
        break;
      case 'cpf': {
        const digitos = somenteDigitos(valor);
        if (!cpfValido(digitos)) erros[campo.nome] = 'CPF inválido.';
        dados[campo.nome] = digitos;
        break;
      }
      case 'matricula': {
        const digitos = somenteDigitos(valor);
        if (digitos.length < 4 || digitos.length > 14) erros[campo.nome] = 'A matrícula deve ter de 4 a 14 dígitos.';
        dados[campo.nome] = digitos;
        break;
      }
      case 'telefone': {
        const digitos = somenteDigitos(valor);
        if (digitos.length < 10 || digitos.length > 11) erros[campo.nome] = 'Informe DDD + número.';
        dados[campo.nome] = digitos;
        break;
      }
      case 'date': {
        const data = new Date(valor + 'T12:00:00');
        const anos = (Date.now() - data.getTime()) / (365.25 * 24 * 3600 * 1000);
        if (Number.isNaN(data.getTime())) erros[campo.nome] = 'Data inválida.';
        else if (anos < 15 || anos > 100) erros[campo.nome] = 'Data de nascimento fora do intervalo esperado.';
        dados[campo.nome] = valor;
        break;
      }
      case 'select':
      case 'radio':
        if (!campo.opcoes.includes(valor)) erros[campo.nome] = 'Selecione uma opção da lista.';
        dados[campo.nome] = valor;
        break;
      default:
        dados[campo.nome] = valor;
    }
  }

  // Regra dependente: "Outra carreira pública" exige especificação.
  if (dados.carreira === 'Outra carreira pública' && !dados.carreira_outra) {
    erros.carreira_outra = 'Diga qual carreira você pretende seguir.';
  }

  return { ok: Object.keys(erros).length === 0, erros, dados };
}

/** Primeira etapa que contém erro — usada para levar o usuário de volta ao ponto certo. */
export function etapaDoErro(erros, etapas) {
  const primeiro = Object.keys(erros)[0];
  if (!primeiro) return 0;
  const indice = etapas.findIndex((etapa) => etapa.campos.some((c) => c.nome === primeiro));
  return indice < 0 ? 0 : indice;
}

export { CAMPOS_POR_NOME };
