<script>
    import { onMount, onDestroy } from "svelte";
    import { navigate } from "svelte-routing";
    import { base, currentUser } from "../lib/store.js";
    import { get } from "svelte/store";
    import { fade, fly, scale } from "svelte/transition";
    import { GameEngine } from "../lib/neon/survivor/core/GameEngine.js";
    import {
        SHOP_ITEMS,
        WEAPONS,
        ULTIMATE_MAX,
        getUpgradeCost,
        IN_GAME_UPGRADES,
        IMAGES,
    } from "../lib/neon/survivor/config/constants.js";

    let canvas;
    let engine;
    let gameState = "loading";
    let loadProgress = 0;

    // Shop State
    let showShop = false;
    let shopTab = "upgrade"; // 'upgrade' | 'weapon'
    let uiState = {
        hp: 100,
        maxHp: 100,
        exp: 0,
        maxExp: 10,
        level: 1,
        coins: 0,
        ultimateGauge: 0,
        gameTime: 0,
        bossWarning: false,
    };

    let showLevelUp = false;
    let levelUpOptions = [];

    onMount(async () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        engine = new GameEngine(
            canvas,
            (coins) => {
                gameState = "gameover";
            },
            (coins) => {
                gameState = "win";
            },
            (state) => {
                uiState = state;
            },
            (newLevel) => {
                // Engine is already paused by its own logic, but we sync state here
                gameState = "levelup";
                showLevelUp = true;
                generateLevelUpOptions();
            },
        );

        const user = get(currentUser);
        if (
            (user === "현구" ||
                user === "현구만" ||
                user === "관리자" ||
                user === "네온서바이버 관리자") &&
            engine.upgradeSystem.getCoins() === 0
        ) {
            engine.upgradeSystem.addCoins(100000);
        }

        await engine.init((progress) => {
            loadProgress = progress;
        });

        // Artificial delay to see the loading screen (optional but nice)
        setTimeout(() => {
            gameState = "start";
        }, 500);

        window.addEventListener("resize", handleResize);
    });

    onDestroy(() => {
        if (engine) engine.stopLoop();
        window.removeEventListener("resize", handleResize);
    });

    function handleResize() {
        if (canvas && engine) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            engine.resize(window.innerWidth, window.innerHeight);
        }
    }

    function generateLevelUpOptions() {
        const shuffled = [...IN_GAME_UPGRADES].sort(() => 0.5 - Math.random());
        levelUpOptions = shuffled.slice(0, 3);
    }

    function selectUpgrade(upgrade) {
        if (engine) {
            engine.applyUpgrade(upgrade.id);
            showLevelUp = false;
            gameState = "playing";
            engine.resume();
        }
    }

    function startGame() {
        if (!engine) return;
        gameState = "playing";
        engine.startLoop();
    }

    function togglePause() {
        if (showLevelUp) return;
        if (gameState === "playing") {
            gameState = "paused";
            engine.pause();
        } else if (gameState === "paused") {
            gameState = "playing";
            engine.resume();
        }
    }

    function activateUltimate() {
        if (engine) engine.activateUltimate();
    }

    // --- Joystick Logic ---
    let joystickActive = false;
    let joystickData = { startX: 0, startY: 0, currentX: 0, currentY: 0 };

    function handleTouchStart(e) {
        if (gameState !== "playing") return;
        const touch = e.touches[0];

        // Ignore if touching Ultimate button area (Bottom Right roughly)
        const ultX = window.innerWidth - 60;
        const ultY = window.innerHeight - 60;
        if (Math.hypot(touch.clientX - ultX, touch.clientY - ultY) < 80) {
            activateUltimate();
            return;
        }

        joystickActive = true;
        joystickData.startX = touch.clientX;
        joystickData.startY = touch.clientY;
        joystickData.currentX = touch.clientX;
        joystickData.currentY = touch.clientY;
    }

    function handleTouchMove(e) {
        if (!joystickActive) return;
        const touch = e.touches[0];
        joystickData.currentX = touch.clientX;
        joystickData.currentY = touch.clientY;

        const maxDist = 50;
        const dx = joystickData.currentX - joystickData.startX;
        const dy = joystickData.currentY - joystickData.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let vx = dx;
        let vy = dy;

        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            vx = Math.cos(angle) * maxDist;
            vy = Math.sin(angle) * maxDist;
        }

        if (engine) {
            engine.inputManager.setJoystick(vx / maxDist, vy / maxDist);
        }
    }

    function handleTouchEnd() {
        joystickActive = false;
        if (engine) engine.inputManager.setJoystick(0, 0);
    }

    function buyUpgrade(itemId) {
        if (engine && engine.upgradeSystem.buyUpgrade(itemId)) {
            engine.upgradeSystem = engine.upgradeSystem;
        }
    }

    function refundUpgrades() {
        if (engine && confirm("초기화 하시겠습니까?")) {
            engine.upgradeSystem.refund();
            window.location.reload();
        }
    }

    // --- Gacha Animation State ---
    let gachaState = "idle"; // idle, shaking, revealed
    let gachaResult = null;
    let gachaTimer = null;
    let toastMessage = "";
    let toastTimer = null;

    function showToast(msg) {
        toastMessage = msg;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastMessage = "";
        }, 3000);
    }

    function drawWeapon() {
        if (!engine) return; // Keep the engine check

        // Clear any existing timer to prevent race conditions from spamming
        if (gachaTimer) clearTimeout(gachaTimer);

        const result = engine.upgradeSystem.gachaWeapon();
        if (result.success) {
            gachaResult = result;
            gachaState = "shaking";
            engine.assetManager.playSound("click"); // Replace with shaking sound if available

            // Animation Sequence
            gachaTimer = setTimeout(() => {
                // Guard clause: If user closed gacha or state changed, don't proceed
                if (gachaState !== "shaking") return;

                gachaState = "revealed";
                engine.assetManager.playSound(
                    result.weapon.rarity === "legendary" ? "levelup" : "coin",
                );
            }, 2000); // 2 seconds shake
        } else {
            showToast("코인이 부족합니다!");
        }
    }

    function closeGacha() {
        if (gachaTimer) clearTimeout(gachaTimer);
        gachaState = "idle";
        gachaResult = null;
        if (engine) {
            // Add engine check for safety
            engine.upgradeSystem = engine.upgradeSystem; // Trigger reactivity
        }
    }

    function equipWeapon(id) {
        if (engine && engine.upgradeSystem.equipWeapon(id)) {
            engine.upgradeSystem = engine.upgradeSystem;
        }
    }

    $: formattedTime = () => {
        const t = Math.floor(uiState.gameTime / 1000);
        const m = Math.floor(t / 60);
        const s = t % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };
