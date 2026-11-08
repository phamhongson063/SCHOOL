import * as THREE from 'three';
import { Batch, canvasTexture, freeze, labelBox, shade, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { createShophouse, createMarket, createChiefHouse, setNightGlow } from './architecture.js';
import { createEatery, setEateryGlow } from './eatery.js';
import { createWalker } from './characters.js';
import { hasModel, createModel } from './characterModels.js';
import { createBubble } from './bubble.js';
import { SHOP, CHIEF, EATERY } from './config.js';
import { coins } from './format.js';
import { createLanternGlow } from './lanternGlow.js';

export const VILLAGE_BOUNDS = { x0: 47, z0: 18, x1: 100, z1: 52 };

const NORTH_FRONT = 29.4;
const SOUTH_FRONT = 40.6;
const STREET_LAYER = GROUND_LAYER.mark + 1;
const ABOVE_PAVING = STREET_LAYER + 1;
const EXITS = [
  { x: -43, z: 35 },
  { x: 99, z: 35 },
];

const HOUSES = [
  { id: 1, side: 'north', x: 64.5, width: 7, depth: 9, stories: 1, size: 'medium', seed: 11 },
  { id: 2, side: 'north', x: 71.6, width: 6, depth: 8, stories: 1, size: 'small', seed: 23 },
  { id: 3, side: 'north', x: 78.95, width: 7.5, depth: 10, stories: 2, size: 'large', seed: 37 },
  { id: 4, side: 'north', x: 86.3, width: 6, depth: 8, stories: 1, size: 'small', seed: 41 },
  { id: 5, side: 'north', x: 93.4, width: 7, depth: 9, stories: 1, size: 'medium', seed: 53 },
  { id: 6, side: 'south', x: 64, width: 6, depth: 9, stories: 2, size: 'medium', seed: 67 },
  { id: 7, side: 'south', x: 70.6, width: 6, depth: 8, stories: 1, size: 'small', seed: 71 },
  { id: 8, side: 'south', x: 77.95, width: 7.5, depth: 10, stories: 2, size: 'large', seed: 83 },
  { id: 9, side: 'south', x: 85.3, width: 6, depth: 8, stories: 1, size: 'small', seed: 97 },
  { id: 10, side: 'south', x: 92.4, width: 7, depth: 9, stories: 1, size: 'medium', seed: 101 },
];

const MARKET = { side: 'north', x: 55, seed: 7 };
const CHIEF_HOUSE = { side: 'south', x: 55.5, seed: 5 };
const EATERY_SPOT = { side: 'north', x: 41, seed: 9 };

const KEEPER_LOOK = { shirt: 0x9a3a4a, pants: 0x2f2a26, skin: 0xf0c09a, style: 'bui', iris: 0x5a3220, apron: 0x6a4a8a };
const COOK_LOOK = { shirt: 0x5a7a4a, pants: 0x2f2a26, skin: 0xe6b08a, style: 'curly', hairColor: 0x3a2418, iris: 0x4a2a18, apron: 0xf4efe2 };
const CHIEF_LOOK = { shirt: 0x2e2a4a, pants: 0xf1ebdc, skin: 0xd9a479, style: 'khan', khan: 0x1f1e26, hairColor: 0x9a958e, old: true, beardColor: 0xdedad2, iris: 0x3a2214 };

const LANTERN_COLORS = [0xd8321e, 0xf2b630, 0xe0622a, 0x2f7ab8, 0xc0281a, 0x3a9a5a];

function frame(side, x) {
  const north = side === 'north';
  const front = north ? NORTH_FRONT : SOUTH_FRONT;
  const turn = north ? 0 : Math.PI;
  const toWorld = (p) => (north ? { x: x + p.x, z: front + p.z } : { x: x - p.x, z: front - p.z });
  const box = (b) =>
    north
      ? { minX: x + b.minX, maxX: x + b.maxX, minZ: front + b.minZ, maxZ: front + b.maxZ, minY: b.minY ?? 0, maxY: b.maxY ?? 3 }
      : { minX: x - b.maxX, maxX: x - b.minX, minZ: front - b.maxZ, maxZ: front - b.minZ, minY: b.minY ?? 0, maxY: b.maxY ?? 3 };
  const facing = (f) => (north ? f : f + Math.PI);
  return { front, turn, toWorld, box, facing };
}

function placeBuilding(built, spec) {
  const f = frame(spec.side, spec.x);
  built.group.position.set(spec.x, 0, f.front);
  built.group.rotation.y = f.turn;
  built.group.updateMatrixWorld(true);
  return f;
}

export function plaqueBoard(lines, { bg = 0x1c1310, fg = '#f2c14e', border = 0x8a1d14 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(labelBox(1.6, 0.45, 0.06), toonMaterial({ map: texture }));
  mesh.castShadow = false;
  const paint = (rows) => {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `#${bg.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (rows.length === 1) {
      ctx.font = '700 64px "BIZ UDPGothic", system-ui, sans-serif';
      ctx.fillText(rows[0], canvas.width / 2, canvas.height / 2 + 4, canvas.width - 50);
    } else {
      ctx.font = '700 50px "BIZ UDPGothic", system-ui, sans-serif';
      ctx.fillText(rows[0], canvas.width / 2, 50, canvas.width - 50);
      ctx.font = '600 36px "BIZ UDPGothic", system-ui, sans-serif';
      ctx.fillText(rows[1], canvas.width / 2, 104, canvas.width - 50);
    }
    texture.needsUpdate = true;
  };
  paint(lines);
  return { mesh, paint };
}

let lanternMaterial = null;

function lanternString(b, glow, lights, x, rand) {
  const z0 = NORTH_FRONT - 0.2;
  const z1 = SOUTH_FRONT + 0.2;
  const top = 4.3;
  const sag = 0.7;
  const points = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    points.push(new THREE.Vector3(x + Math.sin(t * Math.PI) * 0.15, top - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t));
  }
  b.add(shapes.tube(points, 0.018, 24), 0x3a2414);
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const at = new THREE.Vector3(x + Math.sin(t * Math.PI) * 0.15, top - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t);
    const color = LANTERN_COLORS[Math.floor(rand() * LANTERN_COLORS.length)];
    b.limb(at.toArray(), [at.x, at.y - 0.18, at.z], 0.008, 0x3a2414, { capsule: false, seg: 4 });
    glow.add(shapes.sphere(0.2, 10, 8), color, { p: [at.x, at.y - 0.4, at.z], s: [1, 1.2, 1] });
    lights.push({ position: new THREE.Vector3(at.x, at.y - 0.4, at.z), tint: color });
    b.add(shapes.cylinder(0.09, 0.1, 0.05, 8), 0xf2c14e, { p: [at.x, at.y - 0.18, at.z] });
    b.add(shapes.cylinder(0.1, 0.09, 0.05, 8), 0xf2c14e, { p: [at.x, at.y - 0.64, at.z] });
    b.add(shapes.cone(0.04, 0.16, 6), color, { p: [at.x, at.y - 0.74, at.z], r: [Math.PI, 0, 0] });
  }
}

const cssHex = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

function brickTexture() {
  return canvasTexture(
    256,
    (ctx, s) => {
      const rand = makeRandom(3131);
      ctx.fillStyle = '#8a5a3e';
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const h = s / rows;
      const w = s / 4;
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 ? w / 2 : 0;
        for (let c = -1; c < 5; c++) {
          const x = c * w + offset;
          ctx.fillStyle = cssHex(shade(0xb4643f, 0.82 + rand() * 0.3));
          ctx.fillRect(x + 2, r * h + 2, w - 4, h - 4);
          ctx.fillStyle = 'rgba(255,220,180,0.1)';
          ctx.fillRect(x + 2, r * h + 2, w - 4, 3);
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = `rgba(70,40,25,${0.12 + rand() * 0.15})`;
            ctx.beginPath();
            ctx.ellipse(x + 6 + rand() * (w - 12), r * h + 5 + rand() * (h - 10), 1 + rand() * 3, 1 + rand() * 2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
    [0.45, 0.45],
  );
}

export function paving() {
  return toonMaterial({
    map: brickTexture(),
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
}

function decor() {
  const group = new THREE.Group();
  const street = groundDecal(roundedRectGeometry(48.5, NORTH_FRONT - 0.6, 98, SOUTH_FRONT + 0.6, 0.6), paving(), STREET_LAYER, 0.014);
  const walks = [street];
  group.add(street);
  const rand = makeRandom(4646);
  const b = new Batch();
  const glow = new Batch();
  const lights = [];
  for (const x of [60.6, 74.9, 89.6]) lanternString(b, glow, lights, x, rand);
  const obstacles = [];
  for (const [x, z] of [
    [98.5, 29.8],
    [33.6, 43.2],
    [98.5, 40.8],
  ]) {
    roundTree(b, rand, { x, z, h: 4 + Math.floor(rand() * 2) });
    obstacles.push({ minX: x + 0.2, minZ: z + 0.2, maxX: x + 0.8, maxZ: z + 0.8, minY: 0, maxY: 3 });
  }
  const mesh = b.mesh();
  group.add(mesh);
  lanternMaterial ??= toonMaterial({ vertexColors: true, emissive: 0xff7a2a, emissiveIntensity: 0 });
  const lit = glow.mesh(lanternMaterial, { shadow: false });
  group.add(lit);
  return { group, walks, obstacles, lights };
}

function keeperNPC(look, model) {
  const walker = model && hasModel(model) ? createModel(model) : createWalker(look);
  walker.group.rotation.order = 'YXZ';
  const bubble = createBubble();
  bubble.sprite.position.set(0, 2.05, 0);
  walker.group.add(bubble.sprite);
  return { walker, bubble, phase: Math.random() * Math.PI * 2 };
}

const ZONES = [
  { x0: VILLAGE_BOUNDS.x0, x1: 68.3 },
  { x0: 68.3, x1: 82.9 },
  { x0: 82.9, x1: VILLAGE_BOUNDS.x1 },
];
const DETAIL_DISTANCE = 70;
const SIGN_DISTANCE = 45;
const KEEPER_DISTANCE = 60;
const FLOOR_HEIGHT = 0.3;

let hitMaterial = null;

function zoneIndex(x) {
  const index = ZONES.findIndex((zone) => x >= zone.x0 && x < zone.x1);
  return index < 0 ? 0 : index;
}

export function createVillage() {
  const zones = ZONES.map(() => ({ group: new THREE.Group(), clickables: [] }));
  const obstacles = [];
  const buildings = [];
  const doors = new Map();
  const plaques = new Map();
  hitMaterial ??= new THREE.MeshBasicMaterial({ visible: false });

  function addBuilding(building, x, sign) {
    const zone = zones[zoneIndex(x)];
    building.details = building.group.children.filter((child) => child.isMesh && !child.castShadow);
    const box = new THREE.Box3().setFromObject(building.group);
    const size = box.getSize(new THREE.Vector3());
    building.center = box.getCenter(new THREE.Vector3());
    building.base = building.group.getWorldPosition(new THREE.Vector3()).y;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), hitMaterial);
    proxy.position.copy(building.center);
    proxy.raycast = (raycaster, intersects) => {
      if (!raycaster.ray.intersectsBox(box)) return;
      const hit = raycaster.intersectObject(building.group, true)[0];
      if (hit) intersects.push({ ...hit, object: proxy });
    };
    building.proxy = proxy;
    building.sign = sign;
    building.group.add(sign.mesh);
    building.group.traverse((node) => {
      if (node.isMesh) node.renderOrder = ABOVE_PAVING;
    });
    zone.group.add(building.group, proxy);
    freeze(building.group);
    freeze(proxy);
    zone.clickables.push(proxy);
    if (building.npc) {
      zone.group.add(building.npc.walker.group);
      zone.clickables.push(building.npc.walker.group);
    }
    buildings.push(building);
  }

  const market = createMarket({ seed: MARKET.seed });
  const marketFrame = placeBuilding(market, MARKET);
  obstacles.push(...market.obstacles.map(marketFrame.box));
  const counter = marketFrame.toWorld(market.counter);
  const keeperAt = marketFrame.toWorld(market.keeper);
  const keeper = keeperNPC(KEEPER_LOOK, 'granny');
  keeper.walker.group.position.set(keeperAt.x, 0, keeperAt.z);
  keeper.walker.group.rotation.y = marketFrame.facing(market.keeper.facing ?? 0);
  const marketSign = plaqueBoard(['TIỆM BUÔN'], { bg: 0x8a1d14, fg: '#ffe08a', border: 0xf2c14e });
  marketSign.mesh.position.set(market.plaque.x, market.plaque.y, market.plaque.z);
  addBuilding({ kind: 'shop', group: market.group, stand: counter, look: keeperAt, npc: keeper }, MARKET.x, marketSign);

  const chief = createChiefHouse({ seed: CHIEF_HOUSE.seed });
  const chiefFrame = placeBuilding(chief, CHIEF_HOUSE);
  obstacles.push(...chief.obstacles.map(chiefFrame.box));
  const desk = chiefFrame.toWorld(chief.desk);
  const chiefAt = chiefFrame.toWorld(chief.chief);
  const chiefNPC = keeperNPC(CHIEF_LOOK, 'scholar');
  chiefNPC.walker.group.position.set(chiefAt.x, 0, chiefAt.z);
  chiefNPC.walker.group.rotation.y = chiefFrame.facing(chief.chief.facing ?? 0);
  const chiefSign = plaqueBoard(['NHÀ LÝ TRƯỞNG'], { bg: 0x1c1310, fg: '#f2c14e', border: 0xa12a1c });
  chiefSign.mesh.position.set(chief.plaque.x, chief.plaque.y, chief.plaque.z);
  addBuilding({ kind: 'chief', group: chief.group, stand: desk, look: chiefAt, npc: chiefNPC }, CHIEF_HOUSE.x, chiefSign);

  const eatery = createEatery({ seed: EATERY_SPOT.seed });
  const eateryFrame = placeBuilding(eatery, EATERY_SPOT);
  obstacles.push(...eatery.obstacles.map(eateryFrame.box));
  const eateryCounter = eateryFrame.toWorld(eatery.counter);
  const cookAt = eateryFrame.toWorld(eatery.keeper);
  const cook = keeperNPC(COOK_LOOK, 'granny-navy');
  cook.walker.group.position.set(cookAt.x, 0, cookAt.z);
  cook.walker.group.rotation.y = eateryFrame.facing(eatery.keeper.facing ?? 0);
  const eaterySign = plaqueBoard(['QUÁN ĂN'], { bg: 0x8a1d14, fg: '#ffe08a', border: 0xf2c14e });
  eaterySign.mesh.position.set(eatery.plaque.x, eatery.plaque.y, eatery.plaque.z);
  addBuilding({ kind: 'eatery', group: eatery.group, stand: eateryCounter, look: cookAt, npc: cook }, EATERY_SPOT.x, eaterySign);

  for (const spec of HOUSES) {
    const house = createShophouse({ seed: spec.seed, width: spec.width, depth: spec.depth, stories: spec.stories });
    const f = placeBuilding(house, spec);
    obstacles.push(...house.obstacles.map(f.box));
    const door = f.toWorld(house.door);
    doors.set(spec.id, door);
    const sign = plaqueBoard([`Nhà số ${spec.id}`, 'Đang bán']);
    sign.mesh.position.set(house.plaque.x, house.plaque.y, house.plaque.z);
    plaques.set(spec.id, { sign, anchor: new THREE.Vector3().copy(sign.mesh.position).applyMatrix4(house.group.matrixWorld) });
    addBuilding({ kind: 'house', id: spec.id, group: house.group, stand: door, look: f.toWorld({ x: house.door.x, z: house.door.z - 1 }) }, spec.x, sign);
  }

  const street = decor();
  const middle = zones[1];
  middle.group.add(street.group);
  middle.clickables.push(...street.walks);
  freeze(street.group);
  obstacles.push(...street.obstacles);
  const lights = [...street.lights];
  for (const building of buildings) {
    for (const light of building.group.userData.lights ?? []) lights.push({ position: building.group.localToWorld(light.position.clone()), tint: light.tint });
  }
  const lanternGlow = createLanternGlow(lights);
  middle.group.add(lanternGlow.object);

  const buildingOf = (object) => {
    for (const building of buildings) {
      for (let node = object; node; node = node.parent) {
        if (node === building.group || node === building.proxy || node === building.npc?.walker.group) return building;
      }
    }
    return null;
  };

  const touchesNpc = (building, object) => {
    for (let node = object; node; node = node.parent) if (node === building.npc?.walker.group) return true;
    return false;
  };

  const walksOnFloor = (building, hit) =>
    !touchesNpc(building, hit.object) && !!hit.face && hit.face.normal.y > 0.7 && hit.point.y <= building.base + FLOOR_HEIGHT;

  const marketLine = [market.counter, { x: market.counter.x, z: 1.5 }, { x: market.counter.x - 12, z: 1.5 }].map(marketFrame.toWorld);
  const chiefLine = [chief.desk, { x: chief.desk.x, z: 1.5 }, { x: chief.desk.x + 12, z: 1.5 }].map(chiefFrame.toWorld);
  const eateryLine = [eatery.counter, { x: eatery.counter.x, z: 1.6 }, { x: eatery.counter.x - 10, z: 1.6 }].map(eateryFrame.toWorld);
  const places = {
    eatery: { x: eateryCounter.x, z: eateryCounter.z, look: cookAt, line: eateryLine },
    shop: { x: counter.x, z: counter.z, look: keeperAt, line: marketLine },
    chief: { x: desk.x, z: desk.z, look: chiefAt, line: chiefLine },
    doors,
    exits: EXITS,
  };

  const houses = HOUSES.map(({ id, size }) => ({ id, size }));
  let bound = null;
  let now = 0;
  let night = 0;
  let lodAt = 0;

  function refreshPlaques() {
    if (!bound) return;
    for (const house of bound.estate.houses) {
      const plaque = plaques.get(house.id);
      if (!plaque) continue;
      const owner = house.owner ? bound.nameOf(house.owner) : null;
      plaque.sign.paint([`Nhà số ${house.id}`, owner ? (house.owner === 'player' ? 'Nhà của bạn' : owner) : `Bán · ${coins(house.price)}`]);
    }
  }

  function labelOf(target) {
    if (!bound) return null;
    if (target.kind === 'shop') return bound.isShopOpen() ? 'Tiệm buôn · bán nông sản, mua hạt giống' : `Tiệm buôn · đóng cửa (mở ${bound.shopHours()})`;
    if (target.kind === 'chief') return bound.isChiefOpen() ? 'Nhà Lý trưởng · mua bán nhà' : `Nhà Lý trưởng · nghỉ (làm việc ${bound.chiefHours()})`;
    if (target.kind === 'eatery') return bound.isEateryOpen() ? 'Quán ăn · ăn uống nạp năng lượng' : `Quán ăn · đóng cửa (mở ${bound.eateryHours()})`;
    const house = bound.estate.houses.find((item) => item.id === target.id);
    if (!house) return null;
    if (!house.owner) return `Nhà số ${house.id} · ${bound.estate.sizeName(house)} · bán ${coins(house.price)}`;
    return `Nhà số ${house.id} · chủ: ${house.owner === 'player' ? 'bạn' : bound.nameOf(house.owner)}`;
  }

  const shared = {
    id: 'village',
    name: 'Phố cổ',
    staticNav: true,
    overview: { position: new THREE.Vector3(73, 22, 62), target: new THREE.Vector3(73, 2, 35) },
    target(hit) {
      const building = buildingOf(hit.object);
      if (!building || walksOnFloor(building, hit)) return null;
      return { kind: building.kind, id: building.id, index: `${building.kind}:${building.id ?? ''}`, x: building.look.x, z: building.look.z, stand: building.stand };
    },
    actionFor() {
      return { id: 'visit', hint: 'hand' };
    },
    topOf(target) {
      if (target.kind === 'house') return plaques.get(target.id).anchor.clone().add(new THREE.Vector3(0, 0.6, 0));
      return new THREE.Vector3(target.x, 3.6, target.z);
    },
    act(action, target) {
      if (target.kind === 'shop') {
        if (!bound.isShopOpen()) return `Tiệm đóng cửa rồi, mở ${bound.shopHours()} nhé!`;
        keeper.bubble.show('Mời vô, mời vô!', 1.8, now);
        bound.openShop();
        return null;
      }
      if (target.kind === 'chief') {
        if (!bound.isChiefOpen()) return `Lý trưởng nghỉ rồi, làm việc ${bound.chiefHours()}.`;
        bound.openChief();
        return null;
      }
      if (target.kind === 'eatery') {
        if (!bound.isEateryOpen()) return `Quán đóng cửa rồi, mở ${bound.eateryHours()} nhé!`;
        cook.bubble.show('Ăn gì con?', 1.8, now);
        bound.openEatery();
        return null;
      }
      const home = bound.estate.houses.find((item) => item.id === target.id);
      if (home?.owner === 'player') {
        if (!bound.isNight()) return 'Nhà của mình. Tối về đây ngủ cho lại sức nhé!';
        bound.sleep();
        return null;
      }
      return labelOf(target);
    },
  };

  return {
    houses,
    obstacles,
    places,
    setNight(k) {
      night = k;
      setNightGlow(k);
      setEateryGlow(k);
      if (lanternMaterial) lanternMaterial.emissiveIntensity = k * 1.6;
    },
    update(t, ctx, camera) {
      now = t;
      lanternGlow.update(t, night);
      const minute = ctx.minute;
      const shopOn = minute >= SHOP.open && minute < SHOP.close;
      const chiefOn = minute >= CHIEF.open && minute < CHIEF.close;
      const eateryOn = minute >= EATERY.open && minute < EATERY.close;
      for (const [npc, on] of [
        [keeper, shopOn],
        [chiefNPC, chiefOn],
        [cook, eateryOn],
      ]) {
        const near = on && camera.position.distanceTo(npc.walker.group.position) < KEEPER_DISTANCE;
        npc.walker.group.visible = near;
        if (!near) continue;
        npc.bubble.update(t);
        npc.walker.head.rotation.y = Math.sin(t * 0.5 + npc.phase) * 0.45;
        npc.walker.head.rotation.x = Math.sin(t * 0.9 + npc.phase) * 0.05;
        npc.walker.face.update(t, npc.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
        npc.walker.pose?.();
      }
      if (t < lodAt) return;
      lodAt = t + 0.5;
      for (const building of buildings) {
        const d = camera.position.distanceTo(building.center);
        const details = d < DETAIL_DISTANCE || night > 0.25;
        for (const mesh of building.details) mesh.visible = details;
        building.sign.mesh.visible = d < SIGN_DISTANCE;
      }
    },
    regions(options) {
      bound = options;
      refreshPlaques();
      options.estate.onChange(refreshPlaques);
      return ZONES.map((zone, i) => ({
        ...shared,
        bounds: { x0: zone.x0, z0: VILLAGE_BOUNDS.z0, x1: zone.x1, z1: VILLAGE_BOUNDS.z1 },
        load() {
          return { group: zones[i].group, clickables: zones[i].clickables, obstacles: [] };
        },
      }));
    },
  };
}
