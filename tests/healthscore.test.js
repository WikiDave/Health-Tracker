const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../js/utils.js');
const hs = require('../js/healthscore.js');

const TODAY = '2026-09-28';
const empty = () => ({ checkins: [], sport: [], labs: [], medications: [], medLog: {}, questionnaires: [], bowel: [], pain: [], profile: {}, settings: {} });

function days(n, fn) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(Object.assign({ date: u.addDays(TODAY, -i) }, fn(i)));
  return out;
}

function healthy() {
  const d = empty();
  d.checkins = days(14, () => ({ sleepHours: 7.5, sleepQuality: 4, stress: 2, anxiety: 1, gloom: 1, mood: 4, fatigue: 2, energy: 4, pain: 0,
    veg: 250, fruit: 2, fluidMl: 2000, drinks: [{ ml: 2000 }], alcohol: 0, cigarettes: 0, systolic: 115, diastolic: 75, weight: 70 }));
  d.sport = days(7, () => ({ duration: 30, intensity: 'Matig' }));
  d.profile.height = 175;
  return d;
}

function unhealthy() {
  const d = empty();
  d.checkins = days(14, () => ({ sleepHours: 5, sleepQuality: 2, stress: 8, anxiety: 7, gloom: 7, mood: 2, fatigue: 8, energy: 2, pain: 6,
    veg: 50, fruit: 0, drinks: [{ ml: 800 }], alcohol: 4, cigarettes: 15, systolic: 150, diastolic: 95, weight: 100 }));
  d.sport = [{ date: u.addDays(TODAY, -20), duration: 20, intensity: 'Licht' }];
  d.profile.height = 175;
  return d;
}

test('te weinig gegevens geeft geen score', () => {
  const r = hs.compute(empty(), TODAY);
  assert.equal(r.score, null);
  assert.equal(r.missing.length, 8);
});

test('gezond leefpatroon scoort hoog met vooral goede punten', () => {
  const r = hs.compute(healthy(), TODAY);
  assert.ok(r.score >= 90, `score ${r.score}`);
  assert.equal(r.label, 'Goed');
  assert.equal(r.confidence, 'hoog');
  assert.equal(r.bad.length, 0, JSON.stringify(r.bad.map((b) => b.text)));
  assert.ok(r.good.length >= 8);
});

test('ongezond leefpatroon scoort laag met uitleg en tips', () => {
  const r = hs.compute(unhealthy(), TODAY);
  assert.ok(r.score < 40, `score ${r.score}`);
  assert.equal(r.label, 'Aandacht nodig');
  const text = r.bad.map((b) => b.text).join(' ');
  for (const w of ['5 uur', 'sigaretten', 'bloeddruk', 'BMI', 'groente', 'bewoog 0']) assert.ok(text.includes(w), `mist "${w}" in: ${text}`);
  assert.ok(r.tips.length >= 4);
});

test('onderdelen zonder gegevens tellen niet mee', () => {
  const d = empty();
  d.checkins = days(7, () => ({ sleepHours: 8, sleepQuality: 5, fatigue: 0, energy: 5 }));
  const r = hs.compute(d, TODAY);
  assert.equal(r.score, 100);
  assert.deepEqual(r.domains.filter((x) => x.score != null).map((x) => x.key), ['sleep', 'physical']);
  assert.equal(r.confidence, 'laag');
});

test('vochtbeperking: onder het maximum is goed', () => {
  const d = empty();
  d.settings = { fluidMode: 'max', fluidGoal: 1500 };
  d.checkins = days(7, () => ({ drinks: [{ ml: 1200 }], sleepHours: 8 }));
  const n = hs.compute(d, TODAY).domains.find((x) => x.key === 'nutrition');
  assert.equal(n.score, 100);
});

test('rode vlaggen worden altijd apart gemeld', () => {
  const d = healthy();
  d.bowel = [{ date: TODAY, bristol: 4, blood: true }];
  d.checkins[0].systolic = 185;
  d.questionnaires = [{ type: 'phq9', date: TODAY, answers: [0, 0, 0, 0, 0, 0, 0, 0, 1], score: 1, level: 'Minimaal' }];
  const r = hs.compute(d, TODAY);
  assert.equal(r.flags.length, 3);
  assert.ok(r.score >= 80, 'vlaggen veranderen de score niet stilletjes');
});

test('labelFor grenzen', () => {
  assert.equal(hs.labelFor(80).label, 'Goed');
  assert.equal(hs.labelFor(79).label, 'Redelijk');
  assert.equal(hs.labelFor(40).label, 'Matig');
  assert.equal(hs.labelFor(39).label, 'Aandacht nodig');
});

test('een onderdeel onder de 80 legt altijd uit waarom', () => {
  const d = empty();
  d.checkins = days(7, () => ({ stress: 4, anxiety: 5, gloom: 4, mood: 3, fatigue: 4, energy: 3, pain: 3 }));
  const r = hs.compute(d, TODAY);
  for (const dom of r.domains.filter((x) => x.score != null && x.score < 80)) {
    assert.ok(dom.bad.length > 0, `${dom.label} (${dom.score}) heeft geen uitleg`);
  }
});

test('fruit: enkelvoud bij 1 stuk', () => {
  const d = empty();
  d.checkins = days(7, () => ({ fruit: 1, sleepHours: 8 }));
  const n = hs.compute(d, TODAY).domains.find((x) => x.key === 'nutrition');
  assert.match(n.bad[0], /1 stuk fruit/);
});

test('duidelijke aandachtspunten staan voor milde opmerkingen', () => {
  const d = empty();
  d.checkins = days(7, () => ({ stress: 4, anxiety: 4, mood: 3, systolic: 135, diastolic: 85 }));
  const r = hs.compute(d, TODAY);
  assert.match(r.bad[0].text, /bloeddruk/);
  assert.ok(r.bad.slice(1).every((b) => b.mild));
});
