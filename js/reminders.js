/* Herinneringen via meldingen van de browser/telefoon.
 * Let op: zonder eigen server kan een webapp alleen melden terwijl hij open is of kort op de achtergrond draait.
 * Voor gegarandeerde herinneringen zet je de innametijden in je agenda (zie medsToICS). */
(function (HT) {
  'use strict';
  const { store, utils } = HT;
  const SENT_KEY = 'health-tracker-notified';

  function supported() {
    return 'Notification' in window;
  }

  function permission() {
    return supported() ? Notification.permission : 'unsupported';
  }

  function loadSent() {
    try {
      const sent = JSON.parse(localStorage.getItem(SENT_KEY)) || {};
      const today = utils.todayISO();
      for (const k of Object.keys(sent)) if (!k.startsWith(today)) delete sent[k];
      return sent;
    } catch (e) {
      return {};
    }
  }

  function markSent(key) {
    const sent = loadSent();
    sent[key] = 1;
    try { localStorage.setItem(SENT_KEY, JSON.stringify(sent)); } catch (e) { /* niet erg */ }
  }

  async function notify(title, body, tag) {
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true, data: { url: './#/' } };
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, opts);
        return;
      }
    } catch (e) { /* val terug op gewone melding */ }
    new Notification(title, opts);
  }

  function check() {
    const s = store.data.settings;
    if (!s.notify || permission() !== 'granted') return;
    const today = utils.todayISO();
    const now = utils.nowTime();
    const sent = loadSent();

    const due = utils.dueDoses(store.list('medications'), store.data.medLog, today, now);
    const fresh = due.filter((d) => !sent[`${today}|${d.med.id}|${d.time}`]);
    if (fresh.length) {
      const names = fresh.map((d) => `${d.med.name}${d.med.dose ? ' ' + d.med.dose : ''} (${d.time})`);
      notify('💊 Tijd voor je medicatie', names.join('\n'), `med-${today}-${now}`);
      fresh.forEach((d) => markSent(`${today}|${d.med.id}|${d.time}`));
    }

    if (s.hydrationReminder && s.fluidMode !== 'max' && now >= '09:00' && now <= '21:00') {
      const block = `${today}|drink|${now.slice(0, 2) - (now.slice(0, 2) % 2)}`; // hooguit eens per 2 uur
      const goal = Number(s.fluidGoal) || 2000;
      const drunk = utils.fluidMl(store.checkinFor(today)) || 0;
      if (!sent[block] && utils.expectedFluid(goal, now) - drunk >= 500) {
        notify('💧 Tijd om wat te drinken', `Je hebt vandaag ${drunk} ml gedronken van je doel van ${goal} ml.`, `drink-${today}`);
        markSent(block);
      }
    }

    if (s.energyPrompts) {
      // Rond 10:00, 14:00 en 19:00 vragen, als je in dat dagdeel nog geen energie hebt vastgelegd.
      const windows = [['10:00', '11:59', 'ochtend'], ['14:00', '16:59', 'middag'], ['19:00', '21:30', 'avond']];
      const win = windows.find(([a, b]) => now >= a && now <= b);
      const log = (store.checkinFor(today) || {}).energyLog || [];
      if (win && !sent[`${today}|energy|${win[2]}`] && !log.some((x) => HT.energy.partOfDay(x.time) === win[2])) {
        notify('🔋 Hoe is je energie nu?', 'Tik in de app hoe energiek je je voelt – het kost 2 seconden.', `energy-${today}-${win[2]}`);
        markSent(`${today}|energy|${win[2]}`);
      }
    }

    const meal = s.meal || {};
    if (meal.cookReminder && HT.views.mealplan) {
      const c = HT.views.mealplan.cookToday(today);
      if (c && now >= c.start && now <= c.dinner && !sent[`${today}|cook`]) {
        notify('🍳 Tijd om te koken', `${c.recipe.name} – duurt ongeveer ${c.recipe.minutes} minuten (eten om ${c.dinner}).`, `cook-${today}`);
        markSent(`${today}|cook`);
      }
    }

    if (s.checkinTime && now >= s.checkinTime && !store.checkinDone(today) && !sent[`${today}|checkin`]) {
      notify('📝 Dagelijkse check', 'Hoe ging het vandaag? Vul je dagelijkse check in.', `checkin-${today}`);
      markSent(`${today}|checkin`);
    }
  }

  async function enable() {
    if (!supported()) {
      alert('Deze browser ondersteunt geen meldingen. Gebruik "Zet in agenda" voor herinneringen.');
      return false;
    }
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      alert('Meldingen zijn niet toegestaan. Je kunt dit aanpassen in de instellingen van je browser of telefoon.');
      store.saveSettings({ notify: false });
      return false;
    }
    store.saveSettings({ notify: true });
    notify('✅ Herinneringen staan aan', 'Je krijgt een melding als het tijd is voor je medicatie.', 'enabled');
    return true;
  }

  function disable() {
    store.saveSettings({ notify: false });
  }

  function test() {
    notify('🔔 Testmelding', 'Zo zien je herinneringen eruit.', 'test');
  }

  setInterval(check, 30 * 1000);
  document.addEventListener('visibilitychange', check);
  setTimeout(check, 1500);

  /** Directe melding (alleen als meldingen zijn toegestaan). */
  function notifyNow(title, body, tag) {
    if (permission() === 'granted') notify(title, body, tag || `now-${Date.now()}`);
  }

  HT.reminders = { supported, permission, enable, disable, test, check, notifyNow };
})(window.HT);
