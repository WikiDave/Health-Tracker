/* Startscherm "Vandaag": check, innames, aandachtspunten en komende afspraken. */
(function (HT) {
  'use strict';
  const { store, ui, utils, views } = HT;
  const { escapeHtml: esc, todayISO, addDays, formatDateLong, formatDate, daysOfStockLeft, adherence, prescriptionStatus, rangeStatus, sortBy } = utils;

  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return 'Goedenacht';
    if (h < 12) return 'Goedemorgen';
    if (h < 18) return 'Goedemiddag';
    return 'Goedenavond';
  }

  /** Verzamelt dingen die aandacht nodig hebben. */
  function alerts(today) {
    const out = [];
    for (const med of store.list('medications')) {
      if (!utils.isMedActiveOn(med, today)) continue;
      const left = daysOfStockLeft(med);
      if (left != null && left <= 7) out.push({ kind: 'warn', text: `${med.name}: nog ± ${left} dagen voorraad`, href: '#/medicatie' });
      if (med.endDate && med.endDate >= today && med.endDate <= addDays(today, 7)) {
        out.push({ kind: 'info', text: `${med.name} stopt op ${formatDate(med.endDate)}`, href: '#/medicatie' });
      }
    }
    for (const p of store.list('prescriptions')) {
      if (!views.prescriptions.isOpen(p)) continue;
      const s = prescriptionStatus(p, today);
      if (s === 'expired') out.push({ kind: 'bad', text: `Voorschrift "${p.title}" is verlopen`, href: '#/recepten' });
      if (s === 'expiring') out.push({ kind: 'warn', text: `Voorschrift "${p.title}" verloopt op ${formatDate(p.validUntil)}`, href: '#/recepten' });
    }
    for (const d of utils.vaccinationsDue(store.list('vaccinations'), today)) {
      out.push({ kind: d.status === 'overdue' ? 'bad' : 'warn', text: views.vaccinations.dueText(d), href: '#/vaccinaties' });
    }
    for (const c of views.wellbeing.latestConcern(today)) {
      const name = HT.questionnaires.QUESTIONNAIRES[c.type].short;
      out.push({
        kind: c.result.selfHarm ? 'bad' : 'warn',
        text: c.result.selfHarm
          ? `${name} op ${formatDate(c.date)}: je gaf aan gedachten te hebben over de dood of jezelf iets aandoen. Praat erover met je huisarts of 113 (0800-0113).`
          : `${name} op ${formatDate(c.date)}: score ${c.result.score} (${c.result.level.toLowerCase()}). Bespreek dit met je huisarts.`,
        href: '#/welzijn',
      });
    }
    for (const w of views.bowel.warnings(today)) out.push({ kind: 'bad', text: w, href: '#/stoelgang' });
    const lastLab = sortBy(store.list('labs'), 'date', -1)[0];
    if (lastLab) {
      const out1 = (lastLab.results || []).filter((r) => ['low', 'high'].includes(rangeStatus(r.value, r.low, r.high)));
      if (out1.length) {
        out.push({ kind: 'warn', text: `Laatste bloedonderzoek (${formatDate(lastLab.date)}): ${out1.map((r) => r.name).join(', ')} buiten referentie`, href: '#/bloed' });
      }
    }
    return out;
  }

  function render(el) {
    const today = todayISO();
    const name = store.data.profile.name ? `, ${store.data.profile.name.split(' ')[0]}` : '';
    const checkin = store.checkinDone(today) ? store.checkinFor(today) : null;
    const doses = views.medication.dosesFor(today);
    const taken = doses.filter((d) => d.taken).length;
    const week = adherence(store.list('medications'), store.data.medLog, addDays(today, -6), today, utils.nowTime());
    const upcoming = sortBy(store.list('visits').filter((v) => v.date >= today), (v) => v.date + (v.time || '')).slice(0, 3);
    const warn = alerts(today);
    const quit = views.substances.quitStats(today);
    const isEmpty = !['medications', 'labs', 'visits', 'checkins', 'prescriptions', 'vaccinations', 'pain', 'sport', 'bowel', 'food'].some((c) => store.list(c).length);
    const painToday = store.list('pain').filter((e) => e.date === today);

    el.innerHTML = `
      <div class="hero">
        <h1>${greeting()}${esc(name)}</h1>
        <p class="muted">${esc(formatDateLong(today))}</p>
        ${quit ? `<p>${ui.badge(`🚭 ${quit.days} dagen rookvrij`, 'good')}</p>` : ''}
      </div>

      ${isEmpty ? `<section class="card welcome">
        <h2>Welkom bij je Gezondheidsapp 👋</h2>
        <p>Hier houd je alles over je gezondheid bij op één plek. Je gegevens blijven <strong>alleen op dit apparaat</strong>.</p>
        <ol>
          <li>Vul je <a href="#/profiel">profiel</a> in (allergieën, huisarts, noodcontact).</li>
          <li>Voeg je <a href="#/medicatie">medicijnen</a> toe met de tijden waarop je ze inneemt.</li>
          <li>Leg je <a href="#/bloed">bloeduitslagen</a>, <a href="#/recepten">voorschriften</a> en <a href="#/bezoeken">afspraken</a> vast.</li>
          <li>Doe elke dag de <a href="#/check">dagelijkse check</a> (ook vermoeidheid en hoe je je mentaal voelt), en noteer pijn in je <a href="#/pijn">pijndagboek</a>.</li>
          <li>Zet <a href="#/medicatie">herinneringen</a> aan zodat je je medicijnen niet vergeet.</li>
        </ol>
      </section>` : ''}

      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h2>Dagelijkse check</h2>${checkin ? ui.badge('✓ Gedaan', 'good') : ''}</div>
          ${checkin ? views.checkin.summaryHtml(checkin) : '<p>Hoe gaat het vandaag? Het kost je minder dan een minuut.</p>'}
          <div class="button-row">
            <button class="btn ${checkin ? 'ghost' : 'primary'}" data-checkin>${checkin ? 'Bewerken' : 'Start check'}</button>
          </div>
          <div class="quick-add">
            <span class="muted small">Snel noteren:</span>
            <button class="btn small ghost" data-pain>⚡ Pijn</button>
            <button class="btn small ghost" data-sport>🏃 Sport</button>
            <button class="btn small ghost" data-bowel>🚽 Stoelgang</button>
            <button class="btn small ghost" data-food>🥗 Eten</button>
            <button class="btn small ghost" data-sleep>🌙 Slaap</button>
            <button class="btn small ghost" data-subst>🍷 Middelen</button>
            <button class="btn small ghost" data-env>🌳 Omgeving</button>
          </div>
          ${painToday.length ? `<p class="muted">Vandaag ${painToday.length}× pijn genoteerd (hoogste ${Math.max(...painToday.map((e) => e.intensity))}/10) · <a href="#/pijn">bekijk</a></p>` : ''}
        </section>

        <section class="card">
          <div class="card-head"><h2>Medicatie vandaag</h2>${doses.length ? `<span class="muted">${taken}/${doses.length}</span>` : ''}</div>
          ${doses.length ? `<div class="progress" role="progressbar" aria-valuenow="${taken}" aria-valuemin="0" aria-valuemax="${doses.length}"><span style="width:${(taken / doses.length) * 100}%"></span></div>` : ''}
          ${views.medication.doseListHtml(today)}
          ${week.pct != null ? `<p class="muted">Afgelopen 7 dagen: ${week.pct}% ingenomen</p>` : ''}
        </section>
      </div>

      ${store.list('sport').length ? `<section class="card">
        <div class="card-head"><h2>Beweging deze week</h2><a href="#/sport">Alles</a></div>
        ${views.sport.progressHtml(views.sport.thisWeek(today))}
      </section>` : ''}

      ${warn.length ? `<section class="card">
        <h2>Aandachtspunten</h2>
        <ul class="alerts">${warn.map((a) => `<li class="${a.kind}"><a href="${a.href}">${esc(a.text)}</a></li>`).join('')}</ul>
      </section>` : ''}

      <section class="card">
        <div class="card-head"><h2>Komende afspraken</h2><a href="#/bezoeken">Alles</a></div>
        ${upcoming.length ? `<ul class="list">${upcoming.map((v) => `
          <li><strong>${esc(formatDateLong(v.date))}${v.time ? `, ${esc(v.time)}` : ''}</strong>
            ${views.visits.whenLabel(v, today) ? ui.badge(views.visits.whenLabel(v, today), 'info') : ''}<br>
            ${esc([v.type, v.specialty, v.doctor, v.location].filter(Boolean).join(' · '))}</li>`).join('')}</ul>`
          : '<p class="muted">Geen geplande afspraken.</p>'}
        <button class="btn ghost" data-visit>+ Afspraak</button>
      </section>`;

    el.querySelector('[data-checkin]').addEventListener('click', () => views.checkin.openCheckin(today));
    el.querySelector('[data-visit]').addEventListener('click', () => views.visits.openVisit());
    el.querySelector('[data-pain]').addEventListener('click', () => views.pain.openPain());
    el.querySelector('[data-sport]').addEventListener('click', () => views.sport.openSport());
    el.querySelector('[data-bowel]').addEventListener('click', () => views.bowel.openBowel());
    el.querySelector('[data-food]').addEventListener('click', () => views.nutrition.openFood());
    el.querySelector('[data-sleep]').addEventListener('click', () => views.sleep.openSleep(today));
    el.querySelector('[data-subst]').addEventListener('click', () => views.substances.openDay(today));
    el.querySelector('[data-env]').addEventListener('click', () => views.environment.openDay(today));
    views.medication.bindDoses(el);
  }

  HT.views.dashboard = { title: 'Vandaag', render };
})(window.HT);
