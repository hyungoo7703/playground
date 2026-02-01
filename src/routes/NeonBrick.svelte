<script>
  import { onMount, onDestroy } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { base } from "../lib/store.js";

  // --- Game Constants ---
  const BALL_RADIUS = 8;
  const PADDLE_HEIGHT = 24; // Taller paddle
  const PADDLE_WIDTH = 120; // Wider paddle
  const PADDLE_BOTTOM_MARGIN = 60; // Raise paddle up (~1-1.5cm)
  const BRICK_PADDING = 8;
  const BRICK_OFFSET_TOP = 60;
  const BRICK_OFFSET_LEFT = 20;

  // Colors for Neon Effect
  const NEON_COLORS = [
    "#facc15", // Yellow
    "#f472b6", // Pink
    "#60a5fa", // Blue
    "#4ade80", // Green
    "#c084fc", // Purple
    "#fb7185", // Rose
  ];

  let canvas;
  let ctx;
  let animationId;
  let score = 0;
  let level = 1;
  let lives = 3;
  let isGameOver = false;
  let isPaused = false;
  let isGameStarted = false; // Waiting for first launch
  let isProcessingBlackHole = false;
  let isLevelClearing = false;
  let lastDeathTime = 0;

  // Audio
  let popSound;
  const popSoundPath = `${base}/sounds/pop.mp3`;

  // Game Objects
  let balls = []; // Changed to array
  let paddle = { x: 0, width: PADDLE_WIDTH };
  let bricks = [];
  let particles = [];
  let shake = 0; // Screen shake magnitude

  // ... (omitted) ...

  // --- Initialization ---
  onMount(() => {
    // Audio Preload
    popSound = new Audio(popSoundPath);
    popSound.volume = 0.4;
    popSound.load();

    // Canvas Setup
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Controls
    window.addEventListener("keydown", keyDownHandler);
    window.addEventListener("keyup", keyUpHandler);
    window.addEventListener("mousemove", mouseMoveHandler);
    window.addEventListener("touchmove", touchMoveHandler, { passive: false });
    window.addEventListener("touchstart", touchStartHandler, {
      passive: false,
    });

    // Initial Level
    initLevel();
    resetBall();

    // Game Loop
    draw();
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", keyDownHandler);
      window.removeEventListener("keyup", keyUpHandler);
      window.removeEventListener("mousemove", mouseMoveHandler);
      window.removeEventListener("touchmove", touchMoveHandler);
      window.removeEventListener("touchstart", touchStartHandler);
      cancelAnimationFrame(animationId);
    }
  });

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    paddle.x = (canvas.width - paddle.width) / 2;
  }

  // --- Input Handlers ---
  let rightPressed = false;
  let leftPressed = false;

  function keyDownHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") rightPressed = true;
    else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = true;
  }
  function keyUpHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") rightPressed = false;
    else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = false;
  }
  function mouseMoveHandler(e) {
    const relativeX = e.clientX;
    if (relativeX > 0 && relativeX < canvas.width) {
      paddle.x = relativeX - paddle.width / 2;
    }
  }
  function touchMoveHandler(e) {
    e.preventDefault();
    const relativeX = e.touches[0].clientX;
    if (relativeX > 0 && relativeX < canvas.width) {
      paddle.x = relativeX - paddle.width / 2;
    }
  }
  function touchStartHandler(e) {
    if (isGameOver) return;
    if (!isGameStarted) {
      isGameStarted = true;
      isPaused = false;
    }
  }

  function launchGame() {
    if (!isGameStarted) {
      isGameStarted = true;
    } else if (isGameOver) {
      restartGame();
    }
  }

  // --- Game Logic ---

  function playPop() {
    if (!popSound) return;
    const s = popSound.cloneNode();
    s.currentTime = 0.1; // Skip potential silence
    s.volume = 0.4;
    s.play().catch(() => {});
    setTimeout(() => s.pause(), 150);
  }

  function initLevel() {
    bricks = [];
    const rowCount = 3 + Math.min(level, 6); // Max 9 rows
    // Calculate cols based on width
    const brickWidth = 60;
    const colCount = Math.floor(
      (canvas.width - 2 * BRICK_OFFSET_LEFT) / (brickWidth + BRICK_PADDING),
    );
    const startX =
      (canvas.width - colCount * (brickWidth + BRICK_PADDING)) / 2 +
      BRICK_PADDING / 2;

    for (let c = 0; c < colCount; c++) {
      for (let r = 0; r < rowCount; r++) {
        // Randomly skip some bricks for "random pattern" feel
        if (Math.random() > 0.85) continue;

        // Determine Brick Type
        let type = "standard";
        let color = NEON_COLORS[(c + r) % NEON_COLORS.length];

        const rand = Math.random();
        if (rand < 0.03) {
          type = "blackhole";
          color = "#9333ea"; // Deep Purple
        } else if (rand < 0.08) {
          type = "lightning";
          color = "#fef08a"; // Bright Yellow
        }

        bricks.push({
          x: startX + c * (brickWidth + BRICK_PADDING),
          y: BRICK_OFFSET_TOP + r * (20 + BRICK_PADDING),
          status: 1,
          type: type,
          color: color,
          width: brickWidth,
          height: 20,
        });
      }
    }
  }

  function restartGame() {
    score = 0;
    level = 1;
    lives = 3;
    isGameOver = false;
    initLevel();
    isProcessingBlackHole = false;
    isLevelClearing = false;
    resetBall();
  }

  function triggerBlackHole(ballIndex, brickX, brickY) {
    // 1. Remove the ball that hit immediately (absorb effect)
    isProcessingBlackHole = true;
    if (balls[ballIndex]) {
      balls.splice(ballIndex, 1);
    }

    // 2. Visuals: Implosion
    createParticles(brickX, brickY, "#9333ea", 40);
    shake = 10;

    // 3. Spawn Multi-balls after delay
    setTimeout(() => {
      spawnMultiBalls(brickX, brickY);
      shake = 10; // Explosion shake
      isProcessingBlackHole = false;
    }, 600);
  }

  function triggerLightning(startX, startY) {
    // Chain reaction
    let count = 0;
    const maxChain = 8;

    function chain() {
      if (count >= maxChain) return;

      // Find nearest active brick
      let target = null;
      let minDist = 9999;

      bricks.forEach((b) => {
        if (b.status === 1) {
          const dx = b.x - startX;
          const dy = b.y - startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300 && dist > 10 && dist < minDist) {
            // 300px radius
            minDist = dist;
            target = b;
          }
        }
      });

      if (target) {
        target.status = 0;
        score += 20; // Bonus score
        createParticles(
          target.x + target.width / 2,
          target.y + target.height / 2,
          "#fef08a",
          15,
        );
        startX = target.x;
        startY = target.y;
        count++;
        shake = 3;
        setTimeout(chain, 50); // Delay between zaps
      }
    }
    chain();
  }

  function collisionDetection() {
    let activeBricks = 0;

    // Check collision for ALL balls (Iterate backwards for safety when splicing)
    for (let i = balls.length - 1; i >= 0; i--) {
      let ball = balls[i];
      if (!ball) continue; // Safety check

      for (let j = 0; j < bricks.length; j++) {
        let b = bricks[j];
        if (b.status === 1) {
          if (
            ball.x > b.x &&
            ball.x < b.x + b.width &&
            ball.y > b.y &&
            ball.y < b.y + b.height
          ) {
            ball.dy = -ball.dy;
            b.status = 0; // Break brick
            score += 10;
            playPop();

            const centerX = b.x + b.width / 2;
            const centerY = b.y + b.height / 2;

            // Special Brick Logic
            if (b.type === "blackhole") {
              triggerBlackHole(i, centerX, centerY);
              score += 50;
              // Ball is removed, break inner loop to stop checking this ball
              break;
            } else if (b.type === "lightning") {
              triggerLightning(centerX, centerY);
              score += 30;
              createParticles(centerX, centerY, b.color, 25);
              shake = 6;
            } else {
              createParticles(centerX, centerY, b.color, 20);
              shake = 6;
            }
          }
        }
      }
    }

    // Check level clear
    activeBricks = bricks.filter((b) => b.status === 1).length;

    if (activeBricks === 0 && !isLevelClearing) {
      // Level Cleared
      isLevelClearing = true;
      level++;
      createParticles(canvas.width / 2, canvas.height / 2, "#ffffff", 50);
      lives++;
      setTimeout(() => {
        initLevel();
        resetBall();
        isLevelClearing = false;
      }, 1000);
    }
  }

  function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 15, // Significantly faster explosion
        vy: (Math.random() - 0.5) * 15,
        life: 1.0,
        color: color,
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function resetBall(softReset = false) {
    if (!softReset) isGameStarted = false;
    else isGameStarted = true; // Auto-play if soft reset

    balls = [];
    spawnBall();
  }

  function spawnBall(x, y, dx, dy) {
    const speed = 4 + level * 0.4; // Decreased speed
    // Calculate spawn Y to be above the raised paddle
    const defaultY = canvas.height - PADDLE_BOTTOM_MARGIN - PADDLE_HEIGHT - 20;

    balls.push({
      x: x || canvas.width / 2,
      y: y || defaultY,
      dx: dx || speed * (Math.random() > 0.5 ? 1 : -1),
      dy: dy || -speed,
      radius: BALL_RADIUS,
      color: "#ffffff",
    });
    paddle.x = (canvas.width - paddle.width) / 2;
  }

  function spawnMultiBalls(x, y) {
    const speed = 4 + level * 0.4;
    [-0.5, 0, 0.5].forEach((offset) => {
      balls.push({
        x: x,
        y: y,
        dx: offset * speed * 0.5,
        dy: -speed,
        radius: BALL_RADIUS,
        color: "#c084fc",
      });
    });
  }

  // ... (omitted) ...

  function draw() {
    // Clear Canvas with Shake logic
    ctx = canvas.getContext("2d");
    ctx.save();

    // Apply Shake
    if (shake > 0) {
      const dx = (Math.random() - 0.5) * shake;
      const dy = (Math.random() - 0.5) * shake;
      ctx.translate(dx, dy);
      shake *= 0.85;
      if (shake < 0.5) shake = 0;
    }

    // Clear wider area to handle shake offset
    ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);

    // Update Paddle
    if (rightPressed && paddle.x < canvas.width - paddle.width) paddle.x += 9;
    else if (leftPressed && paddle.x > 0) paddle.x -= 9;

    // --- Draw Bricks ---
    bricks.forEach((b) => {
      if (b.status === 1) {
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.width, b.height);
        ctx.fillStyle = b.color;

        // Add glow only for special bricks
        if (b.type !== "standard") {
          ctx.shadowBlur = 15;
          ctx.shadowColor = b.color;
        }

        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.closePath();

        // Reset shadow
        ctx.shadowBlur = 0;
      }
    });

    // --- Draw Paddle ---
    ctx.beginPath();
    ctx.rect(
      paddle.x,
      canvas.height - PADDLE_HEIGHT - PADDLE_BOTTOM_MARGIN,
      paddle.width,
      PADDLE_HEIGHT,
    );
    ctx.fillStyle = "#00ffff";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00ffff";
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;

    // --- Draw Balls & Logic ---
    if (isGameStarted && !isGameOver && !isPaused) {
      for (let i = balls.length - 1; i >= 0; i--) {
        let ball = balls[i];

        // Draw
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color || "#ffffff";
        ctx.shadowBlur = 10;
        ctx.shadowColor = ball.color || "#ffffff";
        ctx.fill();
        ctx.closePath();
        ctx.shadowBlur = 0;

        // Movement
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Wall Collision
        if (
          ball.x + ball.dx > canvas.width - ball.radius ||
          ball.x + ball.dx < ball.radius
        ) {
          ball.dx = -ball.dx;
        }
        if (ball.y + ball.dy < ball.radius) {
          ball.dy = -ball.dy;
        } else if (
          ball.y + ball.dy >
          canvas.height - ball.radius - PADDLE_HEIGHT - PADDLE_BOTTOM_MARGIN + 5
        ) {
          // Paddle Collision
          if (
            ball.x > paddle.x &&
            ball.x < paddle.x + paddle.width &&
            ball.y < canvas.height - PADDLE_BOTTOM_MARGIN
          ) {
            ball.dy = -ball.dy;
            // Add some horizontal variation based on hit position
            const hitPoint = ball.x - (paddle.x + paddle.width / 2);
            ball.dx = hitPoint * 0.15;
            playPop();
          } else if (ball.y > canvas.height - ball.radius) {
            // Ball lost
            balls.splice(i, 1);
          }
        }
      }

      collisionDetection();
      updateParticles();

      // Death Condition: No balls left AND not processing special event
      if (balls.length === 0 && !isProcessingBlackHole && !isLevelClearing) {
        const now = Date.now();
        if (now - lastDeathTime > 1000) {
          // 1 second debounce
          lives--;
          lastDeathTime = now;
          if (!lives) {
            isGameOver = true;
          } else {
            resetBall(true);
          }
        }
      }
    } else {
      // Draw balls stationary
      balls.forEach((ball) => {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color || "#ffffff";
        ctx.fill();
        ctx.closePath();
      });
    }

    // --- Draw Particles ---
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.closePath();
    });

    animationId = requestAnimationFrame(draw);
    ctx.restore();
  }
