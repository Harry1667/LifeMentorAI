// Mentora Service Worker
const CACHE_NAME = 'mentora-v1'

// 預快取的靜態資源
const PRECACHE_URLS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// 安裝：預快取靜態資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// 啟動：清除舊版快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// 攔截請求
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API 請求：network only（不快取對話內容）
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // 靜態資源（圖片、字型）：cache first
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // 頁面和 JS/CSS：network first，失敗時用快取
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
