/* ==========================================================================
   Ficha de inscrição — assistente de etapas
   O formulário é montado a partir do schema servido em /api/form-schema,
   o mesmo que o servidor usa para validar. Um campo novo aparece aqui sozinho.
   ========================================================================== */

const CHAVE_RASCUNHO = 'grupamento:rascunho:v2';

const estado = {
  etapas: [],
  indice: 0,
  dados: {},
  erros: {},
  enviando: false,
  visitadas: new Set(),
};

const el = {
  menu: document.getElementById('menu-etapas'),
  campos: document.getElementById('campos'),
  titulo: document.getElementById('etapa-titulo'),
  descricao: document.getElementById('etapa-descricao'),
  indice: document.getElementById('etapa-indice'),
  barra: document.getElementById('progresso-barra'),
  progresso: document.getElementById('progresso-texto'),
  alerta: document.getElementById('alerta-area'),
  voltar: document.getElementById('btn-voltar'),
  avancar: document.getElementById('btn-avancar'),
  salvo: document.getElementById('salvo-em'),
  area: document.getElementById('area-formulario'),
  conclusao: document.getElementById('conclusao'),
  protocolo: document.getElementById('protocolo'),
  novaFicha: document.getElementById('btn-nova'),
  form: document.getElementById('form-inscricao'),
};

/* ---------------- utilidades ---------------- */

const digitos = (valor) => String(valor ?? '').replace(/\D+/g, '');

function mascaraCpf(valor) {
  const d = digitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

function mascaraTelefone(valor) {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1');
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function cpfValido(entrada) {
  const cpf = digitos(entrada);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(cpf[tamanho])) return false;
  }
  return true;
}

const ehRevisao = (indice) => indice === estado.etapas.length;
const totalPassos = () => estado.etapas.length + 1;

/* ---------------- rascunho ---------------- */

function salvarRascunho() {
  try {
    localStorage.setItem(
      CHAVE_RASCUNHO,
      JSON.stringify({ dados: estado.dados, indice: estado.indice, em: Date.now() }),
    );
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    el.salvo.textContent = `Rascunho salvo às ${hora}`;
  } catch {
    /* navegador sem armazenamento: seguimos sem rascunho */
  }
}

function carregarRascunho() {
  try {
    const bruto = localStorage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return;
    const salvo = JSON.parse(bruto);
    if (salvo && typeof salvo.dados === 'object') {
      estado.dados = salvo.dados;
      estado.indice = Math.min(Number(salvo.indice) || 0, estado.etapas.length);
      el.salvo.textContent = 'Rascunho recuperado deste navegador.';
    }
  } catch {
    /* rascunho corrompido: ignoramos */
  }
}

function limparRascunho() {
  try {
    localStorage.removeItem(CHAVE_RASCUNHO);
  } catch {
    /* nada a fazer */
  }
}

/* ---------------- validação no navegador ---------------- */

function validarCampo(campo) {
  const valor = estado.dados[campo.nome];

  if (campo.tipo === 'checkboxes') {
    return campo.obrigatorio && !(valor || []).length ? 'Selecione ao menos uma opção.' : '';
  }
  if (campo.tipo === 'consentimento') {
    return campo.obrigatorio && valor !== true ? 'É necessário autorizar o uso dos dados.' : '';
  }

  const texto = String(valor ?? '').trim();
  if (!texto) return campo.obrigatorio ? 'Campo obrigatório.' : '';

  switch (campo.tipo) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(texto) ? '' : 'Informe um e-mail válido.';
    case 'cpf':
      return cpfValido(texto) ? '' : 'CPF inválido.';
    case 'matricula': {
      const d = digitos(texto);
      return d.length >= 4 && d.length <= 14 ? '' : 'A matrícula deve ter de 4 a 14 dígitos.';
    }
    case 'telefone': {
      const d = digitos(texto);
      return d.length === 10 || d.length === 11 ? '' : 'Informe DDD + número.';
    }
    case 'date': {
      const anos = (Date.now() - new Date(`${texto}T12:00:00`).getTime()) / (365.25 * 24 * 3600 * 1000);
      return anos >= 15 && anos <= 100 ? '' : 'Data de nascimento fora do intervalo esperado.';
    }
    default:
      return '';
  }
}

