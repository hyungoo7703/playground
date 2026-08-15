// sw.js
const CACHE_NAME = "family-playground-v1";
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
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // GAS API 요청은 서비스 워커가 개입하지 않음
  if (url.includes("script.google.com")) {
    return;
  }

  // Network-First 전략: 네트워크 우선, 실패 시 캐시 사용
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 정상 응답이면 캐시에 저장 후 반환
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 검색
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response("오프라인 상태입니다.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        });
      })
  );
});

// 푸시 알림 클릭 시 앱 열기 / 포커스
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// 백그라운드 원격 푸시 수신 (VAPID/WebPush 확장용)
self.addEventListener("push", (event) => {
  let title = "가족 놀이터";
  let options = {
    body: "새로운 알림이 도착했습니다.",
    icon: "./icon-192x192.png",
    badge: "./icon-192x192.png",
    vibrate: [100, 50, 100],
  };

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      options = { ...options, ...data };
    } catch {
      options.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

