/* Service Worker：網路優先，離線時用快取（改版後不會卡在舊版） */
var CACHE = 'moneybuddy-v1';
var ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './css/tokens.css', './css/base.css', './css/components.css', './css/views.css',
  './js/utils.js', './js/schema.js', './js/store.js', './js/repo.js', './js/query.js',
  './js/insights.js', './js/charts.js', './js/ui.js', './js/app.js',
  './js/views/entry.js', './js/views/home.js', './js/views/stats.js',
  './js/views/recurring.js', './js/views/list.js', './js/views/catdetail.js',
  './js/views/manage.js', './js/views/achieve.js', './js/views/me.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) { return r || caches.match('./index.html'); });
    })
  );
});
