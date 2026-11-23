<script>
  import { navigate } from "svelte-routing";
  import { base, isAdmin } from "../lib/store.js";

  const go = (path) => navigate(`${base}${path}`);

  const groups = [
    {
      title: "가족",
      items: [
        { path: "/attendance", label: "출석체크", emoji: "✅" },
        { path: "/bulletin-board", label: "가족 게시판", emoji: "📝" },
        { path: "/food-spinner", label: "오늘 뭐 먹지?", emoji: "🍽️" },
        { path: "/card-pick", label: "용돈 카드뽑기", emoji: "🎁", adminOnly: true },
      ],
    },
    {
      title: "도구",
      items: [{ path: "/stock", label: "주식 모으기", emoji: "📊" }],
    },
    {
      title: "기타",
      items: [{ path: "/settings", label: "설정", emoji: "⚙️" }],
    },
  ];
</script>

<div class="max-w-md mx-auto space-y-6">
  <h1 class="text-2xl font-black text-gray-900 dark:text-white">전체 메뉴</h1>


  {#each groups as group}
    {@const visibleItems = group.items.filter(
      (item) => !item.adminOnly || $isAdmin,
    )}
    {#if visibleItems.length > 0}
      <section>
        <h3
          class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3"
        >
          {group.title}
        </h3>
        <div class="grid grid-cols-3 gap-3">
          {#each visibleItems as item}
            <button
              on:click={() => go(item.path)}
              class="flex flex-col items-center justify-center gap-2 py-5 px-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 active:scale-95 transition-all"
            >
              <span class="text-3xl leading-none">{item.emoji}</span>
              <span
                class="text-xs font-bold text-gray-700 dark:text-gray-200 text-center leading-tight break-keep"
                >{item.label}</span
              >
            </button>
          {/each}
        </div>
      </section>
    {/if}
  {/each}
</div>
