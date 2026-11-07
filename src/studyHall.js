import * as THREE from 'three';
import { Batch, freeze, shapes } from './toon.js';
import { studentFurniture, lantern } from './props.js';
import { tileRoofMeshes } from './scenery.js';

export const STUDY_HALL = { x: 42, front: 40.6, width: 10, depth: 12, door: 2.4, height: 3.2 };

const WALL = 0xd9b46a;
const WOOD = 0x5e3a24;
const WOOD_DARK = 0x4a2c1e;
const STONE = 0xb3ab99;
const FLOOR_TILE = 0x9c624a;
const DESK_ROWS = [43.2, 45.4, 47.6, 49.8];
const DESK_OFFSET = 3.2;

export function buildStudyHall(world) {
  const { x, front, width, depth, door } = STUDY_HALL;
  const x0 = Math.floor(x - width / 2);
  const x1 = Math.ceil(x + width / 2) - 1;
  const z0 = Math.floor(front);
  const z1 = Math.ceil(front + depth) - 1;
  const doorX0 = Math.floor(x - door / 2) + 1;
  const doorX1 = Math.ceil(x + door / 2) - 2;
  for (let cx = x0; cx <= x1; cx++) {
    if (cx < doorX0 || cx > doorX1) world.fill(cx, 0, z0, cx, 2, z0, 'plaster');
    world.fill(cx, 0, z1, cx, 2, z1, 'plaster');
  }
  world.fill(x0, 0, z0, x0, 2, z1, 'plaster');
  world.fill(x1, 0, z0, x1, 2, z1, 'plaster');
}

export function createStudyHall(scene) {
  const { x, front, width, depth, door, height } = STUDY_HALL;
  const back = front + depth;
  const left = x - width / 2;
  const right = x + width / 2;
  const T = 0.25;
  const b = new Batch();
  b.add(shapes.box(width - 0.2, 0.03, depth - 0.2), FLOOR_TILE, { p: [x, 0.015, front + depth / 2] });
  b.add(shapes.box(door + 0.6, 0.04, 1.0), STONE, { p: [x, 0.02, front - 0.5] });
  b.add(shapes.box(width, height, T), WALL, { p: [x, height / 2, back - T / 2] });
  for (const wx of [left + T / 2, right - T / 2]) b.add(shapes.box(T, height, depth - T), WALL, { p: [wx, height / 2, front + (depth - T) / 2] });
  const side = (width - door) / 2;
  for (const s of [-1, 1]) b.add(shapes.box(side - T, height, T), WALL, { p: [x + s * (door / 2 + (side - T) / 2), height / 2, front + T / 2] });
  b.add(shapes.box(door, height - 2.6, T), WALL, { p: [x, (height + 2.6) / 2, front + T / 2] });
  for (const s of [-1, 1]) b.add(shapes.box(0.16, 2.6, T + 0.1), WOOD, { p: [x + s * (door / 2 + 0.06), 1.3, front + T / 2] });
  b.add(shapes.box(door + 0.32, 0.16, T + 0.1), WOOD, { p: [x, 2.62, front + T / 2] });
  for (const s of [-1, 1]) b.add(shapes.box(0.06, 2.5, door / 2), WOOD_DARK, { p: [x + s * (door / 2 + 0.2), 1.25, front - door / 4], r: [0, s * 1.2, 0] });

  for (const wx of [left, right]) {
    const out = wx < x ? -1 : 1;
    for (const wz of [front + 3.5, front + 8.5]) {
      b.add(shapes.box(0.08, 1.2, 1.6), WOOD_DARK, { p: [wx + out * 0.02, 1.9, wz] });
      for (let k = -0.6; k <= 0.61; k += 0.3) b.add(shapes.box(0.12, 1.2, 0.06), WOOD, { p: [wx + out * 0.06, 1.9, wz + k] });
      b.add(shapes.box(0.14, 0.1, 1.8), WOOD, { p: [wx + out * 0.06, 2.55, wz] });
      b.add(shapes.box(0.14, 0.1, 1.8), WOOD, { p: [wx + out * 0.06, 1.25, wz] });
    }
  }
  b.add(shapes.box(width + 0.1, 0.22, 0.3), WOOD, { p: [x, height + 0.05, front + 0.1] });

  const group = new THREE.Group();
  group.add(b.mesh());
  group.add(...tileRoofMeshes({ cx: x, cz: front + depth / 2, hx: width / 2 + 0.9, hz: depth / 2 + 0.9, ridge: 3.6, eaveY: height + 0.1, height: 2.3, lift: 0.3, falloff: 1.5 }));

  const seats = [];
  const obstacles = [];
  for (const s of [-1, 1]) {
    const facing = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    const dir = { x: Math.sin(facing), z: Math.cos(facing) };
    for (const [i, sz] of DESK_ROWS.entries()) {
      const sx = x + s * DESK_OFFSET;
      const furniture = new THREE.Group();
      furniture.position.set(sx, 0.03, sz);
      furniture.rotation.y = facing;
      furniture.add(studentFurniture(900 + i * 7 + (s < 0 ? 0 : 50)));
      group.add(furniture);
      const deskX = sx + dir.x * 0.45;
      obstacles.push({ minX: deskX - 0.25, maxX: deskX + 0.25, minZ: sz - 0.5, maxZ: sz + 0.5, minY: 0, maxY: 0.6 });
      seats.push({
        index: seats.length,
        study: true,
        x: sx,
        z: sz,
        facing,
        sit: new THREE.Vector3(sx, 0.03, sz),
        spot: new THREE.Vector3(sx - dir.x * 0.8, 0, sz - dir.z * 0.8),
        look: new THREE.Vector3(sx + dir.x * 1.5, 0.6, sz),
        occupant: null,
        reservedBy: null,
        place(model) {
          model.position.set(sx, 0.05, sz);
          model.rotation.set(0, facing, 0);
        },
      });
    }
  }
  for (const lz of [front + 4, front + 8.5]) {
    const lamp = lantern();
    lamp.position.set(x, height - 0.1, lz);
    lamp.castShadow = false;
    group.add(lamp);
  }
  scene.add(group);
  freeze(group);
  return { group, seats, obstacles };
}
