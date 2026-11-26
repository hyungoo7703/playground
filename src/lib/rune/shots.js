// How each unit's attack looks. By the time a shot is drawn the game has already counted the hit:
// nothing here changes a run, it only shows it.
const TAU = Math.PI * 2;

// kind: [how fast it flies in field px a second (0: it is there at once), seconds it stays after landing]
const KINDS = {
  slash: [0, 0.2],
  thrust: [0, 0.22],
  arrow: [1000, 0.12],
  tracer: [0, 0.24],
  orb: [620, 0.28],
  shard: [700, 0.32],
  bolt: [0, 0.16],
  lob: [480, 0.32],
  breath: [0, 0.38],
  meteor: [820, 0.45],
  pillar: [0, 0.32],
  thorn: [0, 0.38],
  rift: [0, 0.4],
};

// unit: [kind, colour, how big next to the plainest of its kind]
const SHOTS = {
  swordsman: ["slash", "#fff1c9"],
  rogue: ["slash", "#d9c8ff", 0.8],
  knight: ["slash", "#dbe9ff", 1.3],
  paladin: ["slash", "#ffe27a", 1.45],
  valkyrie: ["thrust", "#bfe9ff"],
  dragonknight: ["thrust", "#ff7a3d", 1.9],
  archer: ["arrow", "#e9dcae"],
  ranger: ["arrow", "#b9f08a"],
  sniper: ["tracer", "#9fe8ff"],
  apprentice: ["orb", "#c3b0ff"],
  pyromancer: ["orb", "#ff9a3d", 1.2],
  cryomancer: ["shard", "#8fe3ff"],
  stormcaller: ["bolt", "#fff36b"],
  druid: ["lob", "#8dff8a"],
  alchemist: ["lob", "#d6ff5a", 1.2],
  archmage: ["meteor", "#ff8a66"],
  elderdragon: ["breath", "#ff6a2a"],
  chronomancer: ["rift", "#9fe8ff"],
  seraph: ["pillar", "#ffe9a0"],
  worldtree: ["thorn", "#7dff9a"],
};

const ease = (p) => 1 - (1 - p) * (1 - p);

/** The shot for an attack the game reported, from the slot centre `from`. */
export function makeShot(e, from) {
  const [kind, color, size = 1] = SHOTS[e.key];
  const [speed, after] = KINDS[kind];
  // A meteor comes out of the sky, not out of the mage
  const start = kind === "meteor" ? { x: e.x + 60, y: e.y - 170 } : { x: from.x, y: from.y - 6 };
  const fly = speed ? Math.hypot(e.x - start.x, e.y - start.y) / speed : 0;
  return {
    type: "shot",
    kind,
    color,
    size: size * (e.crit ? 1.6 : 1),
    x: start.x,
    y: start.y,
    x2: e.x,
    y2: e.y,
    splash: e.splash,
    crit: e.crit,
    fly,
    seconds: fly + after,
    seed: Math.random(),
  };
}

function disc(ctx, x, y, r, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function ring(ctx, x, y, r, color, alpha, width = 2) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

function glow(ctx, x, y, r, color, alpha = 1) {
  disc(ctx, x, y, r * 2.2, color, alpha * 0.25);
  disc(ctx, x, y, r, color, alpha);
  disc(ctx, x, y, r * 0.5, "#ffffff", alpha);
}

// Rays around a point, from `inner` of the way out to `r`
function rays(ctx, x, y, r, color, alpha, count, turn, inner = 0.3) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = turn + (i * TAU) / count;
    ctx.moveTo(x + Math.cos(a) * r * inner, y + Math.sin(a) * r * inner);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
}

function polygon(ctx, points, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.fill();
}

// A blade's sweep: the outside of a circle between two angles, thinning to nothing at both ends
function crescent(ctx, x, y, r, lo, hi, thick, color, alpha) {
  const mid = (lo + hi) / 2;
  const half = (hi - lo) / 2;
  const inner = 2 * (r - thick * Math.sin(Math.min(half, Math.PI / 2))) - r * Math.cos(half);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, lo, hi);
  ctx.quadraticCurveTo(x + Math.cos(mid) * inner, y + Math.sin(mid) * inner, x + Math.cos(lo) * r, y + Math.sin(lo) * r);
  ctx.fill();
}