function validarEtapa(indice) {
  const etapa = estado.etapas[indice];
  if (!etapa) return {};
  const erros = {};
  for (const campo of etapa.campos) {
    if (campo.dependeDe && estado.dados[campo.dependeDe.campo] !== campo.dependeDe.valor) continue;
    const erro = validarCampo(campo);
    if (erro) erros[campo.nome] = erro;
  }
  if (etapa.id === 'carreira' && estado.dados.carreira === 'Outra carreira pública' && !estado.dados.carreira_outra) {
    erros.carreira_outra = 'Diga qual carreira você pretende seguir.';
  }
  return erros;
}

const etapaCompleta = (indice) => Object.keys(validarEtapa(indice)).length === 0;

/* ---------------- montagem dos campos ---------------- */

function criar(tag, props = {}, filhos = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([chave, valor]) => {
    if (chave === 'class') node.className = valor;
    else if (chave === 'texto') node.textContent = valor;
    else if (chave.startsWith('on')) node.addEventListener(chave.slice(2), valor);
    else if (valor !== undefined && valor !== null && valor !== false) node.setAttribute(chave, valor);
  });
  (Array.isArray(filhos) ? filhos : [filhos]).forEach((filho) => filho && node.appendChild(filho));
  return node;
}

const CAMPOS_METADE = new Set([
  'data_nascimento', 'cpf', 'telefone', 'cidade', 'instagram', 'email',
  'matricula', 'curso', 'periodo', 'religiao', 'instrumento_estudo', 'periodo_disponibilidade',
]);

function montarControle(campo) {
  const idControle = `campo-${campo.nome}`;
  const valor = estado.dados[campo.nome];

  const aoDigitar = (evento) => {
    let novo = evento.target.value;
    if (campo.tipo === 'cpf') novo = mascaraCpf(novo);
    if (campo.tipo === 'telefone') novo = mascaraTelefone(novo);
    if (campo.tipo === 'matricula') novo = digitos(novo).slice(0, 14);
    if (novo !== evento.target.value) evento.target.value = novo;
    estado.dados[campo.nome] = novo;
    if (estado.erros[campo.nome]) {
      const erro = validarCampo(campo);
      if (!erro) {
        delete estado.erros[campo.nome];
        renderizarEtapa({ manterFoco: campo.nome });
      }
    }
    salvarRascunho();
  };

  if (campo.tipo === 'textarea') {
    return criar('textarea', {
      id: idControle,
      name: campo.nome,
      rows: 4,
      maxlength: campo.maxLength || 2000,
      placeholder: campo.placeholder || '',
      'aria-describedby': campo.ajuda ? `${idControle}-ajuda` : null,
      oninput: aoDigitar,
      texto: valor || '',
    });
  }

  if (campo.tipo === 'select') {
    const select = criar('select', { id: idControle, name: campo.nome, onchange: aoDigitar });
    select.appendChild(criar('option', { value: '', texto: 'Selecione' }));
    campo.opcoes.forEach((opcao) => {
      const item = criar('option', { value: opcao, texto: opcao });
      if (opcao === valor) item.selected = true;
      select.appendChild(item);
    });
    return select;
  }

  if (campo.tipo === 'radio' || campo.tipo === 'checkboxes') {
    const multiplo = campo.tipo === 'checkboxes';
    const grupo = criar('div', { class: `opcoes${campo.opcoes.length > 4 ? ' opcoes--colunas' : ''}`, role: multiplo ? 'group' : 'radiogroup' });

    campo.opcoes.forEach((opcao, i) => {
      const input = criar('input', {
        type: multiplo ? 'checkbox' : 'radio',
        name: campo.nome,
        id: `${idControle}-${i}`,
        value: opcao,
      });
      input.checked = multiplo ? (valor || []).includes(opcao) : valor === opcao;
      input.addEventListener('change', () => {
        if (multiplo) {
          const atuais = new Set(estado.dados[campo.nome] || []);
          input.checked ? atuais.add(opcao) : atuais.delete(opcao);
          estado.dados[campo.nome] = [...atuais];
        } else {
          estado.dados[campo.nome] = opcao;
        }
        delete estado.erros[campo.nome];
        salvarRascunho();
        renderizarEtapa();
      });
      grupo.appendChild(criar('label', { class: 'opcao', for: `${idControle}-${i}` }, [input, criar('span', { texto: opcao })]));
    });

    return grupo;
  }

  if (campo.tipo === 'consentimento') {
    const input = criar('input', { type: 'checkbox', id: idControle, name: campo.nome });
    input.checked = valor === true;
    input.addEventListener('change', () => {
      estado.dados[campo.nome] = input.checked;
      delete estado.erros[campo.nome];
      salvarRascunho();
      renderizarEtapa();
    });
    return criar('label', { class: 'opcao consentimento', for: idControle }, [input, criar('span', { texto: campo.rotulo })]);
  }

  const tipos = { text: 'text', email: 'email', date: 'date', cpf: 'text', matricula: 'text', telefone: 'tel' };
  return criar('input', {
    type: tipos[campo.tipo] || 'text',
    id: idControle,
    name: campo.nome,
    value: valor ?? campo.padrao ?? '',
    placeholder: campo.placeholder || '',
    maxlength: campo.maxLength || null,
    inputmode: ['cpf', 'matricula', 'telefone'].includes(campo.tipo) ? 'numeric' : null,
    autocomplete: campo.autocomplete || null,
    'aria-describedby': campo.ajuda ? `${idControle}-ajuda` : null,
    oninput: aoDigitar,
  });
}

