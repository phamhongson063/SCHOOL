import * as THREE from 'three';
import { FLUORESCENT } from './config.js';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { studentFurniture, lantern, textBoard } from './props.js';
import { tileRoofMeshes, roundedRectShape } from './scenery.js';
import { plasterMaterial, texturedBox } from './architecture.js';
import { createLanternGlow } from './lanternGlow.js';
import { brickMaterial, keeperNPC } from './village.js';
import { createAttention } from './attention.js';

export const HALL_SIZE = { width: 10, depth: 12, door: 3.2, doorHeight: 3.2, height: 4.2 };
export const STUDY_HALLS = [
  { deck: 'n2', x: 42, front: 40.6, turn: 0, sign: ['Từ Vựng N2'], plain: ['N2'] },
  { deck: 'sugu1', x: -70, front: 29.4, turn: Math.PI, sign: ['すぐに使える①'], plain: ['すぐに使える①'] },
];

const WALL = 0xd9b46a;
const WOOD = 0x5e3a24;
const WOOD_DARK = 0x4a2c1e;
const STONE = 0xb3ab99;
const FLOOR_TILE = 0x9c624a;
const DESK_ROWS = [3, 6.2];
const INTERNAL_ROW = 9.4;
const WAIT_SPOTS = [
  [-1.3, 4.6],
  [1.3, 4.6],
  [-1.3, 7.8],
  [1.3, 7.8],
];
const ROOF = { overhang: 0.9, porch: 2, ridge: 3.6, lift: 0.1, rise: 3.4 };
const ROOF_GAP = 0.08;
const LACQUER = 0x8a1d14;
const LAMP_PAPER = 0xe8dcc0;
const LAMP_EMISSIVE = 0xffb35c;
const LAMP_NIGHT_GLOW = 0.85;
const STONE_HALO_BOOST = 1.2;
const STONE_DARK = 0x8a8273;
const PLINTH = 0.42;
const T = 0.25;
const PORCH_Z = -1.6;
const COLUMNS = [-4.55, -2, 2, 4.55];
const STONE_LANTERNS = [
  [-4.3, -2.7],
  [4.3, -2.7],
];
const COURT = { x0: -5.1, z0: -3.3, x1: 5.1, z1: 0.2 };
const COURT_BRICK_TOP = 0.06;
const STEP_TOP = 0.09;
const COUPLETS = [
  [['Học', 'Hải', 'Vô', 'Biên'], -3.28],
  [['Ôn', 'Cố', 'Tri', 'Tân'], 3.28],
];
const DESK_OFFSET = 3.2;
const TEACHER = { z: HALL_SIZE.depth - 1.3, reach: 1.5, model: 'granny', distance: 45, lineEnd: 1, attendRange: 4.5 };
const TEACHER_LOOK = { shirt: 0x3a4a6a, pants: 0x2f2a26, skin: 0xe6b08a, style: 'bui', hairColor: 0xd8d4cc, iris: 0x3a2214 };

