import * as THREE from 'three';
import { makeRandom } from './random.js';
import { createStudent, createTeacher } from './characters.js';
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
export const SPAWN = { x: CX, y: 0, z: 20 };
export const HOUSE = {
  back: -13,
  front: 6,
  foundationBack: -14,
  midColumn: -4,
  windows: [
    [-10, -7],
    [0, 3],
  ],
};
export const STAIRS ={ x0: -3, x1: 4, top: 8, count: 4, rise: 0.2, tread: 0.3, cheek: 0.42, post: 0.46 };

export function stairHeight(x, z) {
  const { x0, x1, top, count, rise, tread } = STAIRS;
  if (x < x0 || x > x1 || z < top || z >= top + count * tread) return null;
  return (count - Math.floor((z - top) / tread)) * rise;
}

const SHIRTS = [0x8a5a34, 0x6e4a30, 0xa0703f, 0x4a6a9a, 0x5a7a4a, 0xb0804a];
const PANTS = [0xf1ebdc, 0x3a3430, 0xe0d4b8];
const SKINS = [0xf0c09a, 0xe6b08a, 0xf5caa6];
const STYLES = ['chom', 'bachom', 'toc', 'bui', 'khan'];
const KHANS = [0x3a3430, 0x8a3a2a, 0x4a6a9a];
const IRISES = [0x6a3a1e, 0x4a2a18, 0x7a4a24];
const ROWS = [-6.6, -3.6, -0.6, 2.4];
const COLUMNS = [-6.5, -2.5, 2.5, 6.5];
const OCCUPIED_ROWS = 3;
const WALL_Z = HOUSE.back + 0.6;
const TEACHER_Z = WALL_Z + 0.33 + 1.125;

function terrain(world) {
  for (let x = -44; x <= 44; x++) {
    for (let z = -36; z <= 46; z++) {
      world.set(x, -1, z, 'grass');
      world.set(x, -2, z, 'dirt');
      world.set(x, -3, z, 'stone');
    }
  }
  world.fill(-15, -1, 8, 15, -1, 26, 'earth');
  world.fill(-2, -1, 27, 2, -1, 46, 'earth');
}

function house(world) {
  const { back, front, foundationBack, midColumn, windows } = HOUSE;
  world.fill(-15, 0, foundationBack, 15, 0, 7, 'foundation');

  world.fill(-13, 1, back, 13, 7, back, 'plaster');
  world.fill(-14, 1, back + 1, -14, 7, front - 1, 'plaster');
  world.fill(14, 1, back + 1, 14, 7, front - 1, 'plaster');
  world.fill(-13, 1, back, 13, 1, back, 'brick');
  world.fill(-14, 1, back + 1, -14, 1, front - 1, 'brick');
  world.fill(14, 1, back + 1, 14, 1, front - 1, 'brick');

  for (const x of [-14, 14]) {
    for (const [z0, z1] of windows) world.fill(x, 3, z0, x, 4, z1 - 1, 'lattice');
  }

  for (const x of [-14, -5, 5, 14]) {
    world.fill(x, 1, back, x, 7, back, 'log');
    world.fill(x, 1, front, x, 7, front, 'log');
  }
  world.fill(-14, 1, midColumn, -14, 7, midColumn, 'log');
  world.fill(14, 1, midColumn, 14, 7, midColumn, 'log');

  world.fill(-14, 8, back, 14, 8, back, 'darkPlanks');
  world.fill(-14, 8, front, 14, 8, front, 'darkPlanks');
  world.fill(-14, 8, back + 1, -14, 8, front - 1, 'darkPlanks');
  world.fill(14, 8, back + 1, 14, 8, front - 1, 'darkPlanks');
  for (const x of [-5, 5]) world.fill(x, 8, back + 1, x, 8, front - 1, 'darkPlanks');
}

function roof(world) {
  const X0 = -16;
  const X1 = 16;
  const Z0 = HOUSE.back - 2;
  const Z1 = 9;
  const BASE = 8;
  const put = (x, y, z, type) => world.set(x, y, z, type, 'roof');

  let top = BASE;
  for (let k = 0; Z0 + k <= Z1 - k; k++) {
    const y = BASE + k;
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
  const end = X1 - (top - BASE);
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

function gate(world) {
  const z = 30;
  world.fill(-3, 0, z, -3, 3, z, 'brick');
  world.fill(3, 0, z, 3, 3, z, 'brick');
  world.fill(-2, 3, z, 2, 3, z, 'darkPlanks');
  world.fill(-4, 4, z - 1, 4, 4, z + 1, 'roof');
  world.fill(-4, 5, z, 4, 5, z, 'ridge');
  world.set(-4, 6, z, 'ridge');
  world.set(4, 6, z, 'ridge');
  world.set(0, 6, z, 'gold');
}

function hedge(world) {
  const X = 28;
  const Z0 = -20;
  const Z1 = 30;
  for (let x = -X; x <= X; x++) {
    world.fill(x, 0, Z0, x, 1, Z0, 'leaves');
    if (Math.abs(x) > 3) world.fill(x, 0, Z1, x, 1, Z1, 'leaves');
  }
  for (let z = Z0; z <= Z1; z++) {
    world.fill(-X, 0, z, -X, 1, z, 'leaves');
    world.fill(X, 0, z, X, 1, z, 'leaves');
  }
}

function pond(world, cx, cz, r) {
  for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d > r) continue;
      world.set(x, -1, z, 'water');
      if (d <= r - 2) world.set(x, -2, z, 'water');
    }
  }
}

