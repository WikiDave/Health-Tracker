/* Gezondheidsmeter: score 0–100 met uitleg waarom, per onderdeel, en het verloop over de weken. */
(function (HT) {
  'use strict';
  const { store, ui, utils, chart } = HT;
  const { escapeHtml: esc, todayISO, addDays } = utils;

  const KIND_LABEL = { good: '✓', warn: '!', bad: '!' };

  /** Halve-cirkelmeter als SVG. De kleur volgt de status; het label staat er altijd in tekst bij. */
  function gaugeSvg(score, kind, size = 220) {
    const cx = 100;
    const cy = 100;
    const r = 80;
    const pt = (deg) => {
      const rad = (Math.PI / 180) * deg;
      return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy - r * Math.sin(rad)).toFixed(2)}`;
    };
    const end = 180 - (Math.max(0, Math.min(100, score)) / 100) * 180;
    const value = score > 0 ? `<path d="M ${pt(180)} A ${r} ${r} 0 0 1 ${pt(end)}" class="gauge-value ${kind}"/>` : '';
    return `<svg class="gauge" viewBox="0 0 200 116" width="${size}" height="${Math.round(size * 0.58)}" role="img" aria-label="Gezondheidsmeter: ${score} van 100">
      <path d="M ${pt(180)} A ${r} ${r} 0 0 1 ${pt(0)}" class="gauge-track"/>
      ${value}
      <text x="100" y="92" text-anchor="middle" class="gauge-score">${score}</text>
      <text x="100" y="112" text-anchor="middle" class="gauge-max">van 100</text>
    </svg>`;
  }

  function compute(date) {
    return HT.healthscore.compute(store.data, date || todayISO());
  }

  function reasonList(items, icon, cls, max) {
    if (!items.length) return '';
    return `<ul class="reasons ${cls}">${items.slice(0, max).map((r) => `<li><span class="reason-icon" aria-hidden="true">${icon}</span><span>${esc(r.text)} <a href="#/${r.domain.route}" class="reason-link">${esc(r.domain.label)}</a></span></li>`).join('')}</ul>`;
  }

  /** Kaart voor het startscherm. */
  function cardHtml() {
    const r = compute();
    if (r.score == null) {
      return `<section class="card meter-card">
        <div class="card-head"><h2>Gezondheidsmeter</h2><a href="#/meter">Hoe werkt het?</a></div>
        <p class="muted">Vul een paar dagen je dagelijkse check, slaap, beweging of voeding in – dan zie je hier hoe gezond je leeft en waarom.</p>
      </section>`;
    }
    const top = r.bad[0] || r.good[0];
    return `<a class="card meter-card meter-link" href="#/meter">
      <div class="meter-row">
        ${gaugeSvg(r.score, r.kind, 150)}
        <div>
          <h2>Gezondheidsmeter</h2>
          <p>${ui.badge(`${KIND_LABEL[r.kind]} ${r.label}`, r.kind)}</p>
          ${top ? `<p class="small">${r.bad[0] ? '!' : '✓'} ${esc(top.text)}</p>` : ''}
          <p class="small link-text">Waarom? →</p>
        </div>
      </div>
      ${r.flags.length ? `<p class="small meter-flag">⚠️ ${r.flags.length} signaal${r.flags.length === 1 ? '' : 'en'} om met je huisarts te bespreken</p>` : ''}
    </a>`;
  }

  function render(el) {
    const today = todayISO();
    const r = compute(today);

    // Verloop: score per week (telkens de 7 dagen ervoor), laatste 8 weken
    const history = [];
    for (let i = 7; i >= 0; i--) {
      const d = addDays(today, -7 * i);
      const s = compute(d).score;
      if (s != null) history.push({ date: d, value: s });
    }

    const scored = r.domains.filter((d) => d.score != null);

    el.innerHTML = `
      ${ui.pageHead('Gezondheidsmeter')}
      ${r.flags.length ? `<section class="card"><h2>⚠️ Let op</h2><ul class="alerts">${r.flags.map((f) => `<li class="bad">${esc(f)}</li>`).join('')}</ul>
        <p class="muted small">Deze signalen tellen niet mee in de score, omdat ze los daarvan aandacht nodig hebben.</p></section>` : ''}

      <section class="card meter-main">
        ${r.score == null ? `
          <h2>Nog te weinig gegevens</h2>
          <p>De meter heeft minstens twee onderdelen met recente gegevens nodig. Vul een paar dagen je <a href="#/check">dagelijkse check</a> in, en bijvoorbeeld je <a href="#/slaap">slaap</a>, <a href="#/sport">beweging</a> of <a href="#/drinken">drinken</a>.</p>`
        : `
          ${gaugeSvg(r.score, r.kind)}
          <p class="meter-label">${ui.badge(`${KIND_LABEL[r.kind]} ${r.label}`, r.kind)}</p>
          <p class="muted">Gebaseerd op ${scored.length} van de ${r.domains.length} onderdelen · betrouwbaarheid: <strong>${esc(r.confidence)}</strong></p>`}
      </section>

      ${r.score != null ? `
      <div class="grid-2">
        <section class="card"><h2>Wat gaat goed</h2>${reasonList(r.good, '✓', 'good', 6) || '<p class="muted">Nog niets opvallends.</p>'}</section>
        <section class="card"><h2>Aandachtspunten</h2>${reasonList(r.bad, '!', 'bad', 6) || '<p class="muted">Geen aandachtspunten – goed bezig!</p>'}</section>
      </div>
      ${r.tips.length ? `<section class="card"><h2>💡 Wat kun je doen?</h2><ul class="list">${r.tips.slice(0, 4).map((t) => `<li>${esc(t.text)}</li>`).join('')}</ul></section>` : ''}` : ''}

      <section class="card">
        <h2>Per onderdeel</h2>
        <div class="domain-list">${r.domains.map((d) => d.score == null ? '' : `
          <details class="domain">
            <summary>
              <span class="domain-name"><span aria-hidden="true">${d.icon}</span> ${esc(d.label)}</span>
              <span class="bar-track"><span class="bar-fill ${HT.healthscore.labelFor(d.score).kind}" style="width:${d.score}%"></span></span>
              <span class="domain-score">${d.score}</span>
            </summary>
            <div class="domain-body">
              ${d.good.map((t) => `<p>✓ ${esc(t)}</p>`).join('')}
              ${d.bad.map((t) => `<p>! ${esc(t)}</p>`).join('')}
              <a href="#/${d.route}">Naar ${esc(d.label)} →</a>
            </div>
          </details>`).join('')}</div>
        ${r.missing.length ? `<p class="muted small">Niet meegeteld (geen recente gegevens): ${r.missing.map((d) => `<a href="#/${d.route}">${esc(d.label)}</a>`).join(', ')}.</p>` : ''}
      </section>

      ${history.length > 1 ? '<section class="card"><h2>Verloop per week</h2><div data-chart></div></section>' : ''}

      <section class="card">
        <details>
          <summary><strong>Hoe werkt de meter?</strong></summary>
          <div class="domain-body">
            <p>De meter kijkt naar wat je de afgelopen 7 dagen hebt ingevuld (metingen: 30 dagen) en vergelijkt dat met algemene Nederlandse adviezen:</p>
            <ul class="list">
              <li><strong>Slaap</strong> (15%): 7–9 uur per nacht en je slaapkwaliteit.</li>
              <li><strong>Beweging</strong> (15%): 150 minuten per week (Beweegrichtlijn), en stappen.</li>
              <li><strong>Voeding & drinken</strong> (10%): 250 g groente, 2 stuks fruit, je drinkdoel (Schijf van Vijf).</li>
              <li><strong>Mentaal</strong> (15%): stress, angst, somberheid, stemming en je zelftests.</li>
              <li><strong>Lichamelijk</strong> (15%): vermoeidheid, energie en pijn.</li>
              <li><strong>Middelen</strong> (10%): roken, alcohol (liefst niet, max. 1 glas per dag) en drugs.</li>
              <li><strong>Medicijntrouw</strong> (10%): hoeveel geplande innames je afvinkte.</li>
              <li><strong>Metingen</strong> (10%): bloeddruk, BMI en je laatste bloeduitslagen.</li>
            </ul>
            <p>Onderdelen zonder gegevens tellen niet mee; de andere wegen dan zwaarder. Hoe meer je invult, hoe betrouwbaarder de meter.</p>
            <p><strong>Dit is een indicatie, geen diagnose.</strong> Je persoonlijke situatie (bijvoorbeeld een chronische ziekte of een advies van je arts) kan anders zijn. Twijfel je of maak je je zorgen? Neem contact op met je huisarts.</p>
          </div>
        </details>
      </section>`;

    const box = el.querySelector('[data-chart]');
    if (box) {
      chart.lineChart(box, { series: [{ name: 'Score', color: 'var(--series-1)', points: history }], unit: '/100', height: 180, label: 'Gezondheidsmeter per week' });
    }
  }

  HT.views.healthmeter = { title: 'Gezondheidsmeter', render, cardHtml, gaugeSvg };
})(window.HT);
