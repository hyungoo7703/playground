<script>
  export let label = "불러오는 중...";
</script>

<div
  class="flex flex-col items-center justify-center gap-4 py-14"
  role="status"
  aria-label={label}
>
  <div class="flex items-end gap-1.5 h-5">
    <span class="dot bg-indigo-500" style="animation-delay: 0ms"></span>
    <span class="dot bg-pink-500" style="animation-delay: 130ms"></span>
    <span class="dot bg-amber-400" style="animation-delay: 260ms"></span>
  </div>
  <p class="text-xs font-bold text-gray-400 dark:text-gray-500 tracking-wide">
    {label}
  </p>
</div>

<style>
  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 9999px;
    animation: bounce-dot 0.9s ease-in-out infinite;
  }
  @keyframes bounce-dot {
    0%,
    70%,
    100% {
      transform: translateY(0) scale(1);
      opacity: 0.4;
    }
    35% {
      transform: translateY(-0.55rem) scale(1.15);
      opacity: 1;
    }
  }
</style>
