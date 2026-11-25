import * as THREE from 'three';
import { Batch, freeze, shade, shapes } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { ROAD } from './road.js';
import { CROSSING, ISLE, deckHeight, isleNorth, northBank, onIsle } from './riverShape.js';
import { idleKeeper, keeperNPC } from './village.js';
import { SHOPKEEPERS } from './economy.js';
import { NPC } from './npcIds.js';
import { createAttention } from './attention.js';
import { arcSlots, claimHold, createSlotClaims } from './blessingSpots.js';
import { createIsleLamps, createIsleLights } from './isleLights.js';

export const ISLE_NAME = 'Cù lao Hoài';

const WOOD = 0x7a5232;
const WOOD_LIGHT = 0x8a603a;
const WOOD_DARK = 0x553820;
const LACQUER = 0xa12a1c;
const LACQUER_DARK = 0x7a1e14;
const GILT = 0xd8b45a;
const BUSH = [0x5fae48, 0x4f9a3e, 0x6fbe52];
const PLANK = 0.32;
const POST_GAP = 1.8;
const PILE_GAP = 3.6;
const RAIL_HEIGHT = 0.9;
const STRINGER_STEP = 0.8;
const LANDING = { half: 1.3, depth: 10 };
const LANE = { half: 1.1 };
const TREES = { count: 28, gap: 6.5, edge: 4.5, tries: 600 };
const MEADOW = { x: ISLE.x + 3, z: ISLE.z + 2, radius: 9 };
const BUSHES = 40;
const SAND = [0xe6c993, 0xdcbc82, 0xd2b175];
const SAND_DARK = 0xb8955c;
const SAND_SHADOW = 0x5a4428;
const SHELL = [0xf2d6c8, 0xf6e9da, 0xe8b9a6];
const FLAG = 0xc23a26;
const CASTLE = { x: ISLE.x, z: ISLE.z, scale: 0.9, half: 4.2, wall: 2.2, thick: 0.6, tower: 1.05, towerHeight: 3.2, clear: 9.5 };
const KEEP_TIERS = [
  { r: 2.1, h: 3.4 },
  { r: 1.45, h: 1.9 },
  { r: 0.9, h: 1.3 },
];
const HOST_LOOK = { shirt: 0x2f7d8a, pants: 0x2a2420, skin: 0xf0c09a, style: 'bun', hairColor: 0x2a2420, iris: 0x3a2214 };
const HOST_MODEL = 'girl-jade';
const HOST_GAP = 1.5;
const STAND_GAP = 1.6;
const PLAZA = { half: 3.2, back: 1.2 };
const WATCH = {
  rows: [
    { radius: 8.6, angles: [-1.15, -0.9, -0.65, -0.4, 0.4, 0.65, 0.9, 1.15] },
    { radius: 9.6, angles: [-1.05, -0.8, -0.55, -0.3, 0.3, 0.55, 0.8, 1.05] },
  ],
  reach: 12,
  sky: 9,
  back: 10.6,
};

const landingZ = isleNorth(CROSSING.x);
export const ISLE_LOOK = { x: ISLE.x, z: ISLE.z + 13 };
export const CASTLE_LOOK = { x: CASTLE.x, z: CASTLE.z };
const castleFront = CASTLE.z - (CASTLE.half + CASTLE.thick / 2) * CASTLE.scale;
const HOST_AT = { x: CASTLE.x, z: castleFront - HOST_GAP };
export const CASTLE_STAND = { x: CASTLE.x, z: HOST_AT.z - STAND_GAP };
export const ISLE_STAND = { x: CROSSING.x, z: landingZ + LANDING.depth - 1 };
export const ISLE_BOUNDS = { x0: ISLE.x0 - 2, z0: CROSSING.z1 - 4, x1: ISLE.x1 + 2, z1: Math.ceil(ISLE.z + ISLE.halfZ * 1.1) + 4 };

const slopeAt = (z) => (deckHeight(z + 0.05) - deckHeight(z - 0.05)) / 0.1;
const railX = (side) => CROSSING.x + side * (CROSSING.half + CROSSING.rail / 2);
const inWater = (z) => z > northBank(CROSSING.x) + 0.6 && z < landingZ - 0.6;

