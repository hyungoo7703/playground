// Neon Guardian rules. No DOM in here: the screen draws the state and plays the
// returned events, and the same code can be stepped headless to check balance.
import {
  FIELD,
  PLAYER,
  ENEMIES,
  WAVES,
  BOSS,
  UPGRADES,
  HP_GROWTH,
  SPEED_GROWTH,
  RATE_STEP,
  SHIELD_CHARGES,
  BOUNTY_STEP,
} from "./config.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createGame(seed = Date.now()) {
  const state = {
    rand: mulberry32(seed),
    phase: "playing", // playing | upgrade | over | clear
    wave: 0,
    time: 0,
    waveTime: 0,
    hp: PLAYER.hp,
    shield: 0,
    coins: 0,
    bombCost: PLAYER.bombCost,
    levels: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
    aim: 0,
    cooldown: 0,
    bullets: [],
    enemies: [],
    queue: [],
    choices: [],
    bossWarn: 0,
    bossPhase: 0,
    nextId: 1,
  };
  startWave(state, []);
  return state;
}

function startWave(state, events) {
  state.waveTime = 0;
  const wave = WAVES[state.wave];
  if (wave === "boss") {
    state.bossWarn = BOSS.warn;
    events.push({ type: "bossWarn" });
    return;
  }
  state.queue = wave
    .flatMap(([type, count, gap, delay]) =>
      Array.from({ length: count }, (_, i) => ({ t: delay + i * gap, type })),
    )
    .sort((a, b) => a.t - b.t);
}

function spawn(state, type, x, y) {
  const def = ENEMIES[type];
  const margin = def.radius + 8;
  const enemy = {
    id: state.nextId++,
    type,
    x: x ?? margin + state.rand() * (FIELD.w - margin * 2),
    y: y ?? -def.radius,
    vx: 0,
    vy: def.speed * (1 + SPEED_GROWTH * state.wave),
    hp: Math.ceil(def.hp * (1 + HP_GROWTH * state.wave)),
    radius: def.radius,
    swayPhase: state.rand() * Math.PI * 2,
  };
  enemy.maxHp = enemy.hp;
  enemy.baseX = enemy.x;
  state.enemies.push(enemy);
  return enemy;
}

function spawnBoss(state, events) {
  state.enemies.push({
    id: state.nextId++,
    type: "boss",
    x: FIELD.w / 2,
    y: -BOSS.radius,
    vx: 0,
    vy: 0,
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    radius: BOSS.radius,
    dir: 1,
    shellT: 2,
    addT: 3,
  });
  state.bossPhase = 0;
  events.push({ type: "bossArrive" });
}

function fireShells(state, boss, count) {
  for (let i = 0; i < count; i++) {
    const shell = spawn(state, "shell", boss.x + (i - (count - 1) / 2) * 34, boss.y + boss.radius * 0.6);
    const targetX = 30 + state.rand() * (FIELD.w - 60);
    const dx = targetX - shell.x;
    const dy = FIELD.baseY - shell.y;
    const len = Math.hypot(dx, dy);
    const speed = ENEMIES.shell.speed;
    shell.vx = (dx / len) * speed;
    shell.vy = (dy / len) * speed;
  }
}

function hurt(state, enemy, amount, events) {
  if (enemy.dead) return;
  enemy.hp -= amount;
  if (enemy.hp > 0) return;
  enemy.dead = true;
  events.push({ type: "kill", kind: enemy.type, x: enemy.x, y: enemy.y });

  if (enemy.type === "boss") {
    state.enemies.forEach((e) => (e.dead = true));
    state.phase = "clear";
    events.push({ type: "bossDead", x: enemy.x, y: enemy.y }, { type: "clear" });
    return;
  }

  const def = ENEMIES[enemy.type];
  if (def.coins) {
    state.coins += def.coins * (1 + BOUNTY_STEP * state.levels.bounty);
    events.push({ type: "coin", x: enemy.x, y: enemy.y });
  }
  for (let i = 0; i < (def.split ?? 0); i++) {
    spawn(state, "mini", clamp(enemy.x + (i ? 14 : -14), 12, FIELD.w - 12), enemy.y);
  }
}

function leak(state, enemy, events) {
  enemy.dead = true;
  if (state.shield > 0) {
    state.shield--;
    events.push({ type: "shield", x: enemy.x });
    return;
  }
  state.hp -= ENEMIES[enemy.type].leak;
  events.push({ type: "leak", x: enemy.x });
  if (state.hp <= 0) {
    state.hp = 0;
    state.phase = "over";
    events.push({ type: "gameOver" });
  }
}

