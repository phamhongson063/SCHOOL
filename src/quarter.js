import * as THREE from 'three';
import { Batch, canvasTexture, freeze, shade, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { createShophouse, createChiefHouse } from './architecture.js';
import { paving, plaqueBoard, housePlaqueLines, houseLabel, visitHouse } from './village.js';
import { PLAZA, ENCLOSURE } from './school.js';
import { ROAD } from './road.js';
import { MART } from './config.js';

const NORTH_FRONT = 29.4;
const SOUTH_FRONT = 40.6;
const DINH_FRONT = 43;
const PAVING_LAYER = GROUND_LAYER.mark + 1;
const ABOVE_PAVING = PAVING_LAYER + 1;
const BOUNDS = { x0: -38, z0: 20, x1: 37, z1: 66 };

const HOUSES = [
  { id: 'c1', side: 'north', x: -26, width: 5.5, depth: 8, stories: 2, seed: 211, home: 9, size: 'medium' },
  { id: 'c2', side: 'north', x: -32, width: 5.5, depth: 8, stories: 1, seed: 223, home: 10, size: 'small' },
  { id: 'd1', side: 'north', x: 26.5, width: 5.5, depth: 8, stories: 1, seed: 239 },
  { id: 'd2', side: 'north', x: 32.5, width: 5.5, depth: 7, stories: 2, seed: 251, home: 11, size: 'medium' },
  { id: 'a2', side: 'south', x: -18.5, width: 5.5, depth: 8, stories: 1, seed: 263, home: 12, size: 'small' },
  { id: 'b1', side: 'south', x: 19.5, width: 5.5, depth: 8, stories: 2, seed: 271, home: 13, size: 'medium' },
  { id: 'b2', side: 'south', x: 25.5, width: 6, depth: 9, stories: 1, seed: 283, home: 14, size: 'medium' },
  { id: 'b3', side: 'south', x: 31.75, width: 5.5, depth: 8, stories: 1, seed: 293, home: 15, size: 'small' },
];
const DINH = { id: 'dinh', side: 'south', x: -27, front: DINH_FRONT, seed: 307 };

const WELL = { x: -34.2, z: 46.5 };
const BANYAN = { x: -27, z: 56.5 };
const KERB = 0.4;
const RING = 1.7;
const LAKE = { x0: PLAZA.x0 - KERB, z0: PLAZA.z0 - KERB, x1: PLAZA.x1 + KERB, z1: PLAZA.z1 + KERB };
const RING_OUT = { x0: LAKE.x0 - RING, z0: ROAD.z1 + 0.4, x1: LAKE.x1 + RING, z1: LAKE.z1 + RING };
const FORECOURT = { x0: RING_OUT.x0, z0: RING_OUT.z0, x1: RING_OUT.x1, z1: RING_OUT.z0 + 5 };
const SETTS = { grout: 0x4f4d48, stones: [0x8e8b84, 0x7f7c76, 0x9a968e, 0x86827a, 0x8a8f94, 0x968c80], perRow: 12, rows: 12 };

const C = {
  stone: 0xb3ab99,
  stoneDark: 0x8a8273,
  lamp: 0xe8dcc0,
  wood: 0x6a4428,
  woodDark: 0x4a2c1e,
  roof: 0x8a4a2e,
  water: 0x2f4f52,
  trunk: 0x6e5236,
  leaf: 0x4f9e40,
  leafDark: 0x3a7d36,
  leafLight: 0x74b84f,
};

function frame(side, x, front) {
  const north = side === 'north';
  const toWorld = (p) => (north ? { x: x + p.x, z: front + p.z } : { x: x - p.x, z: front - p.z });
  const box = (b) =>
    north
      ? { minX: x + b.minX, maxX: x + b.maxX, minZ: front + b.minZ, maxZ: front + b.maxZ, minY: b.minY ?? 0, maxY: b.maxY ?? 3 }
      : { minX: x - b.maxX, maxX: x - b.minX, minZ: front - b.maxZ, maxZ: front - b.minZ, minY: b.minY ?? 0, maxY: b.maxY ?? 3 };
  return { toWorld, box, turn: north ? 0 : Math.PI };
}

const cssHex = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

function settsMaterial() {
  const map = canvasTexture(
    256,
    (ctx, s) => {
      const rand = makeRandom(4242);
      const w = s / SETTS.perRow;
      const h = s / SETTS.rows;
      ctx.fillStyle = cssHex(SETTS.grout);
      ctx.fillRect(0, 0, s, s);
      for (let r = 0; r < SETTS.rows; r++) {
        const offset = (r % 2) * w * (0.3 + rand() * 0.4);
        for (let c = -1; c <= SETTS.perRow; c++) {
          const x = c * w + offset + (rand() - 0.5) * 2;
          const y = r * h + (rand() - 0.5) * 2;
          const base = SETTS.stones[Math.floor(rand() * SETTS.stones.length)];
          const inset = 1.6 + rand() * 1.2;
          ctx.fillStyle = cssHex(shade(base, 0.85 + rand() * 0.3));
          ctx.beginPath();
          ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, 3);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(x + inset + 1, y + inset + 1, w - inset * 2 - 2, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.14)';
          ctx.fillRect(x + inset + 1, y + h - inset - 3, w - inset * 2 - 2, 2);
          for (let k = 0; k < 2; k++) {
            ctx.fillStyle = `rgba(40,38,35,${0.1 + rand() * 0.15})`;
            ctx.beginPath();
            ctx.ellipse(x + inset + 2 + rand() * (w - inset * 2 - 4), y + inset + 2 + rand() * (h - inset * 2 - 4), 0.6 + rand() * 1.4, 0.6 + rand(), 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
    [0.45, 0.45],
  );
  return toonMaterial({ muted: true, map, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
}

function well(b, x, z) {
  b.add(shapes.cylinder(0.95, 1.02, 0.72, 18), C.stone, { p: [x, 0.36, z] });
  b.add(shapes.torus(0.9, 0.08, 18), C.stoneDark, { p: [x, 0.72, z], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.cylinder(0.74, 0.74, 0.04, 18), C.water, { p: [x, 0.62, z] });
  for (const side of [-1, 1]) b.add(shapes.box(0.14, 2.2, 0.14), C.wood, { p: [x + side * 0.95, 1.1, z] });
  b.add(shapes.cylinder(0.06, 0.06, 2.1, 8), C.woodDark, { p: [x, 1.85, z], r: [0, 0, Math.PI / 2] });
  b.limb([x, 1.85, z], [x, 1.3, z], 0.012, 0x3a2414, { capsule: false, seg: 4 });
  b.add(shapes.cylinder(0.14, 0.11, 0.22, 10), C.wood, { p: [x, 1.2, z] });
  for (const side of [-1, 1]) b.add(shapes.box(2.5, 0.07, 0.95), C.roof, { p: [x, 2.52, z + side * 0.4], r: [side * 0.55, 0, 0] });
  b.add(shapes.box(2.6, 0.1, 0.12), C.woodDark, { p: [x, 2.78, z] });
}

function bench(b, x, z, turn) {
  b.group([x, 0, z], [0, turn, 0], () => {
    b.add(shapes.box(1.7, 0.09, 0.46), C.wood, { p: [0, 0.46, 0] });
    for (const side of [-1, 1]) b.add(shapes.box(0.14, 0.42, 0.42), C.stoneDark, { p: [side * 0.66, 0.21, 0] });
  });
}

function stoneLantern(b, x, z) {
  b.add(shapes.box(0.55, 0.18, 0.55), C.stoneDark, { p: [x, 0.09, z] });
  b.add(shapes.box(0.22, 0.85, 0.22), C.stone, { p: [x, 0.6, z] });
  b.add(shapes.box(0.5, 0.08, 0.5), C.stone, { p: [x, 1.06, z] });
  b.add(shapes.box(0.4, 0.34, 0.4), C.lamp, { p: [x, 1.27, z] });
  b.add(shapes.cone(0.46, 0.34, 4), C.stone, { p: [x, 1.61, z], r: [0, Math.PI / 4, 0] });
  b.add(shapes.sphere(0.07, 8, 6), C.stone, { p: [x, 1.82, z] });
}

function banyan(b, x, z) {
  b.limb([x, 0, z], [x, 4.4, z], 0.6, C.trunk, { capsule: false, seg: 9, radiusEnd: 0.36 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    b.limb([x + Math.cos(a) * 1.25, 0, z + Math.sin(a) * 1.25], [x + Math.cos(a) * 0.3, 1.5, z + Math.sin(a) * 0.3], 0.13, C.trunk, { capsule: false, seg: 5, radiusEnd: 0.2 });
  }
  for (const [dx, dz] of [[1.9, 0.5], [-1.8, -0.4], [0.3, -1.9], [-0.5, 1.8]]) {
    b.limb([x, 3.6, z], [x + dx, 5.1, z + dz], 0.2, C.trunk, { capsule: false, seg: 6, radiusEnd: 0.1 });
    b.limb([x + dx * 0.95, 4.9, z + dz * 0.95], [x + dx * 0.95, 1.2, z + dz * 0.95], 0.025, C.trunk, { capsule: false, seg: 4 });
  }
  const crown = [
    [0, 6.1, 0, 2.7, C.leaf],
    [2, 5.5, 0.6, 2.0, C.leafDark],
    [-1.9, 5.6, -0.5, 2.1, C.leaf],
    [0.4, 6.8, -1.3, 1.8, C.leafLight],
    [-0.6, 5.4, 1.9, 1.9, C.leafDark],
    [1.2, 6.9, 1.1, 1.6, C.leafLight],
  ];
  for (const [dx, y, dz, r, color] of crown) b.add(shapes.ico(r, 1), color, { p: [x + dx, y, z + dz], s: [1, 0.78, 1], flat: true });
}

export function createQuarter() {
  const group = new THREE.Group();
  const clickables = [];
  const obstacles = [];
  const places = [];
  const surface = paving();

  const pave = (x0, z0, x1, z1, r = 0.4) => {
    const decal = groundDecal(roundedRectGeometry(x0, z0, x1, z1, r), surface, PAVING_LAYER, 0.014);
    group.add(decal);
    clickables.push(decal);
  };

  pave(ENCLOSURE.x0 + 0.6, ENCLOSURE.front + 0.6, ENCLOSURE.x1 + 0.4, ROAD.z0 + 0.2, 0.5);
  pave(RING_OUT.x0, RING_OUT.z0, RING_OUT.x1, RING_OUT.z1);
  const forecourt = groundDecal(roundedRectGeometry(FORECOURT.x0, FORECOURT.z0, FORECOURT.x1, FORECOURT.z1, 0.4), settsMaterial(), PAVING_LAYER + 0.5, 0.016);
  group.add(forecourt);
  clickables.push(forecourt);
  pave(DINH.x - 4, ROAD.z1 - 0.2, DINH.x + 4, DINH_FRONT + 0.4, 0.5);
  pave(WELL.x - 2, WELL.z - 2, WELL.x + 2, WELL.z + 2, 1.2);

  const addPlace = (built, spec, name, front, door) => {
    const f = frame(spec.side, spec.x, front);
    built.group.position.set(spec.x, 0, front);
    built.group.rotation.y = f.turn;
    built.group.updateMatrixWorld(true);
    obstacles.push(...built.obstacles.map(f.box));
    group.add(built.group);
    clickables.push(built.group);
    const place = { id: spec.id, name, group: built.group, stand: f.toWorld(door), look: f.toWorld({ x: 0, z: -1 }) };
    places.push(place);
    return place;
  };
  const homes = [];
  const homeDoors = new Map();
  const homePlaques = new Map();

  for (const spec of HOUSES) {
    const house = createShophouse({ seed: spec.seed, width: spec.width, depth: spec.depth, stories: spec.stories });
    const mart = spec.id === MART.house;
    if (mart) {
      const board = plaqueBoard(['SIÊU THỊ'], { bg: 0x1f4a6e, fg: '#fff3c4', border: 0xf2c14e });
      board.mesh.position.set(house.plaque.x, house.plaque.y, house.plaque.z);
      house.group.add(board.mesh);
    }
    if (spec.home) {
      const board = plaqueBoard([`Nhà số ${spec.home}`, 'Đang bán']);
      board.mesh.position.set(house.plaque.x, house.plaque.y, house.plaque.z);
      house.group.add(board.mesh);
      homePlaques.set(spec.home, board);
    }
    const place = addPlace(house, spec, mart ? 'Siêu thị' : 'Nhà dân', spec.side === 'north' ? NORTH_FRONT : SOUTH_FRONT, { x: house.door.x, z: house.door.z + 0.4 });
    if (spec.home) {
      place.home = spec.home;
      homes.push({ id: spec.home, size: spec.size });
      homeDoors.set(spec.home, place.stand);
    }
  }

  const dinh = createChiefHouse({ seed: DINH.seed });
  const sign = plaqueBoard(['ĐÌNH LÀNG'], { bg: 0x8a1d14, fg: '#ffe08a', border: 0xf2c14e });
  sign.mesh.position.set(dinh.plaque.x, dinh.plaque.y, dinh.plaque.z);
  dinh.group.add(sign.mesh);
  addPlace(dinh, DINH, 'Đình làng', DINH_FRONT, { x: 0, z: 1.2 });

  const rand = makeRandom(7373);
  const b = new Batch();
  const block = (x, z, hx, hz, maxY = 3) => obstacles.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, minY: 0, maxY });

  well(b, WELL.x, WELL.z);
  block(WELL.x, WELL.z, 1.05, 1.05);
  banyan(b, BANYAN.x, BANYAN.z);
  block(BANYAN.x, BANYAN.z, 0.9, 0.9, 5);

  const lanterns = [
    [RING_OUT.x0 + 0.5, RING_OUT.z0 + 0.6],
    [RING_OUT.x1 - 0.5, RING_OUT.z0 + 0.6],
    [RING_OUT.x0 + 0.5, RING_OUT.z1 - 0.5],
    [RING_OUT.x1 - 0.5, RING_OUT.z1 - 0.5],
    [DINH.x - 3.4, DINH_FRONT - 1],
    [DINH.x + 3.4, DINH_FRONT - 1],
  ];
  for (const [x, z] of lanterns) {
    stoneLantern(b, x, z);
    block(x, z, 0.3, 0.3);
  }

  const midZ = (LAKE.z0 + LAKE.z1) / 2;
  for (const z of [midZ - 5, midZ + 5]) {
    const west = RING_OUT.x0 + 0.55;
    const east = RING_OUT.x1 - 0.55;
    bench(b, west, z, Math.PI / 2);
    bench(b, east, z, Math.PI / 2);
    block(west, z, 0.3, 0.9, 1);
    block(east, z, 0.3, 0.9, 1);
  }

  for (const [x, z, h] of [[-19, 53, 4], [20, 54, 5], [30, 53.5, 4], [-19, 62.5, 4]]) {
    roundTree(b, rand, { x, z, h });
    block(x + 0.5, z + 0.5, 0.3, 0.3, h);
  }

  group.add(b.mesh());
  group.traverse((node) => {
    if (node.isMesh && node.renderOrder !== PAVING_LAYER && node !== forecourt) node.renderOrder = ABOVE_PAVING;
  });
  freeze(group);

  const placeOf = (object) => {
    for (let node = object; node; node = node.parent) {
      const place = places.find((item) => item.group === node);
      if (place) return place;
    }
    return null;
  };

  return {
    obstacles,
    homes,
    homeDoors,
    martStand: places.find((place) => place.id === MART.house).stand,
    region(options = {}) {
      const houseOf = (place) => (place?.home ? options.estate.houses.find((house) => house.id === place.home) : null);
      const refreshPlaques = () => {
        for (const [id, board] of homePlaques) {
          const house = options.estate.houses.find((item) => item.id === id);
          if (house) board.paint(housePlaqueLines(house, options.nameOf));
        }
      };
      refreshPlaques();
      options.estate.onChange(refreshPlaques);
      return {
        id: 'quarter',
        name: 'Xóm Văn Miếu',
        bounds: BOUNDS,
        staticNav: true,
        target(hit) {
          const place = placeOf(hit.object);
          if (!place) return null;
          return { kind: 'place', id: place.id, index: `place:${place.id}`, x: place.look.x, z: place.look.z, stand: place.stand };
        },
        actionFor() {
          return { id: 'visit', hint: 'hand' };
        },
        labelOf(target) {
          const place = places.find((item) => item.id === target.id);
          const house = houseOf(place);
          if (house) return houseLabel(options.estate, house, options.nameOf);
          return place?.name ?? null;
        },
        topOf(target) {
          return new THREE.Vector3(target.x, 3.8, target.z);
        },
        act(action, target) {
          const house = houseOf(places.find((item) => item.id === target.id));
          if (house) return visitHouse(options, house);
          if (target.id !== MART.house) return null;
          if (!options.isMartOpen()) return `Siêu thị đóng cửa rồi, mở ${options.martHours()} nhé!`;
          options.openMart();
          return null;
        },
        load() {
          return { group, clickables, obstacles: [] };
        },
      };
    },
  };
}
