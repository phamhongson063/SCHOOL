import * as THREE from 'three';
import { Batch, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundColorAt, groundMaterial, groundTone, patchField, smoothstep, tileRoofMeshes, GROUND_LAYER } from './scenery.js';
import { keepCanvas } from './canvasRestore.js';

export const MOUNTAIN = { x0: -224, z0: -146, x1: 84, z1: 22 };
const STEP = 1;
const MESH_STEP = 2;
const MESH_SPAN = MESH_STEP / STEP;
const MAX_SLOPE = 0.55;
const FLAT = 0.04;
const SINK = -0.08;

const SPINE = [
  [-216, -6, 0, 30],
  [-185, -12, 14, 38],
  [-150, -20, 18, 40],
  [-120, -35, 26, 48],
  [-90, -60, 32, 55],
  [-55, -85, 38, 60],
  [-15, -100, 30, 52],
  [25, -100, 26, 50],
  [60, -90, 16, 40],
  [82, -82, 0, 30],
];

export const SUMMIT = { x: -55, z: -85 };
export const PAGODA = { x: SUMMIT.x, z: SUMMIT.z, half: 2.4, porch: 0.55, stand: { x: SUMMIT.x, z: SUMMIT.z + 5.2 }, urn: { x: SUMMIT.x, z: SUMMIT.z + 3.8 } };
export const HERMITAGE = { x: SUMMIT.x, z: SUMMIT.z - 7.2, halfX: 1.8, halfZ: 1.2, door: { x: SUMMIT.x, z: SUMMIT.z - 5.4 } };
const SUMMIT_FLAT = 9.5;
const SUMMIT_BLEND = 10;
const SUMMIT_CAP_SLOPE = 0.05;
const COURTYARD = { half: 3.6, z0: 3.2, z1: 8.6, top: 0.03 };
const STAIRS = { half: 1.3, from: SUMMIT_FLAT, steps: 16, run: 0.7, maxRise: 0.5 };
const STAIRS_LENGTH = STAIRS.steps * STAIRS.run;
const STAIRS_CARVE = 3;
export const SHELTERS = [
  { x: -57.9, z: -39.8, turn: 0.6 },
  { x: 24.8, z: -52.6, turn: -0.5 },
];
export const SHELTER_RADIUS = 3.2;
const SHELTER_FLOOR = { halfX: 1.6, halfZ: 1.4, thick: 0.2, top: 0.15 };
export const COURT = {
  x: 62,
  z: -32,
  turn: Math.PI,
  halfU: 10,
  halfV: 7,
  front: 2.6,
  step: 2.4,
  rise: 0.3,
  terraces: 4,
  grade: 0.85,
  rim: 3,
  reach: 16,
  stage: { halfU: 3.2, from: 4, to: 6.8, lift: 0.45 },
  caller: { v: 5.1, standV: 3.3 },
  posts: [
    [-3, 4.2],
    [3, 4.2],
    [-3, 6.6],
    [3, 6.6],
  ],
  lanterns: [
    [-9.4, 2.9],
    [9.4, 2.9],
    [-9.4, 6.6],
    [9.4, 6.6],
  ],
  rowPole: 10.4,
};

export const courtRowPoles = () =>
  Array.from({ length: COURT.terraces }, (_, k) => COURT.front - COURT.step * (k + 0.5)).flatMap((v) => [
    [-COURT.rowPole, v],
    [COURT.rowPole, v],
  ]);
const COURT_CLEAR = COURT.rim + 1.5;
const COURT_SUMMIT_FADE = 6;

const TRAILS = [
  [
    [-50, 32.6],
    [-51, 18],
    [-56, 2],
    [-64, -14],
    [-55, -30],
    [-66, -46],
    [-56, -62],
    [-55, -63.8],
  ],
  [
    [36.5, 32.6],
    [36.4, 20],
    [34, 8],
    [30, -6],
    [27, -24],
    [26, -44],
    [18, -58],
    [8, -72],
    [-4, -86],
    [-14, -97],
  ],
];
const TRAIL_WIDTH = 1.6;
const TRAIL_CLEAR = 3;

const STREAM = [
  [-122, -30],
  [-126, -18],
  [-131, -4],
  [-135, 10],
  [-139, 24],
  [-140, 35.5],
  [-140.5, 48],
  [-139, 60],
  [-138, 71],
];
const STREAM_HALF = 1.1;
const BANK_HALF = 1.9;
export const BRIDGE = { x: -140, z: 35.5, span: 3.6, rise: 1.12, step: 0.1, base: 0.25, half: 2.6, wall: 0.25, pad: 1.3, padHalf: 3.6, arch: 1.5, crown: 0.8 };

const COLS = Math.round((MOUNTAIN.x1 - MOUNTAIN.x0) / STEP) + 1;
const ROWS = Math.round((MOUNTAIN.z1 - MOUNTAIN.z0) / STEP) + 1;
const MESH_COLS = (COLS - 1) / MESH_SPAN + 1;
const MESH_ROWS = (ROWS - 1) / MESH_SPAN + 1;

let heights = null;
let summit = null;
let court = null;
let layout = null;

