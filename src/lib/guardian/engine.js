// Neon Guardian rules. No DOM in here: the screen draws the state and plays the
// returned events, and the same code can be stepped headless to check balance.
import {
  FIELD,
  PLAYER,
  ENEMIES,
  MODES,
  BOSSES,
  ELITE,
  UPGRADES,
  RARITY,
  GUARD_RATIO,
  RATE_STEP,
  SHIELD_CHARGES,
  BOUNTY_STEP,
  CRYO_SLOW_PCT,
  CRYO_SECONDS,
  BLAST_RADIUS,
  BLAST_RATIO,
  CHAIN_RANGE,
  CHAIN_RATIO,
  CRIT_EVERY,
  CRIT_MULT,
  REROLL_COST,
  REROLL_STEP,
  DRONE_COUNT,
  DRONE_EVERY,
  DRONE_RATIO,
  LASER_EVERY,
  LASER_MULT,
  LASER_WIDTH,
  MISSILE_EVERY,
  MISSILE_MULT,
  MISSILE_RADIUS,
  MISSILE_SPEED,
  VORTEX_EVERY,
  VORTEX_SECONDS,
  VORTEX_RADIUS,
  VORTEX_PULL,
  VORTEX_REACH,
  VORTEX_TICK,
  FAN_EXTRA,
  RAIL_SPEED,
  CLUSTER,
  TEMPEST_JUMPS,
  TEMPEST_RANGE,
  UNLOCK_WAVE,
} from "./config.js";

const DRONE_ORBIT = 34;
const DRONE_TURN = 1.8; // rad per second
const MISSILE_TURN = 7;
const HELD_PACE = 0.15; // how much of its own movement an enemy keeps inside a vortex

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

export function createGame(mode = "normal", seed = Date.now()) {
  const state = {
    rand: mulberry32(seed),
    mode,
    rules: MODES[mode],
    phase: "playing", // playing | upgrade | over | clear
    wave: 0,
    time: 0,
    waveTime: 0,
    hp: PLAYER.hp,
    shield: 0,
    coins: 0,
    bombCost: PLAYER.bombCost,
    rerollCost: REROLL_COST,
    shots: 0,
    levels: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
    aim: 0,
    cooldown: 0,
    bullets: [],
    enemies: [],
    missiles: [],
    vortices: [],
    queue: [],
    choices: [],
    droneAngle: 0,
    droneT: 0,
    droneNext: 0,
    laserT: 0,
    missileT: 0,
    vortexT: 0,
    bossWarn: 0,
    bossPending: false, // a boss wave whose boss has not appeared yet
    richDraft: false, // the next card pick offers no common cards
    nextId: 1,
  };
  startWave(state, []);
  return state;
}

/** Where drone `index` is right now. */
export function dronePosition(state, index) {
  const angle = state.droneAngle + (index * Math.PI * 2) / DRONE_COUNT[state.levels.drones - 1];
  return { x: FIELD.turretX + Math.cos(angle) * DRONE_ORBIT, y: FIELD.turretY - 8 + Math.sin(angle) * DRONE_ORBIT * 0.45 };
}

function hpGrowth(state) {
  const g = state.rules.hpGrowth;
  return g.base + g.linear * state.wave + g.square * state.wave ** 2 + g.cubic * state.wave ** 3;
}

const bulletDamage = (state) => PLAYER.damage + state.levels.damage;

function startWave(state, events) {
  state.waveTime = 0;
  const wave = state.rules.waves[state.wave];
  if (typeof wave === "string") {
    state.bossWarn = BOSSES[wave].warn;
    state.bossPending = true;
    events.push({ type: "bossWarn" });
    return;
  }
  state.queue = wave
    .flatMap(([type, count, gap, delay, elite]) =>
      Array.from({ length: count }, (_, i) => ({ t: (delay + i * gap) * state.rules.pace, type, elite })),
    )
    .sort((a, b) => a.t - b.t);
}

