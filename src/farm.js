import * as THREE from 'three';
import { Batch, shapes, vertexMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { bedShape, bedsGeometry, raggedPatch, soilMaterial } from './soil.js';
import { CROPS, RIPE, SPENT, mound } from './crops.js';
import { Farmer, FARMER_PROFILES } from './farmers.js';
import { LOW_POWER } from './quality.js';

const STORAGE_KEY = 'truong-lang-xua.farm.v2';
const BAGS_KEY = 'truong-lang-xua.farmers';
const FARMER_PLANTS = 14;
const PLAYER = 'player';
const ownerName = (id) => FARMER_PROFILES.find((farmer) => farmer.id === id)?.name ?? 'người khác';
const LEGACY_KEY = 'truong-lang-xua.farm';
const GROW_MS = 25000;
const THIRST_MS = 15000;
const CLEAR_SECONDS = 1.4;
const SHAPED_FROM = 3;
const cropOf = (spot) => CROPS[spot.crop] ?? CROPS.tomato;
const varietyOf = (spot) => cropOf(spot).varieties[spot.variety] ?? cropOf(spot).varieties[0];
const randomVariety = (crop) => Math.floor(Math.random() * CROPS[crop].varieties.length);

function plantTop(spot) {
  const crop = cropOf(spot);
  const height = crop.stageHeight(spot.stage, varietyOf(spot).height);
  return spot.stage < SHAPED_FROM ? height : height + crop.crown;
}
const BED = { height: 0.22, width: 0.84, pitch: 2.2 };
const BEDS_PER_SIDE = 13;
const FIRST_BEDS = 11;
const PER_BED = 10;
const SPACING = 2;
const FRONT = 39.5;
const BACK = FRONT + PER_BED * SPACING;
const PATH = { x0: -2.1, x1: 2.3 };
const SIDES = [
  { first: -2.6, dir: -1 },
  { first: 3.6, dir: 1 },
];
const columns = ({ first, dir }) => Array.from({ length: BEDS_PER_SIDE }, (_, k) => first + dir * k * BED.pitch);
const BED_XS = [...SIDES.flatMap((side) => columns(side).slice(0, FIRST_BEDS)), ...SIDES.flatMap((side) => columns(side).slice(FIRST_BEDS))];
const BEDS = BED_XS.map((x, i) => ({ x, shape: bedShape(700 + i * 13, { height: BED.height }) }));
const CLODS = [0x6b4428, 0x7d5532, 0x8a5c38, 0x5c3920];
const WEEDS = [0x6fae3f, 0x5a9a36, 0x86c75a];
const BOUNDS = { x0: -32, z0: 38.5, x1: 33, z1: 64 };
const TREES = [
  [-32, 58],
  [-20, 64],
  [-6, 65],
  [9, 64.5],
  [24, 63.5],
  [33, 57],
];

const ROAD_EDGE = 36.6;

export const SEEDS = Object.entries(CROPS).map(([id, { icon, name }]) => ({ id, icon, name }));
const STAGE_NAMES = ['Đất trống', 'Hạt giống', 'Nảy mầm', 'Cây non', 'Ra hoa', 'Quả xanh', 'Quả chín', 'Đã hái'];

function formatWait(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const rest = seconds % 60;
  return rest ? `${Math.floor(seconds / 60)} phút ${rest} giây` : `${seconds / 60} phút`;
}

function nextStageIn(spot, now) {
  return `${STAGE_NAMES[spot.stage + 1]} sau ${formatWait(GROW_MS - (now - spot.stageStart))}`;
}

const C = {
  hole: 0x4a2e1c,
  wet: 0x4a2e1c,
  stem: 0x4f8a2f,
  leafLight: 0x86c75a,
  drop: 0x4aa8ff,
  jar: 0x6a3a22,
  water: 0x5bb8e6,
  mine: 0x3d8bff,
};

const fresh = () => ({ stage: 0, stageStart: 0, watered: false, late: false, missed: 0, crop: null, variety: 0, owner: null });
const growing = (spot) => spot.stage > 0 && spot.stage < RIPE;
const vigor = (spot) => Math.max(0.25, 1 - 0.18 * spot.missed);
const yieldOf = (spot) => Math.max(1, Math.round(varietyOf(spot).fruits * vigor(spot)));

const ACTIONS = {
  plant(spot, now, farm, choice, actor) {
    if (spot.stage > 0) return 'Chỗ này trồng rồi!';
    const id = CROPS[choice] ? choice : 'tomato';
    Object.assign(spot, fresh(), { stage: 1, stageStart: now, owner: actor, crop: id, variety: randomVariety(id) });
    return `🌱 Gieo hạt ${CROPS[id].name.toLowerCase()} xong!`;
  },
  water(spot) {
    if (spot.stage === 0) return 'Chưa gieo hạt mà!';
    if (spot.stage === RIPE) return 'Chín rồi, hái thôi!';
    if (spot.stage === SPENT) return 'Hái rồi, dọn thôi!';
    if (spot.watered) return 'Đất còn ẩm mà!';
    if (spot.late) return 'Lỡ mất rồi, đợi giai đoạn sau!';
    spot.watered = true;
    return '💧 Tưới xong!';
  },
  harvest(spot, now, farm, choice, actor) {
    if (spot.stage !== RIPE) return spot.stage === 0 ? 'Chưa trồng gì cả!' : 'Chưa chín đâu!';
    const count = yieldOf(spot);
    farm.onHarvest(actor, spot.crop, count);
    spot.stage = SPENT;
    spot.watered = false;
    return `${cropOf(spot).icon} +${count}`;
  },
  clear(spot) {
    if (spot.stage !== SPENT) return 'Chưa cần dọn!';
    Object.assign(spot, fresh());
    return '🧹 Dọn sạch rồi!';
  },
  look(spot, now, farm, choice, actor) {
    if (spot.stage > 0 && spot.owner !== actor) return `Cây của ${ownerName(spot.owner)} đó!`;
    if (growing(spot)) return nextStageIn(spot, now);
    if (spot.stage === SPENT) return 'Cây đã hái, cần dọn!';
    return 'Đất trống.';
  },
};

class FarmState {
  constructor(count, onHarvest) {
    this.onHarvest = onHarvest;
    this.spots = Array.from({ length: count }, fresh);
    this.load();
  }

  load() {
    try {
      localStorage.removeItem(LEGACY_KEY);
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (!saved || !Array.isArray(saved.spots) || saved.spots.length > this.spots.length) return false;
      const now = Date.now();
      saved.spots.forEach((spot, i) => {
        const target = this.spots[i];
        const stage = Math.floor(Number(spot?.stage));
        target.stage = stage >= 0 && stage <= SPENT ? stage : 0;
        const crop = target.stage > 0 ? (CROPS[spot?.crop] ? spot.crop : 'tomato') : null;
        target.crop = crop;
        target.owner = crop ? (typeof spot?.owner === 'string' ? spot.owner : PLAYER) : null;
        target.variety = crop && CROPS[crop].varieties[spot?.variety] ? spot.variety : crop ? randomVariety(crop) : 0;
        const legacyWet = Number(spot?.wetAt) > 0 ? Number(spot.wetAt) : 0;
        target.stageStart = Number(spot?.stageStart) > 0 ? Number(spot.stageStart) : legacyWet || now;
        target.watered = spot?.watered === true || legacyWet > 0;
        target.late = spot?.late === true;
        target.missed = Math.max(0, Math.floor(Number(spot?.missed) || 0));
      });
      const harvested = Math.floor(Number(saved.harvested) || 0);
      if (harvested > 0) {
        this.onHarvest(PLAYER, 'tomato', harvested);
        this.save();
      }
      return true;
    } catch {
      return false;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ spots: this.spots }));
    } catch {}
  }

  thirsty(spot) {
    return growing(spot) && !spot.watered && !spot.late;
  }

  tick(now) {
    let changed = false;
    for (const spot of this.spots) {
      while (growing(spot) && now - spot.stageStart >= GROW_MS) {
        if (!spot.watered) spot.missed += 1;
        spot.stage += 1;
        spot.stageStart += GROW_MS;
        spot.watered = false;
        spot.late = false;
        changed = true;
      }
      if (this.thirsty(spot) && now - spot.stageStart >= THIRST_MS) {
        spot.late = true;
        changed = true;
      }
    }
    if (changed) this.save();
    return changed;
  }

  timeLeft(index, now) {
    const spot = this.spots[index];
    if (!growing(spot)) return null;
    return Math.max(0, GROW_MS - (now - spot.stageStart));
  }

  actionFor(index, actor = PLAYER) {
    const spot = this.spots[index];
    if (spot.stage > 0 && spot.owner !== actor) return { id: 'look', hint: null };
    if (spot.stage === 0) return { id: 'plant', hint: 'seed', choices: { title: 'Chọn hạt giống', options: SEEDS } };
    if (spot.stage === RIPE) {
      const pick = { kind: 'harvest', applyAt: 'start', count: yieldOf(spot), item: spot.crop };
      return { id: 'harvest', hint: 'hand', effect: cropOf(spot).harvest === 'dig' ? { kind: 'clear', duration: 1, then: pick } : pick };
    }
    if (spot.stage === SPENT) return { id: 'clear', hint: 'hoe', effect: { kind: 'clear', duration: CLEAR_SECONDS } };
    if (this.thirsty(spot)) return { id: 'water', hint: 'water', effect: { kind: 'water', duration: 2 } };
    return { id: 'look', hint: null };
  }

  act(name, index, now, choice, actor = PLAYER) {
    const spot = this.spots[index];
    const action = spot && spot.stage > 0 && spot.owner !== actor ? ACTIONS.look : ACTIONS[name];
    if (!action || !spot) return null;
    const before = JSON.stringify(spot);
    const reply = action(spot, now, this, choice, actor);
    if (JSON.stringify(spot) !== before) this.save();
    return reply;
  }
}