</script>

<div class="fixed inset-0 w-full h-full overflow-hidden bg-black font-sans">
  <!-- Background Image with Overlay -->
  <div class="absolute inset-0 z-0 opacity-40">
    <img
      src="{base}/images/neon/background-brick.png"
      alt="Background"
      class="w-full h-full object-cover"
    />
  </div>

  <!-- Canvas Game Layer -->
  <canvas bind:this={canvas} class="absolute inset-0 z-10 block"></canvas>

  <!-- UI Layer -->
  <div
    class="absolute inset-0 z-20 pointer-events-none p-4 flex flex-col justify-between"
  >
    <!-- Top HUD -->
    <div class="flex justify-between items-start text-white drop-shadow-lg">
      <div class="flex flex-col">
        <span class="text-xs text-gray-400 font-bold uppercase">레벨</span>
        <span class="text-3xl font-black text-yellow-400">{level}</span>
      </div>
      <div class="flex flex-col items-end">
        <span class="text-xs text-gray-400 font-bold uppercase">점수</span>
        <span class="text-3xl font-black text-cyan-400">{score}</span>
      </div>
    </div>

    <!-- Lives -->
    <div class="flex gap-1 justify-center pb-2">
      {#each Array(lives) as _, i}
        <span
          class="text-2xl text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"
          >❤️</span
        >
      {/each}
    </div>
  </div>

  <!-- Overlay Screens -->
  {#if !isGameStarted && !isGameOver}
    <div
      class="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
      on:click={launchGame}
    >
      <div class="text-center animate-bounce">
        <p
          class="text-cyan-400 text-lg font-bold mb-2 uppercase tracking-widest"
        >
          터치하여 시작
        </p>
        <div class="text-white text-opacity-50 text-sm">
          화면을 드래그하여 패들을 움직이세요
        </div>
      </div>
    </div>
  {/if}

  {#if isGameOver}
    <div
      class="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto"
      in:fade
    >
      <div
        class="text-center p-8 bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl"
      >
        <h2 class="text-5xl font-black text-red-500 mb-2 drop-shadow-lg">
          GAME OVER
        </h2>
        <p class="text-gray-400 mb-8">도달한 레벨: {level}</p>
        <div class="text-3xl font-bold text-white mb-8">최종 점수: {score}</div>

        <button
          on:click={restartGame}
          class="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all"
        >
          다시 도전하기
        </button>
      </div>
    </div>
  {/if}
</div>
