import * as THREE from 'three';
import { Batch, freeze, shapes } from './toon.js';
import { makeRandom } from './random.js';
import { keepCanvas } from './canvasRestore.js';
import { minuteOfDay } from './clock.js';
import { BLESSING } from './config.js';
import { PLAZA } from './school.js';

const STONE = 0xb3ab99;
const STONE_DARK = 0x8a8273;
const STONE_LIGHT = 0xcfc6b2;
const BRONZE = 0x6e8577;
const BRONZE_DARK = 0x55695c;
const GILT = 0xc9a24a;
const SOIL = 0x5c3920;
const LEAVES = [0x4f9e40, 0x3a7d36, 0x5fae48];
const PETALS = [0xe8475f, 0xf28ab2, 0xf5d36a, 0xfaf3e6, 0xb07ad9, 0xf08a3c];
const PEDESTAL_TOP = 1.27;
const HEAD_Y = PEDESTAL_TOP + 2.62;
const RING_BED = { inner: 3, outer: 4 };
const CORNER_BEDS = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: sx * 8, z: sz * 5, hx: 3, hz: 1.8 })));
const EDGE_BEDS = [
  { x: -7.5, z: 8.4, hx: 5.2, hz: 0.45 },
  { x: 8.5, z: 8.4, hx: 5.2, hz: 0.45 },
];
const FADE = 3;
const VIEW_DISTANCE = 120;
const GLYPHS = ['文', '智', '福', '學', '道', '神', '靈', '光', '德', '明', '聖', '仁'];
const CROWN = { count: 8, radius: 1.25, height: HEAD_Y + 1.15, size: 0.62, spin: 0.35, bob: 0.12 };
const SKY = { count: 6, radius: 2.6, height: HEAD_Y + 2.3, size: 0.9, spin: -0.18, bob: 0.25 };
const PILLAR = { radius: 2.4, height: 11 };
const GROUND_RING = 6.5;
const SPARKS = 70;
const GOLD = 'rgba(255,214,110,1)';
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

