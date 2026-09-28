const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../js/utils.js');

test('parseNum accepteert Nederlandse komma', () => {
  assert.equal(u.parseNum('5,4'), 5.4);
  assert.equal(u.parseNum(' 7.25 '), 7.25);
  assert.equal(u.parseNum(''), null);
  assert.equal(u.parseNum('abc'), null);
  assert.equal(u.parseNum(0), 0);
});

test('parseTimes normaliseert en sorteert', () => {
  assert.deepEqual(u.parseTimes('20:00, 8:00'), ['08:00', '20:00']);
  assert.deepEqual(u.parseTimes('8 12.30;8:00'), ['08:00', '12:30']);
  assert.deepEqual(u.parseTimes(''), []);
  assert.equal(u.parseTimes('25:00'), null);
  assert.equal(u.parseTimes('ochtend'), null);
});

test('rangeStatus vergelijkt met referentiewaarden', () => {
  assert.equal(u.rangeStatus(7, 8.5, 11), 'low');
  assert.equal(u.rangeStatus('12', 8.5, 11), 'high');
  assert.equal(u.rangeStatus(9, 8.5, 11), 'normal');
  assert.equal(u.rangeStatus(9, null, 10), 'normal');
  assert.equal(u.rangeStatus(9, null, null), 'unknown');
  assert.equal(u.rangeStatus(null, 1, 2), 'unknown');
});

test('datumhulpjes', () => {
  assert.equal(u.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(u.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(u.daysBetween('2026-03-28', '2026-03-30'), 2); // over zomertijd heen
});

test('isMedActiveOn respecteert start, eind en actief', () => {
  const med = { active: true, startDate: '2026-01-10', endDate: '2026-01-20' };
  assert.equal(u.isMedActiveOn(med, '2026-01-09'), false);
  assert.equal(u.isMedActiveOn(med, '2026-01-10'), true);
  assert.equal(u.isMedActiveOn(med, '2026-01-20'), true);
  assert.equal(u.isMedActiveOn(med, '2026-01-21'), false);
  assert.equal(u.isMedActiveOn({ active: false }, '2026-01-15'), false);
});

test('daysOfStockLeft houdt rekening met aantal per inname', () => {
  assert.equal(u.daysOfStockLeft({ stock: 30, times: ['08:00', '20:00'] }), 15);
  assert.equal(u.daysOfStockLeft({ stock: 30, times: ['08:00'], unitsPerDose: 2 }), 15);
  assert.equal(u.daysOfStockLeft({ stock: null, times: ['08:00'] }), null);
  assert.equal(u.daysOfStockLeft({ stock: 10, times: [] }), null);
});

test('adherence telt geplande en genomen innames', () => {
  const meds = [{ id: 'a', times: ['08:00', '20:00'], startDate: '2026-01-02' }];
  const log = { '2026-01-02': { 'a|08:00': 't', 'a|20:00': 't' }, '2026-01-03': { 'a|08:00': 't' } };
  assert.deepEqual(u.adherence(meds, log, '2026-01-01', '2026-01-03'), { planned: 4, taken: 3, pct: 75 });
  assert.equal(u.adherence([], {}, '2026-01-01', '2026-01-03').pct, null);
});

test('prescriptionStatus', () => {
  assert.equal(u.prescriptionStatus({ validUntil: '2026-01-01' }, '2026-01-02'), 'expired');
  assert.equal(u.prescriptionStatus({ validUntil: '2026-01-20' }, '2026-01-02'), 'expiring');
  assert.equal(u.prescriptionStatus({ validUntil: '2026-06-01' }, '2026-01-02'), 'valid');
  assert.equal(u.prescriptionStatus({}, '2026-01-02'), 'unknown');
});

test('visitToICS maakt een geldig agenda-item', () => {
  const ics = u.visitToICS({ id: 'x1', date: '2026-10-05', time: '09:45', type: 'Huisarts', doctor: 'Dr. Jansen', location: 'Dorpsstraat 1, Utrecht' });
  assert.match(ics, /DTSTART:20261005T094500/);
  assert.match(ics, /DTEND:20261005T101500/);
  assert.match(ics, /SUMMARY:Huisarts – Dr. Jansen/);
  assert.match(ics, /LOCATION:Dorpsstraat 1\\, Utrecht/);
  assert.match(u.visitToICS({ id: 'x2', date: '2026-10-05' }), /DTSTART;VALUE=DATE:20261005/);
});

test('escapeHtml', () => {
  assert.equal(u.escapeHtml('<b a="1">&\'</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
  assert.equal(u.escapeHtml(null), '');
});