function spawn(state, type, x, y, elite = false) {
  const def = ENEMIES[type];
  const radius = def.radius * (elite ? ELITE.size : 1);
  const margin = radius + 8;
  const enemy = {
    id: state.nextId++,
    type,
    elite,
    x: x ?? margin + state.rand() * (FIELD.w - margin * 2),
    y: y ?? -radius,
    vx: 0,
    vy: def.speed * (1 + state.rules.speedGrowth * state.wave) * (elite ? ELITE.speed : 1),
    hp: Math.max(1, Math.round(def.hp * hpGrowth(state) * (elite ? ELITE.hp : 1))),
    radius,
    leak: def.leak + (elite && def.leak ? ELITE.leak : 0),
    coins: def.coins * (elite ? ELITE.coins : 1),
    swayPhase: state.rand() * Math.PI * 2,
  };
  if (def.holdY) {
    enemy.holdY = def.holdY[0] + state.rand() * (def.holdY[1] - def.holdY[0]);
    enemy.shellT = def.shellEvery * 0.5;
  }
  if (def.blinkEvery) enemy.blinkT = def.blinkEvery * (0.5 + state.rand());
  enemy.maxHp = enemy.hp;
  enemy.baseX = enemy.x;
  state.enemies.push(enemy);
  return enemy;
}

function spawnBoss(state, events) {
  const type = state.rules.waves[state.wave];
  const def = BOSSES[type];
  const hp = Math.round(def.hp * state.rules.bossHp);
  state.enemies.push({
    id: state.nextId++,
    type,
    x: FIELD.w / 2,
    y: -def.radius,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    radius: def.radius,
    dir: 1,
    phase: -1,
    shellT: 2,
    addT: 3,
    chargeT: 0,
    charging: 0,
    chargeTaken: 0,
    stun: 0,
  });
  state.bossPending = false;
  events.push({ type: "bossArrive" });
}

// A shell flying from (x, y) at a random spot of the base
function fireShell(state, x, y) {
  const shell = spawn(state, "shell", x, y);
  const dx = 30 + state.rand() * (FIELD.w - 60) - shell.x;
  const dy = FIELD.baseY - shell.y;
  const len = Math.hypot(dx, dy);
  shell.vx = (dx / len) * ENEMIES.shell.speed;
  shell.vy = (dy / len) * ENEMIES.shell.speed;
}

function raiseGenerators(state, boss, count) {
  for (let i = 0; i < count; i++) {
    const generator = spawn(state, "generator", boss.x, boss.y);
    generator.hp = generator.maxHp = BOSSES[boss.type].generatorHp;
    generator.slot = (i * Math.PI * 2) / count;
  }
  boss.shielded = true;
}

function damageBase(state, amount, x, events) {
  if (state.shield > 0) {
    state.shield--;
    events.push({ type: "shield", x });
    return;
  }
  state.hp -= amount;
  events.push({ type: "leak", x });
  if (state.hp <= 0) {
    state.hp = 0;
    state.phase = "over";
    events.push({ type: "gameOver" });
  }
}

