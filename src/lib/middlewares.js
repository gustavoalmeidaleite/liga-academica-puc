/** Middlewares pequenos o bastante para não justificarem dependências extras. */

/** Preenche req.cookies a partir do header Cookie (substitui o cookie-parser). */
export function lerCookies(req, _res, next) {
  const bruto = req.headers.cookie || '';
  req.cookies = Object.create(null);
  for (const parte of bruto.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 1) continue;
    const chave = parte.slice(0, igual).trim();
    const valor = parte.slice(igual + 1).trim();
    try {
      req.cookies[chave] = decodeURIComponent(valor);
    } catch {
      req.cookies[chave] = valor;
    }
  }
  next();
}

/**
 * Limitador de requisições em memória — suficiente para uma instância única.
 * Para múltiplas instâncias, trocar por um contador no banco/Redis.
 */
export function limitarRequisicoes({ janelaMs, max }) {
  const registros = new Map();

  setInterval(() => {
    const agora = Date.now();
    for (const [chave, dados] of registros) {
      if (agora > dados.reinicia) registros.delete(chave);
    }
  }, janelaMs).unref();

  return (req, res, next) => {
    const chave = req.ip || req.socket.remoteAddress || 'desconhecido';
    const agora = Date.now();
    const atual = registros.get(chave);

    if (!atual || agora > atual.reinicia) {
      registros.set(chave, { contagem: 1, reinicia: agora + janelaMs });
      return next();
    }

    atual.contagem += 1;
    if (atual.contagem > max) {
      const segundos = Math.ceil((atual.reinicia - agora) / 1000);
      res.set('Retry-After', String(segundos));
      return res.status(429).json({
        erro: 'Muitos envios a partir deste endereço. Tente novamente em alguns minutos.',
      });
    }
    return next();
  };
}

/** Cabeçalhos de segurança básicos (evita a dependência do helmet). */
export function cabecalhosSeguranca(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
    ].join('; '),
  );
  next();
}
