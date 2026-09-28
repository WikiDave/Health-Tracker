/* Bloedonderzoeken: uitslagen per afname en het verloop per bepaling. */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form } = HT;
  const { escapeHtml: esc, todayISO, formatDate, formatNum, rangeStatus, sortBy } = utils;

  const FIELDS = [
    { name: 'date', label: 'Datum afname', type: 'date', required: true, half: true },
    { name: 'lab', label: 'Laboratorium / ziekenhuis', half: true, placeholder: 'bv. Saltro, huisartsenlab' },
    { name: 'orderedBy', label: 'Aangevraagd door', half: true },
    { name: 'fasting', label: 'Nuchter geprikt', type: 'checkbox', half: true },
    { name: 'results', label: 'Uitslagen', type: 'results', help: 'Neem de referentiewaarden (min/max) over van je uitslag – die verschillen per lab.' },
    { name: 'notes', label: 'Toelichting arts / notities', type: 'textarea' },
  ];

  function openLab(lab) {
    form.open({
      title: lab ? 'Bloedonderzoek bewerken' : 'Bloedonderzoek toevoegen',
      fields: FIELDS,
      values: lab || { date: todayISO() },
      onSubmit(values) {
        if (!values.results.length) return 'Vul minstens één uitslag in (naam en waarde).';
        store.upsert('labs', Object.assign({}, values, lab ? { id: lab.id } : {}));
        ui.toast('Bloedonderzoek opgeslagen');
      },
      onDelete: lab ? () => store.remove('labs', lab.id) : null,
    });
  }

  /** Alle losse uitslagen met datum, gegroepeerd per bepaling (hoofdletterongevoelig). */
  function byParameter() {
    const map = new Map();
    for (const lab of store.list('labs')) {
      for (const r of lab.results || []) {
        const key = r.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: r.name.trim(), items: [] });
        map.get(key).items.push(Object.assign({ date: lab.date }, r));
      }
    }
    for (const p of map.values()) p.items = sortBy(p.items, 'date');
    return map;
  }

  function resultRowHtml(r) {
    const status = rangeStatus(r.value, r.low, r.high);
    const ref = r.low != null || r.high != null ? `${formatNum(r.low ?? '')} – ${formatNum(r.high ?? '')}` : '';
    return `<tr class="${status === 'low' || status === 'high' ? 'out' : ''}">
      <td><a href="#/bloed/${encodeURIComponent(r.name)}">${esc(r.name)}</a></td>
      <td class="num"><strong>${esc(formatNum(r.value))}</strong> ${esc(r.unit || '')}</td>
      <td class="num muted">${esc(ref)}</td>
      <td>${status === 'normal' || status === 'unknown' ? '' : ui.statusBadge(status)}</td>
    </tr>`;
  }

  function labCard(lab) {
    const out = (lab.results || []).filter((r) => ['low', 'high'].includes(rangeStatus(r.value, r.low, r.high)));
    return `
      <article class="card item">
        <div class="item-head">
          <h3>${esc(formatDate(lab.date))}${lab.lab ? ` <span class="muted">· ${esc(lab.lab)}</span>` : ''}</h3>
          <button class="btn small ghost" data-edit="${esc(lab.id)}">Bewerken</button>
        </div>
        <p class="muted">${(lab.results || []).length} bepalingen${out.length ? ` · ${ui.badge(`${out.length} buiten referentie`, 'warn')}` : ''}${lab.fasting ? ' · nuchter' : ''}${lab.orderedBy ? ` · via ${esc(lab.orderedBy)}` : ''}</p>
        <div class="table-wrap"><table class="results-table">
          <thead><tr><th>Bepaling</th><th class="num">Uitslag</th><th class="num">Referentie</th><th></th></tr></thead>
          <tbody>${(lab.results || []).map(resultRowHtml).join('')}</tbody>
        </table></div>
        ${lab.notes ? `<p class="muted">${esc(lab.notes)}</p>` : ''}
      </article>`;
  }

  function renderTrend(el, name) {
    const params = byParameter();
    const p = params.get(name.toLowerCase());
    el.innerHTML = `
      <p><a href="#/bloed" class="back">← Alle bloedonderzoeken</a></p>
      ${ui.pageHead(name)}
      ${p ? `
        <section class="card"><h2>Verloop</h2><div data-chart></div></section>
        <section class="card">
          <h2>Alle uitslagen</h2>
          <div class="table-wrap"><table class="results-table">
            <thead><tr><th>Datum</th><th class="num">Uitslag</th><th class="num">Referentie</th><th></th></tr></thead>
            <tbody>${[...p.items].reverse().map((r) => {
              const status = rangeStatus(r.value, r.low, r.high);
              const ref = r.low != null || r.high != null ? `${formatNum(r.low ?? '')} – ${formatNum(r.high ?? '')}` : '';
              return `<tr class="${status === 'low' || status === 'high' ? 'out' : ''}"><td>${esc(formatDate(r.date))}</td>
                <td class="num"><strong>${esc(formatNum(r.value))}</strong> ${esc(r.unit || '')}</td>
                <td class="num muted">${esc(ref)}</td><td>${status === 'normal' || status === 'unknown' ? '' : ui.statusBadge(status)}</td></tr>`;
            }).join('')}</tbody>
          </table></div>
        </section>` : ui.empty('Geen uitslagen gevonden voor deze bepaling.')}`;
    if (!p) return;
    const latest = p.items[p.items.length - 1];
    chart.lineChart(el.querySelector('[data-chart]'), {
      series: [{ name, color: 'var(--series-1)', points: p.items.map((r) => ({ date: r.date, value: r.value })) }],
      low: latest.low ?? undefined,
      high: latest.high ?? undefined,
      unit: latest.unit,
      label: `${name} over tijd`,
    });
  }

  function render(el, param) {
    if (param) return renderTrend(el, param);
    const labs = sortBy(store.list('labs'), 'date', -1);
    const params = [...byParameter().values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));

    el.innerHTML = `
      ${ui.pageHead('Bloedonderzoeken', '<button class="btn primary" data-add>+ Uitslag</button>')}
      ${params.length ? `
        <section class="card">
          <h2>Verloop per bepaling</h2>
          <div class="param-grid">${params.map((p) => {
            const last = p.items[p.items.length - 1];
            const status = rangeStatus(last.value, last.low, last.high);
            return `<a class="param" href="#/bloed/${encodeURIComponent(p.name)}">
              <span class="param-name">${esc(p.name)}</span>
              <span class="param-value">${esc(formatNum(last.value))} <small>${esc(last.unit || '')}</small></span>
              <span class="param-meta">${esc(formatDate(last.date))} · ${p.items.length}×</span>
              ${status === 'low' || status === 'high' ? ui.statusBadge(status) : ''}
            </a>`;
          }).join('')}</div>
        </section>` : ''}
      <h2 class="section-title">Alle onderzoeken</h2>
      ${labs.length ? labs.map(labCard).join('') : ui.empty('Nog geen bloedonderzoeken. Voeg je eerste uitslag toe – bijvoorbeeld van MijnGezondheid.net of je patiëntenportaal.')}`;

    el.querySelector('[data-add]').addEventListener('click', () => openLab());
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openLab(store.get('labs', b.dataset.edit))));
  }

  HT.views.labs = { title: 'Bloedonderzoeken', render, byParameter };
})(window.HT);
