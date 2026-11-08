import * as THREE from 'three';
import { Batch, freeze, shapes, shade, toonMaterial } from './toon.js';
import { lantern, textBoard } from './props.js';
import { plasterMaterial, texturedBox } from './architecture.js';
import { tileRoofMeshes } from './scenery.js';
import { createLanternGlow } from './lanternGlow.js';

export const INN = { x: -41, z: 25, width: 9.2, depth: 7.2 };
export const INN_STAND = { x: INN.x, z: INN.z + INN.depth / 2 + 2.6 };
export const INN_DOOR = { x: INN.x, z: INN.z + INN.depth / 2 };

const STONE = 0xb3ab99;
const WOOD = 0x6a3f24;
const WOOD_DARK = 0x45281a;
const WALL = 0xe6d2a8;
const RAIL = 0x8a2a1c;
const GREEN = 0x3f7a4a;
const PAPER = 0xf3e6c4;
const TILE = 0x7a4630;
const TILE_DARK = 0x5a3222;

const BASE = 0.3;
const GROUND_H = 3.0;
const BEAM = 0.25;
const UPPER_H = 2.6;
const T = 0.2;
const BALCONY = 1.1;
const PENT = 1.0;
const PENT_DROP = 0.55;
const WING = { width: 3.0, depth: 4.2, height: 2.6 };

function slope(b, { from, to, width, along }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const run = Math.hypot(dx, dz);
  const length = Math.hypot(run, dy);
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  const tilt = Math.atan2(dy, run);
  const r = along === 'x' ? [0, 0, Math.sign(dx) * tilt] : [-Math.sign(dz) * tilt, 0, 0];
  const size = along === 'x' ? [length, 0.1, width] : [width, 0.1, length];
  b.add(shapes.box(...size), TILE, { p: mid, r });
  const rows = Math.max(2, Math.round(length / 0.3));
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    const p = [from[0] + dx * t, from[1] + dy * t + 0.07, from[2] + dz * t];
    const stripe = along === 'x' ? [0.05, 0.04, width + 0.02] : [width + 0.02, 0.04, 0.05];
    b.add(shapes.box(...stripe), TILE_DARK, { p, r });
  }
}

function latticeWindow(b, paper, { x, y, z, w, h, side = false }) {
  const along = (dx, dy, sw, sh, depth, color, target = b) =>
    target.add(shapes.box(side ? depth : sw, sh, side ? sw : depth), color, { p: side ? [x, y + dy, z + dx] : [x + dx, y + dy, z] });
  along(0, 0, w + 0.16, h + 0.16, 0.08, WOOD_DARK);
  along(0, 0, w, h, 0.1, PAPER, paper);
  for (let i = 1; i < 4; i++) along(-w / 2 + (i * w) / 4, 0, 0.04, h, 0.12, WOOD);
  for (let i = 1; i < 3; i++) along(0, -h / 2 + (i * h) / 3, w, 0.04, 0.12, WOOD);
}

function fence(b, obstacles, x0, x1, z) {
  const len = x1 - x0;
  for (const y of [0.35, 0.8]) b.add(shapes.box(len, 0.06, 0.05), RAIL, { p: [(x0 + x1) / 2, y, z] });
  for (let x = x0; x <= x1 + 1e-6; x += 0.18) b.add(shapes.box(0.06, 0.9, 0.04), RAIL, { p: [x, 0.45, z] });
  for (const x of [x0, x1]) b.add(shapes.box(0.12, 1.1, 0.12), WOOD_DARK, { p: [x, 0.55, z] });
  obstacles.push({ minX: x0 - 0.1, maxX: x1 + 0.1, minZ: z - 0.1, maxZ: z + 0.1, minY: 0, maxY: 2 });
}

