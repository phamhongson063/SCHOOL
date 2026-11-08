import * as THREE from 'three';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { GROUND_LAYER, tileRoofMeshes } from './scenery.js';
import { plaqueBoard } from './village.js';
import { terrainHeight } from './terrain.js';

const ROAD_MID = 35;
const HEDGE_GAP = 1.7;
const HEDGES = [
  { id: 'west', z: 17.5, x0: -62, x1: -23.5, gaps: [[-53.5, -47]], bounds: { x0: -64, z0: 10, x1: -20, z1: 25 } },
  { id: 'north', z: 17.5, x0: 23.5, x1: 99, gaps: [[33.8, 39.2]], bounds: { x0: 20, z0: 10, x1: 101, z1: 25 } },
  { id: 'south', z: 53.5, x0: 51, x1: 99, gaps: [], bounds: { x0: 48, z0: 48, x1: 101, z1: 59 } },
];
const RICE = { x0: -148, z0: 40, x1: -113, z1: 63, cols: 4, rows: 3, dike: 0.5, spacing: 0.6 };
const RICE_BOUNDS = { x0: -150, z0: 30, x1: -104, z1: 66 };
const RICE_CYCLE = 24;
const RICE_STAGES = [
  [0, 0x9ad472],
  [8, 0x5fae48],
  [15, 0x6aa842],
  [19, 0xd9b84a],
  [22, 0xc9a65a],
  [24, 0x9ad472],
];
const WEST_GATE = -118;
const SIGNS = [
  { region: 'west', x: -47.6, z: 31.3, toward: Math.PI, text: 'Lên núi' },
  { region: 'north', x: 35.6, z: 38.7, toward: Math.PI, text: 'Lên núi' },
  { region: 'south', x: 51.2, z: 37.4, toward: 0, text: 'Bến sông' },
  { region: 'rice', x: -73.6, z: 38.2, toward: 0, text: 'Ruộng rau' },
  { region: 'rice', x: -113.6, z: 38.4, toward: 0, text: 'Ruộng lúa' },
  { region: 'north', x: 101.5, z: 31.3, toward: Math.PI / 2, text: 'Xóm Bàn Cờ' },
];

const PAVING_ORDER = GROUND_LAYER.mark + 2;

function bambooMeshes(clumps, rand) {
  const culm = new THREE.CylinderGeometry(0.045, 0.06, 1, 5).translate(0, 0.5, 0);
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const culms = new THREE.InstancedMesh(culm, toonMaterial({ muted: true, color: 0x8aa04a }), clumps.length * 6);
  const leaves = new THREE.InstancedMesh(leaf, toonMaterial({ muted: true, flatShading: true }), clumps.length * 4);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let c = 0;
  let l = 0;
  for (const { x, z } of clumps) {
    const y = terrainHeight(x, z);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rand() * 0.6;
      const r = 0.12 + rand() * 0.22;
      const height = 5 + rand() * 2.6;
      const lean = 0.06 + rand() * 0.16;
      dummy.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      dummy.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      culms.setMatrixAt(c, dummy.matrix);
      culms.setColorAt(c++, color.setHex(0x8aa04a).offsetHSL(rand() * 0.04 - 0.02, 0, rand() * 0.1 - 0.05));
    }
    for (let k = 0; k < 4; k++) {
      const a = rand() * Math.PI * 2;
      const out = 0.4 + rand() * 0.6;
      dummy.position.set(x + Math.cos(a) * out, y + 3.6 + k * 0.9 + rand() * 0.6, z + Math.sin(a) * out);
      dummy.rotation.set(rand() * 0.5, rand() * Math.PI, rand() * 0.5);
      const s = 0.7 + rand() * 0.45;
      dummy.scale.set(s * 0.9, s * 1.5, s * 0.9);
      dummy.updateMatrix();
      leaves.setMatrixAt(l, dummy.matrix);
      leaves.setColorAt(l++, color.setHex(k % 2 ? 0x5a9a3c : 0x6fae48).offsetHSL(rand() * 0.04 - 0.02, 0, rand() * 0.08 - 0.04));
    }
  }
  culms.count = c;
  leaves.count = l;
  for (const mesh of [culms, leaves]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  return [culms, leaves];
}

