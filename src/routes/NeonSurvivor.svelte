<script>
    import { onMount, onDestroy } from "svelte";
    import { navigate } from "svelte-routing";
    import { base, isDarkMode } from "../lib/store.js";
    import { fade, fly, scale } from "svelte/transition";

    // --- Constants & Config ---
    const ASSET_PATH = `${base}/images/neon/survival`;
    const SOUND_PATH = `${base}/sounds/neon/survival`;

    const IMAGES = {
        hero: `${ASSET_PATH}/hero.png`,
        mobs: `${ASSET_PATH}/mobs.png`,
        boss: `${ASSET_PATH}/boss.png`,
        boss2: `${ASSET_PATH}/boss2.png`,
        items: `${ASSET_PATH}/EXPgems-and-coin.png`,
        main: `${ASSET_PATH}/main.png`,
        bg: `${ASSET_PATH}/background.png`,
        special: `${ASSET_PATH}/special_ability_icon.png`,
    };

    const SOUNDS = {
        bgm: `${SOUND_PATH}/retro-color-moon.mp3`,
        zap: `${SOUND_PATH}/laser-zap.mp3`,
        punch: `${SOUND_PATH}/punch.mp3`,
        coin: `${SOUND_PATH}/drop-coin.mp3`,
        levelup: `${SOUND_PATH}/level-up.mp3`,
        warning: `${SOUND_PATH}/beep-warning.mp3`,
        explosion: `${SOUND_PATH}/epic-cinematic-explosion.mp3`,
    };

    // --- Game State ---
    let canvas;
    let ctx;
    let animationId;
    let gameState = "loading"; // loading, start, playing, paused, levelup, gameover
    let assets = { images: {}, sounds: {} };
    let loadProgress = 0;
    let bossSpawned = false;
    let boss2Spawned = false;
    let showBossWarning = false;
    let bossWarningTimer = 0;
    let showBoss2Warning = false;
    let boss2WarningTimer = 0;
    let bossFightActive = false; // 보스전 중 시간 정지용
    let boss1DefeatedTime = 0; // 보스1 처치 시점 기록

    // --- 2. 영구 데이터 (Persistence) ---
    // User provided: "coins", "upgrades": { "hp":0, "speed":0, "magnet":0 }
    let savedData = JSON.parse(
        localStorage.getItem("neon_survivors_data") ||
            '{"coins":0, "highLevel":1, "upgrades":{"hp":0, "speed":0, "magnet":0}}',
    );

    function saveGame() {
        localStorage.setItem("neon_survivors_data", JSON.stringify(savedData));
    }

    // --- Shop Config ---
    const SHOP_ITEMS = [
        { id: "hp", name: "최대 체력", cost: 200, icon: "❤️" },
        { id: "speed", name: "이동 속도", cost: 300, icon: "⚡" },
        { id: "magnet", name: "자석 범위", cost: 250, icon: "🧲" },
        { id: "damage", name: "기본 공격력", cost: 500, icon: "⚔️" },
    ];

    function getUpgradeCost(baseCost, level) {
        // Inflation: Cost increases by 20% per level (1.2^level) - REBALANCED
        return Math.floor(baseCost * Math.pow(1.2, level));
    }

    function buyUpgrade(item) {
        if (!savedData.upgrades[item.id]) savedData.upgrades[item.id] = 0;

        const level = savedData.upgrades[item.id];
        const currentCost = getUpgradeCost(item.cost, level);

        if (savedData.coins >= currentCost) {
            savedData.coins -= currentCost;
            savedData.upgrades[item.id]++;
            saveGame();
            // Force Reactivity
            savedData = { ...savedData };
        }
    }

    function refundUpgrades() {
        if (
            !confirm(
                "모든 업그레이드를 초기화하시겠습니까?\n\n⚠️ 주의: 환불 코인은 '등급 × 기본 가격'으로 계산됩니다.\n(물가 상승으로 추가 지불한 코인은 돌려받지 못합니다!)",
            )
        )
            return;

        let totalRefund = 0;
        SHOP_ITEMS.forEach((item) => {
            const lvl = savedData.upgrades[item.id] || 0;
            if (lvl > 0) {
                // Refund Policy: Base Cost * Level only (Inflation tax is lost)
                totalRefund += item.cost * lvl;
                savedData.upgrades[item.id] = 0;
            }
        });

        savedData.coins += totalRefund;
        saveGame();
        playSound("coin");
        alert("초기화 완료! 게임을 재시작합니다.");
        window.location.reload();
    }

    // Runtime State
    let player = {
        x: 0,
        y: 0,
        speed: 3,
        level: 1,
        exp: 0,
        maxExp: 100,
        hp: 100,
        maxHp: 100,
        coins: 0,
        skills: [],
        direction: 0,
        weaponLevel: 1,
        fireRate: 800,
        lastShot: 0,
        magnetRadius: 100,
    };

    let enemies = [];
    let projectiles = [];
    let items = []; // exp gems, coins
    let particles = [];
    let damageNumbers = [];
    let floatingTexts = [];

    let gameTime = 0;
    let realTime = 0; // 보스전 중에도 항상 증가하는 실제 시간 (발사 쿨다운용)
    let camera = { x: 0, y: 0 };
    let screenShake = 0;
    let keys = {};
    let touchStart = null;
    let joystickVector = { x: 0, y: 0 };

    // Ultimate Skill State (게이지 충전 방식)
    let ultimateGauge = 0; // 0~100
    const ULTIMATE_MAX = 100;
    let shockwave = { active: false, radius: 0, maxRadius: 0, alpha: 0 };
    const ULTIMATE_BUTTON = { x: 0, y: 0, r: 40 };

    // Skill Selection
    let levelUpOptions = [];

    // --- Asset Loading ---
    onMount(() => {
        loadAssets();
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        // Prevent context menu on right click
        window.addEventListener("contextmenu", (e) => e.preventDefault());
    });

    onDestroy(() => {
        cancelAnimationFrame(animationId);
        stopBGM();
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
    });

    async function loadAssets() {
        const imageKeys = Object.entries(IMAGES);
        const soundKeys = Object.entries(SOUNDS);
        const total = imageKeys.length + soundKeys.length;
        let loaded = 0;

        const update = () => {
            loaded++;
            loadProgress = (loaded / total) * 100;
        };

        try {
            // Load Images with Promises and decode()
            const imagePromises = imageKeys.map(([key, src]) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        update();
                        resolve([key, img]);
                    };
                    img.onerror = (e) => {
                        console.error(`Failed to load ${key}: ${src}`, e);
                        update(); // Count anyway to proceed
                        resolve([key, img]); // resolve with broken img to avoid crash
                    };
                    img.src = src;
                });
            });

            // Load Sounds
            const soundPromises = soundKeys.map(([key, src]) => {
                return new Promise((resolve) => {
                    const audio = new Audio();
                    audio.oncanplaythrough = () => {
                        update();
                        resolve([key, audio]);
                    };
                    audio.onerror = () => {
                        update();
                        resolve([key, audio]);
                    };
                    audio.src = src;

                    // Fallback for audio if it hangs
                    setTimeout(() => {
                        if (loaded < total) {
                            // Force resolve if hanging (browser policy)
                            update();
                            resolve([key, audio]);
                        }
                    }, 2000);
                });
            });

            // Wait for all
            const loadedImages = await Promise.all(imagePromises);
            loadedImages.forEach(([key, img]) => {
                assets.images[key] = img;
            });
            assets = { ...assets }; // Reactivity

            const loadedSounds = await Promise.all(soundPromises);
            loadedSounds.forEach(([key, audio]) => {
                assets.sounds[key] = audio;
            });

            // Artificial delay to show progress
            setTimeout(() => {
                gameState = "start";
                initGame();
            }, 500);
        } catch (err) {
            console.error("Asset load error", err);
        }
    }

    // --- Audio System ---
    function playSound(name, vol = 1.0) {
        if (!assets.sounds[name]) return;
        const clone = assets.sounds[name].cloneNode();
        clone.volume = vol;
        clone.play().catch(() => {});
    }

    function playBGM() {
        const bgm = assets.sounds.bgm;
        if (bgm) {
            bgm.loop = true;
            bgm.volume = 0.5;
            bgm.play().catch(() => console.log("Audio needs user interaction"));
        }
    }

    function stopBGM() {
        if (assets.sounds.bgm) {
            assets.sounds.bgm.pause();
            assets.sounds.bgm.currentTime = 0;
        }
    }

    // --- Game Logic Config ---
    const EXP_GEMS = [
        { color: "green", value: 5, frame: 0 },
        { color: "blue", value: 15, frame: 1 },
        { color: "purple", value: 50, frame: 2 },
    ];

    // ...

    function initGame() {
        player = {
            x: 0,
            y: 0,
            speed: 3 + (savedData.upgrades?.speed || 0) * 0.2, // 상점 업글 반영
            level: 1,
            exp: 0,
            maxExp: 10,
            hp: 100 + (savedData.upgrades?.hp || 0) * 20,
            maxHp: 100 + (savedData.upgrades?.hp || 0) * 20,
            coins: 0,

            // --- 수정됨: 무기 및 방향 고정 ---
            direction: 0, // 사용 안함(정면 고정)
            frame: 0,
            magnetRadius: 100 + (savedData.upgrades?.magnet || 0) * 20,
            lastShot: 0,

            // 무기 스탯 강화
            fireRate: 800,
            weaponLevel: 1, // 탄환 개수 (멀티샷)
            projectileSize: 0, // 탄환 크기 추가
            piercing: 2, // 관통 횟수 (기본 2 = 3명 타격: 1명 + 2관통)
        };

        enemies = [];
        projectiles = [];
        items = [];
        particles = [];
        damageNumbers = [];
        gameTime = 0;
        bossSpawned = false;
        boss2Spawned = false;
        showBossWarning = false;
        showBoss2Warning = false;
        bossWarningTimer = 0;
        boss2WarningTimer = 0;
        bossFightActive = false;
        boss1DefeatedTime = 0;

        // Reset Ultimate
        ultimateGauge = 0;
        shockwave = { active: false, radius: 0, maxRadius: 0, alpha: 0 };

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
    }

    function resizeCanvas() {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            // Re-position Ultimate Button (Bottom Right)
            ULTIMATE_BUTTON.x = canvas.width - 80;
            ULTIMATE_BUTTON.y = canvas.height - 80;
            ULTIMATE_BUTTON.r = 50; // Bigger button

            ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false; // Pixel art style or True explicitly requested?
            // User guide said "High" quality for neon effect is optional ("선택").
            // Given "Neon" vs "Pixel", usually smoothing false is better for sprites,
            // but for "Neon" glow, smoothing can be nice. User code shows:
            // "ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';"
            // I will follow the user's guide.
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
        }
    }

    function startGame() {
        gameState = "playing";
        playBGM();
        lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }

    function handleGameOver() {
        gameState = "gameover";
        stopBGM();
        playSound("warning", 0.8);

        // Save persistence
        savedData.coins += player.coins;
        if (player.level > savedData.highLevel)
            savedData.highLevel = player.level;
        localStorage.setItem("neon_survivors_data", JSON.stringify(savedData));
    }

    function handleBossDefeat(boss) {
        playSound("levelup"); // 승리음 비슷한거

        // 보상: 대량의 경험치와 코인
        gainExp(5000);
        player.coins += 1000;

        // 화면 흔들림 효과
        screenShake = 20;

        // 보스전 종료 - 시간 재개
        bossFightActive = false;
        boss1DefeatedTime = gameTime; // 보스1 처치 시점 기록

        // 보스 상태 리셋 (보스 2 등장을 위해)
        bossSpawned = true; // 보스 1 처치됨 표시
    }

    function handleGameWin() {
        gameState = "win";
        stopBGM();
        playSound("levelup"); // Happy sound

        // Save persistence
        savedData.coins += player.coins;
        if (player.level > savedData.highLevel)
            savedData.highLevel = player.level;
        localStorage.setItem("neon_survivors_data", JSON.stringify(savedData));
    }

    // --- Core Loop ---
    let lastTime = 0;
    function gameLoop(timestamp) {
        if (gameState !== "playing") return;

        // Prevent huge dt jump on resume
        if (!lastTime) lastTime = timestamp;

        const dt = timestamp - lastTime;
        lastTime = timestamp;

        update(dt);
        draw();

        animationId = requestAnimationFrame(gameLoop);
    }

    // --- Ultimate Skill Logic (게이지 충전 방식) ---
    function activateUltimate() {
        if (ultimateGauge < ULTIMATE_MAX || gameState !== "playing") return;

        ultimateGauge = 0; // 사용 후 리셋
        playSound("explosion", 0.8);

        shockwave.active = true;
        shockwave.radius = 0;
        shockwave.maxRadius = Math.max(canvas.width, canvas.height) * 1.5;
        shockwave.alpha = 1;

        enemies.forEach((e) => {
            e.hp -= 1000;
            spawnDamageNumber(e.x, e.y, 1000, true); // 크리티컬 표시
        });
    }

    function chargeUltimate(amount) {
        ultimateGauge = Math.min(ULTIMATE_MAX, ultimateGauge + amount);
    }

    // --- Update Logic (물리 및 충돌 로직 복구) ---
    function update(dt) {
        // realTime은 항상 증가 (발사 쿨다운 등에 사용)
        realTime += dt;

        // 보스전 중에는 게임 시간 정지 (경고 타이머만 진행)
        if (!bossFightActive) {
            gameTime += dt;
        }

        // 1. 보스 등장 시스템 (5분 = 보스1)
        if (gameTime > 300000 && !bossSpawned && !showBossWarning) {
            showBossWarning = true;
            bossWarningTimer = 3000;
        }
        if (showBossWarning && bossWarningTimer > 0) {
            bossWarningTimer -= dt;
            if (bossWarningTimer <= 0) spawnBoss(1);
        }

        // 보스2 등장 (보스1 처치 후 5분 = 300000ms)
        if (
            boss1DefeatedTime > 0 && // 보스1을 처치했어야 함
            gameTime > boss1DefeatedTime + 300000 && // 처치 후 5분 경과
            !boss2Spawned &&
            !showBoss2Warning &&
            !enemies.some((e) => e.isBoss) // 현재 필드에 보스가 없어야 함
        ) {
            showBoss2Warning = true;
            boss2WarningTimer = 3000;
        }
        if (showBoss2Warning && boss2WarningTimer > 0) {
            boss2WarningTimer -= dt;
            if (boss2WarningTimer <= 0) spawnBoss(2);
        }

        // 1.5. Ultimate Shockwave Update
        if (shockwave.active) {
            shockwave.radius += dt * 2; // Speed of expansion
            shockwave.alpha -= dt * 0.001;
            if (shockwave.alpha <= 0) {
                shockwave.active = false;
            }
        }

        // 2. 플레이어 이동 및 방향
        let dx = 0,
            dy = 0;
        if (keys["ArrowUp"] || keys["w"]) dy = -1;
        if (keys["ArrowDown"] || keys["s"]) dy = 1;
        if (keys["ArrowLeft"] || keys["a"]) dx = -1;
        if (keys["ArrowRight"] || keys["d"]) dx = 1;

        if (joystickVector.x !== 0 || joystickVector.y !== 0) {
            dx = joystickVector.x;
            dy = joystickVector.y;
        }

        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            player.x += (dx / length) * player.speed;
            player.y += (dy / length) * player.speed;
        }

        camera.x = player.x - canvas.width / 2;
        camera.y = player.y - canvas.height / 2;

        // 3. 적 스폰 및 추적 (보스 전투 중에는 잡몹 스폰 중단)
        if (!showBossWarning && !showBoss2Warning && !bossFightActive) {
            let spawnRate = Math.max(160, 650 - gameTime / 100);

            // Horde Mode (4분~5분)
            if (gameTime > 240000 && gameTime < 300000) {
                spawnRate = 75;
            }
            // 보스1 처치 후 4분~5분: 2차 Horde (보스2 등장 직전)
            if (boss1DefeatedTime > 0) {
                const timeSinceBoss1 = gameTime - boss1DefeatedTime;
                if (timeSinceBoss1 > 240000 && timeSinceBoss1 < 300000) {
                    spawnRate = 60;
                }
            }

            if (Math.random() < dt / spawnRate) spawnEnemy();
        }

        enemies = enemies.filter((e) => {
            const angle = Math.atan2(player.y - e.y, player.x - e.x);
            e.x += Math.cos(angle) * e.speed;
            e.y += Math.sin(angle) * e.speed;

            // --- Boss Attack Logic (Varied Patterns) ---
            if (e.isBoss) {
                if (!e.attackTimer) e.attackTimer = 0;
                e.attackTimer -= dt;

                if (e.attackTimer <= 0) {
                    // Randomly choose pattern: 0=Spread, 1=Rapid Stream, 2=Spiral
                    const pattern = Math.floor(Math.random() * 3);

                    if (pattern === 0) {
                        // Pattern 0: 8-way Spread (Classic)
                        e.attackTimer = 1500; // Reset timer
                        for (let i = 0; i < 12; i++) {
                            // Increased to 12-way
                            const ang = (Math.PI * 2 * i) / 12;
                            projectiles.push({
                                x: e.x,
                                y: e.y,
                                vx: Math.cos(ang) * 6,
                                vy: Math.sin(ang) * 6,
                                life: 3000,
                                isEnemy: true,
                                color: "#f00",
                                pierce: 0,
                                hitIds: new Set(),
                            });
                        }
                        playSound("zap", 0.5);
                    } else if (pattern === 1) {
                        // Pattern 1: Rapid Stream (3 bursts)
                        e.attackTimer = 2000;
                        const angleToPlayer = Math.atan2(
                            player.y - e.y,
                            player.x - e.x,
                        );
                        for (let i = 0; i < 3; i++) {
                            setTimeout(() => {
                                // Recalculate slightly for tracking
                                const ang =
                                    Math.atan2(player.y - e.y, player.x - e.x) +
                                    (Math.random() - 0.5) * 0.2;
                                projectiles.push({
                                    x: e.x,
                                    y: e.y,
                                    vx: Math.cos(ang) * 9,
                                    vy: Math.sin(ang) * 9, // Fast
                                    life: 3000,
                                    isEnemy: true,
                                    color: "#ff0",
                                    pierce: 0,
                                    hitIds: new Set(),
                                });
                                playSound("zap", 0.3);
                            }, i * 150);
                        }
                    } else {
                        // Pattern 2: Spiral (Nova)
                        e.attackTimer = 2000;
                        for (let i = 0; i < 16; i++) {
                            setTimeout(() => {
                                const ang =
                                    (Math.PI * 2 * i) / 16 + gameTime / 1000; // Rotating offset
                                projectiles.push({
                                    x: e.x,
                                    y: e.y,
                                    vx: Math.cos(ang) * 7,
                                    vy: Math.sin(ang) * 7,
                                    life: 3000,
                                    isEnemy: true,
                                    color: "#f0f",
                                    pierce: 0,
                                    hitIds: new Set(),
                                });
                            }, i * 50); // Ripple effect
                        }
                        playSound("zap", 0.5);
                    }
                }
            }

            if (
                Math.hypot(e.x - player.x, e.y - player.y) <
                (e.isBoss ? 80 : 25)
            ) {
                takeDamage(e.isBoss ? 0.5 : 0.2); // 프레임당 데미지
            }

            if (e.hp <= 0) {
                if (e.isBoss) {
                    if (e.bossType === 2) handleGameWin();
                    else handleBossDefeat(e);
                } else onEnemyDeath(e);
                return false;
            }
            return true;
        });

        // 4. 전투 (총구 위치 보정 발사) - realTime 사용으로 보스전 중에도 발사 가능
        if (realTime - player.lastShot > player.fireRate) {
            fireProjectile();
            player.lastShot = realTime;
        }

        // 5. 투사체 이동 (회전 로직 추가)
        projectiles = projectiles.filter((p) => {
            p.life -= dt;
            p.x += p.vx;
            p.y += p.vy;

            // 칼날 회전
            if (p.isBlade) {
                p.rotation += dt * 0.01; // 회전 속도
            }

            // 적 투사체 처리 (플레이어 피격)
            if (p.isEnemy) {
                const dist = Math.hypot(player.x - p.x, player.y - p.y);
                if (dist < 20) {
                    // 히어로 충돌 범위
                    takeDamage(20); // 꽤 아픔
                    return false; // 투사체 소멸
                }
                return p.life > 0;
            }

            // 아군 투사체 처리 (적 피격)
            let currentHit = false; // 이번 프레임에 히트가 발생했는지

            enemies.forEach((e) => {
                // 이미 맞은 적은 패스 (다단히트 방지)
                if (p.hitIds && p.hitIds.has(e)) return;

                const pRadius = 5 + player.projectileSize;
                const hitDist = (e.isBoss ? 60 : 30) + pRadius;

                if (Math.hypot(e.x - p.x, e.y - p.y) < hitDist) {
                    const baseDmg = 12 + (savedData.upgrades?.damage || 0) * 2;
                    let damage = baseDmg + player.level * 1;

                    // 크리티컬 시스템 (20% 확률, 1.5배 데미지)
                    const isCrit = Math.random() < 0.2;
                    if (isCrit) damage = Math.floor(damage * 1.5);

                    e.hp -= damage;
                    spawnDamageNumber(e.x, e.y, Math.round(damage), isCrit);

                    // 히트 처리
                    if (!p.hitIds) p.hitIds = new Set();
                    p.hitIds.add(e);

                    p.pierce--; // 관통 횟수 차감
                    currentHit = true;
                }
            });

            // 관통 횟수가 다 떨어졌으면 소멸 (0보다 작아지면 소멸)
            // pierce가 0이면 1명 맞추고 -1이 되어 소멸.
            if (p.pierce < 0) return false;

            return p.life > 0;
        });

        // 6. 아이템 자석 흡수
        items = items.filter((it) => {
            const dist = Math.hypot(it.x - player.x, it.y - player.y);
            if (dist < player.magnetRadius) {
                it.x += (player.x - it.x) * 0.2;
                it.y += (player.y - it.y) * 0.2;
            }
            if (dist < 20) {
                if (it.type === "exp") gainExp(10);
                else player.coins += 5;
                playSound("coin", 0.3);
                return false;
            }
            return true;
        });

        // 7. 파티클 & 데미지 숫자 업데이트 (애니메이션)
        particles = particles.filter((p) => (p.life -= dt) > 0);
        damageNumbers = damageNumbers.filter((dn) => {
            dn.life -= dt;
            dn.y -= 1; // 위로 떠오르는 애니메이션
            return dn.life > 0;
        });

        // 8. Screen Shake Decay
        if (screenShake > 0) {
            screenShake = Math.max(0, screenShake - dt * 0.05);
        }
    }

    function spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(canvas.width, canvas.height) / 2 + 100;

        // Difficulty Scaling: Increase HP over time
        // Increase HP by 20% every minute (60000ms)
        let timeFactor = 1 + (gameTime / 60000) * 0.2;

        // Early Game Nerf: First 1 minute, mobs have 50% HP (Easier start)
        if (gameTime < 60000) {
            timeFactor *= 0.5;
        }

        // 일반 몹 (type 0,1,2) 또는 특수 몹 (3분 이후 type 3,4 추가)
        let mobType = Math.floor(Math.random() * 3); // 기본 0~2
        let mobSpeed = 1.5 + Math.random() * 0.5;
        let mobHp = (30 + player.level * 5) * timeFactor;
        let isSpecial = false;

        // 3분 이후 특수 몹 등장 (30% 확률)
        if (gameTime > 180000 && Math.random() < 0.3) {
            mobType = Math.random() < 0.5 ? 3 : 4; // 가시공 or 다이아
            isSpecial = true;
            if (mobType === 3) {
                // 폭발형: 느리지만 강함
                mobSpeed = 1.2;
                mobHp *= 1.5;
            } else {
                // 빠른형: 빠르지만 약함
                mobSpeed = 3.0;
                mobHp *= 0.6;
            }
        }

        enemies.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            hp: mobHp,
            speed: mobSpeed,
            radius: 15,
            type: mobType,
            isSpecial,
        });
    }

    function spawnBoss(bossNum = 1) {
        bossFightActive = true; // 보스전 시작 - 시간 정지

        if (bossNum === 1) {
            showBossWarning = false;
            bossSpawned = true;
            enemies.push({
                x: player.x,
                y: player.y - 500,
                hp: 20000,
                maxHp: 20000,
                speed: 1.8,
                radius: 100,
                isBoss: true,
                bossType: 1,
            });
        } else {
            showBoss2Warning = false;
            boss2Spawned = true;
            enemies.push({
                x: player.x,
                y: player.y - 500,
                hp: 50000,
                maxHp: 50000,
                speed: 2.0,
                radius: 120,
                isBoss: true,
                bossType: 2,
            });
        }
        playSound("warning");
    }

    // --- 강력해진 무기 사출 (총구 중심 발사) ---
    function fireProjectile() {
        let nearest = null;
        let minDst = Infinity;
        enemies.forEach((e) => {
            const d = Math.hypot(e.x - player.x, e.y - player.y);
            if (d < minDst) {
                minDst = d;
                nearest = e;
            }
        });

        if (nearest) {
            // 총구가 히어로 머리 위(약 -40px)에 있으므로 시작 지점 보정
            const muzzleY = player.y - 45;
            const baseAngle = Math.atan2(
                nearest.y - muzzleY,
                nearest.x - player.x,
            );

            const count = player.weaponLevel;
            const spread = 0.15; // 부채꼴 간격

            for (let i = 0; i < count; i++) {
                const angleOffset = (i - (count - 1) / 2) * spread;
                projectiles.push({
                    x: player.x,
                    y: muzzleY, // 보정된 총구 위치
                    vx: Math.cos(baseAngle + angleOffset) * 12, // 탄속 증가
                    vy: Math.sin(baseAngle + angleOffset) * 12,
                    life: 1500,
                    pierce: player.piercing, // 관통 속성 적용
                });
            }
            playSound("zap", 0.2);
        }
    }

    function takeDamage(amount) {
        player.hp -= amount;
        if (player.hp <= 0) {
            player.hp = 0;
            handleGameOver();
        }
        // Screen shake or red flash could go here
    }

    function onEnemyDeath(enemy) {
        playSound("punch", 0.2);

        // 궁극기 게이지 충전 (충격파 활성화 중엔 충전 안 됨)
        if (!shockwave.active) {
            chargeUltimate(enemy.isSpecial ? 6 : 3);
        }

        // 폭발형 몹: 사망 시 주변 데미지
        if (enemy.type === 3 && enemy.isSpecial) {
            const explosionRadius = 80;
            // 플레이어에게 데미지
            if (
                Math.hypot(enemy.x - player.x, enemy.y - player.y) <
                explosionRadius
            ) {
                takeDamage(15);
            }
            // 폭발 파티클
            for (let i = 0; i < 10; i++) {
                particles.push({
                    x: enemy.x,
                    y: enemy.y,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    life: 600,
                    color: "#f80",
                });
            }
        }

        // 아이템 드롭
        items.push({
            x: enemy.x,
            y: enemy.y,
            type: Math.random() > 0.8 ? "coin" : "exp",
            value: 10,
        });
        // 일반 파티클
        for (let i = 0; i < 5; i++) {
            particles.push({
                x: enemy.x,
                y: enemy.y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 500,
                color: "#f0f",
            });
        }
    }

    function processBossAttack(boss) {
        if (!boss) return;

        // --- Boss 1 Patterns ---
        if (boss.bossType === 1) {
            if (Math.random() < 0.5) {
                // Pattern 1: Triple Shot (Guided)
                boss.attackTimer = 2000;
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        const ang =
                            Math.atan2(player.y - boss.y, player.x - boss.x) +
                            (Math.random() - 0.5) * 0.2;
                        projectiles.push({
                            x: boss.x,
                            y: boss.y,
                            vx: Math.cos(ang) * 9,
                            vy: Math.sin(ang) * 9,
                            life: 3000,
                            isEnemy: true,
                            color: "#ff0",
                            pierce: 0,
                            hitIds: new Set(),
                        });
                        playSound("zap", 0.3);
                    }, i * 150);
                }
            } else {
                // Pattern 2: Spiral (Nova)
                boss.attackTimer = 2000;
                for (let i = 0; i < 16; i++) {
                    setTimeout(() => {
                        const ang = (Math.PI * 2 * i) / 16 + gameTime / 1000;
                        projectiles.push({
                            x: boss.x,
                            y: boss.y,
                            vx: Math.cos(ang) * 7,
                            vy: Math.sin(ang) * 7,
                            life: 3000,
                            isEnemy: true,
                            color: "#f0f",
                            pierce: 0,
                            hitIds: new Set(),
                        });
                    }, i * 50);
                }
                playSound("zap", 0.5);
            }
        }

        // --- Boss 2 Patterns ---
        else if (boss.bossType === 2) {
            if (Math.random() < 0.5) {
                // Pattern A: Spinning Blades (New!)
                boss.attackTimer = 3000; // 좀 더 긴 쿨타임
                const count = 12;
                for (let i = 0; i < count; i++) {
                    const angle = (Math.PI * 2 * i) / count;
                    projectiles.push({
                        x: boss.x,
                        y: boss.y,
                        vx: Math.cos(angle) * 6,
                        vy: Math.sin(angle) * 6,
                        life: 4000, // 오래 지속
                        isEnemy: true,
                        isBlade: true, // 회전 칼날
                        rotation: 0,
                        pierce: 999,
                        hitIds: new Set(),
                    });
                }
                playSound("zap", 0.6);
            } else {
                // Pattern B: Fast Homing Missiles (New!)
                boss.attackTimer = 2500;
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => {
                        const ang =
                            Math.atan2(player.y - boss.y, player.x - boss.x) +
                            (Math.random() - 0.5) * 0.5;
                        projectiles.push({
                            x: boss.x,
                            y: boss.y,
                            vx: Math.cos(ang) * 10, // Very Fast
                            vy: Math.sin(ang) * 10,
                            life: 2000,
                            isEnemy: true,
                            color: "#f00", // Red
                            pierce: 0,
                            hitIds: new Set(),
                        });
                        playSound("zap", 0.4);
                    }, i * 100);
                }
            }
        }
    }

    function gainExp(amount) {
        player.exp += amount;
        if (player.exp >= player.maxExp) {
            player.level++;
            player.exp -= player.maxExp;
            player.maxExp = Math.floor(player.maxExp * 1.5); // XP Nerf: 1.2 -> 1.5 (Slower leveling)
            playSound("levelup");
            triggerLevelUp();
        }
    }

    function triggerLevelUp() {
        gameState = "levelup";
        // 5가지 스킬 정의 (이미지 순서: 0:연사, 1:공격(멀티샷), 2:자석, 3:방패/속도, 4:회복)
        const allSkills = [
            {
                id: 0,
                name: "Rapid Fire",
                desc: "공격 속도 +10%", // 20% -> 10% 너프
                icon: "🔫",
                effect: () => (player.fireRate *= 0.9), // 0.8 -> 0.9
            },
            {
                id: 1,
                name: "Multi-Shot",
                desc: "탄환 개수 +1",
                icon: "✨",
                effect: () => player.weaponLevel++,
            },
            {
                id: 2,
                name: "Magnet",
                desc: "아이템 수집 범위 증가",
                icon: "🧲",
                effect: () => (player.magnetRadius += 50),
            },
            {
                id: 3,
                name: "Turbo",
                desc: "이동 속도 +10%",
                icon: "👟",
                effect: () => (player.speed *= 1.1),
            },
            {
                id: 4,
                name: "Full Heal",
                desc: "체력 100% 회복",
                icon: "❤️",
                effect: () => (player.hp = player.maxHp),
            },
            {
                id: 5,
                name: "Giant Strike",
                desc: "탄환 크기 증가",
                icon: "☄️",
                effect: () => (player.projectileSize += 3),
            },
            {
                id: 6,
                name: "Piercing Rounds",
                desc: "관통 횟수 +1",
                icon: "🏹",
                effect: () => player.piercing++,
            },
        ];
        // 랜덤 3개 노출
        levelUpOptions = allSkills.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    function selectSkill(skill) {
        skill.effect(); // 효과 즉시 적용
        gameState = "playing";
        // 게임 루프 끊김 방지
        lastTime = performance.now();
        gameLoop(lastTime);
    }

    // --- Render (정밀 렌더링) ---
    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. 배경 (타일링)
        const bg = assets.images.bg;
        if (bg?.complete) {
            const bgW = bg.naturalWidth;
            const bgH = bg.naturalHeight;
            const offX = -Math.floor(camera.x) % bgW;
            const offY = -Math.floor(camera.y) % bgH;
            for (let x = offX - bgW; x < canvas.width + bgW; x += bgW) {
                for (let y = offY - bgH; y < canvas.height + bgH; y += bgH)
                    ctx.drawImage(bg, x, y, bgW, bgH);
            }
        }

        ctx.save();
        let shakeX = 0,
            shakeY = 0;
        if (screenShake > 0) {
            shakeX = (Math.random() - 0.5) * screenShake;
            shakeY = (Math.random() - 0.5) * screenShake;
        }
        ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

        // 2. 히어로 (배경 제거가 완료된 PNG이므로 screen 모드 전에 그립니다)
        const hero = assets.images.hero;
        if (hero?.complete) {
            const aspect = hero.naturalWidth / hero.naturalHeight;
            const drawH = 100; // 좀 더 큼직하게 변경
            const drawW = drawH * aspect;
            ctx.drawImage(
                hero,
                player.x - drawW / 2,
                player.y - drawH / 2,
                drawW,
                drawH,
            );

            // HP 게이지
            ctx.fillStyle = "#333";
            ctx.fillRect(player.x - 30, player.y - 65, 60, 6);
            const hpPercent = Math.max(0, player.hp / player.maxHp);
            ctx.fillStyle = hpPercent > 0.3 ? "#0f0" : "#f00";
            ctx.fillRect(player.x - 30, player.y - 65, 60 * hpPercent, 6);
        }

        // 3. 네온 합성 모드 ON (투사체 및 적 발광 효과)
        // ctx.globalCompositeOperation = "screen";

        // 투사체 (미사일 효과)
        ctx.shadowBlur = 15;
        projectiles.forEach((p) => {
            ctx.fillStyle = p.isEnemy ? "#f00" : "#0ff";
            ctx.shadowColor = p.isEnemy ? "#f00" : "#0ff";

            // 회전 칼날 렌더링
            if (p.isBlade) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);

                // 칼날 그리기 (마름모 2개 겹침)
                ctx.fillStyle = "#ffaa00"; // 주황색
                ctx.shadowColor = "#ff4400";

                ctx.beginPath();
                ctx.moveTo(0, -15);
                ctx.lineTo(10, 0);
                ctx.lineTo(0, 15);
                ctx.lineTo(-10, 0);
                ctx.fill();

                ctx.rotate(Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(0, -15);
                ctx.lineTo(10, 0);
                ctx.lineTo(0, 15);
                ctx.lineTo(-10, 0);
                ctx.fill();

                ctx.restore();
            } else {
                // 일반 투사체
                ctx.beginPath();
                ctx.arc(
                    p.x,
                    p.y,
                    p.isEnemy ? 8 : 5 + player.projectileSize,
                    0,
                    Math.PI * 2,
                );
                ctx.fill();
            }
        });

        // 3. 적 & 보스 (보스1, 보스2 구분 렌더링)
        enemies.forEach((e) => {
            if (e.isBoss) {
                const bossImg =
                    e.bossType === 2 ? assets.images.boss2 : assets.images.boss;
                if (bossImg?.complete)
                    ctx.drawImage(bossImg, e.x - 150, e.y - 150, 300, 300);
            } else {
                const mobSheet = assets.images.mobs;
                if (mobSheet?.complete) {
                    // 상단 3개 (type 0,1,2): 3열
                    // 하단 2개 (type 3,4): 2열, 다른 위치
                    const topRowH = mobSheet.naturalHeight / 2;
                    let sx, sy, sw, sh;

                    if (e.type < 3) {
                        // 상단 3마리
                        sw = mobSheet.naturalWidth / 3;
                        sh = topRowH;
                        sx = e.type * sw;
                        sy = 0;
                    } else {
                        // 하단 2마리 (가운데 정렬, 2열)
                        sw = mobSheet.naturalWidth / 3;
                        sh = topRowH;
                        sx = (e.type - 3) * sw + sw * 0.5; // 약간 오프셋
                        sy = topRowH;
                    }

                    ctx.drawImage(
                        mobSheet,
                        sx,
                        sy,
                        sw,
                        sh,
                        e.x - 25,
                        e.y - 25,
                        50,
                        50,
                    );
                }
            }
        });

        // 아이템
        items.forEach((item) => {
            const sheet = assets.images.items;
            if (sheet?.complete) {
                const sw = sheet.naturalWidth / 2;
                ctx.drawImage(
                    sheet,
                    item.type === "coin" ? sw : 0,
                    0,
                    sw,
                    sheet.naturalHeight,
                    item.x - 15,
                    item.y - 15,
                    30,
                    30,
                );
            }
        });

        ctx.restore();

        // Draw Shockwave (World Space or Screen Space? Let's do Screen Space relative to player center? No, Center of Screen is better for "Bomb")
        // Or player centered? Player centered makes sense for a "Blast" from hero.
        if (shockwave.active) {
            ctx.save();
            ctx.translate(-camera.x, -camera.y); // To World Space
            ctx.beginPath();
            ctx.arc(player.x, player.y, shockwave.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 255, ${shockwave.alpha * 0.5})`; // Cyan filler
            ctx.fill();
            ctx.lineWidth = 20;
            ctx.strokeStyle = `rgba(0, 255, 255, ${shockwave.alpha})`;
            ctx.stroke();
            ctx.restore();
        }

        drawHUD();

        // 8. Boss HP Bar (Screen Space Overlay)
        const boss = enemies.find((e) => e.isBoss);
        if (boss) {
            const barW = canvas.width * 0.6;
            const barH = 20;
            const barX = (canvas.width - barW) / 2;
            const barY = 80; // Top area

            // Frame
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

            // HP Fill
            const percent = Math.max(0, boss.hp / boss.maxHp);
            ctx.fillStyle = "#f00"; // Red for boss
            ctx.fillRect(barX, barY, barW * percent, barH);

            // Text
            ctx.font = "bold 16px Arial";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText(
                `BOSS HP: ${Math.ceil(boss.hp)} / ${boss.maxHp}`,
                canvas.width / 2,
                barY + 16,
            );
            ctx.textAlign = "left"; // Reset
        }
    }

    function drawHUD() {
        ctx.save();
        // UI should not be moved by camera, but Damage Numbers ARE in world space
        // Wait, Damage Numbers should be drawn in World Space or Screen Space?
        // Usually World Space but drawn over everything.
        // My previous code had them in HUD layer but translated.
        // Let's keep them in World Space but handled here to be on top.

        ctx.translate(-camera.x, -camera.y);
        damageNumbers.forEach((dn) => {
            // 크리티컬: 노란색, 큰 폰트
            if (dn.isCrit) {
                ctx.font = "bold 20px Arial";
                ctx.fillStyle = "#ffff00";
                ctx.shadowColor = "#ff8800";
                ctx.shadowBlur = 10;
            } else {
                ctx.font = "bold 14px Arial";
                ctx.fillStyle = "white";
                ctx.shadowColor = "black";
                ctx.shadowBlur = 2;
            }
            ctx.fillText(dn.val, dn.x, dn.y);
        });
        ctx.shadowBlur = 0;
        ctx.restore();

        // Static HUD
        // EXP Bar
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, canvas.width, 10);
        ctx.fillStyle = "#0f0";
        ctx.fillRect(0, 0, (player.exp / player.maxExp) * canvas.width, 10);

        ctx.font = "20px font-mono shadow-md";
        ctx.fillStyle = "white";
        ctx.fillText(`Lv.${player.level}`, 10, 35);
        ctx.fillText(`HP:${Math.ceil(player.hp)}`, 10, 60);
        ctx.fillStyle = "gold";
        ctx.fillText(`Coins:${player.coins}`, 10, 85);

        // Ultimate Button (게이지 방식 UI)
        if (gameState === "playing") {
            const btn = ULTIMATE_BUTTON;
            ctx.save();
            ctx.translate(btn.x, btn.y);

            const icon = assets.images.special;
            const isReady = ultimateGauge >= ULTIMATE_MAX;

            if (icon && icon.complete) {
                // 발광 효과 (준비되면 강한 발광)
                if (isReady) {
                    const pulse = 20 + Math.sin(gameTime / 150) * 10;
                    ctx.shadowColor = "#00ffff";
                    ctx.shadowBlur = pulse;
                } else {
                    ctx.shadowBlur = 0;
                    ctx.filter = `brightness(${50 + (ultimateGauge / ULTIMATE_MAX) * 50}%)`;
                }

                const size = btn.r * 2.5;
                ctx.drawImage(icon, -size / 2, -size / 2, size, size);
                ctx.filter = "none";
            } else {
                // Fallback: 원형 버튼
                if (isReady) {
                    const pulse = Math.sin(gameTime / 200) * 5;
                    ctx.shadowColor = "#0ff";
                    ctx.shadowBlur = 20 + pulse;
                }
                ctx.beginPath();
                ctx.arc(0, 0, btn.r, 0, Math.PI * 2);
                ctx.fillStyle = isReady ? "#00bcd4" : "#333";
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = "white";
                ctx.stroke();
                ctx.fillStyle = "white";
                ctx.font = "30px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    isReady ? "💣" : `${Math.floor(ultimateGauge)}%`,
                    0,
                    2,
                );
            }

            // 게이지 바 (Ultimate 버튼 아래)
            const gaugeW = btn.r * 2;
            const gaugeH = 6;
            ctx.fillStyle = "#333";
            ctx.fillRect(-gaugeW / 2, btn.r + 8, gaugeW, gaugeH);
            ctx.fillStyle = isReady ? "#0ff" : "#0a0";
            ctx.fillRect(
                -gaugeW / 2,
                btn.r + 8,
                gaugeW * (ultimateGauge / ULTIMATE_MAX),
                gaugeH,
            );

            ctx.restore();
        }

        // Joystick UI (Mobile)
        if (touchStart) {
            ctx.strokeStyle = "rgba(255,255,255,0.3)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(touchStart.x, touchStart.y, 40, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.beginPath();
            ctx.arc(
                touchStart.x + joystickVector.x * 40,
                touchStart.y + joystickVector.y * 40,
                15,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }
    }

    function spawnDamageNumber(x, y, val, isCrit = false) {
        damageNumbers.push({ x, y: y - 20, val, life: 600, isCrit });
    }

    // --- Input ---
    function handleKeyDown(e) {
        keys[e.key] = true;
        if (e.code === "Space") activateUltimate();
        if (e.code === "Escape") togglePause();
    }
    function handleKeyUp(e) {
        keys[e.key] = false;
    }

    function togglePause() {
        if (gameState === "playing") {
            gameState = "paused";
            cancelAnimationFrame(animationId);
            animationId = null;
        } else if (gameState === "paused") {
            gameState = "playing";
            lastTime = performance.now();
            gameLoop(lastTime);
        }
    }

    // Touch Joystick
    function handleTouchStart(e) {
        e.preventDefault();
        // Check all touches
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];

            // Check Ultimate Button Press
            const dx = t.clientX - ULTIMATE_BUTTON.x;
            const dy = t.clientY - ULTIMATE_BUTTON.y;
            if (Math.hypot(dx, dy) < ULTIMATE_BUTTON.r + 20) {
                activateUltimate();
                return; // Don't process as joystick if button pressed
            }

            // Joystick Logic (Only if not button)
            if (!touchStart) {
                touchStart = { x: t.clientX, y: t.clientY };
            }
        }
    }
    function handleTouchMove(e) {
        if (!touchStart) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 40;

        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        joystickVector = {
            x: (Math.cos(angle) * clampedDist) / maxDist,
            y: (Math.sin(angle) * clampedDist) / maxDist,
        };
    }
    function handleTouchEnd() {
        touchStart = null;
        joystickVector = { x: 0, y: 0 };
    }

    $: if (canvas && gameState === "playing" && !animationId) {
        // resume loop if needed
        gameLoop(performance.now());
    }
</script>

<main
    class="fixed inset-0 w-full h-full bg-black overflow-hidden touch-none select-none font-sans"
>
    <!-- Canvas Layer -->
    <canvas
        bind:this={canvas}
        class="w-full h-full block"
        on:touchstart={handleTouchStart}
        on:touchmove={handleTouchMove}
        on:touchend={handleTouchEnd}
    ></canvas>

    <!-- Boss Warning Overlay -->
    {#if showBossWarning}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center bg-red-900/20 animate-pulse z-40 pointer-events-none"
        >
            <h2
                class="text-8xl font-black text-red-500 tracking-tighter shadow-red-500/50 drop-shadow-2xl"
            >
                WARNING
            </h2>
            <p class="text-2xl text-white font-bold mt-4">
                BOSS APPROACHING...
            </p>
        </div>
    {/if}

    <!-- Boss 2 Warning Overlay -->
    {#if showBoss2Warning}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center bg-purple-900/30 animate-pulse z-40 pointer-events-none"
        >
            <h2
                class="text-8xl font-black text-purple-400 tracking-tighter drop-shadow-2xl"
            >
                DANGER
            </h2>
            <p class="text-2xl text-white font-bold mt-4">
                FINAL BOSS INCOMING!
            </p>
        </div>
    {/if}

    <!-- UI Overlays -->
    {#if gameState === "loading"}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center z-50 bg-gray-900"
        >
            <div
                class="absolute inset-0 bg-cover bg-center opacity-50 blur-sm"
                style="background-image: url({IMAGES.main})"
            ></div>
            <div class="relative z-10 text-center w-full max-w-md px-10">
                <div
                    class="w-full h-4 bg-gray-800 rounded-full border border-gray-700 overflow-hidden relative shadow-[0_0_10px_#0ff]"
                >
                    <div
                        class="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-200 ease-out"
                        style="width: {loadProgress}%"
                    ></div>
                </div>
                <p class="mt-4 text-cyan-300 font-mono text-xs tracking-widest">
                    LOADING ASSETS... {Math.round(loadProgress)}%
                </p>
            </div>
        </div>
    {:else if gameState === "start"}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/60 backdrop-blur-md"
            in:fade
        >
            <div
                class="absolute inset-0 bg-cover bg-center opacity-40 -z-10"
                style="background-image: url({IMAGES.main})"
            ></div>
            <h1
                class="text-7xl font-black mb-12 text-cyan-400 text-shadow-neon text-center"
            >
                NEON SURVIVORS
            </h1>
            <div class="flex gap-4">
                <button
                    on:click={startGame}
                    class="px-12 py-5 bg-cyan-500 text-black font-black text-xl rounded-full hover:scale-105 transition shadow-[0_0_20px_#0ff]"
                    >START GAME</button
                >
                <button
                    on:click={() => (gameState = "shop")}
                    class="px-12 py-5 border-2 border-yellow-500 text-yellow-500 font-black text-xl rounded-full hover:bg-yellow-500 hover:text-black transition"
                    >UPGRADE SHOP</button
                >
            </div>
            <div class="mt-8 text-xs text-gray-400 font-mono">
                <p>💰 Current Coins: {savedData.coins.toLocaleString()}</p>
                <p>🏆 High Level: {savedData.highLevel}</p>
            </div>
        </div>
    {:else if gameState === "shop"}
        <div
            class="absolute inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-xl"
            in:fade
        >
            <div
                class="absolute inset-0 bg-cover bg-center opacity-30 -z-10"
                style="background-image: url({IMAGES.main})"
            ></div>
            <div
                class="max-w-md w-full p-10 bg-gray-900/90 border-2 border-yellow-500 rounded-[3rem] shadow-2xl relative"
            >
                <h2
                    class="text-3xl font-black text-yellow-500 text-center mb-8"
                >
                    PERMANENT UPGRADES
                </h2>
                <div class="space-y-4">
                    {#each SHOP_ITEMS as item}
                        <button
                            on:click={() => buyUpgrade(item)}
                            class="w-full p-5 bg-gray-800 rounded-2xl flex justify-between items-center hover:border-yellow-400 border border-transparent transition group"
                        >
                            <div class="flex items-center gap-4">
                                <span
                                    class="text-3xl group-hover:scale-125 transition"
                                    >{item.icon}</span
                                >
                                <div class="text-left">
                                    <div class="font-bold text-white">
                                        {item.name}
                                    </div>
                                    <div class="text-xs text-gray-400">
                                        Lv. {savedData.upgrades[item.id] || 0}
                                    </div>
                                </div>
                            </div>
                            <div class="text-yellow-500 font-black">
                                {getUpgradeCost(
                                    item.cost,
                                    savedData.upgrades[item.id] || 0,
                                )} CP
                            </div>
                        </button>
                    {/each}
                </div>
                <div
                    class="text-center mt-6 text-white font-bold border-t border-gray-700 pt-4"
                >
                    Your Coins: <span class="text-yellow-400"
                        >{savedData.coins}</span
                    >
                </div>
                <button
                    on:click={() => (gameState = "start")}
                    class="w-full mt-6 py-4 bg-white text-black font-black rounded-xl hover:bg-gray-200 transition"
                    >BACK TO LOBBY</button
                >
                <button
                    on:click={refundUpgrades}
                    class="w-full mt-4 py-3 border-2 border-red-500 text-red-500 font-bold rounded-xl hover:bg-red-500 hover:text-white transition text-sm"
                    >RESET UPGRADES (REFUND)
                </button>
            </div>
        </div>
    {:else if gameState === "paused"}
        <div
            class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
        >
            <h2 class="text-5xl font-black text-cyan-400 mb-8">PAUSED</h2>
            <div class="flex flex-col gap-4">
                <button
                    on:click={togglePause}
                    class="px-12 py-4 bg-cyan-500 text-black font-black text-xl rounded-full hover:scale-105 transition shadow-[0_0_20px_#0ff]"
                >
                    RESUME
                </button>
                <button
                    on:click={() => {
                        // 현재 코인 저장하고 로비로
                        savedData.coins += player.coins;
                        saveGame();
                        gameState = "start";
                        initGame();
                    }}
                    class="px-12 py-4 border-2 border-red-500 text-red-500 font-black text-xl rounded-full hover:bg-red-500 hover:text-white transition"
                >
                    EXIT TO LOBBY
                </button>
            </div>
            <p class="mt-8 text-gray-400 text-sm">
                Level {player.level} • Coins: {player.coins}
            </p>
        </div>
    {:else if gameState === "levelup"}
        <div
            class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
            <div
                class="bg-gray-800 p-6 rounded-2xl border border-yellow-500/50 shadow-2xl max-w-sm w-full"
            >
                <h2
                    class="text-2xl font-bold text-yellow-400 text-center mb-6 animate-bounce"
                >
                    LEVEL UP!
                </h2>
                <div class="space-y-3">
                    {#each levelUpOptions as opt, i}
                        <button
                            class="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-xl flex items-center gap-4 transition-colors text-left group border border-transparent hover:border-yellow-400"
                            on:click={() => selectSkill(opt)}
                        >
                            <div
                                class="w-12 h-12 bg-gray-900 rounded-lg border border-gray-600 group-hover:border-yellow-400 flex items-center justify-center text-2xl shrink-0"
                            >
                                {opt.icon}
                            </div>
                            <div>
                                <div
                                    class="font-bold text-white group-hover:text-yellow-300"
                                >
                                    {opt.name}
                                </div>
                                <div class="text-xs text-gray-400">
                                    {opt.desc}
                                </div>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    {:else if gameState === "gameover" || gameState === "win"}
        <div
            class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
        >
            <h2
                class="text-6xl font-black {gameState === 'win'
                    ? 'text-green-500'
                    : 'text-red-500'} mb-4 tracking-tighter text-shadow-neon"
            >
                {gameState === "win" ? "MISSION COMPLETE" : "GAME OVER"}
            </h2>
            {#if gameState === "win"}
                <p class="text-white text-xl mb-8">
                    You have defeated the Boss!
                </p>

                <!-- 보상받기 버튼 (1회만 표시) -->
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
            {:else}
                <p class="text-white text-xl mb-8">
                    You survived until Level {player.level}
                </p>
            {/if}

            <button
                class="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition"
                on:click={() => {
                    // 코인은 handleGameOver/handleGameWin에서 이미 저장됨 - 중복 제거
                    gameState = "start";
                    initGame();
                }}
            >
                RETURN TO LOBBY
            </button>
        </div>
    {/if}
</main>

<style>
    .text-shadow-neon {
        text-shadow:
            0 0 10px rgba(34, 211, 238, 0.8),
            0 0 20px rgba(34, 211, 238, 0.4);
    }
    canvas {
        display: block;
        image-rendering: pixelated;
    }
</style>
