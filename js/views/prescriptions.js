/* Voorschriften / recepten: geldigheid, herhalingen en apotheek. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form } = HT;
  const { escapeHtml: esc, todayISO, formatDate, daysBetween, prescriptionStatus, sortBy } = utils;

  const KINDS = ['Medicijn', 'Hulpmiddel', 'Verwijzing', 'Fysiotherapie', 'Laboratorium', 'Leefstijladvies', 'Anders'];
  const STATES = ['Actief', 'Opgehaald', 'Herhaalrecept aangevraagd', 'Afgerond', 'Gestopt'];

  const FIELDS = [
    { name: 'title', label: 'Wat is voorgeschreven', required: true, placeholder: 'bv. Omeprazol 20 mg, steunkousen, verwijzing cardioloog' },
    { name: 'kind', label: 'Soort', type: 'select', options: KINDS, half: true },
    { name: 'status', label: 'Status', type: 'select', options: STATES, half: true },
    { name: 'dosage', label: 'Dosering / gebruik', placeholder: 'bv. 1x per dag 1 capsule voor het ontbijt' },
    { name: 'prescriber', label: 'Voorgeschreven door', half: true, placeholder: 'bv. huisarts Dr. Jansen' },
    { name: 'date', label: 'Datum voorschrift', type: 'date', half: true, required: true },
    { name: 'validUntil', label: 'Geldig tot', type: 'date', half: true },
    { name: 'repeats', label: 'Aantal herhalingen', type: 'number', half: true },
    { name: 'pharmacy', label: 'Apotheek / leverancier', half: true },
    { name: 'quantity', label: 'Hoeveelheid', half: true, placeholder: 'bv. 90 stuks' },
    { name: 'notes', label: 'Notities', type: 'textarea' },
  ];

  function openPrescription(p) {
    form.open({
      title: p ? 'Voorschrift bewerken' : 'Voorschrift toevoegen',
      fields: FIELDS,
      values: p || { date: todayISO(), kind: 'Medicijn', status: 'Actief' },
      onSubmit(values) {
        store.upsert('prescriptions', Object.assign({}, values, p ? { id: p.id } : {}));
        ui.toast('Voorschrift opgeslagen');
      },
      onDelete: p ? () => store.remove('prescriptions', p.id) : null,
    });
  }

  function isOpen(p) {
    return !['Afgerond', 'Gestopt'].includes(p.status);
  }

  function card(p, today) {
    const status = prescriptionStatus(p, today);
    const left = p.validUntil ? daysBetween(today, p.validUntil) : null;
    const canAddMed = p.kind === 'Medicijn' && !store.list('medications').some((m) => p.title.toLowerCase().startsWith(m.name.toLowerCase()));
    return `
      <article class="card item">
        <div class="item-head">
          <h3>${esc(p.title)}</h3>
          <button class="btn small ghost" data-edit="${esc(p.id)}">Bewerken</button>
        </div>
        <p>${ui.badge(p.kind || 'Anders')} ${ui.badge(p.status || 'Actief', 'neutral')} ${isOpen(p) ? ui.statusBadge(status) : ''}</p>
        ${p.dosage ? `<p>${esc(p.dosage)}</p>` : ''}
        <dl class="kvs">
          ${ui.kv('Voorgeschreven door', p.prescriber)}
          ${ui.kv('Datum', formatDate(p.date))}
          ${ui.kv('Geldig tot', p.validUntil ? `${formatDate(p.validUntil)}${left != null && left >= 0 ? ` (nog ${left} dagen)` : ''}` : '')}
          ${ui.kv('Herhalingen', p.repeats)}
          ${ui.kv('Hoeveelheid', p.quantity)}
          ${ui.kv('Apotheek', p.pharmacy)}
        </dl>
        ${p.notes ? `<p class="muted">${esc(p.notes)}</p>` : ''}
        ${canAddMed && isOpen(p) ? `<button class="btn small ghost" data-to-med="${esc(p.id)}">+ Toevoegen aan medicatie</button>` : ''}
      </article>`;
  }

  function render(el) {
    const today = todayISO();
    const all = sortBy(store.list('prescriptions'), 'date', -1);
    const open = all.filter(isOpen);
    const closed = all.filter((p) => !isOpen(p));

    el.innerHTML = `
      ${ui.pageHead('Voorschriften', '<button class="btn primary" data-add>+ Voorschrift</button>')}
      <h2 class="section-title">Lopend (${open.length})</h2>
      ${open.length ? open.map((p) => card(p, today)).join('') : ui.empty('Geen lopende voorschriften.')}
      ${closed.length ? `<details class="stopped"><summary>Afgerond / gestopt (${closed.length})</summary>${closed.map((p) => card(p, today)).join('')}</details>` : ''}`;

    el.querySelector('[data-add]').addEventListener('click', () => openPrescription());
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openPrescription(store.get('prescriptions', b.dataset.edit))));
    el.querySelectorAll('[data-to-med]').forEach((b) => b.addEventListener('click', () => {
      const p = store.get('prescriptions', b.dataset.toMed);
      HT.views.medication.openMed({
        name: p.title, instructions: p.dosage, prescriber: p.prescriber, pharmacy: p.pharmacy,
        startDate: p.date, active: true, form: 'Tablet', unitsPerDose: 1,
      });
    }));
  }

  HT.views.prescriptions = { title: 'Voorschriften', render, isOpen };
})(window.HT);
