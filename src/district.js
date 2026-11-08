import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, freeze, shapes } from './toon.js';
import { makeRandom } from './random.js';
import { groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { createShophouse } from './architecture.js';
import { paving } from './village.js';
import { createVillageGate, villageGateObstacles } from './countryside.js';

const AVENUES = [104, 126, 148, 170];
const STREET = 3;
const MAIN = { z0: 33, z1: 37 };
const NORTH_STREET = 7.5;
const SOUTH_STREET = 60;
const EAST_GATE = 181;
const DEPTH = 8;
const PLAZA_BLOCK = 1;
const BOUNDS = { x0: 100, z0: 4, x1: 185, z1: 64 };
const PAVING_LAYER = GROUND_LAYER.mark + 1;
const ABOVE_PAVING = PAVING_LAYER + 1;
const STALL_CLOTHS = [0xc0281a, 0x2f7ab8, 0xd8a030, 0x3a8a5a];

function frame(side, x, front) {
  const north = side === 'north';
  return { turn: north ? 0 : Math.PI, north, x, front };
}

function footprint(f, width) {
  const half = width / 2;
  return f.north
    ? { minX: f.x - half, maxX: f.x + half, minZ: f.front - DEPTH, maxZ: f.front - 0.4, minY: 0, maxY: 3.5 }
    : { minX: f.x - half, maxX: f.x + half, minZ: f.front + 0.4, maxZ: f.front + DEPTH, minY: 0, maxY: 3.5 };
}

function layout() {
  const rand = makeRandom(6161);
  const blocks = [];
  for (let i = 0; i < AVENUES.length - 1; i++) {
    const x0 = AVENUES[i] + STREET / 2;
    const x1 = AVENUES[i + 1] - STREET / 2;
    const slots = [x0 + 3.2, x0 + 9.5, x0 + 15.8];
    const north = NORTH_STREET + STREET / 2;
    const roadNorth = MAIN.z0 - 1.6;
    const roadSouth = MAIN.z1 + 1.6;
    const south = SOUTH_STREET - STREET / 2;
    const rows = [
      { side: 'north', front: roadNorth },
      { side: 'south', front: north },
    ];
    if (i !== PLAZA_BLOCK) rows.push({ side: 'south', front: roadSouth }, { side: 'north', front: south });
    const houses = [];
    for (const row of rows) {
      for (const x of slots) {
        const width = 5.6 + rand() * 0.5;
        houses.push({ ...frame(row.side, x, row.front), width, seed: 400 + Math.floor(rand() * 9000), stories: rand() < 0.4 ? 2 : 1 });
      }
    }
    blocks.push({ x0, x1, houses });
  }
  const plaza = { x0: AVENUES[PLAZA_BLOCK] + STREET / 2, x1: AVENUES[PLAZA_BLOCK + 1] - STREET / 2, z0: MAIN.z1 + 1.6, z1: SOUTH_STREET - STREET / 2 };
  return { blocks, plaza };
}

function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((node) => {
    if (!node.isMesh) return;
    const key = node.material;
    const list = buckets.get(key) ?? [];
    list.push({ geometry: node.geometry.clone().applyMatrix4(node.matrixWorld), shadow: node.castShadow });
    buckets.set(key, list);
  });
  const meshes = [];
  for (const [material, parts] of buckets) {
    if (parts.length === 1 && material.map) {
      parts[0].geometry.dispose();
      continue;
    }
    const merged = mergeGeometries(parts.map((part) => part.geometry), false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = parts[0].shadow;
      mesh.receiveShadow = true;
      meshes.push(mesh);
    } else {
      for (const part of parts) {
        const mesh = new THREE.Mesh(part.geometry, material);
        mesh.castShadow = part.shadow;
        mesh.receiveShadow = true;
        meshes.push(mesh);
      }
    }
    for (const part of parts) if (merged) part.geometry.dispose();
  }
  return meshes;
}

function buildBlock(block) {
  const root = new THREE.Group();
  for (const house of block.houses) {
    const built = createShophouse({ seed: house.seed, width: house.width, depth: DEPTH, stories: house.stories });
    built.group.position.set(house.x, 0, house.front);
    built.group.rotation.y = house.turn;
    root.add(built.group);
  }
  return mergeByMaterial(root);
}

function stall(b, x, z, cloth) {
  b.add(shapes.box(2.2, 0.08, 1.1), 0x7a5232, { p: [x, 0.8, z] });
  b.add(shapes.box(2.1, 0.7, 0.06), 0x6a4428, { p: [x, 0.42, z + 0.5] });
  for (const dx of [-1.05, 1.05]) {
    for (const dz of [-0.5, 0.5]) b.add(shapes.cylinder(0.05, 0.05, 2.2, 6), 0x5a3a22, { p: [x + dx, 1.1, z + dz] });
  }
  b.add(shapes.box(2.6, 0.06, 1.5), cloth, { p: [x, 2.25, z], r: [0.12, 0, 0] });
  for (let k = 0; k < 4; k++) {
    const goods = [0xd8321e, 0xf2b630, 0x6aa242, 0xe0622a][k];
    b.add(shapes.cylinder(0.22, 0.16, 0.14, 10), 0xb08a5a, { p: [x - 0.75 + k * 0.5, 0.91, z] });
    b.add(shapes.sphere(0.13, 8, 6), goods, { p: [x - 0.75 + k * 0.5, 1.0, z], s: [1, 0.6, 1] });
  }
}

