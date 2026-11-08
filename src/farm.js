import * as THREE from 'three';
import { Batch, shapes, vertexMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { bedShape, bedsGeometry, raggedPatch, soilMaterial } from './soil.js';
import { CROPS, RIPE, SPENT, mound, stageName } from './crops.js';
import { LOW_POWER } from './quality.js';
import { gameNow, durationText, DAY_MINUTES } from './clock.js';
import { CROP_ECONOMY, ENERGY, FARMING, SHOP, growDays } from './config.js';
import { PLAYER, seedId } from './inventory.js';
import { iconTag } from './itemArt.js';

const STORAGE_KEY = 'truong-lang-xua.farm.v2';
const LEGACY_KEY = 'truong-lang-xua.farm';
const GROWTH_STEPS = RIPE - 1;
const CLEAR_SECONDS = 1.4;
const SHAPED_FROM = 3;
const REAL_TIME_FLOOR = 1e11;
const cropOf = (spot) => CROPS[spot.crop] ?? CROPS.tomato;
const varietyOf = (spot) => cropOf(spot).varieties[spot.variety] ?? cropOf(spot).varieties[0];
const randomVariety = (crop) => Math.floor(Math.random() * CROPS[crop].varieties.length);
const stageMinutes = (spot) => (growDays(spot.crop) * DAY_MINUTES) / GROWTH_STEPS;
const thirstMinutes = (spot) => stageMinutes(spot) * FARMING.thirstShare;

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
export const FARM_X = -70;
const PATH = { x0: -2.1 + FARM_X, x1: 2.3 + FARM_X };
const SIDES = [
  { first: -2.6 + FARM_X, dir: -1 },
  { first: 3.6 + FARM_X, dir: 1 },
];
const columns = ({ first, dir }) => Array.from({ length: BEDS_PER_SIDE }, (_, k) => first + dir * k * BED.pitch);
const BED_XS = [...SIDES.flatMap((side) => columns(side).slice(0, FIRST_BEDS)), ...SIDES.flatMap((side) => columns(side).slice(FIRST_BEDS))];
const BEDS = BED_XS.map((x, i) => ({ x, shape: bedShape(700 + i * 13, { height: BED.height }) }));
const CLODS = [0x6b4428, 0x7d5532, 0x8a5c38, 0x5c3920];
const WEEDS = [0x6fae3f, 0x5a9a36, 0x86c75a];
const BOUNDS = { x0: -32 + FARM_X, z0: 38.5, x1: 33 + FARM_X, z1: 64 };
export const FIELD_TREES = [
  [-32, 58],
  [-20, 64],
  [-6, 65],
  [9, 64.5],
  [24, 63.5],
  [33, 57],
].map(([x, z]) => [x + FARM_X, z]);

const ROAD_EDGE = 36.6;

function nextStageIn(spot, now) {
  return `${stageName(spot.crop, spot.stage + 1)} sau ${durationText(stageMinutes(spot) - (now - spot.stageStart))}`;
}

function seedOptions(purse) {
  return Object.keys(CROPS)
    .filter((id) => purse.count(seedId(id)) > 0)
    .map((id) => ({ id, icon: CROPS[id].icon, art: id, name: `×${purse.count(seedId(id))}`, label: `${CROPS[id].name} ×${purse.count(seedId(id))}` }));
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
const vigor = (spot) => Math.max(FARMING.minVigor, 1 - FARMING.missPenalty * spot.missed);
const yieldOf = (spot) => Math.max(1, Math.round(varietyOf(spot).fruits * vigor(spot)));

function worthFertilizing(spot) {
  const price = CROP_ECONOMY[spot.crop]?.price ?? 1;
  return varietyOf(spot).fruits * price * FARMING.missPenalty >= SHOP.fertilizer;
}

const ACTIONS = {
  plant(spot, now, farm, choice, actor) {
    if (spot.stage > 0) return 'Chỗ này trồng rồi!';
    const id = CROPS[choice] ? choice : null;
    if (!id) return 'Hết hạt giống rồi! Ra tiệm mua nhé.';
    if (!farm.ledger.purse(actor).take(seedId(id), 1)) return `Hết ${CROPS[id].seedName.toLowerCase()} rồi!`;
    Object.assign(spot, fresh(), { stage: 1, stageStart: now, owner: actor, crop: id, variety: randomVariety(id) });
    return `🌱 Gieo ${CROPS[id].name.toLowerCase()} xong!`;
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
  fertilize(spot, now, farm, choice, actor) {
    if (!growing(spot)) return 'Không cần bón lúc này!';
    if (spot.missed <= 0) return 'Cây đang khoẻ, chưa cần bón!';
    if (!farm.ledger.purse(actor).take('fertilizer', 1)) return 'Hết phân bón rồi! Ra tiệm mua nhé.';
    spot.missed -= 1;
    return spot.missed ? `🧪 Bón xong! Cây còn yếu ${spot.missed} phần.` : '🧪 Bón xong! Cây khoẻ hẳn rồi.';
  },
  harvest(spot, now, farm, choice, actor) {
    if (spot.stage !== RIPE) return spot.stage === 0 ? 'Chưa trồng gì cả!' : 'Chưa tới lứa thu đâu!';
    const count = yieldOf(spot);
    farm.ledger.purse(actor).add(spot.crop, count);
    spot.stage = SPENT;
    spot.watered = false;
    return `${iconTag({ icon: cropOf(spot).icon, art: spot.crop })} +${count}`;
  },
  clear(spot) {
    if (spot.stage !== SPENT) return 'Chưa cần dọn!';
    Object.assign(spot, fresh());
    return '🧹 Dọn sạch rồi!';
  },
  look(spot, now, farm, choice, actor) {
    if (spot.stage > 0 && spot.owner !== actor) return `Cây của ${farm.nameOf(spot.owner)} đó!`;
    if (growing(spot)) return nextStageIn(spot, now) + (spot.missed ? ' · cây yếu, bón phân sẽ khoẻ lại' : '');
    if (spot.stage === SPENT) return 'Cây đã thu, cần dọn!';
    return 'Đất trống.';
  },
};

class FarmState {
  constructor(count, { ledger, nameOf }) {
    this.ledger = ledger;
    this.nameOf = nameOf;
    this.spots = Array.from({ length: count }, fresh);
    this.load();
  }

  load() {
    try {
      localStorage.removeItem(LEGACY_KEY);
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (!saved || !Array.isArray(saved.spots) || saved.spots.length > this.spots.length) return false;
      const now = gameNow();
      saved.spots.forEach((spot, i) => {
        const target = this.spots[i];
        const stage = Math.floor(Number(spot?.stage));
        target.stage = stage >= 0 && stage <= SPENT ? stage : 0;
        const crop = target.stage > 0 ? (CROPS[spot?.crop] ? spot.crop : 'tomato') : null;
        target.crop = crop;
        target.owner = crop ? (typeof spot?.owner === 'string' ? spot.owner : PLAYER) : null;
        target.variety = crop && CROPS[crop].varieties[spot?.variety] ? spot.variety : crop ? randomVariety(crop) : 0;
        const legacyWet = Number(spot?.wetAt) > 0 ? Number(spot.wetAt) : 0;
        const start = Number(spot?.stageStart) > 0 ? Number(spot.stageStart) : legacyWet;
        target.stageStart = start > REAL_TIME_FLOOR ? gameNow(start) : start > 0 ? start : now;
        target.watered = spot?.watered === true || legacyWet > 0;
        target.late = spot?.late === true;
        target.missed = Math.max(0, Math.floor(Number(spot?.missed) || 0));
      });
      const harvested = Math.floor(Number(saved.harvested) || 0);
      if (harvested > 0) this.ledger.purse(PLAYER).add('tomato', harvested);
      this.save();
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
      if (!growing(spot)) continue;
      const span = stageMinutes(spot);
      while (growing(spot) && now - spot.stageStart >= span) {
        if (!spot.watered) spot.missed += 1;
        spot.stage += 1;
        spot.stageStart += span;
        spot.watered = false;
        spot.late = false;
        changed = true;
      }
      if (this.thirsty(spot) && now - spot.stageStart >= thirstMinutes(spot)) {
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
    return Math.max(0, stageMinutes(spot) - (now - spot.stageStart));
  }

  actionFor(index, actor = PLAYER) {
    const spot = this.spots[index];
    if (spot.stage > 0 && spot.owner !== actor) return { id: 'look', hint: null };
    const purse = this.ledger.purse(actor);
    if (spot.stage === 0) {
      const options = seedOptions(purse);
      return options.length ? { id: 'plant', hint: 'seed', choices: { title: 'Chọn hạt giống', options } } : { id: 'plant', hint: 'seed' };
    }
    if (spot.stage === RIPE) {
      const pick = { kind: 'harvest', applyAt: 'start', count: yieldOf(spot), item: spot.crop };
      return { id: 'harvest', hint: 'hand', effect: cropOf(spot).harvest === 'dig' ? { kind: 'clear', duration: 1, then: pick } : pick };
    }
    if (spot.stage === SPENT) return { id: 'clear', hint: 'hoe', effect: { kind: 'clear', duration: CLEAR_SECONDS } };
    if (this.thirsty(spot)) return { id: 'water', hint: 'water', effect: { kind: 'water', duration: 2 } };
    if (spot.missed > 0 && purse.count('fertilizer') > 0) return { id: 'fertilize', hint: 'hoe', effect: { kind: 'clear', duration: 1 } };
    return { id: 'look', hint: null };
  }

  act(name, index, now, choice, actor = PLAYER) {
    const spot = this.spots[index];
    const action = spot && spot.stage > 0 && spot.owner !== actor ? ACTIONS.look : ACTIONS[name];
    if (!action || !spot) return null;
    const before = JSON.stringify(spot);
    const reply = action(spot, now, this, choice, actor);
    this.changed = JSON.stringify(spot) !== before;
    if (this.changed) this.save();
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
    this.planted = new Map();
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
    for (const child of this.group.children) {
      if (child === this.drops || child === this.ring) continue;
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    }
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
    const center = 0.5 + FARM_X;
    const outer = BED_XS.reduce((m, x) => Math.max(m, Math.abs(x - center)), 0) + 1.6;
    this.jar(b, center - outer, FRONT - 0.9);
    this.jar(b, center + outer, FRONT - 0.9);
    for (const [x, z] of FIELD_TREES) {
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
      this.planted.set(mesh, indices);
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
    if (this.state.tick(gameNow())) this.refresh();
    for (const [index, anim] of this.anims) this.wither(index, anim);
    this.drops.position.y = Math.sin(t * 3) * 0.05;
    if (this.ring.visible) this.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
  }

  spotOf(mesh, instanceId) {
    if (instanceId == null) return null;
    return this.planted.get(mesh)?.[instanceId] ?? null;
  }

  highlight(spot) {
    this.ring.visible = !!spot;
    if (spot) this.ring.position.set(spot.x, spot.y + 0.02, spot.z);
  }

  dispose() {
    for (const item of this.disposables) item.dispose();
  }
}

export function createFarm({ ledger, nameOf, nav }) {
  const spots = layoutSpots();
  const state = new FarmState(spots.length, { ledger, nameOf });
  const claims = new Map();
  let view = null;
  let lastTick = 0;

  const placed = (index, action) => {
    if (!action.effect) return action;
    const spot = spots[index];
    const height = plantTop(state.spots[index]) * spot.scale;
    const where = { groundY: spot.y, at: { x: spot.x, y: spot.y, z: spot.z }, height };
    const effect = { ...action.effect, ...where };
    if (effect.then) effect.then = { ...effect.then, ...where, height: Math.min(height, 0.15) };
    return { ...action, effect };
  };

  const tick = () => {
    const changed = state.tick(gameNow());
    if (changed) view?.refresh();
    return changed;
  };

  const crew = {
    nav,
    spot: (index) => spots[index],
    standFor: (index, from) => standFor(spots[index], from),
    claim: (index, who) => claims.set(index, who),
    release(index, who) {
      if (claims.get(index) === who) claims.delete(index);
    },
    releaseAll(who) {
      for (const [index, owner] of claims) if (owner === who) claims.delete(index);
    },
    effectFor(index, action, actor) {
      const planned = state.actionFor(index, actor);
      return planned.id === action ? placed(index, planned).effect ?? null : null;
    },
    act(action, index, choice, actor) {
      const reply = state.act(action, index, gameNow(), choice, actor);
      view?.refresh();
      return reply;
    },
    animate: (index, kind, duration) => view?.animate(index, kind, duration),
    randomPlot(actor) {
      const mine = [];
      state.spots.forEach((plant, index) => {
        if (plant.stage > 0 && plant.owner === actor) mine.push(index);
      });
      return mine.length ? mine[Math.floor(Math.random() * mine.length)] : -1;
    },
    plots(actor) {
      let owned = 0;
      let ripe = 0;
      for (const plant of state.spots) {
        if (plant.stage === 0 || plant.owner !== actor) continue;
        owned += 1;
        if (plant.stage === RIPE) ripe += 1;
      }
      return { owned, ripe };
    },
    jobFor(worker, seedChoice) {
      const purse = ledger.purse(worker.id);
      const fertilizer = purse.count('fertilizer') > 0;
      let owned = 0;
      let best = null;
      const consider = (index, action, rank, choice) => {
        if ((ENERGY.costs[action] ?? 0) > purse.energy) return;
        const claimant = claims.get(index);
        if (claimant && claimant !== worker.id) return;
        const spot = spots[index];
        const score = rank * 1000 + Math.hypot(spot.x - worker.position.x, spot.z - worker.position.z) + Math.random() * 6;
        if (!best || score < best.score) best = { index, action, choice, score };
      };
      state.spots.forEach((plant, index) => {
        if (plant.stage === 0 || plant.owner !== worker.id) return;
        owned += 1;
        if (plant.stage === RIPE) consider(index, 'harvest', 0);
        else if (plant.stage === SPENT) consider(index, 'clear', 1);
        else if (state.thirsty(plant)) consider(index, 'water', 2);
        else if (fertilizer && plant.missed > 0 && worthFertilizing(plant)) consider(index, 'fertilize', 3);
      });
      if (owned < FARMING.villagerPlots && seedChoice) {
        state.spots.forEach((plant, index) => {
          if (plant.stage === 0) consider(index, 'plant', 4, seedChoice);
        });
      }
      return best;
    },
  };

  return {
    id: 'farm',
    name: 'Ruộng rau màu',
    bounds: BOUNDS,
    crew,
    tick() {
      const now = performance.now();
      if (now - lastTick < 500) return;
      lastTick = now;
      tick();
    },
    target(hit, from) {
      const index = view?.spotOf(hit.object, hit.instanceId) ?? spotAt(spots, hit.point);
      if (index == null || index < 0) return null;
      const spot = spots[index];
      return { index, x: spot.x, z: spot.z, stand: standFor(spot, from) };
    },
    actionFor(target) {
      return placed(target.index, state.actionFor(target.index));
    },
    timeLeft(target) {
      return state.timeLeft(target.index, gameNow());
    },
    topOf(target) {
      const spot = spots[target.index];
      return new THREE.Vector3(spot.x, spot.y + plantTop(state.spots[target.index]) * spot.scale + 0.18, spot.z);
    },
    act(action, target, choice) {
      const reply = state.act(action, target.index, gameNow(), choice);
      view?.refresh();
      return reply;
    },
    didChange() {
      return !!state.changed;
    },
    highlight(target) {
      view?.highlight(target ? spots[target.index] : null);
    },
    animate(target, kind, duration) {
      view?.animate(target.index, kind, duration);
    },
    load() {
      tick();
      view = new FarmView(spots, state);
      return {
        group: view.group,
        clickables: view.clickables,
        obstacles: view.obstacles,
        update: (t) => view.update(t),
        dispose: () => {
          view.dispose();
          view = null;
        },
      };
    },
  };
}
