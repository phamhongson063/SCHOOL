import * as THREE from 'three';
import { Batch, shapes, vertexMaterial } from './toon.js';
import { WILDLIFE, HUNTING } from './config.js';
import { gameId } from './inventory.js';
import { MOUNTAIN, terrainHeight, onMountain } from './terrain.js';

const VISIBLE_DISTANCE = 80;
const HOME_RADIUS = 14;
const SPAWN_TRIES = 40;
const TURN_RATE = 6;
const STEP_TRIES = [0, 0.6, -0.6, 1.2, -1.2, 2, -2];

const between = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function rabbitShape() {
  const b = new Batch();
  const fur = 0xb48d6a;
  const furDark = 0x9a7656;
  const cream = 0xf3e8d8;
  const pink = 0xeba3ab;
  b.add(shapes.sphere(0.19, 16, 12), fur, { p: [0, 0.19, -0.05], s: [0.95, 0.9, 1.08] });
  for (const side of [-1, 1]) b.add(shapes.sphere(0.11, 14, 10), fur, { p: [side * 0.1, 0.13, -0.1], s: [0.75, 1, 1.15] });
  b.add(shapes.sphere(0.13, 14, 10), cream, { p: [0, 0.16, 0.05], s: [0.85, 0.95, 0.8] });
  b.add(shapes.sphere(0.145, 18, 14), fur, { p: [0, 0.38, 0.13], s: [1.05, 0.95, 0.98] });
  for (const side of [-1, 1]) {
    b.add(shapes.sphere(0.06, 12, 9), cream, { p: [side * 0.055, 0.33, 0.23], s: [1.1, 0.9, 0.9] });
    b.add(shapes.sphere(0.03, 12, 9), 0x1d1611, { p: [side * 0.075, 0.405, 0.24] });
    b.add(shapes.sphere(0.01, 6, 4), 0xffffff, { p: [side * 0.07, 0.418, 0.266] });
    b.add(shapes.sphere(0.022, 8, 6), 0xf2a6a6, { p: [side * 0.1, 0.36, 0.22], s: [1, 0.6, 0.5] });
    b.limb([side * 0.045, 0.48, 0.11], [side * 0.085, 0.7, 0.04], 0.04, fur, { seg: 10, radiusEnd: 0.03 });
    b.limb([side * 0.047, 0.5, 0.135], [side * 0.083, 0.68, 0.075], 0.022, pink, { seg: 8, radiusEnd: 0.016 });
    b.add(shapes.sphere(0.035, 10, 8), cream, { p: [side * 0.05, 0.035, 0.15], s: [1, 0.7, 1.35] });
    b.add(shapes.sphere(0.052, 10, 8), furDark, { p: [side * 0.105, 0.028, -0.06], s: [0.8, 0.5, 1.9] });
  }
  b.add(shapes.sphere(0.022, 8, 6), 0xd9707f, { p: [0, 0.36, 0.272], s: [1.3, 0.9, 0.8] });
  b.add(shapes.sphere(0.065, 12, 9), 0xfbf7f0, { p: [0, 0.22, -0.25] });
  return b.geometry();
}