function layoutSpots() {
  const rand = makeRandom(31);
  const spots = [];
  for (const { x, shape } of BEDS) {
    for (let k = 0; k < PER_BED; k++) {
      const z = FRONT + SPACING * (k + 0.5);
      spots.push({ x: x + shape.offset(z), y: shape.height(z) * 1.03, z, yaw: rand() * Math.PI * 2, scale: 0.9 + rand() * 0.2 });
    }
  }
  return spots;
}

const REACH = { across: 0.45, along: 1.3 };

function spotAt(spots, point) {
  let best = -1;
  let bestD = Infinity;
  spots.forEach((spot, i) => {
    const dx = Math.abs(point.x - spot.x);
    const dz = Math.abs(point.z - spot.z);
    if (dx > 0.75 || dz > SPACING / 2 || dx + dz >= bestD) return;
    bestD = dx + dz;
    best = i;
  });
  return best;
}

function standFor(spot, from) {
  const x = spot.x + (from.x < spot.x ? -1 : 1) * (BED.pitch / 2);
  const inReach = Math.abs(from.x - x) < REACH.across && Math.abs(from.z - spot.z) <= REACH.along;
  return inReach ? { x: from.x, z: from.z } : { x, z: spot.z };
}

const STAGES = [
  (b) => b.add(shapes.cylinder(0.15, 0.17, 0.02, 12), C.hole, { p: [0, 0.004, 0] }),
  (b, rand) => mound(b, rand, 3),
  (b, rand) => {
    mound(b, rand);
    b.limb([0, 0.02, 0], [0, 0.2, 0], 0.016, C.stem, { capsule: false, seg: 5 });
    for (const side of [-1, 1]) {
      b.add(shapes.ico(0.07, 0), C.leafLight, { p: [side * 0.065, 0.21, 0], s: [1, 0.3, 0.55], r: [0, 0, side * 0.35], flat: true });
    }
  },
];

