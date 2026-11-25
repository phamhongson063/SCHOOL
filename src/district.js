import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, freeze } from './toon.js';
import { makeRandom } from './random.js';
import { groundDecal, roundedRectGeometry } from './scenery.js';
import { createShophouse, createBank, createArenaCompound, createLanternPavilion, createTownHall, shophousePots } from './architecture.js';
import { createLanternGlow } from './lanternGlow.js';
import { ABOVE_PAVING, PAVING_LAYER, idleKeeper, paving, plaqueBoard, keeperNPC } from './village.js';
import { bankOpen, bankHours } from './bank.js';
import { LODGE_ROOMS } from './config.js';
import { roomTier } from './lodging.js';
import { SHOPKEEPERS } from './economy.js';
import { buildHallPlaza, createHallLife } from './hallPlaza.js';
import { createArenaNight } from './arenaNight.js';
import { NPC } from './npcIds.js';
import { ROAD } from './road.js';

const STREET = 3;
const SETBACK = 2.6;
const SOUTH_STREET = 62;
const DEPTH = 8;
const BOUNDS = { x0: -137, z0: 16, x1: -40, z1: 66 };
const ROW = { x0: -133, x1: -56 };
const SOUTH_XS = [-128.9, -112.2, -59, -43.6];
const PLAZA_X = { x0: -99.7, x1: -71.5 };
const PAVED = { x0: -136, x1: -40 };
const LODGE_PICKS = { 'north:0': 'banco-1', 'south:3': 'banco-2', 'south:1': 'banco-3', 'north:7': 'banco-4', 'north:4': 'banco-5' };
const BANK_PICK = 'south:0';
const ARENA_LOT = { picks: ['north:2', 'north:3'], width: 16.2, depth: 11 };
const REGISTRAR_LOOK = { shirt: 0xe8e0cc, pants: 0x3a3430, skin: 0xe0b088, style: 'khan', khan: 0x2a2a30, hairColor: 0x2a2420, beardColor: 0xd8d4cc, iris: 0x3a2214 };
const REGISTRAR = { model: 'monk-brown', reach: 1.4, spots: [-0.9, 0, 0.9] };
const LANTERN_LOT = { picks: ['north:5', 'north:6'], width: 12, depth: 10, seed: 2717 };
const LANTERN_KEEPER_LOOK = { shirt: 0x8a2a1c, pants: 0x2a2420, skin: 0xe8b890, style: 'bun', hairColor: 0xd8d4cc, iris: 0x3a2214 };
const LANTERN_KEEPER = { model: 'granny-navy', reach: 1.4, spots: [-0.9, 0, 0.9] };
const HALL_SPOTS = [-2.5, -1.5, 1.5, 2.5];
const SETBACKS = { 'south:2': 3 };
const BANK_WIDTH = 8.4;
const TELLER_LOOK = { shirt: 0x2f6f8e, pants: 0x1f2a3a, skin: 0xf0c09a, style: 'bui', iris: 0x3a2214 };
const TELLER_DISTANCE = 60;
const HALL = { depth: 9.5, seed: 919 };
const MAYOR_LOOK = { shirt: 0x24346a, pants: 0x1f2a3a, skin: 0xe0b088, style: 'toc', hairColor: 0x2a2420, iris: 0x3a2214 };
const MAYOR_LINES = ['Chào ngươi, sổ sách của làng đây.', 'Thu chi minh bạch, làng mới vững.', 'Ngươi muốn xem ngân khố à?'];
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
  const plaza = { ...PLAZA_X, z0: ROAD.z1 + SETBACK, z1: SOUTH_STREET - STREET / 2 };
  const rows = [
    { side: 'north', front: ROAD.z0 - SETBACK, xs: spread(ROW.x0, ROW.x1, 9) },
    { side: 'south', front: ROAD.z1 + SETBACK, xs: SOUTH_XS },
  ];
  const blocks = [plaza.x0, plaza.x1, Infinity].map(() => ({ houses: [] }));
  const arenaXs = [];
  const lanternXs = [];
  for (const row of rows) {
    row.xs.forEach((x, index) => {
      const width = 5.6 + rand() * 0.5;
      const setback = SETBACKS[`${row.side}:${index}`] ?? 0;
      const house = { ...frame(row.side, x, row.front + (row.side === 'north' ? -setback : setback)), width, seed: 400 + Math.floor(rand() * 9000), stories: rand() < 0.4 ? 2 : 1 };
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
      if (LANTERN_LOT.picks.includes(`${row.side}:${index}`)) {
        lanternXs.push(x);
        if (lanternXs.length < LANTERN_LOT.picks.length) return;
        house.lantern = true;
        house.x = lanternXs.reduce((sum, value) => sum + value, 0) / lanternXs.length;
        house.width = LANTERN_LOT.width;
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
    const merged = parts.length === 1 ? parts[0].geometry : mergeGeometries(parts.map((part) => part.geometry), false);
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
    if (merged && parts.length > 1) for (const part of parts) part.geometry.dispose();
  }
  return meshes;
}

function buildBlock(block) {
  const root = new THREE.Group();
  for (const house of block.houses) {
    if (house.lodge || house.bank || house.arena || house.lantern) continue;
    const built = createShophouse({ seed: house.seed, width: house.width, depth: DEPTH, stories: house.stories });
    built.group.position.set(house.x, 0, house.front);
    built.group.rotation.y = house.turn;
    root.add(built.group);
  }
  return mergeByMaterial(root);
}

function plazaMesh(plaza, obstacles, rand) {
  const b = new Batch();
  buildHallPlaza(b, rand, plaza, plaza.z1 - HALL.depth, obstacles);
  return b.mesh();
}

function streetMesh(plaza) {
  const parts = [roundedRectGeometry(PAVED.x0, ROAD.z0, PAVED.x1, ROAD.z1, 0.4)];
  parts.push(roundedRectGeometry(plaza.x0, plaza.z0, plaza.x1, plaza.z1, 0.6));
  const merged = mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)), false);
  return groundDecal(merged, paving(), PAVING_LAYER, 0.014);
}