function montarCampo(campo) {
  if (campo.dependeDe && estado.dados[campo.dependeDe.campo] !== campo.dependeDe.valor) return null;

  const erro = estado.erros[campo.nome];
  const idControle = `campo-${campo.nome}`;
  const bloco = criar('div', {
    class: `campo${CAMPOS_METADE.has(campo.nome) ? ' campo--metade' : ''}`,
    'data-erro': erro ? 'true' : null,
  });

  if (campo.tipo === 'consentimento') {
    bloco.appendChild(montarControle(campo));
  } else {
    const grupo = campo.tipo === 'radio' || campo.tipo === 'checkboxes';
    const rotulo = criar(grupo ? 'p' : 'label', { class: grupo ? 'campo__legenda' : null, for: grupo ? null : idControle });
    rotulo.textContent = campo.rotulo;
    if (campo.obrigatorio) rotulo.appendChild(criar('span', { class: 'campo__obrigatorio', texto: '*', 'aria-label': 'obrigatório' }));
    bloco.appendChild(rotulo);
    bloco.appendChild(montarControle(campo));
    // A ajuda vem depois do controle para que campos lado a lado fiquem alinhados.
    if (campo.ajuda) bloco.appendChild(criar('span', { class: 'campo__ajuda', id: `${idControle}-ajuda`, texto: campo.ajuda }));
  }

  if (erro) bloco.appendChild(criar('span', { class: 'campo__erro', role: 'alert', texto: erro }));
  return bloco;
}

/* ---------------- revisão ---------------- */

function formatarParaRevisao(campo) {
  const valor = estado.dados[campo.nome];
  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return valor ? String(valor) : '';
}

function montarRevisao() {
  const container = criar('div', { class: 'revisao' });

  estado.etapas.forEach((etapa, indice) => {
    const bloco = criar('div', { class: 'revisao__bloco' });
    const titulo = criar('h3', {}, [criar('span', { texto: etapa.titulo })]);
    titulo.appendChild(criar('button', { type: 'button', texto: 'editar', onclick: () => irPara(indice) }));
    bloco.appendChild(titulo);

    const lista = criar('dl');
    etapa.campos
      .filter((campo) => !campo.dependeDe || estado.dados[campo.dependeDe.campo] === campo.dependeDe.valor)
      .forEach((campo) => {
        const linha = criar('div');
        linha.appendChild(criar('dt', { texto: campo.tipo === 'consentimento' ? 'Autorização de uso dos dados' : campo.rotulo }));
        linha.appendChild(criar('dd', { texto: formatarParaRevisao(campo) }));
        lista.appendChild(linha);
      });
    bloco.appendChild(lista);
    container.appendChild(bloco);
  });

  return container;
}

