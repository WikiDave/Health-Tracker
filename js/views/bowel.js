/* Stoelgang: frequentie en vorm (Bristol-ontlastingsschaal), met signalen die je met je arts moet bespreken. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatDateLong, formatDate, formatNum, bowelStats, sortBy } = utils;

  const BRISTOL = [
    [1, 'Type 1 – losse, harde keutels (moeilijk)'],
    [2, 'Type 2 – worstvorm, maar klonterig'],
    [3, 'Type 3 – worst met barstjes'],
    [4, 'Type 4 – glad en zacht, als een worst'],
    [5, 'Type 5 – zachte klodders met gladde randen'],
    [6, 'Type 6 – papperig, rafelige stukjes'],
    [7, 'Type 7 – waterig, geen vaste stukjes'],
  ];
  const BRISTOL_SHORT = { 1: 'Harde keutels', 2: 'Klonterige worst', 3: 'Worst met barstjes', 4: 'Gladde worst', 5: 'Zachte klodders', 6: 'Papperig', 7: 'Waterig' };
  const COLORS = ['Normaal (bruin)', 'Licht / grijs / kleiachtig', 'Zwart / teerachtig', 'Rood', 'Groen of geel', 'Anders'];
  const WORRYING_COLORS = ['Licht / grijs / kleiachtig', 'Zwart / teerachtig', 'Rood'];

  const FIELDS = [
    { name: 'date', label: 'Datum', type: 'date', required: true, half: true },
    { name: 'time', label: 'Tijd', type: 'time', half: true },
    { name: 'bristol', label: 'Vorm (Bristol-schaal)', type: 'choice', options: BRISTOL, help: 'Type 3 en 4 zijn normaal. 1–2 wijst op verstopping, 6–7 op diarree.' },
    { name: 'effort', label: 'Hoe ging het?', type: 'select', half: true, options: ['', 'Makkelijk', 'Moeten persen', 'Pijnlijk'] },
    { name: 'color', label: 'Kleur', type: 'select', half: true, options: COLORS },
    { name: 'urgency', label: 'Plotselinge aandrang (moest snel naar de wc)', type: 'checkbox' },
    { name: 'blood', label: 'Bloed gezien (op de ontlasting of het papier)', type: 'checkbox' },
    { name: 'mucus', label: 'Slijm gezien', type: 'checkbox' },
    { name: 'notes', label: 'Notities', type: 'textarea', placeholder: 'bv. buikpijn vooraf, na nieuw medicijn' },
  ];

  function openBowel(entry) {
    form.open({
      title: entry ? 'Stoelgang bewerken' : 'Stoelgang noteren',
      fields: FIELDS,
      values: entry || { date: todayISO(), time: nowTime(), color: COLORS[0] },
      onSubmit(values) {
        if (!values.bristol) return 'Kies de vorm (type 1–7).';
        store.upsert('bowel', Object.assign({}, values, entry ? { id: entry.id } : {}));
        ui.toast('Genoteerd');
      },
      onDelete: entry ? () => store.remove('bowel', entry.id) : null,
    });
  }

  /** Signalen uit de afgelopen 14 dagen die je met je huisarts moet bespreken. */
  function warnings(today) {
    const recent = store.list('bowel').filter((e) => e.date >= addDays(today, -13));
    const out = [];
    const blood = recent.filter((e) => e.blood);
    if (blood.length) out.push(`Bloed bij de ontlasting gezien (${blood.length}× in 14 dagen, laatst ${formatDate(sortBy(blood, 'date', -1)[0].date)}). Bespreek dit met je huisarts.`);
    const color = recent.filter((e) => WORRYING_COLORS.includes(e.color) && !e.blood);
    if (color.length) out.push(`Afwijkende kleur ontlasting (${color.map((e) => e.color.toLowerCase()).filter((c, i, a) => a.indexOf(c) === i).join(', ')}). Bespreek dit met je huisarts, zeker als het niet door eten of medicijnen (bv. ijzer) komt.`);
    return out;
  }

  function level(t) {
    if (t === 3 || t === 4) return 'good';
    if (t === 2 || t === 5) return 'warn';
    return 'bad';
  }

  function render(el) {
    const today = todayISO();
    const all = sortBy(store.list('bowel'), (e) => e.date + (e.time || ''), -1);
    const st = bowelStats(all, addDays(today, -13), today);
    const warn = warnings(today);
    const maxType = Math.max(1, ...Object.values(st.types));

    const groups = [];
    for (const e of all) {
      if (!groups.length || groups[groups.length - 1].date !== e.date) groups.push({ date: e.date, items: [] });
      groups[groups.length - 1].items.push(e);
    }

    el.innerHTML = `
      ${ui.pageHead('Stoelgang', '<button class="btn primary" data-add>+ Noteren</button>')}
      ${warn.length ? `<section class="card"><ul class="alerts">${warn.map((w) => `<li class="bad">${esc(w)}</li>`).join('')}</ul></section>` : ''}
      <section class="card">
        <h2>Afgelopen 14 dagen</h2>
        ${all.length ? `<div class="stats">
          <div><span class="stat-value">${formatNum(st.perDay.toFixed(1))}</span><span class="stat-label">keer per dag</span></div>
          <div><span class="stat-value">${st.daysWithout}</span><span class="stat-label">dagen zonder</span></div>
          <div><span class="stat-value">${st.hard}</span><span class="stat-label">hard (type 1–2)</span></div>
          <div><span class="stat-value">${st.loose}</span><span class="stat-label">dun (type 6–7)</span></div>
        </div>
        <h3>Vorm</h3>
        <div class="bars">${[1, 2, 3, 4, 5, 6, 7].map((t) => `
          <div class="bar-row">
            <span class="bar-label">${t} · ${esc(BRISTOL_SHORT[t])}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${((st.types[t] || 0) / maxType) * 100}%"></span></span>
            <span class="bar-value">${st.types[t] || 0}</span>
          </div>`).join('')}</div>` : '<p class="muted">Nog niets genoteerd.</p>'}
        <p class="muted small">Normaal is alles tussen 3× per dag en 3× per week. Houd het een paar weken bij als je klachten hebt, dan kan je arts beter meedenken.</p>
      </section>
      <h2 class="section-title">Logboek</h2>
      ${groups.length ? ui.collapsible(groups, (g) => `
        <article class="card item">
          <h3>${esc(formatDateLong(g.date))}</h3>
          <ul class="pain-list">${g.items.map((e) => `
            <li>
              <span class="pain-score ${level(e.bristol)}" aria-label="Bristol type ${e.bristol}">${e.bristol}</span>
              <div class="pain-body">
                <strong>${esc(BRISTOL_SHORT[e.bristol] || '')}</strong>${e.time ? ` <span class="muted">· ${esc(e.time)}</span>` : ''}
                ${[e.effort, e.color && e.color !== COLORS[0] ? e.color : '', e.urgency ? 'aandrang' : '', e.mucus ? 'slijm' : ''].filter(Boolean).length
                  ? `<br><small>${esc([e.effort, e.color && e.color !== COLORS[0] ? e.color : '', e.urgency ? 'aandrang' : '', e.mucus ? 'slijm' : ''].filter(Boolean).join(' · '))}</small>` : ''}
                ${e.blood ? `<br>${ui.badge('! Bloed', 'bad')}` : ''}
                ${e.notes ? `<br><small class="muted">${esc(e.notes)}</small>` : ''}
              </div>
              <button class="btn small ghost" data-edit="${esc(e.id)}">Bewerken</button>
            </li>`).join('')}</ul>
        </article>`, 10, 'Oudere gegevens') : ui.empty('Nog niets genoteerd.')}`;

    el.querySelector('[data-add]').addEventListener('click', () => openBowel());
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openBowel(store.get('bowel', b.dataset.edit))));
  }

  HT.views.bowel = { title: 'Stoelgang', render, openBowel, warnings, BRISTOL_SHORT };
})(window.HT);
