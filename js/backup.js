/* Back-ups: versleutelen met een wachtwoord, samenvatten, controleren en samenvoegen.
 * Werkt in de browser (HT.backup) en in Node (tests; Node 20+ heeft Web Crypto). */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const cryptoApi = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;

  const FORMAT = 'gezondheid-versleuteld-v1';
  const ITERATIONS = 250000;
  const COLLECTIONS = ['medications', 'prescriptions', 'labs', 'visits', 'checkins', 'vaccinations', 'pain', 'questionnaires', 'sport', 'bowel', 'food', 'recipes', 'tasks', 'focus', 'braindump', 'procrastination', 'people', 'contacts'];
  const LABELS = {
    checkins: 'dagen', medications: 'medicijnen', labs: 'bloedonderzoeken', visits: 'afspraken', prescriptions: 'voorschriften', vaccinations: 'vaccinaties',
    pain: 'pijnnotities', sport: 'trainingen', food: 'maaltijden', bowel: 'stoelgang', questionnaires: 'zelftests', tasks: 'taken', focus: 'focusblokken',
    people: 'personen', contacts: 'contactmomenten', recipes: 'eigen recepten', braindump: 'gedachten', procrastination: 'uitstelmomenten',
  };

  const SINGULAR = {
    checkins: 'dag', medications: 'medicijn', labs: 'bloedonderzoek', visits: 'afspraak', prescriptions: 'voorschrift', vaccinations: 'vaccinatie',
    pain: 'pijnnotitie', sport: 'training', food: 'maaltijd', questionnaires: 'zelftest', tasks: 'taak', focus: 'focusblok',
    people: 'persoon', contacts: 'contactmoment', recipes: 'eigen recept', braindump: 'gedachte', procrastination: 'uitstelmoment',
  };

  // ---------- Base64 zonder afhankelijkheden ----------
  function toB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  }
  function fromB64(b64) {
    const s = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function keyFrom(password, salt, iterations) {
    const base = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return cryptoApi.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /** Versleutelt de back-uptekst met een wachtwoord (AES-GCM 256, sleutel via PBKDF2-SHA256). */
  async function encrypt(text, password) {
    if (!password) throw new Error('Geen wachtwoord opgegeven.');
    const salt = cryptoApi.getRandomValues(new Uint8Array(16));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const key = await keyFrom(password, salt, ITERATIONS);
    const data = new Uint8Array(await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
    return JSON.stringify({ format: FORMAT, created: new Date().toISOString(), iterations: ITERATIONS, salt: toB64(salt), iv: toB64(iv), data: toB64(data) });
  }

  function isEncrypted(text) {
    try { return JSON.parse(text).format === FORMAT; } catch (e) { return false; }
  }

  async function decrypt(text, password) {
    const f = JSON.parse(text);
    if (f.format !== FORMAT) throw new Error('Dit is geen versleutelde back-up.');
    const key = await keyFrom(password, fromB64(f.salt), f.iterations || ITERATIONS);
    try {
      const plain = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(f.iv) }, key, fromB64(f.data));
      return new TextDecoder().decode(plain);
    } catch (e) {
      throw new Error('Wachtwoord klopt niet (of het bestand is beschadigd).');
    }
  }

  /** Leest een (onversleutelde) back-uptekst en controleert of het een back-up van deze app is. */
  function parse(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('Dit bestand is geen back-up van de Gezondheidsapp (geen geldige inhoud).'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !('version' in parsed)) throw new Error('Dit is geen back-upbestand van de Gezondheidsapp.');
    for (const c of COLLECTIONS) if (parsed[c] != null && !Array.isArray(parsed[c])) throw new Error(`Back-up is beschadigd (${c}).`);
    return parsed;
  }

  /** Wat zit erin: aantallen per onderdeel en de periode. */
  function summarize(data) {
    const counts = {};
    let total = 0;
    const dates = [];
    for (const c of COLLECTIONS) {
      const n = Array.isArray(data[c]) ? data[c].length : 0;
      if (n) counts[c] = n;
      total += n;
      if (Array.isArray(data[c])) for (const x of data[c]) if (x && typeof x.date === 'string') dates.push(x.date);
    }
    dates.sort();
    return { counts, total, from: dates[0] || null, to: dates[dates.length - 1] || null, updatedAt: data.updatedAt || null };
  }

  function summaryText(s) {
    const parts = Object.entries(s.counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${n} ${n === 1 ? SINGULAR[k] || LABELS[k] || k : LABELS[k] || k}`);
    return parts.length ? parts.join(', ') + (Object.keys(s.counts).length > 6 ? ' en meer' : '') : 'geen gegevens';
  }

  /** Hoe lang geleden de laatste back-up was en of het tijd is voor een nieuwe. */
  function status(settings, data, now) {
    const every = Number(settings.backupEvery) || 7;
    const last = settings.lastBackup ? new Date(settings.lastBackup).getTime() : null;
    const days = last != null ? Math.floor((now - last) / 86400000) : null;
    const s = summarize(data);
    const hasData = s.total > 0 || Object.keys(data.profile || {}).length > 0;
    let level = 'ok';
    if (!hasData) level = 'empty';
    else if (days == null) level = 'never';
    else if (days >= every * 2) level = 'overdue';
    else if (days >= every) level = 'due';
    // Wijzigingen na de laatste back-up?
    const changedSince = last != null && data.updatedAt ? new Date(data.updatedAt).getTime() > last + 5000 : hasData;
    return { every, days, level, changedSince, hasData };
  }

  /**
   * Samenvoegen (bv. van een ander apparaat): alles wat nog niet bestaat komt erbij.
   * Bij hetzelfde item (zelfde id, of zelfde dag bij de dagelijkse gegevens) wint wat er al staat; lege velden worden aangevuld.
   */
  function merge(current, incoming) {
    const out = Object.assign({}, current);
    const added = {};
    for (const c of COLLECTIONS) {
      const cur = Array.isArray(current[c]) ? current[c] : [];
      const inc = Array.isArray(incoming[c]) ? incoming[c] : [];
      const keyOf = c === 'checkins' ? (x) => x.date : (x) => x.id;
      const map = new Map(cur.map((x) => [keyOf(x), x]));
      let n = 0;
      for (const x of inc) {
        const k = keyOf(x);
        if (k == null) continue;
        if (!map.has(k)) { map.set(k, x); n++; }
        else if (c === 'checkins') {
          const have = map.get(k);
          const filled = Object.assign({}, have);
          for (const [f, v] of Object.entries(x)) if (filled[f] == null || filled[f] === '') filled[f] = v;
          map.set(k, filled);
        }
      }
      out[c] = [...map.values()];
      if (n) added[c] = n;
    }
    out.medLog = Object.assign({}, current.medLog || {});
    for (const [d, day] of Object.entries(incoming.medLog || {})) out.medLog[d] = Object.assign({}, day, out.medLog[d] || {});
    out.mealPlans = Object.assign({}, incoming.mealPlans || {}, current.mealPlans || {});
    out.profile = Object.assign({}, incoming.profile || {}, Object.fromEntries(Object.entries(current.profile || {}).filter(([, v]) => v != null && v !== '')));
    out.settings = Object.assign({}, incoming.settings || {}, current.settings || {});
    return { data: out, added };
  }

  const api = { FORMAT, COLLECTIONS, LABELS, encrypt, decrypt, isEncrypted, parse, summarize, summaryText, status, merge };
  if (isNode) module.exports = api;
  else root.HT.backup = api;
})(typeof window !== 'undefined' ? window : globalThis);
