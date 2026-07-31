const CACHE_PREFIX = "uta-nihongo-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const CORE_URLS = [
  "/",
  "/grammar",
  "/vocabulary",
  "/apple-touch-icon.png",
  "/icon-512.png",
];

async function storeUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  let stored = 0;
  let failed = 0;
  for (const url of [...new Set(urls)]) {
    try {
      const request = new Request(url, {
        cache: "reload",
        credentials: "include",
      });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(request, response.clone());
      stored += 1;
    } catch {
      failed += 1;
    }
  }
  return { stored, failed };
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (request.mode === "navigate" ? await cache.match("/") : undefined) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(storeUrls(CORE_URLS));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter(
            (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/api/import")
  ) {
    return;
  }

  const isDocument =
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.startsWith("/songs/");
  const isSongData =
    url.pathname === "/api/songs" || url.pathname.startsWith("/api/songs/");
  event.respondWith(
    isDocument || isSongData ? networkFirst(request) : cacheFirst(request),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_URLS") {
    event.waitUntil(
      storeUrls(event.data.urls ?? []).then((result) => {
        event.ports[0]?.postMessage({ ok: result.failed === 0, ...result });
      }),
    );
  }
  if (event.data?.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0]?.postMessage({ ok: true });
      }),
    );
  }
});
