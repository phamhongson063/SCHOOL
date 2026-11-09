import * as THREE from 'three';
import { shapes } from './toon.js';
import { makeRandom } from './random.js';

export const RIPE = 6;
export const SPENT = 7;

const C = {
  mound: 0x6b4428,
  seed: 0xf2e4b8,
  stem: 0x4f8a2f,
  leaf: 0x5fae48,
  leafDark: 0x3f8a3a,
  leafLight: 0x86c75a,
  withered: 0xb5ad48,
  dry: 0x9a7a3c,
  flower: 0xf5d547,
  pollen: 0xe8902a,
  unripe: 0x9ccc5a,
  ripe: 0xe23b2a,
  ripeLight: 0xf0603a,
  stake: 0xd8b56a,
  tie: 0xb08a40,
  stalk: 0x6fa83a,
  stalkRipe: 0x9fae4a,
  stalkDry: 0xb89a5a,
  tassel: 0xd8c27a,
  tasselDry: 0x9a7a4a,
  husk: 0x7fb84a,
  huskRipe: 0xd9c27a,
  silk: 0xc98a5a,
  silkDry: 0x8a5a3a,
  kernel: 0xf2c94c,
  vine: 0x5a8f34,
  melonDark: 0x24502a,
  melonMid: 0x4f7a34,
  melonLight: 0x9cc25e,
  melonSpot: 0xd2cf86,
  melonYoungDark: 0x4f8a3a,
  melonYoungLight: 0xa8d36e,
  melonStem: 0x7a8a3a,
  potatoLeaf: 0x4f8a3a,
  potatoLeafLight: 0x6aa242,
  potatoLeafPurple: 0x6a5a5a,
  potatoFlower: 0xc9a0dc,
  potatoSkin: 0xa23a5a,
  spinachStem: 0x7fbf4a,
  spinachLeaf: 0x3f9a3a,
  spinachLeafLight: 0x6cc04e,
  choyStalk: 0xe8f2d4,
  choyStalkShade: 0xc8e0a8,
  choyLeaf: 0x2f7a32,
  choyLeafLight: 0x4f9a3e,
};

export function mound(b, rand, seeds = 0) {
  b.add(shapes.sphere(0.17, 12, 6), C.mound, { p: [0, -0.02, 0], s: [1, 0.4, 1] });
  for (let i = 0; i < seeds; i++) {
    const a = rand() * Math.PI * 2;
    b.add(shapes.sphere(0.022, 6, 4), C.seed, { p: [Math.cos(a) * 0.06, 0.045, Math.sin(a) * 0.06], s: [1, 0.6, 1.4] });
  }
}

function stake(b, height) {
  b.limb([0.14, -0.05, 0.06], [0.14, height, 0.06], 0.022, C.stake, { capsule: false, seg: 6 });
  for (let y = 0.25; y < height - 0.1; y += 0.55) {
    b.add(shapes.torus(0.075, 0.01, 8), C.tie, { p: [0.07, y, 0.03], r: [Math.PI / 2, 0, 0.4] });
  }
}

function stem(b, height) {
  const points = [[0, 0, 0], [0.035, height * 0.35, -0.02], [-0.025, height * 0.7, 0.03], [0.01, height, 0]];
  for (let i = 0; i < 3; i++) {
    b.limb(points[i], points[i + 1], 0.03 - i * 0.006, C.stem, { capsule: false, seg: 6, radiusEnd: 0.024 - i * 0.006 });
  }
}

