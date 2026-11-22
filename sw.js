const CACHE = 'moeen-v17';
const SHELL = ['./', './index.html', './app.css', './manifest.json', './icon-192.png', './icon-512.png',
  './fonts/cairo-arabic-400-normal.woff2', './fonts/cairo-arabic-600-normal.woff2', './fonts/cairo-arabic-700-normal.woff2',
  './fonts/cairo-arabic-800-normal.woff2', './fonts/cairo-latin-400-normal.woff2', './fonts/cairo-latin-700-normal.woff2',
  './fonts/amiri-quran-arabic-400-normal.woff2'];

self.addEventListener('install', e => {
  // reload: نتجاوز كاش المتصفح حتى لا نخزّن نسخة قديمة من GitHub Pages
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const upgraded = keys.some(k => k !== CACHE && k.startsWith('moeen-'));
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // عند الترقية: أعد تحميل الصفحات المفتوحة لتعرض النسخة الجديدة فورًا
    if (upgraded) {
      const cs = await self.clients.matchAll({ type: 'window' });
      cs.forEach(c => { try { c.navigate(c.url); } catch (err) {} });
    }
  })());
});

// الشبكة أولاً للواجهة (HTML/CSS/JS) فيصل كل تحديث فور نشره، والكاش عند انقطاع الإنترنت.
// الخطوط والأيقونات: من الكاش مع تحديث صامت. الصوت: لا نتدخل (طلبات Range).
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const r = await Promise.race([
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
    ]);
    if (r && r.status === 200) cache.put(req.mode === 'navigate' ? './index.html' : req, r.clone());
    return r;
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('everyayah.com')) return;

  if (url.origin === self.location.origin && url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  if (url.hostname.includes('alquran.cloud') || url.hostname.includes('quran.com') || url.hostname.includes('risanb.com')) {
    e.respondWith(fetch(req).then(r => {
      if (r && r.status === 200) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    }).catch(() => caches.match(req)));
    return;
  }

  const same = url.origin === self.location.origin;
  if (same && (req.mode === 'navigate' || url.pathname.endsWith('/') || /\.(html|css|js|json|webmanifest)$/.test(url.pathname))) {
    e.respondWith(networkFirst(req));
    return;
  }

  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(r => {
      if (r && (r.status === 200 || r.type === 'opaque')) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    }).catch(() => cached);
    return cached || net;
  }));
});
