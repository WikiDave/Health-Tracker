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
          `SUMMARY:${icsEsc(`💊 ${med.name}${med.dose ? ' ' + med.dose : ''}`)}`,
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
    prescriptionStatus, visitToICS, medsToICS, minutesOf, dueDoses, vaccinationsDue, sortBy,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.HT = root.HT || {}).utils = api;
})(typeof window !== 'undefined' ? window : globalThis);