function lotusPedestal(b) {
  b.add(shapes.box(4.2, 0.3, 4.2), STONE_DARK, { p: [0, 0.15, 0] });
  b.add(shapes.cylinder(1.9, 2, 0.35, 8), STONE, { p: [0, 0.475, 0], r: [0, Math.PI / 8, 0] });
  b.add(shapes.cylinder(1.05, 1.25, 0.5, 16), STONE_LIGHT, { p: [0, 0.9, 0] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(shapes.sphere(0.32, 8, 6), STONE_LIGHT, { p: [Math.cos(a) * 1.08, 1.12, Math.sin(a) * 1.08], s: [0.7, 0.45, 1], r: [0, -a, 0] });
  }
  b.add(shapes.cylinder(1.1, 1, 0.12, 16), STONE, { p: [0, PEDESTAL_TOP - 0.06, 0] });
}

function scholarDeity(b) {
  const y = PEDESTAL_TOP;
  b.add(shapes.cylinder(0.42, 0.8, 1.5, 16), BRONZE, { p: [0, y + 0.75, 0] });
  b.add(shapes.cylinder(0.82, 0.82, 0.08, 16), GILT, { p: [0, y + 0.04, 0] });
  b.add(shapes.cylinder(0.36, 0.42, 0.75, 14), BRONZE, { p: [0, y + 1.875, 0] });
  b.add(shapes.cylinder(0.44, 0.44, 0.1, 16), GILT, { p: [0, y + 1.55, 0] });
  b.add(shapes.box(0.08, 0.7, 0.04), GILT, { p: [0, y + 1.9, -0.37] });
  b.add(shapes.sphere(0.42, 14, 8), BRONZE, { p: [0, y + 2.2, 0], s: [1.25, 0.55, 0.9] });
  for (const s of [-1, 1]) {
    b.limb([s * 0.48, y + 2.15, 0], [s * 0.2, y + 1.78, -0.38], 0.15, BRONZE_DARK, { capsule: false, seg: 10, radiusEnd: 0.22 });
    b.add(shapes.cone(0.26, 0.5, 10), BRONZE_DARK, { p: [s * 0.3, y + 1.5, -0.32], r: [0.25, 0, 0] });
    b.add(shapes.sphere(0.09, 8, 6), BRONZE, { p: [s * 0.13, y + 1.8, -0.44] });
  }
  b.add(shapes.cylinder(0.07, 0.07, 0.72, 10), STONE_LIGHT, { p: [0, y + 1.82, -0.48], r: [0, 0, Math.PI / 2] });
  for (const s of [-1, 1]) b.add(shapes.cylinder(0.09, 0.09, 0.06, 10), GILT, { p: [s * 0.38, y + 1.82, -0.48], r: [0, 0, Math.PI / 2] });
  b.add(shapes.cylinder(0.12, 0.13, 0.18, 10), BRONZE, { p: [0, y + 2.4, 0] });
  b.add(shapes.sphere(0.27, 14, 10), BRONZE, { p: [0, y + 2.62, 0] });
  b.add(shapes.cone(0.13, 0.38, 8), BRONZE_DARK, { p: [0, y + 2.36, -0.17], r: [Math.PI, 0, 0] });
  b.add(shapes.cylinder(0.24, 0.27, 0.3, 14), BRONZE_DARK, { p: [0, y + 2.9, 0.02] });
  b.add(shapes.box(0.5, 0.22, 0.18), BRONZE_DARK, { p: [0, y + 2.98, 0.2] });
  b.add(shapes.box(0.36, 0.06, 0.06), GILT, { p: [0, y + 2.8, -0.24] });
  for (const s of [-1, 1]) b.add(shapes.box(0.5, 0.05, 0.16), BRONZE_DARK, { p: [s * 0.47, y + 2.95, 0.22], r: [0, 0, s * 0.12] });
  b.add(shapes.torus(0.5, 0.035, 28), GILT, { p: [0, HEAD_Y, 0.36] });
}

function sprinkle(b, rand, count, inside, spot) {
  for (let placed = 0, tries = 0; placed < count && tries < count * 6; tries++) {
    const p = spot(rand);
    if (!inside(p.x, p.z)) continue;
    placed++;
    b.add(shapes.ico(0.13 + rand() * 0.06, 0), LEAVES[Math.floor(rand() * LEAVES.length)], { p: [p.x, 0.2, p.z], s: [1, 0.7, 1], flat: true });
    b.add(shapes.sphere(0.08 + rand() * 0.05, 6, 4), PETALS[Math.floor(rand() * PETALS.length)], { p: [p.x + (rand() - 0.5) * 0.1, 0.32 + rand() * 0.08, p.z + (rand() - 0.5) * 0.1] });
  }
}

function ringBed(b, rand) {
  b.add(shapes.cylinder(RING_BED.outer, RING_BED.outer, 0.12, 40), SOIL, { p: [0, 0.06, 0] });
  for (const r of [RING_BED.inner, RING_BED.outer]) b.add(shapes.torus(r, 0.09, 48), STONE, { p: [0, 0.12, 0], r: [Math.PI / 2, 0, 0] });
  sprinkle(
    b,
    rand,
    90,
    (x, z) => Math.hypot(x, z) > RING_BED.inner + 0.2 && Math.hypot(x, z) < RING_BED.outer - 0.2,
    (r) => {
      const a = r() * Math.PI * 2;
      const d = RING_BED.inner + r() * (RING_BED.outer - RING_BED.inner);
      return { x: Math.cos(a) * d, z: Math.sin(a) * d };
    },
  );
}

function boxBed(b, rand, { x, z, hx, hz }) {
  b.add(shapes.box(hx * 2, 0.12, hz * 2), SOIL, { p: [x, 0.06, z] });
  for (const s of [-1, 1]) {
    b.add(shapes.box(hx * 2 + 0.2, 0.2, 0.1), STONE, { p: [x, 0.1, z + s * (hz + 0.05)] });
    b.add(shapes.box(0.1, 0.2, hz * 2), STONE, { p: [x + s * (hx + 0.05), 0.1, z] });
  }
  sprinkle(
    b,
    rand,
    Math.round(hx * hz * 6),
    () => true,
    (r) => ({ x: x + (r() * 2 - 1) * (hx - 0.15), z: z + (r() * 2 - 1) * (hz - 0.15) }),
  );
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

function paintGroundRing(ctx, size) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const wash = ctx.createRadialGradient(c, c, 0, c, c, c);
  wash.addColorStop(0, 'rgba(255,225,140,0.55)');
  wash.addColorStop(0.55, 'rgba(255,210,110,0.18)');
  wash.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = GOLD;
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = size * 0.012;
  for (const [r, w] of [
    [0.92, 0.006],
    [0.84, 0.003],
    [0.62, 0.004],
  ]) {
    ctx.lineWidth = size * w;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = GOLD;
  ctx.font = `${size * 0.05}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const count = 16;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    ctx.save();
    ctx.translate(c + Math.cos(a) * c * 0.73, c + Math.sin(a) * c * 0.73);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(GLYPHS[i % GLYPHS.length], 0, 0);
    ctx.restore();
  }
}

function paintPillar(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  const fade = ctx.createLinearGradient(0, height, 0, 0);
  fade.addColorStop(0, 'rgba(255,225,150,0.6)');
  fade.addColorStop(0.4, 'rgba(255,215,130,0.22)');
  fade.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height);
  const rays = 28;
  for (let i = 0; i < rays; i++) {
    const x = ((i + 0.5) / rays) * width;
    const reach = height * (i % 3 ? 0.6 : 0.95);
    const ray = ctx.createLinearGradient(0, height, 0, height - reach);
    ray.addColorStop(0, 'rgba(255,245,200,0.55)');
    ray.addColorStop(1, 'rgba(255,245,200,0)');
    ctx.fillStyle = ray;
    ctx.fillRect(x - width * 0.005, height - reach, width * 0.01, reach);
  }
}

function paintHalo(ctx, size) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createRadialGradient(c, c, 0, c, c, c);
  core.addColorStop(0, 'rgba(255,240,190,0.9)');
  core.addColorStop(0.3, 'rgba(255,220,140,0.45)');
  core.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  const rays = 16;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const length = c * (i % 2 ? 0.7 : 0.98);
    const ray = ctx.createRadialGradient(c, c, 0, c, c, length);
    ray.addColorStop(0, 'rgba(255,235,170,0.5)');
    ray.addColorStop(1, 'rgba(255,235,170,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a - 0.05) * length, c + Math.sin(a - 0.05) * length);
    ctx.lineTo(c + Math.cos(a + 0.05) * length, c + Math.sin(a + 0.05) * length);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paintGlyph(ctx, size, glyph) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,220,130,0.5)');
  glow.addColorStop(0.5, 'rgba(255,200,100,0.15)');
  glow.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = GOLD;
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = size * 0.1;
  ctx.font = `700 ${size * 0.58}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, c, c * 1.04);
}

function paintSpark(ctx, size) {
  const c = size / 2;
  const dot = ctx.createRadialGradient(c, c, 0, c, c, c);
  dot.addColorStop(0, 'rgba(255,250,220,1)');
  dot.addColorStop(0.4, 'rgba(255,220,140,0.5)');
  dot.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = dot;
  ctx.fillRect(0, 0, size, size);
}

const glowMaterial = (map, extra = {}) =>
  new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra });

