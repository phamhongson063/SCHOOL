import * as THREE from 'three';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';

export const ISLAND = { x: 240, z: 30, y: 70, radius: 14 };
export const ISLAND_BOUNDS = { x0: 208, z0: -6, x1: 272, z1: 52 };

const WALK_RADIUS = ISLAND.radius - 0.9;
const RAIL_RADIUS = ISLAND.radius - 0.35;
const RAIL_SEGMENTS = 48;
const TILE = 2;
const STONE_LIGHT = 0xe8e0cc;
const STONE_DARK = 0x5a4c40;
const ROCK = 0x8a8273;
const ROCK_DARK = 0x6a6258;
const LACQUER = 0x9a2418;
const GILT = 0xc9a24a;
const GLOW = 0xffd36e;
const PORTAL_GLOW = 0x9ad8ff;
const CLOUD = 0xffffff;

const STAGE_HEIGHT = 3.5;
const PLATFORMS = [
  { x: 221, z: 19, r: 3.5, lift: STAGE_HEIGHT },
  { x: 259, z: 19, r: 3.5, lift: STAGE_HEIGHT },
  { x: 221, z: 41, r: 3.5, lift: STAGE_HEIGHT },
  { x: 259, z: 41, r: 3.5, lift: STAGE_HEIGHT },
  { x: 240, z: 4, r: 5, lift: STAGE_HEIGHT + 2 },
].map((stage) => ({ ...stage, y: ISLAND.y + stage.lift }));
const FIGHT_GAP = 1.6;

const PORTAL = { x: ISLAND.x, z: ISLAND.z + ISLAND.radius - 2, radius: 1.5 };
export const ARRIVAL = { x: PORTAL.x, y: ISLAND.y, z: PORTAL.z - 2.2, facing: Math.PI };

const BOARD = { width: 4.2, height: 2.46, y: ISLAND.y + 2.75, post: 2.3 };
const BOARD_STAND = { x: ISLAND.x, z: ISLAND.z + 2.6 };

const SPECTATOR_RADIUS = 6.5;
const SPECTATOR_COUNT = 10;

const inDisc = (x, z, radius) => (x - ISLAND.x) ** 2 + (z - ISLAND.z) ** 2 <= radius * radius;
const facingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

export const SPECTATORS = Array.from({ length: SPECTATOR_COUNT }, (_, i) => {
  const angle = Math.PI * (1.15 + (0.7 * i) / (SPECTATOR_COUNT - 1));
  const spot = { x: ISLAND.x + Math.cos(angle) * SPECTATOR_RADIUS, y: ISLAND.y, z: ISLAND.z + Math.sin(angle) * SPECTATOR_RADIUS };
  return { ...spot, facing: facingTo(spot, ISLAND) };
});

export function stageOf(roundSize, index) {
  if (roundSize <= 1) return PLATFORMS[4];
  return PLATFORMS[index % 4];
}

export function fighterSpot(roundSize, index, side) {
  const stage = stageOf(roundSize, index);
  const sign = side === 'a' ? -1 : 1;
  const spot = { x: stage.x + sign * FIGHT_GAP, y: stage.y, z: stage.z };
  return { ...spot, facing: facingTo(spot, stage) };
}

export function onIsland(position) {
  return position.y > ISLAND.y - 10 && position.x >= ISLAND_BOUNDS.x0 && position.x <= ISLAND_BOUNDS.x1 && position.z >= ISLAND_BOUNDS.z0 && position.z <= ISLAND_BOUNDS.z1;
}

export function islandFloor(x, z) {
  if (inDisc(x, z, WALK_RADIUS)) return ISLAND.y;
  for (const stage of PLATFORMS) if ((x - stage.x) ** 2 + (z - stage.z) ** 2 <= (stage.r - 0.3) ** 2) return stage.y;
  return null;
}

export function islandNavFloor(x, z) {
  return inDisc(x, z, WALK_RADIUS) ? ISLAND.y : NaN;
}

function railObstacles() {
  const boxes = [];
  for (let i = 0; i < RAIL_SEGMENTS; i++) {
    const a0 = (i / RAIL_SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / RAIL_SEGMENTS) * Math.PI * 2;
    const xs = [Math.cos(a0), Math.cos(a1)].map((c) => ISLAND.x + c * RAIL_RADIUS);
    const zs = [Math.sin(a0), Math.sin(a1)].map((s) => ISLAND.z + s * RAIL_RADIUS);
    boxes.push({ minX: Math.min(...xs) - 0.2, maxX: Math.max(...xs) + 0.2, minZ: Math.min(...zs) - 0.2, maxZ: Math.max(...zs) + 0.2, minY: ISLAND.y, maxY: ISLAND.y + 1.2 });
  }
  boxes.push({ minX: PORTAL.x - PORTAL.radius - 0.2, maxX: PORTAL.x + PORTAL.radius + 0.2, minZ: PORTAL.z - 0.4, maxZ: PORTAL.z + 0.4, minY: ISLAND.y, maxY: ISLAND.y + 3.5 });
  boxes.push({ minX: ISLAND.x - 1.3, maxX: ISLAND.x + 1.3, minZ: ISLAND.z - 1.3, maxZ: ISLAND.z + 1.3, minY: ISLAND.y, maxY: ISLAND.y + 1.4 });
  for (const side of [-1, 1]) {
    const x = ISLAND.x + side * BOARD.post;
    boxes.push({ minX: x - 0.25, maxX: x + 0.25, minZ: ISLAND.z - 0.25, maxZ: ISLAND.z + 0.25, minY: ISLAND.y, maxY: ISLAND.y + 4.4 });
  }
  return boxes;
}

