/* Sociale kring: mensen om je heen, contactmomenten en hoe vaak je met mensen omgaat.
 * Werkt in de browser (HT.social) en in Node (tests). */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const u = isNode ? require('./utils.js') : root.HT.utils;
  const { addDays, daysBetween, parseNum, weekStart } = u;

  const TYPES = ['Afgesproken / bezoek', 'Samen iets gedaan', 'Groep / feest', 'Werk / school', 'Bellen', 'Videobellen', 'Berichten / appen'];
  const IN_PERSON = new Set(TYPES.slice(0, 4));
  const RELATIONS = ['Partner', 'Familie', 'Vriend(in)', 'Collega / studiegenoot', 'Buren', 'Kennis', 'Hulpverlener', 'Online'];
  const CIRCLES = [
    { key: 'binnen', icon: '❤️', label: 'Binnenste kring', text: 'Mensen die je het meest na staan en bij wie je jezelf kunt zijn' },
    { key: 'midden', icon: '🤝', label: 'Vrienden & familie', text: 'Mensen die je regelmatig ziet of spreekt' },
    { key: 'buiten', icon: '👋', label: 'Kennissen', text: 'Collega\'s, buren, sportclub, online' },
  ];
  const FREQ = [[7, 'Elke week'], [14, 'Om de week'], [30, 'Elke maand'], [90, 'Elk kwartaal']];
  const FEEL = [[-2, 'Kostte veel energie'], [-1, 'Kostte wat energie'], [0, 'Neutraal'], [1, 'Gaf wat energie'], [2, 'Gaf veel energie']];
  const BATTERY = ['Ik wil meer contact', 'Goed zo', 'Ik heb rust nodig'];

  const isInPerson = (c) => IN_PERSON.has(c.type);

  /** Contactmomenten van één dag. */
  function dayStats(contacts, date) {
    const list = contacts.filter((c) => c.date === date);
    return {
      count: list.length,
      inPerson: list.filter(isInPerson).length,
      digital: list.filter((c) => !isInPerson(c)).length,
      minutes: list.reduce((s, c) => s + (parseNum(c.duration) || 0), 0),
    };
  }

  /** De afgelopen 7 dagen (t/m today). */
  function weekStats(contacts, checkins, today) {
    const from = addDays(today, -6);
    const list = contacts.filter((c) => c.date >= from && c.date <= today);
    const days = new Set(list.map((c) => c.date));
    const inPersonDays = new Set(list.filter(isInPerson).map((c) => c.date));
    const people = new Set(list.flatMap((c) => c.people || []));
    const lonely = (checkins || []).filter((c) => c.date >= from && c.date <= today && parseNum(c.loneliness) != null).map((c) => parseNum(c.loneliness));
    const feel = list.filter((c) => c.feel != null).map((c) => Number(c.feel));
    return {
      count: list.length,
      inPerson: list.filter(isInPerson).length,
      digital: list.filter((c) => !isInPerson(c)).length,
      minutes: list.reduce((s, c) => s + (parseNum(c.duration) || 0), 0),
      daysWithContact: days.size,
      inPersonDays: inPersonDays.size,
      people: people.size,
      loneliness: lonely.length ? lonely.reduce((a, b) => a + b, 0) / lonely.length : null,
      feel: feel.length ? feel.reduce((a, b) => a + b, 0) / feel.length : null,
    };
  }

  /** Laatste contact met een persoon en of het (volgens je eigen wens) tijd is voor contact. */
  function personStatus(person, contacts, today) {
    const mine = contacts.filter((c) => (c.people || []).includes(person.id) && c.date <= today);
    const last = mine.reduce((m, c) => (!m || c.date > m ? c.date : m), null);
    const lastInPerson = mine.filter(isInPerson).reduce((m, c) => (!m || c.date > m ? c.date : m), null);
    const daysSince = last ? daysBetween(last, today) : null;
    const wish = parseNum(person.wish);
    const due = wish ? (daysSince == null ? true : daysSince >= wish) : false;
    return { last, lastInPerson, daysSince, count: mine.length, wish, due, overdueBy: wish && daysSince != null ? daysSince - wish : null };
  }

  /** Mensen met een contactwens bij wie het tijd is, langst geleden (t.o.v. de wens) eerst. */
  function dueList(people, contacts, today) {
    return people
      .map((p) => ({ person: p, status: personStatus(p, contacts, today) }))
      .filter((x) => x.status.due)
      .sort((a, b) => (b.status.daysSince == null ? 1e9 : b.status.daysSince / b.status.wish) - (a.status.daysSince == null ? 1e9 : a.status.daysSince / a.status.wish));
  }

  /** Verjaardagen binnen `within` dagen (vandaag = 0). */
  function upcomingBirthdays(people, today, within = 14) {
    const out = [];
    for (const p of people) {
      if (!p.birthday || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthday)) continue;
      const year = Number(today.slice(0, 4));
      let next = `${year}${p.birthday.slice(4)}`;
      if (next < today) next = `${year + 1}${p.birthday.slice(4)}`;
      const days = daysBetween(today, next);
      if (days <= within) out.push({ person: p, date: next, days, age: Number(next.slice(0, 4)) - Number(p.birthday.slice(0, 4)) });
    }
    return out.sort((a, b) => a.days - b.days);
  }

  /** Wie geeft je energie en wie kost energie (gemiddelde van 'hoe voelde het', min. 2 keer). */
  function energyByPerson(people, contacts) {
    return people
      .map((p) => {
        const f = contacts.filter((c) => (c.people || []).includes(p.id) && c.feel != null).map((c) => Number(c.feel));
        return { person: p, n: f.length, avg: f.length ? f.reduce((a, b) => a + b, 0) / f.length : null };
      })
      .filter((x) => x.n >= 2)
      .sort((a, b) => b.avg - a.avg);
  }

  /** Aantal contactmomenten per week (in het echt / op afstand) voor de grafiek. */
  function weekly(contacts, today, weeks = 12) {
    const out = [];
    const first = addDays(weekStart(today), -(weeks - 1) * 7);
    for (let i = 0; i < weeks; i++) {
      const from = addDays(first, i * 7);
      const to = addDays(from, 6);
      const list = contacts.filter((c) => c.date >= from && c.date <= to);
      out.push({ week: from, inPerson: list.filter(isInPerson).length, digital: list.filter((c) => !isInPerson(c)).length });
    }
    return out;
  }

  const api = { TYPES, RELATIONS, CIRCLES, FREQ, FEEL, BATTERY, isInPerson, dayStats, weekStats, personStatus, dueList, upcomingBirthdays, energyByPerson, weekly };
  if (isNode) module.exports = api;
  else root.HT.social = api;
})(typeof window !== 'undefined' ? window : globalThis);
