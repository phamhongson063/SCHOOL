import * as THREE from 'three';
import { Batch, shapes, characterMaterial, vertexMaterial } from './toon.js';

const HAND = new THREE.Vector3(-0.21, 0.66, 0.36);
const ROD_LENGTH = 2.1;
const WATER_Y = 0.05;
const CAST_TIME = 0.7;
const REEL_TIME = 0.45;
const ARM_UP = -0.75;

let floatGeometry = null;
let lineMaterial = null;

function buildRod() {
  const b = new Batch();
  b.limb([0, -0.12, 0], [0, ROD_LENGTH, 0], 0.018, 0xc8a868, { capsule: false, seg: 6, radiusEnd: 0.007 });
  for (let y = 0.35; y < ROD_LENGTH - 0.2; y += 0.45) {
    const r = 0.019 - (y / ROD_LENGTH) * 0.01;
    b.add(shapes.cylinder(r, r, 0.03, 6), 0xa8884a, { p: [0, y, 0] });
  }
  b.add(shapes.cylinder(0.026, 0.026, 0.28, 8), 0x5a3a22, { p: [0, 0.02, 0] });
  const mesh = b.mesh(characterMaterial(), { shadow: false });
  const tip = new THREE.Object3D();
  tip.position.set(0, ROD_LENGTH, 0);
  mesh.add(tip);
  return { mesh, tip };
}

function floatMesh() {
  if (!floatGeometry) {
    const b = new Batch();
    b.add(shapes.sphere(0.06, 10, 8), 0xffffff, { p: [0, 0, 0], paint: (x, y) => (y > 0.005 ? 0xd8321e : 0xfaf6ec) });
    b.add(shapes.cylinder(0.008, 0.008, 0.12, 5), 0xd8321e, { p: [0, 0.09, 0] });
    floatGeometry = b.geometry();
  }
  const mesh = new THREE.Mesh(floatGeometry, vertexMaterial());
  mesh.visible = false;
  return mesh;
}

export function createAngler(scene, walker) {
  const holder = new THREE.Group();
  holder.position.copy(HAND);
  holder.rotation.x = 0.95;
  holder.visible = false;
  const { mesh: rod, tip } = buildRod();
  holder.add(rod);
  walker.group.add(holder);

  const float = floatMesh();
  scene.add(float);
  lineMaterial ??= new THREE.LineBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.75 });
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeometry, lineMaterial);
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  const tipPos = new THREE.Vector3();
  const target = new THREE.Vector3();
  const from = new THREE.Vector3();
  let state = 'idle';
  let timer = 0;
  let clock = 0;
  let shown = true;

  const showLine = (on) => {
    float.visible = on && shown;
    line.visible = on && shown;
  };

  return {
    get busy() {
      return state !== 'idle';
    },
    get waiting() {
      return state === 'wait';
    },
    cast(point) {
      state = 'cast';
      timer = 0;
      target.set(point.x, WATER_Y, point.z);
      holder.visible = shown;
      showLine(true);
    },
    bite() {
      if (state === 'idle') return;
      state = 'bite';
      timer = 0;
    },
    reel() {
      if (state === 'idle') return;
      state = 'reel';
      timer = 0;
      from.copy(float.position);
    },
    cancel() {
      this.stop();
    },
    stop() {
      state = 'idle';
      holder.visible = false;
      showLine(false);
    },
    update(dt, visible = true) {
      if (state === 'idle') return;
      shown = visible;
      holder.visible = visible;
      clock += dt;
      timer += dt;
      walker.rightArm.rotation.x = ARM_UP + (state === 'bite' ? Math.sin(clock * 30) * 0.08 : 0);
      walker.group.updateWorldMatrix(true, true);
      tip.getWorldPosition(tipPos);
      if (state === 'cast') {
        const k = Math.min(1, timer / CAST_TIME);
        float.position.lerpVectors(tipPos, target, k);
        float.position.y += Math.sin(Math.PI * k) * 1.2;
        if (k >= 1) state = 'wait';
      } else if (state === 'wait') {
        float.position.set(target.x, WATER_Y + Math.sin(clock * 2.2) * 0.02, target.z);
      } else if (state === 'bite') {
        float.position.set(target.x + Math.sin(clock * 23) * 0.03, WATER_Y - 0.07 + Math.sin(clock * 17) * 0.03, target.z + Math.cos(clock * 19) * 0.03);
      } else if (state === 'reel') {
        const k = Math.min(1, timer / REEL_TIME);
        float.position.lerpVectors(from, tipPos, k);
        float.position.y += Math.sin(Math.PI * k) * 0.6;
        if (k >= 1) {
          state = 'hold';
          showLine(false);
        }
      }
      if (state !== 'hold') showLine(true);
      const positions = lineGeometry.attributes.position;
      positions.setXYZ(0, tipPos.x, tipPos.y, tipPos.z);
      positions.setXYZ(1, float.position.x, float.position.y + 0.05, float.position.z);
      positions.needsUpdate = true;
    },
  };
}