function bush(b, rand, { height, leaves, size, flowers = 0, fruits = 0, fruitColors = [], fruitSize = 0.07, leafColors = [C.leaf, C.leafDark, C.leafLight] }) {
  stake(b, height + 0.25);
  stem(b, height);
  for (let i = 0; i < leaves; i++) {
    const t = (i + 0.6) / leaves;
    const a = i * 2.4 + rand() * 0.6;
    const r = size * (1.1 - t * 0.35);
    b.add(shapes.ico(size * (1.05 - t * 0.3), 0), leafColors[i % leafColors.length], {
      p: [Math.cos(a) * r, height * (0.18 + t * 0.82), Math.sin(a) * r],
      s: [1.25, 0.5, 1.25],
      r: [0, rand() * Math.PI, 0],
      flat: true,
    });
  }
  for (let i = 0; i < fruits; i++) {
    const a = i * 2.1 + rand() * 0.8;
    const r = size * (1.05 + rand() * 0.4);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = height * (0.25 + rand() * 0.6);
    b.add(shapes.sphere(fruitSize, 8, 6), fruitColors[i % fruitColors.length], { p: [x, y, z], s: [1, 0.88, 1] });
    b.add(shapes.cone(fruitSize * 0.45, fruitSize * 0.35, 5), C.stem, { p: [x, y + fruitSize * 0.85, z], flat: true });
  }
  for (let i = 0; i < flowers; i++) {
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * size * 1.15;
    const z = Math.sin(a) * size * 1.15;
    const y = height * (0.55 + rand() * 0.4);
    b.add(shapes.cone(0.045, 0.04, 5), C.flower, { p: [x, y, z], r: [Math.PI, 0, 0], flat: true });
    b.add(shapes.sphere(0.016, 6, 4), C.pollen, { p: [x, y - 0.022, z] });
  }
}

function tomatoPlant(b, stage, variety) {
  const height = CROPS.tomato.stageHeight(stage, variety.height);
  const rand = makeRandom(variety.seed + (stage >= 5 ? 0 : stage));
  const shape = { height, leaves: Math.round(4 + height * 5), size: 0.11 + Math.min(height, 2) * 0.03 };
  mound(b, rand);
  if (stage === 3) bush(b, rand, shape);
  if (stage === 4) bush(b, rand, { ...shape, flowers: Math.round(3 + height * 2) });
  if (stage === 5) bush(b, rand, { ...shape, fruits: variety.fruits, fruitColors: [C.unripe, C.leafLight], fruitSize: 0.075, flowers: 2 });
  if (stage === RIPE) bush(b, rand, { ...shape, fruits: variety.fruits, fruitColors: [C.ripe, C.ripeLight, C.ripe], fruitSize: 0.095 });
  if (stage === SPENT) bush(b, rand, { ...shape, leafColors: [C.leafDark, C.withered, C.dry, C.withered] });
}

function strapLeaf(b, from, yaw, length, width, lift, droop, color) {
  const segments = 4;
  const step = length / segments;
  const side = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
  const point = new THREE.Vector3(...from);
  const next = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  let pitch = lift;
  for (let i = 0; i < segments; i++) {
    const reach = Math.cos(pitch) * step;
    next.set(point.x + Math.cos(yaw) * reach, point.y + Math.sin(pitch) * step, point.z + Math.sin(yaw) * reach);
    dir.subVectors(next, point).normalize();
    normal.crossVectors(side, dir).normalize();
    basis.makeBasis(side, dir, normal);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis);
    const w = width * (1 - (i / segments) * 0.75);
    b.add(shapes.box(w, step * 1.08, 0.008), color, { p: [(point.x + next.x) / 2, (point.y + next.y) / 2, (point.z + next.z) / 2], q });
    point.copy(next);
    pitch -= droop;
  }
}