function bridge(b) {
  const { x: cx, half, z0, z1, length } = CROSSING;
  const planks = Math.round(length / PLANK);
  for (let i = 0; i < planks; i++) {
    const z = z0 + (i + 0.5) * (length / planks);
    b.add(shapes.box(half * 2 + 0.1, 0.07, (length / planks) * 0.92), i % 2 ? WOOD_LIGHT : WOOD, {
      p: [cx, deckHeight(z) - 0.035, z],
      r: [-Math.atan(slopeAt(z)), 0, 0],
    });
  }
  for (let z = z0; z < z1 - 1e-6; z += STRINGER_STEP) {
    const next = Math.min(z1, z + STRINGER_STEP);
    for (const side of [-1, 1]) {
      const x = cx + side * (half - 0.2);
      b.limb([x, deckHeight(z) - 0.14, z], [x, deckHeight(next) - 0.14, next], 0.09, WOOD_DARK, { capsule: false, seg: 6 });
    }
  }
  for (let z = z0 + PILE_GAP / 2; z < z1; z += PILE_GAP) {
    if (!inWater(z)) continue;
    const top = deckHeight(z) - 0.15;
    for (const side of [-1, 1]) b.limb([cx + side * (half - 0.2), -0.9, z], [cx + side * (half - 0.2), top, z], 0.12, WOOD_DARK, { capsule: false, seg: 7 });
    b.add(shapes.box(half * 2 + 0.2, 0.14, 0.16), WOOD_DARK, { p: [cx, top - 0.12, z] });
  }
  const posts = Math.round(length / POST_GAP);
  for (const side of [-1, 1]) {
    const x = railX(side);
    for (let i = 0; i <= posts; i++) {
      const z = z0 + (i * length) / posts;
      const end = i === 0 || i === posts;
      const deck = deckHeight(z);
      const h = end ? RAIL_HEIGHT + 0.35 : RAIL_HEIGHT + 0.08;
      b.add(shapes.box(end ? 0.2 : 0.13, h, end ? 0.2 : 0.13), LACQUER, { p: [x, deck + h / 2 - 0.05, z] });
      b.add(shapes.sphere(end ? 0.12 : 0.07, 8, 6), end ? GILT : LACQUER_DARK, { p: [x, deck + h + 0.02, z], s: [1, 1.3, 1] });
      if (i === posts) continue;
      const next = z0 + ((i + 1) * length) / posts;
      const nextDeck = deckHeight(next);
      b.limb([x, deck + RAIL_HEIGHT, z], [x, nextDeck + RAIL_HEIGHT, next], 0.055, LACQUER, { capsule: false, seg: 6 });
      b.limb([x, deck + 0.38, z], [x, nextDeck + 0.38, next], 0.035, LACQUER_DARK, { capsule: false, seg: 5 });
      const mid = (z + next) / 2;
      b.add(shapes.box(0.04, RAIL_HEIGHT - 0.42, 0.04), LACQUER_DARK, { p: [x, deckHeight(mid) + 0.38 + (RAIL_HEIGHT - 0.38) / 2, mid] });
    }
  }
}

const sand = (rand, k = 0) => shade(SAND[k % SAND.length], 0.94 + rand() * 0.1);

function crenels(b, rand, x, z, r, y, count, size, turn = 0) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + turn;
    b.add(shapes.box(size, size * 1.1, size), sand(rand, i), { p: [x + Math.cos(a) * r, y + size * 0.55, z + Math.sin(a) * r], r: [0, -a, 0] });
  }
}

