/**
 * Service Worker · Ноев Ковчег PWA M1
 * © Кагиров Абдул-Хаким Ахмадович, 2026. Все права защищены.
 * Universal Copyright Convention, Geneva 1952.
 *
 * Стратегия:
 *  - Cache First для статики (HTML, CSS, JS, шрифты, иконки)
 *  - Network First для i18n переводов (чтобы получать обновления, но работать оффлайн)
 *  - Stale While Revalidate для Google Fonts
 */

const CACHE_VERSION = 'noah-ark-pwa-v1.0.0';
const RUNTIME_CACHE = 'noah-ark-runtime-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './i18n/translations.js'
];

const FONT_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => { /* silent partial */ }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Fonts: stale-while-revalidate
  if (FONT_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // i18n переводы: network-first с fallback на кэш
  if (url.pathname.includes('/i18n/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Все остальные ресурсы: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Fallback на главную страницу для навигационных запросов
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Ноев Ковчег', {
      body: data.body || '',
      icon: 'assets/icons/icon-192.svg',
      badge: 'assets/icons/icon-192.svg',
      tag: data.tag || 'noah-ark-update',
      data: data.url || './'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data || './')
  );
});
