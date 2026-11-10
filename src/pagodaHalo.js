import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';

const GOLD = 'rgba(255,214,110,1)';
const RING = { inner: 4.3, outer: 5.5, symbols: 8, spin: 0.06 };
const AURA = { radius: 4.9, height: 4.2, spin: -0.04 };
const ORBIT = { count: 6, radius: 4.1, height: 2.9, size: 0.85, spin: 0.22, bob: 0.18 };
const VIEW_DISTANCE = 110;

function strokeManji(ctx, cx, cy, arm, width) {
  ctx.lineWidth = width;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - arm);
  ctx.lineTo(cx - arm, cy - arm);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.lineTo(cx + arm, cy - arm);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + arm);
  ctx.lineTo(cx + arm, cy + arm);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - arm, cy);
  ctx.lineTo(cx - arm, cy + arm);
  ctx.stroke();
}

function paintRing(ctx, size) {
  const c = size / 2;
  const scale = c / RING.outer;
  const inner = RING.inner * scale;
  const outer = RING.outer * scale;
  const mid = (inner + outer) / 2;
  ctx.clearRect(0, 0, size, size);
  const band = ctx.createRadialGradient(c, c, inner * 0.92, c, c, outer);
  band.addColorStop(0, 'rgba(255,200,90,0)');
  band.addColorStop(0.5, 'rgba(255,205,100,0.35)');
  band.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.arc(c, c, outer, 0, Math.PI * 2);
  ctx.arc(c, c, inner * 0.92, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = size * 0.012;
  for (const r of [inner + 2, outer - 2]) {
    ctx.lineWidth = size * 0.005;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const arm = (outer - inner) * 0.26;
  for (let i = 0; i < RING.symbols; i++) {
    const angle = (i / RING.symbols) * Math.PI * 2;
    ctx.save();
    ctx.translate(c + Math.cos(angle) * mid, c + Math.sin(angle) * mid);
    ctx.rotate(angle + Math.PI / 2);
    strokeManji(ctx, 0, 0, arm, arm * 0.36);
    ctx.restore();
  }
  for (let i = 0; i < RING.symbols; i++) {
    const angle = ((i + 0.5) / RING.symbols) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(c + Math.cos(angle) * mid, c + Math.sin(angle) * mid, arm * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
  }
}

function paintAura(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  const fade = ctx.createLinearGradient(0, height, 0, 0);
  fade.addColorStop(0, 'rgba(255,210,110,0.55)');
  fade.addColorStop(0.35, 'rgba(255,205,105,0.22)');
  fade.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height);
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    const x = ((i + 0.5) / rays) * width;
    const reach = height * (i % 2 ? 0.55 : 0.85);
    const ray = ctx.createLinearGradient(0, height, 0, height - reach);
    ray.addColorStop(0, 'rgba(255,235,170,0.5)');
    ray.addColorStop(1, 'rgba(255,235,170,0)');
    ctx.fillStyle = ray;
    ctx.fillRect(x - width * 0.006, height - reach, width * 0.012, reach);
  }
}

function paintSymbol(ctx, size) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,220,130,0.55)');
  glow.addColorStop(0.45, 'rgba(255,200,100,0.18)');
  glow.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = GOLD;
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = size * 0.08;
  strokeManji(ctx, c, c, size * 0.2, size * 0.075);
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paint(ctx, width, height));
}

const glowMaterial = (map, extra = {}) =>
  new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra });

export function createPagodaHalo({ x, z, ground }) {
  const group = new THREE.Group();
  group.position.set(x, ground, z);

  const ringMaterial = glowMaterial(canvasTexture(1024, 1024, (ctx, w) => paintRing(ctx, w)));
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(RING.outer * 2, RING.outer * 2), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  ring.renderOrder = 2;
  const ringSpin = new THREE.Group();
  ringSpin.add(ring);

  const auraMaterial = glowMaterial(canvasTexture(512, 128, paintAura), { side: THREE.DoubleSide });
  const aura = new THREE.Mesh(new THREE.CylinderGeometry(AURA.radius, AURA.radius, AURA.height, 48, 1, true), auraMaterial);
  aura.position.y = AURA.height / 2;
  aura.renderOrder = 2;

  const symbolMap = canvasTexture(128, 128, (ctx, w) => paintSymbol(ctx, w));
  const orbit = new THREE.Group();
  const symbols = Array.from({ length: ORBIT.count }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: symbolMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const angle = (i / ORBIT.count) * Math.PI * 2;
    sprite.position.set(Math.cos(angle) * ORBIT.radius, ORBIT.height, Math.sin(angle) * ORBIT.radius);
    sprite.scale.setScalar(ORBIT.size);
    sprite.renderOrder = 3;
    orbit.add(sprite);
    return { sprite, phase: i * 1.7 };
  });

  group.add(ringSpin, aura, orbit);
  let clock = 0;

  return {
    group,
    update(dt, { camera, night }) {
      group.visible = camera.position.distanceTo(group.position) < VIEW_DISTANCE;
      if (!group.visible) return;
      clock += dt;
      const strength = 0.55 + 0.45 * night;
      const pulse = 0.85 + 0.15 * Math.sin(clock * 1.3);
      ringSpin.rotation.y += dt * RING.spin;
      aura.rotation.y += dt * AURA.spin;
      orbit.rotation.y += dt * ORBIT.spin;
      ringMaterial.opacity = strength * pulse;
      auraMaterial.opacity = strength * (0.75 + 0.25 * Math.sin(clock * 0.9));
      for (const { sprite, phase } of symbols) {
        sprite.position.y = ORBIT.height + Math.sin(clock * 1.1 + phase) * ORBIT.bob;
        sprite.material.opacity = strength * (0.8 + 0.2 * Math.sin(clock * 2 + phase));
      }
    },
  };
}
