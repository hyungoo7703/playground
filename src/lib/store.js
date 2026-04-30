import { writable, derived } from "svelte/store";

export const base = import.meta.env.PROD ? "/playground" : "";
export const deferredPrompt = writable(null);
export const isLoggedIn = writable(!!localStorage.getItem("accessCode"));
// 현재 사용자 (추후 로그인 시 설정)
export const currentUser = writable(localStorage.getItem("currentUser"));
// 사용자 역할 (admin/member)
export const userRole = writable(localStorage.getItem("role"));
// 관리자 여부 판별 (통일된 단일 소스)
export const isAdmin = derived(
  [currentUser, userRole],
  ([$currentUser, $userRole]) =>
    $userRole === "admin" || $currentUser === "현구"
);

const _d = (s, k) => {
  const b = atob(s);
  let r = "";
  for (let i = 0; i < b.length; i++) r += String.fromCharCode(b.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  return r;
};
export const GAS_URL = _d(
  "GBNZFhJXAh1DUUREGxFXFwhCAQ0IA1FfXxlACgYLHxQCFU4sZlRJUVRUMy4YGAUePgMEG3ABe2N1MjMyAhJDMVZaG3VRYlh+WykBEgR8UiMUTlxKQm51AD8QPSpjETlZfmR+R2NsWSABFigCAxkITg==",
  "pg-fam-2026-key"
);

// 메뉴 상태 관리
export const isMenuOpen = writable(false);

const getSaveData = () => {
  // 브라우저 환경인지 확인
  if (typeof window === "undefined" || !window.localStorage)
    return { level: 1, highScore: 0 };
  const save = localStorage.getItem("neon_blast_save");
  if (!save) return { level: 1, highScore: 0 };
  try {
    return JSON.parse(save);
  } catch {
    localStorage.removeItem("neon_blast_save");
    return { level: 1, highScore: 0 };
  }
};

const initialSave = getSaveData();

export const gameStore = writable({
  balls: [],
  pegs: [],
  zones: [],
  portals: [],
  movingWalls: [],
  rotatingBars: [],
  score: 0,
  ballsLeft: 10,
  isWin: false,
  isGameOver: false,
  currentLevel: initialSave.level || 1,
  highScore: initialSave.highScore || 0,
  wasZoneActive: false,
  suctionTarget: null,
  particles: [],
  floatingTexts: [],
  currentCombo: 0,
  shake: 0
});

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

  if (typeof window !== "undefined") {
    // 테마 초기 적용
    document.documentElement.classList.toggle("dark", initialValue);
  }

  return {
    subscribe,
    set: (value) => {
      if (typeof window !== "undefined") {
        if (value) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("isDarkMode", String(value));
      }
      set(value);
    },
    update,
  };
};

export const isDarkMode = createDarkModeStore();
