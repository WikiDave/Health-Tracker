/* Router: koppelt de adresbalk (#/...) aan een scherm en tekent opnieuw bij wijzigingen. */
(function (HT) {
  'use strict';
  const { store, views } = HT;

  const ROUTES = {
    '': views.dashboard,
    check: views.checkin,
    medicatie: views.medication,
    bloed: views.labs,
    recepten: views.prescriptions,
    bezoeken: views.visits,
    profiel: views.profile,
    overzicht: views.overview,
  };

  const main = document.getElementById('app');

  function parseRoute() {
    const [name = '', ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    return { name: ROUTES[name] ? name : '', param: rest.length ? decodeURIComponent(rest.join('/')) : null };
  }

  function render() {
    const { name, param } = parseRoute();
    const view = ROUTES[name];
    view.render(main, param);
    document.title = `${view.title} · Gezondheid`;
    document.querySelectorAll('.nav a').forEach((a) => {
      const target = a.getAttribute('href').replace(/^#\/?/, '');
      if (target === name || (name === 'overzicht' && target === 'profiel')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });

  // Bij opslaan hetzelfde scherm opnieuw tekenen en de scrollpositie behouden.
  store.onChange(() => {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  });

  // Grafieken schalen mee met de schermbreedte.
  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (main.querySelector('.chart')) {
        const y = window.scrollY;
        render();
        window.scrollTo(0, y);
      }
    }, 200);
  });

  // Nieuwe dag na middernacht? Dan het startscherm verversen wanneer de app weer zichtbaar wordt.
  let renderedDay = HT.utils.todayISO();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && HT.utils.todayISO() !== renderedDay) {
      renderedDay = HT.utils.todayISO();
      render();
    }
  });

  render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})(window.HT);
