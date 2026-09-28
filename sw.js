/* Service worker: maakt de app offline bruikbaar. Verhoog VERSION bij elke release. */
const VERSION = 'v1';
const CACHE = `gezondheid-${VERSION}`;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/utils.js', 'js/store.js', 'js/ui.js', 'js/form.js', 'js/chart.js',
  'js/views/checkin.js', 'js/views/medication.js', 'js/views/labs.js', 'js/views/prescriptions.js',
  'js/views/visits.js', 'js/views/profile.js', 'js/views/dashboard.js', 'js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Eerst netwerk (zodat updates direct binnenkomen), bij geen verbinding uit de cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
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
