import * as THREE from 'three';

const FLIGHT = 0.45;
const BURST = 0.45;
const ARC = 0.9;
const CHEST = 1.15;

const orbGeometry = new THREE.SphereGeometry(0.2, 14, 10);
const ringGeometry = new THREE.TorusGeometry(0.5, 0.06, 8, 32);
const flashGeometry = new THREE.SphereGeometry(0.35, 14, 10);

const glow = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

export function createArenaFx(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const live = [];

  function remove(effect) {
    for (const mesh of effect.meshes) {
      root.remove(mesh);
      mesh.material.dispose();
    }
  }

  return {
    cast(from, to, color, power = 1) {
      const start = new THREE.Vector3(from.x, from.y + CHEST, from.z);
      const end = new THREE.Vector3(to.x, to.y + CHEST, to.z);
      const orb = new THREE.Mesh(orbGeometry, glow(color, 0.95));
      orb.scale.setScalar(power);
      const ring = new THREE.Mesh(ringGeometry, glow(color, 0.9));
      ring.position.copy(end);
      ring.lookAt(start);
      ring.visible = false;
      const flash = new THREE.Mesh(flashGeometry, glow(0xffffff, 0.8));
      flash.position.copy(end);
      flash.visible = false;
      root.add(orb, ring, flash);
      live.push({ start, end, orb, ring, flash, power, age: 0, meshes: [orb, ring, flash] });
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const effect = live[i];
        effect.age += dt;
        const { orb, ring, flash, power } = effect;
        if (effect.age < FLIGHT) {
          const k = effect.age / FLIGHT;
          orb.position.lerpVectors(effect.start, effect.end, k);
          orb.position.y += Math.sin(k * Math.PI) * ARC;
          continue;
        }
        orb.visible = false;
        const k = (effect.age - FLIGHT) / BURST;
        if (k >= 1) {
          remove(effect);
          live.splice(i, 1);
          continue;
        }
        ring.visible = true;
        flash.visible = true;
        ring.scale.setScalar((0.4 + k * 1.6) * power);
        ring.material.opacity = 0.9 * (1 - k);
        flash.scale.setScalar((0.6 + k * 0.8) * power);
        flash.material.opacity = 0.8 * (1 - k) * (1 - k);
      }
    },
  };
}