function cornStalk(b, rand, stage, { dx, dz, scale, ears, lean, yaw }, height) {
  const h = height * scale;
  const spent = stage === SPENT;
  const stalkColor = spent ? C.stalkDry : stage === RIPE ? C.stalkRipe : C.stalk;
  const leafColors = spent ? [C.dry, C.stalkDry, C.tasselDry] : stage === RIPE ? [C.leafDark, C.withered, C.leaf] : [C.leaf, C.leafDark, C.leafLight];
  const top = [dx + lean[0] * h, h, dz + lean[1] * h];
  const at = (t) => [dx + (top[0] - dx) * t, h * t, dz + (top[2] - dz) * t];
  b.limb([dx, 0, dz], top, Math.min(0.045, 0.022 + h * 0.004), stalkColor, { capsule: false, seg: 6, radiusEnd: 0.016 });
  const leaves = Math.min(14, Math.round(3 + h * 1.8));
  const span = Math.min(1.2, 0.45 + Math.sqrt(h) * 0.25);
  for (let i = 0; i < leaves; i++) {
    const t = 0.12 + ((i + 0.5) / leaves) * 0.78;
    const side = yaw + (i % 2) * Math.PI + (rand() - 0.5) * 0.7;
    const length = span * (0.7 + 0.5 * Math.sin(Math.PI * t));
    strapLeaf(b, at(t), side, length, 0.075, spent ? 0.5 : 0.85, spent ? 0.5 : 0.32 + rand() * 0.12, leafColors[i % leafColors.length]);
  }
  if (stage >= 4) {
    const tassel = spent ? C.tasselDry : C.tassel;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand();
      const tip = [top[0] + Math.cos(a) * 0.12, top[1] + 0.18 + rand() * 0.06, top[2] + Math.sin(a) * 0.12];
      b.limb(top, tip, 0.008, tassel, { capsule: false, seg: 4, radiusEnd: 0.004 });
    }
    b.limb(top, [top[0], top[1] + 0.28, top[2]], 0.01, tassel, { capsule: false, seg: 4, radiusEnd: 0.004 });
  }
  if (stage !== 5 && stage !== RIPE) return;
  for (let j = 0; j < ears; j++) {
    const t = 0.38 + j * 0.13;
    const base = at(t);
    const a = yaw + Math.PI / 2 + j * Math.PI + (rand() - 0.5) * 0.5;
    const out = [base[0] + Math.cos(a) * 0.09, base[1] + 0.2, base[2] + Math.sin(a) * 0.09];
    const root = [base[0] + Math.cos(a) * 0.03, base[1] + 0.02, base[2] + Math.sin(a) * 0.03];
    if (stage === 5) {
      b.limb(root, out, 0.042, C.husk, { seg: 8 });
      b.limb(out, [out[0] + Math.cos(a) * 0.03, out[1] + 0.07, out[2] + Math.sin(a) * 0.03], 0.016, C.silk, { capsule: false, seg: 5, radiusEnd: 0.004 });
    } else {
      b.limb(root, out, 0.048, C.huskRipe, { seg: 8 });
      const cobTip = [out[0] + Math.cos(a) * 0.035, out[1] + 0.08, out[2] + Math.sin(a) * 0.035];
      b.limb([(root[0] + out[0]) / 2, (root[1] + out[1]) / 2, (root[2] + out[2]) / 2], cobTip, 0.04, C.kernel, { seg: 8 });
      b.limb(cobTip, [cobTip[0], cobTip[1] + 0.05, cobTip[2]], 0.012, C.silkDry, { capsule: false, seg: 4, radiusEnd: 0.003 });
    }
  }
}

function cornPlant(b, stage, variety) {
  const rand = makeRandom(variety.seed + (stage >= 5 ? 0 : stage));
  const height = CROPS.corn.stageHeight(stage, variety.height);
  mound(b, rand);
  for (const stalk of variety.stalks) cornStalk(b, rand, stage, stalk, height);
}

export function melonSkin({ dark = C.melonDark, mid = C.melonMid, light = C.melonLight, spot = C.melonSpot, bands = 15 } = {}) {
  return (x, y, z) => {
    const r = Math.hypot(x, y, z) || 1;
    const lat = y / r;
    const u = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * bands;
    const lane = Math.floor(u);
    const wobble = Math.sin(lat * 13 + lane * 1.7) * 0.16 + Math.sin(lat * 37 + lane * 2.3) * 0.07;
    const edge = Math.abs(u + wobble - lane - 0.5);
    const width = 0.15 + 0.04 * Math.sin(lane * 2.1);
    if (spot && lat < -0.82) return spot;
    if (edge < width) return dark;
    if (edge < width + 0.07) return mid;
    return light;
  };
}

