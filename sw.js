/* InteractiveLearn service worker — offline cache so the app works without a network. */
const CACHE = 'interactivelearn-v1';

const ASSETS = [
  'index.html',
  'app-menu.css',
  'manifest.json',
  'arrowpath.html', 'arrowpath.css', 'js/arrowpath.js',
  'bigsmall.html', 'bigsmall.css', 'js/bigsmall.js',
  'dots.html', 'dots.css', 'js/dots.js',
  'earthorbit.html', 'earthorbit.css', 'js/earthorbit.js',
  'eggmath.html', 'eggmath.css', 'js/eggmath.js',
  'gaussian.html', 'gaussian.css', 'js/gaussian.js',
  'geocentric.html', 'geocentric.css', 'js/geocentric.js',
  'hideball.html', 'js/hideball.js',
  'letters.html', 'letters.css', 'js/letters.js',
  'mathsymbols.html', 'mathsymbols.css', 'js/mathsymbols.js',
  'measure.html', 'measure.css', 'js/measure.js',
  'numberquantity.html', 'numberquantity.css', 'js/numberquantity.js',
  'patternsounds.html', 'patternsounds.css', 'js/patternsounds.js',
  'shapes.html', 'shapes.css', 'js/shapes.js',
  'spellword.html', 'spellword.css', 'js/spellword.js',
  'tictactoe.html', 'tictactoe.css', 'js/tictactoe.js',
  'wordmatch.html', 'wordmatch.css', 'js/wordmatch.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Cache each asset individually so one missing file does not abort install.
      Promise.all(ASSETS.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      }).catch(() => cached)
    )
  );
});
