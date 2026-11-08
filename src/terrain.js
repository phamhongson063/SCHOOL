import * as THREE from 'three';
import { Batch, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundColorAt, groundMaterial, groundTone, patchField, smoothstep, tileRoofMeshes, GROUND_LAYER } from './scenery.js';

export const MOUNTAIN = { x0: -152, z0: -146, x1: 84, z1: 22 };
const STEP = 1;
const MAX_SLOPE = 0.55;
const FLAT = 0.04;
const MESH_STEP = 2;
const SINK = -0.08;

const SPINE = [
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
export const PAGODA = { x: SUMMIT.x, z: SUMMIT.z, half: 2.4, stand: { x: SUMMIT.x, z: SUMMIT.z + 5.2 } };
export const SHELTERS = [
  { x: -57.9, z: -39.8, turn: 0.6 },
  { x: 24.8, z: -52.6, turn: -0.5 },
];
export const SHELTER_RADIUS = 3.2;

const TRAILS = [
  [
    [-50, 32.6],
    [-51, 18],
    [-56, 2],
    [-64, -14],
    [-55, -30],
    [-66, -46],
    [-56, -62],
    [-63, -74],
    [-56, -79],
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
  [-118, -30],
  [-115, -18],
  [-111, -4],
  [-109, 10],
  [-108, 24],
  [-108, 35],
  [-108.5, 48],
  [-107, 60],
  [-106, 71],
];
const STREAM_HALF = 1.1;
const BANK_HALF = 1.9;
export const BRIDGE = { x: -108, z0: 32.2, z1: 37.8, half: 2.3, deck: 0.16 };

const COLS = Math.round((MOUNTAIN.x1 - MOUNTAIN.x0) / STEP) + 1;
const ROWS = Math.round((MOUNTAIN.z1 - MOUNTAIN.z0) / STEP) + 1;

let heights = null;
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
  return grid;
}

export function terrainHeight(x, z) {
  if (x <= MOUNTAIN.x0 || x >= MOUNTAIN.x1 || z <= MOUNTAIN.z0 || z >= MOUNTAIN.z1) return 0;
  heights ??= buildHeights();
  const fx = (x - MOUNTAIN.x0) / STEP;
  const fz = (z - MOUNTAIN.z0) / STEP;
  const c = Math.min(COLS - 2, Math.floor(fx));
  const r = Math.min(ROWS - 2, Math.floor(fz));
  const tx = fx - c;
  const tz = fz - r;
  const n = r * COLS + c;
  const a = heights[n];
  const b = heights[n + 1];
  const d = heights[n + COLS];
  const e = heights[n + COLS + 1];
  return (a + (b - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
}

export function terrainFloor(x, z) {
  if (onBridge(x, z)) return BRIDGE.deck;
  const h = terrainHeight(x, z);
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

const onBridge = (x, z) => z > BRIDGE.z0 && z < BRIDGE.z1 && Math.abs(x - BRIDGE.x) < BRIDGE.half + 0.5;

export function inStream(x, z) {
  return !onBridge(x, z) && streamDistance(x, z) < STREAM_HALF + 0.25;
}

const BUCKET = 4;
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
    Math.hypot(x - SUMMIT.x, z - SUMMIT.z) > 8 &&
    streamDistance(x, z) > BANK_HALF + 1.2 &&
    SHELTERS.every((hut) => Math.hypot(x - hut.x, z - hut.z) > 4.5);
  const { half } = PAGODA;
  for (let px = -half; px <= half + 1e-6; px += 0.8) {
    for (let pz = -half; pz <= half + 1e-6; pz += 0.8) block(PAGODA.x + px, PAGODA.z + pz, 0.6);
  }
  block(PAGODA.x, PAGODA.stand.z - 1.4, 0.45);
  for (const hut of SHELTERS) {
    for (const [dx, dz] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) {
      const c = Math.cos(hut.turn);
      const sn = Math.sin(hut.turn);
      block(hut.x + dx * c + dz * sn, hut.z - dx * sn + dz * c, 0.22);
    }
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
    rocks.push({ x: px, z: pz, y: h, size, turn: rand() * Math.PI * 2, squash: 0.55 + rand() * 0.3 });
    block(px, pz, size * 0.85);
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
  if (onBridge(x, z)) return BRIDGE.deck;
  if (inStream(x, z)) return NaN;
  const h = terrainHeight(x, z);
  if (h <= FLAT) return null;
  return terrainBlocked(x, z) ? NaN : h;
}

function terrainMesh() {
  const cols = Math.round((MOUNTAIN.x1 - MOUNTAIN.x0) / MESH_STEP) + 1;
  const rows = Math.round((MOUNTAIN.z1 - MOUNTAIN.z0) / MESH_STEP) + 1;
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
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
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

function flowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4f9fc9';
  ctx.fillRect(0, 0, 64, 128);
  const rand = makeRandom(5151);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(230, 246, 255, ${0.18 + rand() * 0.25})`;
    ctx.fillRect(4 + rand() * 52, rand() * 128, 2 + rand() * 6, 6 + rand() * 16);
  }
  const texture = new THREE.CanvasTexture(canvas);
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
    if (Math.abs(z - (BRIDGE.z0 + BRIDGE.z1) / 2) < 5) continue;
    const side = rand() < 0.5 ? -1 : 1;
    const px = x + side * (STREAM_HALF + 0.35 + rand() * 0.4);
    const pz = z + (rand() - 0.5) * 0.6;
    const size = 0.22 + rand() * 0.3;
    b.add(shapes.ico(size, 0), 0x9a968c, { p: [px, terrainHeight(px, pz) + size * 0.35, pz], s: [1, 0.6, 1.2], flat: true });
  }
  const pebbles = b.mesh();
  return { meshes: [bank, water, pebbles], flow };
}

function bridgeMesh() {
  const b = new Batch();
  const { x, z0, z1, half } = BRIDGE;
  const length = z1 - z0;
  b.add(shapes.box(half * 2, BRIDGE.deck, length), 0xb3ab99, { p: [x, BRIDGE.deck / 2, (z0 + z1) / 2] });
  b.add(shapes.box(half * 2 + 0.2, 0.08, length + 0.1), 0x8a8273, { p: [x, 0.02, (z0 + z1) / 2] });
  for (const z of [z0 - 0.1, z1 + 0.1]) {
    b.add(shapes.box(half * 2 + 0.6, 0.12, 0.26), 0x9e9484, { p: [x, 0.78, z] });
    for (const dx of [-half - 0.2, -half / 2, 0, half / 2, half + 0.2]) b.add(shapes.box(0.24, 0.7, 0.24), 0xb3ab99, { p: [x + dx, 0.4, z] });
  }
  const mesh = b.mesh();
  mesh.renderOrder = GROUND_LAYER.mark + 2;
  return mesh;
}

function shelterMesh() {
  const b = new Batch();
  for (const hut of SHELTERS) {
    const y = terrainHeight(hut.x, hut.z);
    b.group([hut.x, y, hut.z], [0, hut.turn, 0], () => {
      b.add(shapes.box(3.2, 0.2, 2.8), 0x8a6a48, { p: [0, 0.05, 0] });
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
  const urn = { x, z: PAGODA.stand.z - 1.4 };
  b.add(shapes.cylinder(0.32, 0.24, 0.5, 12), 0x8a6a3a, { p: [urn.x, y + 0.85, urn.z] });
  b.add(shapes.torus(0.32, 0.04, 14), 0x6a4e2a, { p: [urn.x, y + 1.1, urn.z], r: [Math.PI / 2, 0, 0] });
  for (const dx of [-0.06, 0, 0.06]) b.add(shapes.cylinder(0.008, 0.008, 0.4, 4), 0xc0281a, { p: [urn.x + dx, y + 1.3, urn.z] });
  const body = b.mesh();
  const lower = tileRoofMeshes({ cx: x, cz: z, hx: half + 1.0, hz: half + 1.0, ridge: 0.6, eaveY: y + 3.45, height: 1.1, lift: 0.5, falloff: 1.4 });
  const upper = tileRoofMeshes({ cx: x, cz: z, hx: half - 0.1, hz: half - 0.1, ridge: 0.3, eaveY: y + 4.9, height: 1.3, lift: 0.45, falloff: 1.1 });
  return { body, meshes: [body, ...lower, ...upper] };
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
  const material = toonMaterial({ flatShading: true });
  const rounds = trees.filter((tree) => !tree.pine);
  const pines = trees.filter((tree) => tree.pine);
  const trunks = new THREE.InstancedMesh(trunkGeometry, toonMaterial({ color: 0x6e5236 }), trees.length);
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
  const mesh = new THREE.InstancedMesh(geometry, toonMaterial({ color: 0x9a968c, flatShading: true }), Math.max(1, rocks.length));
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
  group.add(ground, ...trails.map(trailMesh), ...forestMeshes(trees), rockMesh(rocks), ...stream.meshes, bridgeMesh(), shelterMesh(), ...pagoda.meshes);
  return {
    group,
    ground,
    pagoda: pagoda.body,
    update(dt) {
      stream.flow.offset.y -= dt * 0.6;
    },
  };
}
