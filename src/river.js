import * as THREE from 'three';
import { Batch, canvasTexture, freeze, shade, shapes, toonMaterial, vertexMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundDecal, GROUND_LAYER, roundedRectGeometry } from './scenery.js';
import { FISH, FISHING, WORLD } from './config.js';
import { minuteOfDay } from './clock.js';
import { moonLight, moonPhase } from './sky.js';
import { createLanternGlow } from './lanternGlow.js';
import { ServiceQueue } from './queue.js';

const KEY = 'truong-lang-xua.river';
const SPAN = { x0: WORLD.x0 - 200, x1: WORLD.x1 + 200 };
const SPAN_SCALE = (SPAN.x1 - SPAN.x0) / 200;
const DOCK = { x0: 44.6, x1: 46.4, z0: 68.8, z1: 76.6 };
const DOCK_X = (DOCK.x0 + DOCK.x1) / 2;
const PATH = { x0: 44.4, x1: 46.6, z0: 37, bypassX0: 47.8, bypassX1: 49.8, bendZ0: 53.6, bendZ1: 55.6 };
const REACH = { x0: WORLD.x0 - 2, x1: WORLD.x1 + 2 };
const SEGMENT = 3;
const STEP = 1;
const FISH_PICK_RADIUS = 6;
const QUEUE_DEPTH = 9;
const QUEUE_PENALTY = 12;
const BOAT_X = 38.5;
const BANK_RANGE = { x0: WORLD.x0 + 5, x1: WORLD.x1 - 5, step: 5 };
const BANK_SPOTS = [];
for (let x = BANK_RANGE.x0; x <= BANK_RANGE.x1; x += BANK_RANGE.step) {
  if (Math.abs(x - DOCK_X) > 4 && Math.abs(x - BOAT_X) > 3) BANK_SPOTS.push(x);
}
const DROPS = 300;
const RING_SECONDS = 1.3;
const SPLASH_GROW = 4.5;
const RIPPLE_GROW = 2.2;
const RIPPLE_REACH = 2;
const WOOD = 0x7a5232;
const WOOD_DARK = 0x553820;
const REED = [0x7fa443, 0x9ab84a, 0x6a8a3a];
const PEBBLES = [0x9e9484, 0xb3ab99, 0x857c6c];
const FLOW_SPEED = 0.05;
const HYACINTHS = 30;

const between = (a, b) => a + Math.random() * (b - a);
const randomInt = ([lo, hi]) => lo + Math.floor(Math.random() * (hi - lo + 1));
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x, at, width, amount) => amount * Math.exp(-(((x - at) / width) ** 2));
const fade = (x) => smooth(4, 12, Math.abs(x - DOCK_X));

export function northBank(x) {
  const wave = 1.1 * Math.sin(x * 0.045 + 1) + 0.6 * Math.sin(x * 0.11 + 2.3) + 0.3 * Math.sin(x * 0.23 + 0.4) + bump(x, 8, 5, 1.6) + bump(x, -28, 6, -1.2) + bump(x, 78, 5, 1.4);
  return 70 + wave * fade(x);
}

export function southBank(x) {
  const wave = 1.3 * Math.sin(x * 0.05 + 4) + 0.7 * Math.sin(x * 0.13 + 0.7) + 0.35 * Math.sin(x * 0.27 + 1.9) + bump(x, 30, 6, -1.8) + bump(x, 92, 5, -1.5) + bump(x, -45, 7, -1.3);
  return 130 + wave * (0.4 + 0.6 * fade(x));
}

function lowestNorth(x, half) {
  let low = Infinity;
  for (let s = x - half; s <= x + half + 1e-6; s += 0.25) low = Math.min(low, northBank(s));
  return low;
}

