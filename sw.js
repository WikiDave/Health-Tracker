/* Service worker: maakt de app offline bruikbaar. Verhoog VERSION bij elke release. */
const VERSION = 'v9';
const CACHE = `gezondheid-${VERSION}`;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/utils.js', 'js/store.js', 'js/ui.js', 'js/form.js', 'js/chart.js', 'js/questionnaires.js', 'js/healthscore.js', 'js/xlsx.js', 'js/export.js', 'js/reminders.js',
  'js/views/checkin.js', 'js/views/wellbeing.js', 'js/views/medication.js', 'js/views/labs.js', 'js/views/prescriptions.js',
  'js/views/visits.js', 'js/views/pain.js', 'js/views/vaccinations.js', 'js/views/sport.js', 'js/views/bowel.js', 'js/views/sleep.js', 'js/views/nutrition.js', 'js/views/hydration.js', 'js/views/substances.js', 'js/views/environment.js', 'js/views/profile.js', 'js/views/healthmeter.js', 'js/views/dashboard.js', 'js/menu.js', 'js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Eerst netwerk, zonder de browsercache (GitHub Pages cachet 10 min), zodat updates direct binnenkomen.
// Bij geen verbinding uit de cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

// Klik op een melding: open (of focus) de app.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
    })
  );
});
