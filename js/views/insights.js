/* Verbanden: wat hangt met wat samen (alle onderdelen door elkaar), het dagoverzicht van één dag,
 * en de blokjes "Hangt samen met…" op de andere schermen en "Wat valt op" op het startscherm. */
(function (HT) {
  'use strict';
  const { store, ui, utils, views, insights: I } = HT;
  const { escapeHtml: esc, todayISO, addDays, formatDateLong, formatNum, sortBy } = utils;
  const V = I.VARS;

  // Uitrekenen kost even; bewaren tot er iets verandert.
  let cache = null;
  store.onChange(() => { cache = null; });
  function computed() {
    if (!cache) {
      const rows = I.table(store.data);
      cache = { rows, all: I.relate(store.data, { rows }) };
    }
    return cache;
  }

  // Welke variabelen horen bij welk scherm.
  const ROUTE_KEYS = {
    slaap: ['sleepHours', 'sleepQuality', 'wakeFeeling', 'snoozed', 'screenBeforeBed'],
    energie: ['energyScore', 'fatigue'],
    welzijn: ['mood', 'stress', 'anxiety', 'gloom', 'fatigue'],
    pijn: ['pain'],
    sport: ['sportMin', 'strength', 'steps'],
    voeding: ['meals', 'foodComplaint', 'veg', 'fruit'],
    weekmenu: ['meals', 'foodComplaint', 'veg'],
    drinken: ['fluid'],
    stoelgang: ['bristol'],
    middelen: ['alcohol', 'coffee', 'cigarettes', 'drugs'],
    omgeving: ['worked', 'workLoad', 'outside', 'party', 'social', 'screenTime'],
    focus: ['focus', 'focusMin', 'tasksDone', 'procrastinated', 'restless', 'overstimulated', 'adhdMed'],
    medicatie: ['adherence', 'adhdMed'],
    check: ['mood', 'fatigue', 'steps', 'weight'],
  };

  const OUTCOME_CHOICES = [
    ['energyScore', '🔋 Energie'], ['mood', '🙂 Stemming'], ['sleepQuality', '🌙 Slaapkwaliteit'], ['sleepHours', '😴 Uren slaap'],
    ['wakeFeeling', '🌅 Opstaan'], ['pain', '⚡ Pijn'], ['stress', '😣 Stress'], ['anxiety', '😟 Angst/onrust'], ['gloom', '🌧 Somberheid'],
    ['focus', '🎯 Concentratie'], ['focusMin', '⏱ Focusminuten'], ['tasksDone', '✓ Taken af'], ['procrastinated', '⏳ Uitstellen'],
    ['restless', '🌀 Onrust (ADHD)'], ['overstimulated', '🔊 Overprikkeling'], ['bristol', '🚽 Stoelgang'],
  ];

  const pct = (res) => Math.min(100, Math.round(Math.abs(res.relDiff) * 200));
  const kindOf = (res) => (res.good == null ? 'neutral' : res.good ? 'good' : 'bad');

  /** Het andere onderdeel van een verband, gezien vanaf een variabele. */
  function linkFor(res) {
    const x = V[res.x];
    return x.route ? `#/${x.route}` : '';
  }

  function itemHtml(res, opts = {}) {
    const k = kindOf(res);
    const icon = k === 'good' ? '▲' : k === 'bad' ? '▼' : '•';
    const link = opts.link !== false ? linkFor(res) : '';
    return `<li class="insight ${k}">
      <span class="insight-icon" aria-hidden="true">${icon}</span>
      <div class="insight-body">
        <p>${esc(I.describe(res))}</p>
        <div class="insight-bar" aria-hidden="true"><span class="${k}" style="width:${Math.max(6, pct(res))}%"></span></div>
        <small class="muted">${esc(res.strength)} verband · ${res.n} dagen (${res.nWith} wel, ${res.nWithout} niet)${link ? ` · <a href="${link}">naar ${esc(V[res.x].label.replace(/ \(de dag ervoor\)$/, ''))}</a>` : ''}</small>
      </div>
    </li>`;
  }

  const DISCLAIMER = '<p class="muted small">Een verband is geen bewijs dat het een het ander veroorzaakt: het laat zien wat bij jou vaak samen voorkomt. Hoe langer je bijhoudt, hoe betrouwbaarder. Bespreek grote veranderingen met je huisarts.</p>';

  /** Hoeveel dagen gegevens er zijn en wat er nog nodig is. */
  function notEnoughHtml(rows) {
    const n = rows.filter((r) => Object.values(r).filter((v) => v != null).length > 3).length;
    return `<p>Nog niet genoeg gegevens om verbanden te vinden. Je hebt nu <strong>${n}</strong> dag${n === 1 ? '' : 'en'} met gegevens; vanaf ongeveer <strong>10 dagen</strong> (met afwisseling: goede én slechte dagen) verschijnen de eerste verbanden.</p>
      <p class="muted">Tip: doe elke dag de <a href="#/check">check</a>, tik een paar keer je <a href="#/energie">energie</a> aan en noteer <a href="#/slaap">slaap</a>, <a href="#/sport">sport</a> en <a href="#/middelen">middelen</a>. Hoe meer onderdelen je bijhoudt, hoe meer verbanden de app kan leggen.</p>`;
  }

  // ---------- Scherm Verbanden ----------
  function renderRelations(el, param) {
    const { rows, all } = computed();
    const outcome = param && V[param] && V[param].outcome ? param : '';
    const list = outcome ? all.filter((r) => r.y === outcome || (r.x === outcome && V[r.y].outcome)) : all;
    // Vanuit de gekozen uitkomst bekeken: zet 'x' steeds als de factor.
    const shown = list.map((r) => (outcome && r.x === outcome ? I.pair(rows, r.y, r.x) || r : r)).filter((r) => !outcome || (r.y === outcome && !V[r.x].noFactor));
    const good = shown.filter((r) => r.good === true);
    const bad = shown.filter((r) => r.good === false);
    const neutral = shown.filter((r) => r.good == null);
    const counts = Object.fromEntries(OUTCOME_CHOICES.map(([k]) => [k, all.filter((r) => r.y === k || r.x === k).length]));

    el.innerHTML = `
      ${ui.pageHead('Verbanden', `<a class="btn ghost" href="#/dag/${todayISO()}">📅 Dagoverzicht</a>`)}
      <p class="muted">Alles wat je bijhoudt wordt met elkaar vergeleken: slaap, energie, stemming, pijn, sport, eten, drinken, medicijnen, middelen, omgeving, focus en stoelgang – ook met wat je de dag ervoor deed.</p>
      <nav class="filter-row" aria-label="Kies waar je naar kijkt">
        <a class="fchip${outcome ? '' : ' active'}" href="#/verbanden">Alles${all.length ? ` (${all.length})` : ''}</a>
        ${OUTCOME_CHOICES.map(([k, label]) => `<a class="fchip${outcome === k ? ' active' : ''}" href="#/verbanden/${k}">${esc(label)}${counts[k] ? ` (${counts[k]})` : ''}</a>`).join('')}
      </nav>
      ${!all.length ? `<section class="card">${notEnoughHtml(rows)}</section>` : outcome ? `
        <section class="card">
          <h2>Wat gaat samen met ${esc(outcome === 'bristol' ? 'je stoelgang' : `je ${V[outcome].label}`)}?</h2>
          ${shown.length ? '' : '<p class="muted">Hiervoor zijn (nog) geen duidelijke verbanden gevonden.</p>'}
          ${good.length ? `<h3 class="good-text">👍 Gaat samen met een betere ${esc(V[outcome].label)}</h3><ul class="insights">${good.map((r) => itemHtml(r)).join('')}</ul>` : ''}
          ${bad.length ? `<h3 class="bad-text">👎 Gaat samen met een slechtere ${esc(V[outcome].label)}</h3><ul class="insights">${bad.map((r) => itemHtml(r)).join('')}</ul>` : ''}
          ${neutral.length ? `<h3>Andere verbanden</h3><ul class="insights">${neutral.map((r) => itemHtml(r)).join('')}</ul>` : ''}
          ${DISCLAIMER}
        </section>` : `
        <section class="card">
          <h2>Sterkste verbanden</h2>
          <ul class="insights">${all.slice(0, 12).map((r) => itemHtml(r)).join('')}</ul>
          ${all.length > 12 ? `<details class="stopped"><summary>Alle ${all.length} verbanden</summary><ul class="insights">${all.slice(12).map((r) => itemHtml(r)).join('')}</ul></details>` : ''}
          ${DISCLAIMER}
        </section>`}
      <section class="card">
        <h2>Hoe werkt dit?</h2>
        <p>Voor elke dag zet de app alles wat je hebt ingevuld naast elkaar. Daarna vergelijkt hij dagen <em>met</em> en <em>zonder</em> iets (of met veel en weinig), bijvoorbeeld: hoe was je energie op dagen dat je sportte, en op dagen dat je niet sportte? Alleen verschillen die bij minstens 10 dagen steeds terugkomen worden getoond.</p>
        <p class="muted small">"(de dag ervoor)" betekent: wat je gisteren deed, naast hoe je je vandaag voelt – zoals alcohol of een feest en je energie de volgende dag.</p>
      </section>`;
  }

  // ---------- Dagoverzicht ----------
  const mealsOrder = ['Ontbijt', 'Tussendoor (ochtend)', 'Lunch', 'Tussendoor (middag)', 'Avondeten', 'Tussendoor (avond)'];

  function dayHtml(date) {
    const d = store.data;
    const c = store.checkinFor(date) || {};
    const on = (k) => (d[k] || []).filter((x) => x.date === date);
    const sections = [];
    const add = (icon, title, href, body) => { if (body) sections.push(`<section class="card day-part"><div class="card-head"><h2><span aria-hidden="true">${icon}</span> ${esc(title)}</h2>${href ? `<a href="${href}">Naar ${esc(title.toLowerCase())}</a>` : ''}</div>${body}</section>`); };
    const pills = (arr) => (arr.filter(Boolean).length ? `<ul class="pills">${arr.filter(Boolean).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '');

    add('🌙', 'Slaap', '#/slaap', pills([
      c.sleepHours != null && `${formatNum(c.sleepHours)} uur geslapen`, (c.bedtime || c.wakeTime) && `${c.bedtime || '?'} – ${c.wakeTime || '?'}`,
      c.sleepQuality != null && `kwaliteit ${c.sleepQuality}/5`, c.wakeFeeling != null && `opstaan ${c.wakeFeeling}/5`, c.wakeMethod, c.screenBeforeBed && `scherm voor bed: ${c.screenBeforeBed.toLowerCase()}`,
    ]));
    const energy = HT.energy.dayScore(c);
    const log = Array.isArray(c.energyLog) ? sortBy(c.energyLog, 'time') : [];
    add('🔋', 'Energie', '#/energie', energy != null ? `<p><strong>${energy}/100</strong>${log.length ? ` · ${log.map((x) => `${esc(x.time)} ${HT.energy.LEVELS.find((l) => l.value === x.level).icon}`).join(' · ')}` : ''}</p>` : '');
    if (store.checkinDone(date) || c.mood != null) add('✅', 'Check', '#/check', views.checkin.summaryHtml(c));
    const meds = store.list('medications').filter((m) => utils.isMedActiveOn(m, date));
    if (meds.length) add('💊', 'Medicatie', '#/medicatie', views.medication.doseListHtml(date));
    const pain = on('pain');
    add('⚡', 'Pijn', '#/pijn', pain.length ? `<ul class="list">${sortBy(pain, 'time').map((p) => `<li>${esc(p.time || '')} <strong>${p.intensity}/10</strong> ${esc(p.location || '')}</li>`).join('')}</ul>` : '');
    const sport = on('sport');
    add('🏃', 'Sport', '#/sport', sport.length ? `<ul class="list">${sport.map((s) => `<li><strong>${esc(s.activity || s.kind || 'Sport')}</strong>${s.duration ? ` · ${formatNum(s.duration)} min` : ''}${s.distance ? ` · ${formatNum(s.distance)} km` : ''}${s.intensity ? ` · ${esc(s.intensity.toLowerCase())}` : ''}</li>`).join('')}</ul>` : '');
    const food = sortBy(on('food'), (f) => `${mealsOrder.indexOf(f.meal)}${f.time || ''}`);
    add('🥗', 'Voeding', '#/voeding', (food.length ? `<ul class="list">${food.map((f) => `<li>${f.time ? `<span class="muted">${esc(f.time)}</span> ` : ''}<strong>${esc(f.meal || '')}</strong> ${esc(f.what || '')}${f.complaints ? ` ${ui.badge(`klachten: ${f.complaints}`, 'warn')}` : ''}</li>`).join('')}</ul>` : '')
      + pills([c.veg != null && `${formatNum(c.veg)} g groente`, c.fruit != null && `${formatNum(c.fruit)} fruit`]));
    const fluid = utils.fluidMl(c);
    add('💧', 'Drinken', '#/drinken', fluid ? `<p>${formatNum(fluid)} ml</p>` : '');
    const bowel = on('bowel');
    add('🚽', 'Stoelgang', '#/stoelgang', bowel.length ? pills(sortBy(bowel, 'time').map((b) => `${b.time || ''} type ${b.bristol}`.trim())) : '');
    add('🍷', 'Middelen', '#/middelen', pills([
      c.alcohol && `${formatNum(c.alcohol)} glazen alcohol`, c.coffee && `${formatNum(c.coffee)} koffie`, c.cigarettes && `${formatNum(c.cigarettes)} sigaretten`,
      Array.isArray(c.drugs) && c.drugs.length && `drugs: ${c.drugs.join(', ')}`,
    ]));
    add('🌳', 'Omgeving', '#/omgeving', pills([
      c.work, c.workLoad != null && `werkdruk ${c.workLoad}/10`, c.outsideMinutes != null && `${formatNum(c.outsideMinutes)} min buiten`, c.weather,
      c.party && '🎉 feest / uitgaan', c.social && '👥 mensen gezien', c.screenTime != null && `${formatNum(c.screenTime)} uur scherm`,
    ]));
    const focus = on('focus');
    const tasks = store.list('tasks').filter((t) => t.doneAt === date || (t.doneLog || []).includes(date));
    const proc = on('procrastination');
    add('🎯', 'Focus', '#/focus', [
      focus.length && `<p>${focus.length} focusblok${focus.length === 1 ? '' : 'ken'}, ${formatNum(Math.round(focus.reduce((s, f) => s + (f.actual || 0), 0)))} min</p>`,
      tasks.length && `<ul class="list">${tasks.map((t) => `<li>✓ ${esc(t.title)}</li>`).join('')}</ul>`,
      proc.length && `<p class="muted">${proc.length}× uitgesteld: ${esc(proc.map((p) => p.taskTitle).join(', '))}</p>`,
    ].filter(Boolean).join(''));
    const visits = on('visits');
    add('🏥', 'Bezoeken', '#/bezoeken', visits.length ? `<ul class="list">${visits.map((v) => `<li>${esc([v.time, v.type, v.specialty, v.doctor].filter(Boolean).join(' · '))}</li>`).join('')}</ul>` : '');
    const labs = on('labs');
    add('🩸', 'Bloed', '#/bloed', labs.length ? `<p>${labs.map((l) => `${(l.results || []).length} uitslagen`).join(', ')}</p>` : '');
    const vacc = on('vaccinations');
    add('💉', 'Vaccinaties', '#/vaccinaties', vacc.length ? pills(vacc.map((v) => v.vaccine || v.name)) : '');
    return sections;
  }

  function diffHtml(date) {
    const { rows } = computed();
    const diffs = I.dayVsNormal(store.data, date, rows);
    if (!diffs.length) return '';
    const fmt = (k, v) => `${formatNum(Math.abs(v) >= 20 ? Math.round(v) : Math.round(v * 10) / 10)}${V[k].unit ? (V[k].unit.startsWith('/') ? V[k].unit : ` ${V[k].unit}`) : ''}`;
    return `<section class="card">
      <h2>Anders dan normaal</h2>
      <p class="muted small">Vergeleken met je gemiddelde van de 30 dagen ervoor.</p>
      <ul class="insights">${diffs.slice(0, 8).map((x) => {
        const k = x.good == null ? 'neutral' : x.good ? 'good' : 'bad';
        return `<li class="insight ${k}"><span class="insight-icon" aria-hidden="true">${x.delta > 0 ? '↑' : '↓'}</span><div class="insight-body"><p><strong>${esc(V[x.key].label[0].toUpperCase() + V[x.key].label.slice(1))}</strong>: ${fmt(x.key, x.value)} <span class="muted">(normaal ${fmt(x.key, x.avg)})</span></p></div></li>`;
      }).join('')}</ul>
    </section>`;
  }

  /** Voor een dag: welke bekende verbanden kunnen verklaren waarom de dag zo was. */
  function explainHtml(date) {
    const { rows, all } = computed();
    const row = rows.find((r) => r.date === date);
    if (!row) return '';
    const out = [];
    for (const res of all) {
      if (!V[res.y].outcome || row[res.y] == null || row[res.x] == null || res.good == null) continue;
      const xv = V[res.x];
      const hasIt = xv.kind === 'bool' ? row[res.x] === true : res.loMax === res.threshold ? row[res.x] > res.threshold : row[res.x] >= res.threshold;
      if (!hasIt || out.some((o) => o.x === res.x)) continue;
      out.push({ x: res.x, text: `${res.good ? '👍' : '👎'} ${esc(I.valueText(res.x, row[res.x]))} → meestal ${res.diff > 0 ? 'hogere' : 'lagere'} ${esc(V[res.y].label)}` });
      if (out.length >= 5) break;
    }
    return out.length ? `<section class="card"><h2>🔗 Wat speelde er mee?</h2><ul class="list">${out.map((o) => `<li>${o.text}</li>`).join('')}</ul><p class="muted small">Op basis van jouw eigen verbanden.</p></section>` : '';
  }

  function renderDay(el, param) {
    const today = todayISO();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(param || '') ? param : today;
    const sections = dayHtml(date);
    el.innerHTML = `
      ${ui.pageHead('Dagoverzicht', `<a class="btn ghost" href="#/verbanden">🔗 Verbanden</a>`)}
      <nav class="day-nav" aria-label="Andere dag">
        <a class="btn small ghost" href="#/dag/${addDays(date, -1)}" aria-label="Vorige dag">‹</a>
        <input type="date" value="${date}" max="${today}" data-day aria-label="Kies een dag">
        ${date < today ? `<a class="btn small ghost" href="#/dag/${addDays(date, 1)}" aria-label="Volgende dag">›</a>` : '<span class="btn small ghost disabled" aria-hidden="true">›</span>'}
      </nav>
      <h2 class="section-title">${esc(formatDateLong(date))}</h2>
      ${diffHtml(date)}
      ${explainHtml(date)}
      ${sections.length ? sections.join('') : ui.empty('Voor deze dag is nog niets ingevuld.', `<button class="btn primary" data-check>Check invullen</button>`)}`;
    el.querySelector('[data-day]').addEventListener('change', (e) => { if (e.target.value) location.hash = `#/dag/${e.target.value}`; });
    const b = el.querySelector('[data-check]');
    if (b) b.addEventListener('click', () => views.checkin.openCheckin(date));
    views.medication.bindDoses(el);
  }

  // ---------- Blokjes op andere schermen ----------
  /** "Hangt samen met…" voor een scherm; leeg als er (nog) niets is. */
  function relatedHtml(route) {
    const keys = ROUTE_KEYS[route];
    if (!keys) return '';
    let res;
    try { res = computed().all.filter((r) => keys.includes(r.x) || keys.includes(r.y) || keys.includes(V[r.x].lagOf)).slice(0, 4); } catch (e) { return ''; }
    if (!res.length) return '';
    return `<section class="card related">
      <div class="card-head"><h2>🔗 Hangt samen met…</h2><a href="#/verbanden${keys.find((k) => V[k].outcome) ? `/${keys.find((k) => V[k].outcome)}` : ''}">Alle verbanden</a></div>
      <ul class="insights">${res.map((r) => itemHtml(r)).join('')}</ul>
    </section>`;
  }

  /** "Wat valt op" voor het startscherm. */
  function dashboardCardHtml() {
    let res;
    try {
      // Twee verschillende dingen laten zien, niet twee keer hetzelfde.
      res = [];
      for (const r of computed().all) {
        if (r.good == null || res.some((x) => x.y === r.y || x.x === r.x)) continue;
        res.push(r);
        if (res.length === 2) break;
      }
    } catch (e) { return ''; }
    if (!res.length) return '';
    return `<section class="card related">
      <div class="card-head"><h2>🔗 Wat valt op</h2><a href="#/verbanden">Alle verbanden</a></div>
      <ul class="insights">${res.map((r) => itemHtml(r)).join('')}</ul>
      <p class="small"><a href="#/dag/${todayISO()}">📅 Alles van vandaag op een rij</a></p>
    </section>`;
  }

  views.insights = { title: 'Verbanden', render: renderRelations, count: () => computed().all.length, relatedHtml, dashboardCardHtml, ROUTE_KEYS };
  views.day = { title: 'Dagoverzicht', render: renderDay };
})(window.HT);
