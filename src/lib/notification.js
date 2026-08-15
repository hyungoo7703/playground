// src/lib/notification.js

// 브라우저의 알림 API 지원 여부 확인
export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

// 현재 알림 권한 상태 ('granted', 'denied', 'default', 'unsupported')
export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

// 알림 권한 요청
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    throw new Error("이 브라우저는 웹 알림(Notification)을 지원하지 않습니다.");
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// 로컬 알림 발송 (서비스 워커 또는 Notification API 사용)
export async function showLocalNotification(title, options = {}) {
  if (!isNotificationSupported()) {
    console.warn("알림 미지원 브라우저입니다.");
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("알림 권한이 허용되지 않았습니다:", Notification.permission);
    return false;
  }

  const defaultOptions = {
    icon: "./icon-192x192.png",
    badge: "./icon-192x192.png",
    vibrate: [100, 50, 100],
    data: {
      url: window.location.origin + window.location.pathname,
    },
    ...options,
  };

  try {
    // 1. PWA 서비스 워커 등록 객체를 통한 알림 발송 (스마트폰 백그라운드 및 모바일 호환성 최고)
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, defaultOptions);
        return true;
      }
    }

    // 2. 데스크톱 일반 Notification 객체 폴백
    new Notification(title, defaultOptions);
    return true;
  } catch (error) {
    console.error("알림 발송 실패:", error);
    return false;
  }
}

// 테스트 알림 발송 함수
export async function sendTestNotification() {
  return showLocalNotification("가족 놀이터 🔔", {
    body: "푸시 알림이 정상적으로 작동하고 있습니다! 환영합니다 ✨",
    tag: "test-notification",
  });
}
