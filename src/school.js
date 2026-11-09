import * as THREE from 'three';
import { FLUORESCENT } from './config.js';
import { makeRandom } from './random.js';
import { freeze } from './toon.js';
import { createTeacher } from './characters.js';
import { hasModel, createModel } from './characterModels.js';
import { createLanternGlow } from './lanternGlow.js';
import {
  studentFurniture,
  teacherPlatform,
  lacquerDesk,
  teaSet,
  bookshelf,
  drum,
  jar,
  lantern,
  textBoard,
} from './props.js';

export const CX = 0.5;
export const FLOOR = 1;
const SHIFT = -26;
export const HOUSE = {
  back: -10 + SHIFT,
  front: 5 + SHIFT,
  foundationBack: -11 + SHIFT,
  midColumn: -3 + SHIFT,
  windows: [
    [-8 + SHIFT, -5 + SHIFT],
    [-1 + SHIFT, 2 + SHIFT],
  ],
};
export const ENCLOSURE = { x0: -22, x1: 22, front: 28, back: -42 };
export const CROSS_WALLS = [28, -12];
export const SIDE_GATES = [-8.5, 9.5];
export const HO_VAN = { x0: -13, z0: 40, x1: 14, z1: 58, island: { x: 0.5, z: 49, r: 2.6 } };
const LAKE_KEEP_OUT = 0.65;
export const POND = { x: 0.5, z: 18, half: 4 };
export const THUONG_DIEN = { x: 0.5, z: -1.2, hx: 8.8, hz: 3.2 };
export const VU = [-1, 1].map((side) => ({ x: side < 0 ? -17.5 : 18.5, z0: -7, z1: 7 }));
export const STELE_SHEDS = [-1, 1].map((side) => ({ x: side < 0 ? -14.5 : 15.5, z0: 9, z1: 25 }));
export const KHUE_VAN_CAC = { x: 0.5, z: 28.5, half: 2 };
export const STELES = STELE_SHEDS.flatMap(({ x }, i) => [-2, 2].flatMap((dx) => Array.from({ length: 5 }, (_, k) => ({ x: x + dx, z: 23.5 - k * 3.2, side: i === 0 ? -1 : 1 }))));
export const STAIRS = { x0: -3, x1: 4, top: 7 + SHIFT, count: 4, rise: 0.2, tread: 0.3, cheek: 0.42, post: 0.46 };

export function stairHeight(x, z) {
  const { x0, x1, top, count, rise, tread } = STAIRS;
  if (x < x0 || x > x1 || z < top || z >= top + count * tread) return null;
  return (count - Math.floor((z - top) / tread)) * rise;
}

const ROWS = [-4.8, -2.3, 0.2, 2.7].map((z) => z + SHIFT);
const COLUMNS = [-8.4, -5.2, -2, 2, 5.2, 8.4];
const WALL_Z = HOUSE.back + 0.6;
export const TEACHER_Z = WALL_Z + 0.33 + 1.125;
export const TEACHER_STAND = { x: CX + 2.1, z: TEACHER_Z + 1.9 };
export const PACE_SPOTS = [-3.6, 0, 3.6].flatMap((dx) => ROWS.map((z) => ({ x: CX + dx, z })));

function terrain(world) {
  for (let x = -44; x <= 44; x++) {
    for (let z = -36; z <= 46; z++) {
      world.set(x, -1, z, 'grass');
      world.set(x, -2, z, 'dirt');
      world.set(x, -3, z, 'stone');
    }
  }
  world.fill(-12, -1, 12, 12, -1, 26, 'earth');
  world.fill(-2, -1, 27, 2, -1, 46, 'earth');
}