function hurt(state, enemy, amount, events) {
  if (enemy.dead) return;
  if (enemy.shielded) {
    events.push({ type: "deflect", x: enemy.x, y: enemy.y });
    return;
  }
  if (enemy.guarded) amount *= GUARD_RATIO;
  const charge = BOSSES[enemy.type]?.charge;
  if (charge && enemy.stun > 0) {
    amount *= charge.stunDamage;
  } else if (charge && enemy.charging > 0) {
    enemy.chargeTaken += amount;
    if (enemy.chargeTaken >= enemy.maxHp * charge.need) {
      enemy.charging = 0;
      enemy.stun = charge.stun;
      events.push({ type: "chargeBreak", x: enemy.x, y: enemy.y });
    }
  }
  enemy.hp -= amount;
  if (enemy.hp > 0) return;
  enemy.dead = true;
  events.push({ type: "kill", kind: enemy.type, x: enemy.x, y: enemy.y });

  if (BOSSES[enemy.type]) {
    // Its escorts and shells go down with it
    state.enemies.forEach((e) => (e.dead = true));
    events.push({ type: "bossDead", x: enemy.x, y: enemy.y });
    if (state.wave === state.rules.waves.length - 1) {
      state.phase = "clear";
      events.push({ type: "clear" });
      return;
    }
    state.richDraft = true;
    if (state.rules.repair && state.hp < PLAYER.hp) {
      state.hp = Math.min(PLAYER.hp, state.hp + state.rules.repair);
      events.push({ type: "repair" });
    }
    return;
  }

  const def = ENEMIES[enemy.type];
  if (enemy.coins) {
    state.coins += enemy.coins * (1 + BOUNTY_STEP * state.levels.bounty);
    events.push({ type: "coin", x: enemy.x, y: enemy.y });
  }
  for (let i = 0; i < (def.split ?? 0); i++) {
    spawn(state, "mini", clamp(enemy.x + (i ? 14 : -14), 12, FIELD.w - 12), enemy.y);
  }
  if (def.boom) {
    events.push({ type: "boom", x: enemy.x, y: enemy.y, radius: def.boom });
    splash(state, enemy.x, enemy.y, def.boom, enemy.maxHp * def.boomRatio, enemy, events);
  }
}

// Damage to everything within `radius` of a point, except `skip`
function splash(state, x, y, radius, amount, skip, events) {
  for (let i = 0, n = state.enemies.length; i < n; i++) {
    const other = state.enemies[i];
    if (other === skip || other.dead) continue;
    if (Math.hypot(other.x - x, other.y - y) <= radius + other.radius) hurt(state, other, amount, events);
  }
}

// A bullet landing on `enemy`: its own damage plus whatever the bullet upgrades add
function strike(state, enemy, bullet, events) {
  const { cryo, blast, cluster, chain, tempest } = state.levels;
  if (cryo && !BOSSES[enemy.type]) {
    enemy.slowUntil = state.time + CRYO_SECONDS;
    enemy.slow = 1 - CRYO_SLOW_PCT[cryo - 1] / 100;
  }
  hurt(state, enemy, bullet.damage, events);

  if (blast) {
    const radius = BLAST_RADIUS[blast - 1];
    const amount = Math.ceil(bullet.damage * BLAST_RATIO);
    events.push({ type: "blast", x: bullet.x, y: bullet.y, radius });
    splash(state, bullet.x, bullet.y, radius, amount, enemy, events);
    const turn = state.rand() * Math.PI * 2;
    for (let i = 0; i < CLUSTER.count * cluster; i++) {
      const angle = turn + (i * Math.PI * 2) / CLUSTER.count;
      const x = bullet.x + Math.cos(angle) * radius * CLUSTER.offset;
      const y = bullet.y + Math.sin(angle) * radius * CLUSTER.offset;
      events.push({ type: "blast", x, y, radius: radius * CLUSTER.radius });
      splash(state, x, y, radius * CLUSTER.radius, amount, null, events);
    }
  }

  let from = enemy;
  const struck = [enemy.id];
  const range = CHAIN_RANGE * (tempest ? TEMPEST_RANGE : 1);
  for (let jump = 0; jump < chain + TEMPEST_JUMPS * tempest; jump++) {
    let next = null;
    let nearest = range;
    for (const other of state.enemies) {
      if (other.dead || struck.includes(other.id)) continue;
      const distance = Math.hypot(other.x - from.x, other.y - from.y) - other.radius;
      if (distance < nearest) {
        nearest = distance;
        next = other;
      }
    }
    if (!next) break;
    struck.push(next.id);
    events.push({ type: "chain", x: from.x, y: from.y, x2: next.x, y2: next.y });
    hurt(state, next, Math.ceil(bullet.damage * CHAIN_RATIO), events);
    from = next;
  }
}

