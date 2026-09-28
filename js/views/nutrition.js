/* Voeding: eetdagboek per maaltijd, klachten na het eten en dagdoelen (groente, fruit; drinken komt uit Drinken). */
(function (HT) {
  'use strict';
  const { store, ui, utils, form } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatDateLong, formatNum, average, sortBy } = utils;

  const MEALS = ['Ontbijt', 'Tussendoor (ochtend)', 'Lunch', 'Tussendoor (middag)', 'Avondeten', 'Avond / snack', 'Nacht'];
  // Richtlijnen Voedingscentrum (Schijf van Vijf) voor volwassenen.
  const GOALS = [
    { key: 'veg', label: 'Groente', goal: 250, unit: 'gram' },
    { key: 'fruit', label: 'Fruit', goal: 2, unit: 'stuks' },
    { key: 'water', label: 'Drinken', goal: 8, unit: 'glazen' },
  ];

  const FIELDS = [
    { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
    { name: 'time', label: 'Tijd', type: 'time', half: true },
    { name: 'meal', label: 'Maaltijd', type: 'select', options: MEALS, half: true },
    { name: 'amount', label: 'Hoeveelheid', type: 'select', half: true, options: ['', 'Klein', 'Normaal', 'Groot'] },
    { name: 'what', label: 'Wat heb je gegeten en gedronken?', type: 'textarea', required: true, placeholder: 'bv. 2 volkoren boterhammen met kaas, appel, glas melk' },
    { name: 'kcal', label: 'Calorieën (optioneel)', type: 'number', half: true },
    { name: 'place', label: 'Waar / met wie (optioneel)', half: true, placeholder: 'bv. thuis, uit eten' },
    { name: 'complaints', label: 'Klachten na het eten', placeholder: 'bv. opgeblazen, buikpijn, maagzuur, misselijk' },
    { name: 'notes', label: 'Notities', type: 'textarea' },
  ];

  function defaultMeal() {
    const h = new Date().getHours();
    if (h < 10) return 'Ontbijt';
    if (h < 12) return 'Tussendoor (ochtend)';
    if (h < 14) return 'Lunch';
    if (h < 17) return 'Tussendoor (middag)';
    if (h < 20) return 'Avondeten';
    return 'Avond / snack';
  }

  function openFood(entry) {
    form.open({
      title: entry ? 'Maaltijd bewerken' : 'Eten noteren',
      fields: FIELDS,
      values: entry || { date: todayISO(), time: nowTime(), meal: defaultMeal() },
      onSubmit(values) {
        store.upsert('food', Object.assign({}, values, entry ? { id: entry.id } : {}));
        ui.toast('Maaltijd opgeslagen');
      },
      onDelete: entry ? () => store.remove('food', entry.id) : null,
    });
  }

  function openGoals(date) {
    HT.views.checkin.openDayPart({
      title: 'Groente en fruit',
      date,
      toastText: 'Voeding opgeslagen',
      fields: [
        { name: 'veg', label: 'Groente (gram)', type: 'number', half: true, help: '1 opscheplepel ≈ 50 gram' },
        { name: 'fruit', label: 'Fruit (stuks)', type: 'number', half: true },
        { name: 'appetite', label: 'Eetlust', type: 'scale', min: 1, max: 5, emoji: ['😶', '🙁', '😐', '🙂', '😋'] },
      ],
    });
  }

  function goalsHtml(check) {
    return `<div class="goals">${GOALS.map((g) => {
      const v = check && check[g.key] != null ? Number(check[g.key]) : 0;
      const goal = g.key === 'water' ? Math.round(HT.views.hydration.settings().goal / 25) / 10 : g.goal;
      const pct = Math.min(100, Math.round((v / goal) * 100));
      return `<div class="goal">
        <div class="goal-head"><span>${g.key === 'water' ? '<a href="#/drinken">Drinken</a>' : esc(g.label)}</span><span><strong>${formatNum(v)}</strong> / ${formatNum(goal)} ${esc(g.unit)}${v >= goal ? ' ✓' : ''}</span></div>
        <div class="progress" role="progressbar" aria-label="${esc(g.label)}" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="${goal}"><span style="width:${pct}%"></span></div>
      </div>`;
    }).join('')}</div>`;
  }

  function render(el) {
    const today = todayISO();
    const all = sortBy(store.list('food'), (e) => e.date + (e.time || ''), -1);
    const check = store.checkinFor(today);
    const todays = all.filter((e) => e.date === today);
    const kcalToday = todays.reduce((s, e) => s + (Number(e.kcal) || 0), 0);
    const complaints = all.filter((e) => e.complaints && e.date >= addDays(today, -29));
    const checks = store.list('checkins');

    const groups = [];
    for (const e of all) {
      if (!groups.length || groups[groups.length - 1].date !== e.date) groups.push({ date: e.date, items: [] });
      groups[groups.length - 1].items.push(e);
    }
    for (const g of groups) g.items = sortBy(g.items, (e) => e.time || '');

    el.innerHTML = `
      ${ui.pageHead('Voeding', '<button class="btn primary" data-add>+ Eten noteren</button>')}
      <section class="card">
        <div class="card-head"><h2>Vandaag</h2><button class="btn small ghost" data-goals>Groente en fruit invullen</button></div>
        ${goalsHtml(check)}
        <p class="muted">${todays.length} maaltijd${todays.length === 1 ? '' : 'en'} genoteerd${kcalToday ? ` · ± ${formatNum(kcalToday)} kcal` : ''}${check && check.appetite ? ` · eetlust ${check.appetite}/5` : ''}</p>
        <p class="muted small">Advies Voedingscentrum (Schijf van Vijf): 250 gram groente, 2 stuks fruit en 1,5–2 liter drinken per dag. Heb je een dieet of aandoening? Volg dan het advies van je arts of diëtist.</p>
      </section>

      <section class="card">
        <h2>Gemiddeld afgelopen 7 dagen</h2>
        <div class="stats">${GOALS.map((g) => {
          const a = average(checks, g.key, addDays(today, -6), today);
          return `<div><span class="stat-value">${a ? formatNum(Math.round(a.avg * 10) / 10) : '–'}</span><span class="stat-label">${esc(g.label.toLowerCase())} (${esc(g.unit)}/dag)</span></div>`;
        }).join('')}</div>
      </section>

      ${complaints.length ? `<section class="card">
        <h2>Klachten na het eten (30 dagen)</h2>
        <p class="muted small">Zie je een patroon? Bespreek het met je huisarts of diëtist voordat je producten langdurig weglaat.</p>
        <ul class="list">${complaints.map((e) => `<li><strong>${esc(e.complaints)}</strong> – ${esc(formatDateLong(e.date))}${e.time ? ` ${esc(e.time)}` : ''}<br><small class="muted">${esc(e.meal || '')}: ${esc(e.what)}</small></li>`).join('')}</ul>
      </section>` : ''}

      <h2 class="section-title">Eetdagboek</h2>
      ${groups.length ? ui.collapsible(groups, (g) => `
        <article class="card item">
          <h3>${esc(formatDateLong(g.date))}${g.items.some((e) => e.kcal) ? ` <span class="muted">· ± ${formatNum(g.items.reduce((s, e) => s + (Number(e.kcal) || 0), 0))} kcal</span>` : ''}</h3>
          <ul class="pain-list">${g.items.map((e) => `
            <li>
              <span class="pain-score ${e.complaints ? 'warn' : 'good'}" aria-hidden="true">${e.complaints ? '!' : '🍽'}</span>
              <div class="pain-body">
                <strong>${esc(e.meal || 'Eten')}</strong>${e.time ? ` <span class="muted">· ${esc(e.time)}</span>` : ''}${e.amount ? ` <span class="muted">· ${esc(e.amount.toLowerCase())}</span>` : ''}
                <br>${esc(e.what)}
                ${e.kcal || e.place ? `<br><small>${esc([e.kcal ? `± ${formatNum(e.kcal)} kcal` : '', e.place].filter(Boolean).join(' · '))}</small>` : ''}
                ${e.complaints ? `<br><small>Klachten: ${esc(e.complaints)}</small>` : ''}
                ${e.notes ? `<br><small class="muted">${esc(e.notes)}</small>` : ''}
              </div>
              <button class="btn small ghost" data-edit="${esc(e.id)}">Bewerken</button>
            </li>`).join('')}</ul>
        </article>`, 10, 'Oudere dagen') : ui.empty('Nog niets genoteerd. Een eetdagboek helpt om patronen te zien, bijvoorbeeld bij buikklachten.')}`;

    el.querySelector('[data-add]').addEventListener('click', () => openFood());
    el.querySelector('[data-goals]').addEventListener('click', () => openGoals(today));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openFood(store.get('food', b.dataset.edit))));
  }

  HT.views.nutrition = { title: 'Voeding', render, openFood, openGoals, GOALS };
})(window.HT);
