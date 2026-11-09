import * as THREE from 'three';
import { FLUORESCENT } from './config.js';
import { Batch, freeze, shapes } from './toon.js';
import { studentFurniture, lantern, textBoard } from './props.js';
import { tileRoofMeshes, groundDecal, roundedRectGeometry, GROUND_LAYER } from './scenery.js';
import { plasterMaterial, texturedBox } from './architecture.js';
import { createLanternGlow } from './lanternGlow.js';
import { paving } from './village.js';

export const STUDY_HALL = { x: 42, front: 40.6, width: 10, depth: 12, door: 2.4, height: 3.2 };

const WALL = 0xd9b46a;
const WOOD = 0x5e3a24;
const WOOD_DARK = 0x4a2c1e;
const STONE = 0xb3ab99;
const FLOOR_TILE = 0x9c624a;
const DESK_ROWS = [43.2, 45.4, 47.6, 49.8];
const ROOF = { overhang: 0.9, ridge: 3.6, lift: 0.1, rise: 2.3 };
const ROOF_GAP = 0.08;
const LACQUER = 0x8a1d14;
const ROOF_TILE = 0x7a3a26;
const LAMP_PAPER = 0xe8dcc0;
const STONE_DARK = 0x8a8273;
const PLINTH = 0.42;
const GATE = { z: 38.3, span: 2.6, height: 3.3 };
const STONE_LANTERNS = [
  [38.9, 39.6],
  [45.1, 39.6],
];
const COURT = { x0: 38.3, z0: 37.3, x1: 45.7, z1: 40.8 };
const COUPLETS = [
  [['Học', 'Nhi', 'Thời', 'Tập'], -2.35],
  [['Ôn', 'Cố', 'Tri', 'Tân'], 2.35],
];

function facade(b) {
  const { x, front, width, depth, door, height } = STUDY_HALL;
  const back = front + depth;
  const left = x - width / 2;
  const right = x + width / 2;
  const T = 0.25;
  const side = (width - door) / 2;
  b.add(shapes.box(width + 0.12, PLINTH, T + 0.12), STONE, { p: [x, PLINTH / 2, back - T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) b.add(shapes.box(T + 0.12, PLINTH, depth + 0.12), STONE, { p: [wx, PLINTH / 2, front + depth / 2] });
  for (const s of [-1, 1]) b.add(shapes.box(side, PLINTH, T + 0.12), STONE, { p: [x + s * (door / 2 + side / 2), PLINTH / 2, front + T / 2] });
  for (const cx of [left + 0.12, right - 0.12]) {
    for (const cz of [front + 0.12, back - 0.12]) b.add(shapes.box(0.34, height, 0.34), WOOD_DARK, { p: [cx, height / 2, cz] });
  }
}

function gate(b, obstacles) {
  const { x } = STUDY_HALL;
  const { z, span, height } = GATE;
  for (const s of [-1, 1]) {
    const px = x + s * span;
    b.add(shapes.box(0.6, 0.3, 0.6), STONE_DARK, { p: [px, 0.15, z] });
    b.add(shapes.cylinder(0.17, 0.19, height - 0.3, 12), LACQUER, { p: [px, 0.3 + (height - 0.3) / 2, z] });
    obstacles.push({ minX: px - 0.3, maxX: px + 0.3, minZ: z - 0.3, maxZ: z + 0.3, minY: 0, maxY: height });
  }
  b.add(shapes.box(span * 2 + 0.4, 0.16, 0.18), WOOD_DARK, { p: [x, 2.55, z] });
  b.add(shapes.box(span * 2 + 1, 0.2, 0.26), WOOD, { p: [x, height + 0.1, z] });
  for (const s of [-1, 1]) b.add(shapes.box(span * 2 + 1.6, 0.08, 0.86), ROOF_TILE, { p: [x, height + 0.38, z + s * 0.3], r: [s * 0.5, 0, 0] });
  b.add(shapes.box(span * 2 + 1.7, 0.12, 0.16), WOOD_DARK, { p: [x, height + 0.58, z] });
  for (const s of [-1, 1]) b.add(shapes.cone(0.1, 0.36, 6), ROOF_TILE, { p: [x + s * (span + 0.9), height + 0.66, z], r: [0, 0, -s * 0.5] });
}

function stoneLantern(b, x, z) {
  b.add(shapes.box(0.55, 0.18, 0.55), STONE_DARK, { p: [x, 0.09, z] });
  b.add(shapes.box(0.22, 0.85, 0.22), STONE, { p: [x, 0.6, z] });
  b.add(shapes.box(0.5, 0.08, 0.5), STONE, { p: [x, 1.06, z] });
  b.add(shapes.box(0.4, 0.34, 0.4), LAMP_PAPER, { p: [x, 1.27, z] });
  b.add(shapes.cone(0.46, 0.34, 4), STONE, { p: [x, 1.61, z], r: [0, Math.PI / 4, 0] });
  b.add(shapes.sphere(0.07, 8, 6), STONE, { p: [x, 1.82, z] });
}

function boards(group) {
  const { x, front } = STUDY_HALL;
  const sign = textBoard({ lines: ['Từ Vựng N2'], width: 2.8, height: 0.62, depth: 0.08, bg: 0x1c1310, fg: '#f2c14e', border: 0xa12a1c, seal: true });
  sign.position.set(x, 2.98, GATE.z);
  sign.rotation.y = Math.PI;
  group.add(sign);
  for (const [lines, dx] of COUPLETS) {
    const board = textBoard({ lines, width: 0.5, height: 1.9, depth: 0.06, bg: 0xb02e1f, fg: '#ffe08a', border: 0xf2c14e });
    board.position.set(x + dx, 1.45, front - 0.035);
    board.rotation.y = Math.PI;
    group.add(board);
  }
}

function roofUnderside(dx, dz) {
  const { width, depth, height } = STUDY_HALL;
  const hx = width / 2 + ROOF.overhang;
  const hz = depth / 2 + ROOF.overhang;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    const ex = hx - (hx - ROOF.ridge) * t;
    const ez = Math.max(1e-6, hz * (1 - t));
    if (Math.max(Math.abs(dx) / ex, Math.abs(dz) / ez) <= 1) lo = t;
    else hi = t;
  }
  return height + ROOF.lift + ROOF.rise * lo;
}

function gableInfill(length, thickness, top) {
  const { height } = STUDY_HALL;
  const half = length / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, height);
  for (let i = 0; i <= 24; i++) {
    const s = -half + (i / 24) * length;
    shape.lineTo(s, Math.max(height, top(s) - ROOF_GAP));
  }
  shape.lineTo(half, height);
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
}
const DESK_OFFSET = 3.2;

