import * as THREE from 'three';
import { FLUORESCENT } from './config.js';
import { Batch, freeze, shapes } from './toon.js';
import { studentFurniture, lantern, textBoard } from './props.js';
import { tileRoofMeshes, groundDecal, roundedRectGeometry, GROUND_LAYER } from './scenery.js';
import { plasterMaterial, texturedBox } from './architecture.js';
import { createLanternGlow } from './lanternGlow.js';
import { paving } from './village.js';

export const STUDY_HALL = { x: 42, front: 40.6, width: 10, depth: 12, door: 3.2, doorHeight: 3.2, height: 4.2 };

const WALL = 0xd9b46a;
const WOOD = 0x5e3a24;
const WOOD_DARK = 0x4a2c1e;
const STONE = 0xb3ab99;
const FLOOR_TILE = 0x9c624a;
const DESK_ROWS = [43.2, 45.4, 47.6, 49.8];
const ROOF = { overhang: 0.9, porch: 2, ridge: 3.6, lift: 0.1, rise: 3.4 };
const ROOF_GAP = 0.08;
const LACQUER = 0x8a1d14;
const LAMP_PAPER = 0xe8dcc0;
const STONE_DARK = 0x8a8273;
const PLINTH = 0.42;
const T = 0.25;
const PORCH_Z = STUDY_HALL.front - 1.6;
const COLUMNS = [37.45, 40, 44, 46.55];
const STONE_LANTERNS = [
  [37.7, 37.9],
  [46.3, 37.9],
];
const COURT = { x0: 36.9, z0: 37.3, x1: 47.1, z1: 40.8 };
const COUPLETS = [
  [['Học', 'Hải', 'Vô', 'Biên'], 38.72],
  [['Ôn', 'Cố', 'Tri', 'Tân'], 45.28],
];

function roofBox() {
  const { x, front, width, depth } = STUDY_HALL;
  const z0 = front - ROOF.porch;
  const z1 = front + depth + ROOF.overhang;
  return { cx: x, cz: (z0 + z1) / 2, hx: width / 2 + ROOF.overhang, hz: (z1 - z0) / 2 };
}

