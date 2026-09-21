// Offline shell: network first, falls back to cache. Firestore traffic is not touched.
const CACHE = 'chores-v1';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin || url.hostname === 'www.gstatic.com' || url.hostname.endsWith('googleapis.com') && url.pathname.startsWith('/css') || url.hostname === 'fonts.gstatic.com';
  if (!ours) return;
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); if (res.ok || res.type === 'opaque') caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
