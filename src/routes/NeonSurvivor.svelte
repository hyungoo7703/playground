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

    // --- Update Logic ---
    function update(dt) {
        gameTime += dt;

        // --- [추가됨] 보스 등장 시스템 ---
        // 5분(300,000ms)이 지났고, 아직 보스가 없다면?
        if (gameTime > 300000 && !enemies.some((e) => e.isBoss)) {
            // 경고창 타이머 설정
            if (bossWarningTimer === 0) {
                showBossWarning = true;
                bossWarningTimer = 3000; // 3초간 경고
            }
            if (bossWarningTimer > 0) {
                bossWarningTimer -= dt;
                if (bossWarningTimer <= 0) {
                    spawnBoss(); // 보스 소환!
                }
            }
        }

        // 1. 플레이어 이동 (기존 유지)
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
            // 정밀 정규화
            player.x += (dx / length) * player.speed;
            player.y += (dy / length) * player.speed;

            // 방향 전환 (4방향)
            if (Math.abs(dx) > Math.abs(dy)) {
                player.direction = dx > 0 ? 2 : 1; // 우 : 좌
            } else {
                player.direction = dy > 0 ? 0 : 3; // 하 : 상
            }
        }

        // 카메라 추적
        camera.x = player.x - canvas.width / 2;
        camera.y = player.y - canvas.height / 2;

        // 2. 적 스폰 (보스전 아닐 때만 일반 몹 스폰)
        if (!showBossWarning && !bossSpawned) {
            const spawnRate = Math.max(500, 2000 - gameTime / 100);
            if (Math.random() < dt / spawnRate) spawnEnemy();
        }

        // 3. 적 업데이트 (보스 로직 포함)
        enemies = enemies.filter((e) => {
            const angle = Math.atan2(player.y - e.y, player.x - e.x);
            e.x += Math.cos(angle) * e.speed;
            e.y += Math.sin(angle) * e.speed;

            // 충돌 처리
            if (
                Math.hypot(e.x - player.x, e.y - player.y) <
                (e.isBoss ? 80 : 20)
            ) {
                takeDamage(e.isBoss ? 20 : 5);
            }

            // 사망 처리
            if (e.hp <= 0) {
                if (e.isBoss) {
                    gameState = "win"; // 보스 잡으면 승리!
                } else {
                    onEnemyDeath(e);
                }
                return false;
            }
            return true;
        });

        // 4. 전투 (자동 발사)
        if (gameTime - player.lastShot > player.fireRate) {
            fireProjectile();
            player.lastShot = gameTime;
        }

        // Projectile Update
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt;

            // Check collision
            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                const dist = Math.hypot(p.x - e.x, p.y - e.y);
                if (dist < e.radius + 10) {
                    // Hit!
                    hit = true;
                    e.hp -= 20; // Dmg
                    playSound("punch", 0.5);
                    spawnDamageNumber(e.x, e.y, 20);

                    if (e.hp <= 0) {
                        enemies.splice(j, 1);
                        onEnemyDeath(e);
                    }
                    break;
                }
            }

            if (hit || p.life <= 0) {
                projectiles.splice(i, 1);
            }
        }

        // 5. Items (Magnet)
        items.forEach((item, i) => {
            const dist = Math.hypot(player.x - item.x, player.y - item.y);
            if (dist < player.magnetRadius) {
                // Magnet pull
                item.x += (player.x - item.x) * 0.1;
                item.y += (player.y - item.y) * 0.1;
            }

            if (dist < 20) {
                // Collect
                if (item.type === "exp") {
                    gainExp(item.value);
                } else {
                    player.coins += item.value;
                    playSound("coin", 0.3);
                }
                items.splice(i, 1);
            }
        });

        // 6. Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].life -= dt;
            particles[i].x += particles[i].vx;
            particles[i].y += particles[i].vy;
            if (particles[i].life <= 0) particles.splice(i, 1);
        }

        // 7. Damage Numbers
        for (let i = damageNumbers.length - 1; i >= 0; i--) {
            damageNumbers[i].y -= 0.5;
            damageNumbers[i].life -= dt;
            if (damageNumbers[i].life <= 0) damageNumbers.splice(i, 1);
        }
    }

    function spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(canvas.width, canvas.height) / 2 + 100;
        enemies.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            hp: 30 + player.level * 5,
            speed: 1.5 + Math.random() * 0.5,
            radius: 15,
            type: Math.random() > 0.9 ? 1 : 0, // 10% separate sprite or variant
        });
    }

    function spawnBoss() {
        showBossWarning = false; // 경고 끄기
        bossSpawned = true; // 보스 상태 ON
        enemies.push({
            x: player.x, // 플레이어 근처(위쪽)에서 등장
            y: player.y - 500,
            hp: 5000, // 엄청난 체력
            maxHp: 5000,
            speed: 1.5, // 느리지만 위압적
            radius: 100, // 충돌 범위 큼
            isBoss: true, // 보스 플래그
            type: 0, // 이미지 타입
        });
        playSound("warning");
    }

    function fireProjectile() {
        // 가장 가까운 적 찾기
        let nearest = null;
        let minDst = Infinity;
        for (let e of enemies) {
            const d = Math.hypot(e.x - player.x, e.y - player.y);
            if (d < minDst) {
                minDst = d;
                nearest = e;
            }
        }

        if (nearest) {
            const baseAngle = Math.atan2(
                nearest.y - player.y,
                nearest.x - player.x,
            );

            // --- 수정됨: 멀티샷 (부채꼴 사출) ---
            // weaponLevel이 1이면 1발, 3이면 3발 부채꼴
            const count = player.weaponLevel;
            const spread = 0.2; // 탄환 간격 (라디안)

            for (let i = 0; i < count; i++) {
                // 부채꼴 각도 계산
                const angleOffset = (i - (count - 1) / 2) * spread;

                projectiles.push({
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(baseAngle + angleOffset) * 10, // 속도 8 -> 10 증가
                    vy: Math.sin(baseAngle + angleOffset) * 10,
                    life: 2000, // 사거리 증가 (2초)
                });
            }
            playSound("zap", 0.1);
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
            player.maxExp = Math.floor(player.maxExp * 1.2);
            playSound("levelup");
            triggerLevelUp();
        }
    }

    function triggerLevelUp() {
        gameState = "levelup";
        // 4가지 스킬 정의 (이미지 순서: 0:연사, 1:공격(멀티샷), 2:자석, 3:방패/속도)
        const allSkills = [
            {
                id: 0,
                name: "Rapid Fire",
                desc: "공격 속도 +20%",
                icon: "🔫",
                effect: () => (player.fireRate *= 0.8),
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

    // --- Render ---
    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. 배경 (기존 동일)
        const bg = assets.images.bg;
        if (bg && bg.complete) {
            const bgW = bg.naturalWidth;
            const bgH = bg.naturalHeight;
            const offX = -Math.floor(camera.x) % bgW;
            const offY = -Math.floor(camera.y) % bgH;
            for (let x = offX - bgW; x < canvas.width + bgW; x += bgW) {
                for (let y = offY - bgH; y < canvas.height + bgH; y += bgH) {
                    ctx.drawImage(bg, x, y, bgW, bgH);
                }
            }
        } else {
            ctx.fillStyle = "#111";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // --- 수정됨: 네온 블렌딩 모드 (검은 배경 제거) ---
        ctx.globalCompositeOperation = "screen";

        // 2. 아이템 (보석/코인 위치 보정)
        items.forEach((item) => {
            const sheet = assets.images.items;
            if (sheet && sheet.complete) {
                // 이미지가 [보석들][코인] 반반 나뉘어 있다고 가정
                const sw = sheet.naturalWidth / 2;
                const sh = sheet.naturalHeight;
                const sx = item.type === "coin" ? sw : 0; // 코인이면 오른쪽 절반

                ctx.drawImage(
                    sheet,
                    sx,
                    0,
                    sw,
                    sh,
                    item.x - 15,
                    item.y - 15,
                    30,
                    30,
                );
            }
        });

        // 3. 적 (5종 몹 정밀 슬라이싱)
        enemies.forEach((e) => {
            if (e.isBoss) {
                const bossImg = assets.images.boss;
                if (bossImg?.complete) {
                    // 보스는 그냥 통짜로 크게 그림
                    ctx.drawImage(bossImg, e.x - 100, e.y - 100, 200, 200);
                }
            } else {
                const mobSheet = assets.images.mobs;
                if (mobSheet?.complete) {
                    // 3열 2행 (총 6칸) 구조 가정
                    const mw = mobSheet.naturalWidth / 3;
                    const mh = mobSheet.naturalHeight / 2;
                    // type에 따라 이미지 선택
                    const col = e.type % 3;
                    const row = Math.floor(e.type / 3) % 2;

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

        // 4. 플레이어 (정면 고정)
        const hero = assets.images.hero;
        if (hero && hero.complete) {
            // 스프라이트 시트: 가로 4칸, 세로 2칸
            const hw = hero.naturalWidth / 4;
            const hh = hero.naturalHeight / 2;

            ctx.drawImage(
                hero,
                0,
                0,
                hw,
                hh,
                player.x - 35,
                player.y - 35,
                70,
                70,
            );

            // --- Hero HP Gauge ---
            const hpW = 60;
            const hpH = 6;
            const hpX = player.x - hpW / 2;
            const hpY = player.y - 50; // 머리 위

            // Back
            ctx.fillStyle = "#333";
            ctx.fillRect(hpX, hpY, hpW, hpH);
            // Fill
            const hpPercent = Math.max(0, player.hp / player.maxHp);
            ctx.fillStyle = hpPercent > 0.3 ? "#0f0" : "#f00";
            ctx.fillRect(hpX, hpY, hpW * hpPercent, hpH);
            // Border
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;
            ctx.strokeRect(hpX, hpY, hpW, hpH);
        }

        // 5. 탄환 (네온 효과 강화)
        ctx.fillStyle = "#0ff";
        ctx.shadowBlur = 15; // 빛나는 효과
        ctx.shadowColor = "#0ff";
        projectiles.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); // 크기 약간 키움
            ctx.fill();
        });
        ctx.shadowBlur = 0; // 초기화

        // 6. 파티클 (기존 동일)
        particles.forEach((p) => {
            ctx.globalAlpha = p.life / 500;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        });
        ctx.globalAlpha = 1;

        ctx.restore(); // 블렌딩 모드 해제

        // 7. 데미지 폰트 및 HUD (기존 코드 호출)
        drawHUD();
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