function arecaPalm(world, x, z, h) {
  world.fill(x, 0, z, x, h - 1, z, 'areca');
  world.set(x, h, z, 'leaves');
  world.set(x, h + 1, z, 'leaves');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const diagonal = dx !== 0 && dz !== 0;
    world.set(x + dx, h, z + dz, 'leaves');
    world.set(x + dx * 2, diagonal ? h - 1 : h, z + dz * 2, 'leaves');
    if (!diagonal) world.set(x + dx * 3, h - 1, z + dz * 3, 'leaves');
  }
}

function bambooGrove(world, rand, x0, z0, x1, z1) {
  const stalks = [];
  const count = Math.floor(((x1 - x0 + 1) * (z1 - z0 + 1)) / 4);
  for (let i = 0; i < count; i++) {
    const x = x0 + Math.floor(rand() * (x1 - x0 + 1));
    const z = z0 + Math.floor(rand() * (z1 - z0 + 1));
    if (world.get(x, 0, z)) continue;
    const h = 7 + Math.floor(rand() * 5);
    stalks.push({ x, z, h });
    world.fill(x, 0, z, x, h - 1, z, 'bamboo');
    world.set(x, h, z, 'leaves');
    for (let y = h - 3; y <= h; y++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (rand() < 0.45 && !world.get(x + dx, y, z + dz)) world.set(x + dx, y, z + dz, 'leaves');
        }
      }
    }
  }
  return stalks;
}

