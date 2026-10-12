/*
 * Service worker do ScanCarrinho: rede primeiro, cache como reserva (funciona offline).
 * A cada versão nova, mude CACHE (ex.: scancarrinho-v0.2.1) junto com js/version.js e o CHANGELOG.md.
 * Nunca guarda dados do usuário: só os arquivos do app.
 */
const CACHE = "scancarrinho-v0.4.0";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./css/screens.css",
  "./js/boot.js",
  "./js/app.js",
  "./js/version.js",
  "./js/db.js",
  "./js/scanner.js",
  "./js/prices.js",
  "./js/products.js",
  "./js/cart.js",
  "./js/stores.js",
  "./js/categories.js",
  "./js/config.js",
  "./js/precos-site.js",
  "./js/redes.js",
  "./js/auto.js",
  "./js/ui/dom.js",
  "./js/ui/icons.js",
  "./js/ui/money.js",
  "./js/ui/toast.js",
  "./js/ui/dialog.js",
  "./js/ui/install.js",
  "./js/ui/nav.js",
  "./js/screens/loja.js",
  "./js/screens/scan.js",
  "./js/screens/lista.js",
  "./js/screens/produto.js",
  "./js/screens/resumo.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) =>
          hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())
        )
      )
  );
});