function makeSpots() {
  const spots = [];
  const add = (stand, float, line) =>
    spots.push({ id: spots.length, stand, float, facing: Math.atan2(float.x - stand.x, float.z - stand.z), queue: new ServiceQueue(line, float), fish: 0, jumpAt: 0, rippleAt: 0 });
  const dockLine = (stand) => [stand, { x: DOCK_X, z: stand.z - 0.8 }, { x: DOCK_X, z: DOCK.z0 - QUEUE_DEPTH }];
  const dockEnd = { x: DOCK_X, z: DOCK.z1 - 0.5 };
  add(dockEnd, { x: DOCK_X, z: DOCK.z1 + 1.7 }, [dockEnd, { x: DOCK_X, z: DOCK.z0 - QUEUE_DEPTH }]);
  for (const z of [72.6, 74.6]) {
    const west = { x: DOCK.x0 + 0.3, z };
    const east = { x: DOCK.x1 - 0.3, z };
    add(west, { x: DOCK.x0 - 2.4, z }, dockLine(west));
    add(east, { x: DOCK.x1 + 2.4, z }, dockLine(east));
  }
  for (const x of BANK_SPOTS) {
    const stand = { x, z: lowestNorth(x, SEGMENT) - 0.5 };
    add(stand, { x, z: northBank(x) + 2.5 }, [stand, { x, z: stand.z - QUEUE_DEPTH }]);
  }
  return spots;
}

function ribbon(x0, x1, edgeA, edgeB) {
  const positions = [];
  const uvs = [];
  const indices = [];
  let row = 0;
  for (let x = x0; x <= x1 + 1e-6; x += STEP, row++) {
    const a = edgeA(x);
    const b = edgeB(x);
    positions.push(x, 0, a, x, 0, b);
    uvs.push(x, -a, x, -b);
    if (row === 0) continue;
    const i = (row - 1) * 2;
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  for (let i = 0; i < geometry.attributes.normal.count; i++) geometry.attributes.normal.setXYZ(i, 0, 1, 0);
  geometry.computeBoundingSphere();
  return geometry;
}

function flowTexture() {
  return canvasTexture(
    256,
    (ctx, s) => {
      const rand = makeRandom(5252);
      ctx.fillStyle = '#e4f1f7';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const len = 18 + rand() * 46;
        const light = rand() < 0.6;
        ctx.strokeStyle = light ? `rgba(255,255,255,${0.35 + rand() * 0.4})` : `rgba(120,165,190,${0.18 + rand() * 0.2})`;
        ctx.lineWidth = 1 + rand() * 2.2;
        ctx.lineCap = 'round';
        for (const dx of [-s, 0, s]) {
          for (const dy of [-s, 0, s]) {
            ctx.beginPath();
            ctx.moveTo(x + dx, y + dy);
            ctx.quadraticCurveTo(x + dx + len / 2, y + dy + (rand() - 0.5) * 6, x + dx + len, y + dy);
            ctx.stroke();
          }
        }
      }
    },
    [1 / 7, 1 / 7],
  );
}

function boat(b, z) {
  const hull = 0x6a4a2c;
  b.group([BOAT_X, 0, z], [0, 0.08, 0], () => {
    b.add(shapes.box(3.4, 0.35, 1.1), hull, { p: [0, 0.05, 0] });
    for (const side of [-1, 1]) {
      b.add(shapes.box(0.9, 0.35, 0.9), hull, { p: [side * 1.95, 0.12, 0], r: [0, 0, side * 0.35], s: [1, 1, 0.85] });
      b.add(shapes.box(3.6, 0.08, 0.08), WOOD_DARK, { p: [0, 0.26, side * 0.55] });
    }
    b.add(shapes.box(3.2, 0.04, 0.95), 0x8a6a42, { p: [0, 0.2, 0] });
    b.add(new THREE.CylinderGeometry(0.62, 0.62, 1.4, 12, 1, true, 0, Math.PI), 0x9a7a4a, { p: [0.2, 0.22, 0], r: [0, 0, Math.PI / 2] });
    b.limb([1.6, 0.25, 0.2], [2.9, 1.6, 0.9], 0.03, 0xc8a868, { capsule: false, seg: 5 });
  });
}

