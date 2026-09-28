/* Energie: een paar keer per dag met één tik je energie vastleggen, en uitleg waarom je moe of energiek bent. */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart, form, energy: E } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatNum, formatDateShort, uid, sortBy } = utils;

  function todayLog() {
    const c = store.checkinFor(todayISO()) || {};
    return Array.isArray(c.energyLog) ? c.energyLog : [];
  }

  /** Energiemoment vastleggen; de dagwaarde 'energie' wordt het gemiddelde van de momenten. */
  function logEnergy(level) {
    const date = todayISO();
    const log = [...todayLog(), { id: uid(), time: nowTime(), level }];
    const avg = log.reduce((s, x) => s + x.level, 0) / log.length;
    store.mergeCheckin(date, { energyLog: log, energy: Math.round(avg) });
    const l = E.LEVELS.find((x) => x.value === level);
    ui.toast(`${l.icon} Energie: ${l.label.toLowerCase()}`);
  }

  function removeMoment(id) {
    const log = todayLog().filter((x) => x.id !== id);
    const avg = log.length ? Math.round(log.reduce((s, x) => s + x.level, 0) / log.length) : null;
    store.mergeCheckin(todayISO(), { energyLog: log, energy: avg });
  }

  /** De vraag "Hoe is je energie nu?" met vijf knoppen en de momenten van vandaag. */
  function quickHtml() {
    const part = E.partOfDay(nowTime());
    const log = todayLog();
    const askedNow = log.some((x) => E.partOfDay(x.time) === part);
    return `<div class="energy-quick">
      <p class="energy-question">${askedNow ? `Je energie deze ${part} is vastgelegd. Veranderd?` : `<strong>Hoe is je energie nu?</strong> <span class="muted">(${part})</span>`}</p>
      <div class="energy-buttons" role="group" aria-label="Energie nu">
        ${E.LEVELS.map((l) => `<button class="energy-btn" data-energy="${l.value}" title="${esc(l.label)}"><span aria-hidden="true">${l.icon}</span><small>${esc(l.label)}</small></button>`).join('')}
      </div>
      ${log.length ? `<ul class="energy-moments">${sortBy(log, 'time').map((x) => {
        const l = E.LEVELS.find((y) => y.value === x.level);
        return `<li><span class="muted">${esc(x.time)}</span> ${l.icon} ${esc(l.label)} <button class="icon-btn small" data-energy-remove="${esc(x.id)}" aria-label="Verwijderen">✕</button></li>`;
      }).join('')}</ul>` : ''}
    </div>`;
  }

  function bindQuick(el) {
    el.querySelectorAll('[data-energy]').forEach((b) => b.addEventListener('click', () => logEnergy(Number(b.dataset.energy))));
    el.querySelectorAll('[data-energy-remove]').forEach((b) => b.addEventListener('click', () => removeMoment(b.dataset.energyRemove)));
  }

  /** Kaart voor het startscherm. */
  function cardHtml() {
    const today = todayISO();
    const analysis = E.analyze(store.data, today);
    const why = E.explainDay(store.data, today, analysis);
    return `<section class="card">
      <div class="card-head"><h2>🔋 Energie</h2><a href="#/energie">Waarom? →</a></div>
      ${quickHtml()}
      ${why.length ? `<p class="small">${why.slice(0, 2).map((f) => `${f.icon} ${esc(f.label.toLowerCase())} (${f.effect > 0 ? '+' : '−'}${Math.abs(f.effect)})`).join(' · ')}</p>` : ''}
    </section>`;
  }

  function openSettings() {
    form.open({
      title: 'Energie vragen',
      fields: [
        { name: 'energyPrompts', label: "Vraag me 's ochtends, 's middags en 's avonds naar mijn energie (melding)", type: 'checkbox' },
      ],
      values: { energyPrompts: store.data.settings.energyPrompts },
      onSubmit(v) {
        store.saveSettings(v);
        if (v.energyPrompts && !(store.data.settings.notify && HT.reminders.permission() === 'granted')) setTimeout(() => HT.reminders.enable());
        ui.toast('Opgeslagen');
      },
    });
  }

  function factorList(items, cls) {
    return `<ul class="factor-list ${cls}">${items.map((f) => `
      <li><span class="factor-icon" aria-hidden="true">${f.icon}</span>
        <span class="factor-text">${esc(f.label)}<small>${f.n} dagen vergeleken · met: ${f.withAvg}, zonder: ${f.withoutAvg}</small></span>
        <span class="factor-effect ${f.effect >= 0 ? 'plus' : 'min'}">${f.effect >= 0 ? '+' : '−'}${Math.abs(f.effect)}</span></li>`).join('')}</ul>`;
  }

  function render(el) {
    const today = todayISO();
    const data = store.data;
    const analysis = E.analyze(data, today);
    const strong = analysis.factors.filter((f) => Math.abs(f.effect) >= 5);
    const gives = strong.filter((f) => f.effect > 0);
    const costs = strong.filter((f) => f.effect < 0);
    const why = E.explainDay(data, today, analysis);
    const labs = E.labHints(data, today);
    const persistent = E.persistentFatigue(data, today);
    const todayScore = E.dayScore(store.checkinFor(today));
    const recent = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      const s = E.dayScore(store.checkinFor(d));
      if (s != null) recent.push({ date: d, value: s });
    }
    const avg30 = recent.length ? Math.round(recent.reduce((a, x) => a + x.value, 0) / recent.length) : null;
    const tips = costs.map((f) => E.FACTORS.find((x) => x.key === f.key).tip).filter(Boolean).slice(0, 3);

    el.innerHTML = `
      ${ui.pageHead('Energie', '<button class="btn ghost" data-settings>🔔 Vragen</button>')}
      ${persistent ? `<section class="card"><ul class="alerts"><li class="bad">Je bent al weken erg moe (gemiddeld ${formatNum(persistent.avg)}/10 over ${persistent.days} dagen). Maak een afspraak met je huisarts om te kijken of er een oorzaak is.</li></ul></section>` : ''}

      <section class="card">
        ${quickHtml()}
      </section>

      <section class="card">
        <h2>Vandaag</h2>
        ${todayScore != null ? `<p class="energy-today"><strong>${todayScore}</strong><small> /100</small>
          ${avg30 != null ? `<span class="muted"> · jouw gemiddelde: ${avg30}${todayScore >= avg30 + 8 ? ' – vandaag beter dan normaal' : todayScore <= avg30 - 8 ? ' – vandaag minder dan normaal' : ''}</span>` : ''}</p>` : '<p class="muted">Leg hierboven je energie vast, of vul je <a href="#/check">dagelijkse check</a> in.</p>'}
        ${why.length ? `<h3>Waarom voel je je vandaag zo?</h3>
          <ul class="list">${why.map((f) => `<li>${f.icon} <strong>${esc(f.label)}</strong> – op zulke dagen heb je gemiddeld <strong>${Math.abs(f.effect)} punten ${f.effect > 0 ? 'meer' : 'minder'}</strong> energie.</li>`).join('')}</ul>`
          : todayScore != null && strong.length ? '<p class="muted">Vandaag speelt geen van je bekende energievreters of -gevers duidelijk mee. Vul ook je slaap, drinken en omgeving in voor een betere uitleg.</p>' : ''}
      </section>

      <section class="card">
        <h2>Wat geeft en kost jou energie?</h2>
        ${strong.length ? `
          ${gives.length ? `<h3>⚡ Geeft je energie</h3>${factorList(gives, 'plus')}` : ''}
          ${costs.length ? `<h3>🪫 Kost je energie</h3>${factorList(costs, 'min')}` : ''}
          ${tips.length ? `<h3>💡 Wat kun je proberen?</h3><ul class="list">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          <p class="muted small">Energie op een schaal van 0–100, uit je energiemomenten, de energie en vermoeidheid in je dagelijkse check. De getallen vergelijken je eigen dagen met en zonder die factor (minstens 3 dagen van elk). Het zijn verbanden, geen bewezen oorzaken.</p>`
        : `<p>Na een paar weken invullen zie je hier wat jou persoonlijk energie geeft en kost. Hoe meer je bijhoudt, hoe beter: <a href="#/slaap">slaap</a>, <a href="#/sport">beweging</a>, <a href="#/drinken">drinken</a>, <a href="#/middelen">alcohol en koffie</a>, <a href="#/omgeving">werk en buiten zijn</a>.</p>
          <p class="muted small">Veelvoorkomende oorzaken van moeheid: te weinig of slecht slapen, weinig bewegen, stress, te weinig drinken of onregelmatig eten, alcohol, pijn, en soms een medische oorzaak zoals bloedarmoede of een schildklierprobleem.</p>`}
        <p class="muted small">Gebaseerd op ${analysis.days} dag${analysis.days === 1 ? '' : 'en'} met energiegegevens.</p>
      </section>

      ${labs.length ? `<section class="card"><h2>🩸 Bloedwaarden</h2>
        <p>In je bloeduitslagen staan waarden die met vermoeidheid te maken kunnen hebben:</p>
        <ul class="list">${labs.map((l) => `<li><strong>${esc(l.name)}</strong>: ${esc(formatNum(l.value))} ${esc(l.unit || '')} ${ui.statusBadge(l.status)} <span class="muted">(${esc(formatDateShort(l.date))})</span><br><small>${esc(l.text)}</small></li>`).join('')}</ul>
        <p class="muted small">Bespreek deze uitslagen met je arts.</p></section>` : ''}

      ${recent.length > 1 ? '<section class="card"><h2>Energie per dag (30 dagen)</h2><div data-chart></div></section>' : ''}`;

    const box = el.querySelector('[data-chart]');
    if (box) chart.lineChart(box, { series: [{ name: 'Energie', color: 'var(--series-1)', points: recent }], unit: '/100', height: 180, label: 'Energie per dag' });
    bindQuick(el);
    el.querySelector('[data-settings]').addEventListener('click', openSettings);
  }

  HT.views.energy = { title: 'Energie', render, cardHtml, bindQuick, logEnergy };
})(window.HT);
