/* Algemene hulpfuncties: datums, getallen, escaping en medische berekeningen.
 * Werkt zowel in de browser (window.HT.utils) als in Node (module.exports) voor tests. */
(function (root) {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');

  function toISO(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function todayISO() {
    return toISO(new Date());
  }

  function parseISO(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  function daysBetween(fromISO, toISOStr) {
    return Math.round((parseISO(toISOStr) - parseISO(fromISO)) / 86400000);
  }

  function nowTime() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    return parseISO(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateLong(iso) {
    if (!iso) return '';
    return parseISO(iso).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    return parseISO(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Leest een getal zoals een Nederlander het typt ("5,4" of "5.4"). Leeg of ongeldig → null. */
  function parseNum(value) {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const s = String(value).trim().replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function formatNum(n) {
    if (n == null || n === '') return '';
    return String(n).replace('.', ',');
  }

  /** "08:00, 20:00" → ["08:00", "20:00"] (gesorteerd, uniek). Ongeldige tijden → null. */
  function parseTimes(value) {
    if (Array.isArray(value)) return value;
    const parts = String(value || '').split(/[,;\s]+/).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const m = p.match(/^(\d{1,2})[:.]?(\d{2})?$/);
      if (!m) return null;
      const h = Number(m[1]);
      const min = Number(m[2] || 0);
      if (h > 23 || min > 59) return null;
      out.push(`${pad(h)}:${pad(min)}`);
    }
    return [...new Set(out)].sort();
  }

  /** Vergelijkt een labwaarde met de referentiewaarden. */
  function rangeStatus(value, low, high) {
    const v = parseNum(value);
    if (v == null) return 'unknown';
    const lo = parseNum(low);
    const hi = parseNum(high);
    if (lo == null && hi == null) return 'unknown';
    if (lo != null && v < lo) return 'low';
    if (hi != null && v > hi) return 'high';
    return 'normal';
  }

  function isMedActiveOn(med, iso) {
    if (!med || med.active === false) return false;
    if (med.startDate && iso < med.startDate) return false;
    if (med.endDate && iso > med.endDate) return false;
    return true;
  }

  function medTimes(med) {
    return Array.isArray(med.times) ? med.times : [];
  }

  /** Aantal dagen dat de voorraad nog strekt, of null als voorraad/schema onbekend. */
  function daysOfStockLeft(med) {
    const stock = parseNum(med.stock);
    const perDose = parseNum(med.unitsPerDose) || 1;
    const perDay = medTimes(med).length * perDose;
    if (stock == null || perDay === 0) return null;
    return Math.floor(stock / perDay);
  }

  function doseKey(medId, time) {
    return `${medId}|${time}`;
  }

  /** Therapietrouw tussen twee datums (inclusief): geplande vs genomen innames.
   *  Met nowHHMM tellen innames op de laatste dag pas mee als hun tijd verstreken is (of ze al genomen zijn). */
  function adherence(meds, medLog, fromISO, toISOStr, nowHHMM) {
    let planned = 0;
    let taken = 0;
    for (let d = fromISO; d <= toISOStr; d = addDays(d, 1)) {
      const day = (medLog && medLog[d]) || {};
      for (const med of meds) {
        if (!isMedActiveOn(med, d)) continue;
        for (const t of medTimes(med)) {
          const isTaken = Boolean(day[doseKey(med.id, t)]);
          if (nowHHMM && d === toISOStr && t > nowHHMM && !isTaken) continue;
          planned++;
          if (isTaken) taken++;
        }
      }
    }
    return { planned, taken, pct: planned ? Math.round((taken / planned) * 100) : null };
  }

  /** Status van een recept ten opzichte van vandaag. */
  function prescriptionStatus(p, today) {
    if (!p.validUntil) return 'unknown';
    const left = daysBetween(today, p.validUntil);
    if (left < 0) return 'expired';
    if (left <= 30) return 'expiring';
    return 'valid';
  }

  const icsEsc = (s) => String(s || '').replace(/[\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const icsStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  function icsCalendar(events) {
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Health-Tracker//NL', 'CALSCALE:GREGORIAN', ...events.flat(), 'END:VCALENDAR'].join('\r\n');
  }

  /** Maakt een .ics-agenda-item voor een afspraak (herinnering een dag vooraf). */
  function visitToICS(visit) {
    const date = String(visit.date || '').replace(/-/g, '');
    const lines = ['BEGIN:VEVENT', `UID:${visit.id}@health-tracker`, `DTSTAMP:${icsStamp()}`];
    if (visit.time) {
      lines.push(`DTSTART:${date}T${visit.time.replace(':', '')}00`);
      const [h, m] = visit.time.split(':').map(Number);
      const end = new Date(2000, 0, 1, h, m + 30);
      lines.push(`DTEND:${date}T${pad(end.getHours())}${pad(end.getMinutes())}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${date}`);
    }
    const title = [visit.type, visit.doctor || visit.location].filter(Boolean).join(' – ');
    lines.push(`SUMMARY:${icsEsc(title || 'Medische afspraak')}`);
    if (visit.location) lines.push(`LOCATION:${icsEsc(visit.location)}`);
    if (visit.reason) lines.push(`DESCRIPTION:${icsEsc(visit.reason)}`);
    lines.push('BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Herinnering afspraak', 'END:VALARM', 'END:VEVENT');
    return icsCalendar([lines]);
  }

  /** Dagelijks terugkerende agenda-items (met melding) voor alle innametijden. */
  function medsToICS(meds, today) {
    const events = [];
    for (const med of meds) {
      if (med.active === false || (med.endDate && med.endDate < today)) continue;
      const start = (med.startDate && med.startDate > today ? med.startDate : today).replace(/-/g, '');
      for (const time of medTimes(med)) {
        const t = time.replace(':', '') + '00';
        const [h, m] = time.split(':').map(Number);
        const end = new Date(2000, 0, 1, h, m + 5);
        const ev = [
          'BEGIN:VEVENT',
          `UID:${med.id}-${time.replace(':', '')}@health-tracker`,
          `DTSTAMP:${icsStamp()}`,
          `DTSTART:${start}T${t}`,
          `DTEND:${start}T${pad(end.getHours())}${pad(end.getMinutes())}00`,
          `RRULE:FREQ=DAILY${med.endDate ? `;UNTIL=${med.endDate.replace(/-/g, '')}T235959` : ''}`,
          `SUMMARY:${icsEsc(`${med.kind === 'supplement' ? '🌿' : '💊'} ${med.name}${med.dose ? ' ' + med.dose : ''}`)}`,
        ];
        if (med.instructions) ev.push(`DESCRIPTION:${icsEsc(med.instructions)}`);
        ev.push('BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc('Tijd voor ' + med.name)}`, 'END:VALARM', 'END:VEVENT');
        events.push(ev);
      }
    }
    return icsCalendar(events);
  }

  function minutesOf(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
  }

  /** Innames van vandaag die nu aan de beurt zijn (tijd verstreken, max. windowMin geleden) en nog niet genomen. */
  function dueDoses(meds, medLog, date, nowHHMM, windowMin = 120) {
    const now = minutesOf(nowHHMM);
    const day = (medLog && medLog[date]) || {};
    const out = [];
    for (const med of meds) {
      if (!isMedActiveOn(med, date)) continue;
      for (const time of medTimes(med)) {
        const diff = now - minutesOf(time);
        if (diff >= 0 && diff <= windowMin && !day[doseKey(med.id, time)]) out.push({ med, time });
      }
    }
    return out;
  }

  /** Vaccinaties waarvan de volgende prik binnen 30 dagen (of al) moet, zonder dat er al een latere is gezet. */
  function vaccinationsDue(vaccinations, today) {
    const out = [];
    for (const v of vaccinations) {
      if (!v.nextDue) continue;
      const name = String(v.name || '').trim().toLowerCase();
      const later = vaccinations.some((w) => w !== v && String(w.name || '').trim().toLowerCase() === name && w.date > v.date);
      if (later) continue;
      const left = daysBetween(today, v.nextDue);
      if (left < 0) out.push({ vaccination: v, status: 'overdue', days: left });
      else if (left <= 30) out.push({ vaccination: v, status: 'soon', days: left });
    }
    return out;
  }

  /** Gemiddelde van een veld over de checks tussen twee datums (inclusief). */
  function average(checkins, key, fromISO, toISOStr) {
    const vals = checkins
      .filter((c) => c.date >= fromISO && c.date <= toISOStr && c[key] != null && c[key] !== '')
      .map((c) => Number(c[key]))
      .filter(Number.isFinite);
    return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : null;
  }

  /** Maandag van de week waarin de datum valt. */
  function weekStart(iso) {
    const d = parseISO(iso);
    const dow = (d.getDay() + 6) % 7; // maandag = 0
    return addDays(iso, -dow);
  }

  /** Beweegminuten per week (maandag als sleutel). Zware inspanning telt dubbel, zoals in de Beweegrichtlijn. */
  function activeMinutesByWeek(sessions) {
    const out = {};
    for (const s of sessions) {
      const min = parseNum(s.duration);
      if (!s.date || min == null) continue;
      const k = weekStart(s.date);
      out[k] = (out[k] || 0) + (s.intensity === 'Zwaar' ? min * 2 : min);
    }
    return out;
  }

  /** Som van een numeriek veld per week (maandag als sleutel). */
  function sumByWeek(entries, key) {
    const out = {};
    for (const e of entries) {
      const v = parseNum(e[key]);
      if (!e.date || v == null) continue;
      const k = weekStart(e.date);
      out[k] = (out[k] || 0) + v;
    }
    return out;
  }

  /** Aantal hele dagen sinds een datum (0 op de dag zelf), of null. */
  function daysSince(iso, today) {
    if (!iso) return null;
    const n = daysBetween(iso, today);
    return n < 0 ? null : n;
  }

  /**
   * Vergelijkt een waarde uit de check van de dag erna, na dagen met en zonder gebruik.
   * bv. vermoeidheid de ochtend na dagen met alcohol vs zonder. Geeft null bij te weinig gegevens (min. 3 per groep).
   */
  function nextDayEffect(dayEntries, usedFn, checkins, key) {
    const byDate = Object.fromEntries(checkins.map((c) => [c.date, c]));
    const withUse = [];
    const without = [];
    for (const e of dayEntries) {
      const next = byDate[addDays(e.date, 1)];
      const v = next ? parseNum(next[key]) : null;
      if (v == null) continue;
      (usedFn(e) ? withUse : without).push(v);
    }
    if (withUse.length < 3 || without.length < 3) return null;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    return { withUse: avg(withUse), without: avg(without), n: withUse.length + without.length };
  }

  /** Slaapduur in uren tussen bedtijd en opstaan (over middernacht heen), minus inslaaptijd. */
  function sleepDuration(bedtime, wakeTime, minutesToFallAsleep) {
    if (!bedtime || !wakeTime) return null;
    let mins = minutesOf(wakeTime) - minutesOf(bedtime);
    if (mins <= 0) mins += 24 * 60;
    mins -= parseNum(minutesToFallAsleep) || 0;
    return mins > 0 ? Math.round((mins / 60) * 10) / 10 : null;
  }

  /** Vergelijkt een waarde op dagen met en zonder een bepaalde situatie (zelfde dag). Min. 3 per groep. */
  function sameDayEffect(checkins, conditionFn, key) {
    const withIt = [];
    const without = [];
    for (const c of checkins) {
      const v = parseNum(c[key]);
      if (v == null) continue;
      const cond = conditionFn(c);
      if (cond == null) continue;
      (cond ? withIt : without).push(v);
    }
    if (withIt.length < 3 || without.length < 3) return null;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    return { withIt: avg(withIt), without: avg(without), n: withIt.length + without.length };
  }

  /** Totaal gedronken (ml) op een dag: uit de drinklog, of anders uit het oude aantal glazen (250 ml). */
  function fluidMl(c) {
    if (!c) return null;
    if (Array.isArray(c.drinks) && c.drinks.length) return c.drinks.reduce((s, d) => s + (parseNum(d.ml) || 0), 0);
    const glasses = parseNum(c.water);
    return glasses == null ? null : Math.round(glasses * 250);
  }

  /** Hoeveel je 'volgens schema' rond dit tijdstip gedronken zou hebben, verdeeld over 08:00–22:00. */
  function expectedFluid(goalMl, nowHHMM) {
    const start = 8 * 60;
    const end = 22 * 60;
    const t = Math.min(end, Math.max(start, minutesOf(nowHHMM)));
    return Math.round((goalMl * (t - start)) / (end - start));
  }

  /** Stoelgang-overzicht over een periode (inclusief). */
  function bowelStats(entries, fromISO, toISOStr) {
    const list = entries.filter((e) => e.date >= fromISO && e.date <= toISOStr);
    const days = daysBetween(fromISO, toISOStr) + 1;
    const types = {};
    for (const e of list) if (e.bristol) types[e.bristol] = (types[e.bristol] || 0) + 1;
    const typed = list.filter((e) => e.bristol);
    return {
      count: list.length,
      perDay: days > 0 ? list.length / days : 0,
      daysWithout: days - new Set(list.map((e) => e.date)).size,
      types,
      hard: typed.filter((e) => e.bristol <= 2).length,
      loose: typed.filter((e) => e.bristol >= 6).length,
      blood: list.filter((e) => e.blood).length,
    };
  }

  function sortBy(arr, key, dir = 1) {
    return [...arr].sort((a, b) => {
      const av = typeof key === 'function' ? key(a) : a[key];
      const bv = typeof key === 'function' ? key(b) : b[key];
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
  }

  const api = {
    toISO, todayISO, parseISO, addDays, daysBetween, nowTime,
    formatDate, formatDateLong, formatDateShort,
    escapeHtml, uid, parseNum, formatNum, parseTimes,
    rangeStatus, isMedActiveOn, medTimes, daysOfStockLeft, doseKey, adherence,
    prescriptionStatus, visitToICS, medsToICS, minutesOf, dueDoses, vaccinationsDue, average, weekStart, activeMinutesByWeek, bowelStats, sumByWeek, daysSince, nextDayEffect, sleepDuration, sameDayEffect, fluidMl, expectedFluid, sortBy,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.HT = root.HT || {};
    root.HT.utils = api;
    root.HT.version = '12'; // gelijk houden met VERSION in sw.js
  }
})(typeof window !== 'undefined' ? window : globalThis);