/* ---------------- render ---------------- */

function renderizarMenu() {
  el.menu.replaceChildren();

  const passos = [
    ...estado.etapas.map((etapa, i) => ({ titulo: etapa.titulo, resumo: etapa.resumo, indice: i })),
    { titulo: 'Revisão e envio', resumo: 'Conferir', indice: estado.etapas.length },
  ];

  passos.forEach((passo) => {
    const atual = passo.indice === estado.indice;
    const temErro = estado.visitadas.has(passo.indice) && !ehRevisao(passo.indice) && !etapaCompleta(passo.indice);
    const concluida = !ehRevisao(passo.indice) && estado.visitadas.has(passo.indice) && etapaCompleta(passo.indice);

    const botao = criar('button', {
      class: 'menu-cadastro__item',
      type: 'button',
      'aria-current': atual ? 'step' : null,
      'data-estado': temErro ? 'erro' : concluida ? 'ok' : 'pendente',
      onclick: () => irPara(passo.indice),
    }, [
      criar('span', { class: 'menu-cadastro__num', texto: concluida ? '✓' : String(passo.indice + 1) }),
      criar('span', { class: 'menu-cadastro__rotulo' }, [
        criar('strong', { texto: passo.titulo }),
        criar('span', { texto: passo.resumo }),
      ]),
    ]);

    el.menu.appendChild(criar('li', {}, botao));
  });

  const progresso = ((estado.indice + 1) / totalPassos()) * 100;
  el.barra.style.width = `${progresso}%`;
  el.progresso.textContent = `Etapa ${estado.indice + 1} de ${totalPassos()}`;
}

function renderizarEtapa({ manterFoco } = {}) {
  const revisao = ehRevisao(estado.indice);
  const etapa = estado.etapas[estado.indice];

  el.indice.textContent = revisao ? `Etapa ${totalPassos()} · Final` : `Etapa ${estado.indice + 1} de ${totalPassos()}`;
  el.titulo.textContent = revisao ? 'Revisão e envio' : etapa.titulo;
  el.descricao.textContent = revisao
    ? 'Confira as informações antes de enviar. Você pode voltar e editar qualquer etapa.'
    : etapa.descricao;

  el.campos.replaceChildren();
  if (revisao) {
    el.campos.appendChild(montarRevisao());
  } else {
    etapa.campos.forEach((campo) => {
      const bloco = montarCampo(campo);
      if (bloco) el.campos.appendChild(bloco);
    });
  }

  el.voltar.disabled = estado.indice === 0;
  el.avancar.textContent = revisao ? 'Enviar ficha' : 'Continuar';
  el.avancar.disabled = estado.enviando;

  renderizarMenu();

  if (manterFoco) {
    const alvo = document.getElementById(`campo-${manterFoco}`);
    if (alvo) {
      const posicao = alvo.value?.length ?? 0;
      alvo.focus();
      if (alvo.setSelectionRange && alvo.type !== 'date' && alvo.type !== 'email') {
        try { alvo.setSelectionRange(posicao, posicao); } catch { /* tipos sem seleção */ }
      }
    }
  }
}

function mostrarAlerta(mensagem, tipo = 'erro') {
  el.alerta.replaceChildren();
  if (!mensagem) return;
  el.alerta.appendChild(
    criar('p', { class: `aviso aviso--${tipo}`, role: 'alert', style: 'margin-top:22px', texto: mensagem }),
  );
}