// Three different cards, rarer ones offered less often
function rollChoices(state) {
  const isLate = state.wave + 1 >= UNLOCK_WAVE;
  let pool = Object.keys(UPGRADES).filter((k) => {
    const card = UPGRADES[k];
    if (state.levels[k] >= card.max) return false;
    if (RARITY[card.rarity].late && !isLate) return false;
    return !card.needs || state.levels[card.needs] >= UPGRADES[card.needs].max;
  });
  if (state.richDraft) {
    const better = pool.filter((k) => UPGRADES[k].rarity !== "common");
    if (better.length >= 3) pool = better;
  }
  const weight = (k) => RARITY[UPGRADES[k].rarity].weight;
  state.choices = [];
  while (state.choices.length < 3 && pool.length) {
    let roll = state.rand() * pool.reduce((sum, k) => sum + weight(k), 0);
    let index = pool.findIndex((k) => (roll -= weight(k)) < 0);
    if (index === -1) index = pool.length - 1;
    state.choices.push(pool.splice(index, 1)[0]);
  }
}

function stepBoss(state, boss, dt, events) {
  const def = BOSSES[boss.type];
  if (boss.y < def.y) {
    boss.y = Math.min(def.y, boss.y + 70 * dt);
    return;
  }
  const fraction = boss.hp / boss.maxHp;
  let phaseIndex = 0;
  def.phases.forEach((p, i) => {
    if (fraction <= p.below) phaseIndex = i;
  });
  const phase = def.phases[phaseIndex];
  if (phaseIndex !== boss.phase) {
    if (boss.phase >= 0) events.push({ type: "bossPhase", x: boss.x, y: boss.y });
    boss.phase = phaseIndex;
    if (phase.generators) {
      raiseGenerators(state, boss, phase.generators);
      events.push({ type: "generators", x: boss.x, y: boss.y });
    }
    boss.chargeT = (phase.chargeEvery ?? 0) * 0.6;
  }

  if (boss.stun > 0) {
    boss.stun -= dt;
    return;
  }
  if (boss.charging > 0) {
    boss.charging -= dt;
    if (boss.charging <= 0) {
      events.push({ type: "chargeFire", x: boss.x, y: boss.y });
      damageBase(state, def.charge.damage, boss.x, events);
    }
    return;
  }
  // No charging behind the generators: the charge could not be broken
  if (phase.chargeEvery && !boss.shielded) {
    boss.chargeT -= dt;
    if (boss.chargeT <= 0) {
      boss.chargeT = phase.chargeEvery;
      boss.charging = def.charge.seconds;
      boss.chargeTaken = 0;
      events.push({ type: "chargeStart", x: boss.x, y: boss.y });
      return;
    }
  }

  boss.x += boss.dir * phase.speed * dt;
  const margin = boss.radius + 6;
  if (boss.x < margin || boss.x > FIELD.w - margin) {
    boss.x = clamp(boss.x, margin, FIELD.w - margin);
    boss.dir *= -1;
  }

  boss.shellT -= dt;
  if (boss.shellT <= 0) {
    boss.shellT = phase.shellEvery;
    for (let i = 0; i < phase.shells; i++) {
      fireShell(state, boss.x + (i - (phase.shells - 1) / 2) * 34, boss.y + boss.radius * 0.6);
    }
    events.push({ type: "bossFire", x: boss.x, y: boss.y });
  }
  boss.addT -= dt;
  if (boss.addT <= 0) {
    boss.addT = phase.addEvery;
    spawn(state, phase.add[Math.floor(state.rand() * phase.add.length)]);
  }
}

// The enemy the automatic weapons go for: the one nearest the base, bosses last
function pickTarget(state) {
  let target = null;
  let best = -Infinity;
  for (const e of state.enemies) {
    if (e.dead || e.shielded || e.y < 0) continue;
    const score = BOSSES[e.type] ? -1000 : e.y;
    if (score > best) {
      best = score;
      target = e;
    }
  }
  return target;
}