export function watermelon(b, r, at, { young = false, turn = 0 } = {}) {
  const skin = young ? melonSkin({ dark: C.melonYoungDark, mid: C.melonYoungDark, light: C.melonYoungLight, spot: null, bands: 11 }) : melonSkin();
  b.add(shapes.sphere(r, 44, 22), 0, { p: at, s: [1.03, 0.94, 1], r: [0, turn, 0], paint: skin });
  const top = [at[0], at[1] + r * 0.92, at[2]];
  b.limb(top, [top[0] + r * 0.12, top[1] + r * 0.22, top[2] + r * 0.06], r * 0.07, C.melonStem, { capsule: false, seg: 6, radiusEnd: r * 0.04 });
  b.limb([top[0] + r * 0.12, top[1] + r * 0.22, top[2] + r * 0.06], [top[0] + r * 0.32, top[1] + r * 0.3, top[2] + r * 0.12], r * 0.04, C.vine, { capsule: false, seg: 5, radiusEnd: r * 0.03 });
}

const SURFACE = [
  [0, 0],
  [0.19, -0.015],
  [0.31, -0.055],
  [0.4, -0.15],
  [0.47, -0.225],
  [9, -0.225],
];

function surface(x) {
  const ax = Math.abs(x);
  for (let i = 1; i < SURFACE.length; i++) {
    const [x1, y1] = SURFACE[i];
    if (ax > x1) continue;
    const [x0, y0] = SURFACE[i - 1];
    return y0 + ((ax - x0) / (x1 - x0)) * (y1 - y0);
  }
  return SURFACE[SURFACE.length - 1][1];
}

function hash(a, b) {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function runner(b, { angle, length, wiggle }, grow, colors, density, id) {
  const reach = length * grow;
  if (reach < 0.05) return [];
  const steps = Math.max(3, Math.round(reach / 0.18));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bend = Math.sin(t * 3.2 + wiggle) * 0.18 * t;
    const x = Math.sin(angle) * reach * t + Math.cos(angle) * bend;
    const z = Math.cos(angle) * reach * t - Math.sin(angle) * bend;
    points.push([x, surface(x) + 0.022, z]);
  }
  for (let i = 0; i < steps; i++) b.limb(points[i], points[i + 1], 0.011, colors.stem, { capsule: false, seg: 5 });
  const leaves = Math.max(2, Math.round(reach * density));
  for (let k = 1; k <= leaves; k++) {
    const t = k / (leaves + 0.5);
    const at = points[Math.min(steps, Math.round(t * steps))];
    const side = k % 2 ? 1 : -1;
    const jitter = hash(id, k);
    const x = at[0] + Math.cos(angle) * side * 0.06;
    const z = at[2] - Math.sin(angle) * side * 0.06;
    b.add(shapes.ico(0.075 + jitter * 0.035, 0), colors.leaves[k % colors.leaves.length], {
      p: [x, surface(x) + 0.05 + jitter * 0.04, z],
      s: [1.3, 0.33, 1.1],
      r: [0, angle + jitter * 2, 0],
      flat: true,
    });
  }
  return points;
}