function spineHeight(x, z) {
  let best = 0;
  for (let i = 0; i < SPINE.length - 1; i++) {
    const [ax, az, ah, aw] = SPINE[i];
    const [bx, bz, bh, bw] = SPINE[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    const w = aw + (bw - aw) * t;
    if (d >= w) continue;
    const h = ah + (bh - ah) * t;
    best = Math.max(best, h * (0.5 + 0.5 * Math.cos((Math.PI * d) / w)));
  }
  return best;
}

function mask(x, z) {
  let m = 1 - smoothstep(8, 18, z);
  const nearSchool = smoothstep(-28, -23, x) * (1 - smoothstep(23, 28, x)) * smoothstep(-52, -45, z);
  m *= 1 - nearSchool;
  const east = smoothstep(22, 28, x) * smoothstep(-6, 4, z);
  m *= 1 - east;
  return m;
}

function sampleGrid(grid, x, z) {
  const fx = (x - MOUNTAIN.x0) / STEP;
  const fz = (z - MOUNTAIN.z0) / STEP;
  const c = Math.min(COLS - 2, Math.floor(fx));
  const r = Math.min(ROWS - 2, Math.floor(fz));
  const tx = fx - c;
  const tz = fz - r;
  const n = r * COLS + c;
  const a = grid[n];
  const b = grid[n + 1];
  const d = grid[n + COLS];
  const e = grid[n + COLS + 1];
  return (a + (b - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
}

function forCellsNear(x, z, radius, visit) {
  const c0 = Math.max(0, Math.floor((x - radius - MOUNTAIN.x0) / STEP));
  const c1 = Math.min(COLS - 1, Math.ceil((x + radius - MOUNTAIN.x0) / STEP));
  const r0 = Math.max(0, Math.floor((z - radius - MOUNTAIN.z0) / STEP));
  const r1 = Math.min(ROWS - 1, Math.ceil((z + radius - MOUNTAIN.z0) / STEP));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) visit(r * COLS + c, MOUNTAIN.x0 + c * STEP, MOUNTAIN.z0 + r * STEP);
  }
}

function shapeSummit(grid) {
  let top = 0;
  forCellsNear(SUMMIT.x, SUMMIT.z, SUMMIT_FLAT, (n, x, z) => {
    if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) <= SUMMIT_FLAT) top = Math.max(top, grid[n]);
  });
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const n = r * COLS + c;
      const beyond = Math.max(0, Math.hypot(MOUNTAIN.x0 + c * STEP - SUMMIT.x, MOUNTAIN.z0 + r * STEP - SUMMIT.z) - SUMMIT_FLAT);
      if (beyond < SUMMIT_BLEND) grid[n] += (top - grid[n]) * (1 - smoothstep(0, SUMMIT_BLEND, beyond));
      grid[n] = Math.min(grid[n], top - beyond * SUMMIT_CAP_SLOPE);
    }
  }
  const foot = sampleGrid(grid, SUMMIT.x, SUMMIT.z + STAIRS.from + STAIRS_LENGTH);
  const rise = Math.min(STAIRS.maxRise, Math.max(0, top - foot) / STAIRS.steps);
  forCellsNear(SUMMIT.x, SUMMIT.z + STAIRS.from + STAIRS_LENGTH / 2, STAIRS_LENGTH / 2 + MESH_STEP, (n, x, z) => {
    const along = z - SUMMIT.z - STAIRS.from;
    if (Math.abs(x - SUMMIT.x) > STAIRS_CARVE || along < -MESH_STEP || along > STAIRS_LENGTH + 0.5) return;
    grid[n] = Math.min(grid[n], top - (along / STAIRS.run + 1) * rise);
  });
  summit = { top, rise };
}

const courtCos = Math.cos(COURT.turn);
const courtSin = Math.sin(COURT.turn);

export function courtLocal(x, z) {
  const dx = x - COURT.x;
  const dz = z - COURT.z;
  return { u: dx * courtCos - dz * courtSin, v: dx * courtSin + dz * courtCos };
}

export function courtPoint(u, v) {
  return { x: COURT.x + u * courtCos + v * courtSin, z: COURT.z - u * courtSin + v * courtCos };
}

export const courtLevel = (v) => (v >= COURT.front ? 0 : Math.min(COURT.terraces, Math.ceil((COURT.front - v) / COURT.step)) * COURT.rise);

function courtGap(x, z) {
  const { u, v } = courtLocal(x, z);
  const cu = Math.max(-COURT.halfU, Math.min(COURT.halfU, u));
  const cv = Math.max(-COURT.halfV, Math.min(COURT.halfV, v));
  return { gap: Math.hypot(u - cu, v - cv), u, v, cv };
}

const onStage = (u, v) => Math.abs(u) <= COURT.stage.halfU && v >= COURT.stage.from && v <= COURT.stage.to;

function shapeCourt(grid) {
  const floor = sampleGrid(grid, COURT.x, COURT.z) - COURT.rise * 2;
  forCellsNear(COURT.x, COURT.z, Math.hypot(COURT.halfU, COURT.halfV) + COURT.reach, (n, x, z) => {
    const { gap, cv } = courtGap(x, z);
    if (gap > COURT.reach) return;
    const edge = floor + courtLevel(cv) - 0.05;
    const rise = COURT.grade * Math.max(0, gap - COURT.rim);
    const graded = Math.max(edge - rise, Math.min(edge + rise, grid[n]));
    const clear = SUMMIT_FLAT + SUMMIT_BLEND;
    const weight = mask(x, z) * smoothstep(clear, clear + COURT_SUMMIT_FADE, Math.hypot(x - SUMMIT.x, z - SUMMIT.z));
    grid[n] += (graded - grid[n]) * weight;
  });
  court = { floor };
}

export function courtBase() {
  heights ??= buildHeights();
  return court.floor;
}

export function courtTop(x, z) {
  const { gap, u, v } = courtGap(x, z);
  if (gap > 0) return null;
  const top = courtBase() + courtLevel(v);
  return onStage(u, v) ? top + COURT.stage.lift : top;
}

export const nearCourt = (x, z, margin = 0) => courtGap(x, z).gap <= margin;

function stairTop(x, z) {
  const along = z - SUMMIT.z - STAIRS.from;
  if (Math.abs(x - SUMMIT.x) > STAIRS.half || along < COURTYARD.z1 - STAIRS.from || along >= STAIRS_LENGTH) return null;
  heights ??= buildHeights();
  if (along < 0) return summit.top + COURTYARD.top;
  return summit.top - (Math.floor(along / STAIRS.run) + 1) * summit.rise;
}