function dock(b) {
  const { x0, x1, z0, z1 } = DOCK;
  let k = 0;
  for (let z = z0; z < z1; z += 0.32, k++) {
    b.add(shapes.box(x1 - x0, 0.06, 0.28), k % 2 ? 0x8a603a : WOOD, { p: [(x0 + x1) / 2, 0.035, z + 0.14] });
  }
  for (const x of [x0 + 0.08, x1 - 0.08]) {
    b.add(shapes.box(0.1, 0.1, z1 - z0), WOOD_DARK, { p: [x, -0.02, (z0 + z1) / 2] });
    for (let z = z0 + 1.2; z <= z1; z += 2) b.add(shapes.cylinder(0.09, 0.1, 1.2, 6), WOOD_DARK, { p: [x, -0.45, z] });
    b.add(shapes.cylinder(0.07, 0.08, 1.6, 6), WOOD_DARK, { p: [x, 0.8, z1 - 0.15] });
    b.add(shapes.box(0.35, 0.05, 0.05), WOOD_DARK, { p: [x + (x < DOCK_X ? 0.12 : -0.12), 1.55, z1 - 0.15] });
  }
}

function shoreline(b, rand) {
  const skip = (x) => Math.abs(x - DOCK_X) < 5 || Math.abs(x - BOAT_X) < 3 || BANK_SPOTS.some((spot) => Math.abs(x - spot) < 1.6);
  for (let i = 0; i < 90 * SPAN_SCALE; i++) {
    const x = SPAN.x0 + 8 + rand() * (SPAN.x1 - SPAN.x0 - 16);
    if (skip(x)) continue;
    const north = rand() < 0.55;
    const z = north ? northBank(x) + 0.1 + rand() * 0.4 : southBank(x) - 0.1 - rand() * 0.4;
    const blades = 4 + Math.floor(rand() * 4);
    for (let k = 0; k < blades; k++) {
      const h = 0.6 + rand() * 0.8;
      const a = rand() * Math.PI * 2;
      b.add(shapes.cone(0.025, h, 4), REED[k % REED.length], {
        p: [x + Math.cos(a) * 0.12, h / 2 - 0.05, z + Math.sin(a) * 0.12],
        r: [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2],
        flat: true,
      });
    }
  }
  for (let i = 0; i < 140 * SPAN_SCALE; i++) {
    const x = SPAN.x0 + 4 + rand() * (SPAN.x1 - SPAN.x0 - 8);
    if (Math.abs(x - DOCK_X) < 2) continue;
    const north = rand() < 0.5;
    const z = north ? northBank(x) - 0.1 + rand() * 0.25 : southBank(x) - 0.15 + rand() * 0.25;
    const r = 0.08 + rand() * 0.16;
    b.add(shapes.ico(r, 0), shade(PEBBLES[i % PEBBLES.length], 0.85 + rand() * 0.25), { p: [x, r * 0.25, z], s: [1.4, 0.55, 1.1], r: [0, rand() * 3, 0], flat: true });
  }
}

let lanternMaterial = null;

const DOCK_LANTERNS = [
  [DOCK.x0 + 0.22, 0xd8321e],
  [DOCK.x1 - 0.22, 0xf2b630],
];

function dockLanterns() {
  lanternMaterial ??= toonMaterial({ vertexColors: true, emissive: 0xff8a3a, emissiveIntensity: 0 });
  const b = new Batch();
  for (const [x, color] of DOCK_LANTERNS) {
    const z = DOCK.z1 - 0.15;
    b.add(shapes.sphere(0.18, 10, 8), color, { p: [x, 1.25, z], s: [1, 1.25, 1] });
    b.add(shapes.cylinder(0.08, 0.09, 0.05, 8), 0xf2c14e, { p: [x, 1.48, z] });
    b.add(shapes.cylinder(0.09, 0.08, 0.05, 8), 0xf2c14e, { p: [x, 1.02, z] });
  }
  return b.mesh(lanternMaterial, { shadow: false });
}