function house(world) {
  const { back, front, foundationBack, midColumn, windows } = HOUSE;
  world.fill(-12, 0, foundationBack, 12, 0, front + 1, 'foundation');

  world.fill(-10, 1, back, 10, 5, back, 'plaster');
  world.fill(-11, 1, back + 1, -11, 5, front - 1, 'plaster');
  world.fill(11, 1, back + 1, 11, 5, front - 1, 'plaster');
  world.fill(-10, 1, back, 10, 1, back, 'brick');
  world.fill(-11, 1, back + 1, -11, 1, front - 1, 'brick');
  world.fill(11, 1, back + 1, 11, 1, front - 1, 'brick');

  for (const x of [-11, 11]) {
    for (const [z0, z1] of windows) world.fill(x, 3, z0, x, 4, z1 - 1, 'lattice');
  }

  for (const x of [-11, -4, 4, 11]) {
    world.fill(x, 1, back, x, 5, back, 'log');
    world.fill(x, 1, front, x, 5, front, 'log');
  }
  world.fill(-11, 1, midColumn, -11, 5, midColumn, 'log');
  world.fill(11, 1, midColumn, 11, 5, midColumn, 'log');

  world.fill(-11, 6, back, 11, 6, back, 'darkPlanks');
  world.fill(-11, 6, front, 11, 6, front, 'darkPlanks');
  world.fill(-11, 6, back + 1, -11, 6, front - 1, 'darkPlanks');
  world.fill(11, 6, back + 1, 11, 6, front - 1, 'darkPlanks');
  for (const x of [-4, 4]) world.fill(x, 6, back + 1, x, 6, front - 1, 'darkPlanks');
}

const ROOF_PITCH = 0.45;

function roof(world) {
  const X0 = -13;
  const X1 = 13;
  const Z0 = HOUSE.back - 2;
  const Z1 = HOUSE.front + 3;
  const BASE = 6;
  const put = (x, y, z, type) => world.set(x, y, z, type, 'roof');

  let top = BASE;
  for (let k = 0; Z0 + k <= Z1 - k; k++) {
    const y = BASE + Math.round(k * ROOF_PITCH);
    const x0 = X0 + k;
    const x1 = X1 - k;
    const z0 = Z0 + k;
    const z1 = Z1 - k;
    top = y;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edgeX = x === x0 || x === x1;
        const edgeZ = z === z0 || z === z1;
        if (!edgeX && !edgeZ) continue;
        put(x, y, z, z0 === z1 || (edgeX && edgeZ) ? 'ridge' : 'roof');
      }
    }
  }

  const rz = (Z0 + Z1) / 2;
  const end = X1 - Math.round((top - BASE) / ROOF_PITCH);
  for (const x of [-end, end]) {
    put(x, top + 1, rz, 'ridge');
    put(x, top + 2, rz, 'ridge');
  }
  put(-3, top + 1, rz, 'ridge');
  put(3, top + 1, rz, 'ridge');
  put(0, top + 1, rz, 'gold');

  for (const x of [X0, X1]) {
    for (const z of [Z0, Z1]) put(x, BASE + 1, z, 'ridge');
  }
}

function courtyard(world) {
  const { x, z, half } = KHUE_VAN_CAC;
  for (const dx of [-half, half]) {
    for (const dz of [-half, half]) world.fill(Math.floor(x + dx), 0, Math.floor(z + dz), Math.floor(x + dx), 3, Math.floor(z + dz), 'brick');
  }
  for (const stele of STELES) world.fill(Math.floor(stele.x), 0, Math.floor(stele.z), Math.floor(stele.x), 1, Math.floor(stele.z), 'stone');
  for (const shed of STELE_SHEDS) {
    for (const dx of [-3, 3]) {
      for (let pz = shed.z0 + 0.5; pz <= shed.z1; pz += 4) world.fill(Math.floor(shed.x + dx), 0, Math.floor(pz), Math.floor(shed.x + dx), 2, Math.floor(pz), 'log');
    }
  }
  for (let px = Math.floor(POND.x - POND.half); px < Math.ceil(POND.x + POND.half); px++) {
    for (let pz = Math.floor(POND.z - POND.half); pz < Math.ceil(POND.z + POND.half); pz++) {
      world.set(px, -1, pz, 'water');
      world.set(px, -2, pz, 'water');
    }
  }
  const td = THUONG_DIEN;
  world.fill(Math.floor(td.x - td.hx), 0, Math.floor(td.z - td.hz), Math.ceil(td.x + td.hx) - 1, 4, Math.ceil(td.z + td.hz) - 1, 'plaster');
  for (const vu of VU) world.fill(Math.floor(vu.x - 2), 0, vu.z0, Math.ceil(vu.x + 2) - 1, 3, vu.z1 - 1, 'plaster');
}

function hoVan(world) {
  const { x0, z0, x1, z1, island } = HO_VAN;
  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      if (Math.hypot(x + 0.5 - island.x, z + 0.5 - island.z) < island.r) continue;
      world.set(x, -1, z, 'water');
      world.set(x, -2, z, 'water');
    }
  }
}

