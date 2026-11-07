import * as THREE from 'three';
import { Batch, shapes, vertexMaterial } from './toon.js';
import { watermelon } from './crops.js';
import { FISH } from './config.js';
import { fishId } from './inventory.js';

const MAX = 24;
const FLIGHT = 0.5;
const STAGGER = 0.09;
const ARC = 0.35;
const HAND = new THREE.Vector3(-0.2, 0.75, 0.25);

const MODELS = {
  tomato(b) {
    b.add(shapes.sphere(0.07, 10, 8), 0xe23b2a, { s: [1, 0.88, 1] });
    b.add(shapes.cone(0.032, 0.025, 5), 0x4f8a2f, { p: [0, 0.062, 0], flat: true });
  },
  watermelon(b) {
    watermelon(b, 0.13, [0, 0, 0]);
  },
  sweetPotato(b) {
    b.add(shapes.sphere(0.06, 10, 8), 0xa23a5a, { s: [0.75, 0.6, 1.4] });
    b.add(shapes.cone(0.012, 0.05, 4), 0x6a3a2a, { p: [0, 0, 0.095], r: [Math.PI / 2, 0, 0], flat: true });
  },
  waterSpinach(b) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.limb([Math.cos(a) * 0.012, -0.09, Math.sin(a) * 0.012], [Math.cos(a) * 0.04, 0.07, Math.sin(a) * 0.04], 0.008, 0x7fbf4a, { capsule: false, seg: 4 });
      b.add(shapes.ico(0.035, 0), i % 2 ? 0x3f9a3a : 0x6cc04e, { p: [Math.cos(a) * 0.05, 0.09, Math.sin(a) * 0.05], s: [0.5, 1.2, 0.25], r: [0, a, 0.4], flat: true });
    }
    b.add(shapes.torus(0.022, 0.006, 8), 0xd8b56a, { p: [0, -0.04, 0], r: [Math.PI / 2, 0, 0] });
  },
  bokChoy(b) {
    b.add(shapes.cylinder(0.04, 0.03, 0.08, 8), 0xe8f2d4, { p: [0, -0.04, 0] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.add(shapes.ico(0.05, 0), i % 2 ? 0x2f7a32 : 0x4f9a3e, { p: [Math.cos(a) * 0.035, 0.04, Math.sin(a) * 0.035], s: [0.8, 1.4, 0.35], r: [0, -a, 0.3], flat: true });
    }
  },
  corn(b) {
    b.limb([0, -0.08, 0], [0, 0.08, 0], 0.042, 0xf2c94c, { seg: 8 });
    for (const side of [-1, 1]) {
      b.add(shapes.cone(0.03, 0.2, 5), 0x9fc45a, { p: [side * 0.035, -0.02, 0], r: [0, 0, side * 0.25], s: [1, 1, 0.45], flat: true });
    }
  },
};

function fishModel(color) {
  return (b) => {
    b.add(shapes.sphere(0.07, 10, 8), color, { s: [0.45, 0.55, 1.35] });
    b.add(shapes.cone(0.05, 0.08, 5), color, { p: [0, 0, -0.12], r: [-Math.PI / 2, 0, 0], s: [0.4, 1, 1], flat: true });
    b.add(shapes.cone(0.025, 0.05, 4), color, { p: [0, 0.045, 0], flat: true });
    for (const side of [-1, 1]) b.add(shapes.sphere(0.01, 6, 4), 0x111111, { p: [side * 0.028, 0.012, 0.07] });
  };
}

for (const [id, fish] of Object.entries(FISH)) MODELS[fishId(id)] = fishModel(fish.color);

export function createHarvesting(scene, avatar) {
  const meshes = {};
  for (const [item, build] of Object.entries(MODELS)) {
    const b = new Batch();
    build(b);
    const mesh = new THREE.InstancedMesh(b.geometry(), vertexMaterial(), MAX);
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    scene.add(mesh);
    meshes[item] = mesh;
  }

  const flyers = [];
  const hand = new THREE.Vector3();
  const point = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const spin = new THREE.Euler();
  const size = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  let clock = 0;
  let reachUntil = 0;
  let reach = 0;

  return {
    busy: false,
    cancel() {},
    start({ count = 6, at, height = 1, item = 'tomato' }) {
      const n = Math.min(MAX - flyers.length, count);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.14 + Math.random() * 0.16;
        flyers.push({
          mesh: meshes[item] ?? meshes.tomato,
          wait: i * STAGGER,
          t: 0,
          from: new THREE.Vector3(at.x + Math.cos(a) * r, at.y + height * (0.25 + Math.random() * 0.55), at.z + Math.sin(a) * r),
          roll: Math.random() * Math.PI * 2,
        });
      }
      reachUntil = clock + n * STAGGER + FLIGHT;
    },
    update(dt) {
      clock += dt;
      reach += ((clock < reachUntil ? 1 : 0) - reach) * (1 - Math.exp(-10 * dt));
      if (reach > 0.02) avatar.rightArm.rotation.x = -1.1 * reach;
      for (const mesh of Object.values(meshes)) {
        mesh.count = 0;
        mesh.visible = false;
      }
      if (!flyers.length) return;
      avatar.group.updateWorldMatrix(true, false);
      hand.copy(HAND).applyMatrix4(avatar.group.matrixWorld);
      let alive = 0;
      const touched = new Set();
      for (const f of flyers) {
        if (f.wait > 0) f.wait -= dt;
        else f.t += dt / FLIGHT;
        if (f.t >= 1) continue;
        const k = f.t * f.t * (3 - 2 * f.t);
        point.lerpVectors(f.from, hand, k);
        point.y += Math.sin(Math.PI * f.t) * ARC;
        const pop = f.wait > 0 ? 1 : 1 - 0.55 * f.t;
        turn.setFromEuler(spin.set(f.roll + f.t * 6, f.roll, 0));
        f.mesh.setMatrixAt(f.mesh.count++, matrix.compose(point, turn, size.setScalar(pop)));
        touched.add(f.mesh);
        flyers[alive++] = f;
      }
      flyers.length = alive;
      for (const mesh of touched) {
        mesh.visible = true;
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
