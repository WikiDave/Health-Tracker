/* Exporteert alle gegevens naar een Excel-bestand met een tabblad per onderdeel. */
(function (HT) {
  'use strict';
  const { store, utils, xlsx } = HT;
  const { sortBy, medTimes, rangeStatus } = utils;

  const d = (iso) => (iso ? { date: iso } : '');
  const STATUS = { low: 'Laag', high: 'Hoog', normal: 'Normaal', unknown: '' };

  function sheets() {
    const data = store.data;
    const p = data.profile;
    const medName = Object.fromEntries(data.medications.map((m) => [m.id, m.name]));

    const intake = [];
    for (const [date, day] of Object.entries(data.medLog)) {
      for (const [key, at] of Object.entries(day)) {
        const [id, time] = key.split('|');
        intake.push([d(date), time, medName[id] || '(verwijderd)', new Date(at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })]);
      }
    }

    return [
      {
        name: 'Profiel',
        columns: ['Gegeven', 'Waarde'],
        rows: [
          ['Naam', p.name], ['Geboortedatum', d(p.birthDate)], ['Bloedgroep', p.bloodType], ['Lengte (cm)', p.height],
          ['Allergieën', p.allergies], ['Aandoeningen', p.conditions], ['Voorgeschiedenis', p.history],
          ['Huisarts', p.gp], ['Apotheek', p.pharmacy], ['Specialisten', p.specialists],
          ['Zorgverzekeraar', p.insurer], ['Noodcontact', p.emergency], ['Overig', p.notes],
        ].filter((r) => r[1] != null && r[1] !== ''),
      },
      {
        name: 'Medicatie',
        columns: ['Soort', 'Naam', 'Dosis', 'Vorm', 'Merk', 'Innametijden', 'Aantal per inname', 'Gebruiksaanwijzing', 'Waarvoor', 'Voorgeschreven / geadviseerd door', 'Start', 'Einde', 'Voorraad', 'Apotheek', 'In gebruik', 'Notities'],
        rows: sortBy(data.medications, (m) => (m.kind === 'supplement' ? '1' : '0') + m.name.toLowerCase()).map((m) => [
          m.kind === 'supplement' ? 'Supplement' : 'Medicijn', m.name, m.dose, m.form, m.brand, medTimes(m).join(', ') || 'zo nodig', m.unitsPerDose, m.instructions, m.reason,
          m.prescriber || m.advisedBy, d(m.startDate), d(m.endDate), m.stock, m.pharmacy, m.active !== false, m.notes,
        ]),
      },
      {
        name: 'Innames',
        columns: ['Datum', 'Gepland', 'Medicijn', 'Afgevinkt om'],
        rows: sortBy(intake, (r) => r[0].date + r[1], -1),
      },
      {
        name: 'Dagelijkse check',
        columns: ['Datum', 'Stemming (1-5)', 'Energie (1-5)', 'Pijn (0-10)', 'Vermoeidheid (0-10)', 'Impact vermoeidheid', 'Uitgerust wakker (1-5)', 'Rust / dutjes',
          'Stress (0-10)', 'Angst (0-10)', 'Somberheid (0-10)', 'Concentratie (1-5)', 'Onrust (0-10)', 'Overprikkeld (0-10)', 'Hield me bezig', 'Iets fijns',
          'Libido (1-5)', 'Intimiteit opmerkingen', 'Stappen',
          'Slaap (uur)', 'Slaapkwaliteit (1-5)', 'Bloeddruk boven', 'Bloeddruk onder', 'Hartslag', 'Gewicht (kg)', 'Temperatuur (°C)', 'Bloedsuiker (mmol/L)', 'Saturatie (%)', 'Water (glazen)', 'Klachten', 'Notities'],
        rows: sortBy(data.checkins, 'date', -1).map((c) => [
          d(c.date), c.mood, c.energy, c.pain, c.fatigue, c.fatigueImpact, c.restedWaking, c.restBreaks,
          c.stress, c.anxiety, c.gloom, c.focus, c.restless, c.overstimulated, c.mentalNotes, c.positive, c.libido, c.intimateNotes, c.steps, c.sleepHours, c.sleepQuality, c.systolic, c.diastolic, c.heartRate,
          c.weight, c.temperature, c.glucose, c.oxygen, c.water, c.symptoms, c.notes,
        ]),
      },
      {
        name: 'Zelftests',
        columns: ['Datum', 'Vragenlijst', 'Score', 'Maximum', 'Niveau', ...Array.from({ length: 9 }, (_, i) => `Vraag ${i + 1} (0-3)`)],
        rows: sortBy(data.questionnaires, 'date', -1).map((r) => {
          const q = HT.questionnaires.QUESTIONNAIRES[r.type];
          return [d(r.date), q ? q.short : r.type, r.score, q ? q.max : '', r.level, ...(r.answers || [])];
        }),
      },
      {
        name: 'Pijndagboek',
        columns: ['Datum', 'Tijd', 'Pijn (0-10)', 'Waar', 'Soort', 'Hoe lang', 'Oorzaak', 'Gedaan / genomen', 'Hielp', 'Notities'],
        rows: sortBy(data.pain, (e) => e.date + (e.time || ''), -1).map((e) => [
          d(e.date), e.time, e.intensity, e.location, e.type, e.duration, e.trigger, e.relief, e.helped, e.notes,
        ]),
      },
      {
        name: 'Slaap',
        columns: ['Nacht naar', 'Naar bed', 'Opgestaan', 'Inslapen (min)', 'Keer wakker', 'Uren geslapen', 'Dutje (min)', 'Kwaliteit (1-5)', 'Uitgerust (1-5)', 'Wakker door', 'Hulpmiddel', 'Scherm voor bed', 'Notities', 'Wakker \'s nachts (min)', 'Momenten wakker', 'Gemeten met knoppen',
          'Gevoel bij opstaan (1-5)', 'Wakker geworden', 'Gesnoozed (×)', 'Echt wakker', 'Eerste wat je deed', 'Klachten bij opstaan'],
        rows: sortBy(data.checkins.filter(HT.views.sleep.hasSleep), 'date', -1).map((c) => [
          d(c.date), c.bedtime, c.wakeTime, c.fallAsleep, c.wakeUps, c.sleepHours, c.nap, c.sleepQuality, c.restedWaking, c.sleepDisturbance, c.sleepAid, c.screenBeforeBed, c.dreams, c.nightAwakeMin,
          (c.nightWakes || []).map((w) => `${w.time} (${w.minutes} min${w.reasons && w.reasons.length ? `, ${w.reasons.join('/').toLowerCase()}` : ''})`).join('; '), c.sleepTracked ? 'ja' : '',
          c.wakeFeeling, c.wakeMethod, c.snoozeCount, c.awakeAfter, c.morningStart, c.morningComplaints,
        ]),
      },
      {
        name: 'Voeding',
        columns: ['Datum', 'Tijd', 'Maaltijd', 'Wat', 'Hoeveelheid', 'kcal', 'Waar / met wie', 'Klachten', 'Notities'],
        rows: sortBy(data.food, (e) => e.date + (e.time || ''), -1).map((e) => [d(e.date), e.time, e.meal, e.what, e.amount, e.kcal, e.place, e.complaints, e.notes]),
      },
      {
        name: 'Voeding per dag',
        columns: ['Datum', 'Groente (g)', 'Fruit (stuks)', 'Drinken (glazen)', 'Eetlust (1-5)'],
        rows: sortBy(data.checkins.filter((c) => ['veg', 'fruit', 'water', 'appetite'].some((k) => c[k] != null)), 'date', -1).map((c) => [d(c.date), c.veg, c.fruit, c.water, c.appetite]),
      },
      {
        name: 'Energie',
        columns: ['Datum', 'Tijd', 'Energie (1-5)', 'Omschrijving'],
        rows: sortBy(data.checkins.filter((c) => Array.isArray(c.energyLog) && c.energyLog.length), 'date', -1)
          .flatMap((c) => sortBy(c.energyLog, 'time').map((x) => [d(c.date), x.time, x.level, (HT.energy.LEVELS.find((l) => l.value === x.level) || {}).label])),
      },
      {
        name: 'Drinken',
        columns: ['Datum', 'Tijd', 'Wat', 'ml'],
        rows: sortBy(data.checkins.filter((c) => Array.isArray(c.drinks) && c.drinks.length), 'date', -1)
          .flatMap((c) => c.drinks.map((x) => [d(c.date), x.time, x.type, x.ml])),
      },
      {
        name: 'Drinken per dag',
        columns: ['Datum', 'Totaal (ml)', 'Kleur urine'],
        rows: sortBy(data.checkins.filter((c) => utils.fluidMl(c) != null || c.urineColor), 'date', -1).map((c) => [d(c.date), utils.fluidMl(c), c.urineColor]),
      },
      {
        name: 'Taken',
        columns: ['Taak', 'Eerste stap', 'Stappen', 'Energie', 'Minuten', 'Deadline', 'Herhalen', 'Uitgesteld (×)', 'Klaar op', 'Waarom belangrijk'],
        rows: data.tasks.map((t) => [t.title, t.firstStep, (t.steps || []).map((s) => `${s.done ? '✓' : '☐'} ${s.text}`).join('; '), t.energy, t.minutes, d(t.deadline), t.repeat, t.postponed, d(t.doneAt || t.lastDone), t.why]),
      },
      {
        name: 'Focus',
        columns: ['Datum', 'Start', 'Gepland (min)', 'Gedaan (min)', 'Afgemaakt', 'Keer afgeleid', 'Taak'],
        rows: sortBy(data.focus, (s) => s.date + (s.start || ''), -1).map((s) => [d(s.date), s.start, s.planned, s.actual, Boolean(s.completed), s.distractions, (data.tasks.find((t) => t.id === s.taskId) || {}).title]),
      },
      {
        name: 'Uitstel',
        columns: ['Datum', 'Tijd', 'Taak', 'Redenen', 'Toelichting'],
        rows: sortBy(data.procrastination, (e) => e.date + (e.time || ''), -1).map((e) => [d(e.date), e.time, e.taskTitle, (e.reasons || []).map((k) => (HT.focus.REASONS.find((r) => r.key === k) || {}).label).join(', '), e.note]),
      },
      {
        name: 'Weekmenu',
        columns: ['Datum', 'Maaltijd', 'Gerecht', 'Koken / restje', 'Porties'],
        rows: Object.values(data.mealPlans || {}).flatMap((plan) => plan.days.flatMap((day) => HT.recipes.MEALS.filter((m) => day[m]).map((m) => {
          const x = day[m];
          const r = x.recipe && [...HT.recipes.RECIPES, ...data.recipes].find((y) => y.id === x.recipe);
          return [d(day.date), HT.recipes.MEAL_LABEL[m], r ? r.name : x.text || '', x.leftoverOf ? 'restje' : x.cook ? 'koken' : '', x.portions || ''];
        }))).sort((a, b) => (a[0].date < b[0].date ? 1 : -1)),
      },
      {
        name: 'Middelen',
        columns: ['Datum', 'Alcohol (glazen)', 'Wat', 'Sigaretten', 'Anders gerookt', 'Koffie (koppen)', 'Laatste koffie', 'Drugs', 'Trek (0-10)', 'Notities'],
        rows: sortBy(data.checkins.filter(HT.views.substances.hasSubstance), 'date', -1).map((c) => [
          d(c.date), c.alcohol, c.alcoholWhat, c.cigarettes, c.otherSmoking, c.coffee, c.lastCoffee,
          (c.drugs || []).map((x) => x.name + (x.amount ? ` (${x.amount})` : '')).join('; '), c.craving, c.substanceNotes,
        ]),
      },
      {
        name: 'Omgeving',
        columns: ['Datum', 'Werk', 'Uren', 'Werkdruk (0-10)', 'Buiten (min)', 'Weer', 'Feest / uitgaan', 'Mensen gezien', 'Onderweg', 'Veel alleen', 'Schermtijd (u)', 'Druk / lawaai', 'Bijzonderheden'],
        rows: sortBy(data.checkins.filter(HT.views.environment.hasEnv), 'date', -1).map((c) => [
          d(c.date), c.work, c.workHours, c.workLoad, c.outsideMinutes, c.weather, Boolean(c.party), Boolean(c.social), Boolean(c.travel), Boolean(c.alone), c.screenTime, Boolean(c.busyPlace), c.envNotes,
        ]),
      },
      {
        name: 'Sport',
        columns: ['Datum', 'Tijd', 'Soort', 'Activiteit', 'Duur (min)', 'Inspanning', 'Afstand (km)', 'Tempo (min/km)', 'Gem. hartslag', 'Spiergroepen', 'Oefeningen', 'Gevoel erna (1-5)', 'Klachten', 'Notities'],
        rows: sortBy(data.sport, (e) => e.date + (e.time || ''), -1).map((e) => {
          const T = HT.training;
          const kind = T.kindOf(e);
          const p = T.pace(e);
          return [
            d(e.date), e.time, kind, e.activity, e.duration, e.intensity, e.distance, p ? Math.round(p * 100) / 100 : '', e.heartRate,
            kind === 'Krachttraining' ? T.musclesOf(e).join(', ') : '',
            (e.exercises || []).map((x) => `${x.name} ${x.sets || ''}×${x.reps || ''}${x.weight ? ` @ ${x.weight} kg` : ''}`).join('; '),
            e.feeling, e.complaints, e.notes,
          ];
        }),
      },
      {
        name: 'Stoelgang',
        columns: ['Datum', 'Tijd', 'Bristol-type (1-7)', 'Omschrijving', 'Hoe ging het', 'Kleur', 'Aandrang', 'Bloed', 'Slijm', 'Notities'],
        rows: sortBy(data.bowel, (e) => e.date + (e.time || ''), -1).map((e) => [
          d(e.date), e.time, e.bristol, HT.views.bowel.BRISTOL_SHORT[e.bristol], e.effort, e.color, Boolean(e.urgency), Boolean(e.blood), Boolean(e.mucus), e.notes,
        ]),
      },
      {
        name: 'Bloedonderzoeken',
        columns: ['Datum', 'Bepaling', 'Uitslag', 'Eenheid', 'Ref. min', 'Ref. max', 'Beoordeling', 'Laboratorium', 'Aangevraagd door', 'Nuchter', 'Toelichting'],
        rows: sortBy(data.labs, 'date', -1).flatMap((lab) => (lab.results || []).map((r) => [
          d(lab.date), r.name, r.value, r.unit, r.low, r.high, STATUS[rangeStatus(r.value, r.low, r.high)],
          lab.lab, lab.orderedBy, Boolean(lab.fasting), lab.notes,
        ])),
      },
      {
        name: 'Voorschriften',
        columns: ['Datum', 'Wat', 'Soort', 'Status', 'Dosering', 'Voorgeschreven door', 'Geldig tot', 'Herhalingen', 'Hoeveelheid', 'Apotheek', 'Notities'],
        rows: sortBy(data.prescriptions, 'date', -1).map((r) => [
          d(r.date), r.title, r.kind, r.status, r.dosage, r.prescriber, d(r.validUntil), r.repeats, r.quantity, r.pharmacy, r.notes,
        ]),
      },
      {
        name: 'Bezoeken',
        columns: ['Datum', 'Tijd', 'Soort', 'Afdeling', 'Arts', 'Locatie', 'Reden / vragen', 'Uitkomst', 'Vervolg', 'Notities'],
        rows: sortBy(data.visits, (v) => v.date + (v.time || ''), -1).map((v) => [
          d(v.date), v.time, v.type, v.specialty, v.doctor, v.location, v.reason, v.outcome, v.followUp, v.notes,
        ]),
      },
      {
        name: 'Vaccinaties',
        columns: ['Datum', 'Vaccinatie', 'Prik', 'Vaccin / merk', 'Batchnummer', 'Gegeven door', 'Locatie', 'Volgende prik', 'Reactie', 'Notities'],
        rows: sortBy(data.vaccinations, 'date', -1).map((v) => [
          d(v.date), v.name, v.doseNumber, v.product, v.batch, v.givenBy, v.location, d(v.nextDue), v.reaction, v.notes,
        ]),
      },
    ];
  }

  function toExcel() {
    HT.ui.download(`gezondheid-${utils.todayISO()}.xlsx`, xlsx.workbook(sheets()),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  HT.exporter = { sheets, toExcel };
})(window.HT);