function walls(world) {
  const { x0, x1, front, back } = ENCLOSURE;
  const row = (z, open) => {
    for (let x = x0; x <= x1; x++) if (!open(x)) world.fill(x, 0, z, x, 2, z, 'brick');
  };
  row(back, () => false);
  const kvcRow = Math.floor(KHUE_VAN_CAC.z);
  const sideGate = (x) => SIDE_GATES.some((g) => x >= Math.floor(g - 1) && x < Math.ceil(g + 1));
  for (const z of CROSS_WALLS) row(z, (x) => (x >= -2 && x <= 2) || (z === kvcRow && sideGate(x)));
  world.fill(x0, 0, back, x0, 2, front, 'brick');
  world.fill(x1, 0, back, x1, 2, front, 'brick');
}

function roundTree(world, rand, x, z) {
  const h = 4 + Math.floor(rand() * 2);
  world.fill(x, 0, z, x, h, z, 'log');
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (dx * dx + dz * dz + (dy * 1.2) ** 2 > 5.5 || rand() < 0.1) continue;
        if (!world.get(x + dx, h + dy, z + dz)) world.set(x + dx, h + dy, z + dz, 'leaves');
      }
    }
  }
  return { x, z, h };
}


export function buildWorld(world) {
  const rand = makeRandom(2024);
  const layout = { trees: [] };
  terrain(world);
  house(world);
  roof(world);
  courtyard(world);
  walls(world);
  hoVan(world);
  for (const [x, z] of [[-36, -24], [-34, 12], [36, -26], [37, 10], [0, -65], [-36, -40], [37, -45]]) {
    layout.trees.push(roundTree(world, rand, x, z));
  }
  return layout;
}

