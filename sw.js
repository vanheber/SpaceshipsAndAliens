// WARP-Unit ServiceWorker — network-first navigations, cache-first static
// ponytail: no runtime cache invalidation. Upgrade: versioned URLs + max-age in cache headers.

var CACHE = "warp-v4";

self.addEventListener("install", function () {
  self.skipWaiting();
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
  var isNav = e.request.mode === "navigate";
  e.respondWith(
    (isNav ? networkFirst(e.request) : cacheFirst(e.request)).catch(function () {
      return isNav ? caches.match(e.request) : new Response("", { status: 503 });
    })
  );
});

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  });
}
