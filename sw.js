/* 离线缓存（service worker）。
   · 页面本身零依赖、零网络请求，所以把外壳存下来之后，断网也能照常读。
   · 内容更新后，把下面的 VERSION 加一：新版本安装时会重新抓一遍，
     旧缓存在激活时删掉，读者下次打开就是新内容。
   · 只在 https / localhost 下注册；file:// 直接打开时由页面跳过（见 index.html）。 */
const VERSION = "v1";
const CACHE = "concept-fable-" + VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./engine.js",
  "./concepts/information-entropy.js",
  "./concepts/mean-reversion.js",
  "./concepts/overfitting.js",
  "./concepts/survivorship-bias.js",
  "./concepts/symmetry-breaking.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon.ico"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* 先给缓存里的那一份（快，且断网可用），同时悄悄去取一份新的放回缓存：
   下一次打开就是新的。想让读者立刻看到改动，就把 VERSION 加一。 */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) return hit;
    const res = await fresh;
    if (res) return res;
    if (req.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    return new Response("离线，而且这一项还没有缓存过。", {
      status: 503,
      headers: { "content-type": "text/plain;charset=utf-8" }
    });
  })());
});
