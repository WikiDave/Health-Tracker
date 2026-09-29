const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/sleeplog.js');

const at = (d, t) => new Date(`${d}T${t}:00`).getTime();

test('slaapwel → goeiemorgen: bedtijd, opstaan en uren', () => {
  const s = S.start(at('2026-09-28', '23:15'));
  const r = S.summarize(s, at('2026-09-29', '07:03'));
  assert.equal(r.date, '2026-09-29');
  assert.equal(r.bedtime, '23:15');
  assert.equal(r.wakeTime, '07:03');
  assert.equal(r.sleepHours, 7.8);
  assert.equal(r.wakeUps, 0);
  assert.equal(r.nap, false);
});

test('😴 even wakker: tweede tik = weer slapen, tijd gaat van de slaap af', () => {
  let s = S.start(at('2026-09-28', '23:00'));
  s = S.toggleWake(s, at('2026-09-29', '03:10'));
  assert.ok(S.openWake(s));
  s = S.setReasons(s, ['Plassen']);
  s = S.toggleWake(s, at('2026-09-29', '03:25'));
  assert.equal(S.openWake(s), null);
  s = S.toggleWake(s, at('2026-09-29', '05:00'));
  s = S.setReasons(s, ['Weet niet']);
  // niet 'weer slapen' getikt: hooguit 30 minuten
  const r = S.summarize(s, at('2026-09-29', '07:00'));
  assert.equal(r.wakeUps, 2);
  assert.deepEqual(r.nightWakes.map((w) => [w.time, w.minutes]), [['03:10', 15], ['05:00', 30]]);
  assert.equal(r.awakeMin, 45);
  assert.equal(r.sleepHours, 7.3);
  assert.deepEqual(r.reasons, ['Plassen']);
});

test('open 😴 vlak voor goeiemorgen telt tot goeiemorgen', () => {
  let s = S.start(at('2026-09-28', '23:00'));
  s = S.toggleWake(s, at('2026-09-29', '06:50'));
  const r = S.summarize(s, at('2026-09-29', '07:00'));
  assert.equal(r.awakeMin, 10);
});

test('dutje overdag en vergeten goeiemorgen', () => {
  const nap = S.summarize(S.start(at('2026-09-29', '14:00')), at('2026-09-29', '14:40'));
  assert.equal(nap.nap, true);
  assert.equal(nap.totalMin, 40);
  const stale = S.summarize(S.start(at('2026-09-28', '23:30')), at('2026-09-29', '20:00'));
  assert.equal(stale.stale, true);
  assert.equal(stale.wakeTime, null);
  assert.equal(stale.sleepHours, null);
  assert.equal(stale.date, '2026-09-29');
});

test('uren uit tijden, inslapen en wakker', () => {
  assert.equal(S.hoursFrom('23:00', '07:00', 20, 40), 7);
  assert.equal(S.hoursFrom('23:00', null), null);
});