const tint = new THREE.Color();

function weakness(plant) {
  return plant.stage >= SHAPED_FROM ? Math.min(plant.missed, 5) / 5 : 0;
}

function tintOf(plant) {
  const w = weakness(plant);
  return tint.setRGB(1, 1 - 0.12 * w, 1 - 0.45 * w);
}

function yawOf(spot, plant) {
  if (!CROPS[plant.crop]?.aligned) return spot.yaw;
  return spot.yaw > Math.PI ? 0 : Math.PI;
}

function modelKey(stage, crop, variety) {
  return stage < SHAPED_FROM ? `base:${stage}` : `${crop}:${variety}:${stage}`;
}

const position = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const euler = new THREE.Euler();

class FarmView {
  constructor(spots, state) {
    this.spots = spots;
    this.state = state;
    this.group = new THREE.Group();
    this.clickables = [];
    this.obstacles = [];
    this.disposables = [];
    this.slots = [];
    this.anims = new Map();
    this.buildField();
    this.models = new Map();
    STAGES.forEach((build, stage) => this.models.set(modelKey(stage), this.instanced((b) => build(b, makeRandom(100 + stage)))));
    for (const [id, crop] of Object.entries(CROPS)) {
      crop.varieties.forEach((variety, v) => {
        for (let stage = SHAPED_FROM; stage <= SPENT; stage++) {
          this.models.set(modelKey(stage, id, v), this.instanced((b) => crop.build(b, stage, variety), { tinted: true, shadow: !LOW_POWER }));
        }
      });
    }
    this.wet = this.instanced((b) => b.add(shapes.cylinder(0.22, 0.22, 0.012, 16), C.wet, { p: [0, 0.006, 0] }), { shadow: false, click: false });
    this.marks = this.instanced((b) => b.add(shapes.torus(0.27, 0.022, 36), C.mine, { p: [0, 0.018, 0], r: [Math.PI / 2, 0, 0] }), { shadow: false, click: false });
    this.marks.material = new THREE.MeshBasicMaterial({ color: C.mine });
    this.disposables.push(this.marks.material);
    this.drops = this.instanced(
      (b) => {
        b.add(shapes.sphere(0.065, 10, 8), C.drop, { p: [0, 0, 0] });
        b.add(shapes.cone(0.062, 0.12, 10), C.drop, { p: [0, 0.075, 0] });
      },
      { shadow: false, click: false },
    );
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.306, 0.36, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 3;
    this.ring.visible = false;
    this.group.add(this.ring);
    this.disposables.push(this.ring.geometry, this.ring.material);
    this.refresh();
  }

