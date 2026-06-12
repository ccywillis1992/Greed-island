// Service worker for Futu Wealth progressive web app (PWA)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Simple pass-through so live stock & performance queries remain fresh
  e.respondWith(fetch(e.request));
});