function irPara(indice) {
  estado.visitadas.add(estado.indice);
  if (!ehRevisao(estado.indice)) estado.erros = { ...estado.erros, ...validarEtapa(estado.indice) };
  estado.indice = Math.max(0, Math.min(indice, estado.etapas.length));
  mostrarAlerta('');
  salvarRascunho();
  renderizarEtapa();
  el.area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------------- envio ---------------- */

function corpoParaEnvio() {
  const corpo = {};
  for (const etapa of estado.etapas) {
    for (const campo of etapa.campos) {
      const valor = estado.dados[campo.nome];
      if (campo.tipo === 'checkboxes') corpo[campo.nome] = valor || [];
      else if (campo.tipo === 'consentimento') corpo[campo.nome] = valor === true;
      else if (['cpf', 'matricula', 'telefone'].includes(campo.tipo)) corpo[campo.nome] = digitos(valor);
      else corpo[campo.nome] = valor ?? '';
    }
  }
  corpo.website = document.getElementById('website').value;
  return corpo;
}

async function enviar() {
  // Revalida tudo antes de mandar.
  estado.erros = {};
  let primeiraFalha = -1;
  estado.etapas.forEach((_, indice) => {
    const erros = validarEtapa(indice);
    if (Object.keys(erros).length && primeiraFalha < 0) primeiraFalha = indice;
    Object.assign(estado.erros, erros);
  });

  if (primeiraFalha >= 0) {
    estado.etapas.forEach((_, i) => estado.visitadas.add(i));
    estado.indice = primeiraFalha;
    renderizarEtapa();
    mostrarAlerta('Faltam informações obrigatórias. Confira os campos destacados.');
    return;
  }

  estado.enviando = true;
  el.avancar.disabled = true;
  el.avancar.textContent = 'Enviando…';
  mostrarAlerta('');

  try {
    const resposta = await fetch('/api/inscricoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpoParaEnvio()),
    });
    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      estado.erros = dados.erros || {};
      estado.enviando = false;
      if (typeof dados.etapa === 'number') estado.indice = dados.etapa;
      renderizarEtapa();
      mostrarAlerta(dados.erro || 'Não foi possível enviar sua ficha. Tente novamente.');
      return;
    }

    limparRascunho();
    el.protocolo.textContent = dados.protocolo;
    el.area.hidden = true;
    el.conclusao.hidden = false;
    el.conclusao.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    estado.enviando = false;
    renderizarEtapa();
    mostrarAlerta('Falha de conexão. Verifique sua internet e tente novamente.');
  } finally {
    estado.enviando = false;
    el.avancar.textContent = ehRevisao(estado.indice) ? 'Enviar ficha' : 'Continuar';
    el.avancar.disabled = false;
  }
}

/* ---------------- eventos ---------------- */

el.avancar.addEventListener('click', () => {
  if (ehRevisao(estado.indice)) return enviar();

  const erros = validarEtapa(estado.indice);
  estado.visitadas.add(estado.indice);

  if (Object.keys(erros).length) {
    estado.erros = { ...estado.erros, ...erros };
    renderizarEtapa();
    mostrarAlerta('Confira os campos destacados antes de continuar.');
    const primeiro = document.querySelector('.campo[data-erro="true"] input, .campo[data-erro="true"] select, .campo[data-erro="true"] textarea');
    primeiro?.focus();
    return;
  }

  estado.etapas[estado.indice].campos.forEach((campo) => delete estado.erros[campo.nome]);
  return irPara(estado.indice + 1);
});

el.voltar.addEventListener('click', () => irPara(estado.indice - 1));

el.form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  el.avancar.click();
});

el.novaFicha.addEventListener('click', () => {
  estado.dados = {};
  estado.erros = {};
  estado.indice = 0;
  estado.visitadas = new Set();
  limparRascunho();
  el.conclusao.hidden = true;
  el.area.hidden = false;
  el.salvo.textContent = '';
  renderizarEtapa();
});

/* ---------------- inicialização ---------------- */

(async function iniciar() {
  try {
    const resposta = await fetch('/api/form-schema');
    const { etapas } = await resposta.json();
    estado.etapas = etapas;

    // Valores padrão do schema (ex.: curso "Direito").
    etapas.forEach((etapa) => etapa.campos.forEach((campo) => {
      if (campo.padrao !== undefined && estado.dados[campo.nome] === undefined) {
        estado.dados[campo.nome] = campo.padrao;
      }
    }));

    carregarRascunho();
    renderizarEtapa();
  } catch {
    el.titulo.textContent = 'Formulário indisponível';
    el.descricao.textContent = 'Não conseguimos carregar a ficha agora. Recarregue a página em instantes.';
    el.avancar.disabled = true;
    el.voltar.disabled = true;
  }
})();
