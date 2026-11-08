import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, freeze, shapes, shade } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundDecal, GROUND_LAYER, markMaterial, roundedRectGeometry, roundTree } from './scenery.js';

export const ROAD = { z0: 33, z1: 37, x0: -150, x1: 151 };
export const SPAWN = { x: 0.5, y: 0, z: 35 };

export const TREES = [
  [-35, 31.2],
  [-46, 31.4],
  [36, 31.3],
  [47, 31.2],
  [-35, 39.6],
  [-42, 39.8],
  [36, 39.6],
  [43, 39.6],
];

const PEBBLE = 0xb9ad98;
const RUT = 0xc79d6c;

export function createRoad() {
  return {
    id: 'road',
    name: 'Đường làng',
    bounds: { x0: -44, z0: 31, x1: 45, z1: 38.5 },
    load() {
      const rand = makeRandom(515);
      const group = new THREE.Group();
      const material = earthMaterial();
      const surface = groundDecal(roundedRectGeometry(ROAD.x0, ROAD.z0, ROAD.x1, ROAD.z1, 1), material, GROUND_LAYER.earth);
      group.add(surface);

      const rutMaterial = markMaterial(RUT);
      const ruts = [ROAD.z0 + 1.25, ROAD.z1 - 1.25].map((z) =>
        roundedRectGeometry(ROAD.x0 + 1, z - 0.175, ROAD.x1 - 1, z + 0.175, 0.17),
      );
      const rutMesh = groundDecal(mergeGeometries(ruts, false), rutMaterial, GROUND_LAYER.mark, 0.012);
      for (const rut of ruts) rut.dispose();
      group.add(rutMesh);

      const b = new Batch();
      for (let i = 0; i < 160; i++) {
        const x = -70 + rand() * 140;
        const z = rand() < 0.5 ? ROAD.z0 + rand() * 0.5 : ROAD.z1 - rand() * 0.5;
        b.add(shapes.ico(0.06 + rand() * 0.08, 0), shade(PEBBLE, 0.8 + rand() * 0.3), {
          p: [x, 0.03, z],
          s: [1.3, 0.55, 1],
          r: [0, rand() * 3, 0],
          flat: true,
        });
      }
      const obstacles = [];
      for (const [x, z] of TREES) {
        roundTree(b, rand, { x, z, h: 4 + Math.floor(rand() * 2) });
        obstacles.push({ minX: x + 0.2, minZ: z + 0.2, maxX: x + 0.8, maxZ: z + 0.8, minY: 0, maxY: 3 });
      }
      const details = b.mesh();
      group.add(details);
      freeze(group);

      return {
        group,
        clickables: [surface],
        obstacles,
        dispose() {
          surface.geometry.dispose();
          material.map.dispose();
          material.dispose();
          rutMesh.geometry.dispose();
          rutMaterial.dispose();
          details.geometry.dispose();
        },
      };
    },
  };
}
