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

test('medsToICS maakt dagelijks terugkerende items met melding', () => {
  const ics = u.medsToICS([
    { id: 'm1', name: 'Metformine', dose: '500 mg', times: ['08:00', '20:00'], startDate: '2026-01-01', endDate: '2026-12-31' },
    { id: 'm2', name: 'Gestopt', times: ['09:00'], active: false },
    { id: 'm3', name: 'Zo nodig', times: [] },
  ], '2026-09-28');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART:20260928T080000/);
  assert.match(ics, /RRULE:FREQ=DAILY;UNTIL=20261231T235959/);
  assert.match(ics, /TRIGGER:PT0M/);
  assert.doesNotMatch(ics, /Gestopt/);
});

test('dueDoses geeft alleen verstreken, niet-genomen innames binnen het venster', () => {
  const meds = [{ id: 'a', times: ['08:00', '12:00', '20:00'] }];
  const log = { '2026-09-28': { 'a|08:00': 't' } };
  assert.deepEqual(u.dueDoses(meds, log, '2026-09-28', '12:30').map((d) => d.time), ['12:00']);
  assert.deepEqual(u.dueDoses(meds, log, '2026-09-28', '07:59').map((d) => d.time), []);
  assert.deepEqual(u.dueDoses(meds, {}, '2026-09-28', '10:30').map((d) => d.time), []); // 08:00 is > 2 uur geleden
});

test('vaccinationsDue negeert vaccinaties die al opnieuw zijn gezet', () => {
  const v = [
    { id: '1', name: 'Griep', date: '2025-10-01', nextDue: '2026-10-01' },
    { id: '2', name: 'Tetanus', date: '2016-01-01', nextDue: '2026-01-01' },
    { id: '3', name: 'tetanus ', date: '2026-02-01', nextDue: '2036-02-01' },
    { id: '4', name: 'COVID-19', date: '2025-09-01', nextDue: '2026-09-01' },
  ];
  const due = u.vaccinationsDue(v, '2026-09-28');
  assert.deepEqual(due.map((d) => [d.vaccination.id, d.status]), [['1', 'soon'], ['4', 'overdue']]);
});

test('adherence telt innames later vandaag nog niet mee', () => {
  const meds = [{ id: 'a', times: ['08:00', '20:00'] }];
  assert.deepEqual(u.adherence(meds, {}, '2026-09-28', '2026-09-28', '12:00'), { planned: 1, taken: 0, pct: 0 });
  const log = { '2026-09-28': { 'a|08:00': 't', 'a|20:00': 't' } };
  assert.deepEqual(u.adherence(meds, log, '2026-09-28', '2026-09-28', '07:00'), { planned: 2, taken: 2, pct: 100 });
});

test('average rekent gemiddelde binnen periode en negeert lege waarden', () => {
  const c = [
    { date: '2026-09-20', fatigue: 8 },
    { date: '2026-09-25', fatigue: 4 },
    { date: '2026-09-26', fatigue: null },
    { date: '2026-09-27', fatigue: 6 },
  ];
  assert.deepEqual(u.average(c, 'fatigue', '2026-09-21', '2026-09-27'), { avg: 5, n: 2 });
  assert.equal(u.average(c, 'stress', '2026-09-01', '2026-09-30'), null);
});