function buildHeights() {
  const broad = patchField(71, 24);
  const fine = patchField(83, 9);
  const grid = new Float32Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    const z = MOUNTAIN.z0 + r * STEP;
    for (let c = 0; c < COLS; c++) {
      const x = MOUNTAIN.x0 + c * STEP;
      const base = spineHeight(x, z);
      const relief = ((broad(x, z) - 0.5) * 9 + (fine(x, z) - 0.5) * 2.5) * smoothstep(0, 8, base);
      grid[r * COLS + c] = Math.max(0, (base + relief) * mask(x, z));
    }
  }
  const diag = MAX_SLOPE * STEP * Math.SQRT2;
  const side = MAX_SLOPE * STEP;
  const at = (r, c) => (r < 0 || c < 0 || r >= ROWS || c >= COLS ? Infinity : grid[r * COLS + c]);
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const n = r * COLS + c;
        grid[n] = Math.min(grid[n], at(r, c - 1) + side, at(r - 1, c) + side, at(r - 1, c - 1) + diag, at(r - 1, c + 1) + diag);
      }
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = COLS - 1; c >= 0; c--) {
        const n = r * COLS + c;
        grid[n] = Math.min(grid[n], at(r, c + 1) + side, at(r + 1, c) + side, at(r + 1, c + 1) + diag, at(r + 1, c - 1) + diag);
      }
    }
  }
  shapeSummit(grid);
  shapeCourt(grid);
  return grid;
}

function sampleMesh(grid, x, z) {
  const fx = (x - MOUNTAIN.x0) / MESH_STEP;
  const fz = (z - MOUNTAIN.z0) / MESH_STEP;
  const c = Math.min(MESH_COLS - 2, Math.floor(fx));
  const r = Math.min(MESH_ROWS - 2, Math.floor(fz));
  const tx = fx - c;
  const tz = fz - r;
  const n = r * MESH_SPAN * COLS + c * MESH_SPAN;
  const a = grid[n];
  const d = grid[n + MESH_SPAN];
  const b = grid[n + MESH_SPAN * COLS];
  const e = grid[n + MESH_SPAN * COLS + MESH_SPAN];
  if (tx + tz <= 1) return a + (d - a) * tx + (b - a) * tz;
  return e + (b - e) * (1 - tx) + (d - e) * (1 - tz);
}

export function terrainHeight(x, z) {
  if (x <= MOUNTAIN.x0 || x >= MOUNTAIN.x1 || z <= MOUNTAIN.z0 || z >= MOUNTAIN.z1) return 0;
  heights ??= buildHeights();
  return sampleMesh(heights, x, z);
}

function shelterFloor(x, z) {
  for (const hut of SHELTERS) {
    const ox = x - hut.x;
    const oz = z - hut.z;
    const c = Math.cos(hut.turn);
    const s = Math.sin(hut.turn);
    if (Math.abs(ox * c - oz * s) <= SHELTER_FLOOR.halfX && Math.abs(ox * s + oz * c) <= SHELTER_FLOOR.halfZ) {
      return terrainHeight(hut.x, hut.z) + SHELTER_FLOOR.top;
    }
  }
  return null;
}

export function terrainFloor(x, z) {
  const deck = bridgeSurface(x, z);
  if (deck !== null && !Number.isNaN(deck)) return deck;
  const h = terrainHeight(x, z);
  const floor = shelterFloor(x, z) ?? stairTop(x, z) ?? courtTop(x, z);
  if (floor !== null) return Math.max(h, floor);
  return h > FLAT ? h : null;
}

export function onMountain(x, z, above = 0.6) {
  return terrainHeight(x, z) > above;
}

function trailPoints(route) {
  const points = [];
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, az] = route[i];
    const [bx, bz] = route[i + 1];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      points.push([ax + (bx - ax) * t, az + (bz - az) * t]);
    }
  }
  points.push(route[route.length - 1]);
  const smooth = points.map((point, i) => {
    if (i < 2 || i > points.length - 3) return point;
    let sx = 0;
    let sz = 0;
    for (let k = -2; k <= 2; k++) {
      sx += points[i + k][0];
      sz += points[i + k][1];
    }
    return [sx / 5, sz / 5];
  });
  return smooth;
}

function nearTrail(trails, x, z, radius) {
  const r2 = radius * radius;
  for (const trail of trails) {
    for (let i = 0; i < trail.length; i += 2) {
      const dx = trail[i][0] - x;
      const dz = trail[i][1] - z;
      if (dx * dx + dz * dz < r2) return true;
    }
  }
  return false;
}

const streamPoints = (() => {
  const points = [];
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i];
    const [bx, bz] = STREAM[i + 1];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      points.push([ax + (bx - ax) * t, az + (bz - az) * t]);
    }
  }
  points.push(STREAM[STREAM.length - 1]);
  return points;
})();

