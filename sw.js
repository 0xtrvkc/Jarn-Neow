/* Jarn Neow service worker: makes return visits instant and lets the app work offline.
   - the page, expert.js, lab.js, lab-ind.js, lab-worker.js and index.json: network first, so a new version shows up straight away; the saved copy is used offline
   - gold month files, fonts, sprites and icons: from the device once downloaded (they never change), network otherwise
   Nothing here sends data anywhere; it only keeps copies of this site's own files in the browser. */
const VERSION = 'jn-v9';
const PAGE = 'jn-page-' + VERSION;
const FILES = 'jn-files-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(PAGE).then(c => c.addAll(['./', 'index.html', 'expert.js', 'icon.svg?v=2'])).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('jn-') && k !== PAGE && k !== FILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isFixed = url =>
  (/\/data\/gold\/\d{4}-\d{2}\.bin$/.test(url.pathname)) ||
  (url.origin === self.location.origin && /\/(fonts\/.+\.woff2|sprites\/[a-z_]+\.png|icon\.svg|icon-180\.png|og\.png)$/.test(url.pathname));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const cdn = url.hostname === 'cdn.jsdelivr.net';
  if (!own && !cdn) return;

  if (isFixed(url)) {
    e.respondWith(caches.open(FILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  if (own && (req.mode === 'navigate' || /\/(index\.html|expert\.js|lab\.js|lab-ind\.js|lab-worker\.js|data\/gold\/index\.json)$/.test(url.pathname) || url.pathname.endsWith('/'))) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(PAGE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.open(PAGE).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || c.match('index.html')))));
  }
});
