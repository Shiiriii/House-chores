// Service worker: offline shell + push notifications (Firebase Cloud Messaging)
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: "AIzaSyAdVU7RubIOSGxm3NCi80Z7mHFv-kPTP1E",
  authDomain: "house-chores-30a7a.firebaseapp.com",
  projectId: "house-chores-30a7a",
  storageBucket: "house-chores-30a7a.firebasestorage.app",
  messagingSenderId: "490086973531",
  appId: "1:490086973531:web:34c918f8031d1f5a3dff7e"
});
firebase.messaging(); // shows incoming notifications and opens the app on tap

const CACHE = 'chores-v2';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin || url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (!ours) return;
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); if (res.ok || res.type === 'opaque') caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
