import * as THREE from 'three';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { GROUND_LAYER, tileRoofMeshes } from './scenery.js';
import { plaqueBoard } from './village.js';
import { terrainHeight } from './terrain.js';
import { FIELDS } from './fieldPlan.js';
import { ROAD } from './road.js';
import { GATES } from './config.js';

const ROAD_MID = (ROAD.z0 + ROAD.z1) / 2;
const GATE_HALF = (ROAD.z1 - ROAD.z0) / 2 + 0.9;
const HEDGE_GAP = 1.7;
const HEDGES = [
  { id: 'west', z: 17.5, x0: -62, x1: -23.5, gaps: [[-53.5, -47]], bounds: { x0: -64, z0: 10, x1: -20, z1: 25 } },
  { id: 'north', z: 16.8, x0: 23.5, x1: 151, gaps: [[33.8, 39.2]], bounds: { x0: 20, z0: 16, x1: 153, z1: 25 } },
  { id: 'south', z: 55.5, x0: 51, x1: 148, gaps: [], bounds: { x0: 48, z0: 50, x1: 150, z1: 61 } },
];
const FIELD_GAP = 0.8;
const fieldGaps = (z) => FIELDS.flatMap(({ soil: [patch] }) => (z >= patch.z0 && z <= patch.z1 ? [[patch.x0 - FIELD_GAP, patch.x1 + FIELD_GAP]] : []));
const WEST_GATE = GATES.west;
const EAST_GATE = GATES.east;
const GATE_BOUNDS = { x0: -200, z0: 30, x1: -183, z1: 42 };
const EAST_GATE_BOUNDS = { x0: 183, z0: 30, x1: 200, z1: 42 };
const SIGNS = [
  { region: 'west', x: -47.6, z: 30.3, toward: Math.PI, text: 'Lên núi' },
  { region: 'north', x: 35.6, z: 40.2, toward: Math.PI, text: 'Lên núi' },
  { region: 'south', x: 51.2, z: 40.4, toward: 0, text: 'Bến sông' },
  { region: 'west', x: -54, z: 30.4, toward: -Math.PI / 2, text: 'Xóm Bàn Cờ' },
];

const PAVING_ORDER = GROUND_LAYER.mark + 2;

function bambooMeshes(clumps, rand) {
  const culm = new THREE.CylinderGeometry(0.045, 0.06, 1, 5).translate(0, 0.5, 0);
  const leaf = new THREE.IcosahedronGeometry(1, 0);
  const culms = new THREE.InstancedMesh(culm, toonMaterial({ muted: true, color: 0x8aa04a }), clumps.length * 6);
  const leaves = new THREE.InstancedMesh(leaf, toonMaterial({ muted: true }), clumps.length * 4);
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
  for (const z of [ROAD_MID - GATE_HALF, ROAD_MID + GATE_HALF]) {
    b.add(shapes.box(1.1, 4.3, 1.1), 0xb85c3e, { p: [x, 2.15, z] });
    b.add(shapes.box(1.3, 0.25, 1.3), 0xb3ab99, { p: [x, 0.12, z] });
    b.add(shapes.box(1.25, 0.2, 1.25), 0xb3ab99, { p: [x, 4.35, z] });
  }
  b.add(shapes.box(0.7, 0.55, GATE_HALF * 2 + 1.1), 0x7a3020, { p: [x, 4.1, ROAD_MID] });
  b.add(shapes.box(0.5, 0.12, GATE_HALF * 2 + 0.6), 0xf2c14e, { p: [x, 3.78, ROAD_MID] });
  for (const mesh of tileRoofMeshes({ cx: 0, cz: 0, hx: GATE_HALF + 1.3, hz: 1.1, ridge: 4.3, eaveY: 4.55, height: 0.95, lift: 0.4, falloff: 1.2 })) {
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
  return [ROAD_MID - GATE_HALF, ROAD_MID + GATE_HALF].map((z) => ({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, minY: 0, maxY: 4.5 }));
}

export function createVillageGate(x) {
  const b = new Batch();
  const meshes = [];
  villageGate(b, x, meshes);
  return [b.mesh(), ...meshes];
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
      if ([...hedge.gaps, ...fieldGaps(hedge.z)].some(([a, b]) => x > a && x < b)) continue;
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

  groupFor('gate').add(...createVillageGate(WEST_GATE));
  obstacles.push(...villageGateObstacles(WEST_GATE));
  groupFor('eastGate').add(...createVillageGate(EAST_GATE));
  obstacles.push(...villageGateObstacles(EAST_GATE));

  for (const group of groups.values()) {
    group.traverse((node) => {
      if (node.isMesh && node.renderOrder === 0) node.renderOrder = PAVING_ORDER;
    });
    freeze(group);
  }

  const bounds = {
    west: HEDGES[0].bounds,
    north: HEDGES[1].bounds,
    south: HEDGES[2].bounds,
    gate: GATE_BOUNDS,
    eastGate: EAST_GATE_BOUNDS,
  };

  return {
    obstacles,
    regions() {
      return [...groups.entries()].map(([id, group]) => ({
        id: `country-${id}`,
        name: id === 'gate' || id === 'eastGate' ? 'Cổng làng' : 'Lũy tre',
        bounds: bounds[id],
        staticNav: true,
        load() {
          return { group, clickables: [], obstacles: [] };
        },
      }));
    },
  };
}
