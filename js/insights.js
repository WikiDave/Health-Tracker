/* Verbanden: zet alle gegevens per dag naast elkaar en zoekt wat met wat samenhangt.
 * Voor elk paar (factor → uitkomst) met genoeg dagen: correlatie (Pearson) en het verschil in gemiddelden
 * tussen dagen met veel/weinig (of met/zonder) van de factor. Ook met één dag vertraging ("de dag ervoor").
 * Werkt in de browser (HT.insights) en in Node (tests). */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const u = isNode ? require('./utils.js') : root.HT.utils;
  const E = isNode ? require('./energy.js') : root.HT.energy;
  const T = isNode ? require('./training.js') : root.HT.training;
  const F = isNode ? require('./focus.js') : root.HT.focus;
  const { addDays, parseNum, fluidMl, formatNum } = u;

  /**
   * Alle variabelen. kind: num of bool. min/max: schaal (voor hoe groot een verschil is).
   * better: 'up' (hoger is beter), 'down' (lager is beter) of null (neutraal) – alleen voor uitkomsten.
   * route: het scherm waar je het invult. group: variabelen uit dezelfde groep worden niet met elkaar vergeleken.
   */
  const VARS = {
    energyScore: { label: 'energie', unit: '/100', kind: 'num', min: 0, max: 100, better: 'up', route: 'energie', group: 'energie', outcome: true },
    mood: { label: 'stemming', unit: '/5', kind: 'num', min: 1, max: 5, better: 'up', route: 'check', outcome: true },
    fatigue: { label: 'vermoeidheid', unit: '/10', kind: 'num', min: 0, max: 10, better: 'down', route: 'check', group: 'energie', outcome: true },
    stress: { label: 'stress', unit: '/10', kind: 'num', min: 0, max: 10, better: 'down', route: 'welzijn', outcome: true },
    anxiety: { label: 'angst/onrust', unit: '/10', kind: 'num', min: 0, max: 10, better: 'down', route: 'welzijn', outcome: true },
    gloom: { label: 'somberheid', unit: '/10', kind: 'num', min: 0, max: 10, better: 'down', route: 'welzijn', outcome: true },
    focus: { label: 'concentratie', unit: '/5', kind: 'num', min: 1, max: 5, better: 'up', route: 'focus', outcome: true },
    restless: { label: 'onrust (ADHD)', unit: '/10', kind: 'num', min: 0, max: 10, better: 'down', route: 'focus', outcome: true },
    overstimulated: { label: 'overprikkeling', unit: '/10', kind: 'num', min: 0, max: 10, better: 'down', route: 'focus', outcome: true },
    pain: { label: 'pijn', unit: '/10', kind: 'num', min: 0, max: 10, better: 'down', route: 'pijn', outcome: true },
    sleepHours: { label: 'slaapduur', noun: 'slaap', unit: 'uur', kind: 'num', min: 3, max: 11, better: 'up', route: 'slaap', group: 'slaapduur', outcome: true },
    sleepQuality: { label: 'slaapkwaliteit', unit: '/5', kind: 'num', min: 1, max: 5, better: 'up', route: 'slaap', outcome: true },
    wakeUps: { label: "keer wakker 's nachts", unit: '', kind: 'num', min: 0, max: 5, better: 'down', route: 'slaap', group: 'nachtwakker', outcome: true },
    nightAwakeMin: { label: "minuten wakker 's nachts", noun: "wakker 's nachts", unit: 'min', kind: 'num', min: 0, max: 90, better: 'down', route: 'slaap', group: 'nachtwakker', outcome: true },
    wakeFeeling: { label: 'gevoel bij opstaan', unit: '/5', kind: 'num', min: 1, max: 5, better: 'up', route: 'slaap', group: 'opstaan', outcome: true },
    bristol: { noFactor: true, label: 'stoelgang (Bristol, 4 = ideaal)', unit: '', kind: 'num', min: 1, max: 7, better: null, route: 'stoelgang', outcome: true },
    focusMin: { label: 'focusminuten', noun: 'focustijd', unit: 'min', kind: 'num', min: 0, max: 120, better: 'up', route: 'focus', outcome: true },
    tasksDone: { noFactor: true, label: 'afgeronde taken', unit: '', kind: 'num', min: 0, max: 6, better: 'up', route: 'focus', outcome: true },
    procrastinated: { noFactor: true, label: 'keren uitgesteld', unit: '', kind: 'num', min: 0, max: 4, better: 'down', route: 'focus', outcome: true },
    // Factoren
    sportMin: { label: 'beweging', unit: 'min', kind: 'num', route: 'sport' },
    strength: { label: 'krachttraining', kind: 'bool', route: 'sport' },
    steps: { label: 'stappen', unit: '', kind: 'num', route: 'check' },
    fluid: { label: 'drinken', noun: 'vocht', unit: 'ml', kind: 'num', route: 'drinken' },
    veg: { label: 'groente', unit: 'g', kind: 'num', route: 'voeding' },
    fruit: { label: 'fruit', unit: 'stuks', kind: 'num', route: 'voeding' },
    meals: { label: 'maaltijden', unit: '', kind: 'num', route: 'voeding' },
    foodComplaint: { label: 'klachten na het eten', kind: 'bool', route: 'voeding' },
    alcohol: { label: 'alcohol', unit: 'glazen', kind: 'num', route: 'middelen' },
    coffee: { label: 'koffie', unit: 'koppen', kind: 'num', route: 'middelen' },
    cigarettes: { label: 'sigaretten', unit: '', kind: 'num', route: 'middelen' },
    drugs: { label: 'drugsgebruik', kind: 'bool', route: 'middelen' },
    worked: { label: 'gewerkt', kind: 'bool', route: 'omgeving' },
    workLoad: { label: 'werkdruk', unit: '/10', kind: 'num', route: 'omgeving' },
    outside: { label: 'tijd buiten', unit: 'min', kind: 'num', route: 'omgeving' },
    party: { label: 'feest / uitgaan', kind: 'bool', route: 'omgeving' },
    social: { label: 'mensen gezien', kind: 'bool', route: 'omgeving' },
    screenTime: { label: 'schermtijd', unit: 'uur', kind: 'num', route: 'omgeving' },
    screenBeforeBed: { label: 'scherm voor het slapen', kind: 'bool', route: 'slaap' },
    snoozed: { label: 'snoozen', kind: 'bool', route: 'slaap', group: 'opstaan' },
    adherence: { label: 'medicijnen ingenomen', unit: '%', kind: 'num', route: 'medicatie' },
    adhdMed: { label: 'ADHD-medicatie genomen', kind: 'bool', route: 'medicatie' },
    weight: { label: 'gewicht', unit: 'kg', kind: 'num', route: 'check' },
  };
  // Uitkomsten tellen ook als factor (bv. slaap → energie, stress → slaap).
  // Factoren van de dag ervoor:
  const LAG = ['alcohol', 'sportMin', 'party', 'coffee', 'drugs', 'workLoad', 'screenTime', 'stress', 'pain', 'focusMin'];
  for (const k of LAG) {
    VARS[`prev_${k}`] = Object.assign({}, VARS[k], { label: `${VARS[k].label} (de dag ervoor)`, outcome: false, better: null, lagOf: k, group: VARS[k].group ? `prev_${VARS[k].group}` : undefined });
  }

  const CHECK_KEYS = ['wakeUps', 'nightAwakeMin', 'mood', 'fatigue', 'stress', 'anxiety', 'gloom', 'focus', 'restless', 'overstimulated', 'sleepHours', 'sleepQuality', 'wakeFeeling', 'steps', 'veg', 'fruit', 'alcohol', 'coffee', 'cigarettes', 'workLoad', 'screenTime', 'weight'];

  /** Eén rij per datum met alle variabelen (null = onbekend). */
  function table(data) {
    const envKeys = ['work', 'outsideMinutes', 'weather', 'envNotes'];
    const hasEnv = (c) => envKeys.some((k) => c[k] != null && c[k] !== '') || ['party', 'social', 'travel', 'alone', 'busyPlace'].some((k) => c[k]);
    const dates = new Set();
    const add = (d) => { if (d) dates.add(d); };
    (data.checkins || []).forEach((c) => add(c.date));
    ['sport', 'pain', 'bowel', 'food', 'focus', 'procrastination'].forEach((k) => (data[k] || []).forEach((x) => add(x.date)));
    Object.keys(data.medLog || {}).forEach(add);

    const byCheck = Object.fromEntries((data.checkins || []).map((c) => [c.date, c]));
    const group = (arr) => {
      const m = {};
      for (const x of arr || []) (m[x.date] = m[x.date] || []).push(x);
      return m;
    };
    const sport = group(data.sport);
    const pain = group(data.pain);
    const bowel = group(data.bowel);
    const food = group(data.food);
    const focus = group(data.focus);
    const proc = group(data.procrastination);
    const doneByDate = {};
    for (const t of data.tasks || []) {
      if (t.doneAt) doneByDate[t.doneAt] = (doneByDate[t.doneAt] || 0) + 1;
      for (const d of t.doneLog || []) doneByDate[d] = (doneByDate[d] || 0) + 1;
    }
    const hasSport = (data.sport || []).length > 0;
    const hasFocus = (data.focus || []).length > 0;
    const hasTasks = (data.tasks || []).length > 0;
    const hasProc = (data.procrastination || []).length > 0;
    const meds = data.medications || [];
    const adhdMeds = meds.filter((m) => F.ADHD_MEDS.test(m.name || ''));

    const rows = {};
    for (const date of [...dates].sort()) {
      const c = byCheck[date] || {};
      const r = { date };
      for (const k of CHECK_KEYS) r[k] = parseNum(c[k]);
      r.energyScore = E.dayScore(c);
      const painVals = [parseNum(c.pain), ...(pain[date] || []).map((p) => p.intensity)].filter((v) => v != null);
      r.pain = painVals.length ? Math.max(...painVals) : null;
      r.fluid = fluidMl(c);
      r.outside = parseNum(c.outsideMinutes);
      r.worked = c.work ? c.work !== 'Niet gewerkt' : null;
      r.party = hasEnv(c) ? Boolean(c.party) : null;
      r.social = hasEnv(c) ? Boolean(c.social) : null;
      r.drugs = Array.isArray(c.drugs) ? c.drugs.length > 0 : c.alcohol != null || c.coffee != null ? false : null;
      r.screenBeforeBed = c.screenBeforeBed ? ['Ongeveer een half uur', 'Het hele uur'].includes(c.screenBeforeBed) : null;
      r.snoozed = c.wakeMethod ? c.wakeMethod === 'Wekker – gesnoozed' : null;
      const s = sport[date] || [];
      r.sportMin = hasSport ? s.reduce((t, x) => t + (parseNum(x.duration) || 0), 0) : null;
      r.strength = hasSport ? s.some((x) => T.kindOf(x) === 'Krachttraining') : null;
      const b = bowel[date] || [];
      r.bristol = b.length ? b.reduce((t, x) => t + (Number(x.bristol) || 0), 0) / b.length : null;
      const f = food[date] || [];
      r.meals = f.length ? f.length : null;
      r.foodComplaint = f.length ? f.some((x) => x.complaints) : null;
      const day = (data.medLog || {})[date];
      const a = meds.length ? u.adherence(meds, data.medLog, date, date, '23:59') : { planned: 0 };
      r.adherence = a.planned ? a.pct : null;
      r.adhdMed = adhdMeds.length ? adhdMeds.some((m) => Object.keys(day || {}).some((k) => k.startsWith(m.id + '|'))) : null;
      const hasDay = Object.keys(c).length > 1;
      r.focusMin = (focus[date] || []).length ? focus[date].reduce((t, x) => t + (parseNum(x.actual) || 0), 0) : hasFocus && hasDay ? 0 : null;
      r.tasksDone = doneByDate[date] || (hasTasks && hasDay ? 0 : null);
      r.procrastinated = (proc[date] || []).length || (hasProc && hasDay ? 0 : null);
      rows[date] = r;
    }
    for (const date of Object.keys(rows)) {
      const prev = rows[addDays(date, -1)];
      for (const k of LAG) rows[date][`prev_${k}`] = prev ? prev[k] : null;
    }
    return Object.values(rows);
  }

  function pearson(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0; let sxx = 0; let syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  }

  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  /** Eén paar vergelijken. Geeft null bij te weinig gegevens of geen splitsing mogelijk. */
  function pair(rows, xKey, yKey, opts = {}) {
    const minN = opts.minN || 10;
    const minGroup = opts.minGroup || 4;
    const pts = rows.filter((r) => r[xKey] != null && r[yKey] != null).map((r) => [Number(r[xKey]), Number(r[yKey])]);
    if (pts.length < minN) return null;
    const xv = VARS[xKey];
    let hi; let lo; let threshold = null;
    if (xv.kind === 'bool') {
      hi = pts.filter((p) => p[0] === 1);
      lo = pts.filter((p) => p[0] === 0);
    } else {
      const xs = pts.map((p) => p[0]);
      const med = median(xs);
      threshold = med;
      if (med === Math.min(...xs)) { // veel nullen/minimum: vergelijk 'meer dan het minimum' met 'het minimum'
        hi = pts.filter((p) => p[0] > med);
        lo = pts.filter((p) => p[0] <= med);
      } else {
        hi = pts.filter((p) => p[0] >= med);
        lo = pts.filter((p) => p[0] < med);
      }
    }
    if (hi.length < minGroup || lo.length < minGroup) return null;
    const r = pearson(pts.map((p) => p[0]), pts.map((p) => p[1]));
    const withAvg = mean(hi.map((p) => p[1]));
    const withoutAvg = mean(lo.map((p) => p[1]));
    const yv = VARS[yKey];
    const range = (yv.max ?? 10) - (yv.min ?? 0) || 1;
    const diff = withAvg - withoutAvg;
    const allLo = lo.map((p) => p[0]);
    return {
      x: xKey, y: yKey, r, n: pts.length, nWith: hi.length, nWithout: lo.length,
      withAvg, withoutAvg, diff, relDiff: diff / range, threshold, loMax: Math.max(...allLo),
      strength: Math.abs(r) >= 0.5 ? 'sterk' : Math.abs(r) >= 0.3 ? 'duidelijk' : 'licht',
      good: yv.better == null ? null : (diff > 0) === (yv.better === 'up'),
    };
  }

  function sameGroup(a, b) {
    const ga = VARS[a].group;
    const gb = VARS[b].group;
    if (a === b || (ga && ga === gb)) return true;
    // een uitkomst vergelijken met z'n eigen waarde van gisteren is weinig zeggend
    if (VARS[a].lagOf === b || VARS[b].lagOf === a) return true;
    return false;
  }

  /**
   * Zoekt verbanden. opts.outcome: alleen deze uitkomst; opts.involving: alleen paren met een van deze variabelen.
   * Houdt alleen verbanden over met |r| ≥ 0.2 en een verschil van minstens 5% van de schaal.
   */
  function relate(data, opts = {}) {
    const rows = opts.rows || table(data);
    const outcomes = Object.keys(VARS).filter((k) => VARS[k].outcome && (!opts.outcome || k === opts.outcome));
    const factors = Object.keys(VARS);
    const out = [];
    for (const y of outcomes) {
      for (const x of factors) {
        if (sameGroup(x, y) || VARS[x].noFactor) continue;
        if (opts.involving && !opts.involving.includes(x) && !opts.involving.includes(y) && !opts.involving.includes(VARS[x].lagOf)) continue;
        const res = pair(rows, x, y, opts);
        if (!res || Math.abs(res.r) < (opts.minR || 0.2) || Math.abs(res.relDiff) < 0.05) continue;
        out.push(res);
      }
    }
    // Van twee uitkomsten die elkaar beïnvloeden (A→B en B→A) de sterkste houden
    const seen = new Set();
    return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).filter((res) => {
      const key = [res.x, res.y].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const fmt = (v, unit) => {
    const rounded = Math.abs(v) >= 20 ? Math.round(v) : Math.round(v * 10) / 10;
    return `${formatNum(rounded)}${unit && unit.startsWith('/') ? unit : ''}`;
  };

  const round1 = (v) => formatNum(Math.round(v * 10) / 10);
  const unitText = (unit) => (!unit ? '' : unit.startsWith('/') || unit === '%' ? unit : ` ${unit}`);

  /** Beschrijving van de factor-kant, na "Op dagen …": "met snoozen", "dat je stress 6/10 of hoger was", "met meer dan 2 glazen alcohol". */
  function factorText(res) {
    const xv = VARS[res.x];
    const base = xv.lagOf ? VARS[xv.lagOf] : xv;
    const lag = xv.lagOf ? ' de dag ervoor' : '';
    if (xv.kind === 'bool') return { with: `met ${xv.label}`, without: 'zonder' };
    const t = res.threshold;
    const above = res.loMax === t;
    const noun = `${base.noun || base.label}${xv.lagOf ? ' (de dag ervoor)' : ''}`;
    if (above && t === 0) return { with: `met ${noun}`, without: 'zonder' };
    if (base.unit && base.unit.startsWith('/')) {
      return { with: `dat je ${base.label}${lag} ${above ? `hoger dan ${round1(t)}${base.unit}` : `${round1(t)}${base.unit} of hoger`} was`, without: 'lager' };
    }
    const amount = `${round1(t)}${unitText(base.unit)}`;
    return { with: above ? `met meer dan ${amount} ${noun}` : `met ${amount} of meer ${noun}`, without: 'minder' };
  }

  /** De waarde van een factor op één dag, bv. "Koffie: 4 koppen" of "Snoozen". */
  function valueText(key, value) {
    const v = VARS[key];
    const cap = (t) => t[0].toUpperCase() + t.slice(1);
    if (v.kind === 'bool') return cap(v.label);
    const base = v.lagOf ? VARS[v.lagOf] : v;
    return `${cap(base.noun || base.label)}${v.lagOf ? ' (de dag ervoor)' : ''}: ${round1(value)}${unitText(base.unit)}`;
  }

  /** Zin in gewone taal. */
  function describe(res) {
    const yv = VARS[res.y];
    const ft = factorText(res);
    const word = res.diff > 0 ? 'hoger' : 'lager';
    const unitY = yv.unit && !yv.unit.startsWith('/') ? ` ${yv.unit}` : '';
    return `Op dagen ${ft.with} is je ${yv.label} gemiddeld ${formatNum(Math.round(Math.abs(res.diff) * 10) / 10)}${unitY} ${word} (${fmt(res.withAvg, yv.unit)} tegen ${fmt(res.withoutAvg, yv.unit)}).`;
  }

  /** Wat is er vandaag anders dan normaal? Vergelijkt de dag met je eigen gemiddelde (laatste 30 dagen). */
  function dayVsNormal(data, date, rows) {
    rows = rows || table(data);
    const row = rows.find((r) => r.date === date);
    if (!row) return [];
    const recent = rows.filter((r) => r.date < date && r.date >= addDays(date, -30));
    const out = [];
    for (const [k, v] of Object.entries(VARS)) {
      if (v.lagOf || v.kind !== 'num' || row[k] == null) continue;
      const vals = recent.map((r) => r[k]).filter((x) => x != null);
      if (vals.length < 5) continue;
      const avg = mean(vals);
      const sd = Math.sqrt(mean(vals.map((x) => (x - avg) ** 2))) || 0;
      const range = (v.max ?? Math.max(...vals, row[k])) - (v.min ?? Math.min(...vals, row[k])) || 1;
      const delta = row[k] - avg;
      if (Math.abs(delta) < Math.max(sd, range * 0.15) || Math.abs(delta) / range < 0.1) continue;
      out.push({ key: k, value: row[k], avg, delta, good: v.better == null ? null : (delta > 0) === (v.better === 'up') });
    }
    return out.sort((a, b) => Math.abs(b.delta / ((VARS[b.key].max ?? 10) - (VARS[b.key].min ?? 0) || 1)) - Math.abs(a.delta / ((VARS[a.key].max ?? 10) - (VARS[a.key].min ?? 0) || 1)));
  }

  const api = { VARS, LAG, table, pearson, pair, relate, describe, factorText, valueText, dayVsNormal };
  if (isNode) module.exports = api;
  else root.HT.insights = api;
})(typeof window !== 'undefined' ? window : globalThis);