function animateKeeper(npc, t, near) {
  npc.walker.group.visible = near;
  if (!near) return;
  idleKeeper(npc, t);
}

export const DISTRICT_STREETS = [[PAVED.x0 + 1, ROAD.z0 + 0.5, PAVED.x1 - 1, ROAD.z1 - 0.5]];

export function createDistrict() {
  const { blocks, plaza } = layout();
  const obstacles = [];
  for (const block of blocks) {
    for (const house of block.houses) {
      if (house.arena || house.lantern) continue;
      obstacles.push(footprint(house, house.width));
      if (!house.bank) obstacles.push(...shophousePots(house.width).map((box) => place(house, box)));
    }
  }
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
  const hallSpot = { ...frame('south', (plaza.x0 + plaza.x1) / 2, plaza.z1 - HALL.depth) };
  const hallBuilt = createTownHall({ seed: HALL.seed });
  obstacles.push(...hallBuilt.obstacles.map((box) => place(hallSpot, box)));
  hallBuilt.group.position.set(hallSpot.x, 0, hallSpot.front);
  hallBuilt.group.rotation.y = hallSpot.turn;
  group.add(hallBuilt.group);
  clickables.push(hallBuilt.group);
  const hallAt = (p) => ({ x: hallSpot.x - p.x, z: hallSpot.front - p.z });
  const mayor = keeperNPC(MAYOR_LOOK, null, SHOPKEEPERS.find((keeper) => keeper.id === NPC.mayor)?.name ?? '');
  const mayorAt = hallAt(hallBuilt.mayor);
  mayor.walker.group.position.set(mayorAt.x, hallBuilt.mayor.y, mayorAt.z);
  mayor.walker.group.rotation.y = hallSpot.turn + hallBuilt.mayor.facing;
  clickables.push(mayor.walker.group);
  const hall = { group: hallBuilt.group, mayor, look: mayorAt, stand: hallAt(hallBuilt.door), spots: HALL_SPOTS.map((x) => hallAt({ x: hallBuilt.door.x + x, z: hallBuilt.door.z })) };
  const hallLife = createHallLife({ plaza, hallFront: hallSpot.front, built: hallBuilt, toWorld: hallAt, turn: hallSpot.turn });
  function staffedLot(house, built, look, staff, y) {
    obstacles.push(...built.obstacles.map((box) => place(house, box)));
    for (const node of [built.group, built.floor]) {
      node.position.set(house.x, 0, house.front);
      node.rotation.y = house.turn;
    }
    group.add(built.floor, built.group);
    clickables.push(built.group);
    const side = house.north ? 1 : -1;
    const toWorld = (local) => ({ x: house.x + side * local.x, z: house.front + side * local.z });
    const at = toWorld(built.door);
    const npc = keeperNPC(look, staff.model);
    npc.walker.group.position.set(at.x, y, at.z);
    npc.walker.group.rotation.y = house.turn;
    clickables.push(npc.walker.group);
    obstacles.push({ minX: at.x - 0.35, maxX: at.x + 0.35, minZ: at.z - 0.35, maxZ: at.z + 0.35, minY: 0, maxY: 2 });
    const spots = staff.spots.map((offset) => ({ x: at.x + offset, z: at.z + side * staff.reach }));
    return { side, toWorld, at, npc, spots };
  }

  let arena = null;
  for (const block of blocks) {
    for (const house of block.houses) {
      if (!house.arena) continue;
      const built = createArenaCompound({ seed: house.seed, width: house.width, depth: ARENA_LOT.depth });
      const { side, toWorld, at, npc: registrar, spots } = staffedLot(house, built, REGISTRAR_LOOK, REGISTRAR, 0);
      const lamps = createArenaNight({
        lights: built.group.userData.lights,
        desk: built.desk,
        toWorld,
        layer: ABOVE_PAVING,
      });
      arena = { group: built.group, registrar, at, out: side, spots, stand: spots[1], lamps };
    }
  }
  let festival = null;
  for (const block of blocks) {
    for (const house of block.houses) {
      if (!house.lantern) continue;
      const built = createLanternPavilion({ seed: LANTERN_LOT.seed, width: house.width, depth: LANTERN_LOT.depth });
      const { side, toWorld, at, npc: keeper, spots } = staffedLot(house, built, LANTERN_KEEPER_LOOK, LANTERN_KEEPER, built.rise);
      const glow = createLanternGlow(
        built.group.userData.lights.map(({ position, tint }) => {
          const { x, z } = toWorld({ x: position.x, z: position.z });
          return { position: new THREE.Vector3(x, position.y, z), tint };
        }),
      );
      festival = { group: built.group, keeper, at, out: side, spots, stand: spots[1], glow };
    }
  }
  let nightLevel = 0;
  const ownsFestival = (object) => {
    for (let node = object; node; node = node.parent) if (node === festival?.group || node === festival?.keeper.walker.group) return true;
    return false;
  };
  const ownsArena = (object) => {
    for (let node = object; node; node = node.parent) if (node === arena?.group || node === arena?.registrar.walker.group) return true;
    return false;
  };
  const ownsHall = (object) => {
    for (let node = object; node; node = node.parent) if (node === hall.group || node === hall.mayor.walker.group) return true;
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
  group.add(props);
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
  if (arena) root.add(arena.registrar.walker.group, arena.lamps.group);
  if (festival) root.add(festival.keeper.walker.group, festival.glow.object);
  root.add(hall.mayor.walker.group, hallLife.group);
  const pending = [...blocks];
  let now = 0;

  return {
    obstacles,
    lodges: lodges.map(({ id, stand }) => ({ id, stand })),
    bankDesk: bank ? { line: bank.line, look: bank.look } : null,
    bankDoor: bank ? bank.stand : null,
    arenaStand: arena ? arena.stand : null,
    hallStand: hall.stand,
    hallLook: hall.look,
    hallDesk: { at: hall.look, spots: hall.spots },
    arenaDesk: arena ? { at: arena.at, out: arena.out, spots: arena.spots, say: (text, duration = 1.8) => arena.registrar.bubble.show(text, duration, now) } : null,
    lanternStand: festival ? festival.stand : null,
    lanternDesk: festival ? { at: festival.at, out: festival.out, spots: festival.spots, say: (text, duration = 1.8) => festival.keeper.bubble.show(text, duration, now) } : null,
    update(t, ctx, camera) {
      now = t;
      if (bank) animateKeeper(bank.teller, t, bankOpen(ctx.minutes) && camera.position.distanceTo(bank.teller.walker.group.position) < TELLER_DISTANCE);
      if (arena) {
        animateKeeper(arena.registrar, t, camera.position.distanceTo(arena.registrar.walker.group.position) < TELLER_DISTANCE);
        arena.lamps.update(t);
      }
      animateKeeper(hall.mayor, t, camera.position.distanceTo(hall.mayor.walker.group.position) < TELLER_DISTANCE);
      if (festival) {
        animateKeeper(festival.keeper, t, camera.position.distanceTo(festival.keeper.walker.group.position) < TELLER_DISTANCE);
        festival.glow.update(t, nightLevel);
      }
      hallLife.update(t, ctx.minutes, camera);
    },
    setNight(k) {
      nightLevel = k;
      hallLife.setNight(k);
      arena?.lamps.setNight(k);
    },
    region(options) {
      return {
        id: 'district',
        name: 'Xóm Bàn Cờ',
        bounds: BOUNDS,
        staticNav: true,
        target(hit) {
          if (ownsArena(hit.object)) return { kind: 'arena', id: 'arena', index: 'arena', x: arena.at.x, z: arena.at.z, stand: arena.stand };
          if (ownsFestival(hit.object)) return { kind: 'lantern', id: 'lantern', index: 'lantern', x: festival.at.x, z: festival.at.z, stand: festival.stand };
          if (ownsHall(hit.object)) return { kind: 'hall', id: 'hall', index: 'hall', x: hall.look.x, z: hall.look.z, stand: hall.stand };
          if (ownsBank(hit.object)) return { kind: 'bank', id: 'bank', index: 'bank', x: bank.look.x, z: bank.look.z, stand: bank.stand };
          const lodge = lodgeOf(hit.object);
          if (!lodge) return null;
          return { kind: 'lodge', id: lodge.id, index: `lodge:${lodge.id}`, x: lodge.look.x, z: lodge.look.z, stand: lodge.stand };
        },
        actionFor(target) {
          const arenaOptions = target.kind === 'arena' ? options.arenaMenu() : null;
          if (arenaOptions) return { id: 'visit', hint: 'hand', choices: { title: 'Lôi đài', options: arenaOptions, menu: true } };
          if (target.kind === 'hall') return { id: 'visit', hint: 'hand', choices: { title: 'Tòa thị chính', options: options.hallMenu(), menu: true } };
          if (target.kind === 'lantern') return { id: 'visit', hint: 'hand', choices: { title: 'Hội đèn trời', options: options.lanternMenu(), menu: true } };
          return { id: 'visit', hint: 'hand' };
        },
        topOf(target) {
          return new THREE.Vector3(target.x, 3.6, target.z);
        },
        act(action, target, choice) {
          if (target.kind === 'arena') {
            options.openArena(choice);
            return null;
          }
          if (target.kind === 'lantern') {
            options.openLantern(choice);
            return null;
          }
          if (target.kind === 'hall') {
            hall.mayor.bubble.show(MAYOR_LINES[Math.floor(Math.random() * MAYOR_LINES.length)], 1.8, now);
            options.openHall(choice);
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
              const meshes = buildBlock(block);
              if (!meshes.length) return;
              const holder = new THREE.Group();
              holder.add(...meshes);
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
