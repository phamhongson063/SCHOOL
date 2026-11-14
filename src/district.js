import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, freeze, shapes } from './toon.js';
import { makeRandom } from './random.js';
import { groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { createShophouse, createBank, createArenaCompound, shophousePots } from './architecture.js';
import { paving, plaqueBoard, keeperNPC } from './village.js';
import { bankOpen, bankHours } from './bank.js';
import { LODGE_ROOMS } from './config.js';
import { roomTier } from './lodging.js';
import { createVillageGate, villageGateObstacles } from './countryside.js';

const AVENUES = [104, 126, 148, 170];
const STREET = 3;
const MAIN = { z0: 33, z1: 37 };
const SOUTH_STREET = 60;
const EAST_GATE = 181;
const DEPTH = 8;
const PLAZA_BLOCK = 1;
const BOUNDS = { x0: 100, z0: 4, x1: 185, z1: 64 };
const PAVING_LAYER = GROUND_LAYER.mark + 1;
const ABOVE_PAVING = PAVING_LAYER + 1;
const STALL_CLOTHS = [0xc0281a, 0x2f7ab8, 0xd8a030, 0x3a8a5a];
const ROW = { x0: 102, x1: 179 };
const LODGE_PICKS = { 'north:0': 'banco-1', 'south:5': 'banco-2', 'south:1': 'banco-3', 'north:7': 'banco-4', 'north:4': 'banco-5' };
const BANK_PICK = 'south:0';
const ARENA_LOT = { picks: ['north:2', 'north:3'], width: 16.2, depth: 11 };
const REGISTRAR_LOOK = { shirt: 0xe8e0cc, pants: 0x3a3430, skin: 0xe0b088, style: 'khan', khan: 0x2a2a30, hairColor: 0x2a2420, beardColor: 0xd8d4cc, iris: 0x3a2214 };
const REGISTRAR = { model: 'monk-brown', reach: 1.4, spots: [-0.9, 0, 0.9] };
const EMPTY_PICKS = new Set(['south:4']);
const BANK_WIDTH = 8.4;
const TELLER_LOOK = { shirt: 0x2f6f8e, pants: 0x1f2a3a, skin: 0xf0c09a, style: 'bui', iris: 0x3a2214 };
const TELLER_DISTANCE = 60;
const LODGE_LOOKS = {
  cheap: { stories: 1, sign: { bg: 0x3a2c22, fg: '#e8dcc0', border: 0x6a5a48 } },
  cozy: { stories: 1, sign: { bg: 0x1c1310, fg: '#f2c14e', border: 0x8a1d14 } },
  grand: { stories: 2, sign: { bg: 0x8a1d14, fg: '#ffe08a', border: 0xf2c14e } },
};

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

function place(f, box) {
  return f.north
    ? { minX: f.x + box.minX, maxX: f.x + box.maxX, minZ: f.front + box.minZ, maxZ: f.front + box.maxZ, minY: box.minY ?? 0, maxY: box.maxY ?? 3 }
    : { minX: f.x - box.maxX, maxX: f.x - box.minX, minZ: f.front - box.maxZ, maxZ: f.front - box.minZ, minY: box.minY ?? 0, maxY: box.maxY ?? 3 };
}

function spread(x0, x1, count) {
  const step = (x1 - x0) / count;
  return Array.from({ length: count }, (_, k) => x0 + step * (k + 0.5));
}

function layout() {
  const rand = makeRandom(6161);
  const plaza = { x0: AVENUES[PLAZA_BLOCK] + STREET / 2, x1: AVENUES[PLAZA_BLOCK + 1] - STREET / 2, z0: MAIN.z1 + 1.6, z1: SOUTH_STREET - STREET / 2 };
  const rows = [
    { side: 'north', front: MAIN.z0 - 1.6, xs: spread(ROW.x0, ROW.x1, 9) },
    { side: 'south', front: MAIN.z1 + 1.6, xs: [...spread(ROW.x0, plaza.x0 - 1, 3), ...spread(plaza.x1 + 1, ROW.x1, 3)] },
  ];
  const blocks = [plaza.x0, plaza.x1, Infinity].map(() => ({ houses: [] }));
  const arenaXs = [];
  for (const row of rows) {
    row.xs.forEach((x, index) => {
      const width = 5.6 + rand() * 0.5;
      const house = { ...frame(row.side, x, row.front), width, seed: 400 + Math.floor(rand() * 9000), stories: rand() < 0.4 ? 2 : 1 };
      if (EMPTY_PICKS.has(`${row.side}:${index}`)) return;
      if (ARENA_LOT.picks.includes(`${row.side}:${index}`)) {
        arenaXs.push(x);
        if (arenaXs.length < ARENA_LOT.picks.length) return;
        house.arena = true;
        house.x = arenaXs.reduce((sum, value) => sum + value, 0) / arenaXs.length;
        house.width = ARENA_LOT.width;
      }
      const lodge = LODGE_PICKS[`${row.side}:${index}`];
      if (lodge) {
        house.lodge = lodge;
        house.stories = LODGE_LOOKS[LODGE_ROOMS[lodge].tier].stories;
      }
      if (`${row.side}:${index}` === BANK_PICK) {
        house.bank = true;
        house.width = BANK_WIDTH;
        house.stories = 3;
      }
      const block = x < plaza.x0 ? 0 : x < plaza.x1 ? 1 : 2;
      blocks[block].houses.push(house);
    });
  }
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
    if (house.lodge || house.bank || house.arena) continue;
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
  parts.push(roundedRectGeometry(plaza.x0, plaza.z0, plaza.x1, plaza.z1, 0.6));
  const merged = mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)), false);
  return groundDecal(merged, paving(), PAVING_LAYER, 0.014);
}

