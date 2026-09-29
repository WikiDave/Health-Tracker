/* Slaap meten met knoppen: 🌙 Slaapwel (start), 😴 even wakker / 💤 weer slapen, ☀️ Goeiemorgen (einde).
 * Een sessie: { start: ms, wakes: [{ start: ms, end: ms|null, reasons: [] }] }.
 * Werkt in de browser (HT.sleeplog) en in Node (tests). */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const MAX_OPEN_WAKE_MIN = 30; // 😴 getikt maar niet 'weer slapen'? Dan tellen we hooguit 30 minuten wakker.
  const STALE_HOURS = 18; // langer 'slapend'? Dan is Goeiemorgen waarschijnlijk vergeten.
  const NAP_MAX_HOURS = 3;
  const REASONS = ['Plassen', 'Piekeren', 'Pijn', 'Lawaai', 'Te warm / koud', 'Dorst', 'Nachtmerrie', 'Partner / kind', 'Weet niet'];

  const pad = (n) => String(n).padStart(2, '0');
  const clock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dateOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  function start(now) {
    return { start: now, wakes: [] };
  }

  /** Is er nu een 😴-moment open (wakker, nog niet weer gaan slapen)? */
  function openWake(session) {
    const w = session && session.wakes[session.wakes.length - 1];
    return w && w.end == null ? w : null;
  }

  /** 😴: wakker geworden. Tik je nog eens terwijl je wakker bent, dan telt dat als 'weer slapen'. */
  function toggleWake(session, now) {
    const s = { start: session.start, wakes: session.wakes.map((w) => Object.assign({}, w)) };
    const open = openWake(s);
    if (open) open.end = now;
    else s.wakes.push({ start: now, end: null, reasons: [] });
    return s;
  }

  function setReasons(session, reasons) {
    const s = { start: session.start, wakes: session.wakes.map((w) => Object.assign({}, w)) };
    const w = s.wakes[s.wakes.length - 1];
    if (w) w.reasons = reasons;
    return s;
  }

  const wakeMinutes = (w, end) => {
    const stop = w.end != null ? w.end : Math.min(end, w.start + MAX_OPEN_WAKE_MIN * 60000);
    return Math.max(0, Math.round((stop - w.start) / 60000));
  };

  /** Hoe lang je al slaapt / wakker bent, voor het nachtscherm. */
  function isStale(session, now) {
    return now - session.start > STALE_HOURS * 3600000;
  }

  /**
   * ☀️ Goeiemorgen: zet de sessie om in waarden voor het dagrecord van de dag waarop je wakker wordt.
   * Geeft ook aan of het een dutje was (overdag en korter dan 3 uur) of dat Goeiemorgen vergeten was.
   */
  function summarize(session, end) {
    const stale = isStale(session, end);
    const wakes = session.wakes.filter((w) => w.start >= session.start && w.start <= end);
    const nightWakes = wakes.map((w) => ({ time: clock(w.start), minutes: wakeMinutes(w, end), reasons: w.reasons || [] }));
    const awakeMin = nightWakes.reduce((s, w) => s + w.minutes, 0);
    const totalMin = Math.round((end - session.start) / 60000);
    const startHour = new Date(session.start).getHours();
    const nap = !stale && totalMin < NAP_MAX_HOURS * 60 && startHour >= 9 && startHour < 20;
    const reasons = [...new Set(nightWakes.flatMap((w) => w.reasons).filter((r) => r !== 'Weet niet'))];
    return {
      date: stale ? dateOf(session.start + 8 * 3600000) : dateOf(end),
      bedtime: clock(session.start),
      wakeTime: stale ? null : clock(end),
      sleepHours: stale ? null : Math.max(0, Math.round(((totalMin - awakeMin) / 60) * 10) / 10),
      wakeUps: nightWakes.length,
      awakeMin,
      nightWakes,
      reasons,
      totalMin,
      nap,
      stale,
    };
  }

  /** Uren slaap uit bedtijd, opstaan, inslaaptijd en de gemeten wakkere minuten. */
  function hoursFrom(bedtime, wakeTime, fallAsleepMin, awakeMin) {
    if (!bedtime || !wakeTime) return null;
    const m = (t) => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi; };
    let mins = m(wakeTime) - m(bedtime);
    if (mins <= 0) mins += 24 * 60;
    mins -= (Number(fallAsleepMin) || 0) + (Number(awakeMin) || 0);
    return mins > 0 ? Math.round((mins / 60) * 10) / 10 : null;
  }

  const api = { MAX_OPEN_WAKE_MIN, STALE_HOURS, REASONS, clock, dateOf, start, openWake, toggleWake, setReasons, isStale, summarize, hoursFrom };
  if (isNode) module.exports = api;
  else root.HT.sleeplog = api;
})(typeof window !== 'undefined' ? window : globalThis);