function signpost(b, sign) {
  const dir = { x: Math.sin(sign.toward), z: Math.cos(sign.toward) };
  const yaw = sign.toward - Math.PI / 2;
  const y = terrainHeight(sign.x, sign.z);
  b.add(shapes.cylinder(0.07, 0.08, 2.3, 7), 0x5a3a22, { p: [sign.x, y + 1.15, sign.z] });
  b.add(shapes.cone(0.2, 0.32, 4), 0x8a1d14, { p: [sign.x + dir.x * 1.05, y + 1.9, sign.z + dir.z * 1.05], r: [0, yaw, -Math.PI / 2] });
  const board = plaqueBoard([sign.text], { bg: 0x8a1d14, fg: '#ffe08a', border: 0xf2c14e });
  board.mesh.position.set(sign.x + dir.x * 0.25, y + 1.9, sign.z + dir.z * 0.25);
  board.mesh.rotation.y = yaw;
  board.mesh.castShadow = false;
  return board.mesh;
}

function villageGate(b, x, meshes) {
  for (const z of [ROAD_MID - 3.9, ROAD_MID + 3.9]) {
    b.add(shapes.box(1.1, 4.3, 1.1), 0xb85c3e, { p: [x, 2.15, z] });
    b.add(shapes.box(1.3, 0.25, 1.3), 0xb3ab99, { p: [x, 0.12, z] });
    b.add(shapes.box(1.25, 0.2, 1.25), 0xb3ab99, { p: [x, 4.35, z] });
  }
  b.add(shapes.box(0.7, 0.55, 8.9), 0x7a3020, { p: [x, 4.1, ROAD_MID] });
  b.add(shapes.box(0.5, 0.12, 8.4), 0xf2c14e, { p: [x, 3.78, ROAD_MID] });
  for (const mesh of tileRoofMeshes({ cx: 0, cz: 0, hx: 5.2, hz: 1.1, ridge: 4.3, eaveY: 4.55, height: 0.95, lift: 0.4, falloff: 1.2 })) {
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x, 0, ROAD_MID);
    meshes.push(mesh);
  }
  for (const side of [-1, 1]) {
    const plaque = plaqueBoard(['CỔNG LÀNG'], { bg: 0x1c1310, fg: '#f2c14e', border: 0xa12a1c });
    plaque.mesh.position.set(x + side * 0.37, 3.3, ROAD_MID);
    plaque.mesh.rotation.y = side * (Math.PI / 2);
    meshes.push(plaque.mesh);
  }
}

export function villageGateObstacles(x) {
  return [ROAD_MID - 3.9, ROAD_MID + 3.9].map((z) => ({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, minY: 0, maxY: 4.5 }));
}

export function createVillageGate(x) {
  const b = new Batch();
  const meshes = [];
  villageGate(b, x, meshes);
  return [b.mesh(), ...meshes];
}

function riceStageColor(day, target) {
  const t = ((day % RICE_CYCLE) + RICE_CYCLE) % RICE_CYCLE;
  for (let i = 0; i < RICE_STAGES.length - 1; i++) {
    const [a, ca] = RICE_STAGES[i];
    const [b, cb] = RICE_STAGES[i + 1];
    if (t < a || t >= b) continue;
    return target.setHex(ca).lerp(new THREE.Color(cb), (t - a) / (b - a));
  }
  return target.setHex(RICE_STAGES[0][1]);
}