function roofUnderside(px, pz) {
  const { height } = STUDY_HALL;
  const { cx, cz, hx, hz } = roofBox();
  const dx = px - cx;
  const dz = pz - cz;
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

function facade(b) {
  const { x, front, width, depth, door, height } = STUDY_HALL;
  const back = front + depth;
  const left = x - width / 2;
  const right = x + width / 2;
  const side = (width - door) / 2;
  b.add(shapes.box(width + 0.12, PLINTH, T + 0.12), STONE, { p: [x, PLINTH / 2, back - T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) b.add(shapes.box(T + 0.12, PLINTH, depth + 0.12), STONE, { p: [wx, PLINTH / 2, front + depth / 2] });
  for (const s of [-1, 1]) b.add(shapes.box(side, PLINTH, T + 0.12), STONE, { p: [x + s * (door / 2 + side / 2), PLINTH / 2, front + T / 2] });
  for (const cx of [left + 0.12, right - 0.12]) {
    for (const cz of [front + 0.12, back - 0.12]) b.add(shapes.box(0.34, height, 0.34), WOOD_DARK, { p: [cx, height / 2, cz] });
  }
}

function doorway(b) {
  const { x, front, door, doorHeight } = STUDY_HALL;
  for (const s of [-1, 1]) b.add(shapes.box(0.18, doorHeight, T + 0.12), WOOD, { p: [x + s * (door / 2 + 0.07), doorHeight / 2, front + T / 2] });
  b.add(shapes.box(door + 0.4, 0.2, T + 0.14), WOOD, { p: [x, doorHeight + 0.08, front + T / 2] });
  b.add(shapes.box(door + 0.8, 0.05, 1.2), STONE, { p: [x, 0.025, front - 0.6] });
  for (const s of [-1, 1]) {
    const lx = x + s * (door * 0.75);
    b.add(shapes.box(door / 2 - 0.06, doorHeight - 0.1, 0.06), LACQUER, { p: [lx, (doorHeight - 0.1) / 2, front + T + 0.04] });
    for (const ly of [0.8, doorHeight / 2, doorHeight - 0.9]) b.add(shapes.box(door / 2 - 0.2, 0.05, 0.03), 0xc9962f, { p: [lx, ly, front + T + 0.08] });
  }
}

function porch(b, obstacles) {
  const { front } = STUDY_HALL;
  const tops = COLUMNS.map((cx) => roofUnderside(cx, PORCH_Z) - 0.02);
  const beamY = Math.min(...tops) - 0.14;
  COLUMNS.forEach((cx) => {
    b.add(shapes.box(0.52, 0.24, 0.52), STONE_DARK, { p: [cx, 0.12, PORCH_Z] });
    b.add(shapes.cylinder(0.15, 0.17, beamY - 0.24, 12), LACQUER, { p: [cx, 0.24 + (beamY - 0.24) / 2, PORCH_Z] });
    b.add(shapes.box(0.16, 0.18, front - PORCH_Z), WOOD_DARK, { p: [cx, beamY, (front + PORCH_Z) / 2] });
    obstacles.push({ minX: cx - 0.26, maxX: cx + 0.26, minZ: PORCH_Z - 0.26, maxZ: PORCH_Z + 0.26, minY: 0, maxY: beamY });
  });
  const span = COLUMNS[COLUMNS.length - 1] - COLUMNS[0];
  b.add(shapes.box(span + 0.5, 0.24, 0.22), WOOD_DARK, { p: [(COLUMNS[0] + COLUMNS[COLUMNS.length - 1]) / 2, beamY, PORCH_Z] });
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
  const { x, front, doorHeight, height } = STUDY_HALL;
  const sign = textBoard({ lines: ['Từ Vựng N2'], plain: ['N2'], width: 3.2, height: 0.78, depth: 0.1, bg: 0x1c1310, fg: '#f2c14e', border: 0xa12a1c, seal: true });
  sign.position.set(x, (doorHeight + 0.2 + height) / 2, front - 0.05);
  sign.rotation.y = Math.PI;
  group.add(sign);
  for (const [lines, bx] of COUPLETS) {
    const board = textBoard({ lines, width: 0.56, height: 2.4, depth: 0.06, bg: 0xb02e1f, fg: '#ffe08a', border: 0xf2c14e });
    board.position.set(bx, 1.85, front - 0.035);
    board.rotation.y = Math.PI;
    group.add(board);
  }
}

const DESK_OFFSET = 3.2;

export function buildStudyHall(world) {
  const { x, front, width, depth, door, height } = STUDY_HALL;
  const top = Math.round(height) - 1;
  const x0 = Math.floor(x - width / 2);
  const x1 = Math.ceil(x + width / 2) - 1;
  const z0 = Math.floor(front);
  const z1 = Math.ceil(front + depth) - 1;
  const doorX0 = Math.floor(x - door / 2);
  const doorX1 = Math.ceil(x + door / 2) - 1;
  for (let cx = x0; cx <= x1; cx++) {
    if (cx < doorX0 || cx > doorX1) world.fill(cx, 0, z0, cx, top, z0, 'plaster');
    world.fill(cx, 0, z1, cx, top, z1, 'plaster');
  }
  world.fill(x0, 0, z0, x0, top, z1, 'plaster');
  world.fill(x1, 0, z0, x1, top, z1, 'plaster');
  world.fill(doorX0, top, z0, doorX1, top, z0, 'plaster', 'roof');
  world.fill(x0, top + 1, z0, x1, top + 1, z1, 'roof', 'roof');
}

export function createStudyHall(scene) {
  const { x, front, width, depth, door, doorHeight, height } = STUDY_HALL;
  const back = front + depth;
  const left = x - width / 2;
  const right = x + width / 2;
  const b = new Batch();
  const walls = new Batch();
  b.add(shapes.box(width - 0.2, 0.03, depth - 0.2), FLOOR_TILE, { p: [x, 0.015, front + depth / 2] });
  walls.add(texturedBox(width, height, T), WALL, { p: [x, height / 2, back - T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) walls.add(texturedBox(T, height, depth - T), WALL, { p: [wx, height / 2, front + (depth - T) / 2] });
  const side = (width - door) / 2;
  for (const s of [-1, 1]) walls.add(texturedBox(side - T, height, T), WALL, { p: [x + s * (door / 2 + (side - T) / 2), height / 2, front + T / 2] });
  walls.add(texturedBox(door, height - doorHeight, T), WALL, { p: [x, (height + doorHeight) / 2, front + T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) {
    walls.add(gableInfill(depth, T, (s) => roofUnderside(wx, front + depth / 2 + s)), WALL, { p: [wx + T / 2, 0, front + depth / 2], r: [0, -Math.PI / 2, 0] });
  }
  for (const wz of [front + T / 2, back - T / 2]) {
    walls.add(gableInfill(width, T, (s) => roofUnderside(x + s, wz)), WALL, { p: [x, 0, wz - T / 2] });
  }

  for (const wx of [left, right]) {
    const out = wx < x ? -1 : 1;
    for (const wz of [front + 3.5, front + 8.5]) {
      b.add(shapes.box(0.08, 1.4, 1.6), WOOD_DARK, { p: [wx + out * 0.02, 2.3, wz] });
      for (let k = -0.6; k <= 0.61; k += 0.3) b.add(shapes.box(0.12, 1.4, 0.06), WOOD, { p: [wx + out * 0.06, 2.3, wz + k] });
      b.add(shapes.box(0.14, 0.1, 1.8), WOOD, { p: [wx + out * 0.06, 3.05, wz] });
      b.add(shapes.box(0.14, 0.1, 1.8), WOOD, { p: [wx + out * 0.06, 1.55, wz] });
    }
  }
  b.add(shapes.box(width + 0.1, 0.22, T + 0.12), WOOD, { p: [x, height + 0.05, front + T / 2] });

  const obstacles = [];
  for (const s of [-1, 1]) {
    const edge = x + s * (door / 2);
    const voxel = s < 0 ? Math.floor(edge) : Math.ceil(edge);
    obstacles.push({ minX: Math.min(edge, voxel), maxX: Math.max(edge, voxel), minZ: front - 0.05, maxZ: front + T + 0.05, minY: 0, maxY: doorHeight });
  }
  facade(b);
  doorway(b);
  porch(b, obstacles);
  for (const [lx, lz] of STONE_LANTERNS) {
    stoneLantern(b, lx, lz);
    obstacles.push({ minX: lx - 0.28, maxX: lx + 0.28, minZ: lz - 0.28, maxZ: lz + 0.28, minY: 0, maxY: 1.9 });
  }

  const group = new THREE.Group();
  group.add(groundDecal(roundedRectGeometry(COURT.x0, COURT.z0, COURT.x1, COURT.z1, 0.5), paving(), GROUND_LAYER.mark + 1, 0.014));
  group.add(b.mesh(), walls.mesh(plasterMaterial()));
  boards(group);
  const roof = roofBox();
  group.add(...tileRoofMeshes({ ...roof, ridge: ROOF.ridge, eaveY: height + ROOF.lift, height: ROOF.rise, lift: 0.3, falloff: 1.5 }));

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
