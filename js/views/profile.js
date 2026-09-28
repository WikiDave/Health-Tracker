/* Profiel (medische basisgegevens), back-up en een printbaar medisch overzicht. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form, views } = HT;
  const { escapeHtml: esc, todayISO, formatDate, formatDateLong, formatNum, medTimes, rangeStatus, sortBy, daysBetween } = utils;

  const FIELDS = [
    { name: 'name', label: 'Naam', half: true },
    { name: 'birthDate', label: 'Geboortedatum', type: 'date', half: true },
    { name: 'bloodType', label: 'Bloedgroep', type: 'select', half: true, options: ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Onbekend'] },
    { name: 'height', label: 'Lengte (cm)', type: 'number', half: true },
    { name: 'allergies', label: 'Allergieën en overgevoeligheden', type: 'textarea', placeholder: 'bv. penicilline, noten' },
    { name: 'conditions', label: 'Aandoeningen / diagnoses', type: 'textarea', placeholder: 'bv. diabetes type 2 (sinds 2019), hoge bloeddruk' },
    { name: 'history', label: 'Operaties en eerdere ziekten', type: 'textarea' },
    { name: 'gp', label: 'Huisarts (naam + telefoon)', half: true },
    { name: 'pharmacy', label: 'Apotheek (naam + telefoon)', half: true },
    { name: 'specialists', label: 'Behandelend specialisten', type: 'textarea', placeholder: 'bv. cardioloog Dr. X, ziekenhuis Y' },
    { name: 'insurer', label: 'Zorgverzekeraar + polisnummer', half: true },
    { name: 'emergency', label: 'Noodcontact (naam + telefoon)', half: true },
    { name: 'notes', label: 'Overige belangrijke informatie', type: 'textarea', placeholder: 'bv. donorregistratie, wilsverklaring, pacemaker' },
  ];

  function age(birthDate) {
    if (!birthDate) return '';
    return `${Math.floor(daysBetween(birthDate, todayISO()) / 365.25)} jaar`;
  }

  function profileDl(p) {
    return `<dl class="kvs">
      ${ui.kv('Naam', p.name)}
      ${ui.kv('Geboortedatum', p.birthDate ? `${formatDate(p.birthDate)} (${age(p.birthDate)})` : '')}
      ${ui.kv('Bloedgroep', p.bloodType)}
      ${ui.kv('Lengte', p.height ? `${formatNum(p.height)} cm` : '')}
      ${ui.kv('Allergieën', p.allergies)}
      ${ui.kv('Aandoeningen', p.conditions)}
      ${ui.kv('Voorgeschiedenis', p.history)}
      ${ui.kv('Huisarts', p.gp)}
      ${ui.kv('Apotheek', p.pharmacy)}
      ${ui.kv('Specialisten', p.specialists)}
      ${ui.kv('Zorgverzekeraar', p.insurer)}
      ${ui.kv('Noodcontact', p.emergency)}
      ${ui.kv('Overig', p.notes)}
    </dl>`;
  }

  function render(el) {
    const p = store.data.profile;
    const hasProfile = Object.values(p).some(Boolean);

    el.innerHTML = `
      ${ui.pageHead('Profiel', '<button class="btn primary" data-edit>Bewerken</button>')}
      <section class="card">
        ${hasProfile ? profileDl(p) : ui.empty('Vul je medische basisgegevens in. Handig voor jezelf en in noodgevallen.')}
      </section>

      <section class="card">
        <h2>Medisch overzicht</h2>
        <p>Een samenvatting van je profiel, medicatie, laatste uitslagen en afspraken – om te printen of mee te nemen naar de dokter.</p>
        <a class="btn ghost" href="#/overzicht">Bekijk overzicht</a>
      </section>

      <section class="card">
        <h2>Back-up</h2>
        <p>Je gegevens staan <strong>alleen in deze browser op dit apparaat</strong>. Maak regelmatig een back-up, bijvoorbeeld om over te zetten naar een ander apparaat.</p>
        <div class="button-row">
          <button class="btn ghost" data-export>⬇ Back-up downloaden</button>
          <label class="btn ghost">⬆ Back-up terugzetten<input type="file" accept="application/json,.json" data-import hidden></label>
        </div>
        ${store.data.updatedAt ? `<p class="muted">Laatst gewijzigd: ${esc(new Date(store.data.updatedAt).toLocaleString('nl-NL'))}</p>` : ''}
      </section>

      <section class="card">
        <h2>Alles wissen</h2>
        <p class="muted">Verwijdert al je gegevens van dit apparaat. Dit kan niet ongedaan worden gemaakt.</p>
        <button class="btn danger ghost" data-clear>Alle gegevens wissen</button>
      </section>

      <p class="muted small">Deze app vervangt geen medisch advies. Neem bij twijfel of klachten contact op met je huisarts. Bij spoed: bel 112.</p>`;

    el.querySelector('[data-edit]').addEventListener('click', () => form.open({
      title: 'Profiel bewerken',
      fields: FIELDS,
      values: p,
      onSubmit(values) {
        store.saveProfile(values);
        ui.toast('Profiel opgeslagen');
      },
    }));

    el.querySelector('[data-export]').addEventListener('click', () => {
      ui.download(`gezondheid-backup-${todayISO()}.json`, store.exportJSON());
    });

    el.querySelector('[data-import]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('Hiermee vervang je alle huidige gegevens door de back-up. Doorgaan?')) return;
      try {
        store.importJSON(await file.text());
        ui.toast('Back-up teruggezet');
      } catch (err) {
        alert('Terugzetten mislukt: ' + err.message);
      }
    });

    el.querySelector('[data-clear]').addEventListener('click', () => {
      if (confirm('Weet je zeker dat je ALLE gegevens wilt wissen?') && confirm('Echt zeker? Maak eventueel eerst een back-up.')) {
        store.clearAll();
        ui.toast('Alle gegevens gewist');
      }
    });
  }

  function renderOverview(el) {
    const today = todayISO();
    const p = store.data.profile;
    const meds = sortBy(store.list('medications').filter((m) => utils.isMedActiveOn(m, today)), (m) => m.name.toLowerCase());
    const labs = sortBy(store.list('labs'), 'date', -1).slice(0, 3);
    const visitsUp = sortBy(store.list('visits').filter((v) => v.date >= today), 'date');
    const visitsPast = sortBy(store.list('visits').filter((v) => v.date < today), 'date', -1).slice(0, 5);
    const rx = store.list('prescriptions').filter(views.prescriptions.isOpen);

    el.innerHTML = `
      <div class="no-print"><p><a href="#/profiel" class="back">← Profiel</a></p></div>
      ${ui.pageHead('Medisch overzicht', '<button class="btn primary no-print" data-print>🖨 Printen / PDF</button>')}
      <p class="muted">Gemaakt op ${esc(formatDateLong(today))}</p>

      <section class="card"><h2>Persoonlijke gegevens</h2>${profileDl(p)}</section>

      <section class="card"><h2>Huidige medicatie</h2>
        ${meds.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Medicijn</th><th>Dosis</th><th>Wanneer</th><th>Waarvoor</th></tr></thead>
          <tbody>${meds.map((m) => `<tr><td><strong>${esc(m.name)}</strong></td><td>${esc(m.dose || '')}${m.unitsPerDose > 1 ? ` (${formatNum(m.unitsPerDose)} st.)` : ''}</td>
            <td>${medTimes(m).length ? medTimes(m).map(esc).join(', ') : 'zo nodig'}${m.instructions ? `<br><small>${esc(m.instructions)}</small>` : ''}</td><td>${esc(m.reason || '')}</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="muted">Geen medicatie.</p>'}
      </section>

      ${rx.length ? `<section class="card"><h2>Lopende voorschriften</h2><ul class="list">
        ${rx.map((r) => `<li><strong>${esc(r.title)}</strong> – ${esc([r.dosage, r.prescriber, r.validUntil ? 'geldig tot ' + formatDate(r.validUntil) : ''].filter(Boolean).join(' · '))}</li>`).join('')}
      </ul></section>` : ''}

      <section class="card"><h2>Laatste bloedonderzoeken</h2>
        ${labs.length ? labs.map((lab) => `<h3>${esc(formatDate(lab.date))}${lab.lab ? ` · ${esc(lab.lab)}` : ''}</h3>
          <div class="table-wrap"><table><thead><tr><th>Bepaling</th><th class="num">Uitslag</th><th class="num">Referentie</th><th></th></tr></thead>
          <tbody>${(lab.results || []).map((r) => {
            const s = rangeStatus(r.value, r.low, r.high);
            return `<tr><td>${esc(r.name)}</td><td class="num">${esc(formatNum(r.value))} ${esc(r.unit || '')}</td>
              <td class="num">${r.low != null || r.high != null ? esc(`${formatNum(r.low ?? '')} – ${formatNum(r.high ?? '')}`) : ''}</td>
              <td>${s === 'low' || s === 'high' ? ui.statusBadge(s) : ''}</td></tr>`;
          }).join('')}</tbody></table></div>`).join('') : '<p class="muted">Geen uitslagen.</p>'}
      </section>

      <section class="card"><h2>Afspraken</h2>
        ${visitsUp.length ? `<h3>Gepland</h3><ul class="list">${visitsUp.map((v) => `<li>${esc(formatDate(v.date))}${v.time ? ' ' + esc(v.time) : ''} – ${esc([v.type, v.specialty, v.doctor, v.location].filter(Boolean).join(' · '))}</li>`).join('')}</ul>` : ''}
        ${visitsPast.length ? `<h3>Recent geweest</h3><ul class="list">${visitsPast.map((v) => `<li>${esc(formatDate(v.date))} – ${esc([v.type, v.specialty, v.doctor].filter(Boolean).join(' · '))}${v.outcome ? `<br><small>${esc(v.outcome)}</small>` : ''}</li>`).join('')}</ul>` : ''}
        ${!visitsUp.length && !visitsPast.length ? '<p class="muted">Geen afspraken.</p>' : ''}
      </section>`;

    el.querySelector('[data-print]').addEventListener('click', () => window.print());
  }

  HT.views.profile = { title: 'Profiel', render };
  HT.views.overview = { title: 'Medisch overzicht', render: renderOverview };
})(window.HT);
