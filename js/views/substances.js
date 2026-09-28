/* Middelengebruik: alcohol, roken, cafeïne en drugs – per dag, zonder oordeel. Gegevens staan in het dagrecord. */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form } = HT;
  const { escapeHtml: esc, todayISO, addDays, formatDate, formatDateLong, formatNum, weekStart, sumByWeek, daysSince, nextDayEffect, sortBy } = utils;

  const FIELDS = [
    { name: 'hA', type: 'heading', label: '🍷 Alcohol' },
    { name: 'alcohol', label: 'Standaardglazen', type: 'number', half: true, help: '1 glas bier, wijn of sterke drank ≈ 1 standaardglas. Vul 0 in voor een alcoholvrije dag.' },
    { name: 'alcoholWhat', label: 'Wat', half: true, placeholder: 'bv. 2 bier, 1 wijn' },
    { name: 'hS', type: 'heading', label: '🚬 Roken en dampen' },
    { name: 'cigarettes', label: 'Sigaretten / shagjes', type: 'number', half: true, help: 'Vul 0 in voor een rookvrije dag.' },
    { name: 'otherSmoking', label: 'Anders', half: true, placeholder: 'bv. e-sigaret, sigaar, waterpijp' },
    { name: 'hC', type: 'heading', label: '☕ Cafeïne' },
    { name: 'coffee', label: 'Koppen koffie / energiedrank', type: 'number', half: true },
    { name: 'lastCoffee', label: 'Laatste om', type: 'time', half: true },
    { name: 'hD', type: 'heading', label: '💊 Drugs en niet-voorgeschreven middelen' },
    { name: 'drugs', label: 'Wat heb je gebruikt?', type: 'results', emptyRows: 1,
      columns: [{ k: 'name', label: 'Middel', placeholder: 'bv. cannabis', list: 'drug-names' }, { k: 'amount', label: 'Hoeveelheid', placeholder: 'bv. 1 joint' }] },
    { name: 'craving', label: 'Trek / zucht (0 = geen, 10 = heel sterk)', type: 'scale', min: 0, max: 10 },
    { name: 'substanceNotes', label: 'Notities', type: 'textarea', placeholder: 'bv. op een feest, om te ontspannen, bijwerkingen, spijt' },
  ];

  function openDay(date) {
    HT.views.checkin.openDayPart({ title: 'Middelengebruik', date: date || todayISO(), fields: FIELDS, toastText: 'Opgeslagen' });
  }

  function openQuit() {
    const s = store.data.settings;
    form.open({
      title: 'Stoppen met roken',
      fields: [
        { name: 'quitDate', label: 'Gestopt op', type: 'date', required: true, half: true },
        { name: 'cigsBefore', label: 'Sigaretten per dag daarvoor', type: 'number', half: true },
        { name: 'packPrice', label: 'Prijs per pakje (€)', type: 'number', half: true },
        { name: 'packSize', label: 'Sigaretten per pakje', type: 'number', half: true },
      ],
      values: { quitDate: s.quitDate || todayISO(), cigsBefore: s.cigsBefore, packPrice: s.packPrice, packSize: s.packSize || 20 },
      onSubmit(v) { store.saveSettings(v); ui.toast('Opgeslagen – succes!'); },
      onDelete: s.quitDate ? () => store.saveSettings({ quitDate: '', cigsBefore: null, packPrice: null }) : null,
    });
  }

  function quitStats(today) {
    const s = store.data.settings;
    const days = daysSince(s.quitDate, today);
    if (days == null) return null;
    const notSmoked = s.cigsBefore ? days * s.cigsBefore : null;
    const saved = notSmoked && s.packPrice ? (notSmoked / (s.packSize || 20)) * s.packPrice : null;
    return { days, notSmoked, saved };
  }

  function hasSubstance(c) {
    return ['alcohol', 'cigarettes', 'coffee', 'otherSmoking', 'craving', 'substanceNotes'].some((k) => c[k] != null && c[k] !== '') || (Array.isArray(c.drugs) && c.drugs.length);
  }

  function render(el) {
    const today = todayISO();
    const checks = store.list('checkins');
    const days = sortBy(checks.filter(hasSubstance), 'date', -1);
    const last7 = checks.filter((c) => c.date >= addDays(today, -6));
    const alcWeeks = sumByWeek(checks, 'alcohol');
    const thisWeekAlc = alcWeeks[weekStart(today)] || 0;
    const alcDays7 = last7.filter((c) => c.alcohol != null);
    const alcFree7 = alcDays7.filter((c) => Number(c.alcohol) === 0).length;
    const cig7 = last7.filter((c) => c.cigarettes != null);
    const cigAvg = cig7.length ? cig7.reduce((s, c) => s + Number(c.cigarettes), 0) / cig7.length : null;
    const cof7 = last7.filter((c) => c.coffee != null);
    const cofAvg = cof7.length ? cof7.reduce((s, c) => s + Number(c.coffee), 0) / cof7.length : null;
    const quit = quitStats(today);

    const drugs30 = {};
    for (const c of checks.filter((x) => x.date >= addDays(today, -29))) {
      for (const d of c.drugs || []) {
        const k = d.name.trim();
        drugs30[k] = (drugs30[k] || 0) + 1;
      }
    }

    const alcFatigue = nextDayEffect(checks.filter((c) => c.alcohol != null), (c) => c.alcohol > 0, checks, 'fatigue');
    const alcSleep = nextDayEffect(checks.filter((c) => c.alcohol != null), (c) => c.alcohol > 0, checks, 'sleepQuality');
    const alcMood = nextDayEffect(checks.filter((c) => c.alcohol != null), (c) => c.alcohol > 0, checks, 'mood');

    // Glazen per week, vanaf de eerste week met gegevens (max. 12 weken terug).
    const alcPoints = [];
    const firstAlcWeek = Object.keys(alcWeeks).sort()[0];
    if (firstAlcWeek) {
      for (let i = 11; i >= 0; i--) {
        const wk = weekStart(addDays(today, -7 * i));
        if (wk >= firstAlcWeek) alcPoints.push({ date: wk, value: alcWeeks[wk] || 0 });
      }
    }
    const cigPoints = checks.filter((c) => c.cigarettes != null && c.date >= addDays(today, -29)).map((c) => ({ date: c.date, value: Number(c.cigarettes) }));

    el.innerHTML = `
      ${ui.pageHead('Middelengebruik', `<button class="btn primary" data-add>+ Vandaag invullen</button><button class="btn ghost" data-other>Andere dag</button>`)}
      <p class="muted">Eerlijk invullen helpt jou en je arts het meest. Alles blijft alleen op dit apparaat.</p>

      <section class="card">
        <h2>🍷 Alcohol</h2>
        <div class="stats">
          <div><span class="stat-value">${formatNum(thisWeekAlc)}</span><span class="stat-label">glazen deze week</span></div>
          <div><span class="stat-value">${alcDays7.length ? `${alcFree7}<small> /${alcDays7.length}</small>` : '–'}</span><span class="stat-label">alcoholvrije dagen (7 d.)</span></div>
        </div>
        ${alcPoints.length ? '<h3>Glazen per week</h3><div data-chart="alcohol"></div>' : ''}
        ${[alcFatigue && `De dag na het drinken was je vermoeidheid gemiddeld <strong>${formatNum(alcFatigue.withUse.toFixed(1))}</strong>, na een alcoholvrije dag <strong>${formatNum(alcFatigue.without.toFixed(1))}</strong> (van 10).`,
          alcSleep && `Slaapkwaliteit na drinken: <strong>${formatNum(alcSleep.withUse.toFixed(1))}</strong>, zonder: <strong>${formatNum(alcSleep.without.toFixed(1))}</strong> (van 5).`,
          alcMood && `Stemming de dag erna: <strong>${formatNum(alcMood.withUse.toFixed(1))}</strong> na drinken, <strong>${formatNum(alcMood.without.toFixed(1))}</strong> zonder (van 5).`]
          .filter(Boolean).map((t) => `<p>💡 ${t}</p>`).join('')}
        <p class="muted small">Advies Gezondheidsraad: drink geen alcohol, of in ieder geval niet meer dan 1 glas per dag. Alcohol kan de werking van medicijnen beïnvloeden – vraag het je apotheek.</p>
      </section>

      <section class="card">
        <div class="card-head"><h2>🚬 Roken</h2><button class="btn small ghost" data-quit>${quit ? 'Stopdatum aanpassen' : 'Ik ben gestopt / wil stoppen'}</button></div>
        ${quit ? `<div class="stats">
          <div><span class="stat-value">${quit.days}</span><span class="stat-label">dagen rookvrij</span></div>
          ${quit.notSmoked != null ? `<div><span class="stat-value">${formatNum(quit.notSmoked)}</span><span class="stat-label">sigaretten niet gerookt</span></div>` : ''}
          ${quit.saved != null ? `<div><span class="stat-value">€ ${formatNum(Math.round(quit.saved))}</span><span class="stat-label">bespaard</span></div>` : ''}
        </div>` : ''}
        ${cigAvg != null ? `<p>Gemiddeld <strong>${formatNum(cigAvg.toFixed(1))}</strong> sigaretten per dag (afgelopen 7 dagen, ${cig7.length} dagen ingevuld).</p>${cigPoints.some((x) => x.value > 0) ? '<div data-chart="cigarettes"></div>' : ''}` : ''}
        <p class="muted small">Hulp bij stoppen: je huisarts of <a href="https://www.ikstopnu.nl" target="_blank" rel="noopener">ikstopnu.nl</a>. Stoppen met hulp vergroot je kans van slagen flink.</p>
      </section>

      <section class="card">
        <h2>☕ Cafeïne</h2>
        <p>${cofAvg != null ? `Gemiddeld <strong>${formatNum(cofAvg.toFixed(1))}</strong> koppen per dag (afgelopen 7 dagen).` : '<span class="muted">Nog niets ingevuld.</span>'}</p>
        <p class="muted small">Cafeïne werkt 5 tot 6 uur door. Slaap je slecht? Probeer na 14:00 uur geen koffie meer.</p>
      </section>

      <section class="card">
        <h2>💊 Drugs (30 dagen)</h2>
        ${Object.keys(drugs30).length ? `<ul class="pills">${Object.entries(drugs30).sort((a, b) => b[1] - a[1]).map(([n, k]) => `<li>${esc(n)}: ${k} dag${k === 1 ? '' : 'en'}</li>`).join('')}</ul>` : '<p class="muted">Niets ingevuld.</p>'}
        <p class="muted small">Drugs kunnen gevaarlijk samengaan met medicijnen (bijvoorbeeld antidepressiva). Vraag je apotheek of arts – zij hebben een beroepsgeheim. Informatie: <a href="https://www.drugsinfo.nl" target="_blank" rel="noopener">drugsinfo.nl</a> en <a href="https://www.alcoholinfo.nl" target="_blank" rel="noopener">alcoholinfo.nl</a> (Trimbos-instituut). Wil je minderen of stoppen? Je huisarts kan je doorverwijzen naar verslavingszorg.</p>
      </section>

      <h2 class="section-title">Per dag</h2>
      ${days.length ? ui.collapsible(days, (c) => `
        <article class="card item">
          <div class="item-head"><h3>${esc(formatDateLong(c.date))}</h3><button class="btn small ghost" data-edit="${esc(c.date)}">Bewerken</button></div>
          <ul class="pills">
            ${c.alcohol != null ? `<li>🍷 ${Number(c.alcohol) === 0 ? 'alcoholvrij' : `${formatNum(c.alcohol)} glas${c.alcoholWhat ? ` (${esc(c.alcoholWhat)})` : ''}`}</li>` : ''}
            ${c.cigarettes != null ? `<li>🚬 ${Number(c.cigarettes) === 0 ? 'rookvrij' : `${formatNum(c.cigarettes)} sigaretten`}</li>` : ''}
            ${c.otherSmoking ? `<li>${esc(c.otherSmoking)}</li>` : ''}
            ${c.coffee != null ? `<li>☕ ${formatNum(c.coffee)} koffie${c.lastCoffee ? `, laatste ${esc(c.lastCoffee)}` : ''}</li>` : ''}
            ${(c.drugs || []).map((d) => `<li>💊 ${esc(d.name)}${d.amount ? ` – ${esc(d.amount)}` : ''}</li>`).join('')}
            ${c.craving != null ? `<li>trek ${c.craving}/10</li>` : ''}
          </ul>
          ${c.substanceNotes ? `<p class="muted">${esc(c.substanceNotes)}</p>` : ''}
        </article>`, 10, 'Oudere dagen') : ui.empty('Nog niets ingevuld.')}`;

    const alcBox = el.querySelector('[data-chart="alcohol"]');
    if (alcBox) chart.lineChart(alcBox, { series: [{ name: 'Glazen', color: 'var(--series-1)', points: alcPoints }], unit: 'glazen', height: 180, label: 'Glazen alcohol per week' });
    const cigBox = el.querySelector('[data-chart="cigarettes"]');
    if (cigBox) {
      chart.lineChart(cigBox, {
        series: [{ name: 'Sigaretten', color: 'var(--series-1)', points: cigPoints }],
        unit: 'per dag', height: 180, label: 'Sigaretten per dag',
      });
    }

    el.querySelector('[data-add]').addEventListener('click', () => openDay(today));
    el.querySelector('[data-other]').addEventListener('click', () => openDay(addDays(today, -1)));
    el.querySelector('[data-quit]').addEventListener('click', openQuit);
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openDay(b.dataset.edit)));
  }

  HT.views.substances = { title: 'Middelengebruik', render, openDay, quitStats, hasSubstance };
})(window.HT);
