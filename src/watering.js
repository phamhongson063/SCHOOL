import * as THREE from 'three';
import { Batch, shapes, characterMaterial } from './toon.js';

const GREEN = 0x8cc63f;
const GREEN_LIGHT = 0xacd862;
const GREEN_DEEP = 0x4f6e1a;
const ROSE = 0xe8d84a;
const ROSE_FACE = 0xd4c23a;
const DROP = 0x8fe3c8;

const MAX_DROPS = 90;
const RATE = 45;
const GRAVITY = 6.5;
const TILT = 0.75;
const ARM_RAISE = -1.35;
const UP = new THREE.Vector3(0, 1, 0);
const SPOUT_DIR = new THREE.Vector3(0, 0.55, 1).normalize();
const SPOUT_ROOT = new THREE.Vector3(0, -0.05, 0.1);
const SPOUT_LENGTH = 0.27;

function buildCan() {
  const b = new Batch();
  b.add(shapes.cylinder(0.1, 0.115, 0.22, 16), GREEN, { p: [0, 0, 0] });
  b.add(shapes.cylinder(0.104, 0.104, 0.02, 16), GREEN_LIGHT, { p: [0, 0.115, 0] });
  b.add(shapes.cylinder(0.05, 0.05, 0.022, 12), GREEN_DEEP, { p: [0, 0.118, 0] });
  b.add(shapes.torus(0.11, 0.016, 18, Math.PI), GREEN, { p: [0, 0.1, -0.03], r: [0, Math.PI / 2, 0] });
  const tip = SPOUT_ROOT.clone().addScaledVector(SPOUT_DIR, SPOUT_LENGTH);
  b.limb(SPOUT_ROOT.toArray(), tip.toArray(), 0.02, GREEN, { capsule: false, seg: 8, radiusEnd: 0.016 });
  const rose = new THREE.Quaternion().setFromUnitVectors(UP, SPOUT_DIR.clone().negate());
  b.add(shapes.cone(0.055, 0.075, 14), ROSE, { p: tip.clone().addScaledVector(SPOUT_DIR, 0.03).toArray(), q: rose });
  b.add(shapes.cylinder(0.052, 0.052, 0.008, 14), ROSE_FACE, {
    p: tip.clone().addScaledVector(SPOUT_DIR, 0.068).toArray(),
    q: new THREE.Quaternion().setFromUnitVectors(UP, SPOUT_DIR),
  });
  const mesh = b.mesh(characterMaterial(), { outline: 0.008 });
  const nozzle = new THREE.Object3D();
  nozzle.position.copy(tip).addScaledVector(SPOUT_DIR, 0.075);
  mesh.add(nozzle);
  return { mesh, nozzle };
}

export function createWatering(scene, avatar) {
  const holder = new THREE.Group();
  holder.position.set(-0.21, 0.66, 0.4);
  holder.visible = false;
  const { mesh: can, nozzle } = buildCan();
  holder.add(can);
  avatar.group.add(holder);

  const drops = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.022, 6, 4),
    new THREE.MeshBasicMaterial({ color: DROP, transparent: true, opacity: 0.9 }),
    MAX_DROPS,
  );
  drops.count = 0;
  drops.frustumCulled = false;
  scene.add(drops);

  const particles = [];
  const origin = new THREE.Vector3();
  const point = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const stretch = new THREE.Vector3(1, 2.2, 1);
  const turn = new THREE.Quaternion();
  const velocity = new THREE.Vector3();
  let job = null;
  let pose = 0;
  let spawnDebt = 0;
  let ground = 0;

  function spawn() {
    if (particles.length >= MAX_DROPS) return;
    nozzle.getWorldPosition(origin);
    aim.copy(SPOUT_DIR).transformDirection(nozzle.matrixWorld);
    particles.push({
      x: origin.x + (Math.random() - 0.5) * 0.06,
      y: origin.y + (Math.random() - 0.5) * 0.06,
      z: origin.z + (Math.random() - 0.5) * 0.06,
      vx: aim.x * 0.9 + (Math.random() - 0.5) * 0.35,
      vy: aim.y * 0.9 + (Math.random() - 0.5) * 0.2,
      vz: aim.z * 0.9 + (Math.random() - 0.5) * 0.35,
    });
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
    start({ duration = 2, groundY = 0 }, done) {
      job = { time: 0, duration, done };
      ground = groundY;
      spawnDebt = 0;
    },
    cancel() {
      finish(false);
    },
    update(dt) {
      const target = job ? 1 : 0;
      pose += (target - pose) * (1 - Math.exp(-10 * dt));
      if (!job && pose < 0.02) pose = 0;
      holder.visible = pose > 0.02;
      if (holder.visible) {
        holder.rotation.x = TILT * pose;
        avatar.rightArm.rotation.x = ARM_RAISE * pose;
      }

      if (job) {
        job.time += dt;
        if (pose > 0.85 && job.time < job.duration - 0.15) {
          spawnDebt += RATE * dt;
          avatar.group.updateWorldMatrix(true, true);
          while (spawnDebt >= 1) {
            spawn();
            spawnDebt -= 1;
          }
        }
        if (job.time >= job.duration) finish(true);
      }

      let alive = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.vy -= GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y <= ground) continue;
        particles[alive++] = p;
      }
      particles.length = alive;
      for (let i = 0; i < alive; i++) {
        const p = particles[i];
        velocity.set(p.vx, p.vy, p.vz).normalize();
        turn.setFromUnitVectors(UP, velocity);
        matrix.compose(point.set(p.x, p.y, p.z), turn, stretch);
        drops.setMatrixAt(i, matrix);
      }
      drops.count = alive;
      if (alive) drops.instanceMatrix.needsUpdate = true;
    },
  };
}
