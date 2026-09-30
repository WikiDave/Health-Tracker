/* Gezondheidsmeter: een indicatie (0–100) op basis van wat je hebt ingevuld en algemene Nederlandse richtlijnen.
 * Transparante vaste regels per onderdeel, met uitleg (goed / aandachtspunt) en een tip. Geen diagnose.
 * Onderdelen zonder (recente) gegevens tellen niet mee. Werkt in de browser (HT.healthscore) en in Node (tests). */
(function (root) {
  'use strict';
  const u = typeof module !== 'undefined' && module.exports ? require('./utils.js') : root.HT.utils;
  const { addDays, average, parseNum, fluidMl, adherence, rangeStatus, daysBetween, formatNum, sortBy } = u;

  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
  const r1 = (n) => formatNum(Math.round(n * 10) / 10);
  const mean = (arr) => {
    const v = arr.filter((x) => x != null && Number.isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  /** Nieuw onderdeel. score blijft null als er geen gegevens zijn. */
  function domain(key, label, icon, weight, route) {
    // mid: uitleg bij middelmatige waarden – getoond als het onderdeel niet goed scoort en er geen duidelijker aandachtspunt is.
    return { key, label, icon, weight, route, parts: [], good: [], bad: [], mid: [], tips: [], score: null };
  }
  function finish(d) {
    d.score = d.parts.length ? Math.round(mean(d.parts)) : null;
    return d;
  }

  function sleep(data, today) {
    const d = domain('sleep', 'Slaap', '🌙', 15, 'slaap');
    const from = addDays(today, -6);
    const h = average(data.checkins, 'sleepHours', from, today);
    const q = average(data.checkins, 'sleepQuality', from, today);
    if (h && h.n >= 2) {
      const v = h.avg;
      d.parts.push(v >= 7 && v <= 9 ? 100 : v < 7 ? clamp(100 - (7 - v) * 25) : clamp(100 - (v - 9) * 20));
      if (v >= 7 && v <= 9) d.good.push(`Je slaapt gemiddeld ${r1(v)} uur – precies binnen de aanbevolen 7 tot 9 uur.`);
      else if (v < 7) { d.bad.push(`Je slaapt gemiddeld ${r1(v)} uur; 7 tot 9 uur wordt aanbevolen.`); d.tips.push('Probeer vaste bed- en opstatijden en een uur zonder scherm voor het slapen.'); }
      else d.bad.push(`Je slaapt gemiddeld ${r1(v)} uur – dat is veel. Lang slapen kan een teken zijn van vermoeidheid of somberheid.`);
    }
    const wf = average(data.checkins, 'wakeFeeling', from, today);
    if (wf && wf.n >= 2) {
      d.parts.push(((wf.avg - 1) / 4) * 100);
      if (wf.avg >= 3.5) d.good.push(`Je staat meestal goed op (${r1(wf.avg)}/5).`);
      else if (wf.avg <= 2.5) { d.bad.push(`Je staat vaak moeizaam op (${r1(wf.avg)}/5).`); d.tips.push('Vaste opstatijd, niet snoozen en meteen daglicht helpen om frisser op te staan.'); }
      else d.mid.push(`Opstaan gaat wisselend (${r1(wf.avg)}/5).`);
    }
    if (q && q.n >= 2) {
      d.parts.push(((q.avg - 1) / 4) * 100);
      if (q.avg >= 3.5) d.good.push(`Je slaapkwaliteit is goed (${r1(q.avg)}/5).`);
      else if (q.avg <= 2.5) { d.bad.push(`Je slaapkwaliteit is laag (${r1(q.avg)}/5).`); d.tips.push('Kijk bij Slaap wat je wakker houdt; slaap je al weken slecht, bespreek het met je huisarts.'); }
      else d.mid.push(`Je slaapkwaliteit is matig (${r1(q.avg)}/5).`);
    }
    return finish(d);
  }

  function movement(data, today) {
    const d = domain('movement', 'Beweging', '🏃', 15, 'sport');
    const from = addDays(today, -6);
    const recent = data.sport.filter((s) => s.date >= from && s.date <= today);
    const steps = average(data.checkins, 'steps', from, today);
    if (data.sport.length) {
      const min = recent.reduce((s, x) => s + (parseNum(x.duration) || 0) * (x.intensity === 'Zwaar' ? 2 : 1), 0);
      d.parts.push(clamp((min / 150) * 100));
      if (min >= 150) d.good.push(`Je bewoog ${formatNum(Math.round(min))} minuten in de afgelopen 7 dagen – de Beweegrichtlijn (150 min) gehaald.`);
      else { d.bad.push(`Je bewoog ${formatNum(Math.round(min))} van de aanbevolen 150 minuten in de afgelopen 7 dagen.`); d.tips.push(`Nog ${formatNum(Math.round(150 - min))} minuten: bijvoorbeeld elke dag een stevige wandeling van 20 minuten.`); }
    }
    const tr = typeof module !== 'undefined' && module.exports ? require('./training.js') : root.HT.training;
    if (data.sport.some((s) => tr.kindOf(s) === 'Krachttraining')) {
      const days = tr.strengthDays(data.sport, today);
      d.parts.push(clamp((days / 2) * 100));
      if (days >= 2) d.good.push(`Je deed ${days}× krachttraining deze week (advies: minstens 2×).`);
      else { d.bad.push(`Je deed ${days}× krachttraining in de afgelopen 7 dagen; minstens 2× is het advies.`); d.tips.push('Plan twee korte krachtmomenten per week, bijvoorbeeld squats, push-ups en plank thuis.'); }
    }
    if (steps && steps.n >= 2) {
      d.parts.push(clamp((steps.avg / 8000) * 100));
      if (steps.avg >= 8000) d.good.push(`Gemiddeld ${formatNum(Math.round(steps.avg))} stappen per dag.`);
      else if (steps.avg < 5000) d.bad.push(`Gemiddeld ${formatNum(Math.round(steps.avg))} stappen per dag – dat is weinig.`);
    }
    return finish(d);
  }

  function nutrition(data, today) {
    const d = domain('nutrition', 'Voeding & drinken', '🥗', 10, 'voeding');
    const from = addDays(today, -6);
    const veg = average(data.checkins, 'veg', from, today);
    const fruit = average(data.checkins, 'fruit', from, today);
    if (veg && veg.n >= 2) {
      d.parts.push(clamp((veg.avg / 250) * 100));
      if (veg.avg >= 250) d.good.push(`Je eet genoeg groente (gem. ${Math.round(veg.avg)} gram).`);
      else { d.bad.push(`Gemiddeld ${Math.round(veg.avg)} gram groente per dag; 250 gram is het advies.`); d.tips.push('Een extra opscheplepel groente bij het avondeten is al 50 gram.'); }
    }
    if (fruit && fruit.n >= 2) {
      d.parts.push(clamp((fruit.avg / 2) * 100));
      const stuks = (n) => `${r1(n)} ${Math.round(n * 10) === 10 ? 'stuk' : 'stuks'}`;
      if (fruit.avg >= 2) d.good.push(`Je eet genoeg fruit (gem. ${stuks(fruit.avg)}).`);
      else d.bad.push(`Gemiddeld ${stuks(fruit.avg)} fruit per dag; 2 is het advies.`);
    }
    const s = data.settings || {};
    const goal = Number(s.fluidGoal) || 2000;
    const fluids = data.checkins.filter((c) => c.date >= from && c.date <= today).map(fluidMl).filter((v) => v != null);
    if (fluids.length >= 2) {
      const f = mean(fluids);
      if (s.fluidMode === 'max') {
        d.parts.push(f <= goal ? 100 : clamp(100 - ((f - goal) / goal) * 200));
        if (f <= goal) d.good.push(`Je blijft gemiddeld binnen je vochtbeperking (${formatNum(Math.round(f))} van max ${formatNum(goal)} ml).`);
        else d.bad.push(`Je zit gemiddeld boven je vochtbeperking (${formatNum(Math.round(f))} ml, max ${formatNum(goal)} ml).`);
      } else {
        d.parts.push(clamp((f / goal) * 100));
        if (f >= goal) d.good.push(`Je drinkt genoeg (gem. ${formatNum(Math.round(f))} ml per dag).`);
        else { d.bad.push(`Je drinkt gemiddeld ${formatNum(Math.round(f))} ml per dag; je doel is ${formatNum(goal)} ml.`); d.tips.push('Zet een fles water in het zicht, of zet de drinkherinnering aan.'); }
      }
    }
    return finish(d);
  }

  const LEVEL_SCORE = { Minimaal: 100, Licht: 75, Matig: 45, 'Matig ernstig': 25, Ernstig: 15 };

  function mental(data, today) {
    const d = domain('mental', 'Mentaal', '🧠', 15, 'welzijn');
    const from = addDays(today, -6);
    const names = { stress: 'stress', anxiety: 'angst/onrust', gloom: 'somberheid' };
    for (const k of ['stress', 'anxiety', 'gloom']) {
      const a = average(data.checkins, k, from, today);
      if (!a || a.n < 2) continue;
      d.parts.push(100 - a.avg * 10);
      if (a.avg <= 3) d.good.push(`Weinig ${names[k]} (gem. ${r1(a.avg)}/10).`);
      else if (a.avg >= 6) d.bad.push(`Veel ${names[k]} (gem. ${r1(a.avg)}/10).`);
      else d.mid.push(`Je hebt af en toe last van ${names[k]} (gem. ${r1(a.avg)}/10).`);
    }
    const mood = average(data.checkins, 'mood', from, today);
    if (mood && mood.n >= 2) {
      d.parts.push(((mood.avg - 1) / 4) * 100);
      if (mood.avg >= 3.5) d.good.push(`Je stemming is overwegend goed (${r1(mood.avg)}/5).`);
      else if (mood.avg <= 2.5) d.bad.push(`Je stemming is vaak laag (${r1(mood.avg)}/5).`);
      else d.mid.push(`Je stemming is wisselend (${r1(mood.avg)}/5).`);
    }
    const recent = (data.questionnaires || []).filter((q) => q.date >= addDays(today, -30) && q.date <= today);
    for (const type of ['phq9', 'gad7']) {
      const last = sortBy(recent.filter((q) => q.type === type), 'date', -1)[0];
      if (!last || LEVEL_SCORE[last.level] == null) continue;
      d.parts.push(LEVEL_SCORE[last.level]);
      const name = type === 'phq9' ? 'somberheid (PHQ-9)' : 'angst (GAD-7)';
      if (last.score >= 10) d.bad.push(`Je zelftest ${name} gaf een score van ${last.score} (${last.level.toLowerCase()}).`);
      else d.good.push(`Je zelftest ${name} was ${last.level.toLowerCase()} (${last.score}).`);
    }
    if (d.bad.length || d.mid.length) d.tips.push('Praat erover met iemand die je vertrouwt of met je huisarts/POH-GGZ. Ontspanning, buitenlucht en bewegen helpen vaak ook.');
    return finish(d);
  }

  function physical(data, today) {
    const d = domain('physical', 'Lichamelijk', '💪', 15, 'check');
    const from = addDays(today, -6);
    const fatigue = average(data.checkins, 'fatigue', from, today);
    if (fatigue && fatigue.n >= 2) {
      d.parts.push(100 - fatigue.avg * 10);
      if (fatigue.avg <= 3) d.good.push(`Je bent weinig moe (gem. ${r1(fatigue.avg)}/10).`);
      else if (fatigue.avg >= 6) { d.bad.push(`Je bent vaak erg moe (gem. ${r1(fatigue.avg)}/10).`); d.tips.push('Blijft de vermoeidheid langer dan een paar weken zonder duidelijke oorzaak? Laat je huisarts meekijken (bijvoorbeeld bloedonderzoek).'); }
      else d.mid.push(`Je bent regelmatig moe (gem. ${r1(fatigue.avg)}/10).`);
    }
    const energy = average(data.checkins, 'energy', from, today);
    if (energy && energy.n >= 2) {
      d.parts.push(((energy.avg - 1) / 4) * 100);
      if (energy.avg <= 2.5) d.bad.push(`Je hebt weinig energie (${r1(energy.avg)}/5).`);
      else if (energy.avg < 3.5) d.mid.push(`Je energie is gemiddeld (${r1(energy.avg)}/5).`);
      else d.good.push(`Je hebt goede energie (${r1(energy.avg)}/5).`);
    }
    // Pijn: uit de check én het hoogste cijfer per dag uit het pijndagboek
    const painByDay = {};
    for (const c of data.checkins) if (c.date >= from && c.date <= today && parseNum(c.pain) != null) painByDay[c.date] = parseNum(c.pain);
    for (const p of data.pain || []) if (p.date >= from && p.date <= today && p.intensity != null) painByDay[p.date] = Math.max(painByDay[p.date] ?? 0, p.intensity);
    const painVals = Object.values(painByDay);
    if (painVals.length >= 2) {
      const pv = mean(painVals);
      d.parts.push(100 - pv * 10);
      if (pv <= 2) d.good.push(`Weinig pijn (gem. ${r1(pv)}/10).`);
      else if (pv >= 5) { d.bad.push(`Je hebt veel pijn (gem. ${r1(pv)}/10).`); d.tips.push('Houd bij wat helpt in je pijndagboek en bespreek aanhoudende pijn met je huisarts.'); }
      else d.mid.push(`Je hebt regelmatig wat pijn (gem. ${r1(pv)}/10).`);
    }
    return finish(d);
  }

  function substances(data, today) {
    const d = domain('substances', 'Middelen', '🍷', 10, 'middelen');
    const s = data.settings || {};
    const last7 = data.checkins.filter((c) => c.date >= addDays(today, -6) && c.date <= today);
    const cigDays = last7.filter((c) => parseNum(c.cigarettes) != null);
    const quitDays = s.quitDate && s.quitDate <= today ? daysBetween(s.quitDate, today) : null;
    if (cigDays.length || quitDays != null) {
      const cig = cigDays.length ? mean(cigDays.map((c) => parseNum(c.cigarettes))) : 0;
      if (cig > 0) {
        d.parts.push(clamp(60 - cig * 3));
        d.bad.push(`Je rookt gemiddeld ${r1(cig)} sigaretten per dag. Stoppen is het beste wat je voor je gezondheid kunt doen.`);
        d.tips.push('Stoppen met hulp werkt het best: je huisarts of ikstopnu.nl.');
      } else {
        d.parts.push(100);
        d.good.push(quitDays != null ? `Je bent ${quitDays} dagen rookvrij. 🎉` : 'Je rookt niet.');
      }
    }
    const alcDays = last7.filter((c) => parseNum(c.alcohol) != null);
    if (alcDays.length >= 2) {
      const perWeek = (alcDays.reduce((a, c) => a + parseNum(c.alcohol), 0) / alcDays.length) * 7;
      d.parts.push(perWeek === 0 ? 100 : perWeek <= 7 ? 80 : perWeek <= 14 ? 50 : 20);
      if (perWeek === 0) d.good.push('Je drinkt geen alcohol.');
      else if (perWeek <= 7) d.good.push(`Je drinkt ongeveer ${r1(perWeek)} glazen alcohol per week (advies: niet meer dan 1 per dag, liever geen).`);
      else { d.bad.push(`Je drinkt ongeveer ${r1(perWeek)} glazen alcohol per week; het advies is niet meer dan 1 glas per dag en liefst geen.`); d.tips.push('Plan een paar vaste alcoholvrije dagen per week.'); }
    }
    const drugDays = data.checkins.filter((c) => c.date >= addDays(today, -29) && c.date <= today && Array.isArray(c.drugs) && c.drugs.length).length;
    if (drugDays > 0) {
      d.parts.push(clamp(100 - drugDays * 15, 20));
      d.bad.push(`Je gebruikte drugs op ${drugDays} dag${drugDays === 1 ? '' : 'en'} in de afgelopen 30 dagen.`);
    }
    return finish(d);
  }

  function medication(data, today) {
    const d = domain('medication', 'Medicijntrouw', '💊', 10, 'medicatie');
    const a = adherence(data.medications, data.medLog, addDays(today, -6), today, today === u.todayISO() ? u.nowTime() : '23:59');
    if (a.planned >= 3) {
      d.parts.push(a.pct);
      if (a.pct >= 90) d.good.push(`Je nam ${a.pct}% van je geplande medicijnen en supplementen in.`);
      else { d.bad.push(`Je nam ${a.pct}% van je geplande innames in (${a.taken} van ${a.planned}).`); d.tips.push('Zet je innametijden in je agenda via Medicatie → Herinneringen.'); }
    }
    return finish(d);
  }

  function measurements(data, today) {
    const d = domain('measurements', 'Metingen', '📏', 10, 'bloed');
    const from = addDays(today, -29);
    const sys = average(data.checkins, 'systolic', from, today);
    const dia = average(data.checkins, 'diastolic', from, today);
    if (sys && dia && sys.n >= 2) {
      const s = sys.avg;
      const di = dia.avg;
      const bp = `${Math.round(s)}/${Math.round(di)}`;
      if (s < 120 && di < 80) { d.parts.push(100); d.good.push(`Je bloeddruk is goed (gem. ${bp}).`); }
      else if (s < 140 && di < 90) { d.parts.push(70); d.bad.push(`Je bloeddruk is iets verhoogd (gem. ${bp}).`); d.tips.push('Minder zout, meer bewegen en minder alcohol helpen de bloeddruk omlaag.'); }
      else { d.parts.push(30); d.bad.push(`Je bloeddruk is hoog (gem. ${bp}). Bespreek dit met je huisarts.`); }
    }
    const height = parseNum(data.profile && data.profile.height);
    const weightRec = sortBy(data.checkins.filter((c) => c.date >= addDays(today, -89) && c.date <= today && parseNum(c.weight) != null), 'date', -1)[0];
    if (height && weightRec) {
      const bmi = parseNum(weightRec.weight) / Math.pow(height / 100, 2);
      if (bmi >= 18.5 && bmi < 25) { d.parts.push(100); d.good.push(`Je BMI is ${r1(bmi)} (gezond gewicht).`); }
      else if (bmi >= 25 && bmi < 30) { d.parts.push(70); d.bad.push(`Je BMI is ${r1(bmi)} (overgewicht). BMI zegt niet alles – spiermassa telt bijvoorbeeld ook mee.`); }
      else { d.parts.push(40); d.bad.push(`Je BMI is ${r1(bmi)} (${bmi < 18.5 ? 'ondergewicht' : 'obesitas'}). Bespreek dit gerust met je huisarts of een diëtist.`); }
    }
    const lab = sortBy((data.labs || []).filter((l) => l.date >= addDays(today, -365) && l.date <= today), 'date', -1)[0];
    if (lab && (lab.results || []).length) {
      const out = lab.results.filter((x) => ['low', 'high'].includes(rangeStatus(x.value, x.low, x.high)));
      d.parts.push(clamp(100 - out.length * 15, 20));
      if (out.length) d.bad.push(`Je laatste bloedonderzoek had ${out.length} afwijkende waarde${out.length === 1 ? '' : 'n'}: ${out.map((x) => x.name).join(', ')}. Vraag je arts wat dit betekent.`);
      else d.good.push('Je laatste bloedonderzoek had geen afwijkende waarden.');
    }
    return finish(d);
  }

  function social(data, today) {
    const d = domain('social', 'Sociaal', '👥', 10, 'sociaal');
    const from = addDays(today, -6);
    const contacts = data.contacts || [];
    const IN_PERSON = new Set(['Afgesproken / bezoek', 'Samen iets gedaan', 'Groep / feest', 'Werk / school']);
    if (contacts.length) {
      const recent = contacts.filter((c) => c.date >= from && c.date <= today);
      const days = new Set(recent.map((c) => c.date)).size;
      const inPerson = new Set(recent.filter((c) => IN_PERSON.has(c.type)).map((c) => c.date)).size;
      d.parts.push(clamp((days / 5) * 100));
      d.parts.push(clamp((inPerson / 2) * 100));
      if (inPerson >= 2) d.good.push(`Je zag ${inPerson} dagen iemand in het echt in de afgelopen week.`);
      else if (!recent.length) { d.bad.push('Je hebt de afgelopen week geen contact met anderen genoteerd.'); d.tips.push('Stuur vandaag één iemand een berichtje of spreek af voor een wandeling – klein beginnen is genoeg.'); }
      else { d.bad.push(`Je zag deze week ${inPerson === 1 ? 'maar 1 dag' : 'niemand'} iemand in het echt.`); d.tips.push('Plan deze week één afspraak in het echt, bijvoorbeeld koffie of samen wandelen.'); }
      if (days >= 5) d.good.push(`Je had op ${days} van de 7 dagen contact met anderen.`);
      else if (recent.length) d.mid.push(`Je had op ${days} van de 7 dagen contact met anderen.`);
    }
    const lonely = average(data.checkins, 'loneliness', addDays(today, -13), today);
    if (lonely && lonely.n >= 2) {
      d.parts.push(clamp(100 - lonely.avg * 10));
      if (lonely.avg <= 3) d.good.push(`Je voelt je zelden eenzaam (${r1(lonely.avg)}/10).`);
      else if (lonely.avg >= 6) { d.bad.push(`Je voelt je vaak eenzaam (${r1(lonely.avg)}/10).`); d.tips.push('Praat erover met iemand die je vertrouwt, je huisarts, of De Luisterlijn (088 0767 000, dag en nacht).'); }
      else d.mid.push(`Je voelt je soms eenzaam (${r1(lonely.avg)}/10).`);
    }
    return finish(d);
  }

  /** Signalen die je niet moet wegmiddelen: altijd apart tonen. */
  function redFlags(data, today) {
    const flags = [];
    const recentChecks = data.checkins.filter((c) => c.date >= addDays(today, -2) && c.date <= today);
    if ((data.bowel || []).some((b) => b.blood && b.date >= addDays(today, -13) && b.date <= today)) flags.push('Bloed bij de ontlasting in de afgelopen 2 weken – bespreek dit met je huisarts.');
    if (recentChecks.some((c) => parseNum(c.systolic) >= 180 || parseNum(c.diastolic) >= 110)) flags.push('Zeer hoge bloeddruk gemeten (180/110 of hoger) – neem vandaag contact op met je huisarts of de huisartsenpost.');
    if (recentChecks.some((c) => parseNum(c.oxygen) != null && parseNum(c.oxygen) < 92)) flags.push('Lage zuurstofsaturatie gemeten (onder 92%) – neem contact op met je huisarts of de huisartsenpost.');
    if (recentChecks.some((c) => parseNum(c.temperature) >= 39)) flags.push('Hoge koorts (39 °C of hoger) – neem contact op met je huisarts als het niet snel zakt of je je erg ziek voelt.');
    const phq = sortBy((data.questionnaires || []).filter((q) => q.type === 'phq9' && q.date >= addDays(today, -30)), 'date', -1)[0];
    if (phq && Array.isArray(phq.answers) && phq.answers[8] > 0) flags.push('Je gaf in je zelftest aan gedachten te hebben over de dood of jezelf iets aandoen. Praat erover: 113 (of gratis 0800-0113) of je huisarts.');
    return flags;
  }

  function labelFor(score) {
    if (score >= 80) return { label: 'Goed', kind: 'good' };
    if (score >= 60) return { label: 'Redelijk', kind: 'good' };
    if (score >= 40) return { label: 'Matig', kind: 'warn' };
    return { label: 'Aandacht nodig', kind: 'bad' };
  }

  /**
   * Berekent de meter op een bepaalde datum.
   * @returns {{score:number|null, label, kind, confidence, domains, flags, good, bad, tips, missing}}
   */
  function compute(data, today) {
    const all = [sleep, movement, nutrition, mental, social, physical, substances, medication, measurements].map((f) => f(data, today));
    const scored = all.filter((d) => d.score != null);
    const missing = all.filter((d) => d.score == null);
    const flags = redFlags(data, today);
    const daysWithData = new Set(data.checkins.filter((c) => c.date >= addDays(today, -13) && c.date <= today).map((c) => c.date)).size;
    let confidence = 'laag';
    if (scored.length >= 6 && daysWithData >= 10) confidence = 'hoog';
    else if (scored.length >= 4 && daysWithData >= 5) confidence = 'redelijk';
    if (scored.length < 2) return { score: null, confidence, domains: all, flags, good: [], bad: [], tips: [], missing };
    const totalWeight = scored.reduce((s, d) => s + d.weight, 0);
    const score = Math.round(scored.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight);
    // Belangrijkste redenen: zwakste onderdelen eerst voor aandachtspunten, sterkste eerst voor wat goed gaat.
    const byScore = sortBy(scored, 'score');
    // Duidelijke aandachtspunten eerst; daarna de uitleg bij middelmatige waarden van onderdelen onder de 80
    // die verder geen aandachtspunt hebben (zodat een lage score altijd uitgelegd wordt).
    const clear = byScore.flatMap((d) => d.bad.map((text) => ({ text, domain: d })));
    const explained = byScore.filter((d) => d.score < 80 && !d.bad.length && d.mid.length);
    for (const d of explained) d.bad.push(...d.mid);
    const mild = explained.flatMap((d) => d.mid.map((text) => ({ text, domain: d, mild: true })));
    const bad = [...clear, ...mild];
    const good = [...byScore].reverse().flatMap((d) => d.good.map((text) => ({ text, domain: d })));
    const tips = byScore.filter((d) => d.score < 80).flatMap((d) => d.tips.slice(0, 1).map((text) => ({ text, domain: d })));
    return Object.assign({ score, confidence, domains: all, flags, good, bad, tips, missing }, labelFor(score));
  }

  const api = { compute, labelFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HT.healthscore = api;
})(typeof window !== 'undefined' ? window : globalThis);
