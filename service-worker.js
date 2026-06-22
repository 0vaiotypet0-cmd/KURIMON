const CACHE_NAME = "kurimon-pwa-v99";
const RUNTIME_CACHE = "kurimon-runtime-v88";

const CORE_ASSETS = [
  "./icons/icon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isDocumentRequest = event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");

  // HTMLは必ずネットワーク優先。古いindex.htmlを返し続ける事故を防ぐ。
  if (isDocumentRequest) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // service-worker.js / manifest.json はキャッシュしない。
  if (url.pathname.endsWith("/service-worker.js") || url.pathname.endsWith("/manifest.json") || url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  // 画像・アイコンなどはキャッシュ優先。初回取得後は軽くする。
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
