// WARP-Unit ServiceWorker — cache-first offline
// ponytail: caches everything on install, no runtime caching.
//           Upgrade: stale-while-revalidate for data/*.json.

var CACHE = "warp-v2";
var FILES = [
  "/",
  "/index.html",
  "/missioncontrol.html",
  "/oneshot.html",
  "/mothership.html",
  "/400i.html",
  "/equipamento.html",
  "/diariodebordo.html",
  "/warp.css",
  "/js/store.js",
  "/js/p2p.js",
  "/js/db.js",
  "/data/robots.json",
  "/data/config.json",
  "/data/planet-types.json",
  "/data/planet-params.json",
  "/data/planet-names.json",
  "/data/discoveries.json",
  "/data/events-params.json",
  "/data/events-categories.json",
  "/data/enemies.json",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.allSettled(FILES.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request);
    })
  );
});