const streamBuckets = (() => {
  const map = new Map();
  for (const [x, z] of streamPoints) {
    const key = `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
    const list = map.get(key);
    if (list) list.push([x, z]);
    else map.set(key, [[x, z]]);
  }
  return map;
})();

export function streamDistance(x, z) {
  const bx = Math.floor(x / 4);
  const bz = Math.floor(z / 4);
  let best = Infinity;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const list = streamBuckets.get(`${bx + dx},${bz + dz}`);
      if (!list) continue;
      for (const [px, pz] of list) best = Math.min(best, (px - x) ** 2 + (pz - z) ** 2);
    }
  }
  return Math.sqrt(best);
}

const bridgeCurve = (dx) => BRIDGE.rise * Math.max(0, 1 - (dx / BRIDGE.span) ** 2);
const bridgeTop = (dx) => BRIDGE.base + Math.floor(bridgeCurve(dx) / BRIDGE.step + 1e-6) * BRIDGE.step;
const bridgeLanterns = () => {
  const ox = BRIDGE.span + BRIDGE.pad - 0.3;
  const oz = BRIDGE.padHalf - 0.3;
  return [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: BRIDGE.x + sx * ox, z: BRIDGE.z + sz * oz })));
};

function bridgeSurface(x, z) {
  const dx = Math.abs(x - BRIDGE.x);
  const dz = Math.abs(z - BRIDGE.z);
  if (dx <= BRIDGE.span) {
    if (dz < BRIDGE.half) return bridgeTop(dx);
    return dz <= BRIDGE.half + BRIDGE.wall ? NaN : null;
  }
  if (dx > BRIDGE.span + BRIDGE.pad || dz > BRIDGE.padHalf) return null;
  if (bridgeLanterns().some((lamp) => Math.abs(x - lamp.x) < 0.3 && Math.abs(z - lamp.z) < 0.3)) return NaN;
  return BRIDGE.base;
}

export function inStream(x, z) {
  return bridgeSurface(x, z) === null && streamDistance(x, z) < STREAM_HALF + 0.25;
}

const BUCKET = 4;
const ROCK_RISE = 1.35;
const ROCK_STEP_OVER = 0.6;
const bucketKey = (x, z) => `${Math.floor(x / BUCKET)},${Math.floor(z / BUCKET)}`;

function buildLayout() {
  const rand = makeRandom(9191);
  const trails = TRAILS.map(trailPoints);
  const density = patchField(97, 18);
  const trees = [];
  const rocks = [];
  const blockers = new Map();
  const block = (x, z, r) => {
    const key = bucketKey(x, z);
    const list = blockers.get(key);
    if (list) list.push({ x, z, r });
    else blockers.set(key, [{ x, z, r }]);
  };
  const clearOf = (x, z) =>
    !nearTrail(trails, x, z, TRAIL_CLEAR) &&
    Math.hypot(x - SUMMIT.x, z - SUMMIT.z) > SUMMIT_FLAT + 3 &&
    !(Math.abs(x - SUMMIT.x) < STAIRS.half + 2.5 && z > SUMMIT.z && z < SUMMIT.z + STAIRS.from + STAIRS_LENGTH + 3) &&
    streamDistance(x, z) > BANK_HALF + 1.2 &&
    SHELTERS.every((hut) => Math.hypot(x - hut.x, z - hut.z) > 4.5) &&
    !nearCourt(x, z, COURT_CLEAR);
  const { half } = PAGODA;
  for (let px = -half; px <= half + 1e-6; px += 0.8) {
    for (let pz = -half; pz <= half + 1e-6; pz += 0.8) block(PAGODA.x + px, PAGODA.z + pz, 0.6);
  }
  block(PAGODA.urn.x, PAGODA.urn.z, 0.45);
  for (let px = -HERMITAGE.halfX; px <= HERMITAGE.halfX + 1e-6; px += 0.6) {
    for (let pz = -HERMITAGE.halfZ; pz <= HERMITAGE.halfZ + 1e-6; pz += 0.6) block(HERMITAGE.x + px, HERMITAGE.z + pz, 0.45);
  }
  for (const hut of SHELTERS) {
    for (const [dx, dz] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) {
      const c = Math.cos(hut.turn);
      const sn = Math.sin(hut.turn);
      block(hut.x + dx * c + dz * sn, hut.z - dx * sn + dz * c, 0.22);
    }
  }
  for (const [u, v] of [...COURT.posts, ...COURT.lanterns, ...courtRowPoles(), [0, COURT.caller.v]]) {
    const at = courtPoint(u, v);
    block(at.x, at.z, 0.3);
  }
  for (let z = MOUNTAIN.z0 + 3; z < MOUNTAIN.z1; z += 5) {
    for (let x = MOUNTAIN.x0 + 3; x < MOUNTAIN.x1; x += 5) {
      const px = x + (rand() - 0.5) * 4.4;
      const pz = z + (rand() - 0.5) * 4.4;
      const h = terrainHeight(px, pz);
      if (h < 1.2 || h > 30 || density(px, pz) < 0.44 || !clearOf(px, pz)) continue;
      const pine = h > 14 ? rand() < 0.7 : rand() < 0.25;
      const scale = 0.8 + rand() * 0.55;
      trees.push({ x: px, z: pz, y: h, pine, scale, turn: rand() * Math.PI * 2, tint: rand() });
      block(px, pz, 0.45);
    }
  }
  for (let i = 0; i < 260 && rocks.length < 46; i++) {
    const px = MOUNTAIN.x0 + rand() * (MOUNTAIN.x1 - MOUNTAIN.x0);
    const pz = MOUNTAIN.z0 + rand() * (MOUNTAIN.z1 - MOUNTAIN.z0);
    const h = terrainHeight(px, pz);
    if (h < 2 || !clearOf(px, pz)) continue;
    const size = 0.55 + rand() * 1.1;
    const turn = rand() * Math.PI * 2;
    const squash = 0.55 + rand() * 0.3;
    rocks.push({ x: px, z: pz, y: h, size, turn, squash });
    if (size * squash * ROCK_RISE > ROCK_STEP_OVER) block(px, pz, size * 0.85);
  }
  return { trails, trees, rocks, blockers };
}

function ensureLayout() {
  layout ??= buildLayout();
  return layout;
}

export function terrainBlocked(x, z) {
  const { blockers } = ensureLayout();
  const bx = Math.floor(x / BUCKET);
  const bz = Math.floor(z / BUCKET);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const list = blockers.get(`${bx + dx},${bz + dz}`);
      if (!list) continue;
      for (const item of list) {
        if ((item.x - x) ** 2 + (item.z - z) ** 2 < item.r * item.r) return true;
      }
    }
  }
  return false;
}

export function navSurface(x, z) {
  const deck = bridgeSurface(x, z);
  if (deck !== null) return deck;
  if (inStream(x, z)) return NaN;
  const h = terrainHeight(x, z);
  const floor = shelterFloor(x, z) ?? stairTop(x, z) ?? courtTop(x, z);
  if (floor === null && h <= FLAT) return null;
  return terrainBlocked(x, z) ? NaN : Math.max(h, floor ?? h);
}

function terrainMesh() {
  const cols = MESH_COLS;
  const rows = MESH_ROWS;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const colors = new Float32Array(cols * rows * 3);
  const forest = groundTone(0x4f8a3b);
  const highland = groundTone(0x87a15c);
  const rock = groundTone(0x8f8b82);
  const rocky = patchField(113, 14);
  const color = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const z = MOUNTAIN.z0 + r * MESH_STEP;
    for (let c = 0; c < cols; c++) {
      const x = MOUNTAIN.x0 + c * MESH_STEP;
      const n = r * cols + c;
      const h = terrainHeight(x, z);
      positions.set([x, h > FLAT ? h : SINK, z], n * 3);
      uvs.set([(x + 500) / 1000, (-z + 500) / 1000], n * 2);
      groundColorAt(x, z, color);
      color.lerp(forest, smoothstep(1.5, 6, h) * (1 - smoothstep(20, 27, h)) * 0.75);
      color.lerp(highland, smoothstep(20, 27, h) * 0.8);
      color.lerp(rock, Math.min(1, smoothstep(0.6, 0.76, rocky(x, z)) * smoothstep(4, 12, h) * 0.85 + smoothstep(27, 34, h) * 0.7));
      color.toArray(colors, n * 3);
    }
  }
  const index = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + cols;
      const d = a + 1;
      const e = b + 1;
      if (positions[a * 3 + 1] <= 0 && positions[b * 3 + 1] <= 0 && positions[d * 3 + 1] <= 0 && positions[e * 3 + 1] <= 0) continue;
      index.push(a, b, d, d, b, e);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, groundMaterial());
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function ribbonGeometry(points, half, lift, along = 1) {
  const positions = [];
  const uvs = [];
  const index = [];
  let distance = 0;
  points.forEach(([x, z], i) => {
    const [px, pz] = points[Math.max(0, i - 1)];
    const [nx, nz] = points[Math.min(points.length - 1, i + 1)];
    if (i > 0) distance += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    const len = Math.hypot(nx - px, nz - pz) || 1;
    const ox = (-(nz - pz) / len) * half;
    const oz = ((nx - px) / len) * half;
    for (const side of [-1, 1]) {
      const vx = x + ox * side;
      const vz = z + oz * side;
      positions.push(vx, terrainHeight(vx, vz) + lift, vz);
      if (along) uvs.push(side < 0 ? 0 : 1, distance * along);
      else uvs.push(vx, -vz);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

function trailMesh(trail) {
  const mesh = new THREE.Mesh(ribbonGeometry(trail, TRAIL_WIDTH / 2, 0.07, 0), earthMaterial());
  mesh.renderOrder = GROUND_LAYER.earth;
  mesh.receiveShadow = true;
  return mesh;
}

function paintFlow(ctx) {
  ctx.fillStyle = '#4f9fc9';
  ctx.fillRect(0, 0, 64, 128);
  const rand = makeRandom(5151);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(230, 246, 255, ${0.18 + rand() * 0.25})`;
    ctx.fillRect(4 + rand() * 52, rand() * 128, 2 + rand() * 6, 6 + rand() * 16);
  }
}

function flowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  paintFlow(canvas.getContext('2d'));
  const texture = keepCanvas(new THREE.CanvasTexture(canvas), paintFlow);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function streamMeshes() {
  const bank = new THREE.Mesh(ribbonGeometry(streamPoints, BANK_HALF, 0.05, 0), earthMaterial());
  bank.renderOrder = GROUND_LAYER.earth;
  bank.receiveShadow = true;
  const flow = flowTexture();
  const water = new THREE.Mesh(
    ribbonGeometry(streamPoints, STREAM_HALF, 0.09, 0.25),
    toonMaterial({ map: flow, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  );
  water.renderOrder = GROUND_LAYER.mark;
  const b = new Batch();
  const rand = makeRandom(6262);
  for (let i = 4; i < streamPoints.length - 4; i += 7) {
    const [x, z] = streamPoints[i];
    if (Math.abs(z - BRIDGE.z) < 5) continue;
    const side = rand() < 0.5 ? -1 : 1;
    const px = x + side * (STREAM_HALF + 0.35 + rand() * 0.4);
    const pz = z + (rand() - 0.5) * 0.6;
    const size = 0.22 + rand() * 0.3;
    b.add(shapes.ico(size, 0), 0x9a968c, { p: [px, terrainHeight(px, pz) + size * 0.35, pz], s: [1, 0.6, 1.2], flat: true });
  }
  const pebbles = b.mesh();
  return { meshes: [bank, water, pebbles], flow };
}

const STONE = { light: 0xc9c2b2, mid: 0xb3ab99, tread: [0xb0a898, 0xa39b8a], dark: 0x8a8273, ring: 0x7a7366, pad: 0x9e9484 };
const LACQUER = { rail: 0x8a2e22, post: 0x6a2a1e, baluster: 0x7a3024 };

function slope(b, x0, y0, x1, y1, z, height, depth, hex) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  b.add(shapes.box(length + 0.02, height, depth), hex, { p: [(x0 + x1) / 2, (y0 + y1) / 2, z], r: [0, 0, Math.atan2(y1 - y0, x1 - x0)] });
}

function stoneLantern(b, x, z, y) {
  b.add(shapes.box(0.44, 0.12, 0.44), STONE.dark, { p: [x, y + 0.06, z] });
  b.add(shapes.box(0.2, 0.62, 0.2), STONE.mid, { p: [x, y + 0.43, z] });
  b.add(shapes.box(0.38, 0.06, 0.38), STONE.dark, { p: [x, y + 0.77, z] });
  b.add(shapes.box(0.32, 0.28, 0.32), STONE.light, { p: [x, y + 0.94, z] });
  b.add(shapes.box(0.34, 0.12, 0.16), 0x3a2a1a, { p: [x, y + 0.95, z] });
  b.add(shapes.box(0.16, 0.12, 0.34), 0x3a2a1a, { p: [x, y + 0.95, z] });
  b.add(shapes.cone(0.34, 0.24, 4), STONE.dark, { p: [x, y + 1.2, z], r: [0, Math.PI / 4, 0] });
  b.add(shapes.sphere(0.05, 8, 6), STONE.mid, { p: [x, y + 1.34, z] });
}

function bridgeMesh() {
  const b = new Batch();
  const { x: X, z: Z, span, rise, step, base, half, wall, pad, padHalf, arch, crown } = BRIDGE;
  const radius = (arch * arch + crown * crown) / (2 * crown);
  const centerY = crown - radius;
  const intrados = (dx) => centerY + Math.sqrt(Math.max(0, radius * radius - dx * dx));
  const levels = Math.floor(rise / step + 1e-6);
  const reach = (k) => (k > levels ? 0 : span * Math.sqrt(Math.max(0, 1 - (k * step) / rise)));
  const coping = (dx) => base + bridgeCurve(dx) + 0.08;

  for (let k = 0; k <= levels; k++) {
    const outer = k === 0 ? span : reach(k);
    const inner = reach(k + 1);
    const top = base + k * step;
    const hex = STONE.tread[k % 2];
    if (k === levels) {
      b.add(shapes.box(outer * 2, 0.25, half * 2), hex, { p: [X, top - 0.125, Z] });
      continue;
    }
    for (const side of [-1, 1]) b.add(shapes.box(outer - inner, 0.25, half * 2), hex, { p: [X + side * (outer + inner) / 2, top - 0.125, Z] });
  }

  const vaultDepth = (half + wall) * 2;
  const sweep = Math.asin(arch / radius);
  const stones = 13;
  for (let i = 0; i < stones; i++) {
    const angle = -sweep + ((i + 0.5) * 2 * sweep) / stones;
    const r = radius + 0.1;
    const key = i === (stones - 1) / 2;
    const p = [X + Math.sin(angle) * r, centerY + Math.cos(angle) * r, Z];
    const arc = ((2 * sweep) / stones) * r * 1.04;
    b.add(shapes.box(arc, 0.2, vaultDepth), STONE.dark, { p, r: [0, 0, -angle] });
    for (const side of [-1, 1]) {
      b.add(shapes.box(arc * 0.94, key ? 0.34 : 0.26, 0.08), key ? STONE.light : STONE.ring, { p: [p[0], p[1] + (key ? 0.04 : 0), Z + side * (half + wall + 0.03)], r: [0, 0, -angle] });
    }
  }

  const column = 0.15;
  for (let cx = -span + column / 2; cx < span; cx += column) {
    const dx = Math.abs(cx);
    const top = coping(dx);
    const bottom = dx < arch ? intrados(dx) + 0.2 : -0.05;
    if (top - bottom < 0.02) continue;
    for (const side of [-1, 1]) b.add(shapes.box(column + 0.005, top - bottom, wall), STONE.light, { p: [X + cx, (top + bottom) / 2, Z + side * (half + wall / 2)] });
  }

  const pieces = 24;
  const railZ = half + wall / 2;
  for (let i = 0; i < pieces; i++) {
    const xa = -span + (i * 2 * span) / pieces;
    const xb = -span + ((i + 1) * 2 * span) / pieces;
    const ya = coping(Math.abs(xa));
    const yb = coping(Math.abs(xb));
    for (const side of [-1, 1]) {
      const z = Z + side * railZ;
      slope(b, X + xa, ya + 0.03, X + xb, yb + 0.03, z, 0.06, wall + 0.08, STONE.dark);
      slope(b, X + xa, ya + 0.7, X + xb, yb + 0.7, z, 0.07, 0.09, LACQUER.rail);
      slope(b, X + xa, ya + 0.16, X + xb, yb + 0.16, z, 0.05, 0.06, LACQUER.rail);
      const mid = (xa + xb) / 2;
      const ym = coping(Math.abs(mid));
      b.add(shapes.box(0.035, 0.52, 0.035), LACQUER.baluster, { p: [X + mid, ym + 0.42, z] });
      if (i % 4 === 0 || i === pieces - 1) {
        const px = i === pieces - 1 ? xb : xa;
        const py = coping(Math.abs(px));
        const end = i === 0 || i === pieces - 1;
        const h = end ? 0.95 : 0.82;
        b.add(shapes.box(end ? 0.13 : 0.09, h, end ? 0.13 : 0.09), LACQUER.post, { p: [X + px, py + h / 2, z] });
        b.add(shapes.sphere(end ? 0.08 : 0.055, 8, 6), LACQUER.rail, { p: [X + px, py + h + 0.03, z], s: [1, 1.3, 1] });
      }
    }
  }

  for (const side of [-1, 1]) {
    const cx = X + side * (span + pad / 2);
    b.add(shapes.box(pad + 0.16, 0.1, padHalf * 2 + 0.16), STONE.dark, { p: [cx, 0.05, Z] });
    b.add(shapes.box(pad, base - 0.02, padHalf * 2), STONE.pad, { p: [cx, (base - 0.02) / 2, Z] });
    const cols = 2;
    const rows = 4;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const tx = cx - pad / 2 + ((i + 0.5) * pad) / cols;
        const tz = Z - padHalf + ((j + 0.5) * 2 * padHalf) / rows;
        b.add(shapes.box((pad / cols) * 0.95, 0.02, ((2 * padHalf) / rows) * 0.95), (i + j) % 2 ? STONE.mid : 0xaba392, { p: [tx, base - 0.01, tz] });
      }
    }
  }
  for (const lamp of bridgeLanterns()) stoneLantern(b, lamp.x, lamp.z, base);

  const mesh = b.mesh();
  mesh.renderOrder = GROUND_LAYER.mark + 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function shelterMesh() {
  const b = new Batch();
  for (const hut of SHELTERS) {
    const y = terrainHeight(hut.x, hut.z);
    b.group([hut.x, y, hut.z], [0, hut.turn, 0], () => {
      b.add(shapes.box(SHELTER_FLOOR.halfX * 2, SHELTER_FLOOR.thick, SHELTER_FLOOR.halfZ * 2), 0x8a6a48, { p: [0, SHELTER_FLOOR.top - SHELTER_FLOOR.thick / 2, 0] });
      for (const [dx, dz] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) b.add(shapes.cylinder(0.09, 0.11, 2.5, 7), 0x6a4428, { p: [dx, 1.25, dz] });
      b.add(shapes.box(2.9, 0.14, 0.14), 0x5a3a22, { p: [0, 2.45, -1.1] });
      b.add(shapes.box(2.9, 0.14, 0.14), 0x5a3a22, { p: [0, 2.45, 1.1] });
      b.add(shapes.cone(2.6, 1.5, 4), 0xc9a45a, { p: [0, 3.15, 0], r: [0, Math.PI / 4, 0], s: [1.1, 1, 0.95] });
      b.add(shapes.box(2.2, 0.1, 0.5), 0x7a5232, { p: [0, 0.48, -0.75] });
      for (const dx of [-0.95, 0.95]) b.add(shapes.box(0.1, 0.42, 0.42), 0x5a3a22, { p: [dx, 0.24, -0.75] });
    });
  }
  return b.mesh();
}

const COURT_TREAD = [0xb3ab99, 0xa49d8e];
const COURT_FILL = 4;

function courtMesh() {
  const b = new Batch();
  const base = courtBase();
  const width = COURT.halfU * 2;
  b.group([COURT.x, 0, COURT.z], [0, COURT.turn, 0], () => {
    const frontDepth = COURT.halfV - COURT.front;
    b.add(shapes.box(width, COURT_FILL, frontDepth), STONE.pad, { p: [0, base - COURT_FILL / 2, COURT.front + frontDepth / 2] });
    for (let k = 0; k < COURT.terraces; k++) {
      const top = base + COURT.rise * (k + 1);
      const height = top - (base - COURT_FILL);
      b.add(shapes.box(width, height, COURT.step), COURT_TREAD[k % 2], { p: [0, top - height / 2, COURT.front - COURT.step * (k + 0.5)] });
    }
  });
  return b.mesh();
}

function pagodaMeshes() {
  const { x, z, half } = PAGODA;
  const y = terrainHeight(x, z);
  const b = new Batch();
  b.add(shapes.box(half * 2 + 1.6, 1.4, half * 2 + 1.6), 0x8a8273, { p: [x, y - 0.35, z] });
  b.add(shapes.box(half * 2 + 1.2, 0.2, half * 2 + 1.2), 0xb3ab99, { p: [x, y + 0.45, z] });
  b.add(shapes.box(half * 2 - 0.8, 2.6, half * 2 - 0.8), 0xd9b46a, { p: [x, y + 1.85, z] });
  b.add(shapes.box(half * 2 - 0.7, 0.4, half * 2 - 0.7), 0x7d7266, { p: [x, y + 0.75, z] });
  const front = z + half - 0.4;
  b.add(shapes.box(1.3, 2.0, 0.06), 0x5a2418, { p: [x, y + 1.55, front + 0.01] });
  for (const dx of [-1.15, 1.15]) b.add(shapes.box(0.5, 1.4, 0.04), 0xb02e1f, { p: [x + dx, y + 1.9, front + 0.02] });
  for (const dx of [-half + 0.1, -0.9, 0.9, half - 0.1]) {
    b.add(shapes.cylinder(0.16, 0.18, 2.9, 10), 0x9a2e1e, { p: [x + dx, y + 1.95, z + half - 0.05] });
    b.add(shapes.cylinder(0.26, 0.3, 0.16, 10), 0xb3ab99, { p: [x + dx, y + 0.6, z + half - 0.05] });
  }
  b.add(shapes.box(half * 2 + 0.4, 0.3, 0.3), 0x4a2c1e, { p: [x, y + 3.35, z + half - 0.05] });
  b.add(shapes.box(half * 2 - 0.6, 1.1, half * 2 - 0.6), 0xd9b46a, { p: [x, y + 4.4, z] });
  const paved = y + COURTYARD.top;
  b.add(shapes.box(COURTYARD.half * 2, 0.12, COURTYARD.z1 - COURTYARD.z0), 0xb3ab99, { p: [x, paved - 0.06, z + (COURTYARD.z0 + COURTYARD.z1) / 2] });
  b.add(shapes.box(STAIRS.half * 2, 0.12, STAIRS.from - COURTYARD.z1), 0xa49d8e, { p: [x, paved - 0.06, z + (COURTYARD.z1 + STAIRS.from) / 2] });
  for (let i = 0; i < STAIRS.steps; i++) {
    const stepZ = z + STAIRS.from + (i + 0.5) * STAIRS.run;
    const top = y - (i + 1) * summit.rise;
    const bottom = Math.min(terrainHeight(x, stepZ), top - summit.rise) - 0.8;
    b.add(shapes.box(STAIRS.half * 2, top - bottom, STAIRS.run), i % 2 ? 0x9a9383 : 0xa49d8e, { p: [x, (top + bottom) / 2, stepZ] });
  }
  const body = b.mesh();
  const { urn } = PAGODA;
  const u = new Batch();
  u.add(shapes.box(0.7, 0.3, 0.7), 0x8a8273, { p: [urn.x, paved + 0.15, urn.z] });
  u.add(shapes.cylinder(0.32, 0.24, 0.5, 12), 0x8a6a3a, { p: [urn.x, paved + 0.55, urn.z] });
  u.add(shapes.torus(0.32, 0.04, 14), 0x6a4e2a, { p: [urn.x, paved + 0.8, urn.z], r: [Math.PI / 2, 0, 0] });
  for (const dx of [-0.06, 0, 0.06]) u.add(shapes.cylinder(0.008, 0.008, 0.4, 4), 0xc0281a, { p: [urn.x + dx, paved + 1.0, urn.z] });
  const incense = u.mesh();
  const lower = tileRoofMeshes({ cx: x, cz: z, hx: half + 1.0, hz: half + 1.0, ridge: 0.6, eaveY: y + 3.45, height: 1.1, lift: 0.5, falloff: 1.4 });
  const upper = tileRoofMeshes({ cx: x, cz: z, hx: half - 0.1, hz: half - 0.1, ridge: 0.3, eaveY: y + 4.9, height: 1.3, lift: 0.45, falloff: 1.1 });
  return { body, incense, meshes: [body, incense, ...lower, ...upper] };
}

function hermitageMeshes() {
  const { x, z, halfX, halfZ } = HERMITAGE;
  const y = terrainHeight(x, z);
  const b = new Batch();
  b.add(shapes.box(halfX * 2 + 0.4, 0.6, halfZ * 2 + 0.4), 0x8a8273, { p: [x, y - 0.1, z] });
  b.add(shapes.box(halfX * 2, 1.9, halfZ * 2), 0xd8c9a4, { p: [x, y + 1.15, z] });
  for (const dx of [-halfX, halfX]) {
    for (const dz of [-halfZ, halfZ]) b.add(shapes.box(0.18, 2.0, 0.18), 0x6a3a24, { p: [x + dx, y + 1.2, z + dz] });
  }
  b.add(shapes.box(halfX * 2 + 0.1, 0.16, 0.16), 0x5a3a22, { p: [x, y + 2.1, z + halfZ] });
  const front = z + halfZ + 0.01;
  b.add(shapes.box(0.8, 1.45, 0.05), 0x5a2418, { p: [x, y + 0.92, front] });
  b.add(shapes.box(0.92, 0.08, 0.07), 0x6a3a24, { p: [x, y + 1.66, front] });
  for (const dx of [-1.05, 1.05]) {
    b.add(shapes.box(0.5, 0.42, 0.05), 0x3a2a1e, { p: [x + dx, y + 1.3, front] });
    for (const bar of [-0.12, 0, 0.12]) b.add(shapes.box(0.04, 0.42, 0.07), 0x8a5a34, { p: [x + dx + bar, y + 1.3, front] });
  }
  b.add(shapes.box(1.2, 0.14, 0.5), 0x9a9383, { p: [x, y + 0.27, front + 0.25] });
  const body = b.mesh();
  const roof = tileRoofMeshes({ cx: x, cz: z, hx: halfX + 0.5, hz: halfZ + 0.5, ridge: 0.4, eaveY: y + 2.2, height: 0.9, lift: 0.3, falloff: 1.2 });
  return { body, meshes: [body, ...roof] };
}

export function nearShelter(x, z) {
  return SHELTERS.some((hut) => Math.hypot(hut.x - x, hut.z - z) < SHELTER_RADIUS);
}

function forestMeshes(trees) {
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.24, 1, 7).translate(0, 0.5, 0);
  const roundGeometry = new THREE.IcosahedronGeometry(1, 1);
  const pineGeometry = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0);
  const material = toonMaterial({ muted: true });
  const rounds = trees.filter((tree) => !tree.pine);
  const pines = trees.filter((tree) => tree.pine);
  const trunks = new THREE.InstancedMesh(trunkGeometry, toonMaterial({ muted: true, color: 0x6e5236 }), trees.length);
  const roundCrowns = new THREE.InstancedMesh(roundGeometry, material, Math.max(1, rounds.length));
  const pineCrowns = new THREE.InstancedMesh(pineGeometry, material.clone(), Math.max(1, pines.length * 2));
  trees.forEach((tree, i) => {
    const height = (tree.pine ? 2.2 : 2.6) * tree.scale;
    dummy.position.set(tree.x, tree.y - 0.15, tree.z);
    dummy.rotation.set(0, tree.turn, 0);
    dummy.scale.set(tree.scale, height, tree.scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
  });
  rounds.forEach((tree, i) => {
    dummy.position.set(tree.x, tree.y + 2.9 * tree.scale, tree.z);
    dummy.rotation.set(0, tree.turn, 0);
    dummy.scale.set(1.55 * tree.scale, 1.3 * tree.scale, 1.55 * tree.scale);
    dummy.updateMatrix();
    roundCrowns.setMatrixAt(i, dummy.matrix);
    roundCrowns.setColorAt(i, color.setHex(0x4f9e40).offsetHSL(tree.tint * 0.06 - 0.03, 0, tree.tint * 0.12 - 0.06));
  });
  pines.forEach((tree, i) => {
    for (let k = 0; k < 2; k++) {
      dummy.position.set(tree.x, tree.y + (1.2 + k * 1.25) * tree.scale, tree.z);
      dummy.rotation.set(0, tree.turn, 0);
      const s = (1.35 - k * 0.42) * tree.scale;
      dummy.scale.set(s, 2.1 * tree.scale, s);
      dummy.updateMatrix();
      pineCrowns.setMatrixAt(i * 2 + k, dummy.matrix);
      pineCrowns.setColorAt(i * 2 + k, color.setHex(0x3c7a3a).offsetHSL(tree.tint * 0.05 - 0.025, 0, tree.tint * 0.1 - 0.05 + k * 0.04));
    }
  });
  roundCrowns.count = rounds.length;
  pineCrowns.count = pines.length * 2;
  const meshes = [trunks, roundCrowns, pineCrowns];
  for (const mesh of meshes) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  return meshes;
}

