const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../js/utils.js');
const en = require('../js/energy.js');

const TODAY = '2026-09-28';
const empty = () => ({ checkins: [], sport: [], labs: [], food: [], pain: [], settings: {} });
const day = (i) => u.addDays(TODAY, -i);

test('dagscore combineert energie, energiemomenten en vermoeidheid', () => {
  assert.equal(en.dayScore({ energy: 5, fatigue: 0 }), 100);
  assert.equal(en.dayScore({ energy: 1, fatigue: 10 }), 0);
  assert.equal(en.dayScore({ energyLog: [{ level: 2 }, { level: 4 }], energy: 5 }), 50); // momenten gaan voor
  assert.equal(en.dayScore({ fatigue: 4 }), 60);
  assert.equal(en.dayScore({}), null);
});

test('partOfDay', () => {
  assert.equal(en.partOfDay('09:30'), 'ochtend');
  assert.equal(en.partOfDay('13:00'), 'middag');
  assert.equal(en.partOfDay('20:15'), 'avond');
});

test('analyse vindt dat korte nachten en alcohol energie kosten, bewegen energie geeft', () => {
  const d = empty();
  for (let i = 0; i < 20; i++) {
    const shortNight = i % 3 === 0;
    const drankBefore = i % 4 === 1; // alcohol op dag i+1 = de avond voor dag i
    const moved = i % 2 === 0;
    let e = 4;
    if (shortNight) e -= 2;
    if (drankBefore) e -= 1;
    if (moved) e += 1;
    d.checkins.push({ date: day(i), sleepHours: shortNight ? 5.5 : 8, energy: Math.max(1, Math.min(5, e)), alcohol: i % 4 === 2 ? 3 : 0 });
    if (moved) d.sport.push({ date: day(i), duration: 30 });
  }
  const a = en.analyze(d, TODAY);
  const byKey = Object.fromEntries(a.factors.map((f) => [f.key, f]));
  assert.ok(byKey.sleepShort.effect <= -30, `slaap ${byKey.sleepShort.effect}`);
  assert.ok(byKey.moved.effect > 0, `bewegen ${byKey.moved.effect}`);
  assert.ok(byKey.alcoholYesterday.effect < 0, `alcohol ${byKey.alcoholYesterday.effect}`);
  assert.equal(a.factors[0].key, 'sleepShort', 'grootste effect eerst');
  assert.match(en.describe(byKey.sleepShort), /minder energie/);

  const today = en.explainDay(d, TODAY, a); // dag 0: korte nacht + bewogen
  assert.deepEqual(today.map((f) => f.key).sort(), ['moved', 'sleepShort']);
});

test('te weinig dagen per groep geeft geen factor', () => {
  const d = empty();
  d.checkins = [0, 1, 2, 3].map((i) => ({ date: day(i), energy: 3, sleepHours: i < 2 ? 6 : 8 }));
  assert.equal(en.analyze(d, TODAY).factors.length, 0);
});

test('afwijkende bloedwaarden die moeheid kunnen verklaren', () => {
  const d = empty();
  d.labs = [{ date: day(30), results: [
    { name: 'Hemoglobine (Hb)', value: 7.4, low: 8.5, high: 11 },
    { name: 'Ferritine', value: 150, low: 20, high: 300 },
    { name: 'TSH', value: 6.2, low: 0.4, high: 4 },
    { name: 'LDL-cholesterol', value: 4.2, high: 3 },
  ] }];
  const h = en.labHints(d, TODAY);
  assert.deepEqual(h.map((x) => x.name), ['Hemoglobine (Hb)', 'TSH']);
});

test('langdurige vermoeidheid', () => {
  const d = empty();
  d.checkins = Array.from({ length: 14 }, (_, i) => ({ date: day(i), fatigue: 7 }));
  assert.deepEqual(en.persistentFatigue(d, TODAY), { avg: 7, days: 14 });
  d.checkins = d.checkins.slice(0, 5);
  assert.equal(en.persistentFatigue(d, TODAY), null);
});
