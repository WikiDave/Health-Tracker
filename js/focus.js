/* Focus & uitstelgedrag (ADHD-vriendelijk): taken met een kleinste eerste stap, één taak kiezen die past bij je energie,
 * routines, redenen van uitstel met passende tips, en focus-statistieken. Werkt in de browser (HT.focus) en in Node (tests). */
(function (root) {
  'use strict';
  const u = typeof module !== 'undefined' && module.exports ? require('./utils.js') : root.HT.utils;
  const { addDays, daysBetween, parseISO, parseNum, sortBy } = u;

  const ENERGY = { laag: 1, midden: 2, hoog: 3 };

  /** Redenen van uitstel, met een tip die bij die reden past. */
  const REASONS = [
    { key: 'groot', label: 'Te groot / overweldigend', icon: '🏔️', tip: 'Hak de taak in stapjes van hooguit 10 minuten en begin met de allerkleinste. Je hoeft alleen die ene stap te doen.' },
    { key: 'onduidelijk', label: 'Weet niet waar te beginnen', icon: '❓', tip: 'Schrijf op wat "klaar" betekent en wat de allereerste handeling is (bv. "document openen"). Vraag het na als iets onduidelijk is.' },
    { key: 'saai', label: 'Saai / geen zin', icon: '😑', tip: 'Maak het interessanter: muziek of een podcast erbij, een wedstrijdje tegen de timer, of samen met iemand (body doubling). Beloon jezelf na afloop.' },
    { key: 'spannend', label: 'Spannend / bang dat het misgaat', icon: '😬', tip: 'Je hoeft nu niet het resultaat te halen, alleen 5 minuten te beginnen. Wat is het kleinste stapje dat niet eng voelt?' },
    { key: 'perfect', label: 'Moet perfect', icon: '💎', tip: 'Maak eerst een bewust "slechte" eerste versie. Goed genoeg is goed – verbeteren kan later.' },
    { key: 'moe', label: 'Te moe', icon: '🪫', tip: 'Kies nu een taak die weinig energie kost, of plan deze taak op je beste moment van de dag. Eerst even water en frisse lucht helpt vaak.' },
    { key: 'afgeleid', label: 'Steeds afgeleid', icon: '📱', tip: 'Leg je telefoon in een andere kamer, zet een timer en parkeer opkomende gedachten in je gedachtenlijst.' },
    { key: 'teveel', label: 'Te veel tegelijk', icon: '🌀', tip: 'Kies er één. Gebruik "Wat nu?" en laat de rest even los – de lijst loopt niet weg.' },
  ];

  /** Is een (herhalende) taak vandaag aan de beurt? */
  function isOpenToday(task, today) {
    if (!task.repeat) return !task.done;
    if (task.lastDone === today) return false;
    const dow = (parseISO(today).getDay() + 6) % 7; // 0 = maandag
    if (task.repeat === 'weekdagen') return dow < 5;
    if (task.repeat === 'wekelijks') return !task.lastDone || daysBetween(task.lastDone, today) >= 7;
    return true; // dagelijks
  }

  /** Hoe dringend: dagen tot de deadline (verlopen = negatief), of null. */
  function daysLeft(task, today) {
    return task.deadline ? daysBetween(today, task.deadline) : null;
  }

  /**
   * Kiest één taak die nu past. Energie 1–5 (uit je energieknoppen); zonder energie: 3.
   * Volgorde: deadline vandaag/verlopen → past bij je energie → deadline binnenkort → klein en snel → vaak uitgesteld (met kleinste stap).
   * @returns {{task, reason:string}|null}
   */
  function pickNext(tasks, { today, energy = 3, skip = [] } = {}) {
    const open = tasks.filter((t) => isOpenToday(t, today) && !skip.includes(t.id));
    if (!open.length) return null;
    const cap = energy <= 2 ? 1 : energy === 3 ? 2 : 3;
    const score = (t) => {
      const need = ENERGY[t.energy] || 2;
      const left = daysLeft(t, today);
      let s = 0;
      if (left != null && left <= 0) s += 100;
      else if (left != null && left <= 2) s += 40;
      else if (left != null && left <= 7) s += 15;
      if (need <= cap) s += 30; else s -= 25 * (need - cap);
      if (energy >= 4 && need === 3) s += 10; // veel energie: pak nu de zware klus
      const min = parseNum(t.minutes) || 30;
      if (energy <= 2) s += Math.max(0, 20 - min / 3); // weinig energie: liever iets kleins
      else s += Math.max(0, 10 - min / 10);
      if (t.repeat) s += 5;
      s += Math.min(10, (t.postponed || 0) * 2); // vaak uitgesteld: nu het kleinste stapje
      return s;
    };
    const best = sortBy(open, (t) => -score(t))[0];
    const need = ENERGY[best.energy] || 2;
    const left = daysLeft(best, today);
    let reason;
    if (left != null && left < 0) reason = 'De deadline is verstreken – even afronden geeft rust.';
    else if (left === 0) reason = 'Deze moet vandaag af.';
    else if (left != null && left <= 2) reason = `De deadline is over ${left} dag${left === 1 ? '' : 'en'}.`;
    else if (energy <= 2 && need === 1) reason = 'Je energie is laag – dit is een klus die weinig energie kost.';
    else if (energy >= 4 && need === 3) reason = 'Je hebt veel energie – een goed moment voor deze zware klus.';
    else if ((best.postponed || 0) >= 2) reason = `Al ${best.postponed}× uitgesteld – begin alleen met de eerste stap.`;
    else reason = 'Past bij je energie en is goed te doen.';
    return { task: best, reason };
  }

  /** Eerste openstaande stap, of de ingevulde eerste stap. */
  function firstStep(task) {
    const step = (task.steps || []).find((s) => !s.done);
    return step ? step.text : task.firstStep || '';
  }

  function reasonStats(entries, from) {
    const counts = {};
    for (const e of entries) {
      if (from && e.date < from) continue;
      for (const r of e.reasons || []) counts[r] = (counts[r] || 0) + 1;
    }
    return sortBy(REASONS.filter((r) => counts[r.key]).map((r) => Object.assign({ count: counts[r.key] }, r)), (r) => -r.count);
  }

  /** Focus-statistieken: minuten vandaag en deze 7 dagen, afgemaakt, en je beste tijd van de dag. */
  function focusStats(sessions, today) {
    const inDays = (s, n) => s.date > addDays(today, -n) && s.date <= today;
    const minutes = (arr) => Math.round(arr.reduce((t, s) => t + (parseNum(s.actual) || 0), 0));
    const week = sessions.filter((s) => inDays(s, 7));
    const byPart = {};
    for (const s of sessions.filter((x) => inDays(x, 28) && x.completed)) {
      const h = Number(String(s.start || '12:00').slice(0, 2));
      const part = h < 12 ? 'ochtend' : h < 17 ? 'middag' : 'avond';
      byPart[part] = (byPart[part] || 0) + 1;
    }
    const best = Object.entries(byPart).sort((a, b) => b[1] - a[1])[0];
    return {
      today: minutes(sessions.filter((s) => s.date === today)),
      week: minutes(week),
      sessionsWeek: week.length,
      completedWeek: week.filter((s) => s.completed).length,
      distractionsWeek: week.reduce((t, s) => t + (s.distractions || 0), 0),
      bestPart: best && best[1] >= 3 ? best[0] : null,
    };
  }

  const ADHD_MEDS = /methylfenidaat|ritalin|concerta|medikinet|equasym|kinecteen|dexamfetamine|lisdexamfetamine|elvanse|amfexa|atomoxetine|strattera|guanfacine|intuniv|bupropion|modafinil/i;

  /** Concentratie op dagen mét en zonder (afgevinkte) ADHD-medicatie. Minstens 3 dagen per groep. */
  function adhdMedEffect(checkins, medications, medLog) {
    const meds = medications.filter((m) => ADHD_MEDS.test(m.name || ''));
    if (!meds.length) return null;
    const withIt = [];
    const without = [];
    for (const c of checkins) {
      const f = parseNum(c.focus);
      if (f == null) continue;
      const day = (medLog || {})[c.date] || {};
      const taken = meds.some((m) => Object.keys(day).some((k) => k.startsWith(m.id + '|')));
      (taken ? withIt : without).push(f);
    }
    if (withIt.length < 3 || without.length < 3) return { meds: meds.map((m) => m.name) };
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    return { meds: meds.map((m) => m.name), withIt: avg(withIt), without: avg(without) };
  }

  const api = { ENERGY, REASONS, isOpenToday, daysLeft, pickNext, firstStep, reasonStats, focusStats, adhdMedEffect, ADHD_MEDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HT.focus = api;
})(typeof window !== 'undefined' ? window : globalThis);
