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
        columns: ['Naam', 'Dosis', 'Vorm', 'Innametijden', 'Aantal per inname', 'Gebruiksaanwijzing', 'Waarvoor', 'Voorgeschreven door', 'Start', 'Einde', 'Voorraad', 'Apotheek', 'In gebruik', 'Notities'],
        rows: sortBy(data.medications, (m) => m.name.toLowerCase()).map((m) => [
          m.name, m.dose, m.form, medTimes(m).join(', ') || 'zo nodig', m.unitsPerDose, m.instructions, m.reason, m.prescriber,
          d(m.startDate), d(m.endDate), m.stock, m.pharmacy, m.active !== false, m.notes,
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
          'Stress (0-10)', 'Angst (0-10)', 'Somberheid (0-10)', 'Concentratie (1-5)', 'Hield me bezig', 'Iets fijns',
          'Slaap (uur)', 'Slaapkwaliteit (1-5)', 'Bloeddruk boven', 'Bloeddruk onder', 'Hartslag', 'Gewicht (kg)', 'Temperatuur (°C)', 'Bloedsuiker (mmol/L)', 'Saturatie (%)', 'Water (glazen)', 'Klachten', 'Notities'],
        rows: sortBy(data.checkins, 'date', -1).map((c) => [
          d(c.date), c.mood, c.energy, c.pain, c.fatigue, c.fatigueImpact, c.restedWaking, c.restBreaks,
          c.stress, c.anxiety, c.gloom, c.focus, c.mentalNotes, c.positive, c.sleepHours, c.sleepQuality, c.systolic, c.diastolic, c.heartRate,
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