function watermelonPlant(b, stage, variety) {
  const extras = makeRandom(variety.seed + 1);
  const height = CROPS.watermelon.stageHeight(stage, variety.height);
  const spent = stage === SPENT;
  const grow = [0, 0, 0, 0.18, 0.6, 0.88, 1, 1][stage];
  const colors = spent
    ? { stem: C.stalkDry, leaves: [C.withered, C.dry, C.stalkDry] }
    : { stem: C.vine, leaves: [C.leaf, C.leafDark, C.leafLight] };
  mound(b, extras);
  const mains = variety.runners.map((spec, i) => runner(b, spec, grow, colors, 6, variety.seed + i));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + hash(variety.seed, i);
    b.add(shapes.ico(0.1, 0), colors.leaves[i % colors.leaves.length], {
      p: [Math.cos(a) * 0.08, height * (0.55 + hash(i, variety.seed) * 0.4), Math.sin(a) * 0.08],
      s: [1.3, 0.4, 1.2],
      r: [0, a, 0],
      flat: true,
    });
  }
  if (stage === 4 || stage === 5) {
    for (let i = 0; i < 5; i++) {
      const path = mains[i % 2];
      const at = path[Math.floor(path.length * (0.3 + extras() * 0.6))];
      if (at) b.add(shapes.cone(0.04, 0.035, 5), C.flower, { p: [at[0], at[1] + 0.07, at[2]], r: [Math.PI, 0, 0], flat: true });
    }
  }
  if (stage !== 5 && stage !== RIPE) return;
  const ripe = stage === RIPE;
  const fruitRand = makeRandom(variety.seed + 2);
  for (let i = 0; i < variety.fruits; i++) {
    const path = mains[i % 2];
    const at = path[Math.floor(path.length * (0.35 + fruitRand() * 0.45))];
    if (!at) continue;
    const r = ripe ? variety.size * (0.85 + fruitRand() * 0.2) : 0.065 + fruitRand() * 0.02;
    const x = Math.max(-0.12, Math.min(0.12, at[0]));
    watermelon(b, r, [x, surface(x) + r * 0.9, at[2]], { young: !ripe, turn: fruitRand() * Math.PI * 2 });
  }
}

function sweetPotatoPlant(b, stage, variety) {
  const extras = makeRandom(variety.seed + 1);
  const height = CROPS.sweetPotato.stageHeight(stage, variety.height);
  const spent = stage === SPENT;
  const grow = [0, 0, 0, 0.25, 0.6, 0.85, 1, 0.95][stage];
  const palette = spent
    ? [C.withered, C.dry, C.stalkDry]
    : stage === RIPE
      ? [C.potatoLeaf, C.withered, C.potatoLeafPurple, C.potatoLeafLight]
      : [C.potatoLeaf, C.potatoLeafLight, C.potatoLeafPurple];
  const colors = { stem: spent ? C.stalkDry : C.potatoLeafPurple, leaves: palette };
  mound(b, extras);
  const paths = variety.runners.map((spec, i) => runner(b, spec, grow, colors, 8, variety.seed + i));
  const dome = stage === 3 ? 6 : Math.round(10 * grow);
  for (let i = 0; i < dome; i++) {
    const r = 0.2 * Math.sqrt(hash(variety.seed, i));
    const a = hash(i, variety.seed) * Math.PI * 2;
    const y = 0.04 + (1 - r / 0.2) * height * (spent ? 0.4 : 0.85);
    b.add(shapes.ico(0.08 + hash(i, i) * 0.03, 0), palette[i % palette.length], {
      p: [Math.cos(a) * r, y, Math.sin(a) * r],
      s: [1.25, 0.3, 1.1],
      r: [(hash(a, i) - 0.5) * 0.6, a, 0],
      flat: true,
    });
  }
  if (stage === 4 || stage === 5) {
    for (let i = 0; i < 5; i++) {
      const path = paths[i % paths.length];
      const at = path[Math.floor(path.length * (0.25 + extras() * 0.6))];
      if (!at) continue;
      b.add(shapes.cone(0.04, 0.06, 6), C.potatoFlower, { p: [at[0], at[1] + 0.11, at[2]], r: [Math.PI, 0, 0], flat: true });
      b.add(shapes.sphere(0.012, 6, 4), 0xffffff, { p: [at[0], at[1] + 0.085, at[2]] });
    }
  }
  if (stage === RIPE) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + hash(variety.seed, i + 9);
      const x = Math.cos(a) * 0.16;
      b.add(shapes.sphere(0.06, 10, 8), C.potatoSkin, { p: [x, surface(x) + 0.015, Math.sin(a) * 0.24], s: [0.75, 0.55, 1.3], r: [0, a, 0] });
    }
  }
}

