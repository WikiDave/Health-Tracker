/* Dagelijkse gezondheidscheck: stemming, pijn, slaap, bloeddruk, gewicht, enz. */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form } = HT;
  const { escapeHtml: esc, todayISO, addDays, formatDateLong, formatNum, sortBy } = utils;

  const MOOD = ['😞', '🙁', '😐', '🙂', '😄'];
  const ENERGY = ['🪫', '😴', '😐', '💪', '⚡'];

  const FOCUS = ['😵', '😕', '😐', '🙂', '🎯'];

  const IMPACT = ['', 'Kon alles doen wat ik wilde', 'Moest het wat rustiger aan doen', 'Kon veel dingen niet doen', 'Lag vooral op bed of de bank'];

  const FIELDS = [
    { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
    { name: 'h1', type: 'heading', label: 'Hoe gaat het?' },
    { name: 'mood', label: 'Hoe voel je je?', type: 'scale', min: 1, max: 5, emoji: MOOD },
    { name: 'energy', label: 'Energie', type: 'scale', min: 1, max: 5, emoji: ENERGY },
    { name: 'pain', label: 'Pijn (0 = geen, 10 = ergst denkbaar)', type: 'scale', min: 0, max: 10 },

    { name: 'h2', type: 'heading', label: '😴 Vermoeidheid en slaap' },
    { name: 'fatigue', label: 'Hoe moe ben je? (0 = fit, 10 = volledig uitgeput)', type: 'scale', min: 0, max: 10 },
    { name: 'fatigueImpact', label: 'Wat kon je vandaag door de vermoeidheid?', type: 'select', options: IMPACT },
    { name: 'restedWaking', label: 'Uitgerust wakker geworden?', type: 'scale', min: 1, max: 5, emoji: MOOD },
    { name: 'sleepHours', label: 'Uren geslapen', type: 'number', half: true, placeholder: 'bv. 7,5' },
    { name: 'restBreaks', label: 'Rust / dutjes overdag', half: true, placeholder: 'bv. 30 min middagdutje' },
    { name: 'sleepQuality', label: 'Slaapkwaliteit', type: 'scale', min: 1, max: 5, emoji: MOOD },

    { name: 'h3', type: 'heading', label: '🧠 Mentaal' },
    { name: 'stress', label: 'Stress (0 = ontspannen, 10 = extreem gestrest)', type: 'scale', min: 0, max: 10 },
    { name: 'anxiety', label: 'Angst / onrust (0 = geen, 10 = heel veel)', type: 'scale', min: 0, max: 10 },
    { name: 'gloom', label: 'Somber / neerslachtig (0 = helemaal niet, 10 = heel erg)', type: 'scale', min: 0, max: 10 },
    { name: 'focus', label: 'Concentratie', type: 'scale', min: 1, max: 5, emoji: FOCUS },
    { name: 'mentalNotes', label: 'Wat hield je bezig?', type: 'textarea', placeholder: 'Gedachten, zorgen, gebeurtenissen…' },
    { name: 'positive', label: 'Iets fijns van vandaag', placeholder: 'bv. wandeling in de zon, telefoontje met een vriend' },

    { name: 'h4', type: 'heading', label: '📏 Metingen' },
    { name: 'systolic', label: 'Bloeddruk boven (mmHg)', type: 'number', half: true, placeholder: 'bv. 125' },
    { name: 'diastolic', label: 'Bloeddruk onder (mmHg)', type: 'number', half: true, placeholder: 'bv. 80' },
    { name: 'heartRate', label: 'Hartslag (slagen/min)', type: 'number', half: true },
    { name: 'weight', label: 'Gewicht (kg)', type: 'number', half: true },
    { name: 'temperature', label: 'Temperatuur (°C)', type: 'number', half: true },
    { name: 'glucose', label: 'Bloedsuiker (mmol/L)', type: 'number', half: true },
    { name: 'oxygen', label: 'Zuurstofsaturatie (%)', type: 'number', half: true },
    { name: 'water', label: 'Water gedronken (glazen)', type: 'number', half: true },

    { name: 'h5', type: 'heading', label: 'Overig' },
    { name: 'symptoms', label: 'Klachten / symptomen', type: 'textarea', placeholder: 'bv. hoofdpijn, duizelig na opstaan' },
    { name: 'notes', label: 'Notities', type: 'textarea' },
  ];

  const METRICS = [
    { key: 'bp', label: 'Bloeddruk', unit: 'mmHg' },
    { key: 'weight', label: 'Gewicht', unit: 'kg' },
    { key: 'heartRate', label: 'Hartslag', unit: '/min' },
    { key: 'mood', label: 'Stemming', unit: '/5' },
    { key: 'energy', label: 'Energie', unit: '/5' },
    { key: 'fatigue', label: 'Vermoeidheid', unit: '/10' },
    { key: 'stress', label: 'Stress', unit: '/10' },
    { key: 'anxiety', label: 'Angst / onrust', unit: '/10' },
    { key: 'gloom', label: 'Somberheid', unit: '/10' },
    { key: 'focus', label: 'Concentratie', unit: '/5' },
    { key: 'pain', label: 'Pijn', unit: '/10' },
    { key: 'sleepHours', label: 'Slaap', unit: 'uur' },
    { key: 'temperature', label: 'Temperatuur', unit: '°C' },
    { key: 'glucose', label: 'Bloedsuiker', unit: 'mmol/L' },
    { key: 'oxygen', label: 'Saturatie', unit: '%' },
  ];

  let metric = 'bp';
  let period = 30;

  function openCheckin(date) {
    date = date || todayISO();
    const existing = store.checkinFor(date);
    form.open({
      title: existing ? 'Dagelijkse check bewerken' : 'Dagelijkse check',
      fields: FIELDS,
      values: existing || { date },
      onSubmit(values) {
        const other = store.checkinFor(values.date);
        if (other && (!existing || other.id !== existing.id)) {
          return `Er is al een check voor ${formatDateLong(values.date)}. Bewerk die in de geschiedenis.`;
        }
        store.upsert('checkins', Object.assign({}, values, existing ? { id: existing.id } : {}));
        ui.toast('Check opgeslagen');
      },
      onDelete: existing ? () => store.remove('checkins', existing.id) : null,
    });
  }

  function summary(c) {
    const parts = [];
    if (c.mood) parts.push(`${MOOD[c.mood - 1]} stemming`);
    if (c.energy) parts.push(`${ENERGY[c.energy - 1]} energie ${c.energy}/5`);
    if (c.pain != null) parts.push(`pijn ${c.pain}/10`);
    if (c.fatigue != null) parts.push(`moe ${c.fatigue}/10`);
    if (c.stress != null) parts.push(`stress ${c.stress}/10`);
    if (c.anxiety != null) parts.push(`angst ${c.anxiety}/10`);
    if (c.gloom != null) parts.push(`somber ${c.gloom}/10`);
    if (c.focus) parts.push(`${FOCUS[c.focus - 1]} concentratie ${c.focus}/5`);
    if (c.sleepHours != null) parts.push(`${formatNum(c.sleepHours)} u slaap`);
    if (c.systolic && c.diastolic) parts.push(`${c.systolic}/${c.diastolic} mmHg`);
    if (c.heartRate) parts.push(`${c.heartRate} bpm`);
    if (c.weight) parts.push(`${formatNum(c.weight)} kg`);
    if (c.temperature) parts.push(`${formatNum(c.temperature)} °C`);
    if (c.glucose) parts.push(`glucose ${formatNum(c.glucose)}`);
    if (c.oxygen) parts.push(`sat. ${formatNum(c.oxygen)}%`);
    return parts;
  }

  function summaryHtml(c) {
    const parts = summary(c);
    let html = parts.length ? `<ul class="pills">${parts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
    if (c.fatigueImpact) html += `<p><strong>Vermoeidheid:</strong> ${esc(c.fatigueImpact.toLowerCase())}${c.restBreaks ? ` · rust: ${esc(c.restBreaks)}` : ''}</p>`;
    else if (c.restBreaks) html += `<p><strong>Rust:</strong> ${esc(c.restBreaks)}</p>`;
    if (c.mentalNotes) html += `<p><strong>Hield me bezig:</strong> ${esc(c.mentalNotes)}</p>`;
    if (c.positive) html += `<p>🌱 ${esc(c.positive)}</p>`;
    if (c.symptoms) html += `<p><strong>Klachten:</strong> ${esc(c.symptoms)}</p>`;
    if (c.notes) html += `<p class="muted">${esc(c.notes)}</p>`;
    return html;
  }

  function render(el) {
    const today = todayISO();
    const todays = store.checkinFor(today);
    const from = period ? addDays(today, -period + 1) : '0000';
    const inRange = store.list('checkins').filter((c) => c.date >= from);
    const history = sortBy(store.list('checkins'), 'date', -1);

    el.innerHTML = `
      ${ui.pageHead('Dagelijkse check', `<button class="btn primary" data-act="today">${todays ? 'Check van vandaag bewerken' : '+ Check van vandaag'}</button>
        <button class="btn ghost" data-act="other">Andere dag</button>`)}
      <section class="card">
        <div class="card-head">
          <h2>Verloop</h2>
          <div class="controls">
            <select data-metric aria-label="Meting">${METRICS.map((m) => `<option value="${m.key}"${m.key === metric ? ' selected' : ''}>${m.label}</option>`).join('')}</select>
            <select data-period aria-label="Periode">
              ${[[7, '7 dagen'], [30, '30 dagen'], [90, '3 maanden'], [365, '1 jaar'], [0, 'Alles']].map(([v, t]) => `<option value="${v}"${v === period ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div data-chart></div>
      </section>
      <section>
        <h2 class="section-title">Geschiedenis</h2>
        ${history.length ? history.map((c) => `
          <article class="card item" data-date="${c.date}">
            <div class="item-head"><h3>${esc(formatDateLong(c.date))}</h3><button class="btn small ghost" data-edit="${c.date}">Bewerken</button></div>
            ${summaryHtml(c) || '<p class="muted">Geen waarden ingevuld.</p>'}
          </article>`).join('') : ui.empty('Nog geen checks. Begin vandaag met je eerste dagelijkse check!')}
      </section>`;

    const m = METRICS.find((x) => x.key === metric);
    const series = [];
    const pts = (k) => inRange.filter((c) => c[k] != null).map((c) => ({ date: c.date, value: Number(c[k]) }));
    if (metric === 'bp') {
      series.push({ name: 'Boven', color: 'var(--series-1)', points: pts('systolic') });
      series.push({ name: 'Onder', color: 'var(--series-2)', points: pts('diastolic') });
    } else {
      series.push({ name: m.label, color: 'var(--series-1)', points: pts(metric) });
    }
    chart.lineChart(el.querySelector('[data-chart]'), { series, unit: m.unit, label: `${m.label} over tijd` });

    el.querySelector('[data-metric]').addEventListener('change', (e) => { metric = e.target.value; render(el); });
    el.querySelector('[data-period]').addEventListener('change', (e) => { period = Number(e.target.value); render(el); });
    el.querySelector('[data-act="today"]').addEventListener('click', () => openCheckin(today));
    el.querySelector('[data-act="other"]').addEventListener('click', () => {
      form.open({
        title: 'Check voor andere dag',
        fields: [{ name: 'date', label: 'Datum', type: 'date', required: true }],
        values: { date: addDays(today, -1) },
        submitLabel: 'Verder',
        onSubmit: (v) => { setTimeout(() => openCheckin(v.date)); },
      });
    });
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openCheckin(b.dataset.edit)));
  }

  HT.views.checkin = { title: 'Dagelijkse check', render, openCheckin, summaryHtml, METRICS };
})(window.HT);