  block(x0, z0, x1, z1) {
    this.obstacles.push({ minX: x0, minZ: z0, maxX: x1, maxZ: z1, minY: 0, maxY: 1.6 });
  }

  buildField() {
    const b = new Batch();
    const rand = makeRandom(909);
    const soil = soilMaterial();
    this.disposables.push(soil, soil.map);
    SIDES.forEach(({ first, dir }, i) => {
      const last = first + dir * (BEDS_PER_SIDE - 1) * BED.pitch;
      const x0 = Math.min(first, last) - BED.pitch / 2 - 0.2;
      const x1 = Math.max(first, last) + BED.pitch / 2 - 0.6;
      const ground = groundDecal(raggedPatch(x0, FRONT - 0.6, x1, BACK + 0.6, 61 + i), soil, GROUND_LAYER.field);
      this.group.add(ground);
      this.clickables.push(ground);
      this.disposables.push(ground.geometry);
    });

    const beds = new THREE.Mesh(bedsGeometry(BEDS, FRONT, BACK), vertexMaterial());
    beds.castShadow = true;
    beds.receiveShadow = true;
    this.group.add(beds);
    this.clickables.push(beds);
    this.disposables.push(beds.geometry);
    for (const { x, shape } of BEDS) {
      this.block(x - BED.width / 2, FRONT, x + BED.width / 2, BACK);
      for (let i = 0; i < 26; i++) {
        const z = FRONT - 0.3 + rand() * (BACK - FRONT + 0.6);
        const side = rand() < 0.5 ? -1 : 1;
        const cx = x + shape.offset(z) + side * (0.38 + rand() * 0.28);
        const r = 0.03 + rand() * 0.035;
        b.add(shapes.ico(r, 0), CLODS[i % CLODS.length], { p: [cx, r * 0.4, z], s: [1.3, 0.7, 1.1], r: [0, rand() * 3, 0], flat: true });
      }
      for (let i = 0; i < 3; i++) {
        const z = FRONT + rand() * (BACK - FRONT);
        const cx = x + (rand() < 0.5 ? -1 : 1) * (0.75 + rand() * 0.6);
        for (let k = 0; k < 4; k++) {
          const a = rand() * Math.PI * 2;
          b.add(shapes.cone(0.018, 0.1 + rand() * 0.08, 4), WEEDS[k % WEEDS.length], {
            p: [cx + Math.cos(a) * 0.04, 0.05, z + Math.sin(a) * 0.04],
            r: [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4],
            flat: true,
          });
        }
      }
    }
    const outer = BED_XS.reduce((m, x) => Math.max(m, Math.abs(x - 0.5)), 0) + 1.6;
    this.jar(b, 0.5 - outer, FRONT - 0.9);
    this.jar(b, 0.5 + outer, FRONT - 0.9);
    for (const [x, z] of TREES) {
      roundTree(b, rand, { x, z, h: 4 + Math.floor(rand() * 2) });
      this.block(x + 0.2, z + 0.2, x + 0.8, z + 0.8);
    }

    const mesh = b.mesh();
    this.disposables.push(mesh.geometry);
    this.group.add(mesh);
    this.clickables.push(mesh);

    const earth = earthMaterial();
    const path = groundDecal(roundedRectGeometry(PATH.x0, ROAD_EDGE, PATH.x1, BACK + 0.8, 0.6), earth, GROUND_LAYER.earth);
    this.group.add(path);
    this.clickables.push(path);
    this.disposables.push(path.geometry, earth, earth.map);
  }

