/* Medicatie: wat je moet nemen, wanneer, voorraad en therapietrouw. */
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

  /** Opent het formulier; een object zonder id dient als voorinvulling voor een nieuw medicijn. */
  function openMed(med) {
    const existing = med && med.id ? med : null;
    form.open({
      title: existing ? 'Medicijn bewerken' : 'Medicijn toevoegen',
      fields: FIELDS,
      values: med || { active: true, startDate: todayISO(), form: 'Tablet', unitsPerDose: 1 },
      onSubmit(values) {
        store.upsert('medications', Object.assign({}, values, existing ? { id: existing.id } : {}));
        ui.toast('Medicijn opgeslagen');
      },
      onDelete: existing ? () => store.remove('medications', existing.id) : null,
    });
  }

  /** Lijst van innames voor een dag, gesorteerd op tijd. */
  function dosesFor(date) {
    const doses = [];
    for (const med of store.list('medications')) {
      if (!isMedActiveOn(med, date)) continue;
      for (const time of medTimes(med)) doses.push({ med, time, taken: store.isTaken(date, med.id, time) });
    }
    return sortBy(doses, (d) => d.time + d.med.name);
  }

  function doseListHtml(date) {
    const doses = dosesFor(date);
    if (!doses.length) return '<p class="muted">Geen vaste innames gepland.</p>';
    return `<ul class="doses">${doses.map((d) => `
      <li class="${d.taken ? 'taken' : ''}">
        <button class="dose-toggle" data-dose="${esc(d.med.id)}|${esc(d.time)}" data-date="${date}" aria-pressed="${d.taken}">
          <span class="check" aria-hidden="true">${d.taken ? '✓' : ''}</span>
          <span class="time">${esc(d.time)}</span>
          <span class="what"><strong>${esc(d.med.name)}</strong> ${esc(d.med.dose || '')}
            ${d.med.unitsPerDose > 1 ? `<span class="muted">(${formatNum(d.med.unitsPerDose)} st.)</span>` : ''}
            ${d.med.instructions ? `<small>${esc(d.med.instructions)}</small>` : ''}</span>
        </button>
      </li>`).join('')}</ul>`;
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
    const adh = adherence([med], store.data.medLog, addDays(today, -29), today);
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

  function render(el) {
    const today = todayISO();
    const meds = sortBy(store.list('medications'), (m) => m.name.toLowerCase());
    const active = meds.filter((m) => m.active !== false && (!m.endDate || m.endDate >= today));
    const stopped = meds.filter((m) => !active.includes(m));

    el.innerHTML = `
      ${ui.pageHead('Medicatie', '<button class="btn primary" data-add>+ Medicijn</button>')}
      <section class="card">
        <h2>Vandaag innemen</h2>
        ${doseListHtml(today)}
      </section>
      <h2 class="section-title">Huidige medicatie (${active.length})</h2>
      ${active.length ? active.map((m) => medCard(m, today)).join('') : ui.empty('Nog geen medicijnen toegevoegd.')}
      ${stopped.length ? `<details class="stopped"><summary>Gestopte medicatie (${stopped.length})</summary>${stopped.map((m) => medCard(m, today)).join('')}</details>` : ''}`;

    el.querySelector('[data-add]').addEventListener('click', () => openMed());
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openMed(store.get('medications', b.dataset.edit))));
    bindDoses(el);
  }

  HT.views.medication = { title: 'Medicatie', render, openMed, doseListHtml, bindDoses, dosesFor };
})(window.HT);
