import { writable, derived } from "svelte/store";

// Vite's base (vite.config.js) is the single source; strip trailing slash for routing
export const base = import.meta.env.BASE_URL.replace(/\/$/, "");
export const deferredPrompt = writable(null);
// "session" is the token the server signs at login; "accessCode" is what devices kept before tokens existed
export const isLoggedIn = writable(Boolean(localStorage.getItem("session") || localStorage.getItem("accessCode")));

// 로그인 정보만 삭제 (게임 세이브, 다크모드 등은 유지)
export function signOut() {
  ["session", "accessCode", "userName", "currentUser", "role", "aiToken"].forEach((key) => localStorage.removeItem(key));
  location.reload();
}
// 현재 사용자 (추후 로그인 시 설정)
export const currentUser = writable(localStorage.getItem("currentUser"));
// 사용자 역할 (admin/member) — 값이 없으면 비관리자로 (fail-closed)
export const userRole = writable(localStorage.getItem("role") || "member");
// 관리자 여부 판별 — '현구' 또는 role === 'admin'
export const isAdmin = derived(
  [userRole, currentUser],
  ([$userRole, $currentUser]) => $userRole === "admin" || $currentUser === "현구"
);


const _d = (s, k) => {
  const b = atob(s);
  let r = "";
  for (let i = 0; i < b.length; i++) r += String.fromCharCode(b.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  return r;
};
export const GAS_URL = _d(
  "GBNZFhJXAh1DUUREGxFXFwhCAQ0IA1FfXxlACgYLHxQCFU4sZlRJUVRaBVAqIDcfCBE6WVxca1NfJyFONB1rAjY9YVlmaGFGH1Y1QQJVDDEjHXtfW3JBMgItBDBIEzY+d2BlY05uHhwSPy8CAxkITg==",
  "pg-fam-2026-key"
);


export const APP_SECRET = _d("FgZASxsqTwBUA3t1HxEJKj5vIFU=", "pg-fam-2026-key");

// 다크 모드 관리
const createDarkModeStore = () => {
  let initialValue = false;
  if (typeof window !== "undefined") {
    const fromStorage = localStorage.getItem("isDarkMode");
    if (fromStorage) {
      initialValue = fromStorage === "true";
    } else {
      initialValue = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
  }

  const { subscribe, set, update } = writable(initialValue);

  // 테마 + 상태바 색상 적용 (gray-100 / gray-900)
  const apply = (value) => {
    document.documentElement.classList.toggle("dark", value);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", value ? "#111827" : "#f3f4f6");
  };

  if (typeof window !== "undefined") apply(initialValue);

  return {
    subscribe,
    set: (value) => {
      if (typeof window !== "undefined") {
        apply(value);
        localStorage.setItem("isDarkMode", String(value));
      }
      set(value);
    },
    update,
  };
};

export const isDarkMode = createDarkModeStore();