const UP = new THREE.Vector3(0, 1, 0);

function towards(dir) {
  return new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
}

function waterSpinachPlant(b, stage, variety) {
  const rand = makeRandom(variety.seed + (stage >= 5 ? 0 : stage));
  const spent = stage === SPENT;
  const grow = [0, 0, 0, 0.3, 0.55, 0.8, 1, 0.22][stage];
  mound(b, rand);
  const shoots = spent ? variety.shoots : Math.max(3, Math.round(variety.shoots * (0.4 + grow * 0.6)));
  const leaves = [C.spinachLeaf, C.spinachLeafLight, C.leafDark];
  for (let i = 0; i < shoots; i++) {
    const a = (i / shoots) * Math.PI * 2 + rand() * 0.6;
    const lean = 0.18 + rand() * 0.32;
    const h = variety.height * grow * (0.75 + rand() * 0.35);
    const base = new THREE.Vector3(Math.cos(a) * 0.035, 0.02, Math.sin(a) * 0.035);
    const tip = new THREE.Vector3(Math.cos(a) * lean * h + base.x, h, Math.sin(a) * lean * h + base.z);
    b.limb(base.toArray(), tip.toArray(), spent ? 0.014 : 0.011, spent ? C.stalkDry : C.spinachStem, { capsule: false, seg: 5 });
    if (spent) {
      b.add(shapes.cylinder(0.016, 0.016, 0.01, 5), C.spinachStem, { p: [tip.x, tip.y, tip.z] });
      continue;
    }
    const count = Math.max(1, Math.round(1 + grow * 4));
    for (let k = 0; k < count; k++) {
      const t = 0.4 + (k / count) * 0.6;
      const at = base.clone().lerp(tip, t);
      const side = a + (k % 2 ? 1 : -1) * (0.9 + rand() * 0.4);
      const dir = new THREE.Vector3(Math.cos(side) * 0.75, 0.6 + rand() * 0.3, Math.sin(side) * 0.75);
      const length = 0.09 + grow * 0.07;
      const center = at.clone().addScaledVector(dir.clone().normalize(), length * 0.5);
      b.add(shapes.ico(length * 0.5, 0), leaves[(i + k) % leaves.length], { p: center.toArray(), q: towards(dir), s: [0.42, 1, 0.16], flat: true });
    }
    const crown = tip.clone();
    b.add(shapes.ico(0.035 + grow * 0.02, 0), C.spinachLeafLight, { p: crown.toArray(), s: [0.6, 1.2, 0.4], r: [0, a, 0], flat: true });
  }
}

function bokChoyPlant(b, stage, variety) {
  const rand = makeRandom(variety.seed + (stage >= 5 ? 0 : stage));
  const spent = stage === SPENT;
  const grow = [0, 0, 0, 0.35, 0.6, 0.85, 1, 0.7][stage];
  mound(b, rand);
  const count = spent ? 5 : Math.round(4 + grow * (variety.leaves - 4));
  const h = variety.height * grow;
  const stalk = spent ? C.withered : C.choyStalk;
  const blades = spent ? [C.withered, C.dry, C.stalkDry] : [C.choyLeaf, C.choyLeafLight, C.choyLeaf];
  for (let i = 0; i < count; i++) {
    const a = i * 2.4 + rand() * 0.3;
    const inner = i / count;
    const tilt = spent ? 0.9 + rand() * 0.4 : 0.18 + (1 - inner) * 0.5;
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt));
    const length = Math.max(0.08, h * (0.75 + (1 - inner) * 0.35));
    const neck = dir.clone().multiplyScalar(length * 0.5).add(new THREE.Vector3(0, 0.02, 0));
    b.limb([0, 0.02, 0], neck.toArray(), 0.022 + grow * 0.008, i % 2 ? stalk : spent ? C.dry : C.choyStalkShade, { capsule: false, seg: 6, radiusEnd: 0.016 });
    const width = 0.05 + grow * 0.05;
    const blade = dir.clone().multiplyScalar(length * 0.78).add(new THREE.Vector3(0, 0.02, 0));
    b.add(shapes.ico(width, 1), blades[i % blades.length], { p: blade.toArray(), q: towards(dir), s: [0.85, length / (width * 1.6), 0.3], flat: true });
  }
}

