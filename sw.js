const CACHE = 'moeen-v6';
const SHELL = ['./', './index.html', './manifest.json', './icon.jpg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// الصوت: لا نتدخل (طلبات Range) حتى لا نكسر التشغيل
// الواجهة وملفات CDN والخطوط: من الكاش فوراً ثم تحديث في الخلفية
// بيانات القرآن (API): الشبكة أولاً ثم الكاش
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('everyayah.com')) return;

  if (url.hostname.includes('alquran.cloud') || url.hostname.includes('quran.com') || url.hostname.includes('risanb.com')) {
    e.respondWith(fetch(req).then(r => {
      if (r && r.status === 200) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    }).catch(() => caches.match(req)));
    return;
  }

  e.respondWith(caches.match(req, { ignoreSearch: false }).then(cached => {
    const net = fetch(req).then(r => {
      if (r && (r.status === 200 || r.type === 'opaque')) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    }).catch(() => cached || caches.match('./index.html'));
    return cached || net;
  }));
});