function tower(b, rand, x, z, r, h, flag) {
  b.add(shapes.cylinder(r * 0.88, r, h, 16), sand(rand, 1), { p: [x, h / 2, z] });
  b.add(shapes.cylinder(r * 0.98, r * 0.98, 0.16, 16), SAND_DARK, { p: [x, h - 0.05, z] });
  crenels(b, rand, x, z, r * 0.8, h, 8, 0.34);
  for (const band of [0.32, 0.62]) b.add(shapes.torus(r * (1 - band * 0.12), 0.04, 18), SAND_DARK, { p: [x, h * band, z], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.box(0.22, 0.42, 0.06), SAND_SHADOW, { p: [x, h * 0.72, z - r * 0.9] });
  if (flag) pennant(b, x, h, z, 1.1);
}

function pennant(b, x, y, z, height) {
  b.add(shapes.cylinder(0.035, 0.035, height, 6), WOOD_DARK, { p: [x, y + height / 2, z] });
  b.add(shapes.box(0.04, 0.34, 0.6), FLAG, { p: [x, y + height - 0.2, z + 0.31] });
}

function wall(b, rand, x0, z0, x1, z1) {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const angle = Math.atan2(x1 - x0, z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  b.add(shapes.box(CASTLE.thick, CASTLE.wall, length), sand(rand), { p: [cx, CASTLE.wall / 2, cz], r: [0, angle, 0] });
  b.add(shapes.box(CASTLE.thick + 0.08, 0.12, length), SAND_DARK, { p: [cx, CASTLE.wall - 0.04, cz], r: [0, angle, 0] });
  const merlons = Math.floor(length / 0.7);
  for (let i = 0; i < merlons; i += 2) {
    const t = (i + 0.5) / merlons;
    b.add(shapes.box(CASTLE.thick * 0.9, 0.34, 0.34), sand(rand, i), { p: [x0 + (x1 - x0) * t, CASTLE.wall + 0.17, z0 + (z1 - z0) * t], r: [0, angle, 0] });
  }
}

function shells(b, rand) {
  const { x, z, half, wall: h } = CASTLE;
  for (let i = 0; i < 26; i++) {
    const side = i % 4;
    const u = (rand() * 2 - 1) * (half - 1.2);
    const y = 0.4 + rand() * (h - 0.9);
    const out = half + CASTLE.thick / 2 + 0.02;
    const [px, pz] = [[x + u, z - out], [x + out, z + u], [x + u, z + out], [x - out, z + u]][side];
    b.add(shapes.sphere(0.09 + rand() * 0.05, 8, 6), SHELL[i % SHELL.length], { p: [px, y, pz], s: [1, 0.7, 0.4], r: [0, (side * Math.PI) / 2, 0] });
  }
}

function castle(b, rand) {
  const { x, z, half } = CASTLE;
  const mound = (half + CASTLE.tower + 0.3) * 2;
  b.add(shapes.rounded(mound, 0.3, mound, 0.12), SAND_DARK, { p: [x, 0.1, z] });
  b.add(shapes.rounded(mound - 0.6, 0.2, mound - 0.6, 0.08), SAND[0], { p: [x, 0.25, z] });
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i];
    const [bx, bz] = corners[(i + 1) % 4];
    wall(b, rand, x + ax * half, z + az * half, x + bx * half, z + bz * half);
  }
  corners.forEach(([sx, sz], i) => tower(b, rand, x + sx * half, z + sz * half, CASTLE.tower, CASTLE.towerHeight, i < 2));
  let base = 0;
  KEEP_TIERS.forEach(({ r, h }, i) => {
    b.add(shapes.cylinder(r * 0.9, r, h, 20), sand(rand, i), { p: [x, base + h / 2, z] });
    b.add(shapes.cylinder(r * 1.02, r * 1.02, 0.14, 20), SAND_DARK, { p: [x, base + h - 0.05, z] });
    crenels(b, rand, x, z, r * 0.82, base + h, 6 + 2 * (KEEP_TIERS.length - 1 - i), 0.32, i * 0.4);
    b.add(shapes.box(0.26, 0.5, 0.06), SAND_SHADOW, { p: [x, base + h * 0.6, z - r * 0.92] });
    base += h;
  });
  pennant(b, x, base, z, 1.6);
  const front = z - half - CASTLE.thick / 2 - 0.02;
  b.add(shapes.box(1.3, 1.2, 0.06), SAND_SHADOW, { p: [x, 0.9, front] });
  b.add(shapes.sphere(0.65, 16, 8), SAND_SHADOW, { p: [x, 1.5, front], s: [1, 1, 0.05] });
  b.add(shapes.torus(0.72, 0.07, 16, Math.PI), SAND_DARK, { p: [x, 1.5, front - 0.04] });
  for (const side of [-1, 1]) b.add(shapes.box(0.14, 1.2, 0.14), SAND_DARK, { p: [x + side * 0.72, 0.9, front - 0.04] });
  for (const side of [-1, 1]) {
    const sx = x + side * 1.6;
    b.add(shapes.cylinder(0.28, 0.34, 0.9, 10), sand(rand, 2), { p: [sx, 0.45, front - 0.5] });
    b.add(shapes.cone(0.3, 0.45, 10), SAND_DARK, { p: [sx, 1.12, front - 0.5] });
  }
  shells(b, rand);
}