function glyphOrbit({ count, radius, height, size }, offset) {
  const orbit = new THREE.Group();
  const items = Array.from({ length: count }, (_, i) => {
    const glyph = GLYPHS[(i + offset) % GLYPHS.length];
    const map = canvasTexture(128, 128, (ctx, w) => paintGlyph(ctx, w, glyph));
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const angle = (i / count) * Math.PI * 2;
    sprite.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    sprite.scale.setScalar(size);
    sprite.renderOrder = 4;
    orbit.add(sprite);
    return { sprite, phase: i * 1.3 + offset };
  });
  return { orbit, items };
}

function createAura() {
  const group = new THREE.Group();

  const ringMaterial = glowMaterial(canvasTexture(1024, 1024, (ctx, w) => paintGroundRing(ctx, w)));
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_RING * 2, GROUND_RING * 2), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.renderOrder = 2;
  const ringSpin = new THREE.Group();
  ringSpin.add(ring);

  const pillarMaterial = glowMaterial(canvasTexture(512, 256, paintPillar), { side: THREE.DoubleSide });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(PILLAR.radius, PILLAR.radius, PILLAR.height, 48, 1, true), pillarMaterial);
  pillar.position.y = PILLAR.height / 2;
  pillar.renderOrder = 3;

  const haloMaterial = new THREE.SpriteMaterial({ map: canvasTexture(256, 256, (ctx, w) => paintHalo(ctx, w)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Sprite(haloMaterial);
  halo.position.set(0, HEAD_Y, 0.4);
  halo.scale.setScalar(2.6);
  halo.renderOrder = 4;

  const crown = glyphOrbit(CROWN, 0);
  const sky = glyphOrbit(SKY, CROWN.count);

  const sparkData = Array.from({ length: SPARKS }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * PILLAR.radius, y: Math.random() * PILLAR.height, v: 0.5 + Math.random() * 0.9 }));
  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    map: canvasTexture(64, 64, (ctx, w) => paintSpark(ctx, w)),
    size: 0.28,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  sparks.renderOrder = 4;

  group.add(ringSpin, pillar, halo, crown.orbit, sky.orbit, sparks);
  group.visible = false;
  let clock = 0;

  return {
    group,
    update(dt, strength) {
      group.visible = strength > 0.01;
      if (!group.visible) return;
      clock += dt;
      const pulse = 0.85 + 0.15 * Math.sin(clock * 1.4);
      ringSpin.rotation.y += dt * 0.08;
      pillar.rotation.y -= dt * 0.05;
      ringMaterial.opacity = strength * pulse;
      pillarMaterial.opacity = strength * (0.7 + 0.3 * Math.sin(clock * 0.9));
      haloMaterial.opacity = strength * pulse;
      haloMaterial.rotation += dt * 0.15;
      for (const [orbit, spec, items] of [
        [crown.orbit, CROWN, crown.items],
        [sky.orbit, SKY, sky.items],
      ]) {
        orbit.rotation.y += dt * spec.spin;
        for (const { sprite, phase } of items) {
          sprite.position.y = spec.height + Math.sin(clock * 1.2 + phase) * spec.bob;
          sprite.material.opacity = strength * (0.75 + 0.25 * Math.sin(clock * 2 + phase));
        }
      }
      sparkData.forEach((spark, i) => {
        spark.y += dt * spark.v;
        if (spark.y > PILLAR.height) {
          spark.y = 0;
          spark.a = Math.random() * Math.PI * 2;
          spark.r = Math.random() * PILLAR.radius;
        }
        sparkPositions[i * 3] = Math.cos(spark.a + clock * 0.3) * spark.r;
        sparkPositions[i * 3 + 1] = spark.y;
        sparkPositions[i * 3 + 2] = Math.sin(spark.a + clock * 0.3) * spark.r;
      });
      sparkGeometry.attributes.position.needsUpdate = true;
      sparkMaterial.opacity = strength;
    },
  };
}