function hyacinthGeometry() {
  const b = new Batch();
  const rand = makeRandom(6464);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.4;
    const r = 0.16 + rand() * 0.08;
    b.add(shapes.sphere(0.07, 8, 6), 0x9cc85a, { p: [Math.cos(a) * 0.1, 0.04, Math.sin(a) * 0.1], s: [1, 0.8, 1] });
    b.add(shapes.sphere(0.13, 10, 6), i % 2 ? 0x3f8a3a : 0x5fae48, {
      p: [Math.cos(a) * r, 0.16 + rand() * 0.06, Math.sin(a) * r],
      s: [0.9, 0.35, 1.15],
      r: [0, -a, 0.5],
      flat: true,
    });
  }
  b.add(shapes.cylinder(0.24, 0.28, 0.04, 10), 0x4f7a3a, { p: [0, 0, 0] });
  b.limb([0, 0.1, 0], [0.02, 0.48, 0.01], 0.015, 0x6aa242, { capsule: false, seg: 5 });
  for (let k = 0; k < 6; k++) {
    const a = k * 2.2;
    b.add(shapes.sphere(0.045, 6, 5), k % 2 ? 0xb58ad8 : 0x9a6ac8, { p: [0.02 + Math.cos(a) * 0.04, 0.32 + k * 0.035, 0.01 + Math.sin(a) * 0.04] });
  }
  return b.geometry();
}

function loadZones() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && saved.zones && typeof saved.zones === 'object' && Array.isArray(saved.pending)) return saved;
  } catch {}
  return null;
}

function fishGeometry() {
  const b = new Batch();
  b.add(
    shapes.lathe([[0.001, 0], [0.018, 0.02], [0.04, 0.08], [0.058, 0.16], [0.06, 0.22], [0.05, 0.28], [0.028, 0.325], [0.001, 0.34]], 14),
    0xa8b6bc,
    { p: [0, 0, -0.17], r: [Math.PI / 2, 0, 0], s: [0.62, 1, 1] },
  );
  b.add(shapes.sphere(0.05, 10, 6), 0x4f6672, { p: [0, 0.03, 0.01], s: [0.55, 0.5, 3] });
  b.add(shapes.sphere(0.05, 10, 6), 0xe9eef0, { p: [0, -0.028, 0.03], s: [0.6, 0.45, 2.6] });
  b.add(shapes.box(0.008, 0.075, 0.05), 0x7f939c, { p: [0, 0.03, -0.205], r: [-0.7, 0, 0] });
  b.add(shapes.box(0.008, 0.075, 0.05), 0x7f939c, { p: [0, -0.03, -0.205], r: [0.7, 0, 0] });
  b.add(shapes.box(0.006, 0.05, 0.09), 0x5d7480, { p: [0, 0.068, 0.02], r: [-0.35, 0, 0] });
  for (const side of [-1, 1]) {
    b.add(shapes.box(0.04, 0.006, 0.03), 0x8fa3ab, { p: [side * 0.035, -0.02, 0.1], r: [0, 0, side * 0.5] });
    b.add(shapes.sphere(0.015, 8, 6), 0xffffff, { p: [side * 0.024, 0.014, 0.25] });
    b.add(shapes.sphere(0.009, 6, 4), 0x111111, { p: [side * 0.032, 0.014, 0.255] });
  }
  return b.geometry();
}

function waterObstacles() {
  const boxes = [];
  const segment = (x0, x1) => {
    let low = Infinity;
    let high = -Infinity;
    for (let x = x0; x <= x1 + 1e-6; x += 0.25) {
      low = Math.min(low, northBank(x));
      high = Math.max(high, southBank(x));
    }
    boxes.push({ minX: x0, maxX: x1, minZ: low, maxZ: high, minY: -1, maxY: 2 });
  };
  for (let x = REACH.x0; x < DOCK.x0 - 0.1; x += SEGMENT) segment(x, Math.min(x + SEGMENT, DOCK.x0 - 0.1));
  for (let x = DOCK.x1 + 0.1; x < REACH.x1; x += SEGMENT) segment(x, Math.min(x + SEGMENT, REACH.x1));
  let high = -Infinity;
  for (let x = DOCK.x0 - 0.1; x <= DOCK.x1 + 0.1; x += 0.2) high = Math.max(high, southBank(x));
  boxes.push({ minX: DOCK.x0 - 0.1, maxX: DOCK.x1 + 0.1, minZ: DOCK.z1, maxZ: high, minY: -1, maxY: 2 });
  return boxes;
}

