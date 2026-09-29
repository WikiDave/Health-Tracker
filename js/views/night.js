/* Slaapwel / Goeiemorgen: slaap meten met knoppen, met een donker nachtscherm en 😴 voor als je 's nachts even wakker bent. */
(function (HT) {
  'use strict';
  const { store, ui, utils, sleeplog: S } = HT;
  const { escapeHtml: esc, formatNum } = utils;

  let hidden = false; // nachtscherm weggeklikt ("naar de app")
  let tick = null;

  const session = () => store.data.settings.sleepSession || null;
  const save = (s) => store.saveSettings({ sleepSession: s });

  const duration = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h} u ${String(m).padStart(2, '0')} min` : `${m} min`;
  };

  function goodnight() {
    if (!session()) save(S.start(Date.now()));
    hidden = false;
    sync();
  }

  function wake() {
    const s = session();
    if (!s) return;
    save(S.toggleWake(s, Date.now()));
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function cancel() {
    save(null);
    ui.toast('Slaapmeting gestopt');
  }

  /** ☀️ Goeiemorgen: sessie afsluiten, opslaan bij de dag waarop je wakker wordt en vragen hoe het ging. */
  function goodMorning() {
    const s = session();
    if (!s) return;
    const r = S.summarize(s, Date.now());
    save(null);
    const existing = store.checkinFor(r.date) || {};
    if (r.nap) {
      store.mergeCheckin(r.date, { nap: (Number(existing.nap) || 0) + r.totalMin });
      ui.toast(`😴 Dutje van ${r.totalMin} minuten opgeslagen`);
      return;
    }
    store.mergeCheckin(r.date, {
      bedtime: r.bedtime,
      wakeTime: r.wakeTime,
      sleepHours: r.sleepHours,
      wakeUps: r.wakeUps,
      nightAwakeMin: r.awakeMin,
      nightWakes: r.nightWakes,
      sleepTracked: true,
      sleepDisturbance: existing.sleepDisturbance || (r.reasons.length ? r.reasons.join(', ').toLowerCase() : existing.sleepDisturbance),
    });
    openMorning(r);
  }

  function openMorning(r) {
    const byId = (n) => HT.views.sleep.FIELDS.find((f) => f.name === n);
    HT.views.checkin.openDayPart({
      title: r.stale ? 'Vergeten Goeiemorgen te tikken?' : `☀️ Goeiemorgen! ${r.sleepHours != null ? `${formatNum(r.sleepHours)} uur geslapen` : ''}`,
      date: r.date,
      fields: [
        { name: 'hMeasured', type: 'heading', label: r.stale ? 'Vul in hoe laat je bent opgestaan.' : `🌙 ${r.bedtime} – ☀️ ${r.wakeTime}${r.wakeUps ? ` · ${r.wakeUps}× wakker (${r.awakeMin} min)` : ' · niet wakker geweest'}` },
        Object.assign({}, byId('bedtime'), { label: 'Slaapwel om' }),
        Object.assign({}, byId('wakeTime'), { label: 'Goeiemorgen om', required: true }),
        Object.assign({}, byId('fallAsleep'), { label: 'Hoe lang duurde inslapen? (min, ongeveer)' }),
        byId('sleepQuality'),
        ...HT.views.sleep.WAKE_FIELDS.filter((f) => f.type !== 'heading'),
      ],
      toastText: 'Fijne dag! ☀️',
      prepare(v) {
        const awake = (store.checkinFor(v.date) || {}).nightAwakeMin || 0;
        v.sleepHours = S.hoursFrom(v.bedtime, v.wakeTime, v.fallAsleep, awake);
        if (v.wakeFeeling != null && v.restedWaking == null) v.restedWaking = v.wakeFeeling;
        return v;
      },
    });
  }

  // ---------- Nachtscherm ----------
  function overlayHtml(s) {
    const now = Date.now();
    const open = S.openWake(s);
    const mins = Math.round((now - s.start) / 60000);
    const done = s.wakes.filter((w) => w !== open);
    if (S.isStale(s, now)) {
      return `<div class="night-box">
        <p class="night-clock">${S.clock(now)}</p>
        <h2>Nog aan het slapen?</h2>
        <p>Je tikte <strong>Slaapwel</strong> om ${S.clock(s.start)} (${duration(mins)} geleden). Vergeten Goeiemorgen te tikken?</p>
        <button class="night-btn sun" data-night="morning"><span aria-hidden="true">☀️</span>Tijd van opstaan invullen</button>
        <p><button class="night-link" data-night="cancel">Meting weggooien</button> · <button class="night-link" data-night="hide">Naar de app</button></p>
      </div>`;
    }
    return `<div class="night-box">
      <p class="night-clock" data-night-clock>${S.clock(now)}</p>
      ${open ? `
        <p class="night-state">Wakker sinds ${S.clock(open.start)}</p>
        <p class="night-q">Wat houdt je wakker? <span class="night-dim">(mag je overslaan)</span></p>
        <div class="night-reasons">${S.REASONS.map((r) => `<button class="night-chip${(open.reasons || []).includes(r) ? ' on' : ''}" data-reason="${esc(r)}" aria-pressed="${(open.reasons || []).includes(r)}">${esc(r)}</button>`).join('')}</div>
        <button class="night-btn big" data-night="wake"><span aria-hidden="true">💤</span>Weer slapen</button>
        <p class="night-dim small">Vergeet je dit? Dan tellen we hooguit ${S.MAX_OPEN_WAKE_MIN} minuten wakker.</p>`
      : `
        <p class="night-state">🌙 Slaap lekker · sinds ${S.clock(s.start)}</p>
        ${done.length ? `<p class="night-dim">${done.length}× wakker geweest</p>` : ''}
        <button class="night-btn big" data-night="wake"><span aria-hidden="true">😴</span>Even wakker</button>`}
      <button class="night-btn sun" data-night="morning"><span aria-hidden="true">☀️</span>Goeiemorgen</button>
      <p class="night-foot">${mins <= 30 ? '<button class="night-link" data-night="cancel">Toch niet slapen</button> · ' : ''}<button class="night-link" data-night="hide">Naar de app</button></p>
    </div>`;
  }

  function sync() {
    const s = session();
    let el = document.getElementById('night-overlay');
    if (!s || hidden) {
      if (el) el.remove();
      clearInterval(tick);
      tick = null;
      document.documentElement.classList.remove('night-mode');
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'night-overlay';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Nachtscherm');
      document.body.appendChild(el);
    }
    document.documentElement.classList.add('night-mode');
    el.innerHTML = overlayHtml(s);
    el.querySelectorAll('[data-night]').forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.night;
      if (act === 'wake') wake();
      if (act === 'morning') goodMorning();
      if (act === 'cancel') cancel();
      if (act === 'hide') { hidden = true; sync(); }
    }));
    el.querySelectorAll('[data-reason]').forEach((b) => b.addEventListener('click', () => {
      const cur = session();
      const open = S.openWake(cur);
      if (!open) return;
      const set = new Set(open.reasons || []);
      if (set.has(b.dataset.reason)) set.delete(b.dataset.reason); else set.add(b.dataset.reason);
      save(S.setReasons(cur, [...set]));
    }));
    if (!tick) {
      tick = setInterval(() => {
        const c = document.querySelector('#night-overlay [data-night-clock]');
        if (c) c.textContent = S.clock(Date.now());
      }, 20000);
    }
  }

  // ---------- Kaart voor startscherm en slaapscherm ----------
  /** always: ook overdag tonen (op het slaapscherm). */
  function cardHtml(always) {
    const s = session();
    if (s) {
      const open = S.openWake(s);
      return `<section class="card night-card">
        <div class="card-head"><h2>🌙 ${open ? `Wakker sinds ${S.clock(open.start)}` : `Slaapmeting loopt sinds ${S.clock(s.start)}`}</h2></div>
        <div class="button-row">
          <button class="btn ghost" data-night-card="show">Nachtscherm</button>
          <button class="btn ghost" data-night-card="wake">${open ? '💤 Weer slapen' : '😴 Even wakker'}</button>
          <button class="btn primary" data-night-card="morning">☀️ Goeiemorgen</button>
        </div>
      </section>`;
    }
    const t = utils.nowTime();
    if (!always && t < '19:00' && t >= '04:00') return '';
    return `<section class="card night-card">
      <div class="card-head"><h2>🌙 Naar bed?</h2></div>
      <p class="small">Tik <strong>Slaapwel</strong> als je gaat slapen en <strong>Goeiemorgen</strong> als je opstaat: dan meet de app hoe lang je slaapt. Ben je 's nachts even wakker? Tik 😴.</p>
      <button class="btn primary" data-night-card="goodnight">🌙 Slaapwel</button>
    </section>`;
  }

  function bindCard(el) {
    el.querySelectorAll('[data-night-card]').forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.nightCard;
      if (act === 'goodnight') goodnight();
      if (act === 'show') { hidden = false; sync(); }
      if (act === 'wake') wake();
      if (act === 'morning') goodMorning();
    }));
  }

  store.onChange(() => sync());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { hidden = false; sync(); } });
  sync();

  HT.views.night = { goodnight, goodMorning, wake, cardHtml, bindCard, sync };
})(window.HT);