function strengthAt(minutes) {
  const m = minuteOfDay(minutes);
  const window = BLESSING.windows.find(([start, end]) => m >= start && m < end);
  if (!window) return 0;
  const [start, end] = window;
  return Math.min(1, (m - start) / FADE, (end - m) / FADE);
}

export function createBlessing(scene) {
  const rand = makeRandom(9091);
  const b = new Batch();
  lotusPedestal(b);
  scholarDeity(b);
  const flowers = new Batch();
  ringBed(flowers, rand);
  for (const bed of [...CORNER_BEDS, ...EDGE_BEDS]) boxBed(flowers, rand, bed);

  const statue = new THREE.Group();
  statue.position.set(PLAZA.x, 0, PLAZA.z);
  statue.add(flowers.mesh(), b.mesh());
  scene.add(statue);
  freeze(statue);

  const aura = createAura();
  aura.group.position.set(PLAZA.x, 0, PLAZA.z);
  scene.add(aura.group);

  const box = (x, z, hx, hz, maxY) => ({ minX: PLAZA.x + x - hx, maxX: PLAZA.x + x + hx, minZ: PLAZA.z + z - hz, maxZ: PLAZA.z + z + hz, minY: 0, maxY });
  const obstacles = [
    box(0, 0, 2.1, 2.1, HEAD_Y + 0.8),
    box(0, 0, RING_BED.outer + 0.1, RING_BED.outer + 0.1, 0.5),
    ...[...CORNER_BEDS, ...EDGE_BEDS].map((bed) => box(bed.x, bed.z, bed.hx + 0.1, bed.hz + 0.1, 0.5)),
  ];

  const active = (minutes) => strengthAt(minutes) > 0;
  const blessed = (position, minutes) => active(minutes) && Math.hypot(position.x - PLAZA.x, position.z - PLAZA.z) <= BLESSING.radius;

  return {
    obstacles,
    clickables: [statue],
    blessed,
    recoveryAt(position, minutes) {
      return blessed(position, minutes) ? BLESSING.recovery : 1;
    },
    update(dt, minutes, camera) {
      const near = camera.position.distanceTo(aura.group.position) < VIEW_DISTANCE;
      aura.update(dt, near ? strengthAt(minutes) : 0);
    },
  };
}
