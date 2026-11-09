import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';
import { FIREFLY } from './config.js';
import { between } from './random.js';

const GLOW = new THREE.Color(0xd9ff6a);
const FADE_RATE = 0.6;
const SAFE_SPAWN = 8;
const LAMP_FLIES = 6;

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const paint = (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  };
  paint(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, paint);
}

let sharedTexture = null;
const texture = () => (sharedTexture ??= glowTexture());

function glowPoints(count, size) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: texture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, positions, colors, geometry, material };
}

const blink = (t, fly) => {
  const wave = Math.sin(t * fly.rate + fly.phase);
  return 0.15 + 0.85 * Math.max(0, wave) ** 3;
};

export function createFireflies({ scene, zones, heightAt }) {
  const swarm = glowPoints(FIREFLY.count, 0.22);
  swarm.points.visible = false;
  scene.add(swarm.points);
  const totalArea = zones.reduce((sum, zone) => sum + zone.weight, 0);
  let shown = 0;

  function randomHome(avoid) {
    for (let tries = 0; tries < 12; tries++) {
      let pick = Math.random() * totalArea;
      const zone = zones.find((z) => (pick -= z.weight) <= 0) ?? zones[0];
      const x = between(zone.x0, zone.x1);
      const z = between(zone.z0, zone.z1);
      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < SAFE_SPAWN) continue;
      const ground = heightAt(x, z);
      if (ground == null) continue;
      return { x, y: ground + between(0.55, 1.5), z };
    }
    return null;
  }

  const flies = Array.from({ length: FIREFLY.count }, () => ({
    home: randomHome(null),
    rate: between(1.4, 3.2),
    phase: Math.random() * Math.PI * 2,
    drift: [between(0.2, 0.5), between(0.3, 0.7), between(0.2, 0.5)],
    reach: between(0.5, 1.2),
    respawnAt: 0,
    x: 0,
    y: 0,
    z: 0,
  }));

  return {
    update(t, dt, { night, player, catching }) {
      shown += ((night ? 1 : 0) - shown) * Math.min(1, dt * FADE_RATE * 3);
      swarm.points.visible = shown > 0.02;
      if (!swarm.points.visible) return 0;
      let caught = 0;
      const { positions, colors } = swarm;
      for (const [i, fly] of flies.entries()) {
        if (!fly.home && t >= fly.respawnAt) fly.home = randomHome(player);
        if (!fly.home) {
          colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
          continue;
        }
        const [a, b, c] = fly.drift;
        fly.x = fly.home.x + Math.sin(t * a + fly.phase) * fly.reach;
        fly.y = fly.home.y + Math.sin(t * b + fly.phase * 1.7) * 0.3;
        fly.z = fly.home.z + Math.cos(t * c + fly.phase * 0.6) * fly.reach;
        if (catching && night && Math.hypot(fly.x - player.x, fly.z - player.z) < FIREFLY.catchRadius && Math.abs(fly.y - (player.y + 0.8)) < 1.2) {
          caught += 1;
          fly.home = null;
          fly.respawnAt = t + between(...FIREFLY.respawn);
          colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
          continue;
        }
        positions[i * 3] = fly.x;
        positions[i * 3 + 1] = fly.y;
        positions[i * 3 + 2] = fly.z;
        const k = blink(t, fly) * shown;
        colors[i * 3] = GLOW.r * k;
        colors[i * 3 + 1] = GLOW.g * k;
        colors[i * 3 + 2] = GLOW.b * k;
      }
      swarm.geometry.attributes.position.needsUpdate = true;
      swarm.geometry.attributes.color.needsUpdate = true;
      return caught;
    },
  };
}

export function createFireflyLamp(scene) {
  const group = new THREE.Group();
  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.17, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  );
  jar.position.y = 0.085;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 14), new THREE.MeshBasicMaterial({ color: 0x6a4a2a }));
  lid.position.y = 0.18;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(), color: 0xd9ff6a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.7);
  halo.position.y = 0.09;
  const inside = glowPoints(LAMP_FLIES, 0.07);
  const flies = Array.from({ length: LAMP_FLIES }, () => ({ rate: between(1.6, 3), phase: Math.random() * Math.PI * 2, spin: between(0.6, 1.4), lift: between(0.03, 0.15) }));
  group.add(jar, lid, halo, inside.points);
  group.visible = false;
  scene.add(group);

  return {
    show(seat) {
      if (!seat) {
        group.visible = false;
        return;
      }
      const facing = seat.facing ?? Math.PI;
      group.position.set(seat.x + Math.sin(facing) * 0.42 + Math.cos(facing) * 0.18, 0.62, seat.z + Math.cos(facing) * 0.42 - Math.sin(facing) * 0.18);
      group.visible = true;
    },
    update(t) {
      if (!group.visible) return;
      let glow = 0;
      for (const [i, fly] of flies.entries()) {
        const a = t * fly.spin + fly.phase;
        inside.positions[i * 3] = Math.cos(a) * 0.045;
        inside.positions[i * 3 + 1] = fly.lift + Math.sin(a * 1.3) * 0.02;
        inside.positions[i * 3 + 2] = Math.sin(a) * 0.045;
        const k = blink(t, fly);
        glow += k;
        inside.colors[i * 3] = GLOW.r * k;
        inside.colors[i * 3 + 1] = GLOW.g * k;
        inside.colors[i * 3 + 2] = GLOW.b * k;
      }
      inside.geometry.attributes.position.needsUpdate = true;
      inside.geometry.attributes.color.needsUpdate = true;
      halo.material.opacity = 0.3 + (glow / LAMP_FLIES) * 0.5;
    },
  };
}
