<script>
  import { Link, useLocation } from "svelte-routing";
  import { base } from "./store.js";

  const location = useLocation();

  // 출석체크는 홈 카드에서 진입 (탭 아님)
  const tabs = [
    { path: "/", label: "홈", emoji: "🏠" },
    { path: "/ledger", label: "장부", emoji: "💰" },
    { path: "/events", label: "일정", emoji: "📅" },
    { path: "/bulletin-board", label: "게시판", emoji: "📝" },
    { path: "/menu", label: "전체", emoji: "🧩" },
  ];

  $: fullPath = (path) => (path === "/" ? base || "/" : `${base}${path}`);

  const normalize = (p) => p.replace(/\/$/, "") || "/";

  $: isActive = (path) => {
    const current = normalize($location.pathname);
    if (current === normalize(fullPath(path))) return true;
    // 설정·주식·게임 등 탭에 없는 페이지는 '전체' 소속으로 표시
    if (path === "/menu") {
      return !tabs.some((t) => normalize(fullPath(t.path)) === current);
    }
    return false;
  };
</script>

<nav
  class="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]"
  aria-label="주요 메뉴"
>
  <div class="max-w-md mx-auto grid grid-cols-5">
    {#each tabs as tab}
      <Link
        to={fullPath(tab.path)}
        class="flex flex-col items-center justify-center gap-1 py-2 min-h-[60px] transition-colors {isActive(
          tab.path,
        )
          ? 'text-indigo-600 dark:text-indigo-300'
          : 'text-gray-400 dark:text-gray-500'}"
        aria-label={tab.label}
      >
        <span
          class="text-[1.375rem] leading-none transition-all {isActive(tab.path)
            ? 'scale-110'
            : 'grayscale opacity-60'}">{tab.emoji}</span
        >
        <span class="text-[11px] font-bold leading-none">{tab.label}</span>
      </Link>
    {/each}
  </div>
</nav>
