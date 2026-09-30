/* Opslag van alle gegevens in de browser (localStorage). Niets verlaat het apparaat. */
(function (HT) {
  'use strict';
  const { uid, doseKey, parseNum } = HT.utils;

  const KEY = 'health-tracker-v1';
  const COLLECTIONS = ['medications', 'prescriptions', 'labs', 'visits', 'checkins', 'vaccinations', 'pain', 'questionnaires', 'sport', 'bowel', 'food', 'recipes', 'tasks', 'focus', 'braindump', 'procrastination', 'people', 'contacts'];

  function empty() {
    return {
      version: 1,
      profile: {},
      medications: [],
      medLog: {},
      prescriptions: [],
      labs: [],
      visits: [],
      checkins: [],
      vaccinations: [],
      pain: [],
      questionnaires: [],
      sport: [],
      bowel: [],
      food: [],
      recipes: [],
      tasks: [],
      focus: [],
      braindump: [],
      procrastination: [],
      people: [],
      contacts: [],
      mealPlans: {},
      settings: {},
    };
  }

  function normalize(raw) {
    const data = Object.assign(empty(), raw || {});
    for (const c of COLLECTIONS) if (!Array.isArray(data[c])) data[c] = [];
    if (!data.profile || typeof data.profile !== 'object') data.profile = {};
    if (!data.medLog || typeof data.medLog !== 'object') data.medLog = {};
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    if (!data.mealPlans || typeof data.mealPlans !== 'object') data.mealPlans = {};
    return data;
  }

  let data;
  try {
    data = normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch (e) {
    data = empty();
  }

  const listeners = new Set();

  /** Slaat op. Met silent = true wordt het scherm niet opnieuw getekend (bv. bij het afvinken van boodschappen). */
  function save(silent) {
    data.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      alert('Opslaan is mislukt: ' + e.message);
    }
    if (!silent) listeners.forEach((fn) => fn());
  }

  const store = {
    get data() {
      return data;
    },

    onChange(fn) {
      listeners.add(fn);
    },

    list(collection) {
      return data[collection];
    },

    get(collection, id) {
      return data[collection].find((x) => x.id === id);
    },

    /** Voegt toe of werkt bij (op basis van id). Geeft het opgeslagen item terug. */
    upsert(collection, item) {
      const list = data[collection];
      if (item.id) {
        const i = list.findIndex((x) => x.id === item.id);
        if (i >= 0) list[i] = Object.assign({}, list[i], item);
        else list.push(item);
      } else {
        item = Object.assign({ id: uid(), createdAt: new Date().toISOString() }, item);
        list.push(item);
      }
      save();
      return item;
    },

    remove(collection, id) {
      data[collection] = data[collection].filter((x) => x.id !== id);
      if (collection === 'medications') {
        for (const day of Object.values(data.medLog)) {
          for (const k of Object.keys(day)) if (k.startsWith(id + '|')) delete day[k];
        }
      }
      save();
    },

    saveProfile(profile) {
      data.profile = Object.assign({}, data.profile, profile);
      save();
    },

    /** Slaat het weekmenu van een week op (sleutel: maandag van die week). */
    saveMealPlan(weekStart, plan) {
      data.mealPlans[weekStart] = plan;
      save();
    },

    saveSettings(settings, silent) {
      data.settings = Object.assign({}, data.settings, settings);
      save(silent);
    },

    checkinFor(date) {
      return data.checkins.find((c) => c.date === date);
    },

    /** Vult velden aan in het dagrecord (maakt het aan als het nog niet bestaat). Gebruikt door slaap, voeding, middelen en omgeving. */
    mergeCheckin(date, values) {
      const existing = store.checkinFor(date);
      return store.upsert('checkins', Object.assign({}, existing || { date }, values, { date }));
    },

    /** Is de dagelijkse check (het hoofdformulier) voor deze dag ingevuld? */
    checkinDone(date) {
      const c = store.checkinFor(date);
      if (!c) return false;
      // 'energy' telt niet mee: die wordt ook door de snelle energieknoppen gezet.
      return Boolean(c.completed) || ['mood', 'pain', 'fatigue', 'stress', 'systolic', 'weight', 'symptoms'].some((k) => c[k] != null && c[k] !== '');
    },

    isTaken(date, medId, time) {
      return Boolean(data.medLog[date] && data.medLog[date][doseKey(medId, time)]);
    },

    /** Vinkt een inname aan/uit en past de voorraad aan. */
    toggleDose(date, medId, time) {
      const day = (data.medLog[date] = data.medLog[date] || {});
      const key = doseKey(medId, time);
      const med = store.get('medications', medId);
      const perDose = (med && parseNum(med.unitsPerDose)) || 1;
      const stock = med ? parseNum(med.stock) : null;
      if (day[key]) {
        delete day[key];
        if (stock != null) med.stock = stock + perDose;
      } else {
        day[key] = new Date().toISOString();
        if (stock != null) med.stock = Math.max(0, stock - perDose);
      }
      if (!Object.keys(day).length) delete data.medLog[date];
      save();
    },

    exportJSON() {
      return JSON.stringify(data, null, 2);
    },

    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) {
        throw new Error('Dit is geen geldig back-upbestand van de Gezondheidsapp.');
      }
      data = normalize(parsed);
      save();
    },

    clearAll() {
      data = empty();
      save();
    },
  };

  HT.store = store;
})(window.HT);
