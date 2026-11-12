import * as THREE from 'three';
import { freeze } from './toon.js';
import { groundDecal, GROUND_LAYER, roundedRectGeometry } from './scenery.js';
import { createMiniMart } from './architecture.js';
import { paving } from './village.js';
import { ROAD } from './road.js';

const SPOT = { x: -88.5, front: 29.4, half: 5.7, depth: 9, seed: 331 };
const BOUNDS = { x0: SPOT.x - SPOT.half - 2, z0: SPOT.front - SPOT.depth - 1, x1: SPOT.x + SPOT.half + 1.5, z1: ROAD.z0 };

export function createFieldMart(options) {
  const house = createMiniMart({ seed: SPOT.seed });
  house.group.position.set(SPOT.x, 0, SPOT.front);

  const group = new THREE.Group();
  group.add(groundDecal(roundedRectGeometry(SPOT.x - SPOT.half - 1.3, SPOT.front - 0.2, SPOT.x + SPOT.half + 0.4, ROAD.z0 + 0.2, 0.4), paving(), GROUND_LAYER.mark + 1, 0.03));
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
      topOf(target) {
        return new THREE.Vector3(target.x, 5.2, target.z);
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
