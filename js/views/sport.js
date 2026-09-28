/* Sport en beweging: activiteiten, duur, intensiteit en de Beweegrichtlijn (150 min per week). */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatDateLong, formatDateShort, formatNum, weekStart, activeMinutesByWeek, sortBy } = utils;

  const GOAL = 150;
  const FEEL = ['😫', '🙁', '😐', '🙂', '💪'];

  const FIELDS = [
    { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
    { name: 'time', label: 'Tijd', type: 'time', half: true },
    { name: 'activity', label: 'Activiteit', required: true, list: 'activities', placeholder: 'bv. wandelen' },
    { name: 'duration', label: 'Duur (minuten)', type: 'number', half: true, required: true },
    { name: 'intensity', label: 'Inspanning', type: 'select', half: true, options: [['Licht', 'Licht – praten gaat makkelijk'], ['Matig', 'Matig – sneller ademen, praten lukt nog'], ['Zwaar', 'Zwaar – praten lukt amper']] },
    { name: 'distance', label: 'Afstand (km)', type: 'number', half: true },
    { name: 'heartRate', label: 'Gem. hartslag', type: 'number', half: true },
    { name: 'feeling', label: 'Hoe voelde je je erna?', type: 'scale', min: 1, max: 5, emoji: FEEL },
    { name: 'complaints', label: 'Klachten tijdens of na het sporten', placeholder: 'bv. kortademig, knie deed pijn, erg moe de dag erna' },
    { name: 'notes', label: 'Notities', type: 'textarea' },
  ];

  function openSport(entry) {
    form.open({
      title: entry ? 'Activiteit bewerken' : 'Sport / beweging toevoegen',
      fields: FIELDS,
      values: entry || { date: todayISO(), time: nowTime(), intensity: 'Matig' },
      onSubmit(values) {
        if (values.duration == null || values.duration <= 0) return 'Vul de duur in minuten in.';
        store.upsert('sport', Object.assign({}, values, entry ? { id: entry.id } : {}));
        ui.toast('Activiteit opgeslagen');
      },
      onDelete: entry ? () => store.remove('sport', entry.id) : null,
    });
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

  function render(el) {
    const today = todayISO();
    const all = sortBy(store.list('sport'), (e) => e.date + (e.time || ''), -1);
    const weeks = activeMinutesByWeek(all);
    const current = weeks[weekStart(today)] || 0;

    // Laatste 12 weken voor de grafiek (ook weken zonder beweging)
    // Beweegminuten per week, vanaf de eerste week met gegevens (max. 12 weken terug).
    const points = [];
    const firstWeek = Object.keys(weeks).sort()[0];
    for (let i = 11; i >= 0; i--) {
      const wk = weekStart(addDays(today, -7 * i));
      if (firstWeek && wk >= firstWeek) points.push({ date: wk, value: weeks[wk] || 0 });
    }

    const last30 = all.filter((e) => e.date >= addDays(today, -29));
    const byActivity = {};
    for (const e of last30) {
      const k = e.activity.trim();
      byActivity[k] = (byActivity[k] || 0) + (Number(e.duration) || 0);
    }
    const top = Object.entries(byActivity).sort((a, b) => b[1] - a[1]).slice(0, 4);

    const groups = [];
    for (const e of all) {
      if (!groups.length || groups[groups.length - 1].date !== e.date) groups.push({ date: e.date, items: [] });
      groups[groups.length - 1].items.push(e);
    }

    el.innerHTML = `
      ${ui.pageHead('Sport & beweging', '<button class="btn primary" data-add>+ Activiteit</button>')}
      <section class="card">
        <h2>Deze week</h2>
        ${progressHtml(current)}
        <p class="muted small">De Beweegrichtlijn adviseert minstens 150 minuten per week matig intensief bewegen, verspreid over meerdere dagen. Zware inspanning telt dubbel. Heb je een aandoening? Overleg met je arts of fysiotherapeut wat voor jou goed is.</p>
      </section>
      <section class="card">
        <h2>Beweegminuten per week</h2>
        <div data-chart></div>
        ${top.length ? `<h3>Laatste 30 dagen</h3><ul class="pills">${top.map(([a, m]) => `<li>${esc(a)}: ${formatNum(m)} min</li>`).join('')}</ul>` : ''}
      </section>
      <h2 class="section-title">Activiteiten</h2>
      ${groups.length ? ui.collapsible(groups, (g) => `
        <article class="card item">
          <h3>${esc(formatDateLong(g.date))}</h3>
          <ul class="pain-list">${g.items.map((e) => `
            <li>
              <span class="pain-score ${e.intensity === 'Zwaar' ? 'bad' : e.intensity === 'Matig' ? 'warn' : 'good'}" aria-label="Inspanning ${esc(e.intensity || '')}">${e.feeling ? FEEL[e.feeling - 1] : '🏃'}</span>
              <div class="pain-body">
                <strong>${esc(e.activity)}</strong> · ${formatNum(e.duration)} min${e.intensity ? ` · ${esc(e.intensity.toLowerCase())}` : ''}${e.time ? ` <span class="muted">· ${esc(e.time)}</span>` : ''}
                ${e.distance || e.heartRate ? `<br><small>${esc([e.distance ? `${formatNum(e.distance)} km` : '', e.heartRate ? `gem. ${e.heartRate} bpm` : ''].filter(Boolean).join(' · '))}</small>` : ''}
                ${e.complaints ? `<br><small>Klachten: ${esc(e.complaints)}</small>` : ''}
                ${e.notes ? `<br><small class="muted">${esc(e.notes)}</small>` : ''}
              </div>
              <button class="btn small ghost" data-edit="${esc(e.id)}">Bewerken</button>
            </li>`).join('')}</ul>
        </article>`, 10, 'Oudere gegevens') : ui.empty('Nog geen activiteiten. Ook een wandeling of fietstochtje telt mee!')}`;

    chart.lineChart(el.querySelector('[data-chart]'), {
      series: [{ name: 'Minuten', color: 'var(--series-1)', points }],
      low: GOAL,
      unit: 'min',
      label: 'Beweegminuten per week',
    });
    const chartEl = el.querySelector('[data-chart]');
    if (points.length) chartEl.insertAdjacentHTML('beforeend', `<p class="muted small">Gestippelde lijn = doel van ${GOAL} minuten. Elk punt is een week (vanaf maandag ${esc(formatDateShort(points[0].date))}).</p>`);

    el.querySelector('[data-add]').addEventListener('click', () => openSport());
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openSport(store.get('sport', b.dataset.edit))));
  }

  HT.views.sport = { title: 'Sport & beweging', render, openSport, thisWeek, progressHtml, GOAL };
})(window.HT);
