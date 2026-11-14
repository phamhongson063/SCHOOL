import * as THREE from 'three';

const FLIGHT = 0.45;
const BURST = 0.45;
const ARC = 0.9;
const CHEST = 1.15;

const orbGeometry = new THREE.SphereGeometry(0.2, 14, 10);
const ringGeometry = new THREE.TorusGeometry(0.5, 0.06, 8, 32);
const flashGeometry = new THREE.SphereGeometry(0.35, 14, 10);

const glow = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
const columnGeometry = new THREE.CylinderGeometry(0.55, 0.85, 1, 24, 1, true);
const floorRing = new THREE.RingGeometry(0.6, 0.9, 40);
const WARP = { rise: 0.25, fade: 0.9, height: 7 };
const LABEL = { life: 1.5, rise: 0.9, head: 2.15, width: 2.6, height: 0.65 };
const SHIELD = { life: 0.55 };
const shieldGeometry = new THREE.SphereGeometry(0.85, 20, 14);

function labelTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 58px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(10, 4, 20, 0.45)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, 256, 64, 496);
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 0;
  ctx.fillText(text, 256, 64, 496);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

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

  const beams = [];
  const labels = [];
  const shields = [];

  return {
    beam(at, color = 0xbfe8ff, size = 1) {
      const column = new THREE.Mesh(columnGeometry, glow(color, 0.7));
      column.material.side = THREE.DoubleSide;
      column.position.set(at.x, at.y, at.z);
      const ring = new THREE.Mesh(floorRing, glow(color, 0.9));
      ring.material.side = THREE.DoubleSide;
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(at.x, at.y + 0.05, at.z);
      root.add(column, ring);
      beams.push({ column, ring, size, age: 0, meshes: [column, ring] });
    },
    label(at, text, { color = '#ffffff', delay = 0, lift = 0, size = 1 } = {}) {
      const map = labelTexture(text, color);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false }));
      sprite.renderOrder = 10;
      sprite.visible = false;
      root.add(sprite);
      labels.push({ sprite, map, base: new THREE.Vector3(at.x, at.y + LABEL.head + lift, at.z), size, age: -delay });
    },
    shield(at, delay = 0) {
      const mesh = new THREE.Mesh(shieldGeometry, glow(0x9ad8ff, 0.5));
      mesh.position.set(at.x, at.y + CHEST, at.z);
      mesh.visible = false;
      root.add(mesh);
      shields.push({ mesh, age: -delay, meshes: [mesh] });
    },
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
      for (let i = labels.length - 1; i >= 0; i--) {
        const item = labels[i];
        item.age += dt;
        const { sprite } = item;
        if (item.age < 0) continue;
        const k = item.age / LABEL.life;
        if (k >= 1) {
          root.remove(sprite);
          sprite.material.dispose();
          item.map.dispose();
          labels.splice(i, 1);
          continue;
        }
        sprite.visible = true;
        const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.22 ? 1.15 - ((k - 0.12) / 0.1) * 0.15 : 1;
        sprite.scale.set(LABEL.width * item.size * pop, LABEL.height * item.size * pop, 1);
        sprite.position.copy(item.base);
        sprite.position.y += LABEL.rise * Math.sqrt(k);
        sprite.material.opacity = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      }
      for (let i = shields.length - 1; i >= 0; i--) {
        const item = shields[i];
        item.age += dt;
        if (item.age < 0) continue;
        const k = item.age / SHIELD.life;
        if (k >= 1) {
          remove(item);
          shields.splice(i, 1);
          continue;
        }
        item.mesh.visible = true;
        item.mesh.scale.setScalar(0.8 + k * 0.4);
        item.mesh.material.opacity = 0.5 * (1 - k);
      }
      for (let i = beams.length - 1; i >= 0; i--) {
        const beam = beams[i];
        beam.age += dt;
        const { column, ring, size } = beam;
        const height = WARP.height * size;
        const grow = Math.min(1, beam.age / WARP.rise);
        const fade = Math.max(0, (beam.age - WARP.rise) / WARP.fade);
        if (fade >= 1) {
          remove(beam);
          beams.splice(i, 1);
          continue;
        }
        column.scale.set(size * (1 - fade * 0.6), height * grow, size * (1 - fade * 0.6));
        column.position.y = ring.position.y - 0.05 + (height * grow) / 2;
        column.material.opacity = 0.7 * (1 - fade);
        ring.scale.setScalar(size * (1 + beam.age * 2.2));
        ring.material.opacity = 0.9 * (1 - fade);
      }
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
