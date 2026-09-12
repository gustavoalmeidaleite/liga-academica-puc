/* ==========================================================================
   Painel da coordenação — lista, filtra e acompanha as fichas recebidas.
   ========================================================================== */

const estado = {
  opcoes: null,
  pagina: 1,
  porPagina: 20,
  paginas: 1,
  total: 0,
  filtros: { busca: '', status: '', carreira: '', periodo: '' },
  atual: null,
};

const $ = (id) => document.getElementById(id);

const tela = { login: $('tela-login'), painel: $('tela-painel') };

/* ---------------- infra ---------------- */

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`/api/admin${caminho}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });
  if (resposta.status === 401) {
    mostrarLogin();
    throw new Error('sessao');
  }
  const tipo = resposta.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await resposta.json() : null;
  if (!resposta.ok) throw new Error(dados?.erro || 'Falha na operação.');
  return dados;
}

function alerta(container, mensagem, tipo = 'erro') {
  container.replaceChildren();
  if (!mensagem) return;
  const p = document.createElement('p');
  p.className = `aviso aviso--${tipo}`;
  p.setAttribute('role', 'alert');
  p.style.marginTop = '12px';
  p.textContent = mensagem;
  container.appendChild(p);
}

const formatarData = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function formatarValor(campo, valor) {
  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (!valor) return '';
  if (campo.tipo === 'cpf') return String(valor).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (campo.tipo === 'telefone') {
    const d = String(valor);
    return d.length === 11
      ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (campo.tipo === 'date') return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR');
  return String(valor);
}

/* ---------------- telas ---------------- */

function mostrarLogin() {
  tela.login.hidden = false;
  tela.painel.hidden = true;
  $('btn-sair').hidden = true;
}

async function mostrarPainel() {
  tela.login.hidden = true;
  tela.painel.hidden = false;
  $('btn-sair').hidden = false;
  if (!estado.opcoes) {
    estado.opcoes = await api('/opcoes');
    preencherFiltros();
  }
  await Promise.all([carregarResumo(), carregarLista()]);
}

function preencherFiltros() {
  const { status, carreiras, periodos } = estado.opcoes;

  status.forEach((item) => {
    $('filtro-status').appendChild(new Option(item.rotulo, item.valor));
    $('detalhe-status').appendChild(new Option(item.rotulo, item.valor));
  });
  carreiras.forEach((carreira) => $('filtro-carreira').appendChild(new Option(carreira, carreira)));
  periodos.forEach((periodo) => $('filtro-periodo').appendChild(new Option(periodo, periodo)));
}

/* ---------------- dados ---------------- */

function parametros(extra = {}) {
  const busca = new URLSearchParams();
  Object.entries({ ...estado.filtros, ...extra }).forEach(([chave, valor]) => {
    if (valor) busca.set(chave, valor);
  });
  return busca;
}

async function carregarResumo() {
  const resumo = await api('/resumo');
  const rotulo = (valor) => estado.opcoes.status.find((s) => s.valor === valor)?.rotulo || valor;

  const cartoes = [
    { valor: resumo.total, rotulo: 'Fichas recebidas' },
    { valor: resumo.ultimos7, rotulo: 'Últimos 7 dias' },
    ...estado.opcoes.status.map((s) => ({ valor: resumo.porStatus[s.valor] || 0, rotulo: rotulo(s.valor) })),
  ];

  const container = $('cartoes');
  container.replaceChildren();
  cartoes.forEach((cartao) => {
    const div = document.createElement('div');
    div.className = 'cartao';
    const forte = document.createElement('strong');
    forte.textContent = cartao.valor;
    const span = document.createElement('span');
    span.textContent = cartao.rotulo;
    div.append(forte, span);
    container.appendChild(div);
  });
}

async function carregarLista() {
  const busca = parametros({ pagina: estado.pagina, porPagina: estado.porPagina });
  const resultado = await api(`/inscricoes?${busca}`);

  estado.paginas = resultado.paginas;
  estado.total = resultado.total;

  const corpo = $('corpo-tabela');
  corpo.replaceChildren();

  resultado.itens.forEach((inscricao) => {
    const linha = document.createElement('tr');
    linha.tabIndex = 0;
    linha.addEventListener('click', () => abrirDetalhe(inscricao.protocolo));
    linha.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') abrirDetalhe(inscricao.protocolo);
    });

    const celula = (texto, classe) => {
      const td = document.createElement('td');
      if (classe) td.className = classe;
      td.textContent = texto || '—';
      return td;
    };

    const candidato = document.createElement('td');
    candidato.className = 'nome';
    const nome = document.createElement('strong');
    nome.textContent = inscricao.nome;
    const email = document.createElement('span');
    email.textContent = inscricao.email;
    candidato.append(nome, email);

    const status = document.createElement('td');
    const selo = document.createElement('span');
    selo.className = `selo selo--${inscricao.status}`;
    selo.textContent = estado.opcoes.status.find((s) => s.valor === inscricao.status)?.rotulo || inscricao.status;
    status.appendChild(selo);

    linha.append(
      celula(inscricao.protocolo, 'protocolo'),
      candidato,
      celula(inscricao.periodo),
      celula(inscricao.carreira),
      status,
      celula(formatarData(inscricao.criado_em)),
    );
    corpo.appendChild(linha);
  });

  $('tabela-vazia').hidden = resultado.itens.length > 0;
  $('paginacao-texto').textContent = `${resultado.total} ficha(s) · página ${resultado.pagina} de ${resultado.paginas}`;
  $('btn-anterior').disabled = resultado.pagina <= 1;
  $('btn-proxima').disabled = resultado.pagina >= resultado.paginas;
}

/* ---------------- detalhe ---------------- */

async function abrirDetalhe(protocolo) {
  const inscricao = await api(`/inscricoes/${protocolo}`);
  estado.atual = inscricao;

  $('detalhe-nome').textContent = inscricao.nome;
  $('detalhe-protocolo').textContent = `${inscricao.protocolo} · recebida em ${formatarData(inscricao.criado_em)}`;
  $('detalhe-status').value = inscricao.status;
  $('detalhe-observacoes').value = inscricao.observacoes || '';
  alerta($('detalhe-alerta'), '');

  const conteudo = $('detalhe-conteudo');
  conteudo.replaceChildren();

  estado.opcoes.etapas.forEach((etapa) => {
    const grupo = document.createElement('div');
    grupo.className = 'detalhe__grupo';
    const titulo = document.createElement('h3');
    titulo.textContent = etapa.titulo;
    grupo.appendChild(titulo);

    const lista = document.createElement('dl');
    etapa.campos.forEach((campo) => {
      const valor = formatarValor(campo, inscricao.dados[campo.nome]);
      const linha = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = campo.tipo === 'consentimento' ? 'Autorização de uso dos dados' : campo.rotulo;
      const dd = document.createElement('dd');
      dd.textContent = valor;
      linha.append(dt, dd);
      lista.appendChild(linha);
    });

    grupo.appendChild(lista);
    conteudo.appendChild(grupo);
  });

  $('detalhe').showModal();
}

/* ---------------- eventos ---------------- */

$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  alerta($('login-alerta'), '');
  try {
    await api('/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: $('usuario').value, senha: $('senha').value }),
    });
    $('senha').value = '';
    await mostrarPainel();
  } catch (erro) {
    if (erro.message !== 'sessao') alerta($('login-alerta'), erro.message);
  }
});

$('btn-sair').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {});
  estado.opcoes = null;
  location.reload();
});

let tempoBusca;
$('filtro-busca').addEventListener('input', (evento) => {
  clearTimeout(tempoBusca);
  tempoBusca = setTimeout(() => {
    estado.filtros.busca = evento.target.value.trim();
    estado.pagina = 1;
    carregarLista();
  }, 320);
});

['status', 'carreira', 'periodo'].forEach((chave) => {
  $(`filtro-${chave}`).addEventListener('change', (evento) => {
    estado.filtros[chave] = evento.target.value;
    estado.pagina = 1;
    carregarLista();
  });
});

$('btn-limpar').addEventListener('click', () => {
  estado.filtros = { busca: '', status: '', carreira: '', periodo: '' };
  estado.pagina = 1;
  $('filtro-busca').value = '';
  ['status', 'carreira', 'periodo'].forEach((chave) => { $(`filtro-${chave}`).value = ''; });
  carregarLista();
});

$('btn-anterior').addEventListener('click', () => {
  if (estado.pagina > 1) { estado.pagina -= 1; carregarLista(); }
});
$('btn-proxima').addEventListener('click', () => {
  if (estado.pagina < estado.paginas) { estado.pagina += 1; carregarLista(); }
});

$('btn-atualizar').addEventListener('click', () => Promise.all([carregarResumo(), carregarLista()]));

$('btn-csv').addEventListener('click', () => {
  window.location.href = `/api/admin/inscricoes.csv?${parametros()}`;
});

$('detalhe-fechar').addEventListener('click', () => $('detalhe').close());

$('detalhe-salvar').addEventListener('click', async () => {
  if (!estado.atual) return;
  try {
    await api(`/inscricoes/${estado.atual.protocolo}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: $('detalhe-status').value, observacoes: $('detalhe-observacoes').value }),
    });
    alerta($('detalhe-alerta'), 'Alterações salvas.', 'ok');
    await Promise.all([carregarResumo(), carregarLista()]);
  } catch (erro) {
    if (erro.message !== 'sessao') alerta($('detalhe-alerta'), erro.message);
  }
});

$('detalhe-excluir').addEventListener('click', async () => {
  if (!estado.atual) return;
  const confirmado = window.confirm(`Excluir definitivamente a ficha ${estado.atual.protocolo}? Esta ação não pode ser desfeita.`);
  if (!confirmado) return;
  try {
    await api(`/inscricoes/${estado.atual.protocolo}`, { method: 'DELETE' });
    $('detalhe').close();
    await Promise.all([carregarResumo(), carregarLista()]);
  } catch (erro) {
    if (erro.message !== 'sessao') alerta($('detalhe-alerta'), erro.message);
  }
});

/* ---------------- inicialização ---------------- */

(async function iniciar() {
  try {
    const { autenticado } = await api('/sessao');
    if (autenticado) await mostrarPainel();
    else mostrarLogin();
  } catch {
    mostrarLogin();
  }
})();
