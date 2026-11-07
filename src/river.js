import * as THREE from 'three';
import { Batch, canvasTexture, freeze, shade, shapes, toonMaterial, vertexMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundDecal, GROUND_LAYER, roundedRectGeometry } from './scenery.js';
import { FISH, FISHING } from './config.js';
import { minuteOfDay } from './clock.js';
import { moonLight, moonPhase } from './sky.js';

const KEY = 'truong-lang-xua.river';
const SPAN = { x0: -70, x1: 130 };
const DOCK = { x0: 44.6, x1: 46.4, z0: 68.8, z1: 76.6 };
const DOCK_X = (DOCK.x0 + DOCK.x1) / 2;
const PATH = { x0: 44.4, x1: 46.6, z0: 37 };
const REACH = { x0: -46, x1: 104 };
const SEGMENT = 3;
const STEP = 1;
const BANK_SPOTS = [26, 30, 34, 52, 56, 60, 64];
const BOAT_X = 38.5;
const WOOD = 0x7a5232;
const WOOD_DARK = 0x553820;
const REED = [0x7fa443, 0x9ab84a, 0x6a8a3a];
const PEBBLES = [0x9e9484, 0xb3ab99, 0x857c6c];
const FLOW_SPEED = 0.05;
const HYACINTHS = 10;

const between = (a, b) => a + Math.random() * (b - a);
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
  return 80 + wave * (0.4 + 0.6 * fade(x));
}

function lowestNorth(x, half) {
  let low = Infinity;
  for (let s = x - half; s <= x + half + 1e-6; s += 0.25) low = Math.min(low, northBank(s));
  return low;
}

function makeSpots() {
  const spots = [];
  const add = (stand, float) => spots.push({ id: spots.length, stand, float, facing: Math.atan2(float.x - stand.x, float.z - stand.z), angler: null });
  add({ x: DOCK_X, z: DOCK.z1 - 0.5 }, { x: DOCK_X, z: DOCK.z1 + 1.7 });
  for (const z of [72.6, 74.6]) {
    add({ x: DOCK.x0 + 0.3, z }, { x: DOCK.x0 - 2.4, z });
    add({ x: DOCK.x1 - 0.3, z }, { x: DOCK.x1 + 2.4, z });
  }
  for (const x of BANK_SPOTS) add({ x, z: lowestNorth(x, SEGMENT) - 0.5 }, { x, z: northBank(x) + 2.5 });
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
  for (let i = 0; i < 90; i++) {
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
  for (let i = 0; i < 140; i++) {
    const x = SPAN.x0 + 4 + rand() * (SPAN.x1 - SPAN.x0 - 8);
    if (Math.abs(x - DOCK_X) < 2) continue;
    const north = rand() < 0.5;
    const z = north ? northBank(x) - 0.1 + rand() * 0.25 : southBank(x) - 0.15 + rand() * 0.25;
    const r = 0.08 + rand() * 0.16;
    b.add(shapes.ico(r, 0), shade(PEBBLES[i % PEBBLES.length], 0.85 + rand() * 0.25), { p: [x, r * 0.25, z], s: [1.4, 0.55, 1.1], r: [0, rand() * 3, 0], flat: true });
  }
}

let lanternMaterial = null;

function dockLanterns() {
  lanternMaterial ??= toonMaterial({ vertexColors: true, emissive: 0xff8a3a, emissiveIntensity: 0 });
  const b = new Batch();
  for (const [x, color] of [
    [DOCK.x0 + 0.22, 0xd8321e],
    [DOCK.x1 - 0.22, 0xf2b630],
  ]) {
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

function loadStock() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Number.isFinite(saved.day) && Number.isFinite(saved.left)) return saved;
  } catch {}
  return { day: null, left: FISHING.dailyStock };
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
  const stock = loadStock();
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
    groundDecal(roundedRectGeometry(PATH.x0, PATH.z0, PATH.x1, northBank(DOCK_X) - 0.2, 0.5), earth, GROUND_LAYER.earth),
  ];
  group.add(...banks);
  const b = new Batch();
  dock(b);
  boat(b, northBank(BOAT_X) + 2.6);
  shoreline(b, makeRandom(8181));
  const details = b.mesh();
  group.add(details, dockLanterns());

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
  for (let i = 0; i < 4; i++) spawn(between(SPAN.x0 + 10, SPAN.x1 - 10));

  const available = (day) => {
    if (stock.day !== day) {
      stock.day = day;
      stock.left = FISHING.dailyStock;
    }
    return stock.left;
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(stock));
    } catch {}
  };

  function nearestFree(point, who, radius = Infinity) {
    let best = null;
    let bestD = radius;
    for (const spot of spots) {
      if (spot.angler && spot.angler !== who) continue;
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
    available,
    get anglers() {
      return spots.filter((spot) => spot.angler).length;
    },
    claim(who, point, radius) {
      for (const spot of spots) if (spot.angler === who) spot.angler = null;
      const spot = nearestFree(point, who, radius);
      if (spot) spot.angler = who;
      return spot;
    },
    release(who) {
      for (const spot of spots) if (spot.angler === who) spot.angler = null;
    },
    take(day) {
      if (available(day) <= 0) return false;
      stock.left -= 1;
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
      if (lanternMaterial) lanternMaterial.emissiveIntensity = k * 1.8;
    },
    update(dt) {
      clock += dt;
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
        bounds: { x0: -60, z0: 66, x1: 120, z1: 84 },
        staticNav: true,
        overview: { position: new THREE.Vector3(45, 16, 92), target: new THREE.Vector3(45, 0, 72) },
        target(hit) {
          if (hit.object !== water) return null;
          const spot = nearestFree(hit.point, options.player, 12);
          if (!spot) return null;
          return { kind: 'fish', spot, index: `fish:${spot.id}`, x: spot.float.x, z: spot.float.z, stand: spot.stand };
        },
        actionFor() {
          return { id: 'fish', hint: 'hand' };
        },
        labelOf() {
          const left = available(options.day());
          return left > 0 ? `Câu cá · sông còn khoảng ${left} con` : 'Sông hết cá rồi, mai quay lại nhé';
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