function plazaMesh(plaza, obstacles, rand) {
  const b = new Batch();
  const cx = (plaza.x0 + plaza.x1) / 2;
  const cz = (plaza.z0 + plaza.z1) / 2;
  b.add(shapes.cylinder(0.95, 1.02, 0.72, 18), 0xb3ab99, { p: [cx, 0.36, cz] });
  b.add(shapes.cylinder(0.74, 0.74, 0.04, 18), 0x2f4f52, { p: [cx, 0.62, cz] });
  for (const side of [-1, 1]) b.add(shapes.box(0.14, 2.2, 0.14), 0x6a4428, { p: [cx + side * 0.95, 1.1, cz] });
  b.add(shapes.cylinder(0.06, 0.06, 2.1, 8), 0x4a2c1e, { p: [cx, 1.85, cz], r: [0, 0, Math.PI / 2] });
  for (const side of [-1, 1]) b.add(shapes.box(2.5, 0.07, 0.95), 0x8a4a2e, { p: [cx, 2.52, cz + side * 0.4], r: [side * 0.55, 0, 0] });
  obstacles.push({ minX: cx - 1.05, maxX: cx + 1.05, minZ: cz - 1.05, maxZ: cz + 1.05, minY: 0, maxY: 3 });
  const stalls = [
    [cx - 5.5, cz - 5],
    [cx + 5.5, cz - 5],
    [cx - 5.5, cz + 5],
    [cx + 5.5, cz + 5],
  ];
  stalls.forEach(([x, z], i) => {
    stall(b, x, z, STALL_CLOTHS[i]);
    obstacles.push({ minX: x - 1.15, maxX: x + 1.15, minZ: z - 0.6, maxZ: z + 0.6, minY: 0, maxY: 2.4 });
  });
  for (const [x, z] of [
    [plaza.x0 + 1.5, plaza.z1 - 2],
    [plaza.x1 - 2.5, plaza.z1 - 2],
  ]) {
    roundTree(b, rand, { x, z, h: 4 });
    obstacles.push({ minX: x + 0.2, maxX: x + 0.8, minZ: z + 0.2, maxZ: z + 0.8, minY: 0, maxY: 4 });
  }
  return b.mesh();
}

function streetMesh(plaza) {
  const parts = [roundedRectGeometry(BOUNDS.x0, MAIN.z0, EAST_GATE + 1, MAIN.z1, 0.4)];
  for (const x of AVENUES) parts.push(roundedRectGeometry(x - STREET / 2, NORTH_STREET - STREET / 2, x + STREET / 2, SOUTH_STREET + STREET / 2, 0.4));
  for (const z of [NORTH_STREET, SOUTH_STREET]) parts.push(roundedRectGeometry(AVENUES[0], z - STREET / 2, AVENUES[AVENUES.length - 1], z + STREET / 2, 0.4));
  parts.push(roundedRectGeometry(plaza.x0, plaza.z0, plaza.x1, plaza.z1, 0.6));
  const merged = mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)), false);
  return groundDecal(merged, paving(), PAVING_LAYER, 0.014);
}

export const DISTRICT_STREETS = [[BOUNDS.x0 + 2, MAIN.z0 + 0.5, EAST_GATE - 2, MAIN.z1 - 0.5]];

export function createDistrict() {
  const { blocks, plaza } = layout();
  const obstacles = [];
  for (const block of blocks) for (const house of block.houses) obstacles.push(footprint(house, house.width));
  obstacles.push(...villageGateObstacles(EAST_GATE));
  const rand = makeRandom(7272);
  const group = new THREE.Group();
  const clickables = [];
  const streets = streetMesh(plaza);
  group.add(streets);
  clickables.push(streets);
  const props = plazaMesh(plaza, obstacles, rand);
  const gate = createVillageGate(EAST_GATE);
  group.add(props, ...gate);
  const lift = (node) => {
    node.traverse((child) => {
      if (child.isMesh && child !== streets) child.renderOrder = ABOVE_PAVING;
    });
  };
  lift(group);
  freeze(group);
  const pending = [...blocks];

  return {
    obstacles,
    region() {
      return {
        id: 'district',
        name: 'Xóm Bàn Cờ',
        bounds: BOUNDS,
        staticNav: true,
        load() {
          return {
            group,
            clickables,
            obstacles: [],
            update() {
              const block = pending.shift();
              if (!block) return;
              const holder = new THREE.Group();
              holder.add(...buildBlock(block));
              lift(holder);
              freeze(holder);
              group.add(holder);
              clickables.push(...holder.children);
            },
          };
        },
      };
    },
  };
}
