import * as THREE from 'three';
import { freeze } from './toon.js';
import { groundDecal, GROUND_LAYER, roundedRectGeometry } from './scenery.js';
import { createShophouse } from './architecture.js';
import { paving, plaqueBoard } from './village.js';
import { ROAD } from './road.js';

const SPOT = { x: -86, front: 29.4, width: 6, depth: 7, seed: 331 };
const BOUNDS = { x0: SPOT.x - 5, z0: SPOT.front - SPOT.depth - 1, x1: SPOT.x + 5, z1: ROAD.z0 };

export function createFieldMart(options) {
  const house = createShophouse({ seed: SPOT.seed, width: SPOT.width, depth: SPOT.depth, stories: 1 });
  const sign = plaqueBoard(['SIÊU THỊ'], { bg: 0x1f4a6e, fg: '#fff3c4', border: 0xf2c14e });
  sign.mesh.position.set(house.plaque.x, house.plaque.y, house.plaque.z);
  house.group.add(sign.mesh);
  house.group.position.set(SPOT.x, 0, SPOT.front);

  const group = new THREE.Group();
  group.add(groundDecal(roundedRectGeometry(SPOT.x - 3.2, SPOT.front - 0.2, SPOT.x + 3.2, ROAD.z0 + 0.2, 0.4), paving(), GROUND_LAYER.mark + 1, 0.014));
  group.add(house.group);
  freeze(group);

  const stand = { x: SPOT.x + house.door.x, z: SPOT.front + house.door.z + 0.4 };
  const obstacles = house.obstacles.map((b) => ({ minX: SPOT.x + b.minX, maxX: SPOT.x + b.maxX, minZ: SPOT.front + b.minZ, maxZ: SPOT.front + b.maxZ, minY: b.minY ?? 0, maxY: b.maxY ?? 3 }));
  const owns = (object) => {
    for (let node = object; node; node = node.parent) if (node === house.group) return true;
    return false;
  };

  return {
    stand,
    region: {
      id: 'fieldMart',
      name: 'Siêu thị cánh đồng',
      bounds: BOUNDS,
      staticNav: true,
      obstacles,
      target(hit) {
        if (!owns(hit.object)) return null;
        return { kind: 'place', id: 'fieldMart', index: 'place:fieldMart', x: SPOT.x, z: SPOT.front - 1, stand };
      },
      actionFor() {
        return { id: 'visit', hint: 'hand' };
      },
      labelOf() {
        return 'Siêu thị';
      },
      topOf(target) {
        return new THREE.Vector3(target.x, 3.8, target.z);
      },
      act() {
        if (!options.isMartOpen()) return `Siêu thị đóng cửa rồi, mở ${options.martHours()} nhé!`;
        options.openMart();
        return null;
      },
      load() {
        return { group, clickables: [house.group] };
      },
    },
  };
}
