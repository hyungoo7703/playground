<script>
    export let title;
    export let description;
    export let badge;
    export let onClick;

    // Styling props allow full customization via Tailwind classes
    export let className = "";
    export let badgeClass = "";
    export let titleClass = "";
    export let descClass = "";
    export let actionBtnClass = "";
    export let contentContainerClass = "bg-white dark:bg-gray-800";
</script>

<button
    on:click={onClick}
    class="{className} relative group overflow-hidden rounded-[2rem] text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]"
>
    <!-- Background Effects (Absolute positioned elements) -->
    <slot name="background"></slot>

    <!-- Modern Gradient Overlay on Hover -->
    <div
        class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20"
    ></div>

    <!-- Content Container -->
    <div
        class="relative flex h-full flex-col justify-between rounded-[2rem] p-8 z-10 {contentContainerClass} border border-white/5"
    >
        <div>
            <div class="flex gap-2 items-center mb-4">
                {#if badge}
                    <span
                        class="{badgeClass} inline-block px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full backdrop-blur-md"
                    >
                        {badge}
                    </span>
                {/if}
                <slot name="badge-extra"></slot>
            </div>

            <h2
                class="{titleClass} text-3xl font-extrabold mb-3 tracking-tight"
            >
                {title}
            </h2>
            <p
                class="{descClass} text-sm font-medium leading-relaxed opacity-90"
            >
                {@html description}
            </p>
        </div>

        <div class="mt-10 flex items-end justify-between">
            <!-- Decoration Area -->
            <div class="flex items-center gap-3">
                <slot name="decoration"></slot>
            </div>

            <!-- Modern Action Button -->
            <div
                class="{actionBtnClass} w-12 h-12 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300"
            >
                <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                    ></path>
                </svg>
            </div>
        </div>
    </div>
</button>

<style>
    button {
        -webkit-tap-highlight-color: transparent;
        outline: none;
    }
</style>