</script>

<div
    class="relative w-full h-full overflow-hidden bg-gray-900 select-none touch-none"
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
>
    <canvas bind:this={canvas} class="block w-full h-full"></canvas>

    <!-- Boss Warning -->
    {#if uiState.bossWarning}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 bg-red-900/20 animate-pulse"
        >
            <h2
                class="text-8xl font-black text-red-500 tracking-tighter drop-shadow-2xl"
            >
                WARNING
            </h2>
        </div>
    {/if}

    <!-- Joystick Visual -->
    {#if joystickActive && gameState === "playing"}
        <div
            class="absolute w-24 h-24 rounded-full border-2 border-white/20 bg-white/5 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 backdrop-blur-sm"
            style="left: {joystickData.startX}px; top: {joystickData.startY}px;"
        >
            <div
                class="absolute w-10 h-10 rounded-full bg-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.5)] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                style="transform: translate({joystickData.currentX -
                    joystickData.startX}px, {joystickData.currentY -
                    joystickData.startY}px) translate(-50%, -50%);"
            ></div>
        </div>
    {/if}

    <!-- Loading Screen -->
    {#if gameState === "loading"}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-50"
        >
            <div
                class="absolute inset-0 bg-cover bg-center opacity-50 blur-sm"
                style="background-image: url({IMAGES.main})"
            ></div>
            <div class="relative z-10 w-64">
                <div
                    class="w-full h-4 bg-gray-800 rounded-full border border-gray-700 overflow-hidden relative shadow-[0_0_10px_#0ff]"
                >
                    <div
                        class="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-200"
                        style="width: {loadProgress}%"
                    ></div>
                </div>
                <p
                    class="mt-4 text-center text-cyan-300 font-mono text-xs tracking-widest"
                >
                    LOADING... {Math.round(loadProgress)}%
                </p>
            </div>
        </div>
    {/if}

    <!-- UI Overlay -->
    {#if gameState === "start"}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 text-white gap-8"
            transition:fade
        >
            <h1
                class="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 neon-text text-center px-4"
            >
                NEON SURVIVOR
            </h1>

            <button
                on:click={startGame}
                class="px-12 py-5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-2xl rounded-full shadow-[0_0_30px_rgba(34,211,238,0.6)] transition-all transform hover:scale-105"
            >
                GAME START
            </button>

            <button
                on:click={() => (showShop = true)}
                class="px-8 py-3 border-2 border-yellow-500 text-yellow-500 font-bold rounded-full hover:bg-yellow-500 hover:text-black transition-all"
            >
                UPGRADE SHOP
            </button>
        </div>
    {/if}

    {#if (gameState === "playing" || gameState === "paused" || gameState === "levelup") && !showShop}
        <!-- HUD -->
        <div
            class="absolute top-0 left-0 w-full pointer-events-none sticky-hud z-[90]"
            style="padding-top: max(6rem, env(safe-area-inset-top) + 1rem); padding-left: max(1rem, env(safe-area-inset-left)); padding-right: max(1rem, env(safe-area-inset-right));"
        >
            <div class="flex justify-between items-start">
                <div class="flex flex-col gap-2">
                    <!-- HP -->
                    <div
                        class="w-64 h-6 bg-gray-800/80 rounded-full border border-white/10 overflow-hidden relative"
                    >
                        <div
                            class="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                            style="width: {(uiState.hp / uiState.maxHp) * 100}%"
                        ></div>
                        <span
                            class="absolute inset-0 flex items-center justify-center text-xs font-bold text-white shadow-md"
                            >{Math.ceil(uiState.hp)} / {Math.ceil(
                                uiState.maxHp,
                            )}</span
                        >
                    </div>
                    <!-- EXP -->
                    <div
                        class="w-64 h-4 bg-gray-800/80 rounded-full border border-white/10 overflow-hidden relative"
                    >
                        <div
                            class="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
                            style="width: {(uiState.exp / uiState.maxExp) *
                                100}%"
                        ></div>
                        <span
                            class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-md"
                            >LV. {uiState.level}</span
                        >
                    </div>
                </div>

                <div class="flex flex-col items-end">
                    <div
                        class="text-4xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    >
                        {formattedTime()}
                    </div>
                    <div
                        class="text-yellow-400 font-bold flex items-center gap-2 mt-1"
                    >
                        <span>🪙</span>
                        {uiState.coins}
                    </div>
                </div>
            </div>

            <!-- Boss HP Bar -->
            {#if uiState.boss}
                <div
                    class="absolute top-40 left-1/2 transform -translate-x-1/2 w-full max-w-lg px-4"
                >
                    <div
                        class="w-full h-8 bg-gray-900/90 rounded-full border-2 border-red-600 overflow-hidden relative shadow-[0_0_15px_#f00]"
                    >
                        <div
                            class="h-full bg-gradient-to-r from-red-800 to-red-500 transition-all duration-200"
                            style="width: {(uiState.boss.hp /
                                (uiState.boss.bossType === 2 ? 50000 : 30000)) *
                                100}%"
                        ></div>
                        <span
                            class="absolute inset-0 flex items-center justify-center text-sm font-black text-white drop-shadow-md"
                        >
                            BOSS
                        </span>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Pause Button -->
        <button
            on:click={togglePause}
            class="absolute top-24 right-4 z-40 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur"
        >
            {#if gameState === "paused"}▶{:else}⏸{/if}
        </button>

        <!-- Use Ultimate -->
        <button
            on:click={activateUltimate}
            class="absolute bottom-8 right-8 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 shadow-xl border-4 border-white/20 z-40 {uiState.ultimateGauge >=
            ULTIMATE_MAX
                ? 'bg-gradient-to-br from-red-500 to-orange-600 animate-pulse cursor-pointer'
                : 'bg-gray-800/80 grayscale'}"
        >
            <span class="text-4xl">🔥</span>
            <svg
                class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
            >
                <circle
                    cx="50%"
                    cy="50%"
                    r="46%"
                    fill="none"
                    stroke="white"
                    stroke-width="4"
                    stroke-opacity="0.2"
                />
                <circle
                    cx="50%"
                    cy="50%"
                    r="46%"
                    fill="none"
                    stroke="orange"
                    stroke-width="4"
                    stroke-dasharray="290"
                    stroke-dashoffset={290 -
                        (290 * uiState.ultimateGauge) / ULTIMATE_MAX}
                    class="transition-all duration-300"
                />
            </svg>
        </button>
    {/if}

    <!-- Level Up Modal (FIXED SIZE) -->
    {#if showLevelUp}
        <div
            class="absolute inset-0 bg-black/80 z-[80] flex flex-col items-center justify-center p-4"
            transition:fade
        >
            <div
                class="bg-gray-800 p-6 rounded-2xl border border-yellow-500/50 shadow-2xl w-full max-w-sm"
            >
                <h2
                    class="text-3xl font-black text-yellow-400 text-center mb-6 animate-bounce"
                >
                    LEVEL UP!
                </h2>
                <div class="space-y-3">
                    {#each levelUpOptions as option}
                        <button
                            on:click={() => selectUpgrade(option)}
                            class="w-full bg-gray-700 hover:bg-gray-600 active:bg-gray-500 p-4 rounded-xl border2 border-transparent hover:border-yellow-400 flex items-center gap-4 transition-all group text-left"
                        >
                            <div
                                class="text-3xl bg-gray-900 p-2 rounded-lg shrink-0"
                            >
                                {option.icon}
                            </div>
                            <div>
                                <h3
                                    class="text-lg font-bold text-white group-hover:text-yellow-300"
                                >
                                    {option.name}
                                </h3>
                                <p class="text-xs text-gray-300">
                                    {option.description}
                                </p>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    {/if}

    <!-- Gacha Animation Overlay -->
    {#if gachaState !== "idle" && gachaResult}
        <div
            class="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-8"
        >
            {#if gachaState === "shaking"}
                <div
                    class="animate-bounce-wild cursor-pointer"
                    on:click={() => (gachaState = "revealed")}
                >
                    <div
                        class="text-9xl mb-4 animate-shake text-center select-none"
                    >
                        📦
                    </div>
                    <p class="text-white text-center animate-pulse">
                        Tap to open!
                    </p>
                </div>
            {:else if gachaState === "revealed"}
                <div
                    class="text-center flex flex-col items-center animate-scale-in"
                >
                    <!-- Rarity Effect -->
                    <div class="relative mb-8">
                        <div
                            class="absolute inset-0 blur-[50px] opacity-50 rounded-full"
                            style="background-color: {gachaResult.weapon
                                .color}; transform: scale(3);"
                        ></div>
                        {#if gachaResult.weapon.rarity === "legendary"}
                            <!-- Godrays for Legendary -->
                            <div
                                class="absolute inset-0 animate-spin-slow opacity-70"
                            >
                                <div
                                    class="w-[500px] h-[500px] bg-gradient-conic from-transparent via-purple-500 to-transparent -translate-x-1/2 -translate-y-1/2"
                                ></div>
                            </div>
                        {:else if gachaResult.weapon.rarity === "mythic"}
                            <!-- COSMIC EFFECT for Mythic -->
                            <div
                                class="absolute inset-0 animate-spin-slow opacity-90 z-0"
                            >
                                <div
                                    class="w-[600px] h-[600px] bg-gradient-conic from-red-500 via-green-500 to-blue-500 blur-xl opacity-50"
                                ></div>
                            </div>
                            <div class="absolute inset-0 animate-pulse z-0">
                                <div
                                    class="w-full h-full bg-white/20 blur-3xl"
                                ></div>
                            </div>
                        {/if}

                        <div
                            class="w-32 h-32 rounded-2xl flex items-center justify-center border-4 border-white shadow-[0_0_50px_rgba(255,255,255,0.5)] relative z-10 bg-gray-900"
                            style="border-color: {gachaResult.weapon
                                .color}; box-shadow: 0 0 {gachaResult.weapon
                                .rarity === 'mythic'
                                ? '100px'
                                : '50px'} {gachaResult.weapon.color};"
                        >
                            <div
                                class="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                                style="background-color: {gachaResult.weapon
                                    .color}; text-shadow: 0 0 10px white;"
                            >
                                {#if gachaResult.weapon.shape === "star"}★{/if}
                                {#if gachaResult.weapon.shape === "rect"}■{/if}
                                {#if gachaResult.weapon.shape === "nova"}✷{/if}
                                {#if gachaResult.weapon.shape === "moon"}☾{/if}
                                {#if gachaResult.weapon.shape === "void"}●{/if}
                            </div>
                        </div>
                    </div>

                    <h2
                        class="text-4xl font-black text-white mb-2 uppercase drop-shadow-lg {gachaResult
                            .weapon.rarity === 'mythic'
                            ? 'animate-bounce'
                            : ''}"
                        style="color: {gachaResult.weapon.color}"
                    >
                        {gachaResult.weapon.name}
                    </h2>
                    <p
                        class="text-xl text-gray-300 font-bold mb-6 uppercase tracking-widest"
                    >
                        {gachaResult.weapon.rarity}
                    </p>

                    {#if gachaResult.checkDuplicate}
                        <div
                            class="bg-gray-800 px-6 py-2 rounded-full border border-yellow-500/50 mb-8 animate-bounce"
                        >
                            <span class="text-yellow-400 font-bold"
                                >⚠️ DUPLICATE!</span
                            >
                            {#if !gachaResult.isFree}
                                <span class="text-white ml-2"
                                    >Refunded +{gachaResult.refund} Coins</span
                                >
                            {:else}
                                <span class="text-gray-400 ml-2 text-xs"
                                    >(Free Draw: No Refund)</span
                                >
                            {/if}
                        </div>
                    {/if}

                    <div class="flex gap-4">
                        <button
                            on:click={closeGacha}
                            class="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-all"
                        >
                            닫기
                        </button>
                        <button
                            on:click={drawWeapon}
                            class="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-105 text-white rounded-xl font-bold shadow-lg transition-all"
                        >
                            다시 뽑기
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    {/if}
    <!-- End Gacha Overlay -->

    <!-- Toast Notification -->
    {#if toastMessage}
        <div
            class="absolute top-[20%] left-1/2 -translate-x-1/2 z-[200] bg-red-500/90 text-white px-6 py-3 rounded-full font-bold shadow-xl animate-bounce"
            style="pointer-events: none;"
        >
            {toastMessage}
        </div>
    {/if}

    <!-- Shop -->
    {#if showShop && engine && gachaState === "idle"}
        <div
            class="absolute inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center p-8"
            transition:fly={{ y: 50 }}
        >
            <h2 class="text-4xl font-black text-purple-400 mb-4">SHOP</h2>

            <!-- Shop Tabs -->
            <div class="flex gap-4 mb-6">
                <button
                    class="px-6 py-2 rounded-full font-bold transition-all {shopTab ===
                    'upgrade'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400'}"
                    on:click={() => (shopTab = "upgrade")}>UPGRADES</button
                >
                <button
                    class="px-6 py-2 rounded-full font-bold transition-all {shopTab ===
                    'weapon'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-800 text-gray-400'}"
                    on:click={() => (shopTab = "weapon")}>WEAPONS</button
                >
            </div>

            <div
                class="flex justify-between w-full max-w-md mb-4 items-center bg-gray-800 p-4 rounded-xl"
            >
                <span class="text-white"
                    >Coins: <span class="text-yellow-400 font-bold"
                        >{engine.upgradeSystem.getCoins()}</span
                    ></span
                >
            </div>

            <!-- UPGRADE TAB -->
            {#if shopTab === "upgrade"}
                <div
                    class="grid grid-cols-1 gap-4 w-full max-w-md overflow-y-auto max-h-[50vh]"
                >
                    {#each SHOP_ITEMS as item (item.id)}
                        {@const level = engine.upgradeSystem.getUpgradeLevel(
                            item.id,
                        )}
                        {@const cost = getUpgradeCost(item.cost, level)}
                        <button
                            on:click={() => buyUpgrade(item.id)}
                            class="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl border border-gray-700 flex items-center justify-between group transition-all"
                        >
                            <div class="flex items-center gap-4">
                                <span class="text-2xl">{item.icon}</span>
                                <div class="text-left">
                                    <div class="text-white font-bold">
                                        {item.name}
                                    </div>
                                    <div class="text-purple-400 text-xs">
                                        Lv. {level}
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-yellow-400 font-bold">
                                    {cost}
                                </div>
                            </div>
                        </button>
                    {/each}
                    <button
                        on:click={refundUpgrades}
                        class="mt-4 text-xs text-red-400 underline w-full text-center"
                        >Reset Upgrades</button
                    >
                </div>
            {/if}

            <!-- WEAPON TAB -->
            {#if shopTab === "weapon"}
                {@const freeDraws = engine.upgradeSystem.data.freeDraws || 0}
                <div
                    class="w-full max-w-md flex flex-col gap-4 max-h-[60vh] overflow-y-auto"
                >
                    <!-- Gacha Section -->
                    <div
                        class="bg-gray-800 p-6 rounded-2xl border border-cyan-500/30 text-center"
                    >
                        <h3 class="text-xl font-bold text-cyan-400 mb-2">
                            무기 뽑기
                        </h3>
                        <p class="text-xs text-gray-400 mb-4">
                            레전더리 무기에 도전!!
                        </p>

                        <button
                            on:click={drawWeapon}
                            class="w-full py-4 font-black text-white rounded-xl shadow-lg hover:scale-105 transition-all flex flex-col items-center justify-center gap-1
                                    {freeDraws > 0
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 animate-pulse'
                                : 'bg-gradient-to-r from-cyan-600 to-blue-600'}
                                "
                        >
                            {#if freeDraws > 0}
                                <span
                                    >(오픈기념)FREE DRAW! ({freeDraws} left)</span
                                >
                                <span class="text-xs opacity-80"
                                    >No duplicate refund</span
                                >
                            {:else}
                                <span>DRAW</span>
                                <span class="text-yellow-300 text-sm"
                                    >🪙 1000</span
                                >
                            {/if}
                        </button>
                    </div>

                    <!-- Inventory Section -->
                    <h3 class="text-lg font-bold text-white mt-4">INVENTORY</h3>
                    <div class="grid grid-cols-4 gap-2">
                        {#each WEAPONS as weapon}
                            {@const unlocked =
                                engine.upgradeSystem.data.unlockedWeapons.includes(
                                    weapon.id,
                                )}
                            {@const equipped =
                                engine.upgradeSystem.data.equippedWeapon ===
                                weapon.id}
                            {@const rarityColor =
                                weapon.rarity === "legendary"
                                    ? "border-purple-500 shadow-[0_0_10px_#a855f7]"
                                    : weapon.rarity === "epic"
                                      ? "border-red-500"
                                      : weapon.rarity === "rare"
                                        ? "border-blue-400"
                                        : "border-gray-600"}

                            <button
                                disabled={!unlocked}
                                on:click={() => equipWeapon(weapon.id)}
                                class="aspect-square rounded-xl border-2 flex flex-col items-center justify-center relative transition-all overflow-hidden
                                    {unlocked
                                    ? equipped
                                        ? 'border-yellow-400 bg-gray-700 ring-2 ring-yellow-400'
                                        : `${rarityColor} bg-gray-800 hover:border-white`
                                    : 'border-gray-800 bg-black/50 opacity-50 grayscale'}
                                "
                            >
                                <div
                                    class="w-6 h-6 mb-1"
                                    style="background-color: {weapon.color}; border-radius: 50%; box-shadow: 0 0 10px {weapon.color}"
                                >
                                    {#if weapon.shape === "star"}★{/if}
                                    {#if weapon.shape === "rect"}■{/if}
                                </div>
                                <span
                                    class="text-[8px] uppercase font-bold opacity-60 mb-0.5"
                                    style="color:{weapon.color}"
                                    >{weapon.rarity}</span
                                >
                                <span
                                    class="text-[10px] text-white truncate w-full text-center px-1 leading-tight"
                                    >{weapon.name}</span
                                >
                                {#if equipped}
                                    <span
                                        class="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full"
                                    ></span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <button
                on:click={() => {
                    showShop = false;
                    gameState = "start";
                }}
                class="mt-8 px-10 py-3 bg-white text-black font-bold rounded-full"
            >
                Close Shop
            </button>
        </div>
    {/if}

    {#if gameState === "gameover"}
        <div
            class="absolute inset-0 bg-black/90 z-[70] flex flex-col items-center justify-center text-white p-4"
            transition:scale
        >
            <h2
                class="text-4xl md:text-6xl font-black text-red-500 mb-4 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)] text-center"
            >
                GAME OVER
            </h2>
            <div class="text-xl mb-8 text-center">
                Survived: {formattedTime()}
            </div>
            <button
                on:click={() => {
                    gameState = "start";
                    engine.restart();
                }}
                class="px-10 py-3 bg-red-600 hover:bg-red-500 font-bold rounded-full text-xl shadow-lg"
            >
                Return to Lobby
            </button>
        </div>
    {/if}

    {#if gameState === "win"}
        <div
            class="absolute inset-0 bg-black/90 z-[70] flex flex-col items-center justify-center text-white p-4"
            transition:scale
        >
            <h2
                class="text-4xl md:text-6xl font-black text-yellow-400 mb-4 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] text-center"
            >
                VICTORY!
            </h2>
            <p class="text-xl mb-8 text-gray-300 text-center">
                Mission Complete
            </p>

            {#if !localStorage.getItem("neon_reward_claimed")}
                <button
                    class="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black text-xl rounded-full hover:scale-105 transition shadow-lg shadow-yellow-500/30 mb-4 animate-pulse"
                    on:click={() => {
                        localStorage.setItem("neon_reward_claimed", "true");
                        navigate(`${base}/card-pick`);
                    }}
                >
                    🎁 보상 받기
                </button>
            {/if}

            <button
                on:click={() => {
                    gameState = "start";
                    engine.restart();
                }}
                class="px-10 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-full text-xl shadow-lg"
            >
                Back to Lobby
            </button>
        </div>
    {/if}
</div>

<style>
    .neon-text {
        text-shadow:
            0 0 10px rgba(34, 211, 238, 0.5),
            0 0 20px rgba(168, 85, 247, 0.5);
    }
    .sticky-hud {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 50;
        width: 100%;
    }
    @keyframes shake {
        0%,
        100% {
            transform: rotate(0deg);
        }
        25% {
            transform: rotate(-5deg);
        }
        75% {
            transform: rotate(5deg);
        }
    }
    .animate-shake {
        animation: shake 0.2s infinite;
    }
    @keyframes spin-slow {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
    .animate-spin-slow {
        animation: spin-slow 10s linear infinite;
    }
    .bg-gradient-conic {
        background-image: conic-gradient(var(--tw-gradient-stops));
    }
</style>
