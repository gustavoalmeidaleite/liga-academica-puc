/**
 * Fonte única de verdade da ficha de inscrição.
 *
 * O mesmo schema é usado para:
 *  - renderizar o formulário no navegador (GET /api/form-schema);
 *  - validar o envio no servidor (src/lib/validacao.js);
 *  - montar o CSV e o detalhe do painel administrativo.
 *
 * Ao adicionar um campo aqui ele aparece automaticamente nos três lugares.
 */

export const PERIODOS = [
  '1º período', '2º período', '3º período', '4º período', '5º período',
  '6º período', '7º período', '8º período', '9º período', '10º período', 'Outro',
];

export const CARREIRAS = [
  'Polícia Militar',
  'Polícia Civil',
  'Polícia Federal',
  'Polícia Penal',
  'Polícia Científica/Perícia',
  'PRF',
  'Outra carreira pública',
];

export const DISPONIBILIDADES = [
  'Eventos presenciais',
  'Projetos de extensão',
  'Organização de eventos',
  'Produção acadêmica e pesquisas',
];

export const STATUS = ['novo', 'em_analise', 'aprovado', 'recusado'];

export const STATUS_ROTULOS = {
  novo: 'Novo',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
};

/** Etapas do cadastro. Cada etapa vira uma tela do formulário. */
export const ETAPAS = [
  {
    id: 'identificacao',
    titulo: 'Identificação',
    resumo: 'Quem é você',
    descricao: 'Dados básicos para montarmos sua ficha e falarmos com você.',
    campos: [
      { nome: 'nome_completo', rotulo: 'Nome completo', tipo: 'text', obrigatorio: true, maxLength: 140, placeholder: 'Ex: Maria da Silva Santos', autocomplete: 'name' },
      { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'date', obrigatorio: true, autocomplete: 'bday' },
      { nome: 'cpf', rotulo: 'CPF', tipo: 'cpf', obrigatorio: true, placeholder: '000.000.000-00', ajuda: 'Usado apenas para identificação interna da liga.' },
      { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, maxLength: 160, placeholder: 'seuemail@exemplo.com', autocomplete: 'email', ajuda: 'Pode ser pessoal, não precisa ser o institucional. A confirmação chega aqui.' },
      { nome: 'telefone', rotulo: 'Telefone / WhatsApp', tipo: 'telefone', obrigatorio: true, placeholder: '(62) 90000-0000', autocomplete: 'tel' },
      { nome: 'cidade', rotulo: 'Cidade', tipo: 'text', obrigatorio: true, maxLength: 80, placeholder: 'Goiânia' },
      { nome: 'instagram', rotulo: 'Instagram', tipo: 'text', obrigatorio: false, maxLength: 60, placeholder: '@seuusuario' },
    ],
  },
  {
    id: 'academico',
    titulo: 'Vínculo acadêmico',
    resumo: 'Sua graduação',
    descricao: 'Onde você está hoje dentro da universidade.',
    campos: [
      { nome: 'matricula', rotulo: 'Número de matrícula', tipo: 'matricula', obrigatorio: true, placeholder: 'Somente números', ajuda: 'Até 14 dígitos.' },
      { nome: 'curso', rotulo: 'Curso', tipo: 'text', obrigatorio: true, maxLength: 80, padrao: 'Direito' },
      { nome: 'periodo', rotulo: 'Período', tipo: 'select', obrigatorio: true, opcoes: PERIODOS },
      { nome: 'participou_projetos', rotulo: 'Já participou de projetos, ligas ou grupos acadêmicos?', tipo: 'textarea', obrigatorio: false, maxLength: 1200, placeholder: 'Conte quais e por quanto tempo. Se nunca participou, escreva "não".' },
      { nome: 'cursos_extras', rotulo: 'Possui cursos extracurriculares?', tipo: 'textarea', obrigatorio: false, maxLength: 1200, placeholder: 'Cursos livres, idiomas, tiro, defesa pessoal, informática...' },
    ],
  },
  {
    id: 'carreira',
    titulo: 'Objetivo profissional',
    resumo: 'Onde quer chegar',
    descricao: 'Isso nos ajuda a direcionar simulados, convidados e material de estudo.',
    campos: [
      { nome: 'carreira', rotulo: 'Qual carreira policial ou área pretende seguir?', tipo: 'radio', obrigatorio: true, opcoes: CARREIRAS },
      { nome: 'carreira_outra', rotulo: 'Se marcou "Outra carreira pública", qual?', tipo: 'text', obrigatorio: false, maxLength: 120, dependeDe: { campo: 'carreira', valor: 'Outra carreira pública' } },
      { nome: 'areas_interesse', rotulo: 'Quais áreas da segurança pública mais despertam seu interesse?', tipo: 'textarea', obrigatorio: false, maxLength: 1200, placeholder: 'Administrativa, operacional, inteligência, perícia...' },
    ],
  },
  {
    id: 'rotina',
    titulo: 'Rotina e desenvolvimento',
    resumo: 'Como você estuda',
    descricao: 'Não existe resposta certa ou errada. Responda com sinceridade.',
    campos: [
      { nome: 'rotina', rotulo: 'Como é sua rotina hoje?', tipo: 'textarea', obrigatorio: true, maxLength: 2000, placeholder: 'Trabalho, estágio, horários de aula, tempo livre para estudo...' },
      { nome: 'objetivos', rotulo: 'Quais são seus principais objetivos para os próximos anos?', tipo: 'textarea', obrigatorio: true, maxLength: 2000 },
      { nome: 'qualidades', rotulo: 'Quais qualidades você acredita possuir que colaborem para a carreira?', tipo: 'textarea', obrigatorio: false, maxLength: 2000 },
      { nome: 'pontos_melhorar', rotulo: 'Quais pontos deseja melhorar em si mesmo(a)?', tipo: 'textarea', obrigatorio: false, maxLength: 2000 },
      { nome: 'pressao', rotulo: 'Como você lida com pressão, cobrança e responsabilidade?', tipo: 'textarea', obrigatorio: false, maxLength: 2000 },
    ],
  },
  {
    id: 'integracao',
    titulo: 'Integração e acompanhamento',
    resumo: 'Opcional',
    descricao: 'Tudo nesta etapa é opcional e fica restrito à coordenação. Serve para acolher melhor cada membro.',
    campos: [
      { nome: 'religiao', rotulo: 'Religião ou crença', tipo: 'text', obrigatorio: false, maxLength: 80 },
      { nome: 'pratica_equilibrio', rotulo: 'Existe alguma prática, valor ou hábito importante para seu equilíbrio pessoal?', tipo: 'textarea', obrigatorio: false, maxLength: 1200 },
      { nome: 'dificuldade', rotulo: 'Existe alguma dificuldade pessoal, emocional ou acadêmica que a diretoria deva compreender?', tipo: 'textarea', obrigatorio: false, maxLength: 2000 },
      { nome: 'instrumento_estudo', rotulo: 'Qual instrumento você usa para estudar?', tipo: 'text', obrigatorio: false, maxLength: 120, placeholder: 'Caderno, tablet, aplicativo de questões...' },
    ],
  },
  {
    id: 'disponibilidade',
    titulo: 'Disponibilidade',
    resumo: 'Sua participação',
    descricao: 'Última etapa. Marque o que faz sentido para o seu momento.',
    campos: [
      { nome: 'disponibilidade', rotulo: 'Tem disponibilidade para participar de:', tipo: 'checkboxes', obrigatorio: false, opcoes: DISPONIBILIDADES },
      { nome: 'periodo_disponibilidade', rotulo: 'Qual período possui maior disponibilidade?', tipo: 'text', obrigatorio: false, maxLength: 120, placeholder: 'Manhãs, noites, fins de semana...' },
      { nome: 'consentimento', rotulo: 'Autorizo o GRUPAMENTO a usar meus dados para organizar a lista de membros e enviar informações sobre atividades da liga.', tipo: 'consentimento', obrigatorio: true },
    ],
  },
];

/** Lista plana de todos os campos, na ordem das etapas. */
export const CAMPOS = ETAPAS.flatMap((etapa) => etapa.campos);

/** Índice nome -> campo. */
export const CAMPOS_POR_NOME = Object.fromEntries(CAMPOS.map((c) => [c.nome, c]));
