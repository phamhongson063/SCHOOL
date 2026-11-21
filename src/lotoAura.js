import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';

const GLYPHS = '字福運夢光星月花風心幸縁';
const GLYPH_FONT = '"BIZ UDPGothic", "Hiragino Mincho ProN", "Yu Mincho", serif';
const DRIFT = { count: 14, life: 11, rise: 6.2, radius: [3.4, 5.8], size: [0.5, 0.85], spin: 0.07, sway: 0.35 };
const SPARK = { count: 90, half: [6.5, 3.6], low: 0.4, high: 7.5, size: 0.26 };
const POOL = { width: 6.8, depth: 3.2 };
const ORBIT_SQUASH = 0.62;
const RAYS = { count: 4, width: 0.7, height: 5.5, spin: 0.12 };

function texture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(map, (ctx) => paint(ctx, width, height));
}

function paintGlyph(ctx, size, glyph) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
  halo.addColorStop(0, 'rgba(255,214,120,0.5)');
  halo.addColorStop(0.5, 'rgba(255,190,90,0.14)');
  halo.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size * 0.56}px ${GLYPH_FONT}`;
  ctx.shadowColor = 'rgba(255,200,90,1)';
  ctx.shadowBlur = size * 0.1;
  ctx.fillStyle = 'rgba(255,236,170,1)';
  ctx.fillText(glyph, c, c + size * 0.03);
}

function paintDot(ctx, size) {
  const c = size / 2;
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
}

function paintPool(ctx, width, height) {
  const glow = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
  glow.addColorStop(0, 'rgba(255,200,110,0.9)');
  glow.addColorStop(0.45, 'rgba(255,170,80,0.35)');
  glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function paintRay(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  const across = ctx.createLinearGradient(0, 0, width, 0);
  across.addColorStop(0, 'rgba(255,220,150,0)');
  across.addColorStop(0.5, 'rgba(255,230,170,1)');
  across.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  const along = ctx.createLinearGradient(0, height, 0, 0);
  along.addColorStop(0, 'rgba(0,0,0,0.85)');
  along.addColorStop(0.3, 'rgba(0,0,0,0.35)');
  along.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

const additive = (map, extra = {}) => ({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra });

export function createLotoAura({ pearl }) {
  const group = new THREE.Group();

  const glyphs = Array.from({ length: DRIFT.count }, (_, i) => {
    const glyph = GLYPHS[i % GLYPHS.length];
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial(additive(texture(128, 128, (ctx, w) => paintGlyph(ctx, w, glyph)))));
    sprite.renderOrder = 4;
    group.add(sprite);
    return {
      sprite,
      phase: i / DRIFT.count,
      angle: (i / DRIFT.count) * Math.PI * 2 + Math.random() * 0.4,
      radius: DRIFT.radius[0] + Math.random() * (DRIFT.radius[1] - DRIFT.radius[0]),
      size: DRIFT.size[0] + Math.random() * (DRIFT.size[1] - DRIFT.size[0]),
    };
  });

  const seeds = Array.from({ length: SPARK.count }, () => ({
    x: (Math.random() * 2 - 1) * SPARK.half[0],
    y: SPARK.low + Math.random() * (SPARK.high - SPARK.low),
    z: (Math.random() * 2 - 1) * SPARK.half[1],
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.8,
    warm: Math.random(),
  }));
  const positions = new Float32Array(SPARK.count * 3);
  const colors = new Float32Array(SPARK.count * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sparkMaterial = new THREE.PointsMaterial(additive(texture(64, 64, (ctx, w) => paintDot(ctx, w)), { size: SPARK.size, sizeAttenuation: true, vertexColors: true }));
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  sparks.renderOrder = 4;
  group.add(sparks);

  const poolMaterial = new THREE.MeshBasicMaterial(additive(texture(256, 256, paintPool)));
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(POOL.width, POOL.depth), poolMaterial);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.03;
  pool.renderOrder = 2;
  group.add(pool);

  const rayMaterial = new THREE.MeshBasicMaterial(additive(texture(64, 256, paintRay), { side: THREE.DoubleSide }));
  const rays = new THREE.Group();
  rays.position.y = pearl;
  for (let i = 0; i < RAYS.count; i++) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(RAYS.width, RAYS.height), rayMaterial);
    ray.position.y = RAYS.height / 2;
    ray.renderOrder = 3;
    ray.raycast = () => {};
    const pivot = new THREE.Group();
    pivot.rotation.set(0, (i / RAYS.count) * Math.PI, (i % 2 ? 1 : -1) * 0.12 * (1 + (i % 3)));
    pivot.add(ray);
    rays.add(pivot);
  }
  group.add(rays);

  for (const node of [sparks, pool]) node.raycast = () => {};
  for (const { sprite } of glyphs) sprite.raycast = () => {};

  const tint = new THREE.Color();
  const gold = new THREE.Color(0xffd27a);
  const rose = new THREE.Color(0xffb0c8);

  return {
    group,
    update(t, night) {
      const strength = 0.12 + 0.88 * night;
      for (const glyph of glyphs) {
        const life = (t / DRIFT.life + glyph.phase) % 1;
        const angle = glyph.angle + t * DRIFT.spin;
        const radius = glyph.radius + Math.sin(t * 0.7 + glyph.angle * 3) * DRIFT.sway;
        glyph.sprite.position.set(Math.cos(angle) * radius, 0.6 + life * DRIFT.rise, Math.sin(angle) * radius * ORBIT_SQUASH);
        glyph.sprite.scale.setScalar(glyph.size * (0.8 + 0.4 * life));
        glyph.sprite.material.opacity = strength * Math.sin(Math.PI * life) ** 1.5;
      }
      seeds.forEach((seed, i) => {
        positions[i * 3] = seed.x + Math.sin(t * 0.3 * seed.speed + seed.phase) * 0.6;
        positions[i * 3 + 1] = seed.y + Math.sin(t * 0.5 * seed.speed + seed.phase * 2) * 0.45;
        positions[i * 3 + 2] = seed.z + Math.cos(t * 0.25 * seed.speed + seed.phase) * 0.5;
        const twinkle = Math.max(0, Math.sin(t * 2.4 * seed.speed + seed.phase)) ** 2;
        tint.copy(gold).lerp(rose, seed.warm * 0.5).multiplyScalar(night * (0.25 + 0.75 * twinkle));
        tint.toArray(colors, i * 3);
      });
      sparkGeometry.attributes.position.needsUpdate = true;
      sparkGeometry.attributes.color.needsUpdate = true;
      sparks.visible = night > 0.02;
      poolMaterial.opacity = night * (0.5 + 0.08 * Math.sin(t * 1.3));
      pool.visible = night > 0.02;
      rays.rotation.y = t * RAYS.spin;
      rayMaterial.opacity = night * (0.35 + 0.15 * Math.sin(t * 1.1));
      rays.visible = night > 0.02;
    },
  };
}

const COURT_LIGHT = { pixels: 28, reach: 0.8, lift: 0.025, strength: 0.85 };

function paintCourtLight(ctx, width, height, spots, bounds) {
  const scale = width / (bounds.x1 - bounds.x0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  for (const { position, size } of spots) {
    const x = (position.x - bounds.x0) * scale;
    const y = (position.z - bounds.z0) * scale;
    const r = size * COURT_LIGHT.reach * scale;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, 'rgba(255,196,120,0.55)');
    glow.addColorStop(0.5, 'rgba(255,170,90,0.22)');
    glow.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function surfaceGeometry({ x0, x1, z0, z1, y, y1 = null }, bounds) {
  const w = bounds.x1 - bounds.x0;
  const d = bounds.z1 - bounds.z0;
  const uvOf = (x, z) => [(x - bounds.x0) / w, 1 - (z - bounds.z0) / d];
  const corners =
    y1 === null
      ? [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]
      : [[x0, y, z0], [x1, y, z0], [x1, y1, z0], [x0, y1, z0]];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(corners.flatMap(([x, , z]) => uvOf(x, z)), 2));
  geometry.setIndex(y1 === null ? [0, 3, 2, 0, 2, 1] : [0, 1, 2, 0, 2, 3]);
  return geometry;
}

export function createCourtLight({ spots, surfaces, bounds }) {
  const width = Math.round((bounds.x1 - bounds.x0) * COURT_LIGHT.pixels);
  const height = Math.round((bounds.z1 - bounds.z0) * COURT_LIGHT.pixels);
  const map = texture(width, height, (ctx, w, h) => paintCourtLight(ctx, w, h, spots, bounds));
  const material = new THREE.MeshBasicMaterial(additive(map, { opacity: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const group = new THREE.Group();
  for (const surface of surfaces) {
    const mesh = new THREE.Mesh(surfaceGeometry({ ...surface, y: surface.y + (surface.y1 === undefined ? COURT_LIGHT.lift : 0) }, bounds), material);
    mesh.renderOrder = 2;
    mesh.raycast = () => {};
    group.add(mesh);
  }
  return {
    group,
    update(night) {
      material.opacity = night * COURT_LIGHT.strength;
      group.visible = night > 0.02;
    },
  };
}
