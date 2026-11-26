// How each unit's attack looks. By the time a shot is drawn the game has already counted the hit:
// nothing here changes a run, it only shows it.
import { TIERS, UNITS } from "./config.js";

const TAU = Math.PI * 2;

// kind: [how fast it flies in field px a second (0: it is there at once), seconds it stays after landing,
//        how far the unit moves with it: in after its target for a blade, a kick back for the rest]
const KINDS = {
  slash: [0, 0.28, 8],
  smite: [0, 0.34, 8],
  thrust: [0, 0.22, 7],
  arrow: [620, 0.22],
  tracer: [0, 0.3],
  orb: [620, 0.28],
  shard: [700, 0.32],
  bolt: [0, 0.16],
  lob: [480, 0.32],
  breath: [0, 0.55],
  meteor: [820, 0.45],
  sword: [1500, 0.5],
  thorn: [0, 0.45],
  rift: [0, 0.6],
};

// unit: [kind, colour, how big next to the plainest of its kind, how hard the screen shakes as it lands]
const SHOTS = {
  swordsman: ["slash", "#fff1c9"],
  rogue: ["slash", "#d9c8ff", 0.8],
  knight: ["slash", "#dbe9ff", 1.3],
  paladin: ["smite", "#ffe27a", 1.5],
  valkyrie: ["thrust", "#bfe9ff", 1.7],
  dragonknight: ["thrust", "#ff7a3d", 2.3, 1],
  archer: ["arrow", "#e9dcae"],
  ranger: ["arrow", "#b9f08a", 1.15],
  sniper: ["tracer", "#9fe8ff", 1.4],
  apprentice: ["orb", "#c3b0ff"],
  pyromancer: ["orb", "#ff9a3d", 1.2],
  cryomancer: ["shard", "#8fe3ff"],
  stormcaller: ["bolt", "#fff36b", 1.4],
  druid: ["lob", "#8dff8a", 1.2],
  alchemist: ["lob", "#d6ff5a", 1.5],
  archmage: ["meteor", "#ff8a66", 1.3, 3],
  elderdragon: ["breath", "#ff6a2a", 1, 2.5],
  chronomancer: ["rift", "#9fe8ff", 1, 1.2],
  seraph: ["sword", "#ffe9a0", 1, 1.5],
  worldtree: ["thorn", "#7dff9a", 1.9],
};

const ease = (p) => 1 - (1 - p) * (1 - p);

