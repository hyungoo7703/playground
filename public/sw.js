// sw.js
const CACHE_NAME = "family-playground-v2";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192x192.png",
  "./icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 이전 버전 캐시 정리 + 클라이언트 즉시 제어
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// fetch 이벤트 (Network First 전략으로 최신 파일 우선 로드)
self.addEventListener("fetch", (event) => {
  // POST 등 비-GET 요청은 캐싱하지 않음
  if (event.request.method !== "GET") return;

  // chrome-extension 등 비-http 스키마 제외
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return new Response("Network error", {
          status: 408,
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});

// 알림 클릭 이벤트 핸들러
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen =
    (event.notification.data && event.notification.data.url) || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if ("focus" in client) {
          if ("navigate" in client && urlToOpen !== "./") {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// 백그라운드 원격 푸시 수신 (커플앱 구조 기반 bulletproof 핸들러)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "가족 놀이터 🔔";
  const options = {
    body: data.body || "새로운 가족 알림이 도착했습니다.",
    icon: "./icon-192x192.png",
    badge: "./icon-192x192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || (data.data && data.data.url) || "./",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
