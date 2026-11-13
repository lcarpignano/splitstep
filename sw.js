// Service worker: guarda la app para que funcione sin conexión en la cancha.
const CACHE = 'splitstep-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/audio.js',
  'js/drills.js',
  'js/motion.js',
  'js/render.js',
  'js/session.js',
  'js/storage.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Caché primero (abre al instante aunque no haya señal en la cancha) y se actualiza en segundo plano.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const net = caches.open(CACHE).then((c) =>
    fetch(e.request)
      .then((res) => {
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
      .catch(() => null)
  );
  e.waitUntil(net);
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(async (cached) => cached || (await net) || caches.match('index.html'))
  );
});
