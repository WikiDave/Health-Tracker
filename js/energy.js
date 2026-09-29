/* Energie-analyse: waarom ben je moe of energiek?
 * Vergelijkt je eigen dagen met en zonder een bepaalde factor (slaap, bewegen, drinken, alcohol, stress …)
 * en laat zien wat jou energie geeft en wat energie kost. Werkt in de browser (HT.energy) en in Node (tests). */
(function (root) {
  'use strict';
  const u = typeof module !== 'undefined' && module.exports ? require('./utils.js') : root.HT.utils;
  const { addDays, parseNum, fluidMl, rangeStatus, sortBy, formatNum } = u;

  const LEVELS = [
    { value: 1, icon: '🪫', label: 'Leeg' },
    { value: 2, icon: '😴', label: 'Moe' },
    { value: 3, icon: '😐', label: 'Gaat wel' },
    { value: 4, icon: '🙂', label: 'Goed' },
    { value: 5, icon: '⚡', label: 'Vol energie' },
  ];

  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  /** Moment van de dag, voor het vragen naar energie. */
  function partOfDay(hhmm) {
    if (hhmm < '12:00') return 'ochtend';
    if (hhmm < '17:00') return 'middag';
    return 'avond';
  }

  /** Energiescore van een dag, 0–100: gemiddelde van energie (1–5), energiemomenten (1–5) en vermoeidheid (0–10, omgekeerd). */
  function dayScore(c) {
    if (!c) return null;
    const parts = [];
    const log = Array.isArray(c.energyLog) ? c.energyLog.map((x) => parseNum(x.level)).filter((x) => x != null) : [];
    if (log.length) parts.push(((mean(log) - 1) / 4) * 100);
    else if (parseNum(c.energy) != null) parts.push(((parseNum(c.energy) - 1) / 4) * 100);
    if (parseNum(c.fatigue) != null) parts.push((10 - parseNum(c.fatigue)) * 10);
    return parts.length ? Math.round(mean(parts)) : null;
  }

  /**
   * Factoren die energie kunnen beïnvloeden. test(c, prev, ctx) geeft true / false, of null als het onbekend is.
   * 'c' is het dagrecord, 'prev' dat van de dag ervoor.
   */
  const FACTORS = [
    { key: 'sleepShort', label: 'Minder dan 7 uur geslapen', icon: '🌙', test: (c) => (parseNum(c.sleepHours) == null ? null : parseNum(c.sleepHours) < 7),
      tip: 'Probeer 7–9 uur te slapen, met vaste bed- en opstatijden.' },
    { key: 'sleepGood', label: 'Goed geslapen (kwaliteit 4–5)', icon: '😴', test: (c) => (parseNum(c.sleepQuality) == null ? null : parseNum(c.sleepQuality) >= 4) },
    { key: 'wokeNaturally', label: 'Vanzelf wakker geworden', icon: '☀️', test: (c) => (!c.wakeMethod ? null : c.wakeMethod === 'Vanzelf wakker') },
    { key: 'snoozed', label: 'Gesnoozed', icon: '⏰', test: (c) => (!c.wakeMethod ? null : c.wakeMethod === 'Wekker – gesnoozed'),
      tip: 'Zet je wekker op de tijd dat je echt opstaat, en leg hem buiten handbereik.' },
    { key: 'goodStart', label: 'Dag begonnen met daglicht, water of bewegen', icon: '🌅',
      test: (c) => (!c.morningStart ? null : ['Water gedronken', 'Naar buiten / daglicht', 'Bewogen of gestretcht'].includes(c.morningStart)),
      tip: 'Begin de dag met een glas water en een paar minuten daglicht.' },
    { key: 'phoneFirst', label: 'Dag begonnen met je telefoon', icon: '📱', test: (c) => (!c.morningStart ? null : c.morningStart === 'Telefoon / social media') },
    { key: 'moved', label: 'Bewogen of gesport', icon: '🏃', test: (c, prev, ctx) => (ctx.hasSport ? ctx.sportDates.has(c.date) || parseNum(c.steps) >= 7000 : parseNum(c.steps) == null ? null : parseNum(c.steps) >= 7000),
      tip: 'Een korte wandeling geeft vaak meer energie dan rust – ook als je moe bent.' },
    { key: 'movedYesterday', label: 'De dag ervoor gesport', icon: '🏋️', test: (c, prev, ctx) => (ctx.hasSport ? ctx.sportDates.has(addDays(c.date, -1)) : null) },
    { key: 'hydrated', label: 'Genoeg gedronken', icon: '💧', test: (c, prev, ctx) => { const f = fluidMl(c); return f == null ? null : f >= ctx.fluidGoal; },
      tip: 'Te weinig drinken maakt moe; houd een fles water binnen handbereik.' },
    { key: 'alcoholYesterday', label: 'Alcohol gedronken de avond ervoor', icon: '🍷', test: (c, prev) => (!prev || parseNum(prev.alcohol) == null ? null : parseNum(prev.alcohol) > 0),
      tip: 'Alcohol verstoort je slaap, ook als je sneller in slaap valt.' },
    { key: 'coffee', label: '3 of meer koppen koffie', icon: '☕', test: (c) => (parseNum(c.coffee) == null ? null : parseNum(c.coffee) >= 3),
      tip: 'Veel koffie geeft een dip als het uitwerkt en kan je slaap verstoren; na 14:00 liever niet.' },
    { key: 'stress', label: 'Veel stress (6 of hoger)', icon: '😣', test: (c) => (parseNum(c.stress) == null ? null : parseNum(c.stress) >= 6),
      tip: 'Plan bewust pauzes en momenten van ontspanning, ook op drukke dagen.' },
    { key: 'worked', label: 'Gewerkt', icon: '💼', test: (c) => (!c.work ? null : c.work !== 'Niet gewerkt') },
    { key: 'busyWork', label: 'Hoge werkdruk (7 of hoger)', icon: '📈', test: (c) => (parseNum(c.workLoad) == null ? null : parseNum(c.workLoad) >= 7) },
    { key: 'partyYesterday', label: 'Feest of uitgaan de dag ervoor', icon: '🎉', test: (c, prev, ctx) => (!prev || !ctx.hasEnv(prev) ? null : Boolean(prev.party)) },
    { key: 'outside', label: 'Minstens een half uur buiten', icon: '🌳', test: (c) => (parseNum(c.outsideMinutes) == null ? null : parseNum(c.outsideMinutes) >= 30),
      tip: 'Daglicht en buitenlucht helpen je energie en je slaapritme.' },
    { key: 'social', label: 'Mensen gezien', icon: '👥', test: (c, prev, ctx) => (!ctx.hasEnv(c) ? null : Boolean(c.social)) },
    { key: 'veg', label: 'Genoeg groente (250 g)', icon: '🥦', test: (c) => (parseNum(c.veg) == null ? null : parseNum(c.veg) >= 250) },
    { key: 'meals', label: '3 of meer maaltijden gegeten', icon: '🍽', test: (c, prev, ctx) => (ctx.hasFood ? (ctx.mealsByDate[c.date] || 0) >= 3 : null),
      tip: 'Regelmatig eten voorkomt energiedips; sla het ontbijt niet over.' },
    { key: 'pain', label: 'Veel pijn (5 of hoger)', icon: '🤕', test: (c, prev, ctx) => { const p = ctx.painByDate[c.date]; return p == null ? null : p >= 5; } },
    { key: 'screen', label: 'Schermtijd voor het slapen', icon: '📱', test: (c) => (!c.screenBeforeBed ? null : ['Ongeveer een half uur', 'Het hele uur'].includes(c.screenBeforeBed)),
      tip: 'Leg je telefoon een uur voor het slapen weg.' },
  ];

  function context(data) {
    const sport = data.sport || [];
    const food = data.food || [];
    const mealsByDate = {};
    for (const f of food) mealsByDate[f.date] = (mealsByDate[f.date] || 0) + 1;
    const painByDate = {};
    for (const c of data.checkins) if (parseNum(c.pain) != null) painByDate[c.date] = parseNum(c.pain);
    for (const p of data.pain || []) if (p.intensity != null) painByDate[p.date] = Math.max(painByDate[p.date] ?? 0, p.intensity);
    const envKeys = ['work', 'outsideMinutes', 'weather', 'envNotes'];
    return {
      hasSport: sport.length > 0,
      sportDates: new Set(sport.map((s) => s.date)),
      hasFood: food.length > 0,
      mealsByDate,
      painByDate,
      fluidGoal: Number((data.settings || {}).fluidGoal) || 2000,
      hasEnv: (c) => envKeys.some((k) => c[k] != null && c[k] !== '') || ['party', 'social', 'travel', 'alone'].some((k) => c[k]),
    };
  }

  /**
   * Analyseert welke factoren samenhangen met je energie.
   * @returns {{factors: Array<{key,label,icon,effect,withAvg,withoutAvg,n,tip}>, days:number}}
   * effect = gemiddelde energiescore mét de factor min zonder (punten op 0–100).
   */
  function analyze(data, today, minPerGroup = 3) {
    const ctx = context(data);
    const byDate = Object.fromEntries(data.checkins.map((c) => [c.date, c]));
    const days = data.checkins.filter((c) => c.date <= today && dayScore(c) != null);
    const factors = [];
    for (const f of FACTORS) {
      const withIt = [];
      const without = [];
      for (const c of days) {
        const t = f.test(c, byDate[addDays(c.date, -1)], ctx);
        if (t == null) continue;
        (t ? withIt : without).push(dayScore(c));
      }
      if (withIt.length < minPerGroup || without.length < minPerGroup) continue;
      const w = mean(withIt);
      const wo = mean(without);
      factors.push({ key: f.key, label: f.label, icon: f.icon, tip: f.tip, effect: Math.round(w - wo), withAvg: Math.round(w), withoutAvg: Math.round(wo), n: withIt.length + without.length });
    }
    return { factors: sortBy(factors, (x) => -Math.abs(x.effect)), days: days.length };
  }

  /** Welke (duidelijke) factoren gelden vandaag, en wat betekent dat volgens je eigen patroon? */
  function explainDay(data, date, analysis, threshold = 5) {
    const ctx = context(data);
    const c = data.checkins.find((x) => x.date === date);
    if (!c) return [];
    const prev = data.checkins.find((x) => x.date === addDays(date, -1));
    const out = [];
    for (const r of analysis.factors) {
      if (Math.abs(r.effect) < threshold) continue;
      const f = FACTORS.find((x) => x.key === r.key);
      if (f.test(c, prev, ctx) === true) out.push(r);
    }
    return out;
  }

  const LAB_PATTERNS = [
    [/hemoglobine|\bhb\b/i, 'Een laag Hb (bloedarmoede) is een bekende oorzaak van vermoeidheid.'],
    [/ferritine|ijzer/i, 'IJzertekort kan moe maken, ook als je Hb nog normaal is.'],
    [/tsh|vrij t4|\bt4\b/i, 'Een afwijkende schildklierwaarde kan moeheid of juist onrust geven.'],
    [/b12|foliumzuur/i, 'Een tekort aan vitamine B12 of foliumzuur kan vermoeidheid geven.'],
    [/vitamine d/i, 'Een laag vitamine D kan bijdragen aan moeheid en spierklachten.'],
    [/glucose|hba1c/i, 'Een afwijkende bloedsuiker kan energieschommelingen geven.'],
  ];

  /** Afwijkende bloedwaarden (laatste 12 maanden) die met vermoeidheid te maken kunnen hebben. */
  function labHints(data, today) {
    const out = [];
    const seen = new Set();
    for (const lab of sortBy((data.labs || []).filter((l) => l.date >= addDays(today, -365) && l.date <= today), 'date', -1)) {
      for (const r of lab.results || []) {
        const status = rangeStatus(r.value, r.low, r.high);
        if (status !== 'low' && status !== 'high') continue;
        const match = LAB_PATTERNS.find(([re]) => re.test(r.name));
        const key = r.name.toLowerCase();
        if (!match || seen.has(key)) continue;
        seen.add(key);
        out.push({ name: r.name, value: r.value, unit: r.unit, status, date: lab.date, text: match[1] });
      }
    }
    return out;
  }

  /** Al langere tijd erg moe? (gemiddeld vermoeidheid ≥ 6 over minstens 10 ingevulde dagen in de laatste 4 weken) */
  function persistentFatigue(data, today) {
    const vals = data.checkins.filter((c) => c.date >= addDays(today, -27) && c.date <= today && parseNum(c.fatigue) != null).map((c) => parseNum(c.fatigue));
    if (vals.length < 10) return null;
    const avg = mean(vals);
    return avg >= 6 ? { avg: Math.round(avg * 10) / 10, days: vals.length } : null;
  }

  /** Tekst voor een factor, in gewone taal. */
  function describe(r) {
    const pts = `${formatNum(Math.abs(r.effect))} punten`;
    return r.effect >= 0
      ? `${r.label}: gemiddeld ${pts} meer energie (${r.withAvg} tegen ${r.withoutAvg}).`
      : `${r.label}: gemiddeld ${pts} minder energie (${r.withAvg} tegen ${r.withoutAvg}).`;
  }

  const api = { LEVELS, FACTORS, partOfDay, dayScore, analyze, explainDay, labHints, persistentFatigue, describe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HT.energy = api;
})(typeof window !== 'undefined' ? window : globalThis);