function stepBoss(state, boss, dt, events) {
  if (boss.y < BOSS.y) {
    boss.y = Math.min(BOSS.y, boss.y + 70 * dt);
    return;
  }
  const fraction = boss.hp / boss.maxHp;
  let phaseIndex = 0;
  BOSS.phases.forEach((p, i) => {
    if (fraction <= p.below) phaseIndex = i;
  });
  if (phaseIndex !== state.bossPhase) {
    state.bossPhase = phaseIndex;
    events.push({ type: "bossPhase", x: boss.x, y: boss.y });
  }
  const phase = BOSS.phases[phaseIndex];

  boss.x += boss.dir * phase.speed * dt;
  const margin = boss.radius + 6;
  if (boss.x < margin || boss.x > FIELD.w - margin) {
    boss.x = clamp(boss.x, margin, FIELD.w - margin);
    boss.dir *= -1;
  }

  boss.shellT -= dt;
  if (boss.shellT <= 0) {
    boss.shellT = phase.shellEvery;
    fireShells(state, boss, phase.shells);
    events.push({ type: "bossFire", x: boss.x, y: boss.y });
  }
  boss.addT -= dt;
  if (boss.addT <= 0) {
    boss.addT = phase.addEvery;
    spawn(state, phase.add);
  }
}

/** Advance the game. `input` is { aim: rad from straight up, firing: boolean }. */
export function update(state, dt, input) {
  const events = [];
  if (state.phase !== "playing") return events;
  state.time += dt;
  state.waveTime += dt;
  state.aim = clamp(input.aim, -PLAYER.aimLimit, PLAYER.aimLimit);

  state.cooldown -= dt;
  if (input.firing && state.cooldown <= 0) {
    state.cooldown = PLAYER.fireInterval * RATE_STEP ** state.levels.rate;
    const count = 1 + state.levels.multi;
    for (let i = 0; i < count; i++) {
      const angle = state.aim + (i - (count - 1) / 2) * PLAYER.spread;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      state.bullets.push({
        x: FIELD.turretX + sin * 28,
        y: FIELD.turretY - cos * 28,
        vx: sin * PLAYER.bulletSpeed,
        vy: -cos * PLAYER.bulletSpeed,
        damage: PLAYER.damage + state.levels.damage,
        pierce: state.levels.pierce,
        hit: [],
      });
    }
    events.push({ type: "shoot" });
  }

  if (state.bossWarn > 0) {
    state.bossWarn -= dt;
    if (state.bossWarn <= 0) spawnBoss(state, events);
  }
  while (state.queue.length && state.queue[0].t <= state.waveTime) {
    spawn(state, state.queue.shift().type);
  }

  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.x < -20 || b.x > FIELD.w + 20) b.dead = true;
  }

  // Index loop: bosses and carriers append new enemies while this runs
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.dead) continue;
    if (e.type === "boss") {
      stepBoss(state, e, dt, events);
      continue;
    }
    e.y += e.vy * dt;
    const def = ENEMIES[e.type];
    if (def.sway) {
      e.x = clamp(e.baseX + Math.sin(e.swayPhase + state.time * def.swayRate) * def.sway, e.radius, FIELD.w - e.radius);
    } else {
      e.x += e.vx * dt;
    }
    if (e.y >= FIELD.baseY) leak(state, e, events);
  }

  for (const b of state.bullets) {
    if (b.dead) continue;
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.dead || b.hit.includes(e.id)) continue;
      const reach = e.radius + 4;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      if (dx * dx + dy * dy > reach * reach) continue;
      b.hit.push(e.id);
      events.push({ type: "hit", x: b.x, y: b.y });
      hurt(state, e, b.damage, events);
      if (b.pierce-- <= 0) {
        b.dead = true;
        break;
      }
    }
  }

  state.bullets = state.bullets.filter((b) => !b.dead);
  state.enemies = state.enemies.filter((e) => !e.dead);

  const waveDone =
    state.phase === "playing" &&
    WAVES[state.wave] !== "boss" &&
    state.queue.length === 0 &&
    state.enemies.length === 0;
  if (waveDone) {
    const open = Object.keys(UPGRADES).filter((k) => state.levels[k] < UPGRADES[k].max);
    state.choices = [];
    while (state.choices.length < 3 && open.length) {
      state.choices.push(open.splice(Math.floor(state.rand() * open.length), 1)[0]);
    }
    state.bullets = [];
    state.phase = "upgrade";
    events.push({ type: "waveClear" });
  }
  return events;
}

/** Take one of `state.choices` and start the next wave. */
export function pickUpgrade(state, key) {
  const events = [];
  if (state.phase !== "upgrade" || !state.choices.includes(key)) return events;
  state.levels[key]++;
  if (key === "shield") state.shield += SHIELD_CHARGES;
  state.wave++;
  state.phase = "playing";
  startWave(state, events);
  return events;
}

/** Spend coins to damage everything on screen. */
export function useBomb(state) {
  const events = [];
  if (state.phase !== "playing" || state.coins < state.bombCost) return events;
  state.coins -= state.bombCost;
  state.bombCost += PLAYER.bombCostStep;
  events.push({ type: "bomb" });
  for (let i = 0, n = state.enemies.length; i < n; i++) {
    const e = state.enemies[i];
    hurt(state, e, e.type === "boss" ? PLAYER.bombBossDamage : PLAYER.bombDamage, events);
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
  return events;
}