// What is left behind something flying along `angle`
function tail(ctx, x, y, angle, length, width, color, alpha) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  polygon(ctx, [x - uy * width, y + ux * width, x + uy * width, y - ux * width, x - ux * length, y - uy * length], color, alpha);
}

// What a shot leaves where it lands: wide when it hurts everything around it
function blast(ctx, fx, p) {
  const reach = fx.splash ?? 10 * fx.size;
  const r = reach * (0.35 + 0.65 * ease(p));
  if (fx.splash) disc(ctx, fx.x2, fx.y2, r, fx.color, (1 - p) * 0.32);
  ring(ctx, fx.x2, fx.y2, r, fx.color, 1 - p, fx.splash ? 2.5 : 1.5);
  // The flash at the middle stays small however wide the blast: a big one whites out the road
  if (p < 0.35) disc(ctx, fx.x2, fx.y2, Math.min(15, reach * 0.45) * (1 - p / 0.35), "#ffffff", 0.8 * (1 - p / 0.35));
}

/** A jagged line of lightning, different every time it is drawn. */
export function drawBolt(ctx, x, y, x2, y2, color, alpha) {
  const dx = x2 - x;
  const dy = y2 - y;
  const length = Math.hypot(dx, dy) || 1;
  const steps = Math.max(2, Math.round(length / 20));
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 1; i < steps; i++) {
    const off = (Math.random() - 0.5) * 16;
    ctx.lineTo(x + (dx * i) / steps - (dy / length) * off, y + (dy * i) / steps + (dx / length) * off);
  }
  ctx.lineTo(x2, y2);
  ctx.globalAlpha = alpha * 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