function checker(b, cx, y, cz, radius, size) {
  const span = Math.ceil(radius / size);
  for (let i = -span; i < span; i++) {
    for (let j = -span; j < span; j++) {
      const x = cx + (i + 0.5) * size;
      const z = cz + (j + 0.5) * size;
      if ((x - cx) ** 2 + (z - cz) ** 2 > (radius - size * 0.5) ** 2) continue;
      b.add(shapes.box(size, 0.12, size), (i + j) % 2 === 0 ? STONE_LIGHT : STONE_DARK, { p: [x, y + 0.06, z] });
    }
  }
}

function floatingRock(b, x, y, z, radius, depth) {
  b.add(shapes.cylinder(radius, radius * 0.96, 0.7, 28), ROCK, { p: [x, y - 0.35, z] });
  b.add(shapes.cone(radius * 0.94, depth, 14), ROCK_DARK, { p: [x, y - 0.7 - depth / 2, z], r: [Math.PI, 0, 0] });
}

function islandMesh() {
  const b = new Batch();
  floatingRock(b, ISLAND.x, ISLAND.y, ISLAND.z, ISLAND.radius + 0.3, 16);
  checker(b, ISLAND.x, ISLAND.y - 0.12, ISLAND.z, ISLAND.radius, TILE);
  for (let i = 0; i < RAIL_SEGMENTS; i += 2) {
    const a = (i / RAIL_SEGMENTS) * Math.PI * 2;
    b.add(shapes.box(0.22, 1.1, 0.22), LACQUER, { p: [ISLAND.x + Math.cos(a) * RAIL_RADIUS, ISLAND.y + 0.55, ISLAND.z + Math.sin(a) * RAIL_RADIUS] });
  }
  b.add(shapes.torus(RAIL_RADIUS, 0.07, 96), LACQUER, { p: [ISLAND.x, ISLAND.y + 1.05, ISLAND.z], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.cylinder(1.2, 1.3, 1.2, 16), STONE_LIGHT, { p: [ISLAND.x, ISLAND.y + 0.6, ISLAND.z] });
  b.add(shapes.cylinder(1.35, 1.35, 0.12, 16), GILT, { p: [ISLAND.x, ISLAND.y + 1.26, ISLAND.z] });
  for (const side of [-1, 1]) b.add(shapes.cylinder(0.14, 0.17, 4.3, 10), LACQUER, { p: [ISLAND.x + side * BOARD.post, ISLAND.y + 2.15, ISLAND.z] });
  b.add(shapes.box(BOARD.width + 0.5, 0.14, 0.2), LACQUER, { p: [ISLAND.x, BOARD.y + BOARD.height / 2 + 0.12, ISLAND.z] });
  b.add(shapes.box(BOARD.width + 0.5, 0.14, 0.2), LACQUER, { p: [ISLAND.x, BOARD.y - BOARD.height / 2 - 0.12, ISLAND.z] });
  b.add(shapes.box(BOARD.width + 1.1, 0.18, 0.5), GILT, { p: [ISLAND.x, ISLAND.y + 4.38, ISLAND.z] });
  for (const side of [-1, 1]) {
    const x = PORTAL.x + side * (PORTAL.radius + 0.1);
    b.add(shapes.cylinder(0.16, 0.2, 3.4, 10), LACQUER, { p: [x, ISLAND.y + 1.7, PORTAL.z] });
  }
  b.add(shapes.box(PORTAL.radius * 2 + 0.8, 0.22, 0.32), LACQUER, { p: [PORTAL.x, ISLAND.y + 3.45, PORTAL.z] });
  for (const stage of PLATFORMS) {
    floatingRock(b, stage.x, stage.y, stage.z, stage.r + 0.2, stage.r * 1.6);
    checker(b, stage.x, stage.y - 0.12, stage.z, stage.r, stage.r > 4 ? 1 : 0.875);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      b.add(shapes.cylinder(0.12, 0.14, 1.8, 8), LACQUER, { p: [stage.x + Math.cos(a) * (stage.r - 0.25), stage.y + 0.9, stage.z + Math.sin(a) * (stage.r - 0.25)] });
    }
  }
  return b.mesh(toonMaterial({ vertexColors: true, emissive: 0x2a2620 }));
}