export function populate(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const obstacles = [];
  const block = (minX, minZ, maxX, maxZ, minY = FLOOR) => {
    obstacles.push({ minX, minZ, maxX, maxZ, minY, maxY: minY + 3 });
  };
  block(HO_VAN.x0 - LAKE_KEEP_OUT, HO_VAN.z0 - LAKE_KEEP_OUT, HO_VAN.x1 + LAKE_KEEP_OUT, HO_VAN.z1 + LAKE_KEEP_OUT, -1);

  const area = new THREE.Group();
  area.position.set(CX, FLOOR, TEACHER_Z);
  area.add(teacherPlatform());
  const desk = lacquerDesk();
  desk.position.set(0, 0.52, 0);
  area.add(desk);
  const tea = teaSet();
  tea.position.set(1.15, 0.52, -0.45);
  area.add(tea);
  const teacher = hasModel('scholar-ink') ? createModel('scholar-ink', { seated: true }) : createTeacher();
  teacher.group.position.set(0, 0.62, -0.34);
  area.add(teacher.group);
  root.add(area);
  block(CX - 1.55, TEACHER_Z - 1.2, CX + 1.55, TEACHER_Z + 1.2);

  const seats = [];
  let seed = 1000;
  ROWS.forEach((sz) => {
    for (const dx of COLUMNS) {
      seed += 17;
      const x = CX + dx;
      const furniture = new THREE.Group();
      furniture.position.set(x, FLOOR, sz);
      furniture.rotation.y = Math.PI;
      furniture.add(studentFurniture(seed));
      root.add(furniture);
      block(x - 0.5, sz - 0.8, x + 0.5, sz + 0.42);
      seats.push({
        index: seats.length,
        x,
        z: sz,
        sit: new THREE.Vector3(x, FLOOR, sz),
        spot: new THREE.Vector3(x, FLOOR, sz + 0.8),
        occupant: null,
        reservedBy: null,
        place(group) {
          group.position.set(x, FLOOR + 0.02, sz);
          group.rotation.set(0, Math.PI, 0);
        },
      });
    }
  });

  const plaque = textBoard({
    lines: ['Vạn Thế Sư Biểu'],
    width: 3.6,
    height: 1.0,
    depth: 0.12,
    bg: 0x1c1310,
    fg: '#f2c14e',
    border: 0xa12a1c,
    seal: true,
  });
  plaque.position.set(CX, 4.6, WALL_Z + 0.06);
  root.add(plaque);
  const couplets = [
    [['Tiên', 'Học', 'Lễ'], CX + 2.7],
    [['Hậu', 'Học', 'Văn'], CX - 2.7],
  ];
  for (const [lines, x] of couplets) {
    const board = textBoard({ lines, width: 0.9, height: 2.3, depth: 0.1, bg: 0xb02e1f, fg: '#ffe08a', border: 0xf2c14e });
    board.position.set(x, 4.1, WALL_Z + 0.05);
    root.add(board);
  }

  const glows = [];
  const lanternSpots = [
    ...[CX - 7.6, CX - 2.4, CX + 2.4, CX + 7.6].map((x) => [x, 6.15, HOUSE.front + 0.95]),
    [CX - 2.4, 5.6, TEACHER_Z + 1.2],
    [CX + 2.4, 5.6, TEACHER_Z + 1.2],
    [CX - 5.2, 5.6, HOUSE.back + 8.7],
    [CX + 5.2, 5.6, HOUSE.back + 8.7],
  ];
  for (const [x, y, z] of lanternSpots) {
    const lamp = lantern();
    lamp.position.set(x, y, z);
    lamp.castShadow = false;
    glows.push(lamp.material);
    root.add(lamp);
  }
  const lanternGlow = createLanternGlow(lanternSpots.map(([x, y, z]) => ({ position: new THREE.Vector3(x, y - 0.41, z), tint: 0xd8321e })));
  root.add(lanternGlow.object);
  let night = 0;
  const classLights = [[CX, TEACHER_Z + 2], [CX - 5.2, HOUSE.back + 9.2], [CX + 5.2, HOUSE.back + 9.2]].map(([x, z]) => {
    const light = new THREE.PointLight(FLUORESCENT, 0, 15, 2);
    light.position.set(x, 4.8, z);
    root.add(light);
    return light;
  });

  const shelf = bookshelf(360);
  shelf.position.set(CX - 7.6, FLOOR, WALL_Z);
  root.add(shelf);
  block(CX - 8.4, WALL_Z + 0.15, CX - 6.8, WALL_Z + 0.7);

  const drumMesh = drum();
  drumMesh.position.set(CX + 7.6, FLOOR, WALL_Z + 1.2);
  root.add(drumMesh);
  block(CX + 7.15, WALL_Z + 0.75, CX + 8.05, WALL_Z + 1.65);

  const stairEnd = STAIRS.top + STAIRS.count * STAIRS.tread + STAIRS.post;
  block(STAIRS.x0 - STAIRS.cheek - 0.02, STAIRS.top, STAIRS.x0 + 0.02, stairEnd, 0);
  block(STAIRS.x1 - 0.02, STAIRS.top, STAIRS.x1 + STAIRS.cheek + 0.02, stairEnd, 0);

  for (const [x, z, s] of [[-12.4, 8.3, 370], [-12.7, 9.4, 371]]) {
    const jarMesh = jar(s);
    jarMesh.position.set(x, 0, z);
    root.add(jarMesh);
    block(x - 0.42, z - 0.42, x + 0.42, z + 0.42, 0);
  }

  for (const child of root.children) {
    if (child !== area) freeze(child);
  }
  for (const child of area.children) {
    if (child !== teacher.group) freeze(child);
  }
  root.updateMatrix();
  root.matrixAutoUpdate = false;
  let teacherPresent = teacher.group.visible;
  area.updateMatrix();
  area.matrixAutoUpdate = false;

  return {
    root,
    obstacles,
    seats,
    teacher,
    teacherHead: new THREE.Vector3(CX, FLOOR + 1.45, TEACHER_Z - 0.34),
    get teacherPresent() {
      return teacherPresent;
    },
    setTeacherPresent(present) {
      teacherPresent = present;
      teacher.group.visible = present;
    },
    setTeacherSeated(seated) {
      teacher.group.visible = teacherPresent && seated;
    },
    isTeacher(object) {
      for (let node = object; node; node = node.parent) {
        if (node === teacher.group) return true;
      }
      return false;
    },
    setNight(k) {
      for (const material of glows) material.emissiveIntensity = 1 + k * 5;
      for (const light of classLights) light.intensity = k * 30;
      night = k;
    },
    update(t, teaching = true) {
      lanternGlow.update(t, night);
      if (!teacher.group.visible) return;
      teacher.head.rotation.y = Math.sin(t * 0.45) * 0.5;
      teacher.head.rotation.x = 0.08 + Math.sin(t * 0.9) * 0.04;
      const tap = teaching ? Math.pow(Math.max(0, Math.sin(t * 0.8)), 12) : 0;
      teacher.rightArm.rotation.x = -tap * 0.7;
      teacher.face.update(t, tap > 0.2 ? 'stern' : 'open');
      teacher.pose?.();
    },
  };
}
