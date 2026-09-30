const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/backup.js');

const sample = () => ({
  version: 1, profile: { name: 'Dave', allergies: '' }, medLog: { '2026-09-01': { 'm1|08:00': true } }, settings: { a: 1 }, mealPlans: {},
  medications: [{ id: 'm1', name: 'Metformine' }],
  checkins: [{ date: '2026-09-01', mood: 4 }, { date: '2026-09-02', mood: 3, stress: null }],
  sport: [{ id: 's1', date: '2026-08-15', duration: 30 }],
  updatedAt: '2026-09-02T10:00:00.000Z',
});

test('versleutelen en weer openen met het juiste wachtwoord', async () => {
  const text = JSON.stringify(sample());
  const enc = await B.encrypt(text, 'geheim 123');
  assert.ok(B.isEncrypted(enc));
  assert.ok(!enc.includes('Metformine'), 'inhoud is niet leesbaar');
  assert.equal(await B.decrypt(enc, 'geheim 123'), text);
  await assert.rejects(B.decrypt(enc, 'fout'), /Wachtwoord klopt niet/);
  assert.equal(B.isEncrypted(text), false);
});

test('controleren en samenvatten', () => {
  assert.throws(() => B.parse('hallo'), /geen back-up/);
  assert.throws(() => B.parse('{"a":1}'), /geen back-upbestand/);
  assert.throws(() => B.parse('{"version":1,"checkins":{}}'), /beschadigd/);
  const s = B.summarize(B.parse(JSON.stringify(sample())));
  assert.deepEqual(s.counts, { medications: 1, checkins: 2, sport: 1 });
  assert.equal(s.from, '2026-08-15');
  assert.equal(s.to, '2026-09-02');
  assert.match(B.summaryText(s), /2 dagen/);
});

test('status: nooit, op tijd, tijd voor een nieuwe, te lang geleden', () => {
  const now = new Date('2026-09-30T12:00:00Z').getTime();
  assert.equal(B.status({}, { profile: {} }, now).level, 'empty');
  assert.equal(B.status({}, sample(), now).level, 'never');
  assert.equal(B.status({ lastBackup: '2026-09-28T12:00:00Z' }, sample(), now).level, 'ok');
  assert.equal(B.status({ lastBackup: '2026-09-22T12:00:00Z' }, sample(), now).level, 'due');
  assert.equal(B.status({ lastBackup: '2026-09-01T12:00:00Z' }, sample(), now).level, 'overdue');
  assert.equal(B.status({ lastBackup: '2026-09-01T12:00:00Z', backupEvery: 30 }, sample(), now).level, 'ok');
  assert.equal(B.status({ lastBackup: '2026-09-28T12:00:00Z' }, sample(), now).changedSince, false);
});

test('samenvoegen: nieuw erbij, bestaand blijft, lege velden aangevuld', () => {
  const cur = sample();
  const inc = sample();
  inc.medications.push({ id: 'm2', name: 'Vitamine D' });
  inc.checkins = [{ date: '2026-09-02', mood: 1, stress: 5 }, { date: '2026-09-03', mood: 5 }];
  inc.medLog = { '2026-09-01': { 'm1|20:00': true }, '2026-09-03': { 'm1|08:00': true } };
  inc.profile = { name: 'Ander', allergies: 'noten' };
  const { data, added } = B.merge(cur, inc);
  assert.deepEqual(added, { medications: 1, checkins: 1 });
  const d2 = data.checkins.find((c) => c.date === '2026-09-02');
  assert.equal(d2.mood, 3); // bestaande waarde wint
  assert.equal(d2.stress, 5); // lege waarde aangevuld
  assert.equal(data.checkins.length, 3);
  assert.deepEqual(Object.keys(data.medLog['2026-09-01']).sort(), ['m1|08:00', 'm1|20:00']);
  assert.equal(data.profile.name, 'Dave');
  assert.equal(data.profile.allergies, 'noten');
});
