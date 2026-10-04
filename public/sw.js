// Keeps the app on the device, so Fridge Triage opens when the power (and the Wi-Fi) is out.
// The clock, adding food by hand, the verdicts and the loss record all run offline; only photo recognition needs a connection.
const CACHE = "fridge-triage-v1";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const page = await fetch("/", { cache: "reload" });
    const html = await page.clone().text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    await cache.put("/", page);
    await cache.addAll([...SHELL.slice(1), ...assets]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // The page: network first so a new version shows up, the saved copy when offline or after 3 seconds of nothing.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await Promise.race([
          fetch(request),
          new Promise((_, fail) => setTimeout(() => fail(new Error("slow")), 3000)),
        ]);
        if (response.ok) await cache.put("/", response.clone());
        return response;
      } catch {
        return (await cache.match("/")) ?? Response.error();
      }
    })());
    return;
  }

  // Everything else the page loads: the saved copy first (built files have content hashes in their names).
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok && (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname))) await cache.put(request, response.clone());
    return response;
  })());
});
