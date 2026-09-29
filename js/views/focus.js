/* Focus & taken (ADHD-vriendelijk): één taak tegelijk, kleinste eerste stap, focustimer met de 5-minutenregel,
 * gedachten parkeren, routines en uitstel begrijpen met passende tips. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form, focus: F } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatDateShort, formatNum, uid, sortBy } = utils;

  const TIMER_KEY = 'health-tracker-focus-timer';
  const ENERGY_LABEL = { laag: '🪫 weinig energie', midden: '😐 gemiddeld', hoog: '⚡ veel energie' };
  const REPEAT = [['', 'Eenmalig'], ['dagelijks', 'Elke dag'], ['weekdagen', 'Op werkdagen (ma–vr)'], ['wekelijks', 'Eén keer per week']];

  let skip = [];
  let manualEnergy = null;
  let tick = null;

  // ---------- Taken ----------

  function openTask(task, preset) {
    form.open({
      title: task ? 'Taak bewerken' : 'Nieuwe taak',
      fields: [
        { name: 'title', label: 'Wat moet er gebeuren?', required: true, placeholder: 'bv. Verslag schrijven' },
        { name: 'firstStep', label: 'Kleinste eerste stap', placeholder: 'bv. Laptop openklappen en het document openen', help: 'Zo klein dat het bijna belachelijk is. Dat maakt beginnen makkelijker.' },
        { name: 'steps', label: 'Stappen (optioneel)', type: 'results', emptyRows: 3, columns: [{ k: 'text', label: 'Stap', placeholder: 'bv. Kopjes bedenken (10 min)' }] },
        { name: 'energy', label: 'Hoeveel energie kost het?', type: 'select', half: true, options: [['laag', 'Weinig'], ['midden', 'Gemiddeld'], ['hoog', 'Veel']] },
        { name: 'minutes', label: 'Hoe lang duurt het ongeveer? (min)', type: 'number', half: true },
        { name: 'deadline', label: 'Deadline', type: 'date', half: true },
        { name: 'repeat', label: 'Herhalen', type: 'select', half: true, options: REPEAT },
        { name: 'why', label: 'Waarom is dit belangrijk voor jou?', placeholder: 'bv. Dan heb ik rust in mijn hoofd' },
      ],
      values: task || Object.assign({ energy: 'midden', minutes: 25, repeat: '' }, preset || {}),
      onSubmit(v) {
        // Afgevinkte stappen behouden bij het bewerken
        const oldSteps = (task && task.steps) || [];
        v.steps = (v.steps || []).map((s) => Object.assign({}, s, { done: Boolean((oldSteps.find((o) => o.text === s.text) || {}).done) }));
        store.upsert('tasks', Object.assign({}, v, task ? { id: task.id } : { done: false, postponed: 0 }));
        ui.toast(task ? 'Taak bijgewerkt' : 'Taak toegevoegd');
      },
      onDelete: task ? () => store.remove('tasks', task.id) : null,
    });
  }

  function completeTask(task) {
    const today = todayISO();
    if (task.repeat) store.upsert('tasks', Object.assign({}, task, { lastDone: today, doneLog: [...(task.doneLog || []), today] }));
    else store.upsert('tasks', Object.assign({}, task, { done: true, doneAt: today }));
    skip = [];
    celebrate(task.title);
  }

  function completeStep(task) {
    const steps = (task.steps || []).map((s) => Object.assign({}, s));
    const next = steps.find((s) => !s.done);
    if (!next) return completeTask(task);
    next.done = true;
    store.upsert('tasks', Object.assign({}, task, { steps }));
    if (steps.every((s) => s.done)) return completeTask(Object.assign({}, task, { steps }));
    ui.toast(`✓ Stap gedaan: ${next.text}`);
  }

  const CHEERS = ['Lekker bezig! 🎉', 'Weer eentje af! 💪', 'Top gedaan! ⭐', 'Goed zo – dat telt! 🙌', 'Afgevinkt! 🎯'];
  function celebrate(title) {
    ui.toast(`${CHEERS[Math.floor(Math.random() * CHEERS.length)]} ${title}`);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  }

  // ---------- Uitstel ----------

  function openPostpone(task) {
    form.open({
      title: 'Ik stel iets uit',
      fields: [
        { name: 'taskTitle', label: 'Welke taak?', required: true },
        { name: 'reasons', label: 'Waarom lukt het nu niet? (meerdere mogelijk)', type: 'multi', options: F.REASONS.map((r) => `${r.icon} ${r.label}`) },
        { name: 'note', label: 'Toelichting (optioneel)', type: 'textarea' },
      ],
      values: { taskTitle: task ? task.title : '' },
      onSubmit(v) {
        const reasons = (v.reasons || []).map((label) => F.REASONS.find((r) => `${r.icon} ${r.label}` === label).key);
        store.upsert('procrastination', { date: todayISO(), time: nowTime(), taskId: task ? task.id : null, taskTitle: v.taskTitle, reasons, note: v.note });
        if (task) store.upsert('tasks', Object.assign({}, task, { postponed: (task.postponed || 0) + 1 }));
        setTimeout(() => showTips(reasons, task));
      },
    });
  }

  function showTips(reasons, task) {
    const tips = F.REASONS.filter((r) => reasons.includes(r.key));
    ui.message('Dat is heel normaal 💛', `
      <p>Uitstellen zegt niets over je karakter – je brein zoekt een uitweg. Dit kan helpen:</p>
      ${tips.length ? `<ul class="list">${tips.map((r) => `<li>${r.icon} <strong>${esc(r.label)}:</strong> ${esc(r.tip)}</li>`).join('')}</ul>` : '<p>Maak de eerste stap zó klein dat je hem niet kunt weigeren, en zet een timer op 5 minuten.</p>'}
      ${task ? `<p><strong>Eerste stap:</strong> ${esc(F.firstStep(task) || 'bedenk de kleinste handeling om te beginnen')}</p>
        <button class="btn primary" data-try>▶ Toch 5 minuten proberen</button>` : ''}`);
    const btn = document.querySelector('#form-dialog [data-try]');
    if (btn) btn.addEventListener('click', () => { document.getElementById('form-dialog').close(); startTimer(5, task.id); });
  }

  // ---------- Gedachten parkeren ----------

  function parkThought(text) {
    if (!text || !text.trim()) return;
    store.upsert('braindump', { text: text.trim(), date: todayISO(), time: nowTime(), done: false });
    ui.toast('💭 Geparkeerd – ga lekker verder');
  }

  // ---------- Focustimer ----------

  function readTimer() {
    try { return JSON.parse(localStorage.getItem(TIMER_KEY)); } catch (e) { return null; }
  }
  function writeTimer(t) {
    try { if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t)); else localStorage.removeItem(TIMER_KEY); } catch (e) { /* niet erg */ }
  }

  function startTimer(minutes, taskId) {
    writeTimer({ start: Date.now(), minutes, taskId: taskId || null, distractions: 0, startTime: nowTime() });
    showOverlay();
  }

  function remaining(t) {
    return Math.max(0, t.start + t.minutes * 60000 - Date.now());
  }

  function fmt(ms) {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((d) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.15, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + d);
        o.stop(ctx.currentTime + d + 0.2);
      });
    } catch (e) { /* geen geluid mogelijk */ }
  }

  function logSession(t, completed) {
    const actual = Math.round(((Math.min(Date.now(), t.start + t.minutes * 60000) - t.start) / 60000) * 10) / 10;
    store.upsert('focus', { date: todayISO(), start: t.startTime, planned: t.minutes, actual, taskId: t.taskId, completed, distractions: t.distractions || 0 });
  }

  function showOverlay() {
    const t = readTimer();
    let el = document.getElementById('focus-overlay');
    if (!t) { if (el) el.remove(); clearInterval(tick); return; }
    const task = t.taskId ? store.get('tasks', t.taskId) : null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'focus-overlay';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Focustimer');
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="focus-box">
        <p class="focus-label">🎯 Focus – ${t.minutes} minuten</p>
        ${task ? `<h2>${esc(task.title)}</h2>${F.firstStep(task) ? `<p class="focus-step">Nu: <strong>${esc(F.firstStep(task))}</strong></p>` : ''}` : '<h2>Even focussen</h2>'}
        <div class="focus-time" aria-live="off" data-time>${fmt(remaining(t))}</div>
        <div class="focus-park">
          <input data-thought placeholder="Schiet er iets door je hoofd? Parkeer het hier…" aria-label="Gedachte parkeren">
          <button class="btn small ghost" data-park>💭 Parkeer</button>
        </div>
        <p class="muted small" data-distractions>${t.distractions ? `${t.distractions}× afgeleid – geeft niks, je bent terug.` : 'Telefoon weg, één ding tegelijk.'}</p>
        <div class="button-row focus-buttons">
          <button class="btn ghost" data-distracted>🙈 Ik was afgeleid</button>
          <button class="btn ghost" data-stop>⏹ Stoppen</button>
        </div>
      </div>`;
    const input = el.querySelector('[data-thought]');
    el.querySelector('[data-park]').addEventListener('click', () => { parkThought(input.value); input.value = ''; });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { parkThought(input.value); input.value = ''; } });
    el.querySelector('[data-distracted]').addEventListener('click', () => {
      const cur = readTimer();
      cur.distractions = (cur.distractions || 0) + 1;
      writeTimer(cur);
      el.querySelector('[data-distractions]').textContent = `${cur.distractions}× afgeleid – geeft niks, je bent terug.`;
      input.focus();
    });
    el.querySelector('[data-stop]').addEventListener('click', () => { const cur = readTimer(); logSession(cur, false); writeTimer(null); showOverlay(); finished(cur, false); });
    clearInterval(tick);
    tick = setInterval(() => {
      const cur = readTimer();
      if (!cur) { clearInterval(tick); return; }
      const left = remaining(cur);
      const timeEl = document.querySelector('#focus-overlay [data-time]');
      if (timeEl) timeEl.textContent = fmt(left);
      document.title = `${fmt(left)} · Focus`;
      if (left <= 0) {
        clearInterval(tick);
        logSession(cur, true);
        writeTimer(null);
        showOverlay();
        beep();
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
        HT.reminders.notifyNow('⏰ Focustijd voorbij!', task ? `${task.title} – goed bezig. Tijd voor een korte pauze.` : 'Goed bezig. Tijd voor een korte pauze.', 'focus-done');
        finished(cur, true);
      }
    }, 500);
  }

  function finished(t, completed) {
    const task = t.taskId ? store.get('tasks', t.taskId) : null;
    ui.message(completed ? '⏰ Tijd! Goed gedaan' : 'Gestopt', `
      <p>${completed ? `Je hebt ${t.minutes} minuten gefocust${t.distractions ? ` (en ${t.distractions}× jezelf teruggehaald 💪)` : ''}.` : 'Ook een paar minuten is een begin. Wat nu?'}</p>
      <div class="type-choice">
        ${task ? `${(task.steps || []).some((s) => !s.done) ? '<button class="btn primary" data-after="step">✓ Deze stap is klaar</button>' : ''}
          <button class="btn primary" data-after="done">✓ De hele taak is klaar</button>` : ''}
        <button class="btn ghost" data-after="5">▶ Nog 5 minuten</button>
        <button class="btn ghost" data-after="25">▶ Nog 25 minuten</button>
      </div>
      ${completed ? '<p class="muted small">🌿 Pauzetip: sta even op, drink een glas water en kijk naar buiten. Hyperfocus? Vergeet niet te eten en te drinken.</p>' : ''}`);
    document.querySelectorAll('#form-dialog [data-after]').forEach((b) => b.addEventListener('click', () => {
      document.getElementById('form-dialog').close();
      const a = b.dataset.after;
      const fresh = task && store.get('tasks', task.id);
      if (a === 'step' && fresh) completeStep(fresh);
      else if (a === 'done' && fresh) completeTask(fresh);
      else startTimer(Number(a), t.taskId);
    }));
    document.title = 'Focus · Gezondheid';
  }

  // ---------- Schermen ----------

  /** Huidige energie: handmatig gekozen, anders de laatste energieknop van vandaag, anders gemiddeld. */
  function currentEnergy() {
    if (manualEnergy) return manualEnergy;
    const log = ((store.checkinFor(todayISO()) || {}).energyLog || []);
    return log.length ? sortBy(log, 'time')[log.length - 1].level : 3;
  }

  function suggestionHtml(compact) {
    const today = todayISO();
    const pick = F.pickNext(store.list('tasks'), { today, energy: currentEnergy(), skip });
    if (!pick) {
      return `<p>${store.list('tasks').some((t) => F.isOpenToday(t, today)) ? 'Je hebt alles overgeslagen. ' : 'Geen open taken. '}<button class="btn small ghost" data-add-task>+ Taak toevoegen</button>${skip.length ? ' <button class="btn small ghost" data-reset-skip>Opnieuw kiezen</button>' : ''}</p>`;
    }
    const t = pick.task;
    const step = F.firstStep(t);
    return `<div class="next-task">
      <p class="next-title">${esc(t.title)}</p>
      <p class="small muted">${esc(pick.reason)}</p>
      ${step ? `<p>👉 <strong>Eerste stap:</strong> ${esc(step)}</p>` : ''}
      ${!compact && t.why ? `<p class="small">💛 ${esc(t.why)}</p>` : ''}
      <div class="button-row">
        <button class="btn primary" data-start="5|${esc(t.id)}">▶ 5 min beginnen</button>
        <button class="btn ghost" data-start="25|${esc(t.id)}">25 min</button>
        <button class="btn ghost" data-done="${esc(t.id)}">✓ Klaar</button>
        <button class="btn ghost" data-skip="${esc(t.id)}">Andere taak</button>
        ${compact ? '' : `<button class="btn ghost" data-postpone="${esc(t.id)}">⏳ Ik stel het uit</button>`}
      </div>
    </div>`;
  }

  function bindCommon(el) {
    el.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => { const [m, id] = b.dataset.start.split('|'); startTimer(Number(m), id); }));
    el.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', () => completeTask(store.get('tasks', b.dataset.done))));
    el.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => { skip.push(b.dataset.skip); HT.app && HT.app.render ? HT.app.render() : location.reload(); }));
    el.querySelectorAll('[data-reset-skip]').forEach((b) => b.addEventListener('click', () => { skip = []; HT.app.render(); }));
    el.querySelectorAll('[data-postpone]').forEach((b) => b.addEventListener('click', () => openPostpone(store.get('tasks', b.dataset.postpone))));
    el.querySelectorAll('[data-add-task]').forEach((b) => b.addEventListener('click', () => openTask()));
  }

  /** Kaart voor het startscherm. */
  function cardHtml() {
    const t = readTimer();
    if (t) return `<section class="card"><div class="card-head"><h2>🎯 Focus</h2></div><p>⏱ Je focustimer loopt nog (${fmt(remaining(t))}). <button class="btn small primary" data-show-timer>Bekijk</button></p></section>`;
    if (!store.list('tasks').length) {
      return `<section class="card"><div class="card-head"><h2>🎯 Focus</h2><a href="#/focus">Meer</a></div>
        <p>Zet je taken in de app: hij kiest steeds <strong>één ding</strong> dat nu past, en helpt je beginnen met 5 minuten.</p>
        <button class="btn ghost" data-add-task>+ Eerste taak</button></section>`;
    }
    return `<section class="card"><div class="card-head"><h2>🎯 Wat nu?</h2><a href="#/focus">Focus →</a></div>${suggestionHtml(true)}</section>`;
  }

  function bindCard(el) {
    bindCommon(el);
    const s = el.querySelector('[data-show-timer]');
    if (s) s.addEventListener('click', showOverlay);
  }

  function render(el) {
    const today = todayISO();
    const tasks = store.list('tasks');
    const open = tasks.filter((t) => !t.repeat && !t.done);
    const routines = tasks.filter((t) => t.repeat);
    const doneToday = tasks.filter((t) => t.doneAt === today || t.lastDone === today);
    const stats = F.focusStats(store.list('focus'), today);
    const thoughts = sortBy(store.list('braindump').filter((b) => !b.done), (b) => b.date + b.time, -1);
    const reasons = F.reasonStats(store.list('procrastination'), addDays(today, -29));
    const med = F.adhdMedEffect(store.list('checkins'), store.list('medications'), store.data.medLog);
    const energyNow = currentEnergy();
    const bucket = energyNow <= 2 ? 1 : energyNow === 3 ? 3 : 5;
    const sortedOpen = sortBy(open, (t) => (t.deadline || '9999') + t.title);

    el.innerHTML = `
      ${ui.pageHead('Focus & taken', '<button class="btn primary" data-add-task>+ Taak</button>')}

      <section class="card focus-now">
        <div class="card-head"><h2>🎯 Wat nu?</h2></div>
        <p class="small">Mijn energie nu:
          ${[[1, '🪫 Laag'], [3, '😐 Gemiddeld'], [5, '⚡ Hoog']].map(([v, l]) => `<button class="btn small ${v === bucket ? 'primary' : 'ghost'}" data-energy-now="${v}" aria-pressed="${v === bucket}">${l}</button>`).join(' ')}
        </p>
        ${suggestionHtml(false)}
        <p class="muted small">De app kiest één taak die past bij je energie en deadlines. Beginnen is het moeilijkste – daarom eerst maar 5 minuten.</p>
      </section>

      <section class="card">
        <h2>🎉 Vandaag</h2>
        <div class="stats">
          <div><span class="stat-value">${doneToday.length}</span><span class="stat-label">taken afgerond</span></div>
          <div><span class="stat-value">${formatNum(stats.today)}<small> min</small></span><span class="stat-label">focus vandaag</span></div>
          <div><span class="stat-value">${formatNum(stats.week)}<small> min</small></span><span class="stat-label">focus deze week</span></div>
        </div>
        ${doneToday.length ? `<p class="small">✓ ${doneToday.map((t) => esc(t.title)).join(' · ')}</p>` : ''}
        ${stats.bestPart ? `<p class="small">💡 Je focust het vaakst succesvol in de <strong>${stats.bestPart}</strong> – plan zware taken dan.</p>` : ''}
        <div class="button-row"><button class="btn ghost small" data-start="5|">▶ 5 min focus zonder taak</button><button class="btn ghost small" data-start="25|">▶ 25 min</button></div>
      </section>

      ${routines.length ? `<section class="card"><h2>🔁 Routines</h2><ul class="routine-list">${routines.map((t) => {
        const openToday = F.isOpenToday(t, today);
        return `<li class="${openToday ? '' : 'done'}"><button class="dose-toggle" ${openToday ? `data-done="${esc(t.id)}"` : 'disabled'}><span class="check" aria-hidden="true">${openToday ? '' : '✓'}</span><span class="time"></span><span class="what"><strong>${esc(t.title)}</strong>${t.firstStep ? `<small>${esc(t.firstStep)}</small>` : ''}</span></button>
          <button class="btn small ghost" data-edit-task="${esc(t.id)}">Bewerken</button></li>`;
      }).join('')}</ul></section>` : ''}

      <section class="card">
        <div class="card-head"><h2>📋 Taken (${open.length})</h2><button class="btn small ghost" data-add-routine>+ Routine</button></div>
        ${sortedOpen.length ? `<ul class="task-list">${sortedOpen.map((t) => {
          const left = F.daysLeft(t, today);
          const steps = t.steps || [];
          const doneSteps = steps.filter((s) => s.done).length;
          return `<li>
            <div class="task-main">
              <strong>${esc(t.title)}</strong>
              <div class="task-meta">
                <span class="badge">${ENERGY_LABEL[t.energy] || ''}</span>
                ${t.minutes ? `<span class="badge">⏱ ${formatNum(t.minutes)} min</span>` : ''}
                ${left != null ? ui.badge(left < 0 ? `! ${-left} dag${left === -1 ? '' : 'en'} te laat` : left === 0 ? 'vandaag' : `📅 ${formatDateShort(t.deadline)}`, left <= 0 ? 'bad' : left <= 2 ? 'warn' : '') : ''}
                ${t.postponed ? `<span class="badge">⏳ ${t.postponed}× uitgesteld</span>` : ''}
              </div>
              ${F.firstStep(t) ? `<small>👉 ${esc(F.firstStep(t))}</small>` : ''}
              ${steps.length ? `<div class="progress" aria-label="Stappen"><span style="width:${(doneSteps / steps.length) * 100}%"></span></div><small class="muted">${doneSteps} van ${steps.length} stappen</small>` : ''}
            </div>
            <div class="task-actions">
              <button class="btn small primary" data-start="5|${esc(t.id)}" aria-label="5 minuten beginnen">▶</button>
              ${steps.some((s) => !s.done) ? `<button class="btn small ghost" data-step="${esc(t.id)}">✓ stap</button>` : ''}
              <button class="btn small ghost" data-done="${esc(t.id)}">✓</button>
              <button class="btn small ghost" data-edit-task="${esc(t.id)}">✎</button>
            </div>
          </li>`;
        }).join('')}</ul>` : ui.empty('Geen open taken. Hoofd leeg? Zet alles wat je moet doen hier, dan hoef je het niet te onthouden.')}
        ${tasks.some((t) => t.done) ? `<details class="stopped"><summary>Afgerond (${tasks.filter((t) => t.done).length})</summary><ul class="list">${sortBy(tasks.filter((t) => t.done), 'doneAt', -1).slice(0, 30).map((t) => `<li>✓ ${esc(t.title)} <small class="muted">${esc(formatDateShort(t.doneAt))}</small></li>`).join('')}</ul></details>` : ''}
      </section>

      <section class="card">
        <h2>💭 Gedachten geparkeerd</h2>
        <div class="focus-park"><input data-thought placeholder="Wat schiet er door je hoofd?" aria-label="Gedachte parkeren"><button class="btn small ghost" data-park>Parkeer</button></div>
        ${thoughts.length ? `<ul class="thought-list">${thoughts.map((b) => `<li><span>${esc(b.text)} <small class="muted">${esc(formatDateShort(b.date))}</small></span>
          <span><button class="btn small ghost" data-to-task="${esc(b.id)}">→ taak</button><button class="icon-btn small" data-thought-done="${esc(b.id)}" aria-label="Weg">✕</button></span></li>`).join('')}</ul>` : '<p class="muted small">Leeg hoofd, lege lijst. Handig tijdens het focussen: parkeer afleidende gedachten en ga door.</p>'}
      </section>

      <section class="card">
        <div class="card-head"><h2>⏳ Uitstelgedrag</h2><button class="btn small ghost" data-postpone-any>Ik stel iets uit</button></div>
        ${reasons.length ? `<p>Waarom je de afgelopen 30 dagen iets uitstelde:</p>
          <ul class="factor-list">${reasons.map((r) => `<li><span class="factor-icon" aria-hidden="true">${r.icon}</span><span class="factor-text">${esc(r.label)}<small>${esc(r.tip)}</small></span><span class="factor-effect min">${r.count}×</span></li>`).join('')}</ul>`
          : '<p class="muted small">Merk je dat je iets uitstelt? Tik op "Ik stel iets uit". Je krijgt meteen een tip, en na een tijdje zie je je patroon.</p>'}
      </section>

      <section class="card">
        <h2>🧠 ADHD</h2>
        ${med && med.withIt != null ? `<p>💊 Op dagen dat je <strong>${esc(med.meds.join(', '))}</strong> afvinkte, was je concentratie gemiddeld <strong>${formatNum(med.withIt.toFixed(1))}</strong>, zonder <strong>${formatNum(med.without.toFixed(1))}</strong> (van 5).</p>`
          : med ? `<p class="small">💊 Vink je ADHD-medicatie (${esc(med.meds.join(', '))}) af bij Medicatie en vul je concentratie in bij de dagelijkse check – dan zie je hier het verschil.</p>` : ''}
        <ul class="list small">
          <li>Eén ding tegelijk, en maak het zichtbaar (deze lijst, een briefje, een timer).</li>
          <li>Knip taken in stapjes van hooguit 10–15 minuten.</li>
          <li>Werk samen met iemand of in een bibliotheek (body doubling) als het thuis niet lukt.</li>
          <li>Slaap, bewegen, regelmatig eten en genoeg drinken helpen je concentratie echt – zie je energie- en slaapscherm.</li>
          <li>Wees mild voor jezelf: een dag waarop het niet lukt, is geen mislukking.</li>
        </ul>
        <p class="muted small">Deze app helpt je structuur te houden, maar vervangt geen behandeling. Loop je vast, of heb je vragen over medicatie? Bespreek het met je huisarts, psycholoog of ADHD-behandelaar.</p>
      </section>`;

    bindCommon(el);
    el.querySelectorAll('[data-energy-now]').forEach((b) => b.addEventListener('click', () => { manualEnergy = Number(b.dataset.energyNow); skip = []; render(el); }));
    el.querySelectorAll('[data-edit-task]').forEach((b) => b.addEventListener('click', () => openTask(store.get('tasks', b.dataset.editTask))));
    el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => completeStep(store.get('tasks', b.dataset.step))));
    el.querySelector('[data-add-routine]').addEventListener('click', () => openTask(null, { repeat: 'dagelijks', energy: 'laag', minutes: 10 }));
    el.querySelector('[data-postpone-any]').addEventListener('click', () => openPostpone(null));
    const input = el.querySelector('[data-thought]');
    el.querySelector('[data-park]').addEventListener('click', () => parkThought(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') parkThought(input.value); });
    el.querySelectorAll('[data-thought-done]').forEach((b) => b.addEventListener('click', () => store.upsert('braindump', Object.assign({}, store.get('braindump', b.dataset.thoughtDone), { done: true }))));
    el.querySelectorAll('[data-to-task]').forEach((b) => b.addEventListener('click', () => {
      const thought = store.get('braindump', b.dataset.toTask);
      store.upsert('braindump', Object.assign({}, thought, { done: true }));
      setTimeout(() => openTask(null, { title: thought.text }));
    }));
  }

  // Loopt er nog een timer (bijv. na herladen)? Dan meteen weer tonen.
  if (readTimer()) setTimeout(showOverlay, 300);

  HT.views.focus = { title: 'Focus & taken', render, cardHtml, bindCard, startTimer, openTask };
})(window.HT);