function shoot(state, x, y, angle, speed, extra) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  state.bullets.push({ x, y, vx: sin * speed, vy: -cos * speed, damage: 0, pierce: 0, hit: [], ...extra });
}

function openVortex(state, bullet, events) {
  bullet.dead = true;
  state.vortices.push({ x: bullet.x, y: bullet.y, until: state.time + VORTEX_SECONDS, tick: 0 });
  events.push({ type: "vortex", x: bullet.x, y: bullet.y });
}

function fireWeapons(state, dt, input, events) {
  const { levels } = state;
  const damage = bulletDamage(state);

  state.cooldown -= dt;
  if (input.firing && state.cooldown <= 0) {
    state.cooldown = PLAYER.fireInterval * RATE_STEP ** levels.rate;
    const count = 1 + levels.multi + FAN_EXTRA * levels.fan;
    state.shots++;
    const isCrit = levels.crit > 0 && state.shots % CRIT_EVERY[levels.crit - 1] === 0;
    for (let i = 0; i < count; i++) {
      const angle = state.aim + (i - (count - 1) / 2) * PLAYER.spread;
      shoot(state, FIELD.turretX + Math.sin(angle) * 28, FIELD.turretY - Math.cos(angle) * 28, angle, PLAYER.bulletSpeed * (levels.rail ? RAIL_SPEED : 1), {
        damage: damage * (isCrit ? CRIT_MULT : 1),
        pierce: levels.rail ? Infinity : levels.pierce,
        crit: isCrit,
      });
    }
    events.push({ type: isCrit ? "critShot" : "shoot" });
  }

  const hasEnemies = state.enemies.length > 0;

  if (levels.laser) {
    state.laserT -= dt;
    if (state.laserT <= 0 && input.firing && hasEnemies) {
      state.laserT = LASER_EVERY[levels.laser - 1];
      const sin = Math.sin(state.aim);
      const cos = Math.cos(state.aim);
      for (let i = 0, n = state.enemies.length; i < n; i++) {
        const e = state.enemies[i];
        const rx = e.x - FIELD.turretX;
        const ry = e.y - FIELD.turretY;
        if (rx * sin - ry * cos > 0 && Math.abs(rx * cos + ry * sin) <= e.radius + LASER_WIDTH) {
          hurt(state, e, damage * LASER_MULT[levels.laser - 1], events);
        }
      }
      events.push({ type: "laser", angle: state.aim });
    }
  }

  if (levels.vortex) {
    state.vortexT -= dt;
    if (state.vortexT <= 0 && input.firing && hasEnemies) {
      state.vortexT = VORTEX_EVERY[levels.vortex - 1];
      shoot(state, FIELD.turretX, FIELD.turretY - 28, state.aim, PLAYER.bulletSpeed * 0.6, { vortex: true, reach: VORTEX_REACH });
      events.push({ type: "vortexShot" });
    }
  }

  if (!levels.drones && !levels.missile) return;
  const target = pickTarget(state);

  if (levels.drones) {
    state.droneAngle += DRONE_TURN * dt;
    state.droneT -= dt;
    if (state.droneT <= 0 && target) {
      const count = DRONE_COUNT[levels.drones - 1];
      state.droneT = DRONE_EVERY / count;
      const from = dronePosition(state, state.droneNext++ % count);
      // Lead the target by its straight-line velocity
      const t = Math.hypot(target.x - from.x, target.y - from.y) / PLAYER.bulletSpeed;
      const angle = Math.atan2(target.x + target.vx * t - from.x, from.y - (target.y + target.vy * t));
      shoot(state, from.x, from.y, angle, PLAYER.bulletSpeed, { damage: Math.ceil(damage * DRONE_RATIO), drone: true });
      events.push({ type: "droneShot" });
    }
  }

  if (levels.missile) {
    state.missileT -= dt;
    if (state.missileT <= 0 && target) {
      state.missileT = MISSILE_EVERY[levels.missile - 1];
      state.missiles.push({ x: FIELD.turretX, y: FIELD.turretY - 20, angle: state.aim, target: target.id, life: 5 });
      events.push({ type: "missile" });
    }
  }
  for (const m of state.missiles) {
    let goal = state.enemies.find((e) => e.id === m.target && !e.dead);
    if (!goal && target) {
      goal = target;
      m.target = target.id;
    }
    if (goal) {
      let turn = Math.atan2(goal.x - m.x, m.y - goal.y) - m.angle;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      m.angle += clamp(turn, -MISSILE_TURN * dt, MISSILE_TURN * dt);
    }
    m.x += Math.sin(m.angle) * MISSILE_SPEED * dt;
    m.y -= Math.cos(m.angle) * MISSILE_SPEED * dt;
    m.life -= dt;
    if (goal && Math.hypot(goal.x - m.x, goal.y - m.y) <= goal.radius + 8) {
      m.life = 0;
      events.push({ type: "missileHit", x: m.x, y: m.y, radius: MISSILE_RADIUS });
      hurt(state, goal, damage * MISSILE_MULT, events);
      splash(state, m.x, m.y, MISSILE_RADIUS, (damage * MISSILE_MULT) / 2, goal, events);
    }
  }
  state.missiles = state.missiles.filter((m) => m.life > 0 && m.y > -40);
}

