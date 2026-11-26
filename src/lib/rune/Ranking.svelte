<script>
  // Endless mode's family ranking: each member's furthest wave, best first.
  export let ranking; // [{ user_name, wave }], sorted
  export let records; // null while loading, false when the server could not answer
  export let localBest; // this device's own best, shown when there is no ranking to show
  export let me;

  const MEDALS = ["🥇", "🥈", "🥉"];
</script>

{#if records === null}
  <p class="text-sm text-gray-300 animate-pulse">랭킹 불러오는 중...</p>
{:else if records === false}
  <p class="text-sm text-gray-300">랭킹을 불러오지 못했어요.</p>
  {#if localBest}
    <p class="mt-1 text-sm text-gray-300">이 기기의 최고 기록: {localBest}웨이브</p>
  {/if}
{:else if ranking.length === 0}
  <p class="text-sm text-gray-300">아직 기록이 없어요. 첫 기록을 남겨 보세요!</p>
{:else}
  <ol class="space-y-1.5 text-left">
    {#each ranking as record, i}
      <li
        class="flex items-center gap-2 px-3 py-2 rounded-xl border {record.user_name === me
          ? 'bg-amber-400/15 border-amber-300/50'
          : 'bg-white/5 border-white/10'}"
      >
        <span class="w-7 text-center font-black">{MEDALS[i] ?? i + 1}</span>
        <span class="flex-1 min-w-0 truncate font-bold">{record.user_name}</span>
        <span class="font-black text-amber-200">{record.wave}웨이브</span>
      </li>
    {/each}
  </ol>
{/if}
