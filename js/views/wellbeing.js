/* Welzijn: vermoeidheid en mentale gezondheid – trends uit de dagelijkse check en zelftests (PHQ-9, GAD-7). */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form, questionnaires: Q } = HT;
  const { escapeHtml: esc, todayISO, addDays, formatDate, formatDateLong, formatNum, average, sortBy } = utils;

  // higherIsWorse bepaalt of een stijging "slechter" of "beter" is.
  const TILES = [
    { key: 'fatigue', label: 'Vermoeidheid', scale: 10, higherIsWorse: true },
    { key: 'stress', label: 'Stress', scale: 10, higherIsWorse: true },
    { key: 'anxiety', label: 'Angst / onrust', scale: 10, higherIsWorse: true },
    { key: 'gloom', label: 'Somberheid', scale: 10, higherIsWorse: true },
    { key: 'mood', label: 'Stemming', scale: 5, higherIsWorse: false },
    { key: 'energy', label: 'Energie', scale: 5, higherIsWorse: false },
  ];

  const CHART_KEYS = ['fatigue', 'stress', 'anxiety', 'gloom', 'mood', 'energy', 'focus', 'sleepHours'];

  let metric = 'fatigue';
  let period = 30;

  function openQuestionnaire(type) {
    const q = Q.QUESTIONNAIRES[type];
    const fields = [
      { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
      { name: 'intro', type: 'heading', label: q.intro },
      ...q.questions.map((text, i) => ({ name: `q${i}`, label: `${i + 1}. ${text}`, type: 'choice', options: Q.ANSWERS })),
    ];
    form.open({
      title: q.name,
      fields,
      values: { date: todayISO() },
      submitLabel: 'Bekijk uitslag',
      onSubmit(values) {
        const answers = q.questions.map((_, i) => values[`q${i}`]);
        const result = Q.scoreQuestionnaire(type, answers);
        if (!result) return `Beantwoord alle ${q.questions.length} vragen.`;
        store.upsert('questionnaires', { type, date: values.date, answers, score: result.score, level: result.level });
        setTimeout(() => showResult(type, result));
      },
    });
  }

  function showResult(type, r) {
    const q = Q.QUESTIONNAIRES[type];
    let advice;
    if (r.selfHarm) {
      advice = '<p><strong>Je gaf aan dat je gedachten hebt gehad aan de dood of aan jezelf iets aandoen.</strong> Dat is heel zwaar. Praat erover – vandaag nog – met iemand die je vertrouwt, je huisarts of 113.</p>';
    } else if (r.adviseDoctor) {
      advice = '<p>Je score wijst op klachten die de moeite waard zijn om te bespreken met je huisarts of praktijkondersteuner (POH-GGZ). Neem deze uitslag mee.</p>';
    } else {
      advice = '<p>Je score wijst niet op ernstige klachten. Blijf goed op jezelf letten en vul de lijst over een paar weken opnieuw in.</p>';
    }
    ui.message(q.short, `
      <p class="big-score">${r.score} <small>/ ${r.max}</small></p>
      <p>${ui.badge(r.level, r.kind)}</p>
      ${advice}
      ${r.selfHarm || r.adviseDoctor ? ui.crisisHtml() : ''}
      <p class="muted small">Dit is een zelftest en geen diagnose.</p>`);
  }

  function trendText(tile, now, prev) {
    if (!now || !prev) return '';
    const diff = now.avg - prev.avg;
    const threshold = tile.scale === 10 ? 0.5 : 0.3;
    if (Math.abs(diff) < threshold) return '<span class="trend">≈ gelijk aan week ervoor</span>';
    const better = tile.higherIsWorse ? diff < 0 : diff > 0;
    return `<span class="trend ${better ? 'better' : 'worse'}">${diff > 0 ? '↑' : '↓'} ${formatNum(Math.abs(diff).toFixed(1))} · ${better ? 'beter' : 'slechter'} dan week ervoor</span>`;
  }

  /** Vergelijkt vermoeidheid na korte en na langere nachten. */
  function sleepInsight(checkins) {
    const withBoth = checkins.filter((c) => c.fatigue != null && c.sleepHours != null);
    const short = withBoth.filter((c) => c.sleepHours < 7);
    const long = withBoth.filter((c) => c.sleepHours >= 7);
    if (short.length < 3 || long.length < 3) return '';
    const avg = (arr) => arr.reduce((s, c) => s + c.fatigue, 0) / arr.length;
    return `<p>💡 Na nachten van <strong>minder dan 7 uur</strong> slaap was je vermoeidheid gemiddeld <strong>${formatNum(avg(short).toFixed(1))}</strong>,
      na <strong>7 uur of meer</strong> gemiddeld <strong>${formatNum(avg(long).toFixed(1))}</strong> (van 10).</p>`;
  }

  function questionnaireCard(type) {
    const q = Q.QUESTIONNAIRES[type];
    const history = sortBy(store.list('questionnaires').filter((r) => r.type === type), 'date', -1);
    const last = history[0];
    const lastResult = last ? Q.scoreQuestionnaire(type, last.answers) : null;
    return `<article class="card item">
      <div class="item-head"><h3>${esc(q.short)}</h3><button class="btn small primary" data-q="${type}">Invullen</button></div>
      ${last && lastResult ? `<p>Laatste keer (${esc(formatDate(last.date))}): <strong>${lastResult.score}</strong> / ${q.max} ${ui.badge(lastResult.level, lastResult.kind)}</p>`
        : '<p class="muted">Nog niet ingevuld. Duurt ongeveer 2 minuten.</p>'}
      ${history.length > 1 ? `<div data-qchart="${type}"></div>` : ''}
      ${history.length ? `<details><summary>Alle uitslagen (${history.length})</summary><ul class="list">
        ${history.map((r) => `<li>${esc(formatDate(r.date))}: ${r.score} – ${esc(r.level)} <button class="btn small ghost" data-qdel="${esc(r.id)}">Verwijderen</button></li>`).join('')}
      </ul></details>` : ''}
    </article>`;
  }

  function render(el) {
    const today = todayISO();
    const checkins = store.list('checkins');
    const from = period ? addDays(today, -period + 1) : '0000';
    const inRange = sortBy(checkins.filter((c) => c.date >= from), 'date');
    const journal = sortBy(checkins.filter((c) => c.mentalNotes || c.positive), 'date', -1).slice(0, 10);
    const m = HT.views.checkin.METRICS.find((x) => x.key === metric);

    el.innerHTML = `
      ${ui.pageHead('Vermoeidheid & mentaal', '<button class="btn primary" data-checkin>+ Check van vandaag</button>')}
      <p class="muted">Vermoeidheid, stress, angst en somberheid vul je in bij de <a href="#/check">dagelijkse check</a>. Hier zie je hoe het gaat.</p>

      <section class="card">
        <h2>Afgelopen 7 dagen</h2>
        <div class="stats">${TILES.map((t) => {
          const now = average(checkins, t.key, addDays(today, -6), today);
          const prev = average(checkins, t.key, addDays(today, -13), addDays(today, -7));
          return `<div>
            <span class="stat-value">${now ? formatNum(now.avg.toFixed(1)) : '–'}<small> /${t.scale}</small></span>
            <span class="stat-label">${esc(t.label)}</span>
            ${trendText(t, now, prev)}
          </div>`;
        }).join('')}</div>
        ${sleepInsight(checkins)}
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Verloop</h2>
          <div class="controls">
            <select data-metric aria-label="Meting">${CHART_KEYS.map((k) => {
              const mm = HT.views.checkin.METRICS.find((x) => x.key === k);
              return `<option value="${k}"${k === metric ? ' selected' : ''}>${mm.label}</option>`;
            }).join('')}</select>
            <select data-period aria-label="Periode">
              ${[[7, '7 dagen'], [30, '30 dagen'], [90, '3 maanden'], [365, '1 jaar'], [0, 'Alles']].map(([v, t]) => `<option value="${v}"${v === period ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div data-chart></div>
      </section>

      <h2 class="section-title">Zelftests</h2>
      <p class="muted">Korte, veelgebruikte vragenlijsten over de afgelopen 2 weken. Handig om elke paar weken in te vullen en mee te nemen naar je huisarts. Geen diagnose.</p>
      ${questionnaireCard('phq9')}
      ${questionnaireCard('gad7')}

      ${journal.length ? `<h2 class="section-title">Dagboek</h2>
        <section class="card"><ul class="journal">${journal.map((c) => `
          <li><span class="muted">${esc(formatDateLong(c.date))}</span>
            ${c.mentalNotes ? `<p>${esc(c.mentalNotes)}</p>` : ''}
            ${c.positive ? `<p>🌱 ${esc(c.positive)}</p>` : ''}</li>`).join('')}
        </ul></section>` : ''}

      ${ui.crisisHtml()}`;

    chart.lineChart(el.querySelector('[data-chart]'), {
      series: [{ name: m.label, color: 'var(--series-1)', points: inRange.filter((c) => c[metric] != null).map((c) => ({ date: c.date, value: Number(c[metric]) })) }],
      unit: m.unit,
      label: `${m.label} over tijd`,
    });

    el.querySelectorAll('[data-qchart]').forEach((box) => {
      const type = box.dataset.qchart;
      const pts = sortBy(store.list('questionnaires').filter((r) => r.type === type), 'date').map((r) => ({ date: r.date, value: r.score }));
      chart.lineChart(box, { series: [{ name: 'Score', color: 'var(--series-1)', points: pts }], height: 160, label: `${Q.QUESTIONNAIRES[type].short} over tijd` });
    });

    el.querySelector('[data-checkin]').addEventListener('click', () => HT.views.checkin.openCheckin(today));
    el.querySelector('[data-metric]').addEventListener('change', (e) => { metric = e.target.value; render(el); });
    el.querySelector('[data-period]').addEventListener('change', (e) => { period = Number(e.target.value); render(el); });
    el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => openQuestionnaire(b.dataset.q)));
    el.querySelectorAll('[data-qdel]').forEach((b) => b.addEventListener('click', () => {
      if (confirm('Deze uitslag verwijderen?')) store.remove('questionnaires', b.dataset.qdel);
    }));
  }

  /** Laatste zelftest die aanleiding geeft om met de huisarts te praten (voor het startscherm). */
  function latestConcern(today) {
    const recent = store.list('questionnaires').filter((r) => r.date >= addDays(today, -30));
    const out = [];
    for (const type of Object.keys(Q.QUESTIONNAIRES)) {
      const last = sortBy(recent.filter((r) => r.type === type), 'date', -1)[0];
      const res = last && Q.scoreQuestionnaire(type, last.answers);
      if (res && res.adviseDoctor) out.push({ type, date: last.date, result: res });
    }
    return out;
  }

  HT.views.wellbeing = { title: 'Vermoeidheid & mentaal', render, latestConcern, TILES };
})(window.HT);
