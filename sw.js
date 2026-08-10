const CACHE_NAME = 'time-diary-v2';
const ASSETS = [
  './', './index.html', './style.css', './manifest.json',
  './js/app.js', './js/calc.js', './js/store.js', './js/csv.js',
  './js/timeline.js', './js/stats.js', './js/items.js', './js/dom.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 自アセットのみキャッシュ優先。共有基盤のsync.js等は素通し(キャッシュしない)
// 注意: このファイルに「app-」+「sync」を連結した文字列を書かないこと(assets.test.jsが検査する)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const scopePath = new URL('./', self.location).pathname;
  const relative = './' + url.pathname.slice(scopePath.length);
  const isAsset = url.origin === self.location.origin &&
    (ASSETS.includes(relative) || url.pathname === scopePath);
  if (!isAsset) return;
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