/** The shot for an attack the game reported, from the slot centre `from`. */
export function makeShot(e, from) {
  const [kind, color, size = 1, shake = 0] = SHOTS[e.key];
  const [speed, after, kick = -2.5] = KINDS[kind];
  const muzzle = { x: from.x, y: from.y - 6 };
  // A meteor and the sword of judgment come out of the sky, not out of the unit
  const start = kind === "meteor" ? { x: e.x + 60, y: e.y - 170 } : kind === "sword" ? { x: e.x + 14, y: e.y - 170 } : muzzle;
  const fly = speed ? Math.hypot(e.x - start.x, e.y - start.y) / speed : 0;
  return {
    type: "shot",
    key: e.key,
    kind,
    color,
    rank: TIERS.indexOf(UNITS[e.key].tier), // 0 common .. 4 mythic
    size: size * (e.crit ? 1.6 : 1),
    shake,
    kick,
    x: start.x,
    y: start.y,
    x2: e.x,
    y2: e.y,
    ox: muzzle.x,
    oy: muzzle.y,
    splash: e.splash,
    crit: e.crit,
    ids: e.ids,
    dealt: e.dealt,
    isCut: e.dealt < e.amount * 0.99, // armor or ward took some of it
    first: e.first,
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

// What a better unit's shot adds where it lands: a ring thrown out, and from legendary up, splinters of light
function shock(ctx, fx, p) {
  const reach = 6 + 9 * fx.rank + (fx.splash ?? 0) * 0.3;
  ring(ctx, fx.x2, fx.y2, reach * ease(p), "#ffffff", (1 - p) * 0.75, 0.6 + 2.2 * (1 - p));
  if (fx.rank >= 3) rays(ctx, fx.x2, fx.y2, reach * (0.5 + 0.7 * ease(p)), fx.color, 1 - p, 3 * fx.rank - 3, fx.seed * TAU, 0.6);
}

function ellipse(ctx, x, y, rx, ry, color, alpha, width) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
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

// The bow at the moment of release, `gone` of the way (0 to 1) to having faded
function bow(ctx, fx, angle, gone) {
  if (gone >= 1) return;
  ctx.globalAlpha = 1 - gone;
  ctx.strokeStyle = fx.color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(fx.ox - Math.cos(angle) * 5, fx.oy - Math.sin(angle) * 5, 13, angle - 1.15, angle + 1.15);
  ctx.closePath();
  ctx.stroke();
}

// Each takes the shot, how far it has flown (0 to 1), how long ago it landed (0 to 1 of its stay),
// and the angle it travels at
const DRAW = {
  slash(ctx, fx, flown, p, angle) {
    const r = 24 * fx.size;
    const turn = fx.seed < 0.5 ? 1 : -1;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    // The rush in: a streak from where the unit stands, gone as the blade comes round
    if (p < 0.45) tail(ctx, fx.x2 - ux * 6, fx.y2 - uy * 6, angle, Math.hypot(fx.x2 - fx.x, fx.y2 - fx.y) * 0.8, 3.5 * fx.size, fx.color, 0.5 * (1 - p / 0.45));
    const x = fx.x2 - ux * r * 0.55;
    const y = fx.y2 - uy * r * 0.55;
    // The edge sweeps across first, and the far end of the arc follows it out
    const front = angle + turn * 1.15 * (2 * Math.min(1, p / 0.3) - 1);
    const back = angle + turn * 1.15 * (1.4 * Math.max(0, (p - 0.3) / 0.7) - 1);
    const lo = Math.min(front, back);
    const hi = Math.max(front, back);
    if (fx.rank >= 2) crescent(ctx, x, y, r * 1.3, lo, hi, r * 0.3, fx.color, (1 - p * p) * 0.4);
    crescent(ctx, x, y, r, lo, hi, r * 0.44, fx.color, 1 - p * p);
    crescent(ctx, x, y, r, lo, hi, r * 0.2, "#ffffff", 1 - p * p);
    // Where the edge bites
    if (p < 0.5) {
      const bite = 1 - p / 0.5;
      disc(ctx, fx.x2, fx.y2, 4.5 * fx.size * bite, "#ffffff", bite * 0.9);
      rays(ctx, fx.x2, fx.y2, (8 + 12 * (1 - bite)) * fx.size, "#ffffff", bite, fx.crit ? 8 : 4, fx.seed * TAU);
    }
  },

  // A paladin's blow: the sweep of the hammer, and light coming down with it to run out over the ground
  smite(ctx, fx, flown, p, angle) {
    DRAW.slash(ctx, fx, flown, p, angle);
    const fade = 1 - p;
    for (const [half, color, alpha] of [[10 * fade, fx.color, 0.4], [3.5 * fade, "#ffffff", 0.85]]) {
      ctx.globalAlpha = fade * alpha;
      ctx.fillStyle = color;
      ctx.fillRect(fx.x2 - half, fx.y2 - 80, half * 2, 80);
    }
    for (const lag of [0, 0.3]) {
      const out = (p - lag) / (1 - lag);
      if (out > 0) ellipse(ctx, fx.x2, fx.y2 + 4, 8 + 26 * ease(out), (8 + 26 * ease(out)) * 0.42, fx.color, 1 - out, 2);
    }
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
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const s = fx.size;
    bow(ctx, fx, angle, flown / 0.4);
    // In flight, then standing in what it hit for a moment
    const x = fx.x + (fx.x2 - fx.x) * flown;
    const y = fx.y + (fx.y2 - fx.y) * flown;
    const alpha = flown < 1 ? 1 : 1 - p;
    if (flown < 1) tail(ctx, x, y, angle, 46 * s, 2.6 * s, fx.color, 0.5);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(x - ux * 2, y - uy * 2);
    ctx.lineTo(x - ux * 18 * s, y - uy * 18 * s);
    // The feathers
    for (const side of [-1, 1]) {
      ctx.moveTo(x - ux * 15 * s, y - uy * 15 * s);
      ctx.lineTo(x - ux * 21 * s - uy * side * 3.4 * s, y - uy * 21 * s + ux * side * 3.4 * s);
    }
    ctx.stroke();
    polygon(ctx, [x + ux * 4.5 * s, y + uy * 4.5 * s, x - ux * 4 * s - uy * 3.6 * s, y - uy * 4 * s + ux * 3.6 * s, x - ux * 4 * s + uy * 3.6 * s, y - uy * 4 * s - ux * 3.6 * s], "#ffffff", alpha);
    if (flown === 1) rays(ctx, fx.x2, fx.y2, (5 + 10 * ease(p)) * s, "#ffffff", 1 - p, 5, fx.seed * TAU);
  },

  tracer(ctx, fx, flown, p, angle) {
    bow(ctx, fx, angle, p / 0.4);
    // The far end is there at once; the near end catches up with it
    const x = fx.x + (fx.x2 - fx.x) * p * 0.9;
    const y = fx.y + (fx.y2 - fx.y) * p * 0.9;
    const length = Math.hypot(fx.x2 - x, fx.y2 - y);
    tail(ctx, fx.x2, fx.y2, angle, length, 5 * fx.size * (1 - p), fx.color, (1 - p) * 0.55);
    tail(ctx, fx.x2, fx.y2, angle, length, 1.8 * fx.size * (1 - p), "#ffffff", 1 - p);
    rays(ctx, fx.x2, fx.y2, 17 * fx.size * (1 - p * 0.5), "#ffffff", 1 - p, 4, 0, 0.15);
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
    drawBolt(ctx, fx.x, fx.y, fx.x2, fx.y2, fx.color, (1 - p) * 0.5);
    glow(ctx, fx.x2, fx.y2, 3.5 * fx.size, fx.color, 1 - p);
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
    const reach = fx.splash ?? 30;
    const front = Math.min(1, p / 0.2);
    const fade = 1 - p;
    // The body of the flame, opening out to the width of what it burns
    const ex = fx.x + ux * length * front;
    const ey = fx.y + uy * length * front;
    for (const [wide, color, alpha] of [[reach * 0.45 * front, fx.color, 0.3], [reach * 0.2 * front, "#ffd27a", 0.4]]) {
      polygon(ctx, [fx.x, fx.y, ex - uy * wide, ey + ux * wide, ex + uy * wide, ey - ux * wide], color, fade * fade * fade * alpha);
    }
    for (let i = 1; i <= 14; i++) {
      const along = i / 14;
      if (along > front) break;
      const sway = Math.sin(fx.seed * 40 + i * 1.7 + p * 16) * reach * 0.16 * along;
      const r = (3 + along * reach * 0.28) * (1 - p * 0.3);
      disc(ctx, fx.x + ux * length * along - uy * sway, fx.y + uy * length * along + ux * sway, r, [fx.color, "#ffc45a", "#fff1c9"][i % 3], fade * 0.32);
    }
    if (p < 0.15) return;
    const after = (p - 0.15) / 0.85;
    blast(ctx, fx, after);
    // What is left burning, rising off the ground
    for (let i = 0; i < 10; i++) {
      const a = fx.seed * TAU + i * 2.4;
      const far = reach * (0.2 + ((i * 0.37) % 1) * 0.65);
      disc(ctx, fx.x2 + Math.cos(a) * far, fx.y2 + Math.sin(a) * far * 0.7 - after * 24, 2.8 * (1 - after), i % 2 ? "#ffc45a" : fx.color, 1 - after);
    }
  },

  meteor(ctx, fx, flown, p, angle) {
    if (flown < 1) {
      const x = fx.x + (fx.x2 - fx.x) * flown;
      const y = fx.y + (fx.y2 - fx.y) * flown;
      // Where it is about to come down
      ring(ctx, fx.x2, fx.y2, fx.splash * (0.9 - 0.4 * flown), fx.color, 0.6 * flown, 1.5);
      tail(ctx, x, y, angle, 60 * fx.size, 6 * fx.size, fx.color, 0.5);
      tail(ctx, x, y, angle, 34 * fx.size, 3 * fx.size, "#ffe9b8", 0.8);
      return glow(ctx, x, y, 7 * fx.size, fx.color);
    }
    blast(ctx, fx, p);
    ring(ctx, fx.x2, fx.y2, fx.splash * 0.6 * ease(p), "#ffffff", (1 - p) * 0.8);
    rays(ctx, fx.x2, fx.y2, fx.splash * (0.5 + 0.6 * ease(p)), fx.color, 1 - p, 8, fx.seed * TAU, 0.55);
  },

  sword(ctx, fx, flown, p, angle) {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    // The point of the blade
    const x = fx.x + (fx.x2 - fx.x) * flown;
    const y = fx.y + (fx.y2 - fx.y) * flown;
    if (flown < 1) tail(ctx, x, y, angle, 95, 8, fx.color, 0.4);
    // It stands where it struck for a moment
    const stays = flown < 1 ? 1 : Math.max(0, 1 - p / 0.45);
    if (stays) {
      const at = (back, side) => [x - ux * back - uy * side, y - uy * back + ux * side];
      polygon(ctx, [x, y, ...at(12, 5.5), ...at(50, 3.6), ...at(50, -3.6), ...at(12, -5.5)], fx.color, stays * 0.9);
      polygon(ctx, [x, y, ...at(12, 2), ...at(50, 1.3), ...at(50, -1.3), ...at(12, -2)], "#ffffff", stays);
      polygon(ctx, [...at(49, 12), ...at(53, 12), ...at(53, -12), ...at(49, -12)], fx.color, stays);
      polygon(ctx, [...at(53, 1.8), ...at(64, 1.8), ...at(64, -1.8), ...at(53, -1.8)], fx.color, stays);
    }
    if (flown < 1) return;
    // Light pours down on it
    const fade = 1 - p;
    for (const [half, color, alpha] of [[28 * fade, fx.color, 0.18], [15 * fade, fx.color, 0.45], [5.5 * fade, "#ffffff", 0.9]]) {
      ctx.globalAlpha = fade * alpha;
      ctx.fillStyle = color;
      ctx.fillRect(fx.x2 - half, fx.y2 - 200, half * 2, 200);
    }
    // A cross of light, rings running out over the ground, and motes rising
    const arm = 56 * (1 - p * 0.5);
    polygon(ctx, [fx.x2 - arm, fx.y2, fx.x2, fx.y2 - 3.5 * fade, fx.x2 + arm, fx.y2, fx.x2, fx.y2 + 3.5 * fade], "#ffffff", fade);
    for (const lag of [0, 0.25]) {
      const out = (p - lag) / (1 - lag);
      if (out > 0) ellipse(ctx, fx.x2, fx.y2 + 4, 10 + 36 * ease(out), (10 + 36 * ease(out)) * 0.42, fx.color, 1 - out, 2);
    }
    for (let i = 0; i < 7; i++) {
      rays(ctx, fx.x2 + Math.cos(fx.seed * TAU + i * 2.8) * 24, fx.y2 - 8 - p * 50 - i * 9, 1 + 3.5 * fade, "#ffffff", fade, 4, 0, 0);
    }
  },

  thorn(ctx, fx, flown, p) {
    const rise = ease(Math.min(1, p / 0.2));
    const alpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
    const ground = fx.y2 + 8;
    ellipse(ctx, fx.x2, ground, 15 * fx.size, 4.5 * fx.size, fx.color, alpha * 0.3);
    for (const [side, tall] of [[-2, 11], [2, 11], [-1, 17], [1, 17], [0, 25]]) {
      const lean = side * 0.3 + (fx.seed - 0.5) * 0.25;
      const height = tall * fx.size * rise;
      const x = fx.x2 + side * 4.2 * fx.size;
      const tipX = x + Math.sin(lean) * height;
      const tipY = ground - Math.cos(lean) * height;
      polygon(ctx, [x - 2.8 * fx.size, ground, tipX, tipY, x + 2.8 * fx.size, ground], fx.color, alpha * 0.85);
      polygon(ctx, [x - 0.9 * fx.size, ground, tipX, tipY, x + 0.9 * fx.size, ground], "#ffffff", alpha * 0.5);
    }
    ring(ctx, fx.x2, fx.y2, (6 + 14 * ease(p)) * fx.size, fx.color, (1 - p) * 0.7, 1.5);
    // Leaves thrown up as it breaks the ground
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.5 + (fx.seed - 0.5);
      const far = (6 + 20 * ease(p)) * fx.size;
      const x = fx.x2 + Math.cos(a) * far;
      const y = ground - 8 + Math.sin(a) * far + p * p * 16;
      polygon(ctx, [x - 3, y, x, y - 1.8, x + 3, y, x, y + 1.8], i % 2 ? "#eaffd0" : fx.color, 1 - p);
    }
  },

  rift(ctx, fx, flown, p, angle) {
    const fade = 1 - p;
    // A thread of light from the sage to where time is being unwound, gone almost at once
    if (p < 0.4) {
      const thin = 1 - p / 0.4;
      const length = Math.hypot(fx.x2 - fx.x, fx.y2 - fx.y);
      tail(ctx, fx.x2, fx.y2, angle, length, 3.5 * thin, fx.color, 0.5 * thin);
      tail(ctx, fx.x2, fx.y2, angle, length, 1.2 * thin, "#ffffff", thin);
    }
    // A clock face over the enemy, its hands running backwards
    const r = 30 * (1 - 0.3 * p);
    const spin = fx.seed * TAU - p * 14;
    disc(ctx, fx.x2, fx.y2, r, fx.color, fade * 0.16);
    ring(ctx, fx.x2, fx.y2, r, fx.color, fade, 2.5);
    ring(ctx, fx.x2, fx.y2, r * 0.72, "#ffffff", fade * 0.6, 1);
    rays(ctx, fx.x2, fx.y2, r * 1.22, fx.color, fade * 0.9, 12, spin * 0.15, 0.86);
    rays(ctx, fx.x2, fx.y2, r * 0.95, "#ffffff", fade * 0.8, 4, 0, 0.78);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(fx.x2 + Math.cos(spin) * r * 0.85, fx.y2 + Math.sin(spin) * r * 0.85);
    ctx.lineTo(fx.x2, fx.y2);
    ctx.lineTo(fx.x2 + Math.cos(spin / 6) * r * 0.5, fx.y2 + Math.sin(spin / 6) * r * 0.5);
    ctx.stroke();
    // Rings closing in on it: time folding back
    for (const lag of [0, 0.4]) {
      const close = p * 1.6 - lag;
      if (close > 0 && close < 1) ring(ctx, fx.x2, fx.y2, r + 50 * (1 - close), "#ffffff", close * 0.7, 1.5);
    }
  },
};

/** Draws a shot `age` seconds after it was made. */
export function drawShot(ctx, fx, age) {
  const flown = fx.fly ? Math.min(1, age / fx.fly) : 1;
  const landed = Math.max(0, Math.min(1, (age - fx.fly) / (fx.seconds - fx.fly)));
  // The better the unit, the more there is to see: a flare where it lets fly, a shock where it lands
  if (fx.rank >= 2 && fx.first && age < 0.15) {
    const out = age / 0.15;
    glow(ctx, fx.ox, fx.oy, (1.5 + fx.rank) * (1 - out), fx.color, (1 - out) * 0.7);
    if (fx.rank >= 3) ring(ctx, fx.ox, fx.oy, 8 + (8 + 5 * fx.rank) * ease(out), fx.color, (1 - out) * 0.8);
  }
  DRAW[fx.kind](ctx, fx, flown, landed, Math.atan2(fx.y2 - fx.y, fx.x2 - fx.x));
  if (fx.rank >= 2 && age >= fx.fly) shock(ctx, fx, Math.min(1, landed * 1.6));
  ctx.globalAlpha = 1;
}