const clearOfCastle = (x, z, gap) => Math.hypot(x - CASTLE.x, z - CASTLE.z) > gap;

function castleObstacles() {
  const { x, z, half, tower: r, scale } = CASTLE;
  const reach = (half + r) * scale;
  return [{ minX: x - reach, maxX: x + reach, minZ: z - reach, maxZ: z + reach, minY: 0, maxY: 8 }];
}

function createHost() {
  const npc = keeperNPC(HOST_LOOK, HOST_MODEL, SHOPKEEPERS.find((keeper) => keeper.id === NPC.host)?.name ?? '');
  const at = new THREE.Vector3(HOST_AT.x, 0, HOST_AT.z);
  npc.walker.group.position.copy(at);
  npc.walker.group.rotation.y = Math.PI;
  const attention = createAttention(npc.walker.group);
  let clock = 0;
  return {
    group: npc.walker.group,
    at,
    stand: CASTLE_STAND,
    attend: attention.attend,
    release: attention.release,
    say(text, seconds) {
      npc.bubble.show(text, seconds, clock);
    },
    update(t) {
      clock = t;
      attention.update(t);
      idleKeeper(npc, t);
    },
  };
}

function pickTrees(rand) {
  const trees = [];
  const clearOfLanding = (x, z) => Math.abs(x - CROSSING.x) > LANDING.half + 3 || z > CASTLE_STAND.z;
  const clearOfMeadow = (x, z) => Math.hypot(x - MEADOW.x, z - MEADOW.z) > MEADOW.radius;
  for (let i = 0; i < TREES.tries && trees.length < TREES.count; i++) {
    const x = ISLE.x0 + rand() * (ISLE.x1 - ISLE.x0);
    const z = ISLE.z - ISLE.halfZ + rand() * ISLE.halfZ * 2;
    if (!onIsle(x, z, TREES.edge) || !clearOfLanding(x, z) || !clearOfMeadow(x, z) || !clearOfCastle(x + 0.5, z + 0.5, CASTLE.clear)) continue;
    if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < TREES.gap)) continue;
    trees.push({ x, z, h: 4 + Math.floor(rand() * 2) });
  }
  return trees;
}

function bushes(b, rand, trees) {
  let placed = 0;
  for (let i = 0; i < BUSHES * 6 && placed < BUSHES; i++) {
    const x = ISLE.x0 + rand() * (ISLE.x1 - ISLE.x0);
    const z = ISLE.z - ISLE.halfZ + rand() * ISLE.halfZ * 2;
    if (!onIsle(x, z, 2.5) || Math.abs(x - CROSSING.x) < LANDING.half + 1.5 || !clearOfCastle(x, z, CASTLE.clear - 2)) continue;
    if (trees.some((tree) => Math.hypot(tree.x + 0.5 - x, tree.z + 0.5 - z) < 1.6)) continue;
    const r = 0.35 + rand() * 0.35;
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      b.add(shapes.ico(r * (0.7 + rand() * 0.4), 1), shade(BUSH[k], 0.9 + rand() * 0.2), {
        p: [x + Math.cos(a) * r * 0.6, r * 0.55, z + Math.sin(a) * r * 0.6],
        s: [1, 0.8, 1],
        flat: true,
      });
    }
    placed++;
  }
}

function createWatchField() {
  const center = { x: CASTLE.x, z: CASTLE.z };
  const claims = createSlotClaims(arcSlots(center, Math.PI, WATCH.rows));
  let clock = 0;
  return {
    center,
    sky: new THREE.Vector3(CASTLE.x, WATCH.sky, CASTLE.z),
    watch: { x: CASTLE.x, z: CASTLE.z - WATCH.back },
    inside: (position) => Math.hypot(position.x - center.x, position.z - center.z) < WATCH.reach && position.z < CASTLE.z,
    spotFor(id, from, speed) {
      const slot = claims.claim(id, clock, claimHold(from, center, speed));
      return new THREE.Vector3(slot.x, 0, slot.z);
    },
    leaveSpot: (id) => claims.release(id),
    tick(t) {
      clock = t;
    },
  };
}