function createTeacher(scene, hall, frame) {
  const npc = keeperNPC(TEACHER_LOOK, TEACHER.model);
  const spot = frame.point(0, TEACHER.z);
  const stand = frame.point(0, TEACHER.z - TEACHER.reach);
  const at = new THREE.Vector3(spot.x, 0.03, spot.z);
  const group = npc.walker.group;
  group.position.copy(at);
  group.rotation.y = Math.PI + hall.turn;
  scene.add(group);
  const attention = createAttention(group, { range: TEACHER.attendRange });

  return {
    group,
    at,
    stand: new THREE.Vector3(stand.x, 0, stand.z),
    line: [frame.point(0, TEACHER.z - TEACHER.reach + 0.6), frame.point(0, TEACHER.lineEnd)],
    attend: attention.attend,
    release: attention.release,
    obstacle: frame.box({ minX: -0.3, maxX: 0.3, minZ: TEACHER.z - 0.3, maxZ: TEACHER.z + 0.3, minY: 0, maxY: 1.7 }),
    owns(object) {
      for (let node = object; node; node = node.parent) if (node === npc.walker.group) return true;
      return false;
    },
    say(text, now) {
      npc.bubble.show(text, Math.min(5, 1.6 + text.length * 0.04), now);
    },
    update(t, camera) {
      attention.update(t);
      const near = camera.position.distanceTo(at) < TEACHER.distance;
      npc.walker.group.visible = near;
      if (!near) return;
      npc.bubble.update(t);
      npc.walker.head.rotation.y = Math.sin(t * 0.5 + npc.phase) * 0.45;
      npc.walker.head.rotation.x = Math.sin(t * 0.9 + npc.phase) * 0.05;
      npc.walker.face.update(t, npc.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
      npc.walker.pose?.();
    },
  };
}

function hallFrame(hall) {
  const s = hall.turn ? -1 : 1;
  return {
    s,
    point: (lx, lz) => ({ x: hall.x + s * lx, z: hall.front + s * lz }),
    box: (b) => ({
      minX: s > 0 ? hall.x + b.minX : hall.x - b.maxX,
      maxX: s > 0 ? hall.x + b.maxX : hall.x - b.minX,
      minZ: s > 0 ? hall.front + b.minZ : hall.front - b.maxZ,
      maxZ: s > 0 ? hall.front + b.maxZ : hall.front - b.minZ,
      minY: b.minY,
      maxY: b.maxY,
    }),
  };
}

export function hallBounds(hall) {
  const { width, depth } = HALL_SIZE;
  const s = hall.turn ? -1 : 1;
  const far = hall.front + s * depth;
  return { x0: hall.x - width / 2, x1: hall.x + width / 2, z0: Math.min(hall.front, far), z1: Math.max(hall.front, far), out: -s };
}

function roofBox() {
  const { width, depth } = HALL_SIZE;
  const z0 = -ROOF.porch;
  const z1 = depth + ROOF.overhang;
  return { cx: 0, cz: (z0 + z1) / 2, hx: width / 2 + ROOF.overhang, hz: (z1 - z0) / 2 };
}

function roofUnderside(px, pz) {
  const { height } = HALL_SIZE;
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
  const { height } = HALL_SIZE;
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
  const { width, depth, door, height } = HALL_SIZE;
  const left = -width / 2;
  const right = width / 2;
  const side = (width - door) / 2;
  b.add(shapes.box(width + 0.12, PLINTH, T + 0.12), STONE, { p: [0, PLINTH / 2, depth - T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) b.add(shapes.box(T + 0.12, PLINTH, depth - 2 * T - 0.12), STONE, { p: [wx, PLINTH / 2, depth / 2] });
  for (const s of [-1, 1]) b.add(shapes.box(side + 0.06, PLINTH, T + 0.12), STONE, { p: [s * (door / 2 + (side + 0.06) / 2), PLINTH / 2, T / 2] });
  for (const cx of [left + 0.12, right - 0.12]) {
    for (const cz of [0.12, depth - 0.12]) b.add(shapes.box(0.34, height, 0.34), WOOD_DARK, { p: [cx, height / 2, cz] });
  }
}

function doorway(b) {
  const { door, doorHeight } = HALL_SIZE;
  for (const s of [-1, 1]) b.add(shapes.box(0.18, doorHeight, T + 0.16), WOOD, { p: [s * (door / 2 + 0.07), doorHeight / 2, T / 2] });
  b.add(shapes.box(door + 0.4, 0.2, T + 0.14), WOOD, { p: [0, doorHeight + 0.08, T / 2] });
  b.add(shapes.box(door + 0.8, STEP_TOP, 1.2), STONE, { p: [0, STEP_TOP / 2, -0.6] });
  for (const s of [-1, 1]) {
    const lx = s * (door * 0.75);
    b.add(shapes.box(door / 2 - 0.06, doorHeight - 0.1, 0.06), LACQUER, { p: [lx, (doorHeight - 0.1) / 2, T + 0.04] });
    for (const ly of [0.8, doorHeight / 2, doorHeight - 0.9]) b.add(shapes.box(door / 2 - 0.2, 0.05, 0.03), 0xc9962f, { p: [lx, ly, T + 0.08] });
  }
}

function porch(b, obstacles) {
  const tops = COLUMNS.map((cx) => roofUnderside(cx, PORCH_Z) - 0.02);
  const beamY = Math.min(...tops) - 0.14;
  COLUMNS.forEach((cx) => {
    b.add(shapes.box(0.52, 0.24, 0.52), STONE_DARK, { p: [cx, 0.12, PORCH_Z] });
    b.add(shapes.cylinder(0.15, 0.17, beamY - 0.24, 12), LACQUER, { p: [cx, 0.24 + (beamY - 0.24) / 2, PORCH_Z] });
    b.add(shapes.box(0.16, 0.18, -PORCH_Z), WOOD_DARK, { p: [cx, beamY, PORCH_Z / 2] });
    obstacles.push({ minX: cx - 0.26, maxX: cx + 0.26, minZ: PORCH_Z - 0.26, maxZ: PORCH_Z + 0.26, minY: 0, maxY: beamY });
  });
  const span = COLUMNS[COLUMNS.length - 1] - COLUMNS[0];
  b.add(shapes.box(span + 0.5, 0.24, 0.22), WOOD_DARK, { p: [(COLUMNS[0] + COLUMNS[COLUMNS.length - 1]) / 2, beamY, PORCH_Z] });
}

function courtBricks() {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(COURT.x0, COURT.z0, COURT.x1, COURT.z1, 0.5), { depth: COURT_BRICK_TOP, bevelEnabled: false, curveSegments: 6 });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, brickMaterial());
  mesh.receiveShadow = true;
  return mesh;
}

function stoneLantern(b, paper, x, z) {
  b.add(shapes.box(0.55, 0.18, 0.55), STONE_DARK, { p: [x, 0.09, z] });
  b.add(shapes.box(0.22, 0.85, 0.22), STONE, { p: [x, 0.6, z] });
  b.add(shapes.box(0.5, 0.08, 0.5), STONE, { p: [x, 1.06, z] });
  paper.add(shapes.box(0.4, 0.34, 0.4), LAMP_PAPER, { p: [x, 1.27, z] });
  b.add(shapes.cone(0.46, 0.34, 4), STONE, { p: [x, 1.61, z], r: [0, Math.PI / 4, 0] });
  b.add(shapes.sphere(0.07, 8, 6), STONE, { p: [x, 1.82, z] });
}

function boards(group, hall) {
  const { doorHeight, height } = HALL_SIZE;
  const sign = textBoard({ lines: hall.sign, plain: hall.plain, width: 3.2, height: 0.78, depth: 0.1, bg: 0x1c1310, fg: '#f2c14e', border: 0xa12a1c, seal: true });
  sign.position.set(0, (doorHeight + 0.2 + height) / 2, -0.05);
  sign.rotation.y = Math.PI;
  group.add(sign);
  for (const [lines, bx] of COUPLETS) {
    const board = textBoard({ lines, width: 0.56, height: 2.4, depth: 0.06, bg: 0xb02e1f, fg: '#ffe08a', border: 0xf2c14e });
    board.position.set(bx, 1.85, -0.035);
    board.rotation.y = Math.PI;
    group.add(board);
  }
}

export function buildStudyHall(world, hall) {
  const { width, door, height } = HALL_SIZE;
  const bounds = hallBounds(hall);
  const top = Math.round(height) - 1;
  const x0 = Math.floor(hall.x - width / 2);
  const x1 = Math.ceil(hall.x + width / 2) - 1;
  const z0 = Math.floor(bounds.z0);
  const z1 = Math.ceil(bounds.z1) - 1;
  const frontRow = bounds.out < 0 ? z0 : z1;
  const backRow = bounds.out < 0 ? z1 : z0;
  const doorX0 = Math.floor(hall.x - door / 2);
  const doorX1 = Math.ceil(hall.x + door / 2) - 1;
  for (let cx = x0; cx <= x1; cx++) {
    if (cx < doorX0 || cx > doorX1) world.fill(cx, 0, frontRow, cx, top, frontRow, 'plaster');
    world.fill(cx, 0, backRow, cx, top, backRow, 'plaster');
  }
  world.fill(x0, 0, z0, x0, top, z1, 'plaster');
  world.fill(x1, 0, z0, x1, top, z1, 'plaster');
  world.fill(doorX0, top, frontRow, doorX1, top, frontRow, 'plaster', 'roof');
  world.fill(x0, top + 1, z0, x1, top + 1, z1, 'roof', 'roof');
}

export function createStudyHall(scene, hall) {
  const { width, depth, door, doorHeight, height } = HALL_SIZE;
  const frame = hallFrame(hall);
  const left = -width / 2;
  const right = width / 2;
  const b = new Batch();
  const walls = new Batch();
  b.add(shapes.box(width - 0.2, 0.03, depth - 0.2), FLOOR_TILE, { p: [0, 0.015, depth / 2] });
  walls.add(texturedBox(width, height, T), WALL, { p: [0, height / 2, depth - T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) walls.add(texturedBox(T, height, depth - T), WALL, { p: [wx, height / 2, (depth - T) / 2] });
  const side = (width - door) / 2;
  for (const s of [-1, 1]) walls.add(texturedBox(side - T, height, T), WALL, { p: [s * (door / 2 + (side - T) / 2), height / 2, T / 2] });
  walls.add(texturedBox(door, height - doorHeight, T), WALL, { p: [0, (height + doorHeight) / 2, T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) {
    walls.add(gableInfill(depth, T, (s) => roofUnderside(wx, depth / 2 + s)), WALL, { p: [wx + T / 2, 0, depth / 2], r: [0, -Math.PI / 2, 0] });
  }
  for (const wz of [T / 2, depth - T / 2]) {
    walls.add(gableInfill(width, T, (s) => roofUnderside(s, wz)), WALL, { p: [0, 0, wz - T / 2] });
  }

  for (const wx of [left, right]) {
    const out = wx < 0 ? -1 : 1;
    for (const wz of [3.5, 8.5]) {
      b.add(shapes.box(0.08, 1.4, 1.6), WOOD_DARK, { p: [wx + out * 0.02, 2.3, wz] });
      for (let k = -0.6; k <= 0.61; k += 0.3) b.add(shapes.box(0.12, 1.4, 0.06), WOOD, { p: [wx + out * 0.06, 2.3, wz + k] });
      b.add(shapes.box(0.14, 0.1, 1.8), WOOD, { p: [wx + out * 0.06, 3.05, wz] });
      b.add(shapes.box(0.14, 0.1, 1.8), WOOD, { p: [wx + out * 0.06, 1.55, wz] });
    }
  }
  b.add(shapes.box(width + 0.1, 0.22, T + 0.12), WOOD, { p: [0, height + 0.05, T / 2] });

  const local = [];
  facade(b);
  doorway(b);
  porch(b, local);
  const lampPaper = new Batch();
  for (const [lx, lz] of STONE_LANTERNS) {
    stoneLantern(b, lampPaper, lx, lz);
    local.push({ minX: lx - 0.28, maxX: lx + 0.28, minZ: lz - 0.28, maxZ: lz + 0.28, minY: 0, maxY: 1.9 });
  }

  const group = new THREE.Group();
  group.position.set(hall.x, 0, hall.front);
  group.rotation.y = hall.turn;
  group.add(courtBricks());
  const paperMaterial = toonMaterial({ vertexColors: true, muted: true, emissive: LAMP_EMISSIVE, emissiveIntensity: 0 });
  group.add(b.mesh(), walls.mesh(plasterMaterial()), lampPaper.mesh(paperMaterial));
  boards(group, hall);
  const roof = roofBox();
  group.add(...tileRoofMeshes({ ...roof, ridge: ROOF.ridge, eaveY: height + ROOF.lift, height: ROOF.rise, lift: 0.3, falloff: 1.5 }));

  function desk(s, sz, seed) {
    const localFacing = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    const facing = localFacing + hall.turn;
    const dir = { x: Math.sin(facing), z: Math.cos(facing) };
    const lx = s * DESK_OFFSET;
    const furniture = new THREE.Group();
    furniture.position.set(lx, 0.03, sz);
    furniture.rotation.y = localFacing;
    furniture.add(studentFurniture(seed));
    group.add(furniture);
    const deskX = lx + Math.sin(localFacing) * 0.45;
    local.push({ minX: deskX - 0.25, maxX: deskX + 0.25, minZ: sz - 0.5, maxZ: sz + 0.5, minY: 0, maxY: 0.6 });
    const { x: sx, z: wz } = frame.point(lx, sz);
    return {
      deck: hall.deck,
      x: sx,
      z: wz,
      facing,
      sit: new THREE.Vector3(sx, 0.03, wz),
      spot: new THREE.Vector3(sx - dir.x * 0.8, 0, wz - dir.z * 0.8),
      look: new THREE.Vector3(sx + dir.x * 1.5, 0.6, wz + dir.z * 1.5),
      occupant: null,
      reservedBy: null,
      place(model) {
        model.position.set(sx, 0.05, wz);
        model.rotation.set(0, facing, 0);
      },
    };
  }

  const seats = [];
  const internalSeats = [];
  for (const s of [-1, 1]) {
    for (const [i, sz] of DESK_ROWS.entries()) seats.push({ ...desk(s, sz, 900 + i * 7 + (s < 0 ? 0 : 50)), index: seats.length, study: true });
    internalSeats.push({ ...desk(s, INTERNAL_ROW, 960 + (s < 0 ? 0 : 50)), internal: true });
  }

  const waitSpots = WAIT_SPOTS.map(([lx, lz]) => {
    const { x, z } = frame.point(lx, lz);
    return new THREE.Vector3(x, 0, z);
  });

  const obstacles = local.map(frame.box);
  for (const s of [-1, 1]) {
    const edge = hall.x + s * (door / 2);
    const voxel = s < 0 ? Math.floor(edge) : Math.ceil(edge);
    const jamb = frame.box({ minX: 0, maxX: 0, minZ: -0.05, maxZ: T + 0.05, minY: 0, maxY: doorHeight });
    obstacles.push({ ...jamb, minX: Math.min(edge, voxel), maxX: Math.max(edge, voxel) });
  }

  const lampSpots = [4, 8.5].map((lz) => new THREE.Vector3(0, height - 0.1, lz));
  const glows = lampSpots.map((spot) => {
    const lamp = lantern();
    lamp.position.copy(spot);
    lamp.castShadow = false;
    group.add(lamp);
    return lamp.material;
  });
  const lanternGlow = createLanternGlow([
    ...lampSpots.map((spot) => ({ position: new THREE.Vector3(spot.x, spot.y - 0.41, spot.z), tint: 0xd8321e })),
    ...STONE_LANTERNS.map(([lx, lz]) => ({ position: new THREE.Vector3(lx, 1.27, lz), tint: 0xffc070, intensity: STONE_HALO_BOOST })),
  ]);
  group.add(lanternGlow.object);
  const roomLight = new THREE.PointLight(FLUORESCENT, 0, 13, 2);
  roomLight.position.set(0, height - 0.8, depth / 2);
  group.add(roomLight);
  let night = 0;

  scene.add(group);
  freeze(group);
  const teacher = createTeacher(scene, hall, frame);
  obstacles.push(teacher.obstacle);
  return {
    group,
    seats,
    internalSeats,
    waitSpots,
    obstacles,
    teacher,
    setNight(k) {
      for (const material of glows) material.emissiveIntensity = 1 + k * 5;
      paperMaterial.emissiveIntensity = k * LAMP_NIGHT_GLOW;
      roomLight.intensity = k * 25;
      night = k;
    },
    update(t, camera) {
      lanternGlow.update(t, night);
      teacher.update(t, camera);
    },
  };
}
