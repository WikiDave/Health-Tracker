/* Slaap: slaapdagboek per nacht (bedtijd, opstaan, wakker worden, kwaliteit, storingen) met overzicht en grafiek.
 * Een nacht hoort bij de datum waarop je wakker wordt. De gegevens staan in het dagrecord. */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart } = HT;
  const { escapeHtml: esc, todayISO, addDays, formatDateLong, formatNum, average, sleepDuration, minutesOf, sortBy } = utils;

  const FACE = ['😞', '🙁', '😐', '🙂', '😄'];

  const FIELDS = [
    { name: 'bedtime', label: 'Naar bed', type: 'time', half: true },
    { name: 'wakeTime', label: 'Opgestaan', type: 'time', half: true },
    { name: 'fallAsleep', label: 'Inslapen duurde (min)', type: 'number', half: true },
    { name: 'wakeUps', label: "Keer wakker 's nachts", type: 'number', half: true },
    { name: 'sleepHours', label: 'Uren geslapen', type: 'number', half: true, help: 'Leeg laten = berekend uit bedtijd en opstaan.' },
    { name: 'nap', label: 'Middagdutje (min)', type: 'number', half: true },
    { name: 'sleepQuality', label: 'Slaapkwaliteit', type: 'scale', min: 1, max: 5, emoji: FACE },
    { name: 'restedWaking', label: 'Uitgerust wakker geworden?', type: 'scale', min: 1, max: 5, emoji: FACE },
    { name: 'sleepDisturbance', label: 'Wat hield je wakker?', placeholder: 'bv. pijn, plassen, piekeren, lawaai, warm, snurkende partner' },
    { name: 'sleepAid', label: 'Slaapmiddel of hulpmiddel', half: true, placeholder: 'bv. melatonine, oordoppen' },
    { name: 'screenBeforeBed', label: 'Schermtijd laatste uur voor bed', type: 'select', half: true, options: ['', 'Geen', 'Kort (< 15 min)', 'Ongeveer een half uur', 'Het hele uur'] },
    { name: 'dreams', label: 'Dromen / notities', type: 'textarea', placeholder: 'bv. nachtmerrie, onrustig, snurken' },
  ];

  function openSleep(date) {
    HT.views.checkin.openDayPart({
      title: 'Afgelopen nacht',
      date: date || todayISO(),
      fields: FIELDS,
      toastText: 'Slaap opgeslagen',
      prepare(v) {
        if (v.sleepHours == null) v.sleepHours = sleepDuration(v.bedtime, v.wakeTime, v.fallAsleep);
        if (v.sleepHours != null && (v.sleepHours < 0 || v.sleepHours > 24)) return 'Uren geslapen moet tussen 0 en 24 liggen.';
        return v;
      },
    });
  }

  /** Gemiddelde klokttijd, rekening houdend met tijden rond middernacht. */
  function avgClock(times, aroundMidnight) {
    const mins = times.filter(Boolean).map((t) => {
      const m = minutesOf(t);
      return aroundMidnight && m < 12 * 60 ? m + 24 * 60 : m;
    });
    if (!mins.length) return null;
    const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) % (24 * 60);
    return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
  }

  function hasSleep(c) {
    return ['sleepHours', 'bedtime', 'wakeTime', 'sleepQuality', 'restedWaking', 'wakeUps', 'sleepDisturbance'].some((k) => c[k] != null && c[k] !== '');
  }

  let period = 30;

  function render(el) {
    const today = todayISO();
    const checks = store.list('checkins');
    const nights = sortBy(checks.filter(hasSleep), 'date', -1);
    const week = nights.filter((c) => c.date >= addDays(today, -6));
    const from = period ? addDays(today, -period + 1) : '0000';
    const hours = average(checks, 'sleepHours', addDays(today, -6), today);
    const quality = average(checks, 'sleepQuality', addDays(today, -6), today);
    const wakeUps = average(checks, 'wakeUps', addDays(today, -6), today);
    const bed = avgClock(week.map((c) => c.bedtime), true);
    const wake = avgClock(week.map((c) => c.wakeTime), false);
    const lastNight = store.checkinFor(today);

    const fatigueBySleep = utils.sameDayEffect(checks, (c) => (c.sleepHours == null ? null : c.sleepHours < 7), 'fatigue');
    const coffeeEffect = utils.nextDayEffect(checks.filter((c) => c.coffee != null), (c) => c.coffee >= 3, checks, 'sleepQuality');
    const screenEffect = utils.sameDayEffect(checks, (c) => (!c.screenBeforeBed ? null : ['Ongeveer een half uur', 'Het hele uur'].includes(c.screenBeforeBed)), 'sleepQuality');

    const insights = [];
    if (fatigueBySleep) insights.push(`Na nachten korter dan 7 uur was je vermoeidheid gemiddeld <strong>${formatNum(fatigueBySleep.withIt.toFixed(1))}</strong>, na langere nachten <strong>${formatNum(fatigueBySleep.without.toFixed(1))}</strong> (van 10).`);
    if (coffeeEffect) insights.push(`Na dagen met 3 of meer koppen koffie was je slaapkwaliteit gemiddeld <strong>${formatNum(coffeeEffect.withUse.toFixed(1))}</strong>, anders <strong>${formatNum(coffeeEffect.without.toFixed(1))}</strong> (van 5).`);
    if (screenEffect) insights.push(`Met een half uur of meer schermtijd voor bed was je slaapkwaliteit <strong>${formatNum(screenEffect.withIt.toFixed(1))}</strong>, met minder <strong>${formatNum(screenEffect.without.toFixed(1))}</strong> (van 5).`);

    el.innerHTML = `
      ${ui.pageHead('Slaap', `<button class="btn primary" data-add>${lastNight && hasSleep(lastNight) ? 'Afgelopen nacht bewerken' : '+ Afgelopen nacht'}</button>
        <button class="btn ghost" data-other>Andere nacht</button>`)}
      <section class="card">
        <h2>Afgelopen 7 nachten</h2>
        <div class="stats">
          <div><span class="stat-value">${hours ? formatNum(hours.avg.toFixed(1)) : '–'}<small> uur</small></span><span class="stat-label">gemiddeld geslapen</span></div>
          <div><span class="stat-value">${quality ? formatNum(quality.avg.toFixed(1)) : '–'}<small> /5</small></span><span class="stat-label">slaapkwaliteit</span></div>
          <div><span class="stat-value">${bed || '–'}</span><span class="stat-label">gem. naar bed</span></div>
          <div><span class="stat-value">${wake || '–'}</span><span class="stat-label">gem. opgestaan</span></div>
          <div><span class="stat-value">${wakeUps ? formatNum(wakeUps.avg.toFixed(1)) : '–'}</span><span class="stat-label">keer wakker per nacht</span></div>
        </div>
        ${insights.map((i) => `<p>💡 ${i}</p>`).join('')}
        <p class="muted small">Volwassenen hebben meestal 7 tot 9 uur slaap nodig. Vaste bed- en opstatijden, weinig schermen en geen cafeïne of alcohol in de avond helpen. Slaap je al weken slecht? Bespreek het met je huisarts.</p>
      </section>
      <section class="card">
        <div class="card-head">
          <h2>Uren slaap</h2>
          <select data-period aria-label="Periode">
            ${[[7, '7 nachten'], [30, '30 nachten'], [90, '3 maanden'], [365, '1 jaar'], [0, 'Alles']].map(([v, t]) => `<option value="${v}"${v === period ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div data-chart></div>
      </section>
      <h2 class="section-title">Slaapdagboek</h2>
      ${nights.length ? ui.collapsible(nights, (c) => `
        <article class="card item">
          <div class="item-head"><h3>Nacht naar ${esc(formatDateLong(c.date))}</h3><button class="btn small ghost" data-edit="${esc(c.date)}">Bewerken</button></div>
          <ul class="pills">
            ${c.sleepHours != null ? `<li>😴 ${formatNum(c.sleepHours)} uur</li>` : ''}
            ${c.bedtime || c.wakeTime ? `<li>🛏 ${esc(c.bedtime || '?')} – ${esc(c.wakeTime || '?')}</li>` : ''}
            ${c.sleepQuality ? `<li>${FACE[c.sleepQuality - 1]} kwaliteit ${c.sleepQuality}/5</li>` : ''}
            ${c.restedWaking ? `<li>uitgerust ${c.restedWaking}/5</li>` : ''}
            ${c.fallAsleep ? `<li>inslapen ${formatNum(c.fallAsleep)} min</li>` : ''}
            ${c.wakeUps != null && c.wakeUps !== '' ? `<li>${formatNum(c.wakeUps)}× wakker</li>` : ''}
            ${c.nap ? `<li>dutje ${formatNum(c.nap)} min</li>` : ''}
          </ul>
          ${c.sleepDisturbance ? `<p><strong>Wakker door:</strong> ${esc(c.sleepDisturbance)}</p>` : ''}
          ${c.sleepAid || c.screenBeforeBed ? `<p class="muted">${esc([c.sleepAid ? `Hulpmiddel: ${c.sleepAid}` : '', c.screenBeforeBed ? `Scherm voor bed: ${c.screenBeforeBed.toLowerCase()}` : ''].filter(Boolean).join(' · '))}</p>` : ''}
          ${c.dreams ? `<p class="muted">${esc(c.dreams)}</p>` : ''}
        </article>`, 10, 'Oudere nachten') : ui.empty('Nog geen nachten vastgelegd. Vul elke ochtend in hoe je hebt geslapen.')}`;

    chart.lineChart(el.querySelector('[data-chart]'), {
      series: [{ name: 'Slaap', color: 'var(--series-1)', points: checks.filter((c) => c.date >= from && c.sleepHours != null).map((c) => ({ date: c.date, value: Number(c.sleepHours) })) }],
      low: 7,
      high: 9,
      unit: 'uur',
      label: 'Uren slaap per nacht',
    });

    el.querySelector('[data-add]').addEventListener('click', () => openSleep(today));
    el.querySelector('[data-other]').addEventListener('click', () => openSleep(addDays(today, -1)));
    el.querySelector('[data-period]').addEventListener('change', (e) => { period = Number(e.target.value); render(el); });
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openSleep(b.dataset.edit)));
  }

  HT.views.sleep = { title: 'Slaap', render, openSleep, hasSleep };
})(window.HT);
