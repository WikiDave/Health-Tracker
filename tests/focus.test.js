const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../js/utils.js');
const F = require('../js/focus.js');

const TODAY = '2026-09-30'; // woensdag
const day = (i) => u.addDays(TODAY, i);

test('herhalende taken', () => {
  assert.equal(F.isOpenToday({ repeat: 'dagelijks', lastDone: day(-1) }, TODAY), true);
  assert.equal(F.isOpenToday({ repeat: 'dagelijks', lastDone: TODAY }, TODAY), false);
  assert.equal(F.isOpenToday({ repeat: 'weekdagen' }, '2026-10-03'), false); // zaterdag
  assert.equal(F.isOpenToday({ repeat: 'weekdagen' }, TODAY), true);
  assert.equal(F.isOpenToday({ repeat: 'wekelijks', lastDone: day(-3) }, TODAY), false);
  assert.equal(F.isOpenToday({ repeat: 'wekelijks', lastDone: day(-7) }, TODAY), true);
  assert.equal(F.isOpenToday({ done: true }, TODAY), false);
});

test('Wat nu? kiest wat bij je energie past', () => {
  const tasks = [
    { id: 'belasting', title: 'Belastingaangifte', energy: 'hoog', minutes: 120 },
    { id: 'mail', title: 'Mail beantwoorden', energy: 'laag', minutes: 10 },
    { id: 'was', title: 'Was ophangen', energy: 'midden', minutes: 15 },
  ];
  assert.equal(F.pickNext(tasks, { today: TODAY, energy: 1 }).task.id, 'mail');
  assert.match(F.pickNext(tasks, { today: TODAY, energy: 1 }).reason, /energie is laag/);
  assert.equal(F.pickNext(tasks, { today: TODAY, energy: 5 }).task.id, 'belasting');
  assert.equal(F.pickNext(tasks, { today: TODAY, energy: 1, skip: ['mail'] }).task.id, 'was');
});

test('deadline vandaag gaat voor', () => {
  const tasks = [
    { id: 'a', title: 'Iets makkelijks', energy: 'laag', minutes: 5 },
    { id: 'b', title: 'Formulier inleveren', energy: 'hoog', minutes: 60, deadline: TODAY },
  ];
  const r = F.pickNext(tasks, { today: TODAY, energy: 2 });
  assert.equal(r.task.id, 'b');
  assert.match(r.reason, /vandaag af/);
  assert.equal(F.pickNext([], { today: TODAY }), null);
});

test('eerste stap en redenen', () => {
  assert.equal(F.firstStep({ firstStep: 'Laptop openen', steps: [{ text: 'A', done: true }, { text: 'B' }] }), 'B');
  assert.equal(F.firstStep({ firstStep: 'Laptop openen' }), 'Laptop openen');
  const stats = F.reasonStats([{ date: TODAY, reasons: ['groot', 'saai'] }, { date: TODAY, reasons: ['groot'] }, { date: day(-40), reasons: ['moe'] }], day(-30));
  assert.deepEqual(stats.map((r) => [r.key, r.count]), [['groot', 2], ['saai', 1]]);
  assert.ok(stats[0].tip.length > 20);
});

test('focus-statistieken', () => {
  const s = [
    { date: TODAY, start: '09:10', actual: 25, completed: true, distractions: 2 },
    { date: TODAY, start: '14:00', actual: 5, completed: false },
    { date: day(-2), start: '10:00', actual: 25, completed: true },
    { date: day(-3), start: '09:30', actual: 25, completed: true },
    { date: day(-10), start: '20:00', actual: 25, completed: true },
  ];
  const f = F.focusStats(s, TODAY);
  assert.equal(f.today, 30);
  assert.equal(f.week, 80);
  assert.equal(f.completedWeek, 3);
  assert.equal(f.distractionsWeek, 2);
  assert.equal(f.bestPart, 'ochtend');
});

test('ADHD-medicatie en concentratie', () => {
  const meds = [{ id: 'm1', name: 'Methylfenidaat 10 mg' }, { id: 'm2', name: 'Vitamine D' }];
  const checkins = [];
  const log = {};
  for (let i = 0; i < 8; i++) {
    const d = day(-i);
    const taken = i % 2 === 0;
    checkins.push({ date: d, focus: taken ? 4 : 2 });
    if (taken) log[d] = { 'm1|08:00': 't' };
  }
  const e = F.adhdMedEffect(checkins, meds, log);
  assert.deepEqual(e, { meds: ['Methylfenidaat 10 mg'], withIt: 4, without: 2 });
  assert.equal(F.adhdMedEffect(checkins, [meds[1]], log), null);
});
