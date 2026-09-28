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

  /** Therapietrouw tussen twee datums (inclusief): geplande vs genomen innames. */
  function adherence(meds, medLog, fromISO, toISOStr) {
    let planned = 0;
    let taken = 0;
    for (let d = fromISO; d <= toISOStr; d = addDays(d, 1)) {
      const day = (medLog && medLog[d]) || {};
      for (const med of meds) {
        if (!isMedActiveOn(med, d)) continue;
        for (const t of medTimes(med)) {
          planned++;
          if (day[doseKey(med.id, t)]) taken++;
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

  /** Maakt een .ics-agenda-item voor een afspraak. */
  function visitToICS(visit) {
    const date = String(visit.date || '').replace(/-/g, '');
    const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Health-Tracker//NL',
      'BEGIN:VEVENT',
      `UID:${visit.id}@health-tracker`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    ];
    if (visit.time) {
      const t = visit.time.replace(':', '') + '00';
      lines.push(`DTSTART:${date}T${t}`);
      const [h, m] = visit.time.split(':').map(Number);
      const end = new Date(2000, 0, 1, h, m + 30);
      lines.push(`DTEND:${date}T${pad(end.getHours())}${pad(end.getMinutes())}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${date}`);
    }
    const title = [visit.type, visit.doctor || visit.location].filter(Boolean).join(' – ');
    lines.push(`SUMMARY:${esc(title || 'Medische afspraak')}`);
    if (visit.location) lines.push(`LOCATION:${esc(visit.location)}`);
    if (visit.reason) lines.push(`DESCRIPTION:${esc(visit.reason)}`);
    lines.push('BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Herinnering afspraak', 'END:VALARM');
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
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
    prescriptionStatus, visitToICS, sortBy,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.HT = root.HT || {}).utils = api;
})(typeof window !== 'undefined' ? window : globalThis);