export function createRiverIsle({ visitHost }) {
  const trees = pickTrees(makeRandom(7171));
  const host = createHost();
  const field = createWatchField();
  const lamps = createIsleLamps({ castleX: CASTLE.x, castleFront });
  const hostBox = { minX: HOST_AT.x - 0.3, maxX: HOST_AT.x + 0.3, minZ: HOST_AT.z - 0.3, maxZ: HOST_AT.z + 0.3, minY: 0, maxY: 2 };
  const rails = [-1, 1].map((side) => ({
    minX: railX(side) - CROSSING.rail / 2,
    maxX: railX(side) + CROSSING.rail / 2,
    minZ: CROSSING.z0,
    maxZ: CROSSING.z1,
    minY: -1,
    maxY: 4,
  }));
  const obstacles = [...rails, ...castleObstacles(), hostBox, ...trees.map(({ x, z }) => ({ minX: x + 0.2, minZ: z + 0.2, maxX: x + 0.8, maxZ: z + 0.8, minY: 0, maxY: 3 }))];
  let built = null;
  let lights = null;
  let night = 0;

  function build() {
    const group = new THREE.Group();
    const earth = earthMaterial();
    const paths = [
      groundDecal(roundedRectGeometry(CROSSING.x - LANE.half, ROAD.z1 - 0.5, CROSSING.x + LANE.half, CROSSING.z0 + 0.5, 0.5), earth, GROUND_LAYER.earth),
      groundDecal(roundedRectGeometry(CROSSING.x - LANDING.half, landingZ + 0.5, CROSSING.x + LANDING.half, landingZ + LANDING.depth, 0.6), earth, GROUND_LAYER.earth),
      groundDecal(roundedRectGeometry(CROSSING.x - LANE.half, landingZ + LANDING.depth - 0.5, CROSSING.x + LANE.half, CASTLE_STAND.z - PLAZA.back + 0.5, 0.5), earth, GROUND_LAYER.earth),
      groundDecal(roundedRectGeometry(CASTLE.x - PLAZA.half, CASTLE_STAND.z - PLAZA.back, CASTLE.x + PLAZA.half, castleFront, 0.8), earth, GROUND_LAYER.earth),
    ];
    group.add(...paths);
    const deck = new Batch();
    bridge(deck);
    const bridgeMesh = deck.mesh();
    bridgeMesh.renderOrder = GROUND_LAYER.mark + 2;
    const b = new Batch();
    const rand = makeRandom(7272);
    for (const tree of trees) roundTree(b, rand, tree);
    bushes(b, rand, trees);
    const details = b.mesh();
    const keep = new Batch();
    castle(keep, makeRandom(7373));
    const castleMesh = keep.mesh();
    castleMesh.scale.setScalar(CASTLE.scale);
    castleMesh.position.set(CASTLE.x * (1 - CASTLE.scale), 0, CASTLE.z * (1 - CASTLE.scale));
    group.add(bridgeMesh, details, castleMesh);
    freeze(group);
    lights = createIsleLights({
      castle: { ...CASTLE, keepTiers: KEEP_TIERS },
      castleFront,
      bridge: { postGap: POST_GAP, railHeight: RAIL_HEIGHT, inWater },
      clearOfCastle: (x, z) => clearOfCastle(x, z, CASTLE.clear),
    });
    lights.setNight(night);
    const root = new THREE.Group();
    root.add(group, lights.group, host.group);
    const update = (t, dt) => {
      host.update(t);
      lights.update(t, dt);
    };
    return { group: root, clickables: [bridgeMesh, ...paths, castleMesh, host.group], obstacles: [], update, castleMesh };
  }

  const ownsHost = (object) => {
    for (let node = object; node; node = node.parent) if (node === host.group || node === built?.castleMesh) return true;
    return false;
  };

  return {
    obstacles,
    host,
    field,
    lamps: lamps.group,
    setNight(k) {
      night = k;
      lamps.setNight(k);
      lights?.setNight(k);
    },
    region: {
      id: 'isle',
      name: ISLE_NAME,
      bounds: ISLE_BOUNDS,
      staticNav: true,
      interact(object) {
        if (!ownsHost(object)) return false;
        visitHost(host);
        return true;
      },
      load() {
        built ??= build();
        return built;
      },
    },
  };
}
