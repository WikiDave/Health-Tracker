/* Pijndagboek: meerdere pijnmomenten per dag met plek, soort, oorzaak en wat hielp. */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatDateLong, sortBy } = utils;

  const TYPES = ['', 'Zeurend', 'Stekend', 'Kloppend', 'Brandend', 'Krampend', 'Schietend / zenuwpijn', 'Drukkend', 'Tintelend', 'Stijf', 'Anders'];
  const HELPED = ['', 'Helemaal', 'Grotendeels', 'Een beetje', 'Niet', 'Nog niet bekend'];

  const FIELDS = [
    { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
    { name: 'time', label: 'Tijd', type: 'time', half: true },
    { name: 'intensity', label: 'Hoe erg is de pijn? (0 = geen, 10 = ergst denkbaar)', type: 'scale', min: 0, max: 10 },
    { name: 'location', label: 'Waar', list: 'body-parts', half: true, placeholder: 'bv. onderrug', required: true },
    { name: 'type', label: 'Soort pijn', type: 'select', options: TYPES, half: true },
    { name: 'duration', label: 'Hoe lang', half: true, placeholder: 'bv. 2 uur, hele dag' },
    { name: 'trigger', label: 'Mogelijke oorzaak', half: true, placeholder: 'bv. lang zitten, tillen' },
    { name: 'relief', label: 'Wat heb je gedaan / genomen', placeholder: 'bv. paracetamol 1000 mg, warmte, rust' },
    { name: 'helped', label: 'Hielp het?', type: 'select', options: HELPED, half: true },
    { name: 'notes', label: 'Notities', type: 'textarea' },
  ];

  let period = 30;

  function openPain(entry) {
    form.open({
      title: entry ? 'Pijnmoment bewerken' : 'Pijn noteren',
      fields: FIELDS,
      values: entry || { date: todayISO(), time: nowTime() },
      onSubmit(values) {
        if (values.intensity == null) return 'Kies hoe erg de pijn is (0–10).';
        store.upsert('pain', Object.assign({}, values, entry ? { id: entry.id } : {}));
        ui.toast('Pijn genoteerd');
      },
      onDelete: entry ? () => store.remove('pain', entry.id) : null,
    });
  }

  function level(n) {
    if (n >= 7) return 'bad';
    if (n >= 4) return 'warn';
    return 'good';
  }

  function stats(entries) {
    if (!entries.length) return null;
    const avg = entries.reduce((s, e) => s + e.intensity, 0) / entries.length;
    const max = Math.max(...entries.map((e) => e.intensity));
    const counts = {};
    for (const e of entries) {
      for (const loc of String(e.location || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
        const k = loc.toLowerCase();
        counts[k] = counts[k] || { name: loc, n: 0 };
        counts[k].n++;
      }
    }
    const top = Object.values(counts).sort((a, b) => b.n - a.n).slice(0, 3);
    const days = new Set(entries.map((e) => e.date)).size;
    return { avg, max, top, days, count: entries.length };
  }

  function render(el) {
    const today = todayISO();
    const from = period ? addDays(today, -period + 1) : '0000';
    const all = sortBy(store.list('pain'), (e) => e.date + (e.time || ''), -1);
    const inRange = all.filter((e) => e.date >= from);
    const st = stats(inRange);

    // Hoogste pijn per dag voor de grafiek
    const perDay = {};
    for (const e of inRange) perDay[e.date] = Math.max(perDay[e.date] ?? 0, e.intensity);

    // Groeperen per dag voor de lijst
    const groups = [];
    for (const e of all) {
      if (!groups.length || groups[groups.length - 1].date !== e.date) groups.push({ date: e.date, items: [] });
      groups[groups.length - 1].items.push(e);
    }

    el.innerHTML = `
      ${ui.pageHead('Pijndagboek', '<button class="btn primary" data-add>+ Pijn noteren</button>')}
      <section class="card">
        <div class="card-head">
          <h2>Overzicht</h2>
          <select data-period aria-label="Periode">
            ${[[7, '7 dagen'], [30, '30 dagen'], [90, '3 maanden'], [365, '1 jaar'], [0, 'Alles']].map(([v, t]) => `<option value="${v}"${v === period ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        ${st ? `<div class="stats">
          <div><span class="stat-value">${st.days}</span><span class="stat-label">dagen met pijn</span></div>
          <div><span class="stat-value">${utils.formatNum(st.avg.toFixed(1))}</span><span class="stat-label">gemiddeld /10</span></div>
          <div><span class="stat-value">${st.max}</span><span class="stat-label">hoogste /10</span></div>
          <div><span class="stat-value small">${st.top.map((t) => esc(t.name)).join(', ') || '–'}</span><span class="stat-label">meest genoemd</span></div>
        </div>
        <h3>Hoogste pijn per dag</h3>` : ''}
        <div data-chart></div>
      </section>
      <h2 class="section-title">Dagboek</h2>
      ${groups.length ? ui.collapsible(groups, (g) => `
        <article class="card item">
          <h3>${esc(formatDateLong(g.date))}</h3>
          <ul class="pain-list">${g.items.map((e) => `
            <li>
              <span class="pain-score ${level(e.intensity)}" aria-label="Pijn ${e.intensity} van 10">${e.intensity}</span>
              <div class="pain-body">
                <strong>${esc(e.location || '')}</strong>${e.type ? ` · ${esc(e.type)}` : ''}${e.time ? ` <span class="muted">· ${esc(e.time)}</span>` : ''}
                ${e.duration || e.trigger ? `<br><small>${esc([e.duration, e.trigger ? 'oorzaak: ' + e.trigger : ''].filter(Boolean).join(' · '))}</small>` : ''}
                ${e.relief ? `<br><small>Gedaan: ${esc(e.relief)}${e.helped ? ` – hielp: ${esc(e.helped.toLowerCase())}` : ''}</small>` : ''}
                ${e.notes ? `<br><small class="muted">${esc(e.notes)}</small>` : ''}
              </div>
              <button class="btn small ghost" data-edit="${esc(e.id)}">Bewerken</button>
            </li>`).join('')}</ul>
        </article>`, 10, 'Oudere gegevens') : ui.empty('Nog niets genoteerd. Noteer pijn zodra je het voelt – dan zie je later patronen.')}`;

    chart.lineChart(el.querySelector('[data-chart]'), {
      series: [{ name: 'Pijn', color: 'var(--series-1)', points: Object.entries(perDay).map(([date, value]) => ({ date, value })) }],
      unit: '/10',
      label: 'Hoogste pijn per dag',
    });

    el.querySelector('[data-add]').addEventListener('click', () => openPain());
    el.querySelector('[data-period]').addEventListener('change', (e) => { period = Number(e.target.value); render(el); });
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openPain(store.get('pain', b.dataset.edit))));
  }

  HT.views.pain = { title: 'Pijndagboek', render, openPain };
})(window.HT);
