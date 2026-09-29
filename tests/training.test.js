const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../js/utils.js');
const tr = require('../js/training.js');

const TODAY = '2026-09-29';
const day = (i) => u.addDays(TODAY, -i);

test('kindOf raadt de soort bij oude activiteiten', () => {
  assert.equal(tr.kindOf({ activity: 'Hardlopen' }), 'Hardlopen');
  assert.equal(tr.kindOf({ activity: 'Stevig wandelen' }), 'Wandelen');
  assert.equal(tr.kindOf({ activity: 'Fitness / krachttraining' }), 'Krachttraining');
  assert.equal(tr.kindOf({ activity: 'Tennis / padel' }), 'Racketsport');
  assert.equal(tr.kindOf({ activity: 'Iets' }), 'Anders');
  assert.equal(tr.kindOf({ activity: 'Hardlopen', kind: 'Wandelen' }), 'Wandelen');
});

test('musclesOf combineert aangevinkte spiergroepen en oefeningen', () => {
  const m = tr.musclesOf({ muscles: ['Buik / core'], exercises: [{ name: 'squat' }, { name: 'Bench press' }, { name: 'Onbekend' }] });
  assert.deepEqual(m.sort(), ['Billen', 'Borst', 'Bovenbenen (voor)', 'Buik / core', 'Schouders', 'Triceps'].sort());
});

test('krachttraining per week en status per spiergroep', () => {
  const sport = [
    { date: day(1), kind: 'Krachttraining', exercises: [{ name: 'Squat' }] },
    { date: day(1), kind: 'Krachttraining', muscles: ['Rug'] },
    { date: day(4), kind: 'Krachttraining', muscles: ['Borst'] },
    { date: day(10), kind: 'Krachttraining', muscles: ['Rug'] },
    { date: day(2), kind: 'Hardlopen', distance: 5, duration: 30 },
  ];
  assert.equal(tr.strengthDays(sport, TODAY), 2);
  const s = tr.muscleStatus(sport, TODAY);
  assert.deepEqual(s['Rug'], { last: 1, count14: 2 });
  assert.equal(s['Borst'].last, 4);
  assert.equal(s['Kuiten'].last, null);
});

test('vooruitgang per oefening', () => {
  const sport = [
    { date: day(14), kind: 'Krachttraining', exercises: [{ name: 'Squat', sets: 3, reps: 8, weight: 60 }] },
    { date: day(7), kind: 'Krachttraining', exercises: [{ name: 'squat', sets: 3, reps: 8, weight: 65 }, { name: 'Squat', sets: 1, reps: 5, weight: 70 }] },
  ];
  const [sq] = tr.exerciseProgress(sport);
  assert.equal(sq.sessions.length, 2);
  assert.equal(sq.sessions[1].maxWeight, 70);
  assert.equal(sq.sessions[1].volume, 3 * 8 * 65 + 5 * 70);
  assert.equal(sq.sessions[0].best1RM, 76);
});

test('tempo en conditie', () => {
  assert.equal(tr.formatPace(5.5), '5:30 /km');
  assert.equal(tr.formatPace(4.999), '5:00 /km');
  assert.equal(tr.formatPace(null), '–');
  const sport = [
    { date: day(40), kind: 'Hardlopen', distance: 5, duration: 32.5 },
    { date: day(35), kind: 'Hardlopen', distance: 5, duration: 32 },
    { date: day(10), kind: 'Hardlopen', distance: 6, duration: 36 },
    { date: day(1), kind: 'Hardlopen', distance: 8, duration: 47 },
    { date: day(0), kind: 'Wandelen', distance: 4, duration: 50 },
  ];
  const c = tr.cardio(sport, TODAY);
  assert.equal(c.runs.length, 4);
  assert.equal(c.longest.distance, 8);
  assert.ok(c.paceRecent < c.pacePrevious, 'sneller geworden');
  assert.equal(c.kmThisWeek, 8); // maandag 28 sep t/m vandaag
});

test('rusthartslag trend', () => {
  const checkins = [];
  for (let i = 0; i < 28; i++) checkins.push({ date: day(i), heartRate: i < 14 ? 62 : 68 });
  assert.deepEqual(tr.restingHeartRate(checkins, TODAY), { recent: 62, previous: 68 });
});