  jar(b, x, z) {
    const profile = [[0, 0], [0.28, 0], [0.4, 0.15], [0.45, 0.38], [0.38, 0.62], [0.29, 0.72], [0.32, 0.78]];
    b.add(shapes.lathe(profile, 14), C.jar, { p: [x, 0, z] });
    b.add(shapes.cylinder(0.29, 0.29, 0.02, 14), C.water, { p: [x, 0.7, z] });
    this.block(x - 0.45, z - 0.45, x + 0.45, z + 0.45);
  }

  instanced(build, { shadow = true, click = true, tinted = false } = {}) {
    const b = new Batch();
    build(b);
    const mesh = new THREE.InstancedMesh(b.geometry(), vertexMaterial(), this.spots.length);
    if (tinted) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.spots.length * 3).fill(1), 3);
    mesh.count = 0;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(mesh);
    this.disposables.push(mesh.geometry, mesh);
    if (click) this.clickables.push(mesh);
    return mesh;
  }

  place(mesh, indices, transform) {
    indices.forEach((index, k) => {
      transform(this.spots[index], this.state.spots[index]);
      mesh.setMatrixAt(k, matrix.compose(position, rotation, scale));
    });
    if (transform === this.plantTransform) {
      indices.forEach((index, k) => {
        this.slots[index] = { mesh, k };
        if (mesh.instanceColor) mesh.setColorAt(k, tintOf(this.state.spots[index]));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    mesh.count = indices.length;
    mesh.visible = indices.length > 0;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = null;
  }

  refresh() {
    const lists = new Map();
    const wet = [];
    const mine = [];
    const thirsty = [];
    this.state.spots.forEach((spot, i) => {
      const key = modelKey(spot.stage, spot.crop, spot.variety);
      if (!lists.has(key)) lists.set(key, []);
      lists.get(key).push(i);
      if (spot.watered) wet.push(i);
      if (spot.stage > 0 && spot.owner === PLAYER) mine.push(i);
      if (this.state.thirsty(spot)) thirsty.push(i);
    });
    for (const [key, mesh] of this.models) this.place(mesh, lists.get(key) ?? [], this.plantTransform);
    this.place(this.wet, wet, (spot) => {
      position.set(spot.x, spot.y, spot.z);
      rotation.identity();
      scale.setScalar(1);
    });
    this.place(this.marks, mine, (spot) => {
      position.set(spot.x, spot.y, spot.z);
      rotation.identity();
      scale.setScalar(1);
    });
    this.place(this.drops, thirsty, (spot, plant) => {
      position.set(spot.x, spot.y + plantTop(plant) * spot.scale + 0.3, spot.z);
      rotation.identity();
      scale.setScalar(1);
    });
  }

  plantTransform(spot, plant) {
    position.set(spot.x, spot.y, spot.z);
    rotation.setFromAxisAngle(UP, yawOf(spot, plant));
    const squash = CROPS[plant.crop]?.aligned ? 1 : 1 - 0.35 * weakness(plant);
    scale.set(spot.scale, spot.scale * squash, spot.scale);
  }

  animate(index, kind, duration) {
    if (kind === 'clear') {
      this.anims.set(index, { start: performance.now(), duration: duration * 1000 });
      return;
    }
    if (this.anims.delete(index)) this.refresh();
  }

  wither(index, { start, duration }) {
    const slot = this.slots[index];
    if (this.state.spots[index].stage !== SPENT || !slot) {
      this.anims.delete(index);
      return;
    }
    const p = Math.min(1, (performance.now() - start) / duration);
    const ease = p * p;
    const spot = this.spots[index];
    position.set(spot.x, spot.y - ease * 0.12, spot.z);
    rotation.setFromEuler(euler.set(ease * 0.9, yawOf(spot, this.state.spots[index]), 0, 'YXZ'));
    scale.setScalar(spot.scale * (1 - ease * 0.85));
    slot.mesh.setMatrixAt(slot.k, matrix.compose(position, rotation, scale));
    slot.mesh.instanceMatrix.needsUpdate = true;
  }

  update(t) {
    if (this.state.tick(Date.now())) this.refresh();
    for (const [index, anim] of this.anims) this.wither(index, anim);
    this.drops.position.y = Math.sin(t * 3) * 0.05;
    if (this.ring.visible) this.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
  }

  highlight(spot) {
    this.ring.visible = !!spot;
    if (spot) this.ring.position.set(spot.x, spot.y + 0.02, spot.z);
  }

  dispose() {
    for (const item of this.disposables) item.dispose();
  }
}

function loadBags() {
  try {
    const saved = JSON.parse(localStorage.getItem(BAGS_KEY) ?? 'null');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

const pickCrop = () => {
  const ids = Object.keys(CROPS);
  return ids[Math.floor(Math.random() * ids.length)];
};

export function createFarm({ inventory, nav }) {
  const spots = layoutSpots();
  const bags = loadBags();
  const state = new FarmState(spots.length, (actor, item, count) => {
    if (actor === PLAYER) {
      inventory.add(item, count);
      return;
    }
    const bag = (bags[actor] ??= {});
    bag[item] = (bag[item] ?? 0) + count;
    try {
      localStorage.setItem(BAGS_KEY, JSON.stringify(bags));
    } catch {}
  });
  const claims = new Map();
  let view = null;
  let farmers = [];

  const placed = (index, action) => {
    if (!action.effect) return action;
    const spot = spots[index];
    const height = plantTop(state.spots[index]) * spot.scale;
    const where = { groundY: spot.y, at: { x: spot.x, y: spot.y, z: spot.z }, height };
    const effect = { ...action.effect, ...where };
    if (effect.then) effect.then = { ...effect.then, ...where, height: Math.min(height, 0.15) };
    return { ...action, effect };
  };

  const crew = {
    nav,
    spot: (index) => spots[index],
    standFor: (index, from) => standFor(spots[index], from),
    claim: (index, who) => claims.set(index, who),
    release(index, who) {
      if (claims.get(index) === who) claims.delete(index);
    },
    effectFor(index, action, actor) {
      const planned = state.actionFor(index, actor);
      return planned.id === action ? placed(index, planned).effect ?? null : null;
    },
    act(action, index, choice, actor) {
      const reply = state.act(action, index, Date.now(), choice, actor);
      view?.refresh();
      return reply;
    },
    animate: (index, kind, duration) => view?.animate(index, kind, duration),
    bagText(id) {
      const items = Object.entries(bags[id] ?? {}).filter(([item, count]) => CROPS[item] && count > 0);
      if (!items.length) return `Túi của ${ownerName(id)} còn trống!`;
      return items.map(([item, count]) => `${CROPS[item].icon} ${count}`).join(' · ');
    },
    jobFor(farmer) {
      let owned = 0;
      let best = null;
      const consider = (index, action, rank, choice) => {
        if (claims.has(index)) return;
        const spot = spots[index];
        const score = rank * 1000 + Math.hypot(spot.x - farmer.position.x, spot.z - farmer.position.z) + Math.random() * 6;
        if (!best || score < best.score) best = { index, action, choice, score };
      };
      state.spots.forEach((plant, index) => {
        if (plant.stage === 0 || plant.owner !== farmer.id) return;
        owned += 1;
        if (plant.stage === RIPE) consider(index, 'harvest', 0);
        else if (plant.stage === SPENT) consider(index, 'clear', 1);
        else if (state.thirsty(plant)) consider(index, 'water', 2);
      });
      if (owned < FARMER_PLANTS) {
        state.spots.forEach((plant, index) => {
          if (plant.stage === 0) consider(index, 'plant', 3, pickCrop());
        });
      }
      return best;
    },
  };

  const farmerAt = (object) => farmers.find((farmer) => farmer.owns(object));
  const startFor = ({ home }) => {
    const x = BED_XS[home];
    return { x: x + (x < 0.5 ? -1 : 1) * (BED.pitch / 2), z: FRONT - 0.8 };
  };

  return {
    id: 'farm',
    name: 'Ruộng cà chua',
    bounds: BOUNDS,
    target(point, from, object) {
      if (object && farmerAt(object)) return null;
      const index = spotAt(spots, point);
      if (index < 0) return null;
      const spot = spots[index];
      return { index, x: spot.x, z: spot.z, stand: standFor(spot, from) };
    },
    interact(object, from) {
      const farmer = farmerAt(object);
      if (!farmer) return false;
      farmer.greet(from);
      return true;
    },
    actionFor(target) {
      return placed(target.index, state.actionFor(target.index));
    },
    timeLeft(target) {
      return state.timeLeft(target.index, Date.now());
    },
    topOf(target) {
      const spot = spots[target.index];
      return new THREE.Vector3(spot.x, spot.y + plantTop(state.spots[target.index]) * spot.scale + 0.18, spot.z);
    },
    act(action, target, choice) {
      const reply = state.act(action, target.index, Date.now(), choice);
      view?.refresh();
      return reply;
    },
    highlight(target) {
      view?.highlight(target ? spots[target.index] : null);
    },
    animate(target, kind, duration) {
      view?.animate(target.index, kind, duration);
    },
    load() {
      state.tick(Date.now());
      view = new FarmView(spots, state);
      farmers = FARMER_PROFILES.map((profile) => new Farmer(profile, crew, view.group, startFor(profile)));
      view.clickables.push(...farmers.map((farmer) => farmer.walker.group));
      return {
        group: view.group,
        clickables: view.clickables,
        obstacles: view.obstacles,
        update: (t, dt) => {
          view.update(t);
          for (const farmer of farmers) farmer.update(t, dt);
        },
        dispose: () => {
          view.dispose();
          view = null;
          farmers = [];
          claims.clear();
        },
      };
    },
  };
}
