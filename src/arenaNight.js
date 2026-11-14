import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';
import { createLanternGlow } from './lanternGlow.js';

const DESK_LIGHT = { color: 0xffc98a, intensity: 16, distance: 9, height: 2.6, ahead: 0.7 };
const POOL = { radius: 1.25, y: 0.08, color: 0xffc070, strength: 0.4, below: 1.5 };

function paintPool(ctx, size) {
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

function poolTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paintPool(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paintPool(ctx, size));
}

export function createArenaNight({ lights, desk, toWorld, layer }) {
  const group = new THREE.Group();
  const deskAt = toWorld({ x: desk.x, z: desk.z + DESK_LIGHT.ahead });
  const lamp = new THREE.PointLight(DESK_LIGHT.color, 0, DESK_LIGHT.distance, 2);
  lamp.position.set(deskAt.x, DESK_LIGHT.height, deskAt.z);

  const glow = createLanternGlow(lights.map(({ position, tint }) => {
    const at = toWorld(position);
    return { position: new THREE.Vector3(at.x, position.y, at.z), tint };
  }));

  const poolMaterial = new THREE.MeshBasicMaterial({
    map: poolTexture(),
    color: POOL.color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const poolShape = new THREE.PlaneGeometry(POOL.radius * 2, POOL.radius * 2).rotateX(-Math.PI / 2);
  const pools = lights
    .filter(({ position }) => position.y < POOL.below)
    .map(({ position }) => {
      const at = toWorld(position);
      const mesh = new THREE.Mesh(poolShape, poolMaterial);
      mesh.position.set(at.x, POOL.y, at.z);
      mesh.renderOrder = layer;
      return mesh;
    });

  group.add(lamp, glow.object, ...pools);
  let night = 0;

  return {
    group,
    update(t) {
      glow.update(t, night);
      if (night <= 0) return;
      const flicker = 0.93 + 0.04 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 5.7 + 1.3);
      lamp.intensity = night * DESK_LIGHT.intensity * flicker;
    },
    setNight(k) {
      night = Math.min(1, Math.max(0, k));
      lamp.intensity = night * DESK_LIGHT.intensity;
      poolMaterial.opacity = night * POOL.strength;
      for (const pool of pools) pool.visible = night > 0.02;
    },
  };
}
