import { gameStore } from '../../store.js';

const GRAVITY = 0.22;
const BOUNCE = 0.75;
const SUB_STEPS = 4;

// 파티클 생성 함수
function createExplosion(state, x, y, color) {
  if (!state.particles) state.particles = [];
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 1.0,
      color: color
    });
  }
}

export function initPhysics(stage) {
  const resetPegs = stage.pegs.map(p => ({ ...p, active: true }));
  const resetWalls = stage.movingWalls.map(w => ({ ...w }));
  const resetBars = stage.rotatingBars.map(b => ({ ...b }));

  gameStore.update(state => ({
    ...state,
    pegs: resetPegs,
    zones: stage.gravityZones,
    portals: stage.portals,
    movingWalls: resetWalls,
    rotatingBars: resetBars,
    ballsLeft: stage.ballCount,
    balls: [],
    particles: [],     // 초기화
    floatingTexts: [], // 초기화
    shake: 0,          // 초기화
    currentCombo: 0,   // 초기화
    score: 0,
    isWin: false,
    isGameOver: false,
    suctionTarget: null
  }));
}

export function updatePhysics(width, height) {
  gameStore.update(state => {
    if (state.isWin || state.isGameOver) return state;

    // 1. 효과 업데이트 (Shake, Particles, Floating Texts)
    if (state.shake > 0) state.shake *= 0.9;
    if (Math.abs(state.shake) < 0.5) state.shake = 0;

    if (state.particles && state.particles.length > 0) {
      state.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.05; p.vy += 0.1; // 중력 적용
      });
      state.particles = state.particles.filter(p => p.life > 0);
    }

    if (state.floatingTexts && state.floatingTexts.length > 0) {
      state.floatingTexts.forEach(t => {
        t.y -= 1; t.life -= 0.02;
      });
      state.floatingTexts = state.floatingTexts.filter(t => t.life > 0);
    }

    // 2. 장애물 이동 업데이트
    state.movingWalls.forEach((w) => {
      w.x += w.dir * w.speed;
      if (Math.abs(w.x - 200) > w.range) w.dir *= -1;
    });
    state.rotatingBars.forEach(b => { b.angle += b.speed; });

    // 3. 물리 서브 스테핑
    for (let s = 0; s < SUB_STEPS; s++) {
      state.balls.forEach(ball => {
        // 흡수(블랙홀) 로직
        if (state.suctionTarget) {
          const dx = state.suctionTarget.x - ball.x;
          const dy = state.suctionTarget.y - ball.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 8) { ball.vx = dx * 0.25; ball.vy = dy * 0.25; }
          else { ball.y = height + 1000; return; }
          ball.x += ball.vx; ball.y += ball.vy;
          return;
        }

        let gravity = GRAVITY / SUB_STEPS;
        state.zones.forEach(z => {
          if (ball.x > z.x && ball.x < z.x + z.w && ball.y > z.y && ball.y < z.y + z.h) {
            gravity = z.power / SUB_STEPS;
          }
        });

        ball.vy += gravity;
        ball.x += ball.vx / SUB_STEPS;
        ball.y += ball.vy / SUB_STEPS;

        // 벽 충돌
        if (ball.x < 15) { ball.x = 15; ball.vx *= -BOUNCE; }
        else if (ball.x > width - 15) { ball.x = width - 15; ball.vx *= -BOUNCE; }

        // 움직이는 벽돌 충돌 및 끼임 방지
        state.movingWalls.forEach(w => {
          const dx = ball.x - w.x;
          const dy = ball.y - w.y;
          const halfW = w.w / 2 + 7;
          const halfH = w.h / 2 + 7;
          if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
            const overlapX = halfW - Math.abs(dx);
            const overlapY = halfH - Math.abs(dy);
            if (overlapX < overlapY) {
              ball.x += overlapX * Math.sign(dx);
              ball.vx *= -BOUNCE;
            } else {
              ball.y += overlapY * Math.sign(dy);
              ball.vy *= -BOUNCE;
            }
            window.dispatchEvent(new CustomEvent('pegHit'));
          }
        });

        // 회전 바 충돌 보정
        state.rotatingBars.forEach(b => {
          const dx = ball.x - b.x; const dy = ball.y - b.y;
          const cos = Math.cos(-b.angle); const sin = Math.sin(-b.angle);
          const rx = dx * cos - dy * sin; const ry = dx * sin + dy * cos;
          const halfL = b.length / 2 + 7; const halfW = b.width / 2 + 7;

          if (Math.abs(rx) < halfL && Math.abs(ry) < halfW) {
            let vrx = ball.vx * cos - ball.vy * sin;
            let vry = ball.vx * sin + ball.vy * cos;
            const pushOut = (halfW - Math.abs(ry)) * Math.sign(ry);
            ball.x += -pushOut * sin; ball.y += pushOut * cos;
            vry *= -BOUNCE;
            ball.vx = vrx * Math.cos(b.angle) - vry * Math.sin(b.angle);
            ball.vy = vrx * Math.sin(b.angle) + vry * Math.cos(b.angle);
            window.dispatchEvent(new CustomEvent('pegHit'));
          }
        });

        // 핀(Peg) 충돌 및 스코어/콤보 시스템
        state.pegs.forEach(peg => {
          if (!peg.active) return;
          const dist = Math.sqrt((ball.x - peg.x) ** 2 + (ball.y - peg.y) ** 2);
          if (dist < (peg.radius + 8)) {
            if (peg.type === 'suction') {
              state.suctionTarget = { x: peg.x, y: peg.y };
              window.dispatchEvent(new CustomEvent('powerUp'));
              peg.active = false;
              state.shake = 10;
              createExplosion(state, peg.x, peg.y, peg.color);
            } else {
              const angle = Math.atan2(ball.y - peg.y, ball.x - peg.x);
              ball.vx = Math.cos(angle) * 7;
              ball.vy = Math.sin(angle) * 7;
              peg.active = false;

              // --- 콤보 및 점수 계산 로직 ---
              state.currentCombo = (state.currentCombo || 0) + 1;
              const baseScore = peg.type === "gold" ? 1000 : 100;
              const comboMultiplier = 1 + (state.currentCombo * 0.1); // 콤보당 10% 가산
              const finalScore = Math.floor(baseScore * comboMultiplier);
              state.score += finalScore;

              // 시각 효과 추가
              createExplosion(state, peg.x, peg.y, peg.color);
              if (!state.floatingTexts) state.floatingTexts = [];
              state.floatingTexts.push({
                x: peg.x, y: peg.y,
                text: `+${finalScore}`,
                life: 1.0,
                color: peg.type === "gold" ? "#ffff00" : "#fff"
              });

              // 황금 핀이나 고콤보 시 진동
              if (peg.type === 'gold' || state.currentCombo % 5 === 0) state.shake = 5;

              window.dispatchEvent(new CustomEvent("pegHit"));
            }
          }
        });

        // 포탈
        state.portals.forEach(p => {
          if (Math.sqrt((ball.x - p.entry.x) ** 2 + (ball.y - p.entry.y) ** 2) < 22) {
            ball.x = p.exit.x; ball.y = p.exit.y;
            window.dispatchEvent(new CustomEvent('portalWarp'));
          }
        });
      });
    }

    // 승리/패배 판정
    const activeBalls = state.balls.filter(b => b.y < height);
    if (state.suctionTarget && activeBalls.length === 0) state.suctionTarget = null;

    const goldLeft = state.pegs.filter(p => p.type === 'gold' && p.active).length;
    if (goldLeft === 0 && state.pegs.length > 0 && !state.isWin) {
      state.isWin = true;
      const nextLevel = state.currentLevel + 1;
      const newHighScore = Math.max(state.highScore, state.score);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('neon_blast_save', JSON.stringify({ level: nextLevel, highScore: newHighScore }));
      }
      state.currentLevel = nextLevel; state.highScore = newHighScore;
    }

    if (state.ballsLeft === 0 && activeBalls.length === 0 && !state.isWin) state.isGameOver = true;
    return { ...state, balls: activeBalls };
  });
}

// 이 함수가 정상적으로 export 되어야 에러가 해결됩니다!
export function shootBall(x) {
  gameStore.update((state) => {
    if (state.ballsLeft <= 0 || state.isWin || state.isGameOver || state.suctionTarget) return state;

    // 새로운 발사 시 콤보 리셋 (공 한 번 발사할 때마다 콤보 누적 방식)
    return {
      ...state,
      ballsLeft: state.ballsLeft - 1,
      currentCombo: 0,
      balls: [
        ...state.balls,
        { x, y: 30, vx: (Math.random() - 0.5) * 2, vy: 3 },
      ],
    };
  });
}