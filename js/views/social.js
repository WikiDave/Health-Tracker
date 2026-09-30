/* Sociale kring: wie er om je heen zijn, hoeveel contact je hebt en hoe dat voelt. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form, chart, social: S } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatNum, formatDateLong, formatDateShort, sortBy, sameDayEffect } = utils;

  const FACE = ['😞', '🙁', '😐', '🙂', '😄'];
  const FEEL_ICON = { '-2': '🪫', '-1': '😕', 0: '😐', 1: '🙂', 2: '⚡' };

  const people = () => sortBy(store.list('people'), (p) => (p.name || '').toLowerCase());
  const contacts = () => store.list('contacts');

  /** Unieke naam per persoon voor keuzelijsten (bij dubbele namen met de relatie erbij). */
  function labels() {
    const list = people();
    const count = {};
    for (const p of list) count[p.name] = (count[p.name] || 0) + 1;
    return list.map((p) => ({ id: p.id, label: count[p.name] > 1 && p.relation ? `${p.name} (${p.relation})` : p.name }));
  }

  function openPerson(person) {
    form.open({
      title: person ? `${person.name} bewerken` : 'Persoon toevoegen',
      fields: [
        { name: 'name', label: 'Naam', required: true, placeholder: 'bv. Sanne' },
        { name: 'relation', label: 'Wie is het voor je?', type: 'select', options: ['', ...S.RELATIONS], half: true },
        { name: 'wish', label: 'Hoe vaak wil je contact?', type: 'select', half: true, options: [['', 'Geen wens'], ...S.FREQ] },
        { name: 'circle', label: 'Hoe dichtbij?', type: 'select', options: S.CIRCLES.map((c) => [c.key, `${c.icon} ${c.label}`]) },
        { name: 'birthday', label: 'Verjaardag', type: 'date', half: true },
        { name: 'phone', label: 'Telefoon', half: true, placeholder: 'om snel te bellen' },
        { name: 'notes', label: 'Notities', type: 'textarea', placeholder: 'bv. houdt van wandelen, net verhuisd' },
      ],
      values: person || { circle: 'midden' },
      onSubmit(v) {
        store.upsert('people', Object.assign({}, person || {}, v, { circle: v.circle || 'midden', wish: v.wish ? Number(v.wish) : null }));
        ui.toast(person ? 'Opgeslagen' : `${v.name} toegevoegd`);
      },
      onDelete: person ? () => {
        store.remove('people', person.id);
        for (const c of contacts().filter((x) => (x.people || []).includes(person.id))) {
          store.upsert('contacts', Object.assign({}, c, { people: c.people.filter((id) => id !== person.id), others: [c.others, person.name].filter(Boolean).join(', ') }));
        }
      } : null,
    });
  }

  function openContact(entry, preset) {
    const lab = labels();
    const nameOf = (id) => (lab.find((l) => l.id === id) || {}).label;
    const values = entry ? Object.assign({}, entry, { people: (entry.people || []).map(nameOf).filter(Boolean) })
      : Object.assign({ date: todayISO(), time: nowTime(), type: S.TYPES[0], people: [] }, preset || {});
    form.open({
      title: entry ? 'Contact bewerken' : 'Contact noteren',
      fields: [
        { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
        { name: 'time', label: 'Tijd', type: 'time', half: true },
        ...(lab.length ? [{ name: 'people', label: 'Met wie?', type: 'multi', options: lab.map((l) => l.label) }] : []),
        { name: 'others', label: lab.length ? 'Anderen' : 'Met wie?', placeholder: lab.length ? 'bv. collega\'s, nieuwe mensen' : 'bv. Sanne, oma – of voeg mensen toe bij Sociale kring' },
        { name: 'type', label: 'Hoe?', type: 'select', options: S.TYPES, half: true },
        { name: 'duration', label: 'Hoe lang (min)', type: 'number', half: true },
        { name: 'feel', label: 'Gaf het energie of kostte het energie?', type: 'choice', options: S.FEEL.map(([v, t]) => [v, `${FEEL_ICON[v]} ${t}`]) },
        { name: 'quality', label: 'Hoe fijn was het?', type: 'scale', min: 1, max: 5, emoji: FACE },
        { name: 'notes', label: 'Notities', type: 'textarea', placeholder: 'bv. goed gesprek, veel gelachen, ruzie' },
      ],
      values,
      onSubmit(v) {
        const ids = (v.people || []).map((n) => (lab.find((l) => l.label === n) || {}).id).filter(Boolean);
        if (!ids.length && !(v.others || '').trim()) return 'Vul in met wie je contact had.';
        store.upsert('contacts', Object.assign({}, v, { people: ids }, entry ? { id: entry.id } : {}));
        ui.toast('Contact genoteerd 👥');
      },
      onDelete: entry ? () => store.remove('contacts', entry.id) : null,
    });
  }

  const DAY_FIELDS = [
    { name: 'loneliness', label: 'Hoe eenzaam voel je je? (0 = helemaal niet, 10 = heel erg)', type: 'scale', min: 0, max: 10 },
    { name: 'socialBattery', label: 'Je sociale batterij', type: 'select', options: ['', ...S.BATTERY] },
    { name: 'socialNotes', label: 'Notities', placeholder: 'bv. mis mijn vrienden, even niemand willen zien' },
  ];

  function openDay(date) {
    HT.views.checkin.openDayPart({ title: 'Sociaal vandaag', date: date || todayISO(), fields: DAY_FIELDS, toastText: 'Opgeslagen' });
  }

  function names(c) {
    const byId = Object.fromEntries(store.list('people').map((p) => [p.id, p.name]));
    return [...(c.people || []).map((id) => byId[id]).filter(Boolean), c.others].filter(Boolean).join(', ');
  }

  function daysText(n) {
    if (n == null) return 'nog geen contact genoteerd';
    if (n === 0) return 'vandaag';
    if (n === 1) return 'gisteren';
    if (n < 14) return `${n} dagen geleden`;
    if (n < 60) return `${Math.round(n / 7)} weken geleden`;
    return `${Math.round(n / 30)} maanden geleden`;
  }

  function thisWeek(today) {
    return S.weekStats(contacts(), store.list('checkins'), today || todayISO());
  }

  /** Voor het startscherm: aandachtspunten (tijd voor contact, verjaardagen). */
  function alerts(today) {
    const out = [];
    for (const b of S.upcomingBirthdays(store.list('people'), today, 3)) {
      out.push({ kind: 'info', text: b.days === 0 ? `🎂 ${b.person.name} is vandaag jarig (${b.age})!` : `🎂 ${b.person.name} is ${b.days === 1 ? 'morgen' : `over ${b.days} dagen`} jarig (${b.age})`, href: '#/sociaal' });
    }
    for (const d of S.dueList(store.list('people'), contacts(), today).slice(0, 2)) {
      out.push({ kind: 'info', text: `👥 ${d.person.name}: ${d.status.last ? `laatste contact ${daysText(d.status.daysSince)}` : 'nog geen contact genoteerd'} – tijd voor een berichtje?`, href: '#/sociaal' });
    }
    return out;
  }

  function render(el) {
    const today = todayISO();
    const all = contacts();
    const ppl = people();
    const w = thisWeek(today);
    const due = S.dueList(ppl, all, today);
    const birthdays = S.upcomingBirthdays(ppl, today, 30);
    const energy = S.energyByPerson(ppl, all);
    const c = store.checkinFor(today) || {};
    const checks = store.list('checkins');
    const contactDays = new Set(all.filter(S.isInPerson).map((x) => x.date));
    const anyDays = new Set(all.map((x) => x.date));
    const firstContact = all.reduce((m, x) => (!m || x.date < m ? x.date : m), null);
    const tracked = checks.filter((x) => firstContact && x.date >= firstContact && x.date <= today);
    const insights = [];
    const e1 = sameDayEffect(tracked, (x) => contactDays.has(x.date), 'mood');
    const differs = (e) => e && Math.abs(e.withIt - e.without) >= 0.5;
    if (differs(e1)) insights.push(`Op dagen dat je iemand <strong>in het echt</strong> zag was je stemming <strong>${formatNum(e1.withIt.toFixed(1))}</strong>, anders <strong>${formatNum(e1.without.toFixed(1))}</strong> (van 5).`);
    const e2 = sameDayEffect(tracked, (x) => anyDays.has(x.date), 'loneliness');
    if (differs(e2)) insights.push(`Op dagen met contact voelde je je <strong>${formatNum(e2.withIt.toFixed(1))}</strong> eenzaam, zonder contact <strong>${formatNum(e2.without.toFixed(1))}</strong> (van 10).`);
    const e3 = sameDayEffect(tracked, (x) => anyDays.has(x.date), 'stress');
    if (differs(e3)) insights.push(`Stress op dagen met contact: <strong>${formatNum(e3.withIt.toFixed(1))}</strong>, zonder: <strong>${formatNum(e3.without.toFixed(1))}</strong> (van 10).`);
    const lonelyAvg = utils.average(checks, 'loneliness', addDays(today, -13), today);
    const history = sortBy(all, (x) => x.date + (x.time || ''), -1);
    const phone = (p) => (p.phone ? `<a class="btn small ghost" href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">📞 Bel</a>` : '');

    el.innerHTML = `
      ${ui.pageHead('Sociale kring', `<button class="btn primary" data-add-contact>+ Contact</button>
        <button class="btn ghost" data-add-person>+ Persoon</button>`)}
      <section class="card">
        <div class="card-head"><h2>Afgelopen 7 dagen</h2><button class="btn small ghost" data-day>Hoe voel je je sociaal?</button></div>
        <div class="stats">
          <div><span class="stat-value">${w.daysWithContact}<small> /7</small></span><span class="stat-label">dagen met contact</span></div>
          <div><span class="stat-value">${w.inPerson}</span><span class="stat-label">keer in het echt</span></div>
          <div><span class="stat-value">${w.digital}</span><span class="stat-label">bellen / appen</span></div>
          <div><span class="stat-value">${w.people}</span><span class="stat-label">verschillende mensen</span></div>
          <div><span class="stat-value">${w.minutes ? formatNum(Math.round(w.minutes / 6) / 10) : '–'}<small> uur</small></span><span class="stat-label">samen</span></div>
          <div><span class="stat-value">${w.loneliness != null ? formatNum(Math.round(w.loneliness * 10) / 10) : '–'}<small> /10</small></span><span class="stat-label">eenzaam</span></div>
        </div>
        ${c.socialBattery || c.loneliness != null ? `<p class="small">Vandaag: ${esc([c.loneliness != null ? `eenzaam ${c.loneliness}/10` : '', c.socialBattery ? `🔋 ${c.socialBattery.toLowerCase()}` : ''].filter(Boolean).join(' · '))}</p>` : ''}
        ${insights.map((i) => `<p>💡 ${i}</p>`).join('')}
        <p class="muted small">Contact met anderen is net zo belangrijk voor je gezondheid als bewegen en slapen. Het gaat niet om veel mensen, maar om een paar mensen bij wie je terecht kunt. Ook kort contact telt: een praatje, een appje, samen wandelen.</p>
      </section>
      ${lonelyAvg && lonelyAvg.n >= 3 && lonelyAvg.avg >= 6 ? `<div class="crisis" role="note">
        <strong>Je voelt je de laatste tijd vaak eenzaam.</strong> Dat overkomt veel mensen, en je hoeft er niet alleen mee te blijven.
        Praat met iemand bij <a href="https://www.deluisterlijn.nl" target="_blank" rel="noopener">De Luisterlijn</a>: bel <a href="tel:0880767000">088 0767 000</a> of chat – dag en nacht, anoniem.
        Ook je huisarts of praktijkondersteuner (POH-GGZ) kan helpen, bijvoorbeeld met activiteiten in de buurt.
      </div>` : ''}
      ${due.length ? `<section class="card">
        <h2>💬 Tijd voor contact</h2>
        <ul class="list">${due.slice(0, 6).map((d) => `<li class="social-row"><span><strong>${esc(d.person.name)}</strong><br><small class="muted">${d.status.last ? `laatste contact ${daysText(d.status.daysSince)}` : 'nog geen contact genoteerd'} · wens: ${esc((S.FREQ.find((f) => f[0] === d.status.wish) || [0, ''])[1].toLowerCase())}</small></span>
          <span class="button-row">${phone(d.person)}<button class="btn small ghost" data-contact-with="${esc(d.person.id)}">✓ Contact gehad</button></span></li>`).join('')}</ul>
      </section>` : ''}
      ${birthdays.length ? `<section class="card"><h2>🎂 Jarig</h2><ul class="list">${birthdays.map((b) => `<li><strong>${esc(b.person.name)}</strong> ${b.days === 0 ? ui.badge('vandaag!', 'good') : `<span class="muted">${esc(formatDateShort(b.date))} · over ${b.days} ${b.days === 1 ? 'dag' : 'dagen'}</span>`} · wordt ${b.age}</li>`).join('')}</ul></section>` : ''}
      <section class="card">
        <div class="card-head"><h2>Je kring</h2><button class="btn small ghost" data-add-person>+ Persoon</button></div>
        ${ppl.length ? `<div class="circles">${S.CIRCLES.map((circ) => {
          const inCircle = ppl.filter((p) => (p.circle || 'midden') === circ.key);
          return `<div class="circle-col circle-${circ.key}">
            <h3>${circ.icon} ${esc(circ.label)} <span class="muted">(${inCircle.length})</span></h3>
            ${inCircle.length ? `<ul class="list">${inCircle.map((p) => {
              const st = S.personStatus(p, all, today);
              return `<li><button class="link-btn" data-person="${esc(p.id)}">${esc(p.name)}</button>${p.relation ? ` <small class="muted">${esc(p.relation.toLowerCase())}</small>` : ''}<br><small class="${st.due ? 'warn-text' : 'muted'}">${esc(daysText(st.daysSince))}</small></li>`;
            }).join('')}</ul>` : `<p class="muted small">${esc(circ.text)}</p>`}
          </div>`;
        }).join('')}</div>` : '<p>Zet de mensen om je heen erin: partner, familie, vrienden, collega\'s. Geef aan hoe vaak je contact wilt, dan helpt de app je eraan te denken – en zie je hoe je kring eruitziet.</p>'}
      </section>
      ${energy.length ? `<section class="card"><h2>⚡ Wie geeft je energie?</h2><ul class="list">${energy.map((x) => `<li>${FEEL_ICON[Math.round(x.avg)]} <strong>${esc(x.person.name)}</strong> <span class="muted">– ${x.avg > 0.3 ? 'geeft je meestal energie' : x.avg < -0.3 ? 'kost je meestal energie' : 'neutraal'} (${x.n}×)</span></li>`).join('')}</ul>
        <p class="muted small">Zoek vaker de mensen op die je energie geven. Kost contact met iemand vaak energie? Plan dan rust erna, of spreek korter af.</p></section>` : ''}
      <section class="card"><h2>Contact per week</h2><div data-chart></div></section>
      <h2 class="section-title">Contactmomenten</h2>
      ${history.length ? ui.collapsible(history, (x) => `
        <article class="card item">
          <div class="item-head"><h3>${esc(names(x) || 'Contact')}</h3><button class="btn small ghost" data-edit="${esc(x.id)}">Bewerken</button></div>
          <ul class="pills">
            <li>${esc(formatDateLong(x.date))}${x.time ? `, ${esc(x.time)}` : ''}</li>
            <li>${S.isInPerson(x) ? '🤝' : '📱'} ${esc(x.type || '')}</li>
            ${x.duration ? `<li>${formatNum(x.duration)} min</li>` : ''}
            ${x.feel != null ? `<li>${FEEL_ICON[x.feel]} ${esc(S.FEEL.find((f) => f[0] === Number(x.feel))[1].toLowerCase())}</li>` : ''}
            ${x.quality ? `<li>${FACE[x.quality - 1]} ${x.quality}/5</li>` : ''}
          </ul>
          ${x.notes ? `<p class="muted">${esc(x.notes)}</p>` : ''}
        </article>`, 10, 'Oudere contacten', 'meer') : ui.empty('Nog geen contactmomenten. Noteer wie je hebt gezien, gebeld of geappt.')}`;

    const weeks = S.weekly(all, today, 12);
    chart.lineChart(el.querySelector('[data-chart]'), {
      series: [
        { name: 'In het echt', color: 'var(--series-1)', points: all.length ? weeks.map((x) => ({ date: x.week, value: x.inPerson })) : [] },
        { name: 'Bellen / appen', color: 'var(--series-2)', points: all.length ? weeks.map((x) => ({ date: x.week, value: x.digital })) : [] },
      ],
      unit: '×',
      label: 'Contactmomenten per week',
    });

    el.querySelectorAll('[data-add-contact]').forEach((b) => b.addEventListener('click', () => openContact()));
    el.querySelectorAll('[data-add-person]').forEach((b) => b.addEventListener('click', () => openPerson()));
    el.querySelector('[data-day]').addEventListener('click', () => openDay(today));
    el.querySelectorAll('[data-person]').forEach((b) => b.addEventListener('click', () => openPerson(store.get('people', b.dataset.person))));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openContact(store.get('contacts', b.dataset.edit))));
    el.querySelectorAll('[data-contact-with]').forEach((b) => b.addEventListener('click', () => {
      const p = store.get('people', b.dataset.contactWith);
      const label = (labels().find((l) => l.id === p.id) || {}).label;
      openContact(null, { people: [label], type: 'Bellen' });
    }));
  }

  HT.views.social = { title: 'Sociale kring', render, openContact, openPerson, openDay, thisWeek, alerts, names, DAY_FIELDS };
})(window.HT);
