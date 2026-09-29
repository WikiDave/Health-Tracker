/* Sport en beweging: activiteiten per soort, spiertraining (spiergroepen, oefeningen, vooruitgang),
 * conditie (afstand, tempo, rusthartslag) en de Beweegrichtlijn (150 min per week + 2× spierversterkend). */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form, training: T } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatDateLong, formatDateShort, formatDate, formatNum, weekStart, activeMinutesByWeek, sortBy } = utils;

  const GOAL = 150;
  const STRENGTH_GOAL = 2;
  const FEEL = ['😫', '🙁', '😐', '🙂', '💪'];
  const INTENSITY = [['Licht', 'Licht – praten gaat makkelijk'], ['Matig', 'Matig – sneller ademen, praten lukt nog'], ['Zwaar', 'Zwaar – praten lukt amper']];
  const CARDIO_KINDS = T.KINDS.filter((k) => k.group === 'conditie').map((k) => k.key);
  const OTHER_KINDS = T.KINDS.filter((k) => k.group === 'sport').map((k) => k.key);

  const COMMON_START = [
    { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
    { name: 'time', label: 'Tijd', type: 'time', half: true },
  ];
  const COMMON_END = [
    { name: 'feeling', label: 'Hoe voelde je je erna?', type: 'scale', min: 1, max: 5, emoji: FEEL },
    { name: 'complaints', label: 'Klachten tijdens of na het sporten', placeholder: 'bv. kortademig, knie deed pijn, spierpijn de dag erna' },
    { name: 'notes', label: 'Notities', type: 'textarea' },
  ];

  const FORMS = {
    Krachttraining: {
      title: 'Krachttraining',
      fields: [
        ...COMMON_START,
        { name: 'activity', label: 'Naam van de training', placeholder: 'bv. Bovenlichaam, sportschool, thuis', half: true },
        { name: 'duration', label: 'Duur (minuten)', type: 'number', half: true, required: true },
        { name: 'intensity', label: 'Inspanning', type: 'select', options: INTENSITY, half: true },
        { name: 'muscles', label: 'Welke spiergroepen heb je getraind?', type: 'multi', options: T.MUSCLES, help: 'Bekende oefeningen hieronder vullen dit automatisch aan.' },
        { name: 'exercises', label: 'Oefeningen', type: 'results', emptyRows: 3,
          columns: [{ k: 'name', label: 'Oefening', placeholder: 'bv. Squat', list: 'exercise-names' }, { k: 'sets', label: 'Sets', num: true }, { k: 'reps', label: 'Herh.', num: true }, { k: 'weight', label: 'Kg', num: true }] },
        ...COMMON_END,
      ],
      defaults: { activity: 'Krachttraining', intensity: 'Matig' },
    },
    cardio: {
      title: 'Lopen, fietsen of zwemmen',
      fields: [
        ...COMMON_START,
        { name: 'kind', label: 'Soort', type: 'select', options: CARDIO_KINDS, half: true },
        { name: 'duration', label: 'Duur (minuten)', type: 'number', half: true, required: true },
        { name: 'distance', label: 'Afstand (km)', type: 'number', half: true },
        { name: 'heartRate', label: 'Gem. hartslag', type: 'number', half: true },
        { name: 'intensity', label: 'Inspanning', type: 'select', options: INTENSITY, half: true },
        { name: 'route', label: 'Route / plek', half: true, placeholder: 'bv. rondje park' },
        ...COMMON_END,
      ],
      defaults: { kind: 'Hardlopen', intensity: 'Matig' },
    },
    other: {
      title: 'Andere sport',
      fields: [
        ...COMMON_START,
        { name: 'kind', label: 'Soort', type: 'select', options: OTHER_KINDS, half: true },
        { name: 'activity', label: 'Welke sport', list: 'activities', half: true, placeholder: 'bv. voetbal, yoga' },
        { name: 'duration', label: 'Duur (minuten)', type: 'number', half: true, required: true },
        { name: 'intensity', label: 'Inspanning', type: 'select', options: INTENSITY, half: true },
        { name: 'heartRate', label: 'Gem. hartslag', type: 'number', half: true },
        ...COMMON_END,
      ],
      defaults: { kind: 'Balsport', intensity: 'Matig' },
    },
  };

  function formKeyFor(kind) {
    if (kind === 'Krachttraining') return 'Krachttraining';
    return CARDIO_KINDS.includes(kind) ? 'cardio' : 'other';
  }

  /** Opent het juiste formulier. Zonder entry: nieuwe activiteit van het gekozen type. */
  function openSport(entry, formKey) {
    if (!entry && !formKey) return chooseType();
    const key = formKey || formKeyFor(T.kindOf(entry));
    const f = FORMS[key];
    const values = entry ? Object.assign({ kind: T.kindOf(entry) }, entry) : Object.assign({ date: todayISO(), time: nowTime() }, f.defaults);
    form.open({
      title: entry ? `${f.title} bewerken` : f.title,
      fields: f.fields,
      values,
      onSubmit(v) {
        if (v.duration == null || v.duration <= 0) return 'Vul de duur in minuten in.';
        if (key === 'Krachttraining') v.kind = 'Krachttraining';
        if (!v.activity) v.activity = v.kind;
        store.upsert('sport', Object.assign({}, v, entry ? { id: entry.id } : {}));
        ui.toast('Activiteit opgeslagen');
      },
      onDelete: entry ? () => store.remove('sport', entry.id) : null,
    });
  }

  /** Snelknop: eerst kiezen wat voor training het was. */
  function chooseType() {
    ui.message('Wat heb je gedaan?', `<div class="type-choice">
      <button class="btn primary" data-type="Krachttraining">🏋️ Krachttraining</button>
      <button class="btn primary" data-type="cardio">🏃 Lopen, fietsen of zwemmen</button>
      <button class="btn ghost" data-type="other">⚽ Andere sport</button></div>`);
    document.querySelectorAll('#form-dialog [data-type]').forEach((b) => b.addEventListener('click', () => {
      document.getElementById('form-dialog').close();
      setTimeout(() => openSport(null, b.dataset.type));
    }));
  }

  /** Beweegminuten van deze week, voor het startscherm. */
  function thisWeek(today) {
    return activeMinutesByWeek(store.list('sport'))[weekStart(today)] || 0;
  }

  function progressHtml(minutes) {
    const pct = Math.min(100, Math.round((minutes / GOAL) * 100));
    return `<div class="progress" role="progressbar" aria-valuenow="${minutes}" aria-valuemin="0" aria-valuemax="${GOAL}"><span style="width:${pct}%"></span></div>
      <p><strong>${formatNum(minutes)}</strong> van ${GOAL} minuten deze week ${minutes >= GOAL ? ui.badge('✓ Doel gehaald', 'good') : `<span class="muted">– nog ${GOAL - minutes} min</span>`}</p>`;
  }

  const r2 = (n) => formatNum(Math.round(Number(n) * 100) / 100);
  const r0 = (n) => formatNum(Math.round(Number(n)));

  let exerciseIdx = 0;
  let cardioKind = 'Hardlopen';

  function strengthHtml(sport, today) {
    const days = T.strengthDays(sport, today);
    const status = T.muscleStatus(sport, today);
    const progress = T.exerciseProgress(sport);
    const anyStrength = sport.some((e) => T.kindOf(e) === 'Krachttraining');
    if (!anyStrength) {
      return `<p>Nog geen krachttraining vastgelegd. Het advies is om minstens <strong>2× per week</strong> spier- en botversterkende oefeningen te doen – thuis (push-ups, squats, plank) telt ook.</p>`;
    }
    const notTrained = T.MUSCLES.filter((m) => status[m].last == null || status[m].last > 6);
    if (exerciseIdx >= progress.length) exerciseIdx = 0;
    const ex = progress[exerciseIdx];
    const last = ex && ex.sessions[ex.sessions.length - 1];
    const first = ex && ex.sessions[0];
    return `
      <div class="progress" role="progressbar" aria-valuenow="${days}" aria-valuemin="0" aria-valuemax="${STRENGTH_GOAL}"><span style="width:${Math.min(100, (days / STRENGTH_GOAL) * 100)}%"></span></div>
      <p><strong>${days}×</strong> krachttraining in de afgelopen 7 dagen ${days >= STRENGTH_GOAL ? ui.badge('✓ Advies gehaald', 'good') : `<span class="muted">– advies: minstens ${STRENGTH_GOAL}×</span>`}</p>
      <h3>Spiergroepen</h3>
      <ul class="muscle-grid">${T.MUSCLES.map((m) => {
        const s = status[m];
        const cls = s.last == null ? 'none' : s.last <= 3 ? 'fresh' : s.last <= 7 ? 'ok' : 'old';
        const txt = s.last == null ? 'nog niet' : s.last === 0 ? 'vandaag' : s.last === 1 ? 'gisteren' : `${s.last} dagen geleden`;
        return `<li class="${cls}"><strong>${esc(m)}</strong><small>${txt}${s.count14 ? ` · ${s.count14}× in 14 d.` : ''}</small></li>`;
      }).join('')}</ul>
      ${notTrained.length && notTrained.length < T.MUSCLES.length ? `<p class="small">💡 Deze week nog niet getraind: <strong>${notTrained.map(esc).join(', ')}</strong>.</p>` : ''}
      ${progress.length ? `<h3>Vooruitgang per oefening</h3>
        <select data-exercise aria-label="Oefening">${progress.map((p, i) => `<option value="${i}"${i === exerciseIdx ? ' selected' : ''}>${esc(p.name)} (${p.sessions.length}×)</option>`).join('')}</select>
        <p>Zwaarste gewicht laatst: <strong>${formatNum(last.maxWeight)} kg</strong>${ex.sessions.length > 1 ? ` · eerste keer ${formatNum(first.maxWeight)} kg (${esc(formatDateShort(first.date))})` : ''} · geschat max (1 herhaling): ${formatNum(last.best1RM)} kg</p>
        ${ex.sessions.length > 1 ? '<div data-chart="exercise"></div>' : ''}` : '<p class="muted small">Vul ook je oefeningen met gewicht in om je vooruitgang te zien.</p>'}
      <p class="muted small">Geef een spiergroep 1–2 dagen rust na een zware training. Train je voor het eerst of heb je klachten? Laat je begeleiden door een trainer of fysiotherapeut.</p>`;
  }

  function cardioHtml(sport, checkins, today) {
    const kinds = CARDIO_KINDS.filter((k) => sport.some((e) => T.kindOf(e) === k && Number(e.distance)));
    const hr = T.restingHeartRate(checkins, today);
    if (!kinds.length) {
      return `<p>Vul bij hardlopen, wandelen of fietsen ook je <strong>afstand</strong> in, dan zie je hier je tempo en kilometers per week.</p>
        ${hr.recent ? `<p>Rusthartslag (gem. 14 dagen): <strong>${hr.recent}</strong> slagen/min.</p>` : ''}`;
    }
    if (!kinds.includes(cardioKind)) cardioKind = kinds[0];
    const c = T.cardio(sport, today, cardioKind);
    const trend = c.paceRecent && c.pacePrevious ? c.paceRecent - c.pacePrevious : null;
    return `
      ${kinds.length > 1 ? `<select data-cardio aria-label="Soort">${kinds.map((k) => `<option${k === cardioKind ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>` : ''}
      <div class="stats">
        <div><span class="stat-value">${r2(c.kmThisWeek)}<small> km</small></span><span class="stat-label">deze week</span></div>
        <div><span class="stat-value small">${T.formatPace(c.paceRecent)}</span><span class="stat-label">gem. tempo (4 weken)</span></div>
        <div><span class="stat-value">${c.longest ? r2(c.longest.distance) : '–'}<small> km</small></span><span class="stat-label">langste ${cardioKind === 'Hardlopen' ? 'loop' : 'tocht'}</span></div>
        <div><span class="stat-value small">${c.fastest ? T.formatPace(T.pace(c.fastest)) : '–'}</span><span class="stat-label">snelste tempo (≥ 3 km)</span></div>
      </div>
      ${trend != null ? `<p>${trend < -0.05 ? `💪 Je bent <strong>sneller</strong> geworden: ${T.formatPace(c.pacePrevious)} → ${T.formatPace(c.paceRecent)}.` : trend > 0.05 ? `Je tempo is iets lager dan de 4 weken ervoor (${T.formatPace(c.pacePrevious)} → ${T.formatPace(c.paceRecent)}). Moe, warm weer of rustiger getraind?` : `Je tempo is stabiel (${T.formatPace(c.paceRecent)}).`}</p>` : ''}
      ${hr.recent ? `<p>❤️ Rusthartslag: <strong>${hr.recent}</strong> slagen/min${hr.previous ? ` (was ${hr.previous})${hr.recent < hr.previous - 1 ? ' – lager, vaak een teken van betere conditie.' : ''}` : ''}</p>` : '<p class="muted small">Tip: meet \'s ochtends je rusthartslag en vul die in bij de dagelijkse check. Een dalende rusthartslag wijst vaak op een betere conditie.</p>'}
      <h3>Tempo per ${cardioKind === 'Hardlopen' ? 'loop' : 'keer'}</h3>
      <div data-chart="pace"></div>
      <h3>Kilometers per week</h3>
      <div data-chart="km"></div>`;
  }

  function render(el) {
    const today = todayISO();
    const sport = store.list('sport');
    const all = sortBy(sport, (e) => e.date + (e.time || ''), -1);
    const weeks = activeMinutesByWeek(all);
    const current = weeks[weekStart(today)] || 0;

    const points = [];
    const firstWeek = Object.keys(weeks).sort()[0];
    for (let i = 11; i >= 0; i--) {
      const wk = weekStart(addDays(today, -7 * i));
      if (firstWeek && wk >= firstWeek) points.push({ date: wk, value: weeks[wk] || 0 });
    }

    const byKind = {};
    for (const e of all.filter((x) => x.date >= addDays(today, -29))) {
      const k = T.kindOf(e);
      byKind[k] = (byKind[k] || 0) + (Number(e.duration) || 0);
    }

    const groups = [];
    for (const e of all) {
      if (!groups.length || groups[groups.length - 1].date !== e.date) groups.push({ date: e.date, items: [] });
      groups[groups.length - 1].items.push(e);
    }

    el.innerHTML = `
      ${ui.pageHead('Sport & beweging')}
      <div class="button-row sport-add">
        <button class="btn primary" data-add="Krachttraining">🏋️ Krachttraining</button>
        <button class="btn primary" data-add="cardio">🏃 Lopen / fietsen / zwemmen</button>
        <button class="btn ghost" data-add="other">⚽ Andere sport</button>
      </div>
      <section class="card">
        <h2>Deze week</h2>
        ${progressHtml(current)}
        <p class="muted small">Beweegrichtlijn: minstens 150 minuten per week matig intensief bewegen, verspreid over de week, én minstens 2× per week spier- en botversterkende activiteiten. Heb je een aandoening? Overleg met je arts of fysiotherapeut wat voor jou goed is.</p>
      </section>
      <section class="card"><h2>🏋️ Spiertraining</h2>${strengthHtml(sport, today)}</section>
      <section class="card"><h2>🏃 Conditie</h2>${cardioHtml(sport, store.list('checkins'), today)}</section>
      <section class="card">
        <h2>Beweegminuten per week</h2>
        <div data-chart="minutes"></div>
        ${Object.keys(byKind).length ? `<h3>Laatste 30 dagen per soort</h3><ul class="pills">${Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, m]) => `<li>${T.kindInfo(k).icon} ${esc(k)}: ${formatNum(m)} min</li>`).join('')}</ul>` : ''}
      </section>
      <h2 class="section-title">Activiteiten</h2>
      ${groups.length ? ui.collapsible(groups, (g) => `
        <article class="card item">
          <h3>${esc(formatDateLong(g.date))}</h3>
          <ul class="pain-list">${g.items.map((e) => {
            const kind = T.kindOf(e);
            const p = T.pace(e);
            const muscles = kind === 'Krachttraining' ? T.musclesOf(e) : [];
            return `
            <li>
              <span class="pain-score ${e.intensity === 'Zwaar' ? 'bad' : e.intensity === 'Matig' ? 'warn' : 'good'}" aria-label="${esc(kind)}, inspanning ${esc(e.intensity || '')}">${T.kindInfo(kind).icon}</span>
              <div class="pain-body">
                <strong>${esc(e.activity || kind)}</strong> · ${r0(e.duration)} min${e.intensity ? ` · ${esc(e.intensity.toLowerCase())}` : ''}${e.time ? ` <span class="muted">· ${esc(e.time)}</span>` : ''}${e.feeling ? ` · ${FEEL[e.feeling - 1]}` : ''}
                ${e.distance || e.heartRate ? `<br><small>${esc([e.distance ? `${r2(e.distance)} km` : '', p && CARDIO_KINDS.includes(kind) ? T.formatPace(p) : '', e.heartRate ? `gem. ${e.heartRate} bpm` : '', e.route || ''].filter(Boolean).join(' · '))}</small>` : ''}
                ${muscles.length ? `<br><small>💪 ${esc(muscles.join(', '))}</small>` : ''}
                ${(e.exercises || []).length ? `<br><small>${e.exercises.map((x) => esc(`${x.name}${x.sets ? ` ${formatNum(x.sets)}×${formatNum(x.reps || '')}` : ''}${x.weight ? ` @ ${formatNum(x.weight)} kg` : ''}`)).join(' · ')}</small>` : ''}
                ${e.complaints ? `<br><small>Klachten: ${esc(e.complaints)}</small>` : ''}
                ${e.notes ? `<br><small class="muted">${esc(e.notes)}</small>` : ''}
              </div>
              <button class="btn small ghost" data-edit="${esc(e.id)}">Bewerken</button>
            </li>`;
          }).join('')}</ul>
        </article>`, 10, 'Oudere gegevens') : ui.empty('Nog geen activiteiten. Ook een wandeling of fietstochtje telt mee!')}`;

    const box = (k) => el.querySelector(`[data-chart="${k}"]`);
    chart.lineChart(box('minutes'), { series: [{ name: 'Minuten', color: 'var(--series-1)', points }], low: GOAL, unit: 'min', label: 'Beweegminuten per week' });
    if (points.length) box('minutes').insertAdjacentHTML('beforeend', `<p class="muted small">Gestippelde lijn = doel van ${GOAL} minuten. Elk punt is een week (vanaf maandag ${esc(formatDateShort(points[0].date))}).</p>`);

    const progress = T.exerciseProgress(sport);
    if (box('exercise') && progress[exerciseIdx]) {
      chart.lineChart(box('exercise'), { series: [{ name: 'Kg', color: 'var(--series-1)', points: progress[exerciseIdx].sessions.map((s) => ({ date: s.date, value: s.maxWeight })) }], unit: 'kg', height: 170, label: 'Zwaarste gewicht per training' });
    }
    if (box('pace')) {
      const c = T.cardio(sport, today, cardioKind);
      // Tempo: lager is sneller. We tonen minuten per km.
      chart.lineChart(box('pace'), { series: [{ name: 'Tempo', color: 'var(--series-1)', points: c.runs.filter((r) => T.pace(r)).map((r) => ({ date: r.date, value: Math.round(T.pace(r) * 100) / 100 })) }], unit: 'min/km', height: 170, label: 'Tempo per keer (lager is sneller)' });
      box('pace').insertAdjacentHTML('beforeend', '<p class="muted small">Minuten per km – lager is sneller.</p>');
      const kmPts = [];
      const firstKm = Object.keys(c.kmByWeek).sort()[0];
      for (let i = 11; i >= 0; i--) {
        const wk = weekStart(addDays(today, -7 * i));
        if (firstKm && wk >= firstKm) kmPts.push({ date: wk, value: Math.round((c.kmByWeek[wk] || 0) * 10) / 10 });
      }
      chart.lineChart(box('km'), { series: [{ name: 'Km', color: 'var(--series-1)', points: kmPts }], unit: 'km', height: 170, label: 'Kilometers per week' });
    }

    el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => openSport(null, b.dataset.add)));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openSport(store.get('sport', b.dataset.edit))));
    const exSel = el.querySelector('[data-exercise]');
    if (exSel) exSel.addEventListener('change', (e) => { exerciseIdx = Number(e.target.value); render(el); });
    const cSel = el.querySelector('[data-cardio]');
    if (cSel) cSel.addEventListener('change', (e) => { cardioKind = e.target.value; render(el); });
  }

  HT.views.sport = { title: 'Sport & beweging', render, openSport, thisWeek, progressHtml, GOAL };
})(window.HT);