export function createRiver() {
  const spots = makeSpots();
  const saved = loadZones();
  const pending = [];
  const obstacles = waterObstacles();

  const group = new THREE.Group();
  const flow = flowTexture();
  const water = new THREE.Mesh(
    ribbon(SPAN.x0, SPAN.x1, (x) => northBank(x) - 0.3, (x) => southBank(x) + 0.3),
    toonMaterial({ color: 0x4f9fc9, map: flow, transparent: true, opacity: 0.92 }),
  );
  water.position.y = 0.03;
  water.receiveShadow = true;
  group.add(water);
  const earth = earthMaterial();
  const banks = [
    groundDecal(ribbon(SPAN.x0, SPAN.x1, (x) => northBank(x) - 1.8, (x) => northBank(x) + 0.35), earth, GROUND_LAYER.earth, 0.012),
    groundDecal(ribbon(SPAN.x0, SPAN.x1, (x) => southBank(x) - 0.35, (x) => southBank(x) + 1.6), earth, GROUND_LAYER.earth, 0.012),
    groundDecal(roundedRectGeometry(PATH.bypassX0, PATH.z0, PATH.bypassX1, PATH.bendZ1, 0.5), earth, GROUND_LAYER.earth),
    groundDecal(roundedRectGeometry(PATH.x0, PATH.bendZ0, PATH.bypassX1, PATH.bendZ1, 0.5), earth, GROUND_LAYER.earth),
    groundDecal(roundedRectGeometry(PATH.x0, PATH.bendZ0, PATH.x1, northBank(DOCK_X) - 0.2, 0.5), earth, GROUND_LAYER.earth),
  ];
  group.add(...banks);
  const b = new Batch();
  dock(b);
  boat(b, northBank(BOAT_X) + 2.6);
  shoreline(b, makeRandom(8181));
  const details = b.mesh();
  group.add(details, dockLanterns());
  const lanternGlow = createLanternGlow(DOCK_LANTERNS.map(([x, tint]) => ({ position: new THREE.Vector3(x, 1.25, DOCK.z1 - 0.15), tint })));
  group.add(lanternGlow.object);
  let night = 0;

  const floaters = new THREE.InstancedMesh(hyacinthGeometry(), vertexMaterial(), HYACINTHS);
  floaters.count = 0;
  floaters.frustumCulled = false;
  floaters.castShadow = false;
  floaters.receiveShadow = true;
  group.add(floaters);
  freeze(group);

  const drifting = [];
  const matrix = new THREE.Matrix4();
  const spin = new THREE.Quaternion();
  const place = new THREE.Vector3();
  const size = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let spawnAt = 0;
  let clock = 0;

  const laneZ = (x, offset) => {
    const north = northBank(x);
    const south = southBank(x);
    const lo = north + 4.2;
    const hi = south - 1;
    let z = lo > hi ? (north + south) / 2 : Math.min(hi, Math.max(lo, (north + south) / 2 + offset));
    if (Math.abs(x - DOCK_X) < 3) z = Math.max(z, DOCK.z1 + 0.8);
    return z;
  };
  const spawn = (x) => {
    drifting.push({ x, offset: between(0.8, 2.4), speed: between(0.35, 0.6), turn: Math.random() * Math.PI * 2, spin: between(-0.25, 0.25), phase: Math.random() * Math.PI * 2, scale: between(0.8, 1.25) });
  };
  for (let i = 0; i < HYACINTHS / 2; i++) spawn(between(SPAN.x0 + 10, SPAN.x1 - 10));

  const fishMaterial = vertexMaterial();
  const fishShape = fishGeometry();
  const jumpers = Array.from({ length: FISHING.zones * 6 }, () => {
    const mesh = new THREE.Mesh(fishShape, fishMaterial);
    mesh.rotation.order = 'YXZ';
    mesh.visible = false;
    mesh.castShadow = false;
    group.add(mesh);
    return { mesh, t: -1, wait: 0, duration: 1, height: 0.6, travel: 0.8, from: new THREE.Vector3(), dir: new THREE.Vector3() };
  });
  const ringShape = new THREE.RingGeometry(0.12, 0.2, 24);
  ringShape.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: FISHING.zones * 16 }, () => {
    const mesh = new THREE.Mesh(ringShape, new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, depthWrite: false }));
    mesh.visible = false;
    mesh.renderOrder = 2;
    group.add(mesh);
    return { mesh, t: -1, grow: SPLASH_GROW, alpha: 0.75 };
  });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: 0xdff2ff }), DROPS);
  drops.count = 0;
  drops.frustumCulled = false;
  drops.castShadow = false;
  group.add(drops);
  const flying = [];
  const dropMatrix = new THREE.Matrix4();
  group.matrixWorldAutoUpdate = true;

  const save = () => {
    const zones = {};
    for (const spot of spots) if (spot.fish > 0) zones[spot.id] = spot.fish;
    try {
      localStorage.setItem(KEY, JSON.stringify({ zones, pending }));
    } catch {}
  };

  const zoneCount = () => spots.reduce((count, spot) => count + (spot.fish > 0 ? 1 : 0), 0);

  function openZone() {
    if (zoneCount() >= FISHING.zones) return;
    const empty = spots.filter((spot) => spot.fish <= 0);
    if (!empty.length) return;
    const spot = empty[Math.floor(Math.random() * empty.length)];
    spot.fish = randomInt(FISHING.zoneFish);
    spot.jumpAt = clock + between(0.5, 2);
  }

  if (saved) {
    for (const [id, count] of Object.entries(saved.zones)) {
      const spot = spots[Number(id)];
      if (spot && Number.isFinite(count) && count > 0 && zoneCount() < FISHING.zones) spot.fish = Math.floor(count);
    }
    pending.push(...saved.pending.filter(Number.isFinite).sort((a, b) => a - b).slice(0, Math.max(0, FISHING.zones - zoneCount())));
  } else {
    for (let i = 0; i < FISHING.zones; i++) openZone();
    save();
  }

  function refill(minutes) {
    let changed = false;
    while (pending.length && pending[0] <= minutes) {
      pending.shift();
      openZone();
      changed = true;
    }
    while (zoneCount() + pending.length < FISHING.zones) {
      pending.push(minutes + randomInt(FISHING.zoneRespawn));
      pending.sort((a, b) => a - b);
      changed = true;
    }
    if (changed) save();
  }

  function ring(x, z, grow, alpha) {
    const item = rings.find((candidate) => candidate.t < 0);
    if (!item) return;
    item.t = 0;
    item.grow = grow;
    item.alpha = alpha;
    item.mesh.position.set(x, 0.06, z);
    item.mesh.scale.setScalar(1);
    item.mesh.visible = true;
  }

  function ripple(spot) {
    const angle = Math.random() * Math.PI * 2;
    const reach = Math.sqrt(Math.random()) * RIPPLE_REACH;
    const z = Math.max(spot.float.z - 0.4, spot.float.z + Math.sin(angle) * reach);
    ring(spot.float.x + Math.cos(angle) * reach, z, RIPPLE_GROW * between(0.7, 1.2), 0.45);
  }

  function splash(x, z, strength = 1) {
    ring(x, z, SPLASH_GROW * strength, 0.75);
    const count = Math.round(5 + strength * 8);
    for (let i = 0; i < count && flying.length < DROPS; i++) {
      const angle = Math.random() * Math.PI * 2;
      const out = between(0.3, 0.9) * strength;
      flying.push({ x, y: 0.06, z, vx: Math.cos(angle) * out, vy: between(1.2, 2.3) * strength, vz: Math.sin(angle) * out });
    }
  }

  function jump(spot) {
    const roll = Math.random();
    const count = roll < 0.2 ? 1 : roll < 0.5 ? 2 : roll < 0.75 ? 3 : roll < 0.92 ? 4 : 5;
    const angle = Math.random() * Math.PI * 2;
    const reach = between(0.3, 1.3);
    const cx = spot.float.x + Math.cos(angle) * reach;
    const cz = Math.max(spot.float.z - 0.4, spot.float.z + Math.sin(angle) * reach);
    const heading = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const jumper = jumpers.find((item) => item.t < 0 && item.wait <= 0);
      if (!jumper) return;
      const turn = heading + between(-0.6, 0.6);
      jumper.from.set(cx + between(-0.5, 0.5), 0, Math.max(spot.float.z - 0.4, cz + between(-0.5, 0.5)));
      jumper.dir.set(Math.sin(turn), 0, Math.cos(turn));
      jumper.duration = between(0.8, 1.15);
      jumper.height = between(0.55, 1.15);
      jumper.travel = between(0.6, 1.4);
      jumper.wait = i === 0 ? 0.001 : between(0.08, 0.4) * i;
      jumper.mesh.rotation.y = turn;
    }
  }

  function animateJumps(dt) {
    for (const spot of spots) {
      if (spot.fish <= 0) continue;
      if (clock >= spot.rippleAt) {
        spot.rippleAt = clock + between(0.4, 1.1);
        ripple(spot);
      }
      if (clock < spot.jumpAt) continue;
      spot.jumpAt = clock + between(1.2, 3.2);
      jump(spot);
    }
    for (const jumper of jumpers) {
      if (jumper.wait > 0) {
        jumper.wait -= dt;
        if (jumper.wait > 0) continue;
        jumper.wait = 0;
        jumper.t = 0;
        jumper.mesh.visible = true;
        splash(jumper.from.x, jumper.from.z, 0.9);
      }
      if (jumper.t < 0) continue;
      jumper.t += dt / jumper.duration;
      const k = Math.min(1, jumper.t);
      const { mesh, from, dir } = jumper;
      mesh.position.set(from.x + dir.x * jumper.travel * k, -0.15 + Math.sin(Math.PI * k) * jumper.height, from.z + dir.z * jumper.travel * k);
      mesh.rotation.x = -Math.cos(Math.PI * k) * 1.05;
      mesh.rotation.z = Math.sin(k * Math.PI * 6) * 0.25;
      if (jumper.t < 1) continue;
      jumper.t = -1;
      mesh.visible = false;
      splash(mesh.position.x, mesh.position.z, 1.15);
    }
    for (const ring of rings) {
      if (ring.t < 0) continue;
      ring.t += dt / RING_SECONDS;
      if (ring.t >= 1) {
        ring.t = -1;
        ring.mesh.visible = false;
        continue;
      }
      ring.mesh.scale.setScalar(1 + ring.t * ring.grow);
      ring.mesh.material.opacity = ring.alpha * (1 - ring.t);
    }
    let alive = 0;
    for (const drop of flying) {
      drop.vy -= 7 * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.z += drop.vz * dt;
      if (drop.y < 0.03) continue;
      drops.setMatrixAt(alive, dropMatrix.makeTranslation(drop.x, drop.y, drop.z));
      flying[alive++] = drop;
    }
    flying.length = alive;
    drops.count = alive;
    if (alive) drops.instanceMatrix.needsUpdate = true;
  }

  function nearestFish(point, radius) {
    let best = null;
    let bestD = radius;
    for (const spot of spots) {
      if (spot.fish <= 0) continue;
      const d = Math.hypot(spot.float.x - point.x, spot.float.z - point.z);
      if (d < bestD) {
        bestD = d;
        best = spot;
      }
    }
    return best;
  }

  return {
    obstacles,
    spots,
    hasFish(spot) {
      return spot.fish > 0;
    },
    get hasOpenZone() {
      return spots.some((spot) => spot.fish > 0);
    },
    get anglers() {
      return spots.reduce((count, spot) => count + spot.queue.members.length, 0);
    },
    pick(point) {
      let best = null;
      let bestScore = Infinity;
      for (const spot of spots) {
        if (spot.fish <= 0) continue;
        const score = Math.hypot(spot.stand.x - point.x, spot.stand.z - point.z) + spot.queue.members.length * QUEUE_PENALTY;
        if (score < bestScore) {
          bestScore = score;
          best = spot;
        }
      }
      return best;
    },
    join(who, spot) {
      for (const other of spots) if (other !== spot) other.queue.leave(who);
      return spot.queue.join(who);
    },
    rotate(who, spot) {
      spot.queue.leave(who);
      return spot.queue.join(who);
    },
    leave(who) {
      for (const spot of spots) spot.queue.leave(who);
    },
    take(spot) {
      if (spot.fish <= 0) return false;
      spot.fish -= 1;
      save();
      return true;
    },
    biteDelay(minutes) {
      const t = minuteOfDay(minutes);
      let rate = 1;
      if ((t >= 300 && t < 450) || (t >= 990 && t < 1140)) rate = 2;
      else if (t >= 630 && t < 870) rate = 0.5;
      if (t >= 1140 || t < 300) rate = 0.6 + 0.9 * moonLight(moonPhase(Math.floor(minutes / 1440)));
      const [lo, hi] = FISHING.biteSeconds;
      return between(lo, hi) / rate;
    },
    rollFish(minutes) {
      const t = minuteOfDay(minutes);
      const night = t >= 1140 || t < 300;
      const entries = Object.entries(FISH).map(([id, fish]) => [id, fish.weight * (night && (id === 'catfish' || id === 'snakehead') ? 1.8 : 1)]);
      let r = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
      for (const [id, w] of entries) if ((r -= w) <= 0) return id;
      return entries[0][0];
    },
    setNight(k) {
      night = k;
      if (lanternMaterial) lanternMaterial.emissiveIntensity = k * 1.8;
    },
    update(dt, minutes) {
      clock += dt;
      refill(minutes);
      animateJumps(dt);
      lanternGlow.update(clock, night);
      flow.offset.x -= dt * FLOW_SPEED;
      flow.offset.y = Math.sin(clock * 0.35) * 0.015;
      if (clock >= spawnAt && drifting.length < HYACINTHS) {
        spawn(SPAN.x0 + 2);
        spawnAt = clock + between(14, 30);
      }
      let alive = 0;
      for (const item of drifting) {
        item.x += item.speed * dt;
        if (item.x > SPAN.x1 - 2) continue;
        item.turn += item.spin * dt;
        place.set(item.x, 0.03 + Math.sin(clock * 1.3 + item.phase) * 0.02, laneZ(item.x, item.offset));
        spin.setFromAxisAngle(UP, item.turn);
        floaters.setMatrixAt(alive, matrix.compose(place, spin, size.setScalar(item.scale)));
        drifting[alive++] = item;
      }
      drifting.length = alive;
      floaters.count = alive;
      floaters.instanceMatrix.needsUpdate = true;
    },
    region(options) {
      return {
        id: 'river',
        name: 'Bến sông Hoài',
        bounds: { x0: WORLD.x0 - 10, z0: 66, x1: WORLD.x1 + 10, z1: 84 },
        staticNav: true,
        overview: { position: new THREE.Vector3(45, 40, 140), target: new THREE.Vector3(45, 0, 96) },
        target(hit) {
          if (hit.object !== water) return null;
          const spot = nearestFish(hit.point, FISH_PICK_RADIUS);
          if (!spot) return null;
          const queue = spot.queue;
          const place = queue.indexOf(options.player);
          const stand = queue.slot(place >= 0 ? place : queue.members.length);
          return { kind: 'fish', spot, index: `fish:${spot.id}`, x: spot.float.x, z: spot.float.z, stand };
        },
        blankTap(hit) {
          return hit.object === water ? 'Chỗ này không có cá.' : null;
        },
        actionFor() {
          return { id: 'fish', hint: 'hand' };
        },
        topOf(target) {
          return new THREE.Vector3(target.x, 0.7, target.z);
        },
        act(action, target) {
          return options.startFishing(target.spot);
        },
        load() {
          return { group, clickables: [water, ...banks, details], obstacles: [] };
        },
      };
    },
  };
}