function rockMesh(rocks) {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const mesh = new THREE.InstancedMesh(geometry, toonMaterial({ muted: true, color: 0x9a968c }), Math.max(1, rocks.length));
  const dummy = new THREE.Object3D();
  rocks.forEach((rock, i) => {
    dummy.position.set(rock.x, rock.y + rock.size * rock.squash * 0.35, rock.z);
    dummy.rotation.set(0, rock.turn, 0);
    dummy.scale.set(rock.size, rock.size * rock.squash, rock.size * 0.85);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.count = rocks.length;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function createMountainScenery() {
  const { trails, trees, rocks } = ensureLayout();
  const group = new THREE.Group();
  const ground = terrainMesh();
  const stream = streamMeshes();
  const pagoda = pagodaMeshes();
  const hermitage = hermitageMeshes();
  group.add(ground, ...trails.map(trailMesh), ...forestMeshes(trees), rockMesh(rocks), ...stream.meshes, bridgeMesh(), shelterMesh(), courtMesh(), ...pagoda.meshes, ...hermitage.meshes);
  return {
    group,
    ground,
    pagoda: pagoda.body,
    incense: pagoda.incense,
    hermitage: hermitage.body,
    update(dt) {
      stream.flow.offset.y -= dt * 0.6;
    },
  };
}
