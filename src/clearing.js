import * as THREE from 'three';
import { Batch, shapes, characterMaterial } from './toon.js';

const WOOD = 0x9a6a3c;
const METAL = 0x8f989e;
const METAL_EDGE = 0xd5dade;
const BITS = [0x6b4428, 0x8a5c38, 0x5c3920, 0xb5ad48, 0x9a7a3c];
const MAX_BITS = 60;
const GRAVITY = 7;
const SWINGS = 2;
const RAISED = -1.25;
const STRUCK = 0.85;

function buildHoe() {
  const b = new Batch();
  b.limb([0, -0.08, 0], [0, 0.58, 0], 0.017, WOOD, { capsule: false, seg: 8 });
  b.add(shapes.cylinder(0.026, 0.026, 0.05, 8), METAL, { p: [0, 0.57, 0] });
  b.add(shapes.box(0.13, 0.012, 0.15), METAL, { p: [0, 0.59, 0.08], r: [-0.25, 0, 0] });
  b.add(shapes.box(0.13, 0.014, 0.02), METAL_EDGE, { p: [0, 0.57, 0.155], r: [-0.25, 0, 0] });
  return b.mesh(characterMaterial(), { outline: 0.006 });
}

function swingAngle(u) {
  if (u < 0.45) {
    const k = u / 0.45;
    return RAISED * k * k * (3 - 2 * k);
  }
  if (u < 0.65) {
    const k = (u - 0.45) / 0.2;
    return RAISED + (STRUCK - RAISED) * k * k;
  }
  const k = (u - 0.65) / 0.35;
  return STRUCK * (1 - k * k * (3 - 2 * k));
}

export function createClearing(scene, avatar) {
  const holder = new THREE.Group();
  holder.position.set(-0.21, 0.6, 0.16);
  holder.visible = false;
  holder.add(buildHoe());
  avatar.group.add(holder);

  const bits = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial(), MAX_BITS);
  bits.count = 0;
  bits.visible = false;
  bits.frustumCulled = false;
  const tint = new THREE.Color();
  for (let i = 0; i < MAX_BITS; i++) bits.setColorAt(i, tint.set(BITS[i % BITS.length]));
  scene.add(bits);

  const particles = [];
  const point = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const spin = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();
  let job = null;
  let ground = 0;
  let pose = 0;

  function burst(at) {
    for (let i = 0; i < 14 && particles.length < MAX_BITS; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = 0.4 + Math.random() * 0.8;
      particles.push({
        x: at.x + Math.cos(a) * 0.1,
        y: at.y + 0.05,
        z: at.z + Math.sin(a) * 0.1,
        vx: Math.cos(a) * out,
        vy: 1.2 + Math.random() * 1.2,
        vz: Math.sin(a) * out,
        roll: Math.random() * 6,
      });
    }
  }

  function finish(completed) {
    const done = job?.done;
    job = null;
    if (completed) done?.();
  }

  return {
    get busy() {
      return job !== null;
    },
    start({ duration = 1.4, at, groundY = 0 }, done) {
      job = { time: 0, duration, at, done, struck: 0 };
      ground = groundY;
    },
    cancel() {
      finish(false);
    },
    update(dt) {
      pose += ((job ? 1 : 0) - pose) * (1 - Math.exp(-12 * dt));
      holder.visible = pose > 0.02;
      if (job) {
        job.time += dt;
        const cycles = (job.time / job.duration) * SWINGS;
        const u = cycles % 1;
        const angle = cycles >= SWINGS ? 0 : swingAngle(u);
        holder.rotation.x = angle;
        avatar.rightArm.rotation.x = -0.9 + angle * 0.55;
        if (Math.floor(cycles - 0.55) >= job.struck && cycles < SWINGS) {
          job.struck += 1;
          burst(job.at);
        }
        if (job.time >= job.duration) finish(true);
      } else if (holder.visible) {
        avatar.rightArm.rotation.x *= 1 - pose;
      }

      let alive = 0;
      for (const p of particles) {
        p.vy -= GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y <= ground) continue;
        point.set(p.x, p.y, p.z);
        turn.setFromEuler(spin.set(p.roll + p.y * 8, p.roll, 0));
        bits.setMatrixAt(alive, matrix.compose(point, turn, one));
        particles[alive++] = p;
      }
      particles.length = alive;
      bits.count = alive;
      bits.visible = alive > 0;
      if (alive) bits.instanceMatrix.needsUpdate = true;
    },
  };
}
