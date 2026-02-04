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
        items: `${ASSET_PATH}/EXPgems-and-coin.png`,
        // skills: `${ASSET_PATH}/skill-icons.png`, // Removed as per user request
        main: `${ASSET_PATH}/main.png`,
        bg: `${ASSET_PATH}/background.png`,
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
    let showBossWarning = false;
    let bossWarningTimer = 0;

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

    function buyUpgrade(item) {
        if (!savedData.upgrades[item.id]) savedData.upgrades[item.id] = 0;

        if (savedData.coins >= item.cost) {
            savedData.coins -= item.cost;
            savedData.upgrades[item.id]++;
            saveGame();
            // Force Reactivity
            savedData = { ...savedData };
        }
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
    let camera = { x: 0, y: 0 };
    let keys = {};
    let touchStart = null;
    let joystickVector = { x: 0, y: 0 };

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
        bossSpawned = false; // 보스 상태 초기화

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
    }

    function resizeCanvas() {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
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
        gameLoop(0);
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

    // --- Core Loop ---
    let lastTime = 0;
    function gameLoop(timestamp) {
        if (gameState !== "playing") return;

        const dt = timestamp - lastTime;
        lastTime = timestamp;

        update(dt);
        draw();

        animationId = requestAnimationFrame(gameLoop);
    }

    // --- Update Logic (물리 및 충돌 로직 복구) ---
    function update(dt) {
        gameTime += dt;

        // 1. 보스 등장 시스템 (수정: 5분 -> 1분으로 단축하여 테스트 및 빠른 진행 유도)
        if (gameTime > 60000 && !enemies.some((e) => e.isBoss)) {
            if (bossWarningTimer === 0) {
                showBossWarning = true;
                bossWarningTimer = 3000;
            }
            if (bossWarningTimer > 0) {
                bossWarningTimer -= dt;
                if (bossWarningTimer <= 0) spawnBoss();
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

        // 3. 적 스폰 및 추적
        if (!showBossWarning && !bossSpawned) {
            // Difficulty Balance: Spawn rate ~1.5x (Base 1000->650, Min 250->160)
            let spawnRate = Math.max(160, 650 - gameTime / 100);

            // --- Horde Mode (4분~5분사이) ---
            // 240,000ms = 4분, 300,000ms = 5분
            if (gameTime > 240000 && gameTime < 300000) {
                spawnRate = 75; // Horde mode slightly relaxed (was 50)
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
                if (e.isBoss) gameState = "win";
                else onEnemyDeath(e);
                return false;
            }
            return true;
        });

        // 4. 전투 (총구 위치 보정 발사)
        if (gameTime - player.lastShot > player.fireRate) {
            fireProjectile();
            player.lastShot = gameTime;
        }

        // 5. 투사체 이동 및 충돌
        projectiles = projectiles.filter((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt;

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
                    // Balance: Base 12 + Shop Upgrade (*2) + Level (*1)
                    // Reduced level scaling from *2 to *1
                    const baseDmg = 12 + (savedData.upgrades?.damage || 0) * 2;
                    const damage = baseDmg + player.level * 1;
                    e.hp -= damage;
                    spawnDamageNumber(e.x, e.y, Math.round(damage));

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

        // 7. 파티클 & 데미지 숫자 업데이트
        particles = particles.filter((p) => (p.life -= dt) > 0);
        damageNumbers = damageNumbers.filter((dn) => (dn.life -= dt) > 0);
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

        enemies.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            hp: (30 + player.level * 5) * timeFactor, // Apply scaling
            speed: 1.5 + Math.random() * 0.5,
            radius: 15,
            type: Math.floor(Math.random() * 3), // 0 to 2 (Top 3 types only)
        });
    }

    function spawnBoss() {
        showBossWarning = false; // 경고 끄기
        bossSpawned = true; // 보스 상태 ON
        enemies.push({
            x: player.x, // 플레이어 근처(위쪽)에서 등장
            y: player.y - 500,
            hp: 50000, // Massive HP (Double previous 25k)
            maxHp: 50000,
            speed: 1.8, // Slightly faster
            radius: 100, // 충돌 범위 큼
            isBoss: true, // 보스 플래그
            type: 0, // 이미지 타입
        });
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
        // Spawn Drop
        items.push({
            x: enemy.x,
            y: enemy.y,
            type: Math.random() > 0.8 ? "coin" : "exp", // 20% coin
            value: 10,
        });
        // Spawn particles
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
        ctx.translate(-camera.x, -camera.y);

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
            ctx.fillStyle = p.isEnemy ? "#f00" : "#0ff"; // 적 투사체는 빨강
            ctx.shadowColor = p.isEnemy ? "#f00" : "#0ff";

            ctx.beginPath();
            ctx.arc(
                p.x,
                p.y,
                p.isEnemy ? 8 : 5 + player.projectileSize,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        });

        // 3. 적 & 보스 (일반 모드 - 발광 제거)
        enemies.forEach((e) => {
            if (e.isBoss) {
                const bossImg = assets.images.boss;
                if (bossImg?.complete)
                    ctx.drawImage(bossImg, e.x - 150, e.y - 150, 300, 300);
            } else {
                const mobSheet = assets.images.mobs;
                if (mobSheet?.complete) {
                    // 3 columns x 1 rows
                    const mw = mobSheet.naturalWidth / 3;
                    const mh = mobSheet.naturalHeight / 2;
                    const col = e.type % 3;
                    const row = Math.floor(e.type / 3); // 0 or 1

                    ctx.drawImage(
                        mobSheet,
                        col * mw,
                        row * mh,
                        mw,
                        mh,
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
        ctx.font = "bold 14px Arial"; // Slightly bigger
        ctx.fillStyle = "white";
        ctx.shadowBlur = 2;
        ctx.shadowColor = "black";
        damageNumbers.forEach((dn) => {
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

    function spawnDamageNumber(x, y, val) {
        damageNumbers.push({ x, y, val, life: 500 });
    }

    // --- Input ---
    function handleKeyDown(e) {
        keys[e.key] = true;
    }
    function handleKeyUp(e) {
        keys[e.key] = false;
    }

    // Touch Joystick
    function handleTouchStart(e) {
        e.preventDefault();
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
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
                                {item.cost} CP
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
            </div>
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
            {:else}
                <p class="text-white text-xl mb-8">
                    You survived until Level {player.level}
                </p>
            {/if}

            <button
                class="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition"
                on:click={() => {
                    // 저장 로직 추가
                    savedData.coins += player.coins;
                    saveGame();

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
