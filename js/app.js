/* Router: koppelt de adresbalk (#/...) aan een scherm en tekent opnieuw bij wijzigingen. */
(function (HT) {
  'use strict';
  const { store, views } = HT;

  const ROUTES = {
    '': views.dashboard,
    check: views.checkin,
    welzijn: views.wellbeing,
    medicatie: views.medication,
    supplementen: views.supplements,
    drinken: views.hydration,
    pijn: views.pain,
    sport: views.sport,
    stoelgang: views.bowel,
    slaap: views.sleep,
    voeding: views.nutrition,
    middelen: views.substances,
    omgeving: views.environment,
    bloed: views.labs,
    recepten: views.prescriptions,
    bezoeken: views.visits,
    vaccinaties: views.vaccinations,
    profiel: views.profile,
    overzicht: views.overview,
    ...HT.menu.hubRoutes,
  };

  const main = document.getElementById('app');
  const subnav = document.getElementById('subnav');

  function parseRoute() {
    const [name = '', ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    return { name: ROUTES[name] ? name : '', param: rest.length ? decodeURIComponent(rest.join('/')) : null };
  }

  function render() {
    const { name, param } = parseRoute();
    const view = ROUTES[name];
    view.render(main, param);
    subnav.innerHTML = HT.menu.subnavHtml(name);
    // Actief onderdeel in beeld schuiven, alleen horizontaal (de pagina zelf blijft staan).
    const row = subnav.querySelector('.subnav-row');
    const current = subnav.querySelector('[aria-current]');
    if (row && current) row.scrollLeft = current.offsetLeft - row.clientWidth / 2 + current.offsetWidth / 2;
    document.title = `${view.title} · Gezondheid`;
    const top = HT.menu.topRouteOf(name);
    document.querySelectorAll('.nav a').forEach((a) => {
      const target = a.getAttribute('href').replace(/^#\/?/, '');
      if (target === top) a.setAttribute('aria-current', 'page');
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
    // Is er een nieuwe versie actief geworden? Dan één keer herladen, zodat je meteen de nieuwe app ziet.
    // (Niet bij de allereerste installatie: dan was er nog geen oude versie.)
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      // Niet herladen midden in een formulier: wacht tot het formulier dicht is.
      const dialog = document.getElementById('form-dialog');
      if (dialog.open) dialog.addEventListener('close', () => location.reload(), { once: true });
      else location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Controleer op updates wanneer de app weer in beeld komt.
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      })
      .catch(() => {});
  }
})(window.HT);
