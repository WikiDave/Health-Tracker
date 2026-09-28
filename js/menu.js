/* Menu-indeling: hoofdmenu met groepen, overzichtspagina's (tegels) per groep en een submenu binnen een groep. */
(function (HT) {
  'use strict';
  const { store, ui, utils, views } = HT;
  const { escapeHtml: esc, todayISO, formatNum, formatDateShort, sortBy } = utils;

  const today = () => todayISO();
  const dayRec = () => store.checkinFor(today()) || {};

  // Elk onderdeel: route, icoon, naam, korte uitleg en (optioneel) een actuele stand voor de tegel.
  const GROUPS = [
    {
      route: 'dagboek', icon: '📔', label: 'Dagboek', intro: 'Alles wat je dagelijks bijhoudt.',
      items: [
        { route: 'welzijn', icon: '🧠', label: 'Welzijn', text: 'Vermoeidheid, stress, stemming en zelftests',
          status: () => { const c = dayRec(); return c.fatigue != null ? `Vandaag moe ${c.fatigue}/10` : ''; } },
        { route: 'slaap', icon: '🌙', label: 'Slaap', text: 'Hoe je hebt geslapen',
          status: () => { const c = dayRec(); return c.sleepHours != null ? `Afgelopen nacht ${formatNum(c.sleepHours)} uur` : 'Afgelopen nacht nog niet ingevuld'; } },
        { route: 'pijn', icon: '⚡', label: 'Pijn', text: 'Pijndagboek',
          status: () => { const n = store.list('pain').filter((e) => e.date === today()).length; return n ? `Vandaag ${n}× genoteerd` : ''; } },
        { route: 'sport', icon: '🏃', label: 'Sport', text: 'Beweging en activiteiten',
          status: () => `${formatNum(views.sport.thisWeek(today()))} van 150 min deze week` },
        { route: 'voeding', icon: '🥗', label: 'Voeding', text: 'Eetdagboek, groente en fruit',
          status: () => { const n = store.list('food').filter((e) => e.date === today()).length; return n ? `Vandaag ${n} maaltijd${n === 1 ? '' : 'en'}` : ''; } },
        { route: 'drinken', icon: '💧', label: 'Drinken', text: 'Hoeveel je drinkt',
          status: () => `Vandaag ${formatNum(utils.fluidMl(dayRec()) || 0)} / ${formatNum(views.hydration.settings().goal)} ml` },
        { route: 'stoelgang', icon: '🚽', label: 'Stoelgang', text: 'Bristol-schaal en bijzonderheden',
          status: () => { const n = store.list('bowel').filter((e) => e.date === today()).length; return n ? `Vandaag ${n}×` : ''; } },
        { route: 'middelen', icon: '🍷', label: 'Middelen', text: 'Alcohol, roken, cafeïne, drugs',
          status: () => { const q = views.substances.quitStats(today()); return q ? `🚭 ${q.days} dagen rookvrij` : ''; } },
        { route: 'omgeving', icon: '🌳', label: 'Omgeving', text: 'Werk, buiten, feest en sociaal',
          status: () => { const c = dayRec(); return c.work || c.outsideMinutes != null ? 'Vandaag ingevuld' : ''; } },
      ],
    },
    {
      route: 'medicijnen', icon: '💊', label: 'Medicijnen', intro: 'Wat je inneemt en wat er is voorgeschreven.',
      items: [
        { route: 'medicatie', icon: '💊', label: 'Medicatie', text: 'Medicijnen, innames en voorraad',
          status: () => { const d = views.medication.dosesFor(today(), (m) => m.kind !== 'supplement'); return d.length ? `Vandaag ${d.filter((x) => x.taken).length} van ${d.length} ingenomen` : ''; } },
        { route: 'supplementen', icon: '🌿', label: 'Supplementen', text: 'Vitamines en supplementen',
          status: () => { const d = views.medication.dosesFor(today(), (m) => m.kind === 'supplement'); return d.length ? `Vandaag ${d.filter((x) => x.taken).length} van ${d.length} ingenomen` : ''; } },
        { route: 'recepten', icon: '📄', label: 'Voorschriften', text: 'Recepten en verwijzingen',
          status: () => { const n = store.list('prescriptions').filter(views.prescriptions.isOpen).length; return n ? `${n} lopend` : ''; } },
      ],
    },
    {
      route: 'medisch', icon: '🏥', label: 'Medisch', intro: 'Uitslagen, afspraken en vaccinaties.',
      items: [
        { route: 'bloed', icon: '🩸', label: 'Bloed', text: 'Bloedonderzoeken en verloop',
          status: () => { const l = sortBy(store.list('labs'), 'date', -1)[0]; return l ? `Laatste ${formatDateShort(l.date)}` : ''; } },
        { route: 'bezoeken', icon: '🏥', label: 'Bezoeken', text: 'Huisarts, ziekenhuis en specialist',
          status: () => { const v = sortBy(store.list('visits').filter((x) => x.date >= today()), 'date')[0]; return v ? `Volgende ${formatDateShort(v.date)}` : ''; } },
        { route: 'vaccinaties', icon: '💉', label: 'Vaccinaties', text: 'Prikken en wanneer de volgende',
          status: () => { const n = utils.vaccinationsDue(store.list('vaccinations'), today()).length; return n ? `${n} binnenkort nodig` : ''; } },
      ],
    },
  ];

  // Routes die bij het profiel horen (voor de actieve markering).
  const PROFILE_ROUTES = ['profiel', 'overzicht'];

  /** Geeft de groep terug waar een route bij hoort (of de groep zelf). */
  function groupOf(route) {
    return GROUPS.find((g) => g.route === route || g.items.some((i) => i.route === route)) || null;
  }

  /** De hoofdmenu-knop die actief moet zijn voor deze route. */
  function topRouteOf(route) {
    if (PROFILE_ROUTES.includes(route)) return 'profiel';
    const g = groupOf(route);
    return g ? g.route : route;
  }

  function safeStatus(item) {
    try { return item.status ? item.status() : ''; } catch (e) { return ''; }
  }

  /** Submenu (knoppenrij) binnen een groep. */
  function subnavHtml(route) {
    const g = groupOf(route);
    if (!g || g.route === route) return '';
    return `<nav class="subnav-row" aria-label="${esc(g.label)}">
      <a href="#/${g.route}" class="subnav-home" aria-label="Alle onderdelen van ${esc(g.label)}">${g.icon}</a>
      ${g.items.map((i) => `<a href="#/${i.route}"${i.route === route ? ' aria-current="page"' : ''}><span aria-hidden="true">${i.icon}</span>${esc(i.label)}</a>`).join('')}
    </nav>`;
  }

  function hubView(g) {
    return {
      title: g.label,
      render(el) {
        el.innerHTML = `
          ${ui.pageHead(g.label)}
          <p class="muted">${esc(g.intro)}</p>
          <div class="tiles">${g.items.map((i) => {
            const status = safeStatus(i);
            return `<a class="tile" href="#/${i.route}">
              <span class="tile-icon" aria-hidden="true">${i.icon}</span>
              <span class="tile-title">${esc(i.label)}</span>
              <span class="tile-text">${esc(i.text)}</span>
              ${status ? `<span class="tile-status">${esc(status)}</span>` : ''}
            </a>`;
          }).join('')}</div>`;
      },
    };
  }

  for (const g of GROUPS) views[`hub_${g.route}`] = hubView(g);

  HT.menu = { GROUPS, groupOf, topRouteOf, subnavHtml, hubRoutes: Object.fromEntries(GROUPS.map((g) => [g.route, views[`hub_${g.route}`]])) };
})(window.HT);
