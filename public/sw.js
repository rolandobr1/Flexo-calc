/* FlexoCalc Pro: permite abrir la app sin internet después de la primera visita. */
const CACHE = 'flexocalc-v2';

self.addEventListener('install', (e) => {
  // Guarda la app completa (incluido el lector de PDF) para poder usarla sin internet.
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(['./', 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png']);
      try {
        const lista = await (await fetch('precache.json', { cache: 'no-store' })).json();
        await c.addAll(lista.filter((f) => f !== 'index.html'));
      } catch {
        /* sin lista: los archivos se guardan a medida que se usan */
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // La página: primero la red (para recibir actualizaciones), si no hay red, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put('./', copia));
          return r;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // Archivos (JS, CSS, lector de PDF, íconos): tienen nombre con huella, se guardan la primera vez.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return r;
        }),
    ),
  );
});
