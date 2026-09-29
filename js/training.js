/* Training: soorten sport, spiertraining (spiergroepen, oefeningen, vooruitgang) en conditie (afstand, tempo, rusthartslag).
 * Werkt in de browser (HT.training) en in Node (tests). */
(function (root) {
  'use strict';
  const u = typeof module !== 'undefined' && module.exports ? require('./utils.js') : root.HT.utils;
  const { addDays, parseNum, weekStart, daysBetween, sortBy } = u;

  const KINDS = [
    { key: 'Krachttraining', icon: '🏋️', group: 'kracht' },
    { key: 'Hardlopen', icon: '🏃', group: 'conditie' },
    { key: 'Wandelen', icon: '🚶', group: 'conditie' },
    { key: 'Fietsen', icon: '🚴', group: 'conditie' },
    { key: 'Zwemmen', icon: '🏊', group: 'conditie' },
    { key: 'Fitness / cardio', icon: '🫀', group: 'conditie' },
    { key: 'Balsport', icon: '⚽', group: 'sport' },
    { key: 'Racketsport', icon: '🎾', group: 'sport' },
    { key: 'Vechtsport', icon: '🥊', group: 'sport' },
    { key: 'Dansen', icon: '💃', group: 'sport' },
    { key: 'Yoga / pilates / mobiliteit', icon: '🧘', group: 'sport' },
    { key: 'Anders', icon: '🏅', group: 'sport' },
  ];

  const MUSCLES = ['Borst', 'Rug', 'Schouders', 'Biceps', 'Triceps', 'Buik / core', 'Onderrug', 'Billen', 'Bovenbenen (voor)', 'Hamstrings', 'Kuiten'];

  // Veelgebruikte oefeningen en de spiergroepen die ze vooral trainen.
  const EXERCISES = {
    'Squat': ['Bovenbenen (voor)', 'Billen'],
    'Deadlift': ['Hamstrings', 'Billen', 'Onderrug'],
    'Romanian deadlift': ['Hamstrings', 'Billen', 'Onderrug'],
    'Lunges': ['Bovenbenen (voor)', 'Billen'],
    'Leg press': ['Bovenbenen (voor)', 'Billen'],
    'Leg curl': ['Hamstrings'],
    'Leg extension': ['Bovenbenen (voor)'],
    'Hip thrust': ['Billen', 'Hamstrings'],
    'Calf raise': ['Kuiten'],
    'Bench press': ['Borst', 'Triceps', 'Schouders'],
    'Push-up': ['Borst', 'Triceps', 'Schouders'],
    'Dumbbell press': ['Borst', 'Triceps'],
    'Chest fly': ['Borst'],
    'Pull-up': ['Rug', 'Biceps'],
    'Lat pulldown': ['Rug', 'Biceps'],
    'Roeien (row)': ['Rug', 'Biceps'],
    'Shoulder press': ['Schouders', 'Triceps'],
    'Lateral raise': ['Schouders'],
    'Biceps curl': ['Biceps'],
    'Triceps dips': ['Triceps', 'Borst'],
    'Triceps pushdown': ['Triceps'],
    'Plank': ['Buik / core'],
    'Crunch': ['Buik / core'],
    'Russian twist': ['Buik / core'],
    'Back extension': ['Onderrug', 'Billen'],
    'Kettlebell swing': ['Billen', 'Hamstrings', 'Onderrug'],
  };

  const GUESS = [
    [/kracht|fitness|gym|sportschool|gewicht|squat|push.?up|bootcamp|crossfit/i, 'Krachttraining'],
    [/hardlo|rennen|jog|run/i, 'Hardlopen'],
    [/wandel|lopen|nordic|hike|traplopen/i, 'Wandelen'],
    [/fiets|spinning|mountainbike/i, 'Fietsen'],
    [/zwem|aqua/i, 'Zwemmen'],
    [/voetbal|basketbal|volleybal|hockey|korfbal|handbal/i, 'Balsport'],
    [/tennis|padel|badminton|squash|tafeltennis/i, 'Racketsport'],
    [/yoga|pilates|stretch|mobiliteit|fysio/i, 'Yoga / pilates / mobiliteit'],
    [/dans/i, 'Dansen'],
    [/box|judo|karate|kickbox|vecht/i, 'Vechtsport'],
  ];

  /** Soort sport van een activiteit (ook voor oude activiteiten zonder 'kind'). */
  function kindOf(e) {
    if (e.kind) return e.kind;
    const hit = GUESS.find(([re]) => re.test(e.activity || ''));
    return hit ? hit[1] : 'Anders';
  }
  const kindInfo = (k) => KINDS.find((x) => x.key === k) || KINDS[KINDS.length - 1];

  /** Spiergroepen van een krachttraining: aangevinkt, aangevuld met die van de oefeningen. */
  function musclesOf(e) {
    const set = new Set(Array.isArray(e.muscles) ? e.muscles : []);
    for (const x of e.exercises || []) {
      const key = Object.keys(EXERCISES).find((k) => k.toLowerCase() === String(x.name || '').trim().toLowerCase());
      if (key) EXERCISES[key].forEach((m) => set.add(m));
    }
    return [...set];
  }

  /** Aantal dagen met krachttraining in de 7 dagen t/m vandaag (advies: minstens 2). */
  function strengthDays(sport, today) {
    return new Set(sport.filter((e) => kindOf(e) === 'Krachttraining' && e.date >= addDays(today, -6) && e.date <= today).map((e) => e.date)).size;
  }

  /** Per spiergroep: wanneer voor het laatst getraind (dagen geleden) en hoe vaak in 14 dagen. */
  function muscleStatus(sport, today) {
    const out = {};
    for (const m of MUSCLES) out[m] = { last: null, count14: 0 };
    for (const e of sport) {
      if (kindOf(e) !== 'Krachttraining' || e.date > today) continue;
      for (const m of musclesOf(e)) {
        if (!out[m]) continue;
        const ago = daysBetween(e.date, today);
        if (out[m].last == null || ago < out[m].last) out[m].last = ago;
        if (ago <= 13) out[m].count14++;
      }
    }
    return out;
  }

  /** Geschatte 1-herhalingsmaximum (Epley). */
  const oneRepMax = (w, reps) => (reps <= 1 ? w : w * (1 + reps / 30));

  /** Vooruitgang per oefening: per datum het zwaarste gewicht, totaal volume en geschatte 1RM. */
  function exerciseProgress(sport) {
    const map = {};
    for (const e of sortBy(sport.filter((x) => kindOf(x) === 'Krachttraining'), 'date')) {
      for (const x of e.exercises || []) {
        const name = String(x.name || '').trim();
        if (!name) continue;
        const w = parseNum(x.weight) || 0;
        const reps = parseNum(x.reps) || 0;
        const sets = parseNum(x.sets) || 1;
        const k = name.toLowerCase();
        map[k] = map[k] || { name, sessions: [] };
        let s = map[k].sessions.find((y) => y.date === e.date);
        if (!s) { s = { date: e.date, maxWeight: 0, volume: 0, best1RM: 0, reps: 0 }; map[k].sessions.push(s); }
        s.maxWeight = Math.max(s.maxWeight, w);
        s.volume += sets * reps * w;
        s.reps = Math.max(s.reps, reps);
        s.best1RM = Math.max(s.best1RM, Math.round(oneRepMax(w, reps) * 10) / 10);
      }
    }
    return Object.values(map).sort((a, b) => b.sessions.length - a.sessions.length);
  }

  /** Tempo in minuten per km. */
  function pace(e) {
    const d = parseNum(e.distance);
    const t = parseNum(e.duration);
    return d && t ? t / d : null;
  }

  function formatPace(minPerKm) {
    if (minPerKm == null || !Number.isFinite(minPerKm)) return '–';
    let m = Math.floor(minPerKm);
    let s = Math.round((minPerKm - m) * 60);
    if (s === 60) { m++; s = 0; }
    return `${m}:${String(s).padStart(2, '0')} /km`;
  }

  /** Conditie-overzicht voor één soort (standaard hardlopen). */
  function cardio(sport, today, kind = 'Hardlopen') {
    const runs = sortBy(sport.filter((e) => kindOf(e) === kind && e.date <= today && parseNum(e.distance)), 'date');
    const kmByWeek = {};
    for (const r of runs) kmByWeek[weekStart(r.date)] = (kmByWeek[weekStart(r.date)] || 0) + parseNum(r.distance);
    const recent = runs.filter((r) => r.date >= addDays(today, -27));
    const before = runs.filter((r) => r.date < addDays(today, -27) && r.date >= addDays(today, -55));
    const avgPace = (arr) => {
      const km = arr.reduce((s, r) => s + parseNum(r.distance), 0);
      const min = arr.reduce((s, r) => s + (parseNum(r.duration) || 0), 0);
      return km ? min / km : null;
    };
    const longest = runs.reduce((best, r) => (!best || parseNum(r.distance) > parseNum(best.distance) ? r : best), null);
    const fastest = runs.filter((r) => parseNum(r.distance) >= 3 && pace(r)).reduce((best, r) => (!best || pace(r) < pace(best) ? r : best), null);
    return {
      runs,
      kmByWeek,
      kmThisWeek: Math.round((kmByWeek[weekStart(today)] || 0) * 10) / 10,
      paceRecent: avgPace(recent),
      pacePrevious: avgPace(before),
      longest,
      fastest,
    };
  }

  /** Rusthartslag-trend uit de dagelijkse check: gemiddelde laatste 14 dagen vs de 14 dagen daarvoor. */
  function restingHeartRate(checkins, today) {
    const avg = (from, to) => {
      const v = checkins.filter((c) => c.date >= from && c.date <= to && parseNum(c.heartRate) != null).map((c) => parseNum(c.heartRate));
      return v.length >= 3 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };
    return { recent: avg(addDays(today, -13), today), previous: avg(addDays(today, -27), addDays(today, -14)) };
  }

  const api = { KINDS, MUSCLES, EXERCISES, kindOf, kindInfo, musclesOf, strengthDays, muscleStatus, oneRepMax, exerciseProgress, pace, formatPace, cardio, restingHeartRate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HT.training = api;
})(typeof window !== 'undefined' ? window : globalThis);
