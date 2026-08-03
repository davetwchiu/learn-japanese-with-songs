const CACHE_PREFIX = "uta-nihongo-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const CORE_URLS = [
  "/",
  "/grammar",
  "/vocabulary",
  "/apple-touch-icon.png",
  "/icon-512.png",
];

async function storeUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.all(
    [...new Set(urls)].map(async (url) => {
      try {
        const request = new Request(url, {
          cache: "reload",
          credentials: "include",
        });
        const response = await fetch(request);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await cache.put(request, response.clone());
        return true;
      } catch {
        return false;
      }
    }),
  );
  const stored = results.filter(Boolean).length;
  const failed = results.length - stored;
  return { stored, failed };
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, {
    ignoreSearch: true,
    ignoreVary: true,
  });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, {
      ignoreSearch: true,
      ignoreVary: true,
    });
    if (cached) return cached;
    return new Response(
      `<!doctype html><html lang="zh-HK"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>課文尚未下載</title><body><main><h1>這首課文尚未下載</h1><p>請連接網絡後返回目錄，按「更新」再試。</p><p><a href="/">返回歌曲目錄</a></p></main></body></html>`,
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
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

  if (request.headers.get("X-Uta-Refresh") === "1") {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_URLS") {
    const cacheTask = (async () => {
      const result = await storeUrls(event.data.urls ?? []);
      event.ports[0]?.postMessage({ ok: result.failed === 0, ...result });
      await storeUrls(event.data.optionalUrls ?? []);
    })();
    event.waitUntil(
      cacheTask,
    );
  }
});