export function createInn(scene) {
  const { x: cx, z: cz, width: W, depth: D } = INN;
  const b = new Batch();
  const walls = new Batch();
  const paper = new Batch();
  const obstacles = [];
  const front = D / 2;
  const upperY = BASE + GROUND_H + BEAM;
  const topY = upperY + UPPER_H;

  b.add(shapes.box(W + 0.5, BASE, D + 0.5), STONE, { p: [0, BASE / 2, 0] });
  b.add(shapes.box(2.2, 0.15, 0.6), shade(STONE, 0.92), { p: [0, 0.075, front + 0.55] });

  const groundMid = BASE + GROUND_H / 2;
  walls.add(texturedBox(W, GROUND_H, T), WALL, { p: [0, groundMid, -front + T / 2] });
  for (const s of [-1, 1]) walls.add(texturedBox(T, GROUND_H, D - 2 * T), WALL, { p: [s * (W / 2 - T / 2), groundMid, 0] });
  const doorW = 1.6;
  const panel = (W - doorW) / 2;
  for (const s of [-1, 1]) walls.add(texturedBox(panel, GROUND_H, T), WALL, { p: [s * (doorW / 2 + panel / 2), groundMid, front - T / 2] });
  walls.add(texturedBox(doorW, GROUND_H - 2.3, T), WALL, { p: [0, BASE + 2.3 + (GROUND_H - 2.3) / 2, front - T / 2] });
  for (const s of [-1, 1]) {
    b.add(shapes.box(0.78, 2.3, 0.06), WOOD_DARK, { p: [s * 0.4, BASE + 1.15, front - 0.02] });
    b.add(shapes.box(0.04, 2.2, 0.08), WOOD, { p: [s * 0.4, BASE + 1.15, front + 0.02] });
    b.add(shapes.box(0.14, 2.4, 0.26), WOOD, { p: [s * (doorW / 2 + 0.07), BASE + 1.2, front - 0.02] });
  }
  b.add(shapes.box(doorW + 0.28, 0.14, 0.26), WOOD, { p: [0, BASE + 2.37, front - 0.02] });

  const upperMid = upperY + UPPER_H / 2;
  walls.add(texturedBox(W, UPPER_H, T), WALL, { p: [0, upperMid, -front + T / 2] });
  walls.add(texturedBox(W, UPPER_H, T), WALL, { p: [0, upperMid, front - T / 2] });
  for (const s of [-1, 1]) walls.add(texturedBox(T, UPPER_H, D - 2 * T), WALL, { p: [s * (W / 2 - T / 2), upperMid, 0] });

  for (const s of [-1, 1]) {
    for (const x of [1.9, 3.5]) latticeWindow(b, paper, { x: s * x, y: BASE + 1.6, z: front + 0.02, w: 1.1, h: 1.0 });
    for (const z of [-1.7, 1.7]) {
      if (s < 0 || z > 1) latticeWindow(b, paper, { x: s * (W / 2 + 0.02), y: BASE + 1.6, z, w: 1.3, h: 1.0, side: true });
      latticeWindow(b, paper, { x: s * (W / 2 + 0.02), y: upperY + 1.35, z, w: 1.3, h: 1.0, side: true });
    }
  }
  for (const x of [-3.3, -1.1, 1.1, 3.3]) latticeWindow(b, paper, { x, y: upperY + 1.35, z: front + 0.02, w: 1.3, h: 1.1 });

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.add(shapes.box(0.24, topY - BASE, 0.24), WOOD_DARK, { p: [sx * W / 2, (BASE + topY) / 2, sz * front] });
  }
  b.add(shapes.box(W + 0.3, BEAM, D + 0.3), WOOD, { p: [0, BASE + GROUND_H + BEAM / 2, 0] });
  b.add(shapes.box(W + 0.3, 0.22, D + 0.3), WOOD, { p: [0, topY + 0.11, 0] });

  const deckY = upperY - 0.06;
  const deckZ = front + BALCONY / 2;
  b.add(shapes.box(W + 0.3, 0.12, BALCONY), WOOD, { p: [0, deckY, deckZ] });
  for (const x of [-W / 2, -2.7, -1.0, 1.0, 2.7, W / 2]) b.add(shapes.box(0.18, deckY - BASE, 0.18), WOOD_DARK, { p: [x, (BASE + deckY) / 2, front + BALCONY - 0.1] });
  const railZ = front + BALCONY - 0.04;
  const floorY = deckY + 0.06;
  for (const y of [floorY + 0.15, floorY + 0.95]) {
    b.add(shapes.box(W + 0.3, 0.08, 0.08), RAIL, { p: [0, y, railZ] });
    for (const s of [-1, 1]) b.add(shapes.box(0.08, 0.08, BALCONY), RAIL, { p: [s * (W / 2 + 0.11), y, deckZ] });
  }
  for (let x = -W / 2; x <= W / 2 + 1e-6; x += 0.25) b.add(shapes.box(0.05, 0.8, 0.05), RAIL, { p: [x, floorY + 0.55, railZ] });
  for (const s of [-1, 1]) {
    for (let z = front + 0.25; z < front + BALCONY - 0.1; z += 0.27) b.add(shapes.box(0.05, 0.8, 0.05), RAIL, { p: [s * (W / 2 + 0.11), floorY + 0.55, z] });
  }

  const pentTop = upperY + 0.1;
  for (const s of [-1, 1]) {
    slope(b, { from: [s * (W / 2), pentTop, 0], to: [s * (W / 2 + PENT), pentTop - PENT_DROP, 0], width: D + 2 * PENT, along: 'x' });
  }
  slope(b, { from: [0, pentTop, -front], to: [0, pentTop - PENT_DROP, -front - PENT], width: W + 2 * PENT, along: 'z' });

  const wingX0 = W / 2;
  const wingX1 = W / 2 + WING.width;
  const wingZ1 = 0.8;
  const wingZ0 = wingZ1 - WING.depth;
  const wingZ = (wingZ0 + wingZ1) / 2;
  b.add(shapes.box(WING.width + 0.2, BASE, WING.depth + 0.3), STONE, { p: [(wingX0 + wingX1) / 2 + 0.1, BASE / 2, wingZ] });
  const wingMid = BASE + WING.height / 2;
  walls.add(texturedBox(T, WING.height, WING.depth), WALL, { p: [wingX1 - T / 2, wingMid, wingZ] });
  for (const z of [wingZ0 + T / 2, wingZ1 - T / 2]) walls.add(texturedBox(WING.width - T, WING.height, T), WALL, { p: [(wingX0 + wingX1) / 2, wingMid, z] });
  for (const z of [wingZ0, wingZ1]) b.add(shapes.box(0.2, WING.height, 0.2), WOOD_DARK, { p: [wingX1, wingMid, z] });
  latticeWindow(b, paper, { x: (wingX0 + wingX1) / 2, y: BASE + 1.45, z: wingZ1 + 0.02, w: 1.1, h: 0.9 });
  latticeWindow(b, paper, { x: wingX1 + 0.02, y: BASE + 1.45, z: wingZ, w: 1.3, h: 0.9, side: true });
  const wingTop = BASE + WING.height;
  slope(b, { from: [wingX0, pentTop - PENT_DROP - 0.05, wingZ], to: [wingX1 + 0.4, wingTop + 0.02, wingZ], width: WING.depth + 0.7, along: 'x' });

  const roofRise = 2.3;
  const ridge = W / 2 - 2.0;
  b.add(shapes.box(ridge * 2 + 0.9, 0.2, 0.34), GREEN, { p: [0, topY + 0.22 + roofRise + 0.06, 0] });
  for (const s of [-1, 1]) b.add(shapes.cone(0.16, 0.5, 8), GREEN, { p: [s * (ridge + 0.45), topY + 0.22 + roofRise + 0.3, 0], r: [0, 0, -s * 0.5] });

  fence(b, obstacles, -W / 2 + 0.6, -1.1, front + 2.6);
  fence(b, obstacles, 1.1, W / 2 - 0.6, front + 2.6);

  const group = new THREE.Group();
  group.add(b.mesh(), walls.mesh(plasterMaterial()));
  const glowPaper = toonMaterial({ vertexColors: true, emissive: 0xffb35a, emissiveIntensity: 0 });
  group.add(paper.mesh(glowPaper, { shadow: false }));
  group.add(...tileRoofMeshes({ cx: 0, cz: 0, hx: W / 2 + 1.1, hz: D / 2 + 1.1, ridge, eaveY: topY + 0.22, height: roofRise, lift: 0.6, falloff: 2.2 }));

  const sign = textBoard({ lines: ['Nhà Nghỉ'], width: 1.7, height: 0.5, depth: 0.08, bg: 0x1c1310, fg: '#f2c14e', border: 0x8a1d14 });
  sign.position.set(0, BASE + 2.72, front + 0.05);
  group.add(sign);

  const lampSpots = [-1.2, 1.2].map((x) => new THREE.Vector3(x, deckY - 0.06, front + BALCONY - 0.35));
  const glows = lampSpots.map((spot) => {
    const lamp = lantern();
    lamp.position.copy(spot);
    lamp.castShadow = false;
    group.add(lamp);
    return lamp.material;
  });
  const lanternGlow = createLanternGlow(lampSpots.map((spot) => ({ position: new THREE.Vector3(spot.x, spot.y - 0.41, spot.z), tint: 0xd8321e })));
  group.add(lanternGlow.object);
  let night = 0;

  group.position.set(cx, 0, cz);
  scene.add(group);
  freeze(group);

  obstacles.push({ minX: -W / 2 - 0.3, maxX: W / 2 + 0.3, minZ: -front - 0.3, maxZ: front + BALCONY + 0.1, minY: 0, maxY: 3 });
  obstacles.push({ minX: wingX0, maxX: wingX1 + 0.2, minZ: wingZ0 - 0.15, maxZ: wingZ1 + 0.15, minY: 0, maxY: 3 });
  for (const box of obstacles) {
    box.minX += cx;
    box.maxX += cx;
    box.minZ += cz;
    box.maxZ += cz;
  }

  return {
    group,
    obstacles,
    owns(object) {
      for (let node = object; node; node = node.parent) if (node === group) return true;
      return false;
    },
    setNight(k) {
      for (const material of glows) material.emissiveIntensity = 1 + k * 5;
      glowPaper.emissiveIntensity = k * 0.9;
      night = k;
    },
    update(t) {
      lanternGlow.update(t, night);
    },
  };
}