function pheasantShape() {
  const b = new Batch();
  b.add(shapes.sphere(0.2, 12, 9), 0x8a4a2a, { p: [0, 0.32, 0], s: [0.85, 0.85, 1.25] });
  b.add(shapes.cylinder(0.06, 0.08, 0.22, 8), 0x2f5a4a, { p: [0, 0.5, 0.18], r: [0.4, 0, 0] });
  b.add(shapes.sphere(0.085, 10, 8), 0x2f5a4a, { p: [0, 0.62, 0.24] });
  b.add(shapes.sphere(0.05, 8, 6), 0xc0281a, { p: [0, 0.62, 0.29], s: [1.2, 1, 0.7] });
  b.add(shapes.cone(0.03, 0.09, 6), 0xd8b45a, { p: [0, 0.6, 0.35], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.box(0.012, 0.012, 0.02), 0xf4ead2, { p: [0, 0.48, 0.12] });
  b.add(shapes.box(0.08, 0.04, 0.55), 0x6a3a22, { p: [0, 0.38, -0.42], r: [-0.35, 0, 0] });
  b.add(shapes.box(0.05, 0.03, 0.45), 0xb08050, { p: [0, 0.42, -0.45], r: [-0.45, 0, 0] });
  for (const side of [-1, 1]) {
    b.add(shapes.cylinder(0.015, 0.015, 0.22, 5), 0xc9a24a, { p: [side * 0.07, 0.11, 0.02] });
    b.add(shapes.sphere(0.12, 8, 6), 0x7a4024, { p: [side * 0.13, 0.33, -0.02], s: [0.35, 0.7, 1.1] });
  }
  return b.geometry();
}

function deerShape() {
  const b = new Batch();
  const coat = 0xa06a3c;
  b.add(shapes.sphere(0.3, 12, 9), coat, { p: [0, 0.78, 0], s: [0.85, 0.8, 1.6] });
  b.add(shapes.sphere(0.24, 10, 8), 0xe8d6b8, { p: [0, 0.68, 0], s: [0.8, 0.5, 1.3] });
  b.limb([0, 0.92, 0.32], [0, 1.22, 0.5], 0.09, coat, { seg: 8 });
  b.add(shapes.sphere(0.14, 10, 8), coat, { p: [0, 1.26, 0.58], s: [0.85, 0.85, 1.25] });
  b.add(shapes.sphere(0.05, 8, 6), 0x2a1a12, { p: [0, 1.22, 0.74] });
  for (const side of [-1, 1]) {
    b.add(shapes.sphere(0.05, 8, 6), coat, { p: [side * 0.11, 1.38, 0.5], s: [0.6, 1.4, 0.4], r: [0, 0, side * 0.6] });
    b.add(shapes.sphere(0.024, 6, 4), 0x1a1410, { p: [side * 0.08, 1.3, 0.66] });
    for (const z of [0.3, -0.3]) b.add(shapes.cylinder(0.04, 0.035, 0.6, 6), 0x8a5a32, { p: [side * 0.12, 0.3, z] });
  }
  b.add(shapes.sphere(0.06, 8, 6), 0xf4ead2, { p: [0, 0.9, -0.48] });
  return b.geometry();
}

function boarShape() {
  const b = new Batch();
  const hide = 0x4a3a30;
  b.add(shapes.sphere(0.36, 12, 9), hide, { p: [0, 0.5, 0], s: [0.85, 0.85, 1.45] });
  b.add(shapes.sphere(0.24, 10, 8), hide, { p: [0, 0.52, 0.48], s: [0.9, 0.9, 1.1] });
  b.add(shapes.cylinder(0.09, 0.11, 0.18, 8), 0x6a4e40, { p: [0, 0.46, 0.72], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.box(0.06, 0.18, 0.7), 0x2a201a, { p: [0, 0.82, 0.05] });
  for (const side of [-1, 1]) {
    b.add(shapes.cone(0.025, 0.16, 6), 0xf4ead2, { p: [side * 0.1, 0.44, 0.74], r: [-0.9, 0, side * 0.3] });
    b.add(shapes.sphere(0.03, 6, 4), 0xc0281a, { p: [side * 0.12, 0.6, 0.62] });
    b.add(shapes.cone(0.06, 0.12, 6), hide, { p: [side * 0.12, 0.74, 0.42] });
    for (const z of [0.28, -0.3]) b.add(shapes.cylinder(0.06, 0.05, 0.3, 6), 0x3a2c24, { p: [side * 0.17, 0.15, z] });
  }
  return b.geometry();
}

const SHAPES = { rabbit: rabbitShape, pheasant: pheasantShape, deer: deerShape, boar: boarShape };

export function createWildlife({ nav, onBoarHit }) {
  const group = new THREE.Group();
  const animals = [];
  const material = vertexMaterial();
  for (const [kind, spec] of Object.entries(WILDLIFE)) {
    const geometry = SHAPES[kind]();
    for (let i = 0; i < spec.count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.visible = false;
      group.add(mesh);
      animals.push({ kind, spec, mesh, x: 0, y: 0, z: 0, facing: 0, speed: 0, state: 'gone', respawnAt: 0, timer: 0, target: null, home: null, phase: Math.random() * 10, hunter: null, cooldown: 0 });
    }
  }
  let clock = 0;
  let started = false;
  const probe = new THREE.Vector3();

  const walkable = (x, z) => onMountain(x, z, 0.8) && nav().heightAt(x, z) !== null;

  function spawnPoint(avoid) {
    for (let i = 0; i < SPAWN_TRIES; i++) {
      const x = between(MOUNTAIN.x0 + 6, MOUNTAIN.x1 - 6);
      const z = between(MOUNTAIN.z0 + 6, MOUNTAIN.z1 - 6);
      const h = terrainHeight(x, z);
      if (h < 2 || h > 30 || !walkable(x, z)) continue;
      if (avoid && Math.hypot(avoid.x - x, avoid.z - z) < 25) continue;
      return { x, z };
    }
    return null;
  }

  function spawn(animal, avoid) {
    const at = spawnPoint(avoid);
    if (!at) {
      animal.respawnAt = clock + 5;
      return;
    }
    Object.assign(animal, { x: at.x, z: at.z, y: terrainHeight(at.x, at.z), home: at, state: 'idle', timer: between(1, 4), target: null, hunter: null, cooldown: 0 });
    animal.facing = Math.random() * Math.PI * 2;
  }

  function vanish(animal) {
    animal.state = 'gone';
    animal.hunter = null;
    animal.mesh.visible = false;
    animal.respawnAt = clock + between(...HUNTING.respawn);
  }

  function wanderTarget(animal) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * HOME_RADIUS;
      const x = animal.home.x + Math.cos(a) * r;
      const z = animal.home.z + Math.sin(a) * r;
      if (walkable(x, z)) return { x, z };
    }
    return null;
  }

  function flee(animal, from, seconds = between(2.5, 4)) {
    if (animal.state === 'gone') return;
    animal.hunter = null;
    animal.state = 'flee';
    animal.timer = seconds;
    animal.facing = Math.atan2(animal.x - from.x, animal.z - from.z);
  }

  function step(animal, heading, speed, dt) {
    for (const offset of STEP_TRIES) {
      const dir = heading + offset;
      const nx = animal.x + Math.sin(dir) * speed * dt;
      const nz = animal.z + Math.cos(dir) * speed * dt;
      if (!walkable(nx, nz)) continue;
      animal.x = nx;
      animal.z = nz;
      animal.facing += wrap(dir - animal.facing) * Math.min(1, TURN_RATE * dt);
      animal.speed = speed;
      return true;
    }
    animal.speed = 0;
    return false;
  }

  function gentle(animal, player, playerSpeed, dt) {
    const dx = player.position.x - animal.x;
    const dz = player.position.z - animal.z;
    const d = Math.hypot(dx, dz);
    const running = playerSpeed > 4;
    if (animal.state === 'frozen' || animal.hunter) {
      animal.speed = 0;
      return;
    }
    if (animal.state !== 'flee') {
      if (running && d < HUNTING.runNotice) flee(animal, player.position);
      else if (d < HUNTING.noticeRange && Math.random() < animal.spec.wary * dt) flee(animal, player.position);
      else if (d < HUNTING.watchRange && playerSpeed > 0.2) {
        animal.state = 'watch';
        animal.timer = 1.5;
      }
    }
    if (animal.state === 'flee') {
      animal.timer -= dt;
      const away = Math.atan2(-dx, -dz);
      if (!step(animal, away, animal.spec.flee, dt)) animal.timer -= dt * 2;
      if (animal.timer <= 0) {
        animal.state = 'idle';
        animal.timer = between(2, 5);
        animal.home = { x: animal.x, z: animal.z };
      }
      return;
    }
    if (animal.state === 'watch') {
      animal.speed = 0;
      animal.facing += wrap(Math.atan2(dx, dz) - animal.facing) * Math.min(1, 2 * dt);
      animal.timer -= dt;
      if (animal.timer <= 0) animal.state = 'idle';
      return;
    }
    roam(animal, dt);
  }

  function roam(animal, dt) {
    if (animal.state === 'idle') {
      animal.speed = 0;
      animal.timer -= dt;
      if (animal.timer > 0) return;
      animal.target = wanderTarget(animal);
      animal.state = animal.target ? 'walk' : 'idle';
      animal.timer = between(2, 5);
      return;
    }
    const t = animal.target;
    if (!t) {
      animal.state = 'idle';
      return;
    }
    const d = Math.hypot(t.x - animal.x, t.z - animal.z);
    if (d < 0.4 || !step(animal, Math.atan2(t.x - animal.x, t.z - animal.z), animal.spec.speed, dt)) {
      animal.state = 'idle';
      animal.timer = between(2, 6);
    }
  }

  function boar(animal, player, canHit, dt) {
    animal.cooldown = Math.max(0, animal.cooldown - dt);
    const dx = player.position.x - animal.x;
    const dz = player.position.z - animal.z;
    const d = Math.hypot(dx, dz);
    const playerOnMountain = onMountain(player.position.x, player.position.z, 0.3);
    if (animal.state === 'flee') {
      animal.timer -= dt;
      step(animal, Math.atan2(-dx, -dz), animal.spec.speed * 2, dt);
      if (animal.timer <= 0) {
        animal.state = 'idle';
        animal.timer = between(2, 4);
        animal.home = { x: animal.x, z: animal.z };
      }
      return;
    }
    if (animal.state === 'charge') {
      if (!playerOnMountain || d > HUNTING.boarSight * 1.8 || !canHit) {
        animal.state = 'idle';
        animal.timer = between(1, 3);
        return;
      }
      step(animal, Math.atan2(dx, dz), animal.spec.charge, dt);
      if (d < 1.1) {
        onBoarHit(dx / (d || 1), dz / (d || 1));
        animal.cooldown = HUNTING.boarCooldown;
        flee(animal, player.position, between(2.5, 3.5));
      }
      return;
    }
    if (canHit && playerOnMountain && animal.cooldown <= 0 && d < HUNTING.boarSight) {
      animal.state = 'charge';
      return;
    }
    roam(animal, dt);
  }

  function place(animal, t, dt, camera) {
    const ground = nav().heightAt(animal.x, animal.z) ?? terrainHeight(animal.x, animal.z);
    animal.y += (ground - animal.y) * 0.4;
    const mesh = animal.mesh;
    mesh.visible = camera.position.distanceToSquared(probe.set(animal.x, animal.y, animal.z)) < VISIBLE_DISTANCE * VISIBLE_DISTANCE;
    if (!mesh.visible) return;
    animal.phase += animal.speed * dt * 9;
    let lift = 0;
    let pitch = 0;
    if (animal.kind === 'rabbit') lift = animal.speed > 0 ? Math.abs(Math.sin(animal.phase)) * 0.22 : 0;
    else if (animal.kind === 'pheasant') pitch = animal.speed > 0 ? Math.sin(animal.phase * 1.4) * 0.08 : animal.state === 'idle' ? Math.max(0, Math.sin(t * 2 + animal.mesh.id)) * 0.5 : 0;
    else lift = animal.speed > 0 ? Math.abs(Math.sin(animal.phase)) * 0.06 : 0;
    if (animal.kind === 'deer' && animal.state === 'idle') pitch = Math.max(0, Math.sin(t * 0.7 + animal.mesh.id)) * 0.35;
    mesh.position.set(animal.x, animal.y + lift, animal.z);
    mesh.rotation.set(pitch, animal.facing, 0, 'YXZ');
  }

  return {
    group,
    clickables: animals.map((animal) => animal.mesh),
    animalOf(object) {
      return animals.find((animal) => animal.mesh === object && animal.state !== 'gone') ?? null;
    },
    get hasPrey() {
      return animals.some((animal) => animal.spec.gentle && !animal.hunter && (animal.state === 'idle' || animal.state === 'walk' || animal.state === 'watch'));
    },
    get hunters() {
      return animals.filter((animal) => animal.hunter).length;
    },
    update(dt, player, { canHit, camera }) {
      clock += dt;
      if (!started) {
        started = true;
        for (const animal of animals) spawn(animal, player.position);
      }
      const playerSpeed = Math.hypot(player.velocity.x, player.velocity.z);
      for (const animal of animals) {
        if (animal.state === 'gone') {
          if (clock >= animal.respawnAt) spawn(animal, player.position);
          continue;
        }
        if (animal.spec.gentle) gentle(animal, player, playerSpeed, dt);
        else boar(animal, player, canHit, dt);
        place(animal, clock, dt, camera);
      }
    },
    standFor(animal, from) {
      const dx = from.x - animal.x;
      const dz = from.z - animal.z;
      const d = Math.hypot(dx, dz) || 1;
      const reach = Math.min(1.6, d);
      return { x: animal.x + (dx / d) * reach, z: animal.z + (dz / d) * reach };
    },
    reachable(animal, from) {
      return animal.state !== 'gone' && animal.state !== 'flee' && Math.hypot(animal.x - from.x, animal.z - from.z) <= HUNTING.catchRange;
    },
    freeze(animal) {
      animal.state = 'frozen';
      animal.speed = 0;
    },
    capture(animal) {
      vanish(animal);
      return gameId(animal.kind);
    },
    scare(animal, from) {
      flee(animal, from);
    },
    claim(hunter) {
      let best = null;
      let bestD = Infinity;
      for (const animal of animals) {
        if (!animal.spec.gentle || animal.hunter || animal.state === 'gone' || animal.state === 'flee' || animal.state === 'frozen') continue;
        const d = Math.hypot(animal.x - hunter.position.x, animal.z - hunter.position.z);
        if (d < bestD) {
          bestD = d;
          best = animal;
        }
      }
      if (best) {
        best.hunter = hunter;
        best.state = 'idle';
        best.speed = 0;
      }
      return best;
    },
    release(hunter) {
      for (const animal of animals) {
        if (animal.hunter !== hunter) continue;
        animal.hunter = null;
        if (animal.state === 'idle') animal.timer = between(1, 3);
      }
    },
  };
}