export function buildStudyHall(world) {
  const { x, front, width, depth, door } = STUDY_HALL;
  const x0 = Math.floor(x - width / 2);
  const x1 = Math.ceil(x + width / 2) - 1;
  const z0 = Math.floor(front);
  const z1 = Math.ceil(front + depth) - 1;
  const doorX0 = Math.floor(x - door / 2) + 1;
  const doorX1 = Math.ceil(x + door / 2) - 2;
  for (let cx = x0; cx <= x1; cx++) {
    if (cx < doorX0 || cx > doorX1) world.fill(cx, 0, z0, cx, 2, z0, 'plaster');
    world.fill(cx, 0, z1, cx, 2, z1, 'plaster');
  }
  world.fill(x0, 0, z0, x0, 2, z1, 'plaster');
  world.fill(x1, 0, z0, x1, 2, z1, 'plaster');
  world.fill(doorX0, 2, z0, doorX1, 2, z0, 'plaster', 'roof');
  world.fill(x0, 3, z0, x1, 3, z1, 'roof', 'roof');
}

export function createStudyHall(scene) {
  const { x, front, width, depth, door, height } = STUDY_HALL;
  const back = front + depth;
  const left = x - width / 2;
  const right = x + width / 2;
  const T = 0.25;
  const b = new Batch();
  const walls = new Batch();
  b.add(shapes.box(width - 0.2, 0.03, depth - 0.2), FLOOR_TILE, { p: [x, 0.015, front + depth / 2] });
  b.add(shapes.box(door + 0.6, 0.04, 1.0), STONE, { p: [x, 0.02, front - 0.5] });
  walls.add(texturedBox(width, height, T), WALL, { p: [x, height / 2, back - T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) walls.add(texturedBox(T, height, depth - T), WALL, { p: [wx, height / 2, front + (depth - T) / 2] });
  const side = (width - door) / 2;
  for (const s of [-1, 1]) walls.add(texturedBox(side - T, height, T), WALL, { p: [x + s * (door / 2 + (side - T) / 2), height / 2, front + T / 2] });
  walls.add(texturedBox(door, height - 2.6, T), WALL, { p: [x, (height + 2.6) / 2, front + T / 2] });
  const cz = front + depth / 2;
  for (const wx of [left + T / 2, right - T / 2]) {
    walls.add(gableInfill(depth, T, (s) => roofUnderside(Math.sign(wx - x) * (width / 2), s)), WALL, { p: [wx + T / 2, 0, cz], r: [0, -Math.PI / 2, 0] });
  }
  for (const wz of [front + T / 2, back - T / 2]) {
    walls.add(gableInfill(width, T, (s) => roofUnderside(s, Math.sign(wz - cz) * (depth / 2))), WALL, { p: [x, 0, wz - T / 2] });
  }
  for (const s of [-1, 1]) b.add(shapes.box(0.16, 2.6, T + 0.1), WOOD, { p: [x + s * (door / 2 + 0.06), 1.3, front + T / 2] });
  b.add(shapes.box(door + 0.32, 0.16, T + 0.1), WOOD, { p: [x, 2.62, front + T / 2] });
  for (const s of [-1, 1]) b.add(shapes.box(0.06, 2.5, door / 2), WOOD_DARK, { p: [x + s * (door / 2 + 0.2), 1.25, front - door / 4], r: [0, s * 1.2, 0] });

  for (const wx of [left, right]) {
    const out = wx < x ? -1 : 1;
    for (const wz of [front + 3.5, front + 8.5]) {
      b.add(shapes.box(0.08, 1.2, 1.6), WOOD_DARK, { p: [wx + out * 0.02, 1.9, wz] });
      for (let k = -0.6; k <= 0.61; k += 0.3) b.add(shapes.box(0.12, 1.2, 0.06), WOOD, { p: [wx + out * 0.06, 1.9, wz + k] });
      b.add(shapes.box(0.14, 0.1, 1.8), WOOD, { p: [wx + out * 0.06, 2.55, wz] });
      b.add(shapes.box(0.14, 0.1, 1.8), WOOD, { p: [wx + out * 0.06, 1.25, wz] });
    }
  }
  b.add(shapes.box(width + 0.1, 0.22, T + 0.12), WOOD, { p: [x, height + 0.05, front + T / 2] });

  const obstacles = [];
  facade(b);
  gate(b, obstacles);
  for (const [lx, lz] of STONE_LANTERNS) {
    stoneLantern(b, lx, lz);
    obstacles.push({ minX: lx - 0.28, maxX: lx + 0.28, minZ: lz - 0.28, maxZ: lz + 0.28, minY: 0, maxY: 1.9 });
  }

  const group = new THREE.Group();
  group.add(groundDecal(roundedRectGeometry(COURT.x0, COURT.z0, COURT.x1, COURT.z1, 0.5), paving(), GROUND_LAYER.mark + 1, 0.014));
  group.add(b.mesh(), walls.mesh(plasterMaterial()));
  boards(group);
  group.add(...tileRoofMeshes({ cx: x, cz: front + depth / 2, hx: width / 2 + ROOF.overhang, hz: depth / 2 + ROOF.overhang, ridge: ROOF.ridge, eaveY: height + ROOF.lift, height: ROOF.rise, lift: 0.3, falloff: 1.5 }));

  const seats = [];
  for (const s of [-1, 1]) {
    const facing = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    const dir = { x: Math.sin(facing), z: Math.cos(facing) };
    for (const [i, sz] of DESK_ROWS.entries()) {
      const sx = x + s * DESK_OFFSET;
      const furniture = new THREE.Group();
      furniture.position.set(sx, 0.03, sz);
      furniture.rotation.y = facing;
      furniture.add(studentFurniture(900 + i * 7 + (s < 0 ? 0 : 50)));
      group.add(furniture);
      const deskX = sx + dir.x * 0.45;
      obstacles.push({ minX: deskX - 0.25, maxX: deskX + 0.25, minZ: sz - 0.5, maxZ: sz + 0.5, minY: 0, maxY: 0.6 });
      seats.push({
        index: seats.length,
        study: true,
        x: sx,
        z: sz,
        facing,
        sit: new THREE.Vector3(sx, 0.03, sz),
        spot: new THREE.Vector3(sx - dir.x * 0.8, 0, sz - dir.z * 0.8),
        look: new THREE.Vector3(sx + dir.x * 1.5, 0.6, sz),
        occupant: null,
        reservedBy: null,
        place(model) {
          model.position.set(sx, 0.05, sz);
          model.rotation.set(0, facing, 0);
        },
      });
    }
  }
  const lampSpots = [front + 4, front + 8.5].map((lz) => new THREE.Vector3(x, height - 0.1, lz));
  const glows = lampSpots.map((spot) => {
    const lamp = lantern();
    lamp.position.copy(spot);
    lamp.castShadow = false;
    group.add(lamp);
    return lamp.material;
  });
  const lanternGlow = createLanternGlow([
    ...lampSpots.map((spot) => ({ position: new THREE.Vector3(spot.x, spot.y - 0.41, spot.z), tint: 0xd8321e })),
    ...STONE_LANTERNS.map(([lx, lz]) => ({ position: new THREE.Vector3(lx, 1.27, lz), tint: 0xffc070 })),
  ]);
  group.add(lanternGlow.object);
  const roomLight = new THREE.PointLight(FLUORESCENT, 0, 13, 2);
  roomLight.position.set(x, height - 0.8, front + depth / 2);
  group.add(roomLight);
  let night = 0;

  scene.add(group);
  freeze(group);
  return {
    group,
    seats,
    obstacles,
    setNight(k) {
      for (const material of glows) material.emissiveIntensity = 1 + k * 5;
      roomLight.intensity = k * 25;
      night = k;
    },
    update(t) {
      lanternGlow.update(t, night);
    },
  };
}
