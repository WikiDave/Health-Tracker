const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../js/utils.js');
const I = require('../js/insights.js');

const TODAY = '2026-09-30';
const day = (i) => u.addDays(TODAY, -i);

function sample() {
  const data = { checkins: [], sport: [], pain: [], bowel: [], food: [], focus: [], tasks: [], procrastination: [], medications: [], medLog: {}, settings: {} };
  for (let i = 40; i >= 0; i--) {
    const d = day(i);
    const drankYesterday = (i + 1) % 5 === 0; // alcohol op dag i+1
    const moved = i % 2 === 0;
    const short = i % 3 === 0;
    let mood = 3 + (moved ? 1 : 0) - (drankYesterday ? 1 : 0);
    data.checkins.push({ date: d, completed: true, mood: Math.max(1, Math.min(5, mood)), sleepHours: short ? 5.5 : 8, sleepQuality: short ? 2 : 4,
      fatigue: short ? 7 : 3, energy: short ? 2 : 4, alcohol: i % 5 === 0 ? 3 : 0, stress: 4, pain: 2 });
    if (moved) data.sport.push({ date: d, kind: 'Hardlopen', duration: 30 });
  }
  return data;
}

test('tabel per dag met afgeleide waarden en de dag ervoor', () => {
  const rows = I.table(sample());
  const r = rows.find((x) => x.date === day(0));
  assert.equal(r.sportMin, 30);
  assert.equal(r.strength, false);
  assert.equal(typeof r.energyScore, 'number');
  const r1 = rows.find((x) => x.date === day(4));
  assert.equal(r1.prev_alcohol, 3); // dag 5 had alcohol
  assert.equal(rows.find((x) => x.date === day(1)).sportMin, 0);
});

test('pearson', () => {
  assert.equal(Math.round(I.pearson([1, 2, 3, 4], [2, 4, 6, 8]) * 100) / 100, 1);
  assert.equal(Math.round(I.pearson([1, 2, 3, 4], [8, 6, 4, 2]) * 100) / 100, -1);
});

test('vindt de ingebouwde verbanden in de juiste richting', () => {
  const res = I.relate(sample());
  const find = (x, y) => res.find((r) => r.x === x && r.y === y) || res.find((r) => r.x === y && r.y === x);
  const sleepEnergy = find('sleepHours', 'energyScore');
  assert.ok(sleepEnergy && sleepEnergy.r > 0.5, 'slaap → energie');
  const moveMood = find('sportMin', 'mood');
  assert.ok(moveMood && moveMood.diff > 0 && moveMood.good === true, 'bewegen → betere stemming');
  const alcMood = find('prev_alcohol', 'mood');
  assert.ok(alcMood && alcMood.diff < 0 && alcMood.good === false, 'alcohol gisteren → lagere stemming');
  assert.match(I.describe(alcMood), /alcohol \(de dag ervoor\)/);
  assert.match(I.describe(moveMood), /stemming gemiddeld .* hoger/);
  // geen triviale paren binnen dezelfde groep
  assert.ok(!res.some((r) => (r.x === 'fatigue' && r.y === 'energyScore') || (r.x === 'energyScore' && r.y === 'fatigue')));
  // geen dubbele A→B en B→A
  const keys = res.map((r) => [r.x, r.y].sort().join('|'));
  assert.equal(new Set(keys).size, keys.length);
});

test('filteren op uitkomst en betrokken variabelen', () => {
  const data = sample();
  assert.ok(I.relate(data, { outcome: 'mood' }).every((r) => r.y === 'mood'));
  assert.ok(I.relate(data, { involving: ['alcohol'] }).every((r) => [r.x, r.y].includes('alcohol') || r.x === 'prev_alcohol'));
});

test('te weinig dagen: geen verbanden', () => {
  const d = sample();
  d.checkins = d.checkins.slice(0, 6);
  d.sport = [];
  assert.equal(I.relate(d).length, 0);
});

test('dag vergeleken met normaal', () => {
  const d = sample();
  d.checkins.find((c) => c.date === TODAY).stress = 9;
  const diff = I.dayVsNormal(d, TODAY);
  const s = diff.find((x) => x.key === 'stress');
  assert.ok(s && s.delta > 4 && s.good === false);
});

test('leesbare zinnen voor schalen, hoeveelheden en ja/nee', () => {
  const base = { threshold: 6, loMax: 5 };
  assert.equal(I.factorText({ ...base, x: 'stress' }).with, 'dat je stress 6/10 of hoger was');
  assert.equal(I.factorText({ ...base, x: 'prev_stress' }).with, 'dat je stress de dag ervoor 6/10 of hoger was');
  assert.equal(I.factorText({ x: 'alcohol', threshold: 2, loMax: 2 }).with, 'met meer dan 2 glazen alcohol');
  assert.equal(I.factorText({ x: 'sleepHours', threshold: 7.5, loMax: 7 }).with, 'met 7,5 uur of meer slaap');
  assert.equal(I.factorText({ x: 'prev_alcohol', threshold: 0, loMax: 0 }).with, 'met alcohol (de dag ervoor)');
  assert.equal(I.factorText({ x: 'party' }).with, 'met feest / uitgaan');
  assert.equal(I.valueText('coffee', 4), 'Koffie: 4 koppen');
  assert.equal(I.valueText('snoozed', true), 'Snoozen');
});
