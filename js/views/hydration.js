/* Drinken / hydrateren: met één tik een drankje toevoegen, dagdoel of maximum (vochtbeperking), grafiek en herinneringen.
 * De drankjes staan in het dagrecord (drinks); 'water' (glazen) en 'fluidMl' worden automatisch bijgehouden. */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatDateLong, formatDateShort, formatNum, fluidMl, expectedFluid, sameDayEffect, uid, sortBy } = utils;

  const TYPES = ['Water', 'Thee', 'Koffie', 'Melk', 'Sap', 'Frisdrank', 'Sportdrank', 'Soep', 'Bouillon', 'Anders'];
  const QUICK = [
    { label: 'Glas water', ml: 250, type: 'Water', icon: '🥛' },
    { label: 'Fles water', ml: 500, type: 'Water', icon: '🍶' },
    { label: 'Kop thee', ml: 200, type: 'Thee', icon: '🍵' },
    { label: 'Kop koffie', ml: 150, type: 'Koffie', icon: '☕' },
  ];
  const URINE = ['', 'Helder / heel lichtgeel', 'Lichtgeel', 'Donkergeel', 'Oranje / bruinig'];

  function settings() {
    const s = store.data.settings;
    return { goal: Number(s.fluidGoal) || 2000, max: s.fluidMode === 'max', reminder: Boolean(s.hydrationReminder) };
  }

  function saveDrinks(date, drinks) {
    const total = drinks.reduce((sum, d) => sum + (Number(d.ml) || 0), 0);
    store.mergeCheckin(date, { drinks, fluidMl: total, water: Math.round((total / 250) * 10) / 10 });
  }

  function addDrink(date, drink) {
    const c = store.checkinFor(date) || {};
    const drinks = Array.isArray(c.drinks) ? [...c.drinks] : [];
    drinks.push(Object.assign({ id: uid(), time: date === todayISO() ? nowTime() : '' }, drink));
    saveDrinks(date, sortBy(drinks, (d) => d.time || ''));
    ui.toast(`+ ${drink.ml} ml ${drink.type.toLowerCase()}`);
  }

  function removeDrink(date, id) {
    const c = store.checkinFor(date) || {};
    saveDrinks(date, (c.drinks || []).filter((d) => d.id !== id));
  }

  function openOther(date) {
    form.open({
      title: 'Drankje toevoegen',
      fields: [
        { name: 'type', label: 'Wat', type: 'select', options: TYPES, half: true },
        { name: 'ml', label: 'Hoeveel (ml)', type: 'number', half: true, required: true, help: 'Glas ≈ 250 ml, kop ≈ 150–200 ml, blikje 330 ml' },
        { name: 'time', label: 'Tijd', type: 'time', half: true },
      ],
      values: { type: 'Water', ml: 250, time: nowTime() },
      onSubmit(v) {
        if (!v.ml || v.ml <= 0 || v.ml > 3000) return 'Vul een hoeveelheid tussen 1 en 3000 ml in.';
        addDrink(date, { type: v.type, ml: v.ml, time: v.time });
      },
    });
  }

  function openSettings() {
    const s = store.data.settings;
    form.open({
      title: 'Instellingen drinken',
      fields: [
        { name: 'fluidMode', label: 'Soort doel', type: 'select', options: [['goal', 'Dagdoel (minimaal zoveel drinken)'], ['max', 'Vochtbeperking (maximaal zoveel)']] },
        { name: 'fluidGoal', label: 'Hoeveelheid per dag (ml)', type: 'number', half: true, required: true, help: 'Meestal 1500–2000 ml. Heb je een vochtbeperking (bv. bij hart- of nierziekte)? Neem het getal van je arts over.' },
        { name: 'hydrationReminder', label: 'Herinner me als ik achterloop (tussen 9 en 21 uur)', type: 'checkbox' },
      ],
      values: { fluidMode: s.fluidMode || 'goal', fluidGoal: s.fluidGoal || 2000, hydrationReminder: s.hydrationReminder },
      onSubmit(v) {
        if (!v.fluidGoal || v.fluidGoal < 250 || v.fluidGoal > 6000) return 'Kies een hoeveelheid tussen 250 en 6000 ml.';
        store.saveSettings(v);
        if (v.hydrationReminder && v.fluidMode !== 'max' && !(store.data.settings.notify && HT.reminders.permission() === 'granted')) {
          setTimeout(() => HT.reminders.enable());
        }
        ui.toast('Opgeslagen');
      },
    });
  }

  function statusHtml(total, s) {
    const pct = Math.min(100, Math.round((total / s.goal) * 100));
    if (s.max) {
      const over = total > s.goal;
      return `<div class="fluid-big">${formatNum(total)} <small>/ max ${formatNum(s.goal)} ml</small></div>
        <div class="progress ${over ? 'over' : ''}" role="progressbar" aria-valuenow="${total}" aria-valuemin="0" aria-valuemax="${s.goal}"><span style="width:${pct}%"></span></div>
        <p>${over ? ui.badge(`! ${formatNum(total - s.goal)} ml boven je maximum`, 'bad') : `Nog <strong>${formatNum(s.goal - total)} ml</strong> over voor vandaag.`}</p>`;
    }
    const behind = expectedFluid(s.goal, nowTime()) - total;
    return `<div class="fluid-big">${formatNum(total)} <small>/ ${formatNum(s.goal)} ml</small></div>
      <div class="progress" role="progressbar" aria-valuenow="${total}" aria-valuemin="0" aria-valuemax="${s.goal}"><span style="width:${pct}%"></span></div>
      <p>${total >= s.goal ? ui.badge('✓ Doel gehaald', 'good') : behind > 250 ? `Je loopt ongeveer <strong>${formatNum(Math.round(behind / 50) * 50)} ml</strong> achter op schema – tijd voor een glas water.` : 'Je zit op schema. 👍'}</p>`;
  }

  /** Kaartje voor het startscherm. */
  function cardHtml(today) {
    const s = settings();
    const total = fluidMl(store.checkinFor(today)) || 0;
    return `<section class="card">
      <div class="card-head"><h2>💧 Drinken</h2><a href="#/drinken">Alles</a></div>
      ${statusHtml(total, s)}
      <div class="quick-drinks">${QUICK.slice(0, 3).map((q, i) => `<button class="btn small ghost" data-quick="${i}">${q.icon} +${q.ml} ml</button>`).join('')}</div>
    </section>`;
  }

  function bindQuick(el, date) {
    el.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => {
      const q = QUICK[Number(b.dataset.quick)];
      addDrink(date, { type: q.type, ml: q.ml });
    }));
  }

  function render(el) {
    const today = todayISO();
    const s = settings();
    const c = store.checkinFor(today) || {};
    const drinks = c.drinks || [];
    const total = fluidMl(c) || 0;
    const checks = store.list('checkins');

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      const v = fluidMl(store.checkinFor(d));
      if (v != null) days.push({ date: d, value: v });
    }
    const week = days.filter((d) => d.date >= addDays(today, -6));
    const avg = week.length ? week.reduce((a, d) => a + d.value, 0) / week.length : null;
    const byType = {};
    for (const x of checks.filter((y) => y.date >= addDays(today, -6))) for (const d of x.drinks || []) byType[d.type] = (byType[d.type] || 0) + Number(d.ml || 0);

    const enough = (x) => { const v = fluidMl(x); return v == null ? null : v >= s.goal; };
    const insights = s.max ? [] : [
      [sameDayEffect(checks, enough, 'fatigue'), (r) => `Op dagen dat je je doel haalde was je vermoeidheid <strong>${formatNum(r.withIt.toFixed(1))}</strong>, anders <strong>${formatNum(r.without.toFixed(1))}</strong> (van 10).`],
      [sameDayEffect(checks, enough, 'energy'), (r) => `Energie als je genoeg dronk: <strong>${formatNum(r.withIt.toFixed(1))}</strong>, anders <strong>${formatNum(r.without.toFixed(1))}</strong> (van 5).`],
    ].filter(([r]) => r).map(([r, f]) => f(r));

    el.innerHTML = `
      ${ui.pageHead('Drinken', '<button class="btn ghost" data-settings>⚙️ Doel en herinnering</button>')}
      <section class="card">
        <h2>Vandaag</h2>
        ${statusHtml(total, s)}
        <div class="quick-drinks">
          ${QUICK.map((q, i) => `<button class="btn ghost" data-quick="${i}">${q.icon} ${esc(q.label)} <small>${q.ml} ml</small></button>`).join('')}
          <button class="btn ghost" data-other>➕ Anders…</button>
        </div>
        ${drinks.length ? `<ul class="drink-list">${drinks.map((d) => `
          <li><span class="muted">${esc(d.time || '')}</span> <span>${esc(d.type)}</span> <strong>${formatNum(d.ml)} ml</strong>
            <button class="icon-btn" data-remove="${esc(d.id)}" aria-label="Verwijderen">✕</button></li>`).join('')}</ul>`
          : c.water != null ? `<p class="muted">Eerder ingevuld: ${formatNum(c.water)} glazen.</p>` : ''}
        <div class="field urine">
          <label for="urine">Kleur urine vandaag</label>
          <select id="urine" data-urine>${URINE.map((u) => `<option${u === (c.urineColor || '') ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>
          <small class="help">Lichtgeel is goed. Donkergeel kan betekenen dat je te weinig drinkt.</small>
        </div>
        ${s.reminder && !s.max ? '<p class="muted small">🔔 Herinnering staat aan (als de app open is of net op de achtergrond draait).</p>' : ''}
      </section>

      <section class="card">
        <h2>Afgelopen 14 dagen</h2>
        ${avg != null ? `<p>Gemiddeld <strong>${formatNum(Math.round(avg))} ml</strong> per dag (7 dagen)${Object.keys(byType).length ? ` · ${Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, ml]) => `${esc(t.toLowerCase())} ${formatNum(Math.round(ml / 7))} ml/dag`).join(', ')}` : ''}</p>` : ''}
        <div data-chart></div>
        ${insights.map((t) => `<p>💡 ${t}</p>`).join('')}
        <p class="muted small">Advies Voedingscentrum: 1,5 tot 2 liter per dag; meer bij warm weer, sporten of koorts. Water, thee, koffie en melk tellen mee. Alcohol telt niet mee. Heb je een vochtbeperking van je arts? Stel die hierboven in als maximum.</p>
      </section>`;

    chart.lineChart(el.querySelector('[data-chart]'), {
      series: [{ name: 'Drinken', color: 'var(--series-1)', points: days }],
      low: s.max ? undefined : s.goal,
      high: s.max ? s.goal : undefined,
      unit: 'ml',
      label: 'Gedronken per dag',
    });
    const chartEl = el.querySelector('[data-chart]');
    if (days.length) chartEl.insertAdjacentHTML('beforeend', `<p class="muted small">Gestippelde lijn = ${s.max ? 'maximum' : 'doel'} (${formatNum(s.goal)} ml). Vanaf ${esc(formatDateShort(days[0].date))}.</p>`);

    bindQuick(el, today);
    el.querySelector('[data-other]').addEventListener('click', () => openOther(today));
    el.querySelector('[data-settings]').addEventListener('click', openSettings);
    el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => removeDrink(today, b.dataset.remove)));
    el.querySelector('[data-urine]').addEventListener('change', (e) => store.mergeCheckin(today, { urineColor: e.target.value }));
  }

  HT.views.hydration = { title: 'Drinken', render, cardHtml, bindQuick, settings, addDrink };
})(window.HT);