function tomatoVarieties() {
  const rand = makeRandom(4040);
  const count = 10;
  return Array.from({ length: count }, (_, i) => {
    const height = 1 + (2 * i) / (count - 1) + (rand() - 0.5) * 0.15;
    return { height, fruits: Math.round(4 + (height - 1) * 4 + rand() * 6), seed: 500 + i * 7 };
  });
}

function cornVarieties() {
  const rand = makeRandom(5150);
  const count = 8;
  return Array.from({ length: count }, (_, i) => {
    const height = 1.4 + 1.8 * Math.pow(i / (count - 1), 1.4) + (rand() - 0.5) * 0.12;
    const clump = 2 + (rand() < 0.5 ? 1 : 0);
    const stalks = Array.from({ length: clump }, (_, k) => {
      const a = (k / clump) * Math.PI * 2 + rand();
      return {
        dx: Math.cos(a) * 0.12,
        dz: Math.sin(a) * 0.12,
        scale: 0.88 + rand() * 0.16,
        ears: 1 + (rand() < 0.45 ? 1 : 0),
        lean: [(rand() - 0.5) * 0.05, (rand() - 0.5) * 0.05],
        yaw: rand() * Math.PI,
      };
    });
    return { height, stalks, fruits: stalks.reduce((sum, stalk) => sum + stalk.ears, 0), seed: 900 + i * 11 };
  });
}

function watermelonVarieties() {
  const rand = makeRandom(6161);
  return Array.from({ length: 6 }, (_, i) => {
    const main = 0.9 + rand() * 1.0;
    const runners = [
      { angle: (rand() - 0.5) * 0.25, length: main * (0.85 + rand() * 0.3), wiggle: rand() * 6 },
      { angle: Math.PI + (rand() - 0.5) * 0.25, length: main * (0.85 + rand() * 0.3), wiggle: rand() * 6 },
    ];
    const sides = Math.floor(rand() * 3);
    for (let k = 0; k < sides; k++) {
      const side = rand() < 0.5 ? -1 : 1;
      runners.push({ angle: side * (1 + rand() * 0.7) + (rand() < 0.5 ? 0 : Math.PI), length: 0.5 + rand() * 0.6, wiggle: rand() * 6 });
    }
    return {
      height: 0.24 + rand() * 0.08,
      runners,
      size: 0.16 + rand() * 0.06,
      fruits: 1 + Math.floor(rand() * 3),
      seed: 1300 + i * 17,
    };
  });
}

function waterSpinachVarieties() {
  const rand = makeRandom(8383);
  return Array.from({ length: 5 }, (_, i) => ({
    height: 0.34 + rand() * 0.14,
    shoots: 7 + Math.floor(rand() * 4),
    fruits: 2 + Math.floor(rand() * 3),
    seed: 2100 + i * 23,
  }));
}

function bokChoyVarieties() {
  const rand = makeRandom(9494);
  return Array.from({ length: 5 }, (_, i) => ({
    height: 0.3 + rand() * 0.1,
    leaves: 9 + Math.floor(rand() * 4),
    fruits: 2 + Math.floor(rand() * 3),
    seed: 2500 + i * 29,
  }));
}

