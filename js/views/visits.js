/* Bezoeken aan huisarts, ziekenhuis en andere zorgverleners – gepland en geweest. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form } = HT;
  const { escapeHtml: esc, todayISO, formatDateLong, daysBetween, visitToICS, sortBy } = utils;

  const TYPES = ['Huisarts', 'Praktijkondersteuner (POH)', 'Ziekenhuis – polikliniek', 'Ziekenhuis – opname', 'Spoedeisende hulp', 'Huisartsenpost',
    'Specialist', 'Tandarts', 'Fysiotherapeut', 'Psycholoog', 'Apotheek', 'Bloedafname / lab', 'Anders'];

  const FIELDS = [
    { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
    { name: 'time', label: 'Tijd', type: 'time', half: true },
    { name: 'type', label: 'Soort bezoek', type: 'select', options: TYPES, half: true },
    { name: 'specialty', label: 'Afdeling / specialisme', half: true, placeholder: 'bv. cardiologie' },
    { name: 'doctor', label: 'Arts / zorgverlener', half: true, placeholder: 'bv. Dr. de Vries' },
    { name: 'location', label: 'Locatie', half: true, placeholder: 'bv. ziekenhuis, route 42' },
    { name: 'reason', label: 'Reden / vragen die ik wil stellen', type: 'textarea' },
    { name: 'outcome', label: 'Uitkomst, diagnose en advies', type: 'textarea' },
    { name: 'followUp', label: 'Vervolg / actiepunten', type: 'textarea', placeholder: 'bv. over 3 maanden terug, bloed laten prikken' },
    { name: 'notes', label: 'Notities', type: 'textarea' },
  ];

  function openVisit(v) {
    form.open({
      title: v ? 'Bezoek bewerken' : 'Bezoek toevoegen',
      fields: FIELDS,
      values: v || { date: todayISO(), type: 'Huisarts' },
      onSubmit(values) {
        store.upsert('visits', Object.assign({}, values, v ? { id: v.id } : {}));
        ui.toast('Bezoek opgeslagen');
      },
      onDelete: v ? () => store.remove('visits', v.id) : null,
    });
  }

  function whenLabel(v, today) {
    const d = daysBetween(today, v.date);
    if (d === 0) return 'Vandaag';
    if (d === 1) return 'Morgen';
    if (d > 1) return `Over ${d} dagen`;
    return '';
  }

  function card(v, today) {
    const upcoming = v.date >= today;
    const when = upcoming ? whenLabel(v, today) : '';
    return `
      <article class="card item${upcoming ? ' upcoming' : ''}">
        <div class="item-head">
          <h3>${esc(v.type || 'Bezoek')}${v.specialty ? ` · ${esc(v.specialty)}` : ''}</h3>
          <button class="btn small ghost" data-edit="${esc(v.id)}">Bewerken</button>
        </div>
        <p>📅 ${esc(formatDateLong(v.date))}${v.time ? `, ${esc(v.time)}` : ''} ${when ? ui.badge(when, 'info') : ''}</p>
        <dl class="kvs">
          ${ui.kv('Arts', v.doctor)}
          ${ui.kv('Locatie', v.location)}
          ${ui.kv(upcoming ? 'Reden / vragen' : 'Reden', v.reason)}
          ${ui.kv('Uitkomst', v.outcome)}
          ${ui.kv('Vervolg', v.followUp)}
        </dl>
        ${v.notes ? `<p class="muted">${esc(v.notes)}</p>` : ''}
        ${upcoming ? `<button class="btn small ghost" data-ics="${esc(v.id)}">📆 Zet in agenda</button>` : ''}
      </article>`;
  }

  function render(el) {
    const today = todayISO();
    const visits = store.list('visits');
    const upcoming = sortBy(visits.filter((v) => v.date >= today), (v) => v.date + (v.time || ''));
    const past = sortBy(visits.filter((v) => v.date < today), (v) => v.date + (v.time || ''), -1);

    el.innerHTML = `
      ${ui.pageHead('Arts- en ziekenhuisbezoeken', '<button class="btn primary" data-add>+ Bezoek</button>')}
      <h2 class="section-title">Gepland (${upcoming.length})</h2>
      ${upcoming.length ? upcoming.map((v) => card(v, today)).join('') : ui.empty('Geen geplande afspraken.')}
      <h2 class="section-title">Geweest (${past.length})</h2>
      ${past.length ? past.map((v) => card(v, today)).join('') : ui.empty('Nog geen bezoeken vastgelegd.')}`;

    el.querySelector('[data-add]').addEventListener('click', () => openVisit());
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openVisit(store.get('visits', b.dataset.edit))));
    el.querySelectorAll('[data-ics]').forEach((b) => b.addEventListener('click', () => {
      const v = store.get('visits', b.dataset.ics);
      ui.download(`afspraak-${v.date}.ics`, visitToICS(v), 'text/calendar');
    }));
  }

  HT.views.visits = { title: 'Bezoeken', render, openVisit, whenLabel };
})(window.HT);
