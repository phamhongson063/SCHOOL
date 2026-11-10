import * as THREE from 'three';
import { Batch, shapes, vertexMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { bedShape, bedsGeometry, raggedPatch, soilMaterial } from './soil.js';
import { CROPS, RIPE, SPENT, mound } from './crops.js';
import { LOW_POWER } from './quality.js';
import { gameNow, durationText, DAY_MINUTES } from './clock.js';
import { CROP_ECONOMY, ENERGY, FARMING, SHOP, growDays } from './config.js';
import { PLAYER, seedId } from './inventory.js';
import { iconTag } from './itemArt.js';
import { coins, notEnough } from './format.js';
import { economy } from './economy.js';
import { badgeMaterial } from './studyIcon.js';

const STORAGE_KEY = 'truong-lang-xua.farm.v2';
const LEASE_KEY = 'truong-lang-xua.farmLeases';
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
const BANCO = { x: 163, front: 39.4, count: 9, beds: 5 };
const BANCO_BEDS = Array.from({ length: BANCO.beds }, (_, k) => ({
  x: BANCO.x + (k - (BANCO.beds - 1) / 2) * BED.pitch,
  shape: bedShape(1700 + k * 13, { height: BED.height }),
}));
const BANCO_BACK = BANCO.front + BANCO.count * SPACING;
const BANCO_STREET = 37.1;
const BANCO_BOUNDS = { x0: BANCO.x - 7, z0: BANCO.front - 2.5, x1: BANCO.x + 7, z1: BANCO_BACK + 2 };
const FIELDS = {
  farm: { beds: BEDS, front: FRONT, back: BACK, count: PER_BED },
  banco: { beds: BANCO_BEDS, front: BANCO.front, back: BANCO_BACK, count: BANCO.count },
};
const ALL_BEDS = Object.entries(FIELDS).flatMap(([field, info]) => info.beds.map((bed) => ({ ...bed, field, front: info.front, count: info.count })));
const SPOT_BED = ALL_BEDS.flatMap((bed, index) => Array(bed.count).fill(index));
const fieldOf = (index) => ALL_BEDS[SPOT_BED[index]].field;
const FIELD_NAMES = { farm: 'Ruộng rau màu', banco: 'Ruộng Bàn Cờ' };
const BED_NUMBERS = ALL_BEDS.map((bed) => ALL_BEDS.filter((other) => other.field === bed.field && other.x < bed.x).length + 1);
const bedHead = (bed) => {
  const head = ALL_BEDS[bed];
  return { x: head.x + head.shape.offset(head.front), z: head.front - 1 };
};
const standsAt = (bed, at) => {
  if (!at) return false;
  const { x, shape, front, count } = ALL_BEDS[bed];
  const z = Math.min(Math.max(at.z, front), front + count * SPACING);
  return Math.abs(at.x - x - shape.offset(z)) <= BED.pitch && at.z >= front - 1.5 && at.z <= front + count * SPACING + 1.5;
};
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
const JAR_CENTER = 0.5 + FARM_X;
const JAR_OUTER = BED_XS.reduce((m, x) => Math.max(m, Math.abs(x - JAR_CENTER)), 0) + 1.6;
const JARS = [JAR_CENTER - JAR_OUTER, JAR_CENTER + JAR_OUTER].map((x) => ({ x, z: FRONT - 0.9 }));

const bedBox = (x, z0, z1) => ({ minX: x - BED.width / 2, minZ: z0, maxX: x + BED.width / 2, maxZ: z1, minY: 0, maxY: 1.6 });

function fieldObstacles() {
  const boxes = [];
  const block = (x0, z0, x1, z1) => boxes.push({ minX: x0, minZ: z0, maxX: x1, maxZ: z1, minY: 0, maxY: 1.6 });
  for (const { x } of BEDS) boxes.push(bedBox(x, FRONT, BACK));
  for (const { x, z } of JARS) block(x - 0.45, z - 0.45, x + 0.45, z + 0.45);
  for (const [x, z] of FIELD_TREES) block(x + 0.2, z + 0.2, x + 0.8, z + 0.8);
  return boxes;
}

const ROAD_EDGE = 36.6;
const bedOf = (index) => SPOT_BED[index];
const LEASE_CHOICE = 'lease:';
const leaseOptions = (renew = false) =>
  FARMING.leases.map((offer, i) => ({
    id: `${LEASE_CHOICE}${i}`,
    icon: '📜',
    name: `${renew ? '+' : ''}${offer.days} ngày · ${coins(offer.price)}`,
    label: `${renew ? 'Gia hạn' : 'Thuê'} ${offer.days} ngày, ${coins(offer.price)}`,
  }));

class Leases {
  constructor(count) {
    this.beds = Array.from({ length: count }, () => null);
    try {
      const saved = JSON.parse(localStorage.getItem(LEASE_KEY) ?? 'null');
      if (Array.isArray(saved)) {
        saved.forEach((lease, bed) => {
          if (bed < count && typeof lease?.owner === 'string' && Number.isFinite(lease.until)) this.beds[bed] = { owner: lease.owner, until: lease.until };
        });
      }
    } catch {}
  }

  save() {
    try {
      localStorage.setItem(LEASE_KEY, JSON.stringify(this.beds));
    } catch {}
  }

  holder(bed, now) {
    const lease = this.beds[bed];
    return lease && lease.until > now ? lease : null;
  }

  holds(bed, actor, now) {
    return this.holder(bed, now)?.owner === actor;
  }

  heldBy(actor, now) {
    return this.beds.flatMap((_, bed) => (this.holds(bed, actor, now) ? [bed] : []));
  }

  free(now) {
    return this.beds.flatMap((_, bed) => (this.holder(bed, now) ? [] : [bed]));
  }

  rent(bed, actor, offer, purse, now) {
    const lease = this.holder(bed, now);
    if (lease && lease.owner !== actor) return null;
    if (!purse.spend(offer.price)) return false;
    economy.collect(offer.price);
    this.beds[bed] = { owner: actor, until: (lease?.until ?? now) + offer.days * DAY_MINUTES };
    this.save();
    return this.beds[bed];
  }
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
    spot.stageStart = now;
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
    if (growing(spot)) return null;
    if (spot.stage === SPENT) return 'Cây đã thu, cần dọn!';
    return 'Đất trống.';
  },
};

