const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/social.js');

const T = '2026-09-29';
const people = [
  { id: 'a', name: 'Sanne', circle: 'binnen', wish: 7, birthday: '1990-10-05' },
  { id: 'b', name: 'Oma', circle: 'midden', wish: 14, birthday: '1940-09-29' },
  { id: 'c', name: 'Kees', circle: 'buiten' },
  { id: 'd', name: 'Nieuw', wish: 30 },
];
const contacts = [
  { id: 1, date: '2026-09-28', people: ['a'], type: 'Afgesproken / bezoek', duration: 120, feel: 2 },
  { id: 2, date: '2026-09-26', people: ['a', 'c'], type: 'Groep / feest', duration: 180, feel: 1 },
  { id: 3, date: '2026-09-25', people: ['c'], type: 'Berichten / appen', feel: -1 },
  { id: 4, date: '2026-09-01', people: ['b'], type: 'Bellen', duration: 20, feel: 1 },
  { id: 5, date: '2026-09-20', people: ['c'], type: 'Werk / school', feel: -2 },
];

test('week: contact, in het echt, dagen en mensen', () => {
  const w = S.weekStats(contacts, [{ date: T, loneliness: 3 }, { date: '2026-09-27', loneliness: 5 }], T);
  assert.equal(w.count, 3);
  assert.equal(w.inPerson, 2);
  assert.equal(w.digital, 1);
  assert.equal(w.daysWithContact, 3);
  assert.equal(w.inPersonDays, 2);
  assert.equal(w.people, 2);
  assert.equal(w.minutes, 300);
  assert.equal(w.loneliness, 4);
});

test('wanneer weer contact: eigen wens per persoon', () => {
  assert.equal(S.personStatus(people[0], contacts, T).due, false);
  const oma = S.personStatus(people[1], contacts, T);
  assert.equal(oma.daysSince, 28);
  assert.equal(oma.due, true);
  assert.equal(oma.overdueBy, 14);
  assert.equal(S.personStatus(people[2], contacts, T).due, false); // geen wens
  const due = S.dueList(people, contacts, T).map((x) => x.person.name);
  assert.deepEqual(due, ['Nieuw', 'Oma']); // nooit contact eerst
});

test('verjaardagen: vandaag en binnenkort, met leeftijd', () => {
  const b = S.upcomingBirthdays(people, T, 14);
  assert.deepEqual(b.map((x) => [x.person.name, x.days, x.age]), [['Oma', 0, 86], ['Sanne', 6, 36]]);
});

test('wie geeft energie', () => {
  const e = S.energyByPerson(people, contacts);
  assert.deepEqual(e.map((x) => x.person.name), ['Sanne', 'Kees']);
  assert.equal(e[0].avg, 1.5);
  assert.ok(e[1].avg < 0);
});

test('per week voor de grafiek', () => {
  const w = S.weekly(contacts, T, 5);
  assert.equal(w.length, 5);
  const total = w.reduce((s, x) => s + x.inPerson + x.digital, 0);
  assert.equal(total, 5);
});