/** Advance the game. `input` is { aim: rad from straight up, firing: boolean }. */
export function update(state, dt, input) {
  const events = [];
  if (state.phase !== "playing") return events;
  state.time += dt;
  state.waveTime += dt;
  state.aim = clamp(input.aim, -PLAYER.aimLimit, PLAYER.aimLimit);

  if (state.bossWarn > 0) {
    state.bossWarn -= dt;
    if (state.bossWarn <= 0) spawnBoss(state, events);
  }
  while (state.queue.length && state.queue[0].t <= state.waveTime) {
    const next = state.queue.shift();
    spawn(state, next.type, undefined, undefined, next.elite);
  }

  // Who is covered by a shielder, and whether the boss still has a generator up
  const shielders = state.enemies.filter((e) => ENEMIES[e.type]?.aura);
  const boss = state.enemies.find((e) => BOSSES[e.type]);
  if (boss) boss.shielded = state.enemies.some((e) => e.type === "generator");
  for (const e of state.enemies) {
    e.held = false;
    e.guarded =
      shielders.length > 0 &&
      !BOSSES[e.type] &&
      !ENEMIES[e.type].aura &&
      e.type !== "generator" &&
      shielders.some((s) => Math.hypot(s.x - e.x, s.y - e.y) <= ENEMIES[s.type].aura + e.radius);
  }

  fireWeapons(state, dt, input, events);

  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.x < -20 || b.x > FIELD.w + 20) b.dead = true;
    else if (b.vortex && (b.reach -= PLAYER.bulletSpeed * 0.6 * dt) <= 0) openVortex(state, b, events);
  }

  for (const v of state.vortices) {
    v.tick -= dt;
    const isTick = v.tick <= 0;
    if (isTick) v.tick = VORTEX_TICK[0];
    for (let i = 0, n = state.enemies.length; i < n; i++) {
      const e = state.enemies[i];
      if (e.dead || BOSSES[e.type] || e.type === "generator") continue;
      const dx = v.x - e.x;
      const dy = v.y - e.y;
      const distance = Math.hypot(dx, dy);
      if (distance > VORTEX_RADIUS + e.radius) continue;
      e.held = true;
      const step = Math.min(distance, VORTEX_PULL * dt) / (distance || 1);
      e.x += dx * step;
      e.y += dy * step;
      if (isTick) hurt(state, e, bulletDamage(state) * VORTEX_TICK[1], events);
    }
  }
  state.vortices = state.vortices.filter((v) => v.until > state.time);

  // Index loop: bosses and carriers append new enemies while this runs
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.dead) continue;
    if (BOSSES[e.type]) {
      stepBoss(state, e, dt, events);
      continue;
    }
    const def = ENEMIES[e.type];
    if (def.orbitX) {
      const angle = e.slot + state.time * def.turn;
      e.x = clamp(boss.x + Math.cos(angle) * def.orbitX, e.radius, FIELD.w - e.radius);
      e.y = boss.y + 26 + Math.sin(angle) * def.orbitY;
      continue;
    }
    const pace = (e.slowUntil > state.time ? e.slow : 1) * (e.held ? HELD_PACE : 1);
    if (def.holdY && e.y >= e.holdY) {
      e.shellT -= dt * pace;
      if (e.shellT <= 0) {
        e.shellT = def.shellEvery;
        fireShell(state, e.x, e.y + e.radius * 0.6);
        events.push({ type: "shellFire", x: e.x, y: e.y });
      }
      continue;
    }
    e.y += e.vy * dt * pace;
    if (def.sway) {
      const offset = Math.sin(e.swayPhase + state.time * def.swayRate) * def.sway;
      // Dragged by a vortex, it carries on swaying from wherever it was left
      if (e.held) e.baseX = e.x - offset;
      else e.x = clamp(e.baseX + offset, e.radius, FIELD.w - e.radius);
    } else {
      e.x += e.vx * dt * pace;
    }
    if (def.blinkEvery && !e.held && (e.blinkT -= dt * pace) <= 0) {
      e.blinkT = def.blinkEvery;
      const jump = (def.blink[0] + state.rand() * (def.blink[1] - def.blink[0])) * (state.rand() < 0.5 ? -1 : 1);
      // Bounce off the wall rather than blink on the spot
      const side = e.x + jump < e.radius || e.x + jump > FIELD.w - e.radius ? -jump : jump;
      const x = clamp(e.x + side, e.radius, FIELD.w - e.radius);
      events.push({ type: "blink", x: e.x, y: e.y, x2: x, y2: e.y });
      e.x = x;
    }
    if (e.y >= FIELD.baseY) {
      e.dead = true;
      damageBase(state, e.leak, e.x, events);
    }
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
      if (b.vortex) {
        openVortex(state, b, events);
        break;
      }
      b.hit.push(e.id);
      events.push({ type: "hit", x: b.x, y: b.y });
      strike(state, e, b, events);
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
    !state.bossPending &&
    state.queue.length === 0 &&
    state.enemies.length === 0;
  if (waveDone) {
    rollChoices(state);
    state.bullets = [];
    state.missiles = [];
    state.vortices = [];
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
  state.richDraft = false;
  state.wave++;
  state.phase = "playing";
  startWave(state, events);
  return events;
}

/** Spend coins to deal a fresh set of cards. Returns whether it happened. */
export function reroll(state) {
  if (state.phase !== "upgrade" || state.coins < state.rerollCost) return false;
  state.coins -= state.rerollCost;
  state.rerollCost += REROLL_STEP;
  rollChoices(state);
  return true;
}

/** Spend coins to damage everything on screen. */
export function useBomb(state) {
  const events = [];
  if (state.phase !== "playing" || state.coins < state.bombCost) return events;
  state.coins -= state.bombCost;
  state.bombCost += PLAYER.bombCostStep;
  events.push({ type: "bomb" });
  const scale = state.rules.bombScales ? hpGrowth(state) : 1;
  for (let i = 0, n = state.enemies.length; i < n; i++) {
    const e = state.enemies[i];
    hurt(state, e, (BOSSES[e.type] ? PLAYER.bombBossDamage : PLAYER.bombDamage) * scale, events);
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
  return events;
}
