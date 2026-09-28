/* Vaccinaties: wat, wanneer, batchnummer en wanneer de volgende prik nodig is. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form } = HT;
  const { escapeHtml: esc, todayISO, formatDate, vaccinationsDue, sortBy } = utils;

  const FIELDS = [
    { name: 'name', label: 'Vaccinatie', required: true, list: 'vaccine-names', placeholder: 'bv. Griep (influenza)' },
    { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
    { name: 'doseNumber', label: 'Welke prik', half: true, placeholder: 'bv. 1e, 2e, booster' },
    { name: 'product', label: 'Vaccin / merk', half: true },
    { name: 'batch', label: 'Batchnummer', half: true, help: 'Staat op je vaccinatiebewijs of sticker.' },
    { name: 'givenBy', label: 'Gegeven door', half: true, placeholder: 'bv. GGD, huisarts' },
    { name: 'location', label: 'Locatie', half: true },
    { name: 'nextDue', label: 'Volgende prik nodig op', type: 'date', half: true },
    { name: 'reaction', label: 'Bijwerkingen / reactie', half: true, placeholder: 'bv. pijnlijke arm, 1 dag koorts' },
    { name: 'notes', label: 'Notities', type: 'textarea' },
  ];

  function openVaccination(v) {
    form.open({
      title: v ? 'Vaccinatie bewerken' : 'Vaccinatie toevoegen',
      fields: FIELDS,
      values: v || { date: todayISO() },
      onSubmit(values) {
        store.upsert('vaccinations', Object.assign({}, values, v ? { id: v.id } : {}));
        ui.toast('Vaccinatie opgeslagen');
      },
      onDelete: v ? () => store.remove('vaccinations', v.id) : null,
    });
  }

  function dueText(d) {
    if (d.status === 'overdue') return `${d.vaccination.name}: volgende prik was nodig op ${formatDate(d.vaccination.nextDue)}`;
    return `${d.vaccination.name}: volgende prik ${d.days === 0 ? 'vandaag' : `over ${d.days} dagen`} (${formatDate(d.vaccination.nextDue)})`;
  }

  function render(el) {
    const today = todayISO();
    const list = sortBy(store.list('vaccinations'), 'date', -1);
    const due = vaccinationsDue(list, today);

    el.innerHTML = `
      ${ui.pageHead('Vaccinaties', '<button class="btn primary" data-add>+ Vaccinatie</button>')}
      ${due.length ? `<section class="card"><h2>Binnenkort nodig</h2><ul class="alerts">
        ${due.map((d) => `<li class="${d.status === 'overdue' ? 'bad' : 'warn'}">${esc(dueText(d))}</li>`).join('')}
      </ul></section>` : ''}
      ${list.length ? `<section class="card">
        <div class="table-wrap"><table>
          <thead><tr><th>Datum</th><th>Vaccinatie</th><th>Prik</th><th>Volgende</th><th></th></tr></thead>
          <tbody>${list.map((v) => `<tr>
            <td>${esc(formatDate(v.date))}</td>
            <td><strong>${esc(v.name)}</strong>${v.product ? `<br><small class="muted">${esc(v.product)}${v.batch ? ` · batch ${esc(v.batch)}` : ''}</small>` : v.batch ? `<br><small class="muted">batch ${esc(v.batch)}</small>` : ''}
              ${v.givenBy || v.location ? `<br><small class="muted">${esc([v.givenBy, v.location].filter(Boolean).join(', '))}</small>` : ''}
              ${v.reaction ? `<br><small>Reactie: ${esc(v.reaction)}</small>` : ''}</td>
            <td>${esc(v.doseNumber || '')}</td>
            <td>${esc(formatDate(v.nextDue))}</td>
            <td><button class="btn small ghost" data-edit="${esc(v.id)}">Bewerken</button></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>` : ui.empty('Nog geen vaccinaties. Je vaccinatiegegevens vind je o.a. bij de GGD (mijnrivm.nl) of je huisarts.')}`;

    el.querySelector('[data-add]').addEventListener('click', () => openVaccination());
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openVaccination(store.get('vaccinations', b.dataset.edit))));
  }

  HT.views.vaccinations = { title: 'Vaccinaties', render, dueText };
})(window.HT);
