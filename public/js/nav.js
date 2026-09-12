/* Menu responsivo + revelação de blocos ao rolar. */
(() => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu-principal');

  if (toggle && menu) {
    const fechar = () => {
      menu.dataset.aberto = 'false';
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      const aberto = menu.dataset.aberto === 'true';
      menu.dataset.aberto = String(!aberto);
      toggle.setAttribute('aria-expanded', String(!aberto));
    });

    menu.addEventListener('click', (evento) => {
      if (evento.target.closest('a')) fechar();
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') fechar();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) fechar();
    });
  }

  const alvos = document.querySelectorAll('.revelar');
  if (!alvos.length) return;

  if (!('IntersectionObserver' in window)) {
    alvos.forEach((el) => el.classList.add('visivel'));
    return;
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada, indice) => {
        if (!entrada.isIntersecting) return;
        setTimeout(() => entrada.target.classList.add('visivel'), indice * 70);
        observador.unobserve(entrada.target);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
  );

  alvos.forEach((el) => observador.observe(el));
})();
