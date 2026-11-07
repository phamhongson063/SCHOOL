import * as THREE from 'three';
import { Batch, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';

export function createClouds(scene) {
  const group = new THREE.Group();
  const material = toonMaterial({ vertexColors: true, emissive: 0x8a8a8a });
  const rand = makeRandom(9);

  for (let i = 0; i < 22; i++) {
    const b = new Batch();
    const puffs = 3 + Math.floor(rand() * 4);
    for (let j = 0; j < puffs; j++) {
      const r = 2.2 + rand() * 2.4;
      b.add(shapes.ico(r, 1), 0xffffff, {
        p: [(j - puffs / 2) * 2.6 + rand(), rand() * 1.2, (rand() - 0.5) * 3],
        s: [1.2, 0.7, 1],
        flat: true,
      });
    }
    const cloud = b.mesh(material, { shadow: false });
    cloud.receiveShadow = false;
    cloud.position.set(rand() * 300 - 150, 45 + rand() * 10, rand() * 300 - 150);
    group.add(cloud);
  }
  scene.add(group);

  return {
    update(dt) {
      for (const cloud of group.children) {
        cloud.position.x += dt * 1.5;
        if (cloud.position.x > 160) cloud.position.x -= 320;
      }
    },
  };
}