class FarmState {
  constructor(count, { ledger, nameOf }) {
    this.ledger = ledger;
    this.nameOf = nameOf;
    this.spots = Array.from({ length: count }, fresh);
    this.leases = new Leases(ALL_BEDS.length);
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
      if (spot.stage === SPENT && now - spot.stageStart >= FARMING.spentMinutes) {
        Object.assign(spot, fresh());
        changed = true;
        continue;
      }
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
    return Math.max(0, (RIPE - spot.stage) * stageMinutes(spot) - (now - spot.stageStart));
  }

  growth(index, now) {
    const spot = this.spots[index];
    if (!growing(spot)) return null;
    const span = stageMinutes(spot);
    return Math.min(1, Math.max(0, ((spot.stage - 1) * span + (now - spot.stageStart)) / (GROWTH_STEPS * span)));
  }

  actionFor(index, actor = PLAYER) {
    const spot = this.spots[index];
    if (spot.stage > 0 && spot.stage !== SPENT && spot.owner !== actor) return { id: 'look', hint: null };
    const purse = this.ledger.purse(actor);
    if (spot.stage === 0) {
      const now = gameNow();
      const bed = bedOf(index);
      if (!this.leases.holds(bed, actor, now)) {
        if (this.leases.holder(bed, now)) return { id: 'look', hint: null };
        return { id: 'rent', hint: 'hand', choices: { title: 'Thuê luống', options: leaseOptions() } };
      }
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

  rent(index, now, choice, actor) {
    const offer = FARMING.leases[Number(String(choice).slice(LEASE_CHOICE.length))];
    if (!offer) return null;
    const bed = bedOf(index);
    const renew = this.leases.holds(bed, actor, now);
    const lease = this.leases.rent(bed, actor, offer, this.ledger.purse(actor), now);
    if (lease === null) return `Luống của ${this.nameOf(this.leases.holder(bed, now).owner)} rồi!`;
    if (lease === false) return notEnough(offer.price);
    return `📜 ${renew ? 'Gia hạn' : 'Thuê luống'} xong, còn ${durationText(lease.until - now)}`;
  }

  leaseAction(bed, actor = PLAYER) {
    const lease = this.leases.holder(bed, gameNow());
    if (lease?.owner !== actor) return { id: 'look', hint: null };
    return { id: 'rent', hint: 'hand', choices: { title: 'Gia hạn luống', options: leaseOptions(true) } };
  }

  stakeLabel(bed, now) {
    const lease = this.leases.holder(bed, now);
    if (!lease) return null;
    return lease.owner === PLAYER ? `Còn ${durationText(lease.until - now)}` : `Luống của ${this.nameOf(lease.owner)}`;
  }

  label(index, now) {
    if (this.spots[index].stage !== 0) return null;
    const lease = this.leases.holder(bedOf(index), now);
    if (lease?.owner !== PLAYER || lease.until - now >= DAY_MINUTES) return null;
    return `Còn ${durationText(lease.until - now)}`;
  }

  act(name, index, now, choice, actor = PLAYER) {
    this.changed = false;
    if (name === 'rent' || String(choice).startsWith(LEASE_CHOICE)) return this.rent(index, now, choice, actor);
    if (name === 'plant' && !this.leases.holds(bedOf(index), actor, now)) return 'Phải thuê luống này trước!';
    const spot = this.spots[index];
    const shared = name === 'clear' && spot?.stage === SPENT;
    const action = spot && spot.stage > 0 && spot.owner !== actor && !shared ? ACTIONS.look : ACTIONS[name];
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
  for (const { x, shape, front, count } of ALL_BEDS) {
    for (let k = 0; k < count; k++) {
      const z = front + SPACING * (k + 0.5);
      spots.push({ x: x + shape.offset(z), y: shape.height(z) * 1.03, z, yaw: rand() * Math.PI * 2, scale: 0.9 + rand() * 0.2 });
    }
  }
  return spots;
}

const REACH = { across: 0.45, along: 1.3 };
const TIMER_REACH = 2.6;

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
const RIPE_ICON = { scale: 0.42, lift: 0.4 };
let ripeMaterial = null;

class FarmView {
  constructor(spots, state, field) {
    this.spots = spots;
    this.state = state;
    this.field = field;
    this.group = new THREE.Group();
    this.clickables = [];
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
    for (const child of this.group.children) {
      if (child === this.drops || child === this.ring) continue;
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    }
    this.ripeIcons = new THREE.Group();
    this.group.add(this.ripeIcons);
    this.buildStakes();
    this.refresh();
  }

  placeRipeIcons(indices) {
    ripeMaterial ??= badgeMaterial('🧺');
    const icons = this.ripeIcons.children;
    while (icons.length < indices.length) {
      const sprite = new THREE.Sprite(ripeMaterial);
      sprite.scale.setScalar(RIPE_ICON.scale);
      sprite.renderOrder = 6;
      this.ripeIcons.add(sprite);
    }
    icons.forEach((sprite, k) => {
      const index = indices[k];
      sprite.visible = index !== undefined;
      if (!sprite.visible) return;
      const spot = this.spots[index];
      sprite.position.set(spot.x, spot.y + plantTop(this.state.spots[index]) * spot.scale + RIPE_ICON.lift, spot.z);
    });
  }

  buildStakes() {
    const marker = (build) => {
      const b = new Batch();
      build(b);
      const mesh = new THREE.InstancedMesh(b.geometry(), vertexMaterial(), ALL_BEDS.length);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
      this.clickables.push(mesh);
      return mesh;
    };
    this.stakes = marker((b) => {
      b.add(shapes.box(0.1, 0.85, 0.1), 0x8a5a2b, { p: [0, 0.425, 0] });
      b.add(shapes.box(0.42, 0.28, 0.05), 0xc9a26a, { p: [0, 0.78, 0] });
    });
    this.flags = marker((b) => b.add(shapes.box(0.34, 0.22, 0.03), C.mine, { p: [0, 0.78, -0.03] }));
    this.stakeBeds = [];
    this.flagBeds = [];
    this.stakeKey = null;
    this.stakeAt = 0;
  }

  refreshStakes() {
    const now = gameNow();
    const leases = this.state.leases;
    const key = ALL_BEDS.map(({ field }, bed) => {
      const lease = field === this.field ? leases.holder(bed, now) : null;
      return lease ? (lease.owner === PLAYER ? 'p' : 'o') : '-';
    }).join('');
    if (key === this.stakeKey) return;
    this.stakeKey = key;
    this.stakeBeds = [];
    this.flagBeds = [];
    ALL_BEDS.forEach(({ x, shape, front }, bed) => {
      if (key[bed] === '-') return;
      matrix.makeTranslation(x + shape.offset(front), 0, front - 0.35);
      this.stakes.setMatrixAt(this.stakeBeds.length, matrix);
      this.stakeBeds.push(bed);
      if (key[bed] !== 'p') return;
      this.flags.setMatrixAt(this.flagBeds.length, matrix);
      this.flagBeds.push(bed);
    });
    for (const [mesh, beds] of [[this.stakes, this.stakeBeds], [this.flags, this.flagBeds]]) {
      mesh.count = beds.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = null;
    }
  }

  buildField() {
    if (this.field === 'banco') {
      this.buildPlot();
      return;
    }
    const b = new Batch();
    const rand = makeRandom(909);
    const soil = soilMaterial();
    SIDES.forEach(({ first, dir }, i) => {
      const last = first + dir * (BEDS_PER_SIDE - 1) * BED.pitch;
      const x0 = Math.min(first, last) - BED.pitch / 2 - 0.2;
      const x1 = Math.max(first, last) + BED.pitch / 2 - 0.6;
      const ground = groundDecal(raggedPatch(x0, FRONT - 0.6, x1, BACK + 0.6, 61 + i), soil, GROUND_LAYER.field);
      this.group.add(ground);
      this.clickables.push(ground);
    });

    this.addBeds(b, rand, BEDS, FRONT, BACK);
    for (const { x, z } of JARS) this.jar(b, x, z);
    for (const [x, z] of FIELD_TREES) roundTree(b, rand, { x, z, h: 4 + Math.floor(rand() * 2) });

    const mesh = b.mesh();
    this.group.add(mesh);
    this.clickables.push(mesh);

    const earth = earthMaterial();
    const path = groundDecal(roundedRectGeometry(PATH.x0, ROAD_EDGE, PATH.x1, BACK + 0.8, 0.6), earth, GROUND_LAYER.earth);
    this.group.add(path);
    this.clickables.push(path);
  }

  buildPlot() {
    const b = new Batch();
    const rand = makeRandom(919);
    const xs = BANCO_BEDS.map((bed) => bed.x);
    const x0 = Math.min(...xs) - BED.pitch / 2 - 0.2;
    const x1 = Math.max(...xs) + BED.pitch / 2 + 0.2;
    const ground = groundDecal(raggedPatch(x0, BANCO.front - 0.6, x1, BANCO_BACK + 0.6, 97), soilMaterial(), GROUND_LAYER.field);
    this.group.add(ground);
    this.clickables.push(ground);
    const path = groundDecal(roundedRectGeometry(BANCO.x - 1.4, BANCO_STREET, BANCO.x + 1.4, BANCO.front - 0.2, 0.5), earthMaterial(), GROUND_LAYER.earth);
    this.group.add(path);
    this.clickables.push(path);
    this.addBeds(b, rand, BANCO_BEDS, BANCO.front, BANCO_BACK);
    const mesh = b.mesh();
    this.group.add(mesh);
    this.clickables.push(mesh);
  }

  addBeds(b, rand, list, front, back) {
    const beds = new THREE.Mesh(bedsGeometry(list, front, back), vertexMaterial());
    beds.castShadow = true;
    beds.receiveShadow = true;
    this.group.add(beds);
    this.clickables.push(beds);
    for (const { x, shape } of list) {
      for (let i = 0; i < 26; i++) {
        const z = front - 0.3 + rand() * (back - front + 0.6);
        const side = rand() < 0.5 ? -1 : 1;
        const cx = x + shape.offset(z) + side * (0.38 + rand() * 0.28);
        const r = 0.03 + rand() * 0.035;
        b.add(shapes.ico(r, 0), CLODS[i % CLODS.length], { p: [cx, r * 0.4, z], s: [1.3, 0.7, 1.1], r: [0, rand() * 3, 0], flat: true });
      }
      for (let i = 0; i < 3; i++) {
        const z = front + rand() * (back - front);
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
  }

  jar(b, x, z) {
    const profile = [[0, 0], [0.28, 0], [0.4, 0.15], [0.45, 0.38], [0.38, 0.62], [0.29, 0.72], [0.32, 0.78]];
    b.add(shapes.lathe(profile, 14), C.jar, { p: [x, 0, z] });
    b.add(shapes.cylinder(0.29, 0.29, 0.02, 14), C.water, { p: [x, 0.7, z] });
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
    this.refreshStakes();
    const lists = new Map();
    const wet = [];
    const mine = [];
    const thirsty = [];
    const ripe = [];
    this.state.spots.forEach((spot, i) => {
      if (fieldOf(i) !== this.field) return;
      const key = modelKey(spot.stage, spot.crop, spot.variety);
      if (!lists.has(key)) lists.set(key, []);
      lists.get(key).push(i);
      if (spot.watered) wet.push(i);
      if (spot.stage > 0 && spot.owner === PLAYER) mine.push(i);
      if (this.state.thirsty(spot)) thirsty.push(i);
      if (spot.stage === RIPE && spot.owner === PLAYER) ripe.push(i);
    });
    this.placeRipeIcons(ripe);
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
    if (t >= this.stakeAt) {
      this.stakeAt = t + 1;
      this.refreshStakes();
    }
    for (const [index, anim] of this.anims) this.wither(index, anim);
    this.drops.position.y = Math.sin(t * 3) * 0.05;
    if (ripeMaterial) ripeMaterial.opacity = 0.35 + 0.65 * Math.abs(Math.sin(t * 3.2));
    if (this.ring.visible) this.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
  }

  bedOf(mesh, instanceId) {
    if (instanceId == null) return null;
    if (mesh === this.stakes) return this.stakeBeds[instanceId] ?? null;
    if (mesh === this.flags) return this.flagBeds[instanceId] ?? null;
    return null;
  }

  spotOf(mesh, instanceId) {
    if (instanceId == null) return null;
    return this.planted.get(mesh)?.[instanceId] ?? null;
  }

  hide() {
    this.anims.clear();
    this.highlight(null);
  }

  highlight(spot) {
    this.ring.visible = !!spot;
    if (spot) this.ring.position.set(spot.x, spot.y + 0.02, spot.z);
  }
}

export function createFarm({ ledger, nameOf, nav }) {
  const spots = layoutSpots();
  const state = new FarmState(spots.length, { ledger, nameOf });
  const claims = new Map();
  const built = {};
  const views = {};
  let lastTick = 0;

  const refreshAll = () => {
    for (const view of Object.values(views)) view?.refresh();
  };
  const viewOf = (index) => views[fieldOf(index)];

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
    if (changed) refreshAll();
    return changed;
  };

  function bedsFor(actor, purse, from) {
    const now = gameNow();
    const held = state.leases.heldBy(actor, now);
    if (held.length) return held;
    const offer = FARMING.leases[0];
    if (purse.money < offer.price) return [];
    const gap = (bed) => Math.hypot(ALL_BEDS[bed].x - from.x, ALL_BEDS[bed].front + (ALL_BEDS[bed].count * SPACING) / 2 - from.z);
    const bed = state.leases.free(now).sort((a, b) => gap(a) - gap(b))[0];
    if (bed === undefined) return [];
    return state.leases.rent(bed, actor, offer, purse, now) ? [bed] : [];
  }

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
      refreshAll();
      return reply;
    },
    animate: (index, kind, duration) => viewOf(index)?.animate(index, kind, duration),
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
        if (plant.stage === SPENT && plant.owner !== worker.id) {
          consider(index, 'clear', 3.5);
          return;
        }
        if (plant.stage === 0 || plant.owner !== worker.id) return;
        owned += 1;
        if (plant.stage === RIPE) consider(index, 'harvest', 0);
        else if (plant.stage === SPENT) consider(index, 'clear', 1);
        else if (state.thirsty(plant)) consider(index, 'water', 2);
        else if (fertilizer && plant.missed > 0 && worthFertilizing(plant)) consider(index, 'fertilize', 3);
      });
      if (owned < FARMING.villagerPlots && seedChoice) {
        const beds = bedsFor(worker.id, purse, worker.position);
        state.spots.forEach((plant, index) => {
          if (plant.stage === 0 && beds.includes(bedOf(index))) consider(index, 'plant', 4, seedChoice);
        });
      }
      return best;
    },
  };

  function fieldRegion(field, region) {
    return {
      ...region,
      staticNav: true,
      farmland: true,
      target(hit, from) {
        const bed = views[field]?.bedOf(hit.object, hit.instanceId) ?? null;
        if (bed !== null) {
          const index = SPOT_BED.indexOf(bed);
          const head = ALL_BEDS[bed];
          return { index, stake: bed, x: head.x + head.shape.offset(head.front), z: head.front - 0.35, stand: standFor(spots[index], from) };
        }
        const index = views[field]?.spotOf(hit.object, hit.instanceId) ?? spotAt(spots, hit.point);
        if (index == null || index < 0 || fieldOf(index) !== field) return null;
        const spot = spots[index];
        return { index, x: spot.x, z: spot.z, stand: standFor(spot, from) };
      },
      actionFor(target) {
        if (target.stake !== undefined) return state.leaseAction(target.stake);
        return placed(target.index, state.actionFor(target.index));
      },
      timeLeft(target) {
        return target.stake !== undefined ? null : state.timeLeft(target.index, gameNow());
      },
      labelOf(target) {
        if (target.stake !== undefined) return state.stakeLabel(target.stake, gameNow());
        return state.label(target.index, gameNow());
      },
      growth(target) {
        return target.stake !== undefined ? null : state.growth(target.index, gameNow());
      },
      nearbyTarget(position) {
        const now = gameNow();
        let best = -1;
        let bestDistance = TIMER_REACH;
        state.spots.forEach((plant, index) => {
          if (plant.owner !== PLAYER || fieldOf(index) !== field || state.timeLeft(index, now) == null) return;
          const distance = Math.hypot(spots[index].x - position.x, spots[index].z - position.z);
          if (distance < bestDistance) {
            best = index;
            bestDistance = distance;
          }
        });
        return best < 0 ? null : { index: best, x: spots[best].x, z: spots[best].z };
      },
      topOf(target) {
        if (target.stake !== undefined) return new THREE.Vector3(target.x, 1.15, target.z);
        const spot = spots[target.index];
        return new THREE.Vector3(spot.x, spot.y + plantTop(state.spots[target.index]) * spot.scale + 0.18, spot.z);
      },
      act(action, target, choice) {
        const reply = state.act(action, target.index, gameNow(), choice);
        refreshAll();
        return reply;
      },
      didChange() {
        return !!state.changed;
      },
      highlight(target) {
        views[field]?.highlight(target && target.stake === undefined ? spots[target.index] : null);
      },
      animate(target, kind, duration) {
        viewOf(target.index)?.animate(target.index, kind, duration);
      },
      load() {
        tick();
        if (built[field]) built[field].refresh();
        else built[field] = new FarmView(spots, state, field);
        const view = built[field];
        views[field] = view;
        return {
          group: view.group,
          clickables: view.clickables,
          update: (t) => view.update(t),
          dispose: () => {
            view.hide();
            views[field] = null;
          },
        };
      },
    };
  }

  const banco = fieldRegion('banco', {
    id: 'bancoFarm',
    name: FIELD_NAMES.banco,
    bounds: BANCO_BOUNDS,
    obstacles: BANCO_BEDS.map(({ x }) => bedBox(x, BANCO.front, BANCO_BACK)),
  });

  return fieldRegion('farm', {
    id: 'farm',
    name: FIELD_NAMES.farm,
    bounds: BOUNDS,
    obstacles: fieldObstacles(),
    crew,
    extraRegions: [banco],
    tick() {
      const now = performance.now();
      if (now - lastTick < 500) return false;
      lastTick = now;
      tick();
      return true;
    },
    chores(actor = PLAYER, at = null) {
      const now = gameNow();
      const found = new Map();
      state.spots.forEach((plant, index) => {
        if (plant.owner !== actor) return;
        const bed = bedOf(index);
        if (!state.leases.holds(bed, actor, now)) return;
        const kind = plant.stage === RIPE ? 'ripe' : state.thirsty(plant) ? 'water' : null;
        if (!kind) return;
        const key = `${kind}:${bed}`;
        if (!found.has(key)) found.set(key, { key, kind, bed, crops: [], here: standsAt(bed, at), place: `${FIELD_NAMES[ALL_BEDS[bed].field]} · luống ${BED_NUMBERS[bed]}`, point: bedHead(bed) });
        const crops = found.get(key).crops;
        const name = cropOf(plant).name;
        if (!crops.includes(name)) crops.push(name);
      });
      return [...found.values()];
    },
  });
}