function riceField() {
  const { x0, z0, x1, z1, cols, rows, dike, spacing } = RICE;
  const w = (x1 - x0) / cols;
  const d = (z1 - z0) / rows;
  const plots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) plots.push({ x0: x0 + c * w + dike / 2, z0: z0 + r * d + dike / 2, x1: x0 + (c + 1) * w - dike / 2, z1: z0 + (r + 1) * d - dike / 2 });
  }
  const waterParts = plots.map((p) => new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0).rotateX(-Math.PI / 2).translate((p.x0 + p.x1) / 2, 0, (p.z0 + p.z1) / 2));
  const water = new THREE.Mesh(
    mergePlanes(waterParts),
    toonMaterial({ color: 0x7fa592, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  water.position.y = 0.03;
  water.renderOrder = GROUND_LAYER.field;
  water.receiveShadow = true;

  const b = new Batch();
  const dikeColor = 0x8a6a48;
  for (let c = 0; c <= cols; c++) b.add(shapes.box(dike, 0.22, z1 - z0 + dike), dikeColor, { p: [x0 + c * w, 0.11, (z0 + z1) / 2] });
  for (let r = 0; r <= rows; r++) b.add(shapes.box(x1 - x0 + dike, 0.22, dike), dikeColor, { p: [(x0 + x1) / 2, 0.11, z0 + r * d] });
  const dikes = b.mesh();

  const spots = [];
  const rand = makeRandom(4747);
  for (const p of plots) {
    for (let z = p.z0 + spacing / 2; z < p.z1; z += spacing) {
      for (let x = p.x0 + spacing / 2; x < p.x1; x += spacing) spots.push([x + (rand() - 0.5) * 0.12, z + (rand() - 0.5) * 0.12, 0.8 + rand() * 0.4, rand() * Math.PI]);
    }
  }
  const tuft = new THREE.ConeGeometry(0.1, 0.6, 5).translate(0, 0.3, 0);
  const material = toonMaterial({ muted: true, color: 0x5fae48 });
  const rice = new THREE.InstancedMesh(tuft, material, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z, s, turn], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, turn, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    rice.setMatrixAt(i, dummy.matrix);
  });
  rice.instanceMatrix.needsUpdate = true;
  rice.computeBoundingSphere();
  rice.receiveShadow = true;
  return { meshes: [water, dikes, rice], material };
}

function mergePlanes(parts) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const index = [];
  let offset = 0;
  for (const part of parts) {
    positions.push(...part.attributes.position.array);
    normals.push(...part.attributes.normal.array);
    uvs.push(...part.attributes.uv.array);
    for (const i of part.index.array) index.push(i + offset);
    offset += part.attributes.position.count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

export function createCountryside() {
  const rand = makeRandom(3838);
  const obstacles = [];
  const groups = new Map();
  const groupFor = (id) => {
    let group = groups.get(id);
    if (!group) {
      group = new THREE.Group();
      groups.set(id, group);
    }
    return group;
  };

  for (const hedge of HEDGES) {
    const clumps = [];
    for (let x = hedge.x0; x <= hedge.x1; x += HEDGE_GAP) {
      if (hedge.gaps.some(([a, b]) => x > a && x < b)) continue;
      const cx = x + (rand() - 0.5) * 0.5;
      const cz = hedge.z + (rand() - 0.5) * 0.7;
      clumps.push({ x: cx, z: cz });
      obstacles.push({ minX: cx - 0.5, maxX: cx + 0.5, minZ: cz - 0.5, maxZ: cz + 0.5, minY: terrainHeight(cx, cz) - 1, maxY: 6 });
    }
    groupFor(hedge.id).add(...bambooMeshes(clumps, rand));
  }

  const signBatches = new Map();
  for (const sign of SIGNS) {
    if (!signBatches.has(sign.region)) signBatches.set(sign.region, new Batch());
    groupFor(sign.region).add(signpost(signBatches.get(sign.region), sign));
    obstacles.push({ minX: sign.x - 0.2, maxX: sign.x + 0.2, minZ: sign.z - 0.2, maxZ: sign.z + 0.2, minY: 0, maxY: 2.4 });
  }
  for (const [id, batch] of signBatches) groupFor(id).add(batch.mesh());

  const rice = riceField();
  groupFor('rice').add(...rice.meshes, ...createVillageGate(WEST_GATE));
  obstacles.push(...villageGateObstacles(WEST_GATE));

  for (const group of groups.values()) {
    group.traverse((node) => {
      if (node.isMesh && node.renderOrder === 0) node.renderOrder = PAVING_ORDER;
    });
    freeze(group);
  }

  const color = new THREE.Color();
  let shownDay = null;
  const bounds = {
    west: HEDGES[0].bounds,
    north: HEDGES[1].bounds,
    south: HEDGES[2].bounds,
    rice: RICE_BOUNDS,
  };

  return {
    obstacles,
    update(day) {
      if (day === shownDay) return;
      shownDay = day;
      rice.material.color.copy(riceStageColor(day, color));
    },
    regions() {
      return [...groups.entries()].map(([id, group]) => ({
        id: `country-${id}`,
        name: id === 'rice' ? 'Ruộng lúa' : 'Lũy tre',
        bounds: bounds[id],
        staticNav: true,
        load() {
          return { group, clickables: [], obstacles: [] };
        },
      }));
    },
  };
}