function animateKeeper(npc, t, near) {
  npc.walker.group.visible = near;
  if (!near) return;
  npc.bubble.update(t);
  npc.walker.head.rotation.y = Math.sin(t * 0.5 + npc.phase) * 0.45;
  npc.walker.head.rotation.x = Math.sin(t * 0.9 + npc.phase) * 0.05;
  npc.walker.face.update(t, npc.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
  npc.walker.pose?.();
}

export const DISTRICT_STREETS = [[BOUNDS.x0 + 2, MAIN.z0 + 0.5, EAST_GATE - 2, MAIN.z1 - 0.5]];

export function createDistrict() {
  const { blocks, plaza } = layout();
  const obstacles = [];
  for (const block of blocks) {
    for (const house of block.houses) {
      if (house.arena) continue;
      obstacles.push(footprint(house, house.width));
      if (!house.bank) obstacles.push(...shophousePots(house.width).map((box) => place(house, box)));
    }
  }
  obstacles.push(...villageGateObstacles(EAST_GATE));
  const rand = makeRandom(7272);
  const group = new THREE.Group();
  const clickables = [];
  const streets = streetMesh(plaza);
  group.add(streets);
  clickables.push(streets);
  const props = plazaMesh(plaza, obstacles, rand);
  const lodges = [];
  for (const block of blocks) {
    for (const house of block.houses) {
      if (!house.lodge) continue;
      const built = createShophouse({ seed: house.seed, width: house.width, depth: DEPTH, stories: house.stories });
      built.group.position.set(house.x, 0, house.front);
      built.group.rotation.y = house.turn;
      const sign = plaqueBoard([LODGE_ROOMS[house.lodge].name.toUpperCase(), `${roomTier(house.lodge).price} 🪙 / đêm`], LODGE_LOOKS[LODGE_ROOMS[house.lodge].tier].sign);
      sign.mesh.position.set(built.plaque.x, built.plaque.y, built.plaque.z);
      built.group.add(sign.mesh);
      group.add(built.group);
      clickables.push(built.group);
      const side = house.north ? 1 : -1;
      const stand = { x: house.x + side * built.door.x, z: house.front + side * built.door.z };
      const look = { x: house.x + side * built.door.x, z: house.front + side * (built.door.z - 1) };
      lodges.push({ id: house.lodge, stand, look, group: built.group });
    }
  }
  let bank = null;
  for (const block of blocks) {
    for (const house of block.houses) {
      if (!house.bank) continue;
      const built = createBank({ seed: house.seed, width: house.width, depth: DEPTH });
      obstacles.push(...built.obstacles.map((box) => place(house, box)));
      built.group.position.set(house.x, 0, house.front);
      built.group.rotation.y = house.turn;
      group.add(built.group);
      clickables.push(built.group);
      const side = house.north ? 1 : -1;
      const at = (p) => ({ x: house.x + side * p.x, z: house.front + side * p.z });
      const teller = keeperNPC(TELLER_LOOK, 'aodai-blue');
      const tellerAt = at(built.teller);
      teller.walker.group.position.set(tellerAt.x, built.teller.y ?? 0, tellerAt.z);
      teller.walker.group.rotation.y = house.turn + built.teller.facing;
      clickables.push(teller.walker.group);
      bank = {
        group: built.group,
        teller,
        stand: at(built.door),
        look: tellerAt,
        line: [built.door, { x: 0, z: 1.9 }, { x: -9, z: 1.9 }].map(at),
      };
    }
  }
  let arena = null;
  for (const block of blocks) {
    for (const house of block.houses) {
      if (!house.arena) continue;
      const built = createArenaCompound({ seed: house.seed, width: house.width, depth: ARENA_LOT.depth });
      obstacles.push(...built.obstacles.map((box) => place(house, box)));
      for (const node of [built.group, built.floor]) {
        node.position.set(house.x, 0, house.front);
        node.rotation.y = house.turn;
      }
      group.add(built.floor, built.group);
      clickables.push(built.group);
      const side = house.north ? 1 : -1;
      const at = { x: house.x + side * built.door.x, z: house.front + side * built.door.z };
      const registrar = keeperNPC(REGISTRAR_LOOK, REGISTRAR.model);
      registrar.walker.group.position.set(at.x, 0, at.z);
      registrar.walker.group.rotation.y = house.turn;
      clickables.push(registrar.walker.group);
      obstacles.push({ minX: at.x - 0.35, maxX: at.x + 0.35, minZ: at.z - 0.35, maxZ: at.z + 0.35, minY: 0, maxY: 2 });
      const spots = REGISTRAR.spots.map((offset) => ({ x: at.x + offset, z: at.z + side * REGISTRAR.reach }));
      arena = { group: built.group, registrar, at, out: side, spots, stand: spots[1] };
    }
  }
  const ownsArena = (object) => {
    for (let node = object; node; node = node.parent) if (node === arena?.group || node === arena?.registrar.walker.group) return true;
    return false;
  };
  const ownsBank = (object) => {
    for (let node = object; node; node = node.parent) if (node === bank?.group || node === bank?.teller.walker.group) return true;
    return false;
  };
  const lodgeOf = (object) => {
    for (let node = object; node; node = node.parent) {
      const lodge = lodges.find((item) => item.group === node);
      if (lodge) return lodge;
    }
    return null;
  };
  const gate = createVillageGate(EAST_GATE);
  group.add(props, ...gate);
  const lift = (node) => {
    node.traverse((child) => {
      if (child.isMesh && child !== streets) child.renderOrder = ABOVE_PAVING;
    });
  };
  lift(group);
  freeze(group);
  const root = new THREE.Group();
  root.add(group);
  if (bank) root.add(bank.teller.walker.group);
  if (arena) root.add(arena.registrar.walker.group);
  const pending = [...blocks];
  let now = 0;

  return {
    obstacles,
    lodges: lodges.map(({ id, stand }) => ({ id, stand })),
    bankDesk: bank ? { line: bank.line, look: bank.look } : null,
    bankDoor: bank ? bank.stand : null,
    arenaDesk: arena ? { at: arena.at, out: arena.out, spots: arena.spots, say: (text) => arena.registrar.bubble.show(text, 1.8, now) } : null,
    update(t, ctx, camera) {
      now = t;
      if (bank) animateKeeper(bank.teller, t, bankOpen(ctx.minutes) && camera.position.distanceTo(bank.teller.walker.group.position) < TELLER_DISTANCE);
      if (arena) animateKeeper(arena.registrar, t, camera.position.distanceTo(arena.registrar.walker.group.position) < TELLER_DISTANCE);
    },
    region(options) {
      return {
        id: 'district',
        name: 'Xóm Bàn Cờ',
        bounds: BOUNDS,
        staticNav: true,
        target(hit) {
          if (ownsArena(hit.object)) return { kind: 'arena', id: 'arena', index: 'arena', x: arena.at.x, z: arena.at.z, stand: arena.stand };
          if (ownsBank(hit.object)) return { kind: 'bank', id: 'bank', index: 'bank', x: bank.look.x, z: bank.look.z, stand: bank.stand };
          const lodge = lodgeOf(hit.object);
          if (!lodge) return null;
          return { kind: 'lodge', id: lodge.id, index: `lodge:${lodge.id}`, x: lodge.look.x, z: lodge.look.z, stand: lodge.stand };
        },
        actionFor() {
          return { id: 'visit', hint: 'hand' };
        },
        topOf(target) {
          return new THREE.Vector3(target.x, 3.6, target.z);
        },
        act(action, target) {
          if (target.kind === 'arena') {
            options.openArena();
            return null;
          }
          if (target.kind === 'bank') {
            if (!bankOpen(options.minutes())) return `Ngân hàng đóng cửa rồi, mở ${bankHours()} nhé!`;
            bank.teller.bubble.show('Kính chào quý khách!', 1.8, now);
            options.openBank();
            return null;
          }
          return options.rentLodge(target.id);
        },
        load() {
          return {
            group: root,
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
