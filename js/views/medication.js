/* Medicatie en supplementen: wat je moet nemen, wanneer, voorraad en therapietrouw.
 * Supplementen/vitamines zijn medicatie-items met kind: 'supplement' en hebben een eigen scherm. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form } = HT;
  const { escapeHtml: esc, todayISO, addDays, formatDate, formatNum, medTimes, daysOfStockLeft, adherence, isMedActiveOn, sortBy } = utils;

  const FORMS = ['Tablet', 'Capsule', 'Drank', 'Poeder', 'Injectie', 'Inhalator', 'Neusspray', 'Druppels', 'Zalf / crème', 'Pleister', 'Zetpil', 'Anders'];

  const FIELDS = [
    { name: 'name', label: 'Naam medicijn', required: true, placeholder: 'bv. Metformine' },
    { name: 'dose', label: 'Sterkte / dosis', half: true, placeholder: 'bv. 500 mg' },
    { name: 'form', label: 'Vorm', type: 'select', options: FORMS, half: true },
    { name: 'times', label: 'Innametijden', type: 'times', half: true, placeholder: '08:00, 20:00', help: 'Laat leeg voor "zo nodig".' },
    { name: 'unitsPerDose', label: 'Aantal per inname', type: 'number', half: true, placeholder: '1' },
    { name: 'instructions', label: 'Gebruiksaanwijzing', placeholder: 'bv. bij het eten, niet met alcohol' },
    { name: 'reason', label: 'Waarvoor', half: true, placeholder: 'bv. diabetes' },
    { name: 'prescriber', label: 'Voorgeschreven door', half: true },
    { name: 'startDate', label: 'Startdatum', type: 'date', half: true },
    { name: 'endDate', label: 'Einddatum', type: 'date', half: true, help: 'Leeg = doorlopend.' },
    { name: 'stock', label: 'Voorraad (stuks)', type: 'number', half: true, help: 'Wordt automatisch minder als je een inname afvinkt.' },
    { name: 'pharmacy', label: 'Apotheek', half: true },
    { name: 'active', label: 'Gebruik ik nu', type: 'checkbox' },
    { name: 'notes', label: 'Notities / bijwerkingen', type: 'textarea' },
  ];

  const SUPPLEMENT_FIELDS = [
    { name: 'name', label: 'Naam supplement / vitamine', required: true, list: 'supplement-names', placeholder: 'bv. Vitamine D' },
    { name: 'dose', label: 'Sterkte / dosis', half: true, placeholder: 'bv. 25 mcg (1000 IE)' },
    { name: 'form', label: 'Vorm', type: 'select', options: ['Tablet', 'Capsule', 'Kauwtablet', 'Druppels', 'Drank', 'Poeder', 'Bruistablet', 'Gummy', 'Anders'], half: true },
    { name: 'brand', label: 'Merk', half: true },
    { name: 'times', label: 'Innametijden', type: 'times', half: true, placeholder: '08:00', help: 'Laat leeg voor "zo nodig".' },
    { name: 'unitsPerDose', label: 'Aantal per inname', type: 'number', half: true, placeholder: '1' },
    { name: 'instructions', label: 'Gebruiksaanwijzing', placeholder: 'bv. bij de maaltijd, niet samen met koffie of thee' },
    { name: 'reason', label: 'Waarvoor', half: true, placeholder: 'bv. vitamine D-tekort' },
    { name: 'advisedBy', label: 'Geadviseerd door', type: 'select', half: true, options: ['', 'Eigen initiatief', 'Huisarts', 'Specialist', 'Diëtist', 'Apotheek', 'Anders'] },
    { name: 'startDate', label: 'Startdatum', type: 'date', half: true },
    { name: 'endDate', label: 'Einddatum', type: 'date', half: true, help: 'Leeg = doorlopend.' },
    { name: 'stock', label: 'Voorraad (stuks)', type: 'number', half: true, help: 'Wordt automatisch minder als je een inname afvinkt.' },
    { name: 'active', label: 'Gebruik ik nu', type: 'checkbox' },
    { name: 'notes', label: 'Notities / bijwerkingen', type: 'textarea' },
  ];

  const KINDS = {
    med: {
      title: 'Medicatie', noun: 'Medicijn', add: '+ Medicijn', fields: FIELDS, current: 'Huidige medicatie', stopped: 'Gestopte medicatie',
      empty: 'Nog geen medicijnen toegevoegd.', icsName: 'medicatie-herinneringen.ics', defaults: { form: 'Tablet' },
      match: (m) => m.kind !== 'supplement',
    },
    supplement: {
      title: 'Supplementen & vitamines', noun: 'Supplement', add: '+ Supplement', fields: SUPPLEMENT_FIELDS, current: 'Gebruik ik nu', stopped: 'Gestopt',
      empty: 'Nog geen supplementen of vitamines toegevoegd.', icsName: 'supplementen-herinneringen.ics', defaults: { form: 'Tablet', kind: 'supplement' },
      match: (m) => m.kind === 'supplement',
    },
  };

  const kindOf = (med) => (med && med.kind === 'supplement' ? 'supplement' : 'med');

  /** Opent het formulier; een object zonder id dient als voorinvulling voor een nieuw item. */
  function openMed(med, kindKey) {
    const existing = med && med.id ? med : null;
    const k = KINDS[kindKey || kindOf(med)];
    form.open({
      title: `${k.noun} ${existing ? 'bewerken' : 'toevoegen'}`,
      fields: k.fields,
      values: med || Object.assign({ active: true, startDate: todayISO(), unitsPerDose: 1 }, k.defaults),
      onSubmit(values) {
        const kind = kindKey === 'supplement' || (med && med.kind === 'supplement') ? { kind: 'supplement' } : {};
        store.upsert('medications', Object.assign({}, values, kind, existing ? { id: existing.id } : {}));
        ui.toast(`${k.noun} opgeslagen`);
      },
      onDelete: existing ? () => store.remove('medications', existing.id) : null,
    });
  }

  function openSupplement(item) {
    openMed(item, 'supplement');
  }

  /** Lijst van innames voor een dag, gesorteerd op tijd. Optioneel alleen medicijnen of alleen supplementen. */
  function dosesFor(date, match) {
    const doses = [];
    for (const med of store.list('medications')) {
      if (!isMedActiveOn(med, date) || (match && !match(med))) continue;
      for (const time of medTimes(med)) doses.push({ med, time, taken: store.isTaken(date, med.id, time) });
    }
    return sortBy(doses, (d) => d.time + d.med.name);
  }

  function doseListHtml(date, match) {
    const doses = dosesFor(date, match);
    if (!doses.length) return '<p class="muted">Geen vaste innames gepland.</p>';
    const now = date === todayISO() ? utils.nowTime() : null;
    return `<ul class="doses">${doses.map((d) => {
      const late = !d.taken && now && d.time < now;
      return `
      <li class="${d.taken ? 'taken' : late ? 'late' : ''}">
        <button class="dose-toggle" data-dose="${esc(d.med.id)}|${esc(d.time)}" data-date="${date}" aria-pressed="${d.taken}">
          <span class="check" aria-hidden="true">${d.taken ? '✓' : ''}</span>
          <span class="time">${esc(d.time)}</span>
          <span class="what">${d.med.kind === 'supplement' ? '<span aria-label="supplement">🌿 </span>' : ''}<strong>${esc(d.med.name)}</strong> ${esc(d.med.dose || '')}
            ${d.med.unitsPerDose > 1 ? `<span class="muted">(${formatNum(d.med.unitsPerDose)} st.)</span>` : ''}
            ${d.med.instructions ? `<small>${esc(d.med.instructions)}</small>` : ''}</span>
          ${late ? '<span class="late-label">nog niet genomen</span>' : ''}
        </button>
      </li>`;
    }).join('')}</ul>`;
  }

  function bindDoses(el) {
    el.querySelectorAll('[data-dose]').forEach((b) => b.addEventListener('click', () => {
      const [id, time] = b.dataset.dose.split('|');
      store.toggleDose(b.dataset.date, id, time);
    }));
  }

  function medCard(med, today) {
    const times = medTimes(med);
    const left = daysOfStockLeft(med);
    const adh = adherence([med], store.data.medLog, addDays(today, -29), today, utils.nowTime());
    return `
      <article class="card item">
        <div class="item-head">
          <h3>${esc(med.name)} <span class="muted">${esc(med.dose || '')}</span></h3>
          <button class="btn small ghost" data-edit="${esc(med.id)}">Bewerken</button>
        </div>
        <p>${times.length ? `🕒 ${times.map(esc).join(' · ')}` : '🕒 Zo nodig'}${med.form ? ` · ${esc(med.form)}` : ''}</p>
        ${med.instructions ? `<p>ℹ️ ${esc(med.instructions)}</p>` : ''}
        <dl class="kvs">
          ${ui.kv('Waarvoor', med.reason)}
          ${ui.kv('Voorgeschreven door', med.prescriber)}
          ${ui.kv('Merk', med.brand)}
          ${ui.kv('Geadviseerd door', med.advisedBy)}
          ${ui.kv('Sinds', formatDate(med.startDate))}
          ${ui.kv('Tot', formatDate(med.endDate))}
          ${ui.kv('Voorraad', med.stock != null ? `${formatNum(med.stock)} st.${left != null ? ` (± ${left} dagen)` : ''}` : '')}
          ${ui.kv('Apotheek', med.pharmacy)}
          ${med.active !== false && adh.planned ? ui.kv('Ingenomen (30 dagen)', `${adh.pct}% (${adh.taken} van ${adh.planned})`) : ''}
        </dl>
        ${left != null && left <= 7 && med.active !== false ? ui.badge(`! Nog ${left} dagen voorraad – bestel op tijd`, 'warn') : ''}
        ${med.notes ? `<p class="muted">${esc(med.notes)}</p>` : ''}
      </article>`;
  }

  function remindersHtml(k) {
    const r = HT.reminders;
    const on = store.data.settings.notify && r.permission() === 'granted';
    return `<section class="card">
      <div class="card-head"><h2>🔔 Herinneringen</h2>${on ? ui.badge('✓ Aan', 'good') : ui.badge('Uit')}</div>
      <p>Zet je innametijden in de agenda van je telefoon: dan krijg je <strong>altijd</strong> een melding, ook als deze app dicht is.</p>
      <div class="button-row">
        <button class="btn primary" data-ics-meds>📆 Innametijden in agenda zetten</button>
        ${on ? '<button class="btn ghost" data-notify-off>Meldingen van app uitzetten</button><button class="btn ghost" data-notify-test>Testmelding</button>'
          : r.supported() ? '<button class="btn ghost" data-notify-on>Meldingen van app aanzetten</button>' : ''}
      </div>
      <p class="muted small">Meldingen van de app zelf komen alleen als de app open staat of net op de achtergrond draait. Wijzig je medicatie? Zet de agenda-items dan opnieuw in je agenda (verwijder de oude).</p>
    </section>`;
  }

  function renderKind(el, kindKey) {
    const k = KINDS[kindKey];
    const today = todayISO();
    const meds = sortBy(store.list('medications').filter(k.match), (m) => m.name.toLowerCase());
    const active = meds.filter((m) => m.active !== false && (!m.endDate || m.endDate >= today));
    const stopped = meds.filter((m) => !active.includes(m));

    el.innerHTML = `
      ${ui.pageHead(k.title, `<button class="btn primary" data-add>${k.add}</button>`)}
      <section class="card">
        <h2>Vandaag innemen</h2>
        ${doseListHtml(today, k.match)}
      </section>
      <h2 class="section-title">${k.current} (${active.length})</h2>
      ${active.length ? active.map((m) => medCard(m, today)).join('') : ui.empty(k.empty)}
      ${active.some((m) => medTimes(m).length) ? remindersHtml(k) : ''}
      ${kindKey === 'supplement' ? `<section class="card">
        <h2>Goed om te weten</h2>
        <p class="muted small">Ook "natuurlijke" middelen kunnen de werking van medicijnen veranderen – bijvoorbeeld sint-janskruid, vitamine K (bij bloedverdunners), ijzer, calcium en magnesium (bij sommige antibiotica en schildkliermedicatie). Vertel je arts en apotheek welke supplementen je gebruikt. Ze staan daarom ook in je <a href="#/overzicht">medisch overzicht</a>.</p>
      </section>` : ''}
      ${stopped.length ? `<details class="stopped"><summary>${k.stopped} (${stopped.length})</summary>${stopped.map((m) => medCard(m, today)).join('')}</details>` : ''}`;

    el.querySelector('[data-add]').addEventListener('click', () => openMed(null, kindKey));
    const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.addEventListener('click', fn); };
    on('[data-ics-meds]', () => ui.download(k.icsName, utils.medsToICS(store.list('medications').filter(k.match), today), 'text/calendar'));
    on('[data-notify-on]', () => HT.reminders.enable());
    on('[data-notify-off]', () => HT.reminders.disable());
    on('[data-notify-test]', () => HT.reminders.test());
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openMed(store.get('medications', b.dataset.edit))));
    bindDoses(el);
  }

  HT.views.medication = { title: 'Medicatie', render: (el) => renderKind(el, 'med'), openMed, doseListHtml, bindDoses, dosesFor, KINDS };
  HT.views.supplements = { title: 'Supplementen & vitamines', render: (el) => renderKind(el, 'supplement'), openSupplement };
})(window.HT);
