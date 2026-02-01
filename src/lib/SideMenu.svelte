<script>
  import { Link, useLocation } from "svelte-routing";
  import { base, isMenuOpen, currentUser } from "./store.js";

  const location = useLocation();

  function closeMenu() {
    isMenuOpen.set(false);
  }

  const menuItems = [
    {
      path: "/",
      title: "홈",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />',
    },
    {
      path: "/events",
      title: "가족 일정",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />',
    },
    {
      path: "/bulletin-board",
      title: "가족 게시판",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 2v6h6M8 9h1M8 13h6M8 17h6" />',
    },
    {
      path: "/ledger",
      title: "장부",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />',
    },
    {
      path: "/calculator-15",
      title: "15% 계산기",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />',
    },
    {
      path: "/pension-calculator",
      title: "연금저축 계산기",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />',
    },
    {
      path: "/stock",
      title: "주식 모으기",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />',
    },
    {
      path: "/fruit-pang",
      title: "과일 팡팡",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    },
    {
      path: "/neon-blast",
      title: "네온 블래스트",
      icon: `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M12 2L4 7v10l8 5 8-5V7l-8-5zM13 7l-5 7h4l-1 5 5-7h-4l1-5z" />
      `,
    },
    {
      path: "/neon-brick",
      title: "네온 브릭",
      icon: `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M12 2L4 7v10l8 5 8-5V7l-8-5zM13 7l-5 7h4l-1 5 5-7h-4l1-5z" />
      `,
    },
    {
      path: "/neon-survivor",
      title: "네온 서바이버",
      icon: `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      `,
    },
    {
      path: "/food-spinner",
      title: "오늘 뭐 먹지?",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.344l-.707-.707M8 12a4 4 0 118 0 4 4 0 01-8 0z" />',
    },

    {
      path: "/settings",
      title: "설정",
      icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" stroke-width="2" />',
    },
  ];

  // base가 '/playground'일 때 path가 '/events'면 '/playground/events' 생성
  $: getFullPath = (path) => {
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = path.startsWith("/") ? path : `/${path}`;
    return p === "/" ? b || "/" : `${b}${p}`;
  };

  // 활성화 상태 체크 (정규화하여 비교)
  $: isActive = (path) => {
    const current = $location.pathname.replace(/\/$/, "") || "/";
    const target = getFullPath(path).replace(/\/$/, "") || "/";
    return current === target;
  };
</script>

{#if $isMenuOpen}
  <div
    class="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm lg:hidden"
    on:click={closeMenu}
  ></div>
{/if}

<aside
  class="fixed top-0 left-0 z-40 w-64 h-screen transition-transform duration-300
    {$isMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
    bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
>
  <div class="flex items-center justify-between p-4 lg:hidden">
    <span class="text-xl font-bold dark:text-white">메뉴</span>
    <button on:click={closeMenu} class="p-2 text-gray-500">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
        ><path
          d="M6 18L18 6M6 6l12 12"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg
      >
    </button>
  </div>

  <nav class="px-4 py-6 overflow-y-auto h-[calc(100%-60px)]">
    <ul class="space-y-2 font-medium">
      {#each menuItems as item}
        <li>
          <Link
            to={getFullPath(item.path)}
            on:click={closeMenu}
            class="flex items-center w-full p-3 rounded-xl transition-all duration-200 group
              {isActive(item.path)
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
          >
            <svg
              class="flex-shrink-0 w-6 h-6 mr-4 transition-colors
                {isActive(item.path)
                ? 'text-indigo-600 dark:text-indigo-300'
                : 'text-gray-400 group-hover:text-gray-500'}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {@html item.icon}
            </svg>
            <span class="flex-1 text-left">{item.title}</span>
          </Link>
        </li>
      {/each}

      <!-- Admin Only Secret Ledger -->
      {#if $currentUser === "현구" || $currentUser === "관리자"}
        <li>
          <Link
            to={getFullPath("/secret-ledger")}
            on:click={closeMenu}
            class="flex items-center w-full p-3 rounded-xl transition-all duration-200 group
              {isActive('/secret-ledger')
              ? 'bg-gray-800 text-white'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}"
          >
            <svg
              class="flex-shrink-0 w-6 h-6 mr-4 transition-colors {isActive(
                '/secret-ledger',
              )
                ? 'text-white'
                : 'text-gray-400'}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span class="flex-1 text-left">비자금 장부 🤫</span>
          </Link>
        </li>
      {/if}
    </ul>
  </nav>
</aside>