function glowMesh() {
  const b = new Batch();
  for (const stage of PLATFORMS) {
    b.add(shapes.torus(stage.r + 0.05, 0.06, 48), GLOW, { p: [stage.x, stage.y + 0.04, stage.z], r: [Math.PI / 2, 0, 0] });
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      b.add(shapes.sphere(0.18, 10, 8), GLOW, { p: [stage.x + Math.cos(a) * (stage.r - 0.25), stage.y + 1.95, stage.z + Math.sin(a) * (stage.r - 0.25)] });
    }
  }
  for (let i = 0; i < RAIL_SEGMENTS; i += 6) {
    const a = (i / RAIL_SEGMENTS) * Math.PI * 2;
    b.add(shapes.sphere(0.16, 10, 8), GLOW, { p: [ISLAND.x + Math.cos(a) * RAIL_RADIUS, ISLAND.y + 1.25, ISLAND.z + Math.sin(a) * RAIL_RADIUS] });
  }
  const mesh = b.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }), { shadow: false });
  mesh.receiveShadow = false;
  return mesh;
}

function cloudMesh() {
  const rand = makeRandom(4242);
  const b = new Batch();
  for (let i = 0; i < 46; i++) {
    const angle = rand() * Math.PI * 2;
    const reach = 10 + rand() * 46;
    const size = 3 + rand() * 5;
    const low = rand() < 0.8;
    const y = low ? ISLAND.y - 9 - rand() * 8 : ISLAND.y + 10 + rand() * 12;
    b.add(shapes.sphere(size, 12, 8), CLOUD, { p: [ISLAND.x + Math.cos(angle) * reach, y, ISLAND.z + Math.sin(angle) * reach], s: [1.4, 0.42, 1] });
  }
  const mesh = b.mesh(toonMaterial({ vertexColors: true, emissive: 0x8a8a90 }), { shadow: false });
  mesh.castShadow = false;
  return mesh;
}

function portalRing() {
  const mesh = new THREE.Mesh(shapes.torus(PORTAL.radius, 0.12, 40), new THREE.MeshBasicMaterial({ color: PORTAL_GLOW, transparent: true, opacity: 0.85, depthWrite: false }));
  mesh.position.set(PORTAL.x, ISLAND.y + 1.75, PORTAL.z);
  const veil = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.radius - 0.08, 32), new THREE.MeshBasicMaterial({ color: PORTAL_GLOW, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  mesh.add(veil);
  return mesh;
}

function boardFaces(texture) {
  const material = new THREE.MeshBasicMaterial({ map: texture });
  return [0, Math.PI].map((turn) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.width, BOARD.height), material);
    mesh.position.set(ISLAND.x, BOARD.y, ISLAND.z + (turn ? -0.06 : 0.06));
    mesh.rotation.y = turn;
    mesh.userData.board = true;
    return mesh;
  });
}

export function createArenaIsland({ onPortal, onBoard, boardSize }) {
  const obstacles = railObstacles();
  const canvas = document.createElement('canvas');
  canvas.width = boardSize.width;
  canvas.height = boardSize.height;
  const board = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  let painted = null;
  return {
    paintBoard(key, paint) {
      if (key === painted) return;
      painted = key;
      paint(board);
      texture.needsUpdate = true;
    },
    region: {
      id: 'arena',
      name: 'Lôi đài',
      bounds: ISLAND_BOUNDS,
      staticNav: true,
      obstacles,
      target(hit) {
        if (hit.object.userData.board) return { kind: 'board', id: 'board', index: 'board', x: ISLAND.x, z: ISLAND.z, stand: BOARD_STAND };
        if (!hit.object.userData.portal) return null;
        return { kind: 'portal', id: 'portal', index: 'portal', x: PORTAL.x, z: PORTAL.z, stand: ARRIVAL };
      },
      actionFor() {
        return { id: 'visit', hint: 'hand' };
      },
      topOf(target) {
        return target.kind === 'board' ? new THREE.Vector3(ISLAND.x, ISLAND.y + 4.8, ISLAND.z) : new THREE.Vector3(PORTAL.x, ISLAND.y + 3.8, PORTAL.z);
      },
      act(action, target) {
        if (target.kind === 'portal') onPortal();
        if (target.kind === 'board') onBoard();
        return null;
      },
      load() {
        const group = new THREE.Group();
        const scenery = new THREE.Group();
        const ground = islandMesh();
        scenery.add(ground, glowMesh(), cloudMesh());
        freeze(scenery);
        const portal = portalRing();
        portal.userData.portal = true;
        portal.children[0].userData.portal = true;
        const faces = boardFaces(texture);
        group.add(scenery, portal, ...faces);
        return {
          group,
          clickables: [ground, portal, ...faces],
          update(t) {
            portal.rotation.z = t * 0.6;
            portal.children[0].material.opacity = 0.22 + Math.sin(t * 2.4) * 0.08;
          },
        };
      },
    },
  };
}