// Each takes the shot, how far it has flown (0 to 1), how long ago it landed (0 to 1 of its stay),
// and the angle it travels at
const DRAW = {
  slash(ctx, fx, flown, p, angle) {
    const r = 20 * fx.size;
    const turn = fx.seed < 0.5 ? 1 : -1;
    const x = fx.x2 - Math.cos(angle) * r * 0.55;
    const y = fx.y2 - Math.sin(angle) * r * 0.55;
    // The edge sweeps across first, and the far end of the arc follows it out
    const front = angle + turn * 1.15 * (2 * Math.min(1, p / 0.35) - 1);
    const back = angle + turn * 1.15 * (1.4 * Math.max(0, (p - 0.35) / 0.65) - 1);
    const lo = Math.min(front, back);
    const hi = Math.max(front, back);
    crescent(ctx, x, y, r, lo, hi, r * 0.36, fx.color, 1 - p * p);
    crescent(ctx, x, y, r, lo, hi, r * 0.14, "#ffffff", 1 - p * p);
    if (fx.crit) rays(ctx, fx.x2, fx.y2, 22, "#ffffff", 1 - p, 4, fx.seed * TAU);
  },

  thrust(ctx, fx, flown, p, angle) {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const length = Math.hypot(fx.x2 - fx.x, fx.y2 - fx.y);
    const tip = 8 + length * Math.min(1, p / 0.25);
    const end = 12 + length * 0.6 * Math.max(0, (p - 0.25) / 0.75);
    const wide = end + (tip - end) * 0.75;
    for (const [half, color, alpha] of [[3.4 * fx.size * (1 - p * 0.6), fx.color, 0.8], [1.3 * fx.size * (1 - p * 0.6), "#ffffff", 1]]) {
      polygon(
        ctx,
        [fx.x + ux * end, fx.y + uy * end, fx.x + ux * wide - uy * half, fx.y + uy * wide + ux * half, fx.x + ux * tip, fx.y + uy * tip, fx.x + ux * wide + uy * half, fx.y + uy * wide - ux * half],
        color,
        alpha * (1 - p),
      );
    }
    if (p > 0.2) blast(ctx, fx, (p - 0.2) / 0.8);
  },

  arrow(ctx, fx, flown, p, angle) {
    if (flown === 1) return rays(ctx, fx.x2, fx.y2, 4 + 7 * ease(p), fx.color, 1 - p, 4, fx.seed * TAU);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const x = fx.x + (fx.x2 - fx.x) * flown;
    const y = fx.y + (fx.y2 - fx.y) * flown;
    tail(ctx, x, y, angle, 26, 1.4, fx.color, 0.35);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - ux * 11, y - uy * 11);
    ctx.lineTo(x, y);
    ctx.stroke();
    polygon(ctx, [x + ux * 3.5, y + uy * 3.5, x - ux * 3 - uy * 2.6, y - uy * 3 + ux * 2.6, x - ux * 3 + uy * 2.6, y - uy * 3 - ux * 2.6], "#ffffff", 1);
  },

  tracer(ctx, fx, flown, p, angle) {
    // The far end is there at once; the near end catches up with it
    const x = fx.x + (fx.x2 - fx.x) * p * 0.9;
    const y = fx.y + (fx.y2 - fx.y) * p * 0.9;
    const length = Math.hypot(fx.x2 - x, fx.y2 - y);
    tail(ctx, fx.x2, fx.y2, angle, length, 5 * (1 - p), fx.color, (1 - p) * 0.55);
    tail(ctx, fx.x2, fx.y2, angle, length, 1.8 * (1 - p), "#ffffff", 1 - p);
    rays(ctx, fx.x2, fx.y2, 17 * (1 - p * 0.5), "#ffffff", 1 - p, 4, 0, 0.15);
    ring(ctx, fx.x2, fx.y2, 5 + 14 * ease(p), fx.color, 1 - p);
  },

  orb(ctx, fx, flown, p, angle) {
    if (flown === 1) return blast(ctx, fx, p);
    const x = fx.x + (fx.x2 - fx.x) * flown;
    const y = fx.y + (fx.y2 - fx.y) * flown;
    const r = 4 * fx.size;
    tail(ctx, x, y, angle, Math.min(30, Math.hypot(x - fx.x, y - fx.y)), r * 0.9, fx.color, 0.45);
    glow(ctx, x, y, r, fx.color);
  },

  shard(ctx, fx, flown, p, angle) {
    if (flown < 1) {
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const x = fx.x + (fx.x2 - fx.x) * flown;
      const y = fx.y + (fx.y2 - fx.y) * flown;
      tail(ctx, x, y, angle, 24, 2.4, fx.color, 0.35);
      polygon(ctx, [x + ux * 8, y + uy * 8, x - uy * 3.4, y + ux * 3.4, x - ux * 7, y - uy * 7, x + uy * 3.4, y - ux * 3.4], fx.color, 1);
      polygon(ctx, [x + ux * 8, y + uy * 8, x - uy * 1.2, y + ux * 1.2, x - ux * 7, y - uy * 7, x + uy * 1.2, y - ux * 1.2], "#ffffff", 0.9);
      return;
    }
    // Frost: a snowflake opening out over the ground it chills
    const r = (fx.splash ?? 12) * (0.4 + 0.6 * ease(p));
    disc(ctx, fx.x2, fx.y2, r, fx.color, (1 - p) * 0.22);
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = fx.seed * TAU + (i * TAU) / 6;
      const bx = fx.x2 + Math.cos(a) * r * 0.6;
      const by = fx.y2 + Math.sin(a) * r * 0.6;
      ctx.moveTo(fx.x2, fx.y2);
      ctx.lineTo(fx.x2 + Math.cos(a) * r, fx.y2 + Math.sin(a) * r);
      for (const lean of [-0.7, 0.7]) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + lean) * r * 0.26, by + Math.sin(a + lean) * r * 0.26);
      }
    }
    ctx.stroke();
  },

  bolt(ctx, fx, flown, p) {
    drawBolt(ctx, fx.x, fx.y, fx.x2, fx.y2, fx.color, 1 - p);
    glow(ctx, fx.x2, fx.y2, 3.5, fx.color, 1 - p);
  },

  lob(ctx, fx, flown, p) {
    if (flown < 1) {
      const x = fx.x + (fx.x2 - fx.x) * flown;
      const y = fx.y + (fx.y2 - fx.y) * flown - 96 * flown * (1 - flown);
      return glow(ctx, x, y, 3.6 * fx.size, fx.color);
    }
    blast(ctx, fx, p);
    const reach = fx.splash ?? 12;
    for (let i = -1; i <= 1; i++) ring(ctx, fx.x2 + i * reach * 0.4, fx.y2 - p * 16 - Math.abs(i) * 4, 2.4, fx.color, 1 - p, 1);
  },

  breath(ctx, fx, flown, p, angle) {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const length = Math.hypot(fx.x2 - fx.x, fx.y2 - fx.y);
    const front = Math.min(1, p / 0.3);
    for (let i = 1; i <= 8; i++) {
      const along = i / 8;
      if (along > front) break;
      const sway = Math.sin(fx.seed * 40 + i * 2.1 + p * 14) * 5 * along;
      const x = fx.x + ux * length * along - uy * sway;
      const y = fx.y + uy * length * along + ux * sway;
      const r = (2.5 + along * (fx.splash ?? 30) * 0.3) * (1 - p * 0.35);
      disc(ctx, x, y, r, i % 2 ? fx.color : "#ffc45a", (1 - p) * 0.42);
      disc(ctx, x, y, r * 0.45, "#fff4c9", (1 - p) * 0.5);
    }
    if (p > 0.2) blast(ctx, fx, (p - 0.2) / 0.8);
  },

  meteor(ctx, fx, flown, p, angle) {
    if (flown < 1) {
      const x = fx.x + (fx.x2 - fx.x) * flown;
      const y = fx.y + (fx.y2 - fx.y) * flown;
      // Where it is about to come down
      ring(ctx, fx.x2, fx.y2, fx.splash * (0.9 - 0.4 * flown), fx.color, 0.6 * flown, 1.5);
      tail(ctx, x, y, angle, 54, 6, fx.color, 0.5);
      tail(ctx, x, y, angle, 30, 3, "#ffe9b8", 0.8);
      return glow(ctx, x, y, 7, fx.color);
    }
    blast(ctx, fx, p);
    ring(ctx, fx.x2, fx.y2, fx.splash * 0.6 * ease(p), "#ffffff", (1 - p) * 0.8);
    rays(ctx, fx.x2, fx.y2, fx.splash * (0.5 + 0.6 * ease(p)), fx.color, 1 - p, 8, fx.seed * TAU, 0.55);
  },

  pillar(ctx, fx, flown, p) {
    const half = 7 * fx.size * (1 - p);
    ctx.globalAlpha = (1 - p) * 0.45;
    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.x2 - half, fx.y2 - 180, half * 2, 180);
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(fx.x2 - half * 0.35, fx.y2 - 180, half * 0.7, 180);
    const r = 8 + 16 * ease(p);
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(fx.x2, fx.y2 + 4, r, r * 0.45, 0, 0, TAU);
    ctx.stroke();
  },

  thorn(ctx, fx, flown, p) {
    const rise = ease(Math.min(1, p / 0.25));
    const alpha = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
    const ground = fx.y2 + 8;
    for (let i = -1; i <= 1; i++) {
      const lean = i * 0.42 + (fx.seed - 0.5) * 0.3;
      const height = (i ? 16 : 25) * rise;
      const x = fx.x2 + i * 5;
      const tipX = x + Math.sin(lean) * height;
      const tipY = ground - Math.cos(lean) * height;
      polygon(ctx, [x - 3.2, ground, tipX, tipY, x + 3.2, ground], fx.color, alpha * 0.85);
      polygon(ctx, [x - 1, ground, tipX, tipY, x + 1, ground], "#ffffff", alpha * 0.8);
    }
    ring(ctx, fx.x2, fx.y2, 6 + 12 * ease(p), fx.color, (1 - p) * 0.7, 1.5);
  },

  rift(ctx, fx, flown, p) {
    // A clock face over the enemy, its hands running backwards
    const r = 16 * (1 - 0.35 * p);
    const spin = fx.seed * TAU - p * 9;
    disc(ctx, fx.x2, fx.y2, r, fx.color, (1 - p) * 0.2);
    ring(ctx, fx.x2, fx.y2, r, fx.color, 1 - p);
    rays(ctx, fx.x2, fx.y2, r * 1.3, fx.color, (1 - p) * 0.9, 12, 0, 0.85);
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(fx.x2 + Math.cos(spin) * r * 0.85, fx.y2 + Math.sin(spin) * r * 0.85);
    ctx.lineTo(fx.x2, fx.y2);
    ctx.lineTo(fx.x2 + Math.cos(spin / 6) * r * 0.5, fx.y2 + Math.sin(spin / 6) * r * 0.5);
    ctx.stroke();
  },
};

/** Draws a shot `age` seconds after it was made. */
export function drawShot(ctx, fx, age) {
  const flown = fx.fly ? Math.min(1, age / fx.fly) : 1;
  const landed = Math.max(0, Math.min(1, (age - fx.fly) / (fx.seconds - fx.fly)));
  DRAW[fx.kind](ctx, fx, flown, landed, Math.atan2(fx.y2 - fx.y, fx.x2 - fx.x));
  ctx.globalAlpha = 1;
}
