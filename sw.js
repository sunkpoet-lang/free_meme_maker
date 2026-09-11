/* =========================================================
   MEME MAKER — sw.js (service worker)
   ---------------------------------------------------------
   Le da a la app comportamiento de PWA: una vez que se visitó
   al menos una vez con internet, el "cascarón" (HTML/CSS/JS/
   íconos) queda guardado y la app abre aunque no haya señal.

   Estrategia, a propósito simple (nada de build tools):
     - Páginas (HTML): red primero, y si no hay red, lo último
       guardado -así siempre se ve la versión más nueva cuando
       hay internet-.
     - Todo lo demás del mismo sitio (CSS/JS/íconos): lo que ya
       está guardado responde al toque, y en paralelo se pide a
       la red para tener la versión más nueva la PRÓXIMA vez
       ("stale-while-revalidate").
     - Pedidos a otros sitios (Google Fonts, plantillas de
       Imgflip/memegen, el contador) no se tocan: van directo a
       la red, tal cual, sin caché.
   ========================================================= */

// Subir este número cada vez que se publique un cambio importante,
// para que los celulares que ya instalaron la app descarten la caché
// vieja y tomen los archivos nuevos.
const CACHE_VERSION = "meme-studio-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./css/themes.css",
  "./js/theme.js",
  "./js/state.js",
  "./js/counter.js",
  "./js/elements.js",
  "./js/customtemplates.js",
  "./js/customstickers.js",
  "./js/more-memes-manifest.js",
  "./js/lib/gifuct.js",
  "./js/lib/gifenc.js",
  "./js/gifs.js",
  "./js/render.js",
  "./js/interactions.js",
  "./js/sticker-editor.js",
  "./js/panels.js",
  "./js/export.js",
  "./js/win95-sounds.js",
  "./js/win95-dos.js",
  "./js/app.js",
  "./js/pwa.js",
  "./assets/logo.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      // Si algo del listado falla (por ejemplo, un archivo que ya no
      // existe), no queremos que TODA la instalación del service
      // worker se caiga: seguimos igual.
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET, y solo del mismo origen (no tocar fonts.googleapis.com,
  // api.imgflip.com, api.countapi.xyz, etc. -esos van directo a la red-).
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  const isNavigation = req.mode === "navigate";

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
