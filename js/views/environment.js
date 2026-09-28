/* Omgeving: werk, buiten zijn, feest/uitgaan, sociale contacten en bijzonderheden – en hoe die samenhangen met hoe je je voelt. */
(function (HT) {
  'use strict';
  const { store, ui, utils } = HT;
  const { escapeHtml: esc, todayISO, addDays, formatDateLong, formatNum, sameDayEffect, nextDayEffect, sortBy } = utils;

  const WORK = ['Niet gewerkt', 'Thuis gewerkt', 'Op locatie gewerkt', 'Avond- of nachtdienst', 'Studie / school', 'Vrijwilligerswerk', 'Mantelzorg'];
  const WEATHER = ['', 'Zonnig', 'Half bewolkt', 'Bewolkt / grijs', 'Regen', 'Koud', 'Warm / heet', 'Storm / wind'];

  const FIELDS = [
    { name: 'hW', type: 'heading', label: '💼 Werk' },
    { name: 'work', label: 'Werk vandaag', type: 'select', options: WORK, half: true },
    { name: 'workHours', label: 'Uren', type: 'number', half: true },
    { name: 'workLoad', label: 'Werkdruk (0 = rustig, 10 = extreem druk)', type: 'scale', min: 0, max: 10 },
    { name: 'hO', type: 'heading', label: '🌳 Buiten' },
    { name: 'outsideMinutes', label: 'Tijd buiten (minuten)', type: 'number', half: true },
    { name: 'weather', label: 'Weer', type: 'select', options: WEATHER, half: true },
    { name: 'hP', type: 'heading', label: '🎉 Sociaal en uitgaan' },
    { name: 'party', label: 'Feest, festival of uitgaan', type: 'checkbox' },
    { name: 'social', label: 'Afgesproken met vrienden, familie of visite', type: 'checkbox' },
    { name: 'travel', label: 'Op reis / lang onderweg', type: 'checkbox' },
    { name: 'alone', label: 'Veel alleen geweest (en dat voelde niet fijn)', type: 'checkbox' },
    { name: 'hE', type: 'heading', label: '🏠 Omgeving' },
    { name: 'screenTime', label: 'Schermtijd buiten werk (uren)', type: 'number', half: true },
    { name: 'busyPlace', label: 'Drukke of lawaaiige omgeving', type: 'checkbox', half: true },
    { name: 'envNotes', label: 'Bijzonderheden', type: 'textarea', placeholder: 'bv. ruzie, verhuizing, verbouwing buren, hittegolf, hooikoorts, verjaardag' },
  ];

  function openDay(date) {
    HT.views.checkin.openDayPart({ title: 'Omgeving', date: date || todayISO(), fields: FIELDS, toastText: 'Omgeving opgeslagen' });
  }

  function hasEnv(c) {
    return ['work', 'workHours', 'workLoad', 'outsideMinutes', 'weather', 'screenTime', 'envNotes'].some((k) => c[k] != null && c[k] !== '')
      || ['party', 'social', 'travel', 'alone', 'busyPlace'].some((k) => c[k]);
  }

  const worked = (c) => (!c.work ? null : c.work !== 'Niet gewerkt');
  const fmt = (n) => formatNum(n.toFixed(1));

  function insights(checks) {
    const envDays = checks.filter(hasEnv);
    const out = [];
    const add = (res, text) => { if (res) out.push(text(res)); };
    add(sameDayEffect(envDays, worked, 'stress'), (r) => `Op werkdagen was je stress gemiddeld <strong>${fmt(r.withIt)}</strong>, op vrije dagen <strong>${fmt(r.without)}</strong> (van 10).`);
    add(sameDayEffect(envDays, worked, 'fatigue'), (r) => `Vermoeidheid op werkdagen: <strong>${fmt(r.withIt)}</strong>, op vrije dagen: <strong>${fmt(r.without)}</strong> (van 10).`);
    add(sameDayEffect(envDays, (c) => (c.outsideMinutes == null ? null : c.outsideMinutes >= 30), 'mood'), (r) => `Op dagen met minstens een half uur buiten was je stemming <strong>${fmt(r.withIt)}</strong>, anders <strong>${fmt(r.without)}</strong> (van 5).`);
    add(sameDayEffect(envDays, (c) => (c.outsideMinutes == null ? null : c.outsideMinutes >= 30), 'energy'), (r) => `Energie met een half uur buiten: <strong>${fmt(r.withIt)}</strong>, zonder: <strong>${fmt(r.without)}</strong> (van 5).`);
    add(nextDayEffect(envDays, (c) => Boolean(c.party), checks, 'fatigue'), (r) => `De dag na een feest of uitgaan was je vermoeidheid <strong>${fmt(r.withUse)}</strong>, anders <strong>${fmt(r.without)}</strong> (van 10).`);
    add(nextDayEffect(envDays, (c) => Boolean(c.party), checks, 'pain'), (r) => `Pijn de dag na een feest: <strong>${fmt(r.withUse)}</strong>, anders <strong>${fmt(r.without)}</strong> (van 10).`);
    add(sameDayEffect(envDays, (c) => Boolean(c.social), 'mood'), (r) => `Op dagen dat je mensen zag was je stemming <strong>${fmt(r.withIt)}</strong>, anders <strong>${fmt(r.without)}</strong> (van 5).`);
    add(sameDayEffect(envDays, (c) => (c.workLoad == null ? null : c.workLoad >= 7), 'sleepQuality'), (r) => `Na (heel) drukke werkdagen was je slaapkwaliteit <strong>${fmt(r.withIt)}</strong>, anders <strong>${fmt(r.without)}</strong> (van 5).`);
    return out;
  }

  function render(el) {
    const today = todayISO();
    const checks = store.list('checkins');
    const days = sortBy(checks.filter(hasEnv), 'date', -1);
    const last30 = checks.filter((c) => c.date >= addDays(today, -29) && hasEnv(c));
    const workDays = last30.filter((c) => worked(c));
    const workHours = workDays.filter((c) => c.workHours != null);
    const outside = last30.filter((c) => c.outsideMinutes != null);
    const found = insights(checks);

    el.innerHTML = `
      ${ui.pageHead('Omgeving', '<button class="btn primary" data-add>+ Vandaag invullen</button><button class="btn ghost" data-other>Andere dag</button>')}
      <p class="muted">Werk, buiten zijn, feestjes en de mensen om je heen hebben invloed op hoe je je voelt. Vul het in naast je dagelijkse check, dan zie je hier de verbanden.</p>
      <section class="card">
        <h2>Afgelopen 30 dagen</h2>
        ${last30.length ? `<div class="stats">
          <div><span class="stat-value">${workDays.length}</span><span class="stat-label">dagen gewerkt</span></div>
          <div><span class="stat-value">${workHours.length ? fmt(workHours.reduce((s, c) => s + Number(c.workHours), 0) / workHours.length) : '–'}</span><span class="stat-label">gem. uren per werkdag</span></div>
          <div><span class="stat-value">${outside.length ? formatNum(Math.round(outside.reduce((s, c) => s + Number(c.outsideMinutes), 0) / outside.length)) : '–'}<small> min</small></span><span class="stat-label">gem. buiten per dag</span></div>
          <div><span class="stat-value">${last30.filter((c) => c.party).length}</span><span class="stat-label">feest / uitgaan</span></div>
          <div><span class="stat-value">${last30.filter((c) => c.social).length}</span><span class="stat-label">dagen mensen gezien</span></div>
        </div>` : '<p class="muted">Nog niets ingevuld.</p>'}
      </section>
      <section class="card">
        <h2>Wat valt op?</h2>
        ${found.length ? found.map((t) => `<p>💡 ${t}</p>`).join('') : '<p class="muted">Na een paar weken invullen (samen met je dagelijkse check) zie je hier verbanden, bijvoorbeeld tussen werkdruk en slaap of tussen buiten zijn en je stemming.</p>'}
        <p class="muted small">Dit zijn gemiddelden uit je eigen gegevens, geen bewezen oorzaak-gevolg.</p>
      </section>
      <h2 class="section-title">Per dag</h2>
      ${days.length ? ui.collapsible(days, (c) => `
        <article class="card item">
          <div class="item-head"><h3>${esc(formatDateLong(c.date))}</h3><button class="btn small ghost" data-edit="${esc(c.date)}">Bewerken</button></div>
          <ul class="pills">
            ${c.work ? `<li>💼 ${esc(c.work)}${c.workHours ? `, ${formatNum(c.workHours)} u` : ''}</li>` : ''}
            ${c.workLoad != null ? `<li>werkdruk ${c.workLoad}/10</li>` : ''}
            ${c.outsideMinutes != null ? `<li>🌳 ${formatNum(c.outsideMinutes)} min buiten</li>` : ''}
            ${c.weather ? `<li>${esc(c.weather)}</li>` : ''}
            ${c.party ? '<li>🎉 feest / uitgaan</li>' : ''}
            ${c.social ? '<li>👥 mensen gezien</li>' : ''}
            ${c.travel ? '<li>🧳 onderweg</li>' : ''}
            ${c.alone ? '<li>alleen</li>' : ''}
            ${c.busyPlace ? '<li>druk / lawaai</li>' : ''}
            ${c.screenTime != null ? `<li>📱 ${formatNum(c.screenTime)} u scherm</li>` : ''}
          </ul>
          ${c.envNotes ? `<p class="muted">${esc(c.envNotes)}</p>` : ''}
        </article>`, 10, 'Oudere dagen') : ui.empty('Nog niets ingevuld.')}`;

    el.querySelector('[data-add]').addEventListener('click', () => openDay(today));
    el.querySelector('[data-other]').addEventListener('click', () => openDay(addDays(today, -1)));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openDay(b.dataset.edit)));
  }

  HT.views.environment = { title: 'Omgeving', render, openDay, hasEnv };
})(window.HT);
