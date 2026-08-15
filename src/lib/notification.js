// src/lib/notification.js
import { api } from "./api.js";

// VAPID 공개키 (W3C Web Push 표준 구독용)
export const VAPID_PUBLIC_KEY =
  "BKRtKA5eDKo1RjjYghcIbfoLryuHK2twsFIzRMjJ0As_nFGmqC2rgq3KN0KsJIXEIWOOQ0eVXMFGh_RAEegEFvo";

// URL-safe Base64를 Uint8Array로 변환
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 브라우저의 알림 API 지원 여부 확인
export function isNotificationSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

// 현재 알림 권한 상태 ('granted', 'denied', 'default', 'unsupported')
export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

// 알림 권한 요청 및 구글 시트에 기기 푸시 주소 등록
export async function registerPushDevice(customUserName = null) {
  if (!isNotificationSupported()) {
    throw new Error("이 브라우저는 웹 푸시 알림(Push API)을 지원하지 않습니다.");
  }

  // 1. 브라우저 권한 요청
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, permission, message: "알림 권한이 허용되지 않았습니다." };
  }

  // 2. 서비스 워커 및 PushManager 구독 생성
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (e) {
      console.warn("VAPID 구독 생성 실패, 기본 구독 시도:", e);
      // 구형 브라우저 또는 VAPID 제약 fallback
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
      });
    }
  }

  if (!subscription) {
    throw new Error("푸시 구독 객체 생성에 실패했습니다.");
  }

  const userName =
    customUserName ||
    localStorage.getItem("userName") ||
    localStorage.getItem("currentUser") ||
    "가족";

  // 3. 구글 앱스 스크립트(GAS)로 기기 정보 전송 및 저장
  const res = await api.savePushDevice({
    user_name: userName,
    subscription: subscription.toJSON ? subscription.toJSON() : subscription,
  });

  if (res && res.success) {
    localStorage.setItem("isPushRegistered", "true");
    localStorage.setItem("lastPushUser", userName);
    return { success: true, permission: "granted", message: "기기 등록 완료" };
  } else {
    throw new Error(res?.message || "구글 시트에 기기 등록 실패");
  }
}

// 이미 권한이 허용된 경우 백그라운드 자동 기기 등록 (페이지 로드 시 호출)
export async function autoRegisterPushIfGranted() {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  const isRegistered = localStorage.getItem("isPushRegistered");
  const currentUser = localStorage.getItem("userName") || "가족";
  const lastUser = localStorage.getItem("lastPushUser");

  // 이미 등록되었고 사용자가 동일하면 중복 요청 생략 (0ms)
  if (isRegistered === "true" && lastUser === currentUser) return;

  try {
    await registerPushDevice(currentUser);
  } catch (e) {
    console.debug("백그라운드 푸시 자동 등록 시도 중:", e.message);
  }
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
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, defaultOptions);
        return true;
      }
    }

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