function sweetPotatoVarieties() {
  const rand = makeRandom(7272);
  return Array.from({ length: 6 }, (_, i) => {
    const spread = 0.5 + rand() * 0.6;
    const count = 4 + Math.floor(rand() * 4);
    const runners = Array.from({ length: count }, (_, k) => ({
      angle: (k / count) * Math.PI * 2 + (rand() - 0.5) * 0.6,
      length: spread * (0.7 + rand() * 0.5),
      wiggle: rand() * 6,
    }));
    return {
      height: 0.28 + rand() * 0.12,
      runners,
      fruits: 3 + Math.floor(rand() * 6),
      seed: 1700 + i * 19,
    };
  });
}

export const STAGE_NAMES = ['Đất trống', 'Hạt giống', 'Nảy mầm', 'Cây non', 'Ra hoa', 'Quả xanh', 'Quả chín', 'Đã hái'];

export const CROPS = {
  waterSpinach: {
    icon: '🌿',
    name: 'Rau muống',
    seedName: 'Hạt rau muống',
    unit: 'bó',
    stages: { 3: 'Cây con', 4: 'Bén rễ', 5: 'Ra ngọn', 6: 'Đủ lứa cắt', 7: 'Đã cắt' },
    varieties: waterSpinachVarieties(),
    crown: 0.08,
    stageHeight: (stage, height) => [0, 0.12, 0.2, height * 0.3, height * 0.55, height * 0.8, height, height * 0.22][stage],
    build: waterSpinachPlant,
  },
  bokChoy: {
    icon: '🥬',
    name: 'Cải ngọt',
    seedName: 'Hạt cải ngọt',
    unit: 'bó',
    stages: { 3: 'Cây con', 4: 'Ra lá', 5: 'Cuốn bẹ', 6: 'Đủ lứa thu', 7: 'Đã nhổ' },
    varieties: bokChoyVarieties(),
    crown: 0.06,
    stageHeight: (stage, height) => [0, 0.12, 0.2, height * 0.35, height * 0.6, height * 0.85, height, height * 0.5][stage],
    build: bokChoyPlant,
  },
  tomato: {
    icon: '🍅',
    name: 'Cà chua',
    seedName: 'Hạt cà chua',
    unit: 'quả',
    varieties: tomatoVarieties(),
    crown: 0.25,
    stageHeight: (stage, height) => [0, 0.12, 0.3, Math.max(0.4, height * 0.3), height * 0.72, height, height, height * 0.96][stage],
    build: tomatoPlant,
  },
  corn: {
    icon: '🌽',
    name: 'Bắp',
    seedName: 'Hạt bắp',
    unit: 'trái',
    stages: { 4: 'Trổ cờ', 5: 'Bắp non', 6: 'Bắp chín' },
    varieties: cornVarieties(),
    crown: 0.3,
    stageHeight: (stage, height) => [0, 0.12, 0.3, Math.max(0.5, height * 0.3), height * 0.85, height, height, height * 0.95][stage],
    build: cornPlant,
  },
  watermelon: {
    icon: '🍉',
    name: 'Dưa hấu',
    seedName: 'Hạt dưa hấu',
    unit: 'quả',
    stages: { 5: 'Trái non', 6: 'Trái chín' },
    varieties: watermelonVarieties(),
    crown: 0.15,
    aligned: true,
    stageHeight: (stage, height) => [0, 0.12, 0.3, 0.15, height * 0.8, height, height, height * 0.7][stage],
    build: watermelonPlant,
  },
  sweetPotato: {
    icon: '🍠',
    name: 'Khoai lang',
    seedName: 'Dây khoai lang',
    unit: 'củ',
    stages: { 4: 'Ra hoa', 5: 'Ra củ', 6: 'Củ già', 7: 'Đã đào' },
    varieties: sweetPotatoVarieties(),
    crown: 0.15,
    aligned: true,
    harvest: 'dig',
    stageHeight: (stage, height) => [0, 0.12, 0.3, 0.15, height * 0.75, height, height, height * 0.6][stage],
    build: sweetPotatoPlant,
  },
};

export function stageName(crop, stage) {
  return CROPS[crop]?.stages?.[stage] ?? STAGE_NAMES[stage];
}
