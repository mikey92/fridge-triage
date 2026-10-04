// Keeps the app on the device, so Fridge Triage opens when the power (and the Wi-Fi) is out.
// The clock, adding food by hand, the verdicts and the loss record all run offline; only photo recognition needs a connection.
const CACHE = "fridge-triage-v2";
const SHELL = ["/manifest.webmanifest", "/favicon.svg", "/icon-192.png"];

/** The built files a page loads (their names carry content hashes). */
const assetsIn = (html) => [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]))];

/** Saves a fresh copy of the page: its files first, then the page, then drops files no saved page needs any more.
 * In that order, the saved page never points at files that aren't saved. */
async function savePage(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const assets = assetsIn(html);
  const missing = [];
  for (const path of assets) if (!(await cache.match(path))) missing.push(path);
  await cache.addAll(missing);
  await cache.put("/", response);
  const keep = new Set(assets);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/assets/") && !keep.has(path)) await cache.delete(request);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const page = await fetch("/", { cache: "reload" });
    if (!page.ok) throw new Error(`page answered ${page.status}`);
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    await savePage(page);
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
    // Only the app's own page is saved; opening the sample photo or robots.txt in a tab is left to the browser.
    if (url.pathname !== "/" && url.pathname !== "/index.html") return;
    // Network first so a new version shows up; the saved copy when offline or after 3 seconds of nothing.
    event.respondWith((async () => {
      try {
        const response = await Promise.race([
          fetch(request),
          new Promise((_, fail) => setTimeout(() => fail(new Error("slow")), 3000)),
        ]);
        if (response.ok && !response.redirected) event.waitUntil(savePage(response.clone()).catch(() => {}));
        return response;
      } catch {
        const cache = await caches.open(CACHE);
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
