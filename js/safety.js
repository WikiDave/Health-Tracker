/* Vangnet: automatische herstelpunten in een tweede opslag (IndexedDB) van de browser,
 * en de browser vragen je gegevens niet zomaar op te ruimen (blijvende opslag).
 * Dit vervangt geen back-up buiten je telefoon, maar beschermt tegen vergissingen (verkeerde back-up teruggezet, iets gewist). */
(function (HT) {
  'use strict';
  const { store, utils, backup: B } = HT;

  const DB = 'health-tracker-safety';
  const STORE = 'snapshots';
  const KEEP_AUTO = 14;
  const KEEP_MANUAL = 5;

  let dbPromise = null;
  function db() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('Geen IndexedDB'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }

  function tx(mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const s = t.objectStore(STORE);
      const out = fn(s);
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
      t.onerror = () => reject(t.error);
    }));
  }

  const hasData = (data) => B.summarize(data).total > 0 || Object.values(data.profile || {}).some(Boolean);

  /** Legt de huidige gegevens vast. Automatische herstelpunten: één per dag (de laatste stand van die dag). */
  async function snapshot(reason, auto) {
    const data = store.data;
    if (!hasData(data)) return null;
    const now = new Date();
    const id = auto ? `auto-${utils.todayISO()}` : `manual-${now.getTime()}`;
    const rec = { id, auto: Boolean(auto), created: now.toISOString(), reason: reason || 'Automatisch', json: JSON.stringify(data), summary: B.summarize(data) };
    await tx('readwrite', (s) => s.put(rec));
    await prune();
    return rec;
  }

  async function list() {
    const all = await tx('readonly', (s) => s.getAll());
    return (all || []).sort((a, b) => (a.created < b.created ? 1 : -1));
  }

  async function prune() {
    const all = await list();
    const autos = all.filter((x) => x.auto).slice(KEEP_AUTO);
    const manual = all.filter((x) => !x.auto).slice(KEEP_MANUAL);
    if (autos.length || manual.length) await tx('readwrite', (s) => [...autos, ...manual].forEach((x) => s.delete(x.id)));
  }

  async function get(id) {
    return tx('readonly', (s) => s.get(id));
  }

  /** Zet een herstelpunt terug (de huidige stand wordt eerst zelf een herstelpunt). */
  async function restore(id) {
    const rec = await get(id);
    if (!rec) throw new Error('Herstelpunt niet gevonden.');
    await snapshot('Voor het terugzetten van een herstelpunt');
    store.replace(JSON.parse(rec.json));
    return rec;
  }

  // Automatisch: kort na elke wijziging het herstelpunt van vandaag bijwerken.
  let timer = null;
  store.onSave(() => {
    clearTimeout(timer);
    timer = setTimeout(() => { snapshot('Automatisch', true).catch(() => {}); }, 3000);
  });

  // ---------- Blijvende opslag ----------
  async function persistence() {
    const out = { supported: Boolean(navigator.storage && navigator.storage.persist), persisted: false, usage: null, quota: null };
    try {
      if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        out.usage = e.usage; out.quota = e.quota;
      }
    } catch (e) { /* niet beschikbaar */ }
    return out;
  }

  /** Vraagt de browser om de gegevens niet op te ruimen bij weinig ruimte of lang niet gebruiken. */
  async function requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch (e) { /* niet beschikbaar */ }
    return false;
  }

  const installed = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

  // ---------- Herstel na verlies ----------
  /** Zijn de gegevens hier leeg, terwijl er nog een herstelpunt is? Dan kan de app aanbieden die terug te zetten. */
  let recoverable = null;
  async function checkRecovery() {
    if (hasData(store.data)) { recoverable = null; return null; }
    try {
      const all = await list();
      recoverable = all.find((x) => x.summary && x.summary.total > 0) || null;
    } catch (e) { recoverable = null; }
    return recoverable;
  }

  // Bij het opstarten: als er gegevens zijn, meteen om blijvende opslag vragen; en kijken of er iets te herstellen valt.
  if (hasData(store.data)) requestPersist();
  checkRecovery().then((r) => { if (r && HT.app) HT.app.render(); });

  HT.safety = { snapshot, list, get, restore, persistence, requestPersist, installed, checkRecovery, get recoverable() { return recoverable; }, hasData };
})(window.HT);