function banyan(world, rand, cx, cz) {
  world.fill(cx, 0, cz, cx + 1, 6, cz + 1, 'log');
  world.fill(cx - 2, 5, cz, cx - 1, 5, cz, 'log');
  world.fill(cx + 2, 6, cz + 1, cx + 3, 6, cz + 1, 'log');
  world.fill(cx, 6, cz + 2, cx, 6, cz + 3, 'log');
  const ox = cx + 1;
  const oz = cz + 1;
  const oy = 8;
  for (let x = cx - 6; x <= cx + 7; x++) {
    for (let y = 4; y <= 12; y++) {
      for (let z = cz - 6; z <= cz + 7; z++) {
        const d = ((x + 0.5 - ox) / 5.2) ** 2 + ((y + 0.5 - oy) / 3.2) ** 2 + ((z + 0.5 - oz) / 5.2) ** 2;
        if (d < 1 && rand() > 0.07 && !world.get(x, y, z)) world.set(x, y, z, 'leaves');
      }
    }
  }
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

function haystack(world, cx, cz) {
  [2.6, 2.2, 1.6, 0.9].forEach((r, y) => {
    for (let x = cx - 3; x <= cx + 3; x++) {
      for (let z = cz - 3; z <= cz + 3; z++) {
        if (Math.hypot(x - cx, z - cz) <= r) world.set(x, y, z, 'thatch');
      }
    }
  });
  world.set(cx, 4, cz, 'log');
}

export function buildWorld(world) {
  const rand = makeRandom(2024);
  const layout = {
    pond: { x: -21, z: 18, r: 4.6 },
    arecas: [
      { x: -20, z: 5, h: 8 },
      { x: 21, z: 5, h: 9 },
      { x: -9, z: 27, h: 7 },
      { x: 9, z: 27, h: 8 },
    ],
    banyan: { x: 21, z: 19 },
    haystack: { x: 23, z: -4 },
    bamboos: [],
    trees: [],
  };
  terrain(world);
  house(world);
  roof(world);
  gate(world);
  hedge(world);
  pond(world, layout.pond.x, layout.pond.z, layout.pond.r);
  for (const { x, z, h } of layout.arecas) arecaPalm(world, x, z, h);
  layout.bamboos.push(...bambooGrove(world, rand, -26, -19, -18, -13), ...bambooGrove(world, rand, 18, -19, 26, -13));
  banyan(world, rand, layout.banyan.x, layout.banyan.z);
  haystack(world, layout.haystack.x, layout.haystack.z);
  for (const [x, z] of [[-36, -24], [-34, 12], [-38, 34], [36, -26], [37, 10], [34, 36], [-14, 38], [16, 40], [0, -30], [-22, -30], [24, -31]]) {
    layout.trees.push(roundTree(world, rand, x, z));
  }
  return layout;
}

export function populate(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const rand = makeRandom(77);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const obstacles = [];
  const block = (minX, minZ, maxX, maxZ, minY = FLOOR) => {
    obstacles.push({ minX, minZ, maxX, maxZ, minY, maxY: minY + 3 });
  };

  const area = new THREE.Group();
  area.position.set(CX, FLOOR, TEACHER_Z);
  area.add(teacherPlatform());
  const desk = lacquerDesk();
  desk.position.set(0, 0.52, 0);
  area.add(desk);
  const tea = teaSet();
  tea.position.set(1.15, 0.52, -0.45);
  area.add(tea);
  const teacher = createTeacher();
  teacher.group.position.set(0, 0.62, -0.34);
  area.add(teacher.group);
  root.add(area);
  block(CX - 1.55, TEACHER_Z - 1.2, CX + 1.55, TEACHER_Z + 1.2);

  const students = [];
  const seats = [];
  let seed = 1000;
  ROWS.forEach((sz, row) => {
    for (const dx of COLUMNS) {
      seed += 17;
      const x = CX + dx;
      const furniture = new THREE.Group();
      furniture.position.set(x, FLOOR, sz);
      furniture.rotation.y = Math.PI;
      furniture.add(studentFurniture(seed));
      root.add(furniture);
      block(x - 0.5, sz - 0.8, x + 0.5, sz + 0.42);

      const seat = {
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
      };
      seats.push(seat);
      if (row >= OCCUPIED_ROWS) continue;

      const options = {
        shirt: pick(SHIRTS),
        pants: pick(PANTS),
        skin: pick(SKINS),
        style: pick(STYLES),
        khan: pick(KHANS),
        iris: pick(IRISES),
      };
      const student = createStudent(options);
      seat.place(student.group);
      root.add(student.group);
      students.push({
        ...student,
        options,
        seat,
        phase: rand() * Math.PI * 2,
        writing: rand() < 0.6,
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
  plaque.position.set(CX, 6.0, WALL_Z + 0.06);
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

  for (const x of [CX - 9.5, CX - 3, CX + 3, CX + 9.5]) {
    const lamp = lantern();
    lamp.position.set(x, 8.15, 6.5);
    lamp.castShadow = false;
    root.add(lamp);
  }

  const shelf = bookshelf(360);
  shelf.position.set(CX - 9.5, FLOOR, WALL_Z);
  root.add(shelf);
  block(CX - 10.3, WALL_Z + 0.15, CX - 8.7, WALL_Z + 0.7);

  const drumMesh = drum();
  drumMesh.position.set(CX + 9.5, FLOOR, WALL_Z + 1.2);
  root.add(drumMesh);
  block(CX + 9.05, WALL_Z + 0.75, CX + 9.95, WALL_Z + 1.65);

  const stairEnd = STAIRS.top + STAIRS.count * STAIRS.tread + STAIRS.post;
  block(STAIRS.x0 - STAIRS.cheek - 0.02, STAIRS.top, STAIRS.x0 + 0.02, stairEnd, 0);
  block(STAIRS.x1 - 0.02, STAIRS.top, STAIRS.x1 + STAIRS.cheek + 0.02, stairEnd, 0);

  for (const [x, z, s] of [[-16.4, 4.2, 370], [-16.7, 5.6, 371]]) {
    const jarMesh = jar(s);
    jarMesh.position.set(x, 0, z);
    root.add(jarMesh);
    block(x - 0.42, z - 0.42, x + 0.42, z + 0.42, 0);
  }

  return {
    root,
    obstacles,
    students,
    seats,
    teacherHead: new THREE.Vector3(CX, FLOOR + 1.45, TEACHER_Z - 0.34),
    update(t, inClass = true) {
      for (const s of students) {
        if (!s.group.visible) continue;
        if (s.writing) {
          s.head.rotation.x = 0.3 + Math.sin(t * 1.3 + s.phase) * 0.04;
          s.rightArm.rotation.x = -(0.03 + (Math.sin(t * 6 + s.phase) * 0.5 + 0.5) * 0.06);
          s.rightArm.rotation.y = Math.sin(t * 3 + s.phase) * 0.06;
          s.face.update(t, 'open');
        } else {
          s.head.rotation.x = -0.05 + Math.sin(t * 2.4 + s.phase) * 0.08;
          s.head.rotation.y = Math.sin(t * 0.5 + s.phase) * 0.12;
          s.face.update(t, Math.sin(t * 9 + s.phase) > 0.1 ? 'talk' : 'open');
        }
      }
      teacher.head.rotation.y = Math.sin(t * 0.45) * 0.5;
      teacher.head.rotation.x = 0.08 + Math.sin(t * 0.9) * 0.04;
      const tap = inClass ? Math.pow(Math.max(0, Math.sin(t * 0.8)), 12) : 0;
      teacher.rightArm.rotation.x = -tap * 0.7;
      teacher.face.update(t, tap > 0.2 ? 'stern' : 'open');
    },
  };
}
