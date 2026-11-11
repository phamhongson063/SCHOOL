import * as THREE from 'three';
import { Batch, freeze, shapes } from './toon.js';
import { makeRandom } from './random.js';
import { keepCanvas } from './canvasRestore.js';
import { clockText, dayOf, minuteOfDay } from './clock.js';
import { BLESSING } from './config.js';
import { PLAZA } from './school.js';
import { ROAD } from './road.js';
import { keeperNPC } from './village.js';

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
const BURST = { y: PEDESTAL_TOP + 1.7, size: 13, glow: 6.5, spin: 0.035 };
const GROUND_RING = 6.5;
const SPARKS = 60;
const SPARK_REACH = 7.5;
const FLOOR_RAYS = { x: 13.5, z: 9.5 };
const AURA_GOLD = 0xffd36e;
const AURA_CYCLE = 0.08;
const OFFICIAL = { x: PLAZA.x + 3, z: ROAD.z1 + 1.6, facing: Math.PI, model: 'scholar-ink', reach: 1.3, spots: [-0.9, 0, 0.9] };
const OFFICIAL_LOOK = { shirt: 0x7a1f1a, pants: 0x2a2320, skin: 0xd9a479, style: 'khan', khan: 0x1f1e26, hairColor: 0x4a4440, beardColor: 0xdedad2, iris: 0x3a2214 };
const OFFICIAL_DISTANCE = 60;
const OFFICIAL_LINES = ['Ngươi muốn nhận chúc phúc à?', 'Lại đây ta xem nào.', 'Chăm học thì thần linh phù hộ.'];
const LIGHT = 'rgba(255,255,255,1)';
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
  wash.addColorStop(0, 'rgba(255,255,255,0.3)');
  wash.addColorStop(0.55, 'rgba(255,255,255,0.1)');
  wash.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = LIGHT;
  ctx.shadowColor = LIGHT;
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
  ctx.fillStyle = LIGHT;
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

function paintBurst(ctx, size, rays, seed) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  const rand = makeRandom(seed);
  for (let i = 0; i < rays; i++) {
    const a = ((i + rand() * 0.6) / rays) * Math.PI * 2;
    const length = c * (0.45 + rand() * 0.55);
    const half = 0.006 + rand() * 0.012;
    const ray = ctx.createRadialGradient(c, c, c * 0.08, c, c, length);
    ray.addColorStop(0, 'rgba(255,255,255,0.32)');
    ray.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    ray.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a - half) * length, c + Math.sin(a - half) * length);
    ctx.lineTo(c + Math.cos(a + half) * length, c + Math.sin(a + half) * length);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paintGlow(ctx, size) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,255,0.28)');
  glow.addColorStop(0.35, 'rgba(255,255,255,0.1)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
}

function paintHalo(ctx, size) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createRadialGradient(c, c, 0, c, c, c);
  core.addColorStop(0, 'rgba(255,255,255,0.5)');
  core.addColorStop(0.3, 'rgba(255,255,255,0.2)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  const rays = 16;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const length = c * (i % 2 ? 0.7 : 0.98);
    const ray = ctx.createRadialGradient(c, c, 0, c, c, length);
    ray.addColorStop(0, 'rgba(255,255,255,0.3)');
    ray.addColorStop(1, 'rgba(255,255,255,0)');
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
  glow.addColorStop(0, 'rgba(255,255,255,0.5)');
  glow.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = LIGHT;
  ctx.shadowColor = LIGHT;
  ctx.shadowBlur = size * 0.1;
  ctx.font = `700 ${size * 0.58}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, c, c * 1.04);
}

function paintSpark(ctx, size) {
  const c = size / 2;
  const dot = ctx.createRadialGradient(c, c, 0, c, c, c);
  dot.addColorStop(0, 'rgba(255,255,255,1)');
  dot.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  dot.addColorStop(1, 'rgba(255,255,255,0)');
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

function paintFloorRays(ctx, size) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const wash = ctx.createRadialGradient(c, c, 0, c, c, c);
  wash.addColorStop(0, 'rgba(255,255,255,0.22)');
  wash.addColorStop(0.4, 'rgba(255,255,255,0.07)');
  wash.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  const rand = makeRandom(91);
  const rays = 30;
  for (let i = 0; i < rays; i++) {
    const a = ((i + rand() * 0.5) / rays) * Math.PI * 2;
    const half = 0.025 + rand() * 0.03;
    const ray = ctx.createRadialGradient(c, c, c * 0.15, c, c, c);
    ray.addColorStop(0, 'rgba(255,255,255,0.2)');
    ray.addColorStop(0.6, 'rgba(255,255,255,0.07)');
    ray.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a - half) * c, c + Math.sin(a - half) * c);
    ctx.lineTo(c + Math.cos(a + half) * c, c + Math.sin(a + half) * c);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function burstSprite(rays, seed) {
  const material = new THREE.SpriteMaterial({ map: canvasTexture(512, 512, (ctx, w) => paintBurst(ctx, w, rays, seed)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(material);
  sprite.position.y = BURST.y;
  sprite.scale.setScalar(BURST.size);
  sprite.renderOrder = 3;
  return sprite;
}

const lerp = (a, b, k) => a + (b - a) * k;

function createAura() {
  const group = new THREE.Group();
  const gold = new THREE.Color(AURA_GOLD);
  const hue = new THREE.Color();
  const tint = (color, k, shift) => color.copy(gold).lerp(hue.setHSL((((shift % 1) + 1) % 1), 0.9, 0.62), k);

  const ringMaterial = glowMaterial(canvasTexture(1024, 1024, (ctx, w) => paintGroundRing(ctx, w)));
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_RING * 2, GROUND_RING * 2), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.renderOrder = 2;
  const ringSpin = new THREE.Group();
  ringSpin.add(ring);

  const floorMap = canvasTexture(1024, 1024, (ctx, w) => paintFloorRays(ctx, w));
  floorMap.center.set(0.5, 0.5);
  const floorMaterial = glowMaterial(floorMap);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_RAYS.x * 2, FLOOR_RAYS.z * 2), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.07;
  floor.renderOrder = 2;

  const glowSpriteMaterial = new THREE.SpriteMaterial({ map: canvasTexture(256, 256, (ctx, w) => paintGlow(ctx, w)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowSpriteMaterial);
  glow.position.y = BURST.y;
  glow.scale.setScalar(BURST.glow);
  glow.renderOrder = 3;
  const bursts = [burstSprite(40, 17), burstSprite(28, 53)];
  bursts[1].scale.setScalar(BURST.size * 0.8);

  const haloMaterial = new THREE.SpriteMaterial({ map: canvasTexture(256, 256, (ctx, w) => paintHalo(ctx, w)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Sprite(haloMaterial);
  halo.position.set(0, HEAD_Y, 0.4);
  halo.scale.setScalar(2.2);
  halo.renderOrder = 4;

  const crown = glyphOrbit(CROWN, 0);
  const sky = glyphOrbit(SKY, CROWN.count);

  const launch = (spark, distance) => {
    const heading = Math.random() * Math.PI * 2;
    const rise = -0.15 + Math.random() * 1.3;
    spark.dx = Math.cos(rise) * Math.cos(heading);
    spark.dy = Math.sin(rise);
    spark.dz = Math.cos(rise) * Math.sin(heading);
    spark.d = distance;
    spark.v = 0.6 + Math.random() * 0.8;
    spark.hue = Math.random();
    return spark;
  };
  const sparkData = Array.from({ length: SPARKS }, () => launch({}, Math.random() * SPARK_REACH));
  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkColors = new Float32Array(SPARKS * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    map: canvasTexture(64, 64, (ctx, w) => paintSpark(ctx, w)),
    size: 0.22,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  sparks.renderOrder = 4;

  group.add(floor, ringSpin, glow, ...bursts, halo, crown.orbit, sky.orbit, sparks);
  group.visible = false;
  let clock = 0;
  const color = new THREE.Color();

  return {
    group,
    update(dt, visible, k) {
      group.visible = visible;
      if (!visible) return;
      clock += dt;
      const cycle = clock * AURA_CYCLE;
      const pulse = 0.85 + 0.15 * Math.sin(clock * 1.4);
      const level = (idle, blessed) => lerp(idle, blessed, k);
      ringSpin.rotation.y += dt * 0.08;
      floorMap.rotation += dt * 0.03;
      ringMaterial.opacity = level(0.45, 0.8) * pulse;
      tint(ringMaterial.color, k, cycle + 0.5);
      floorMaterial.opacity = level(0.75, 1) * (0.85 + 0.15 * Math.sin(clock * 0.7));
      tint(floorMaterial.color, k, cycle + 0.25);
      glowSpriteMaterial.opacity = level(0.85, 1) * pulse;
      tint(glowSpriteMaterial.color, k, cycle);
      bursts[0].material.rotation += dt * BURST.spin;
      bursts[1].material.rotation -= dt * BURST.spin * 1.4;
      bursts.forEach((burst, i) => {
        burst.material.opacity = level(0.7, 1) * (0.75 + 0.25 * Math.sin(clock * 0.8 + i * 2));
        tint(burst.material.color, k, cycle + i * 0.33);
      });
      haloMaterial.opacity = level(0.85, 1) * pulse;
      haloMaterial.rotation += dt * 0.15;
      tint(haloMaterial.color, k, cycle + 0.66);
      for (const [orbit, spec, items] of [
        [crown.orbit, CROWN, crown.items],
        [sky.orbit, SKY, sky.items],
      ]) {
        orbit.visible = k > 0.01;
        orbit.rotation.y += dt * spec.spin;
        if (!orbit.visible) continue;
        items.forEach(({ sprite, phase }, i) => {
          sprite.position.y = spec.height + Math.sin(clock * 1.2 + phase) * spec.bob;
          sprite.material.opacity = k * (0.45 + 0.2 * Math.sin(clock * 2 + phase));
          tint(sprite.material.color, k, cycle + i / items.length);
        });
      }
      const sparkLevel = level(0.55, 1);
      sparkData.forEach((spark, i) => {
        spark.d += dt * spark.v;
        if (spark.d > SPARK_REACH) launch(spark, 0.4);
        const fade = Math.sin((spark.d / SPARK_REACH) * Math.PI) * sparkLevel;
        sparkPositions[i * 3] = spark.dx * spark.d;
        sparkPositions[i * 3 + 1] = BURST.y + spark.dy * spark.d;
        sparkPositions[i * 3 + 2] = spark.dz * spark.d;
        tint(color, k, cycle + spark.hue);
        sparkColors[i * 3] = color.r * fade;
        sparkColors[i * 3 + 1] = color.g * fade;
        sparkColors[i * 3 + 2] = color.b * fade;
      });
      sparkGeometry.attributes.position.needsUpdate = true;
      sparkGeometry.attributes.color.needsUpdate = true;
    },
  };
}

const windowIndexAt = (minutes) => {
  const m = minuteOfDay(minutes);
  return BLESSING.windows.findIndex(([start, end]) => m >= start && m < end);
};

function strengthAt(minutes) {
  const index = windowIndexAt(minutes);
  if (index < 0) return 0;
  const m = minuteOfDay(minutes);
  const [start, end] = BLESSING.windows[index];
  return Math.min(1, (m - start) / FADE, (end - m) / FADE);
}

function sessionAt(minutes) {
  const index = windowIndexAt(minutes);
  return index < 0 ? null : `${dayOf(minutes)}:${index}`;
}

function nextWindowText(minutes) {
  const m = minuteOfDay(minutes);
  const [start, end] = BLESSING.windows.find(([open]) => open > m) ?? BLESSING.windows[0];
  return `${clockText(start)}–${clockText(end)}`;
}

const inBed = (x, z) => [...CORNER_BEDS, ...EDGE_BEDS].some((bed) => Math.abs(x - bed.x) < bed.hx + 0.5 && Math.abs(z - bed.z) < bed.hz + 0.5);

function createOfficial(scene) {
  const npc = keeperNPC(OFFICIAL_LOOK, OFFICIAL.model);
  const at = new THREE.Vector3(OFFICIAL.x, 0, OFFICIAL.z);
  npc.walker.group.position.copy(at);
  npc.walker.group.rotation.y = OFFICIAL.facing;
  scene.add(npc.walker.group);
  const ahead = { x: Math.sin(OFFICIAL.facing), z: Math.cos(OFFICIAL.facing) };
  const side = { x: ahead.z, z: -ahead.x };
  const spots = OFFICIAL.spots.map((offset) => new THREE.Vector3(at.x + ahead.x * OFFICIAL.reach + side.x * offset, 0, at.z + ahead.z * OFFICIAL.reach + side.z * offset));
  return {
    ...npc,
    at,
    stand: spots[1],
    spots,
    owns(object) {
      for (let node = object; node; node = node.parent) if (node === npc.walker.group) return true;
      return false;
    },
    update(t, camera) {
      const near = camera.position.distanceTo(at) < OFFICIAL_DISTANCE;
      npc.walker.group.visible = near;
      if (!near) return;
      npc.bubble.update(t);
      npc.walker.head.rotation.y = Math.sin(t * 0.5 + npc.phase) * 0.45;
      npc.walker.head.rotation.x = Math.sin(t * 0.9 + npc.phase) * 0.05;
      npc.walker.face.update(t, npc.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
      npc.walker.pose?.();
    },
  };
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

  const official = createOfficial(scene);

  const box = (x, z, hx, hz, maxY) => ({ minX: PLAZA.x + x - hx, maxX: PLAZA.x + x + hx, minZ: PLAZA.z + z - hz, maxZ: PLAZA.z + z + hz, minY: 0, maxY });
  const obstacles = [
    box(0, 0, 2.1, 2.1, HEAD_Y + 0.8),
    box(0, 0, RING_BED.outer + 0.1, RING_BED.outer + 0.1, 0.5),
    ...[...CORNER_BEDS, ...EDGE_BEDS].map((bed) => box(bed.x, bed.z, bed.hx + 0.1, bed.hz + 0.1, 0.5)),
    { minX: OFFICIAL.x - 0.35, maxX: OFFICIAL.x + 0.35, minZ: OFFICIAL.z - 0.35, maxZ: OFFICIAL.z + 0.35, minY: 0, maxY: 2 },
  ];

  const members = new Map();
  let clock = 0;
  const active = (minutes) => strengthAt(minutes) > 0;
  const inside = (position) => Math.hypot(position.x - PLAZA.x, position.z - PLAZA.z) <= BLESSING.radius;
  const member = (id, minutes) => {
    const session = sessionAt(minutes);
    return !!session && members.get(id) === session;
  };

  const api = {
    obstacles,
    clickables: [statue, official.walker.group],
    official,
    statueAt: { x: PLAZA.x, z: PLAZA.z },
    active,
    member,
    session: sessionAt,
    nextWindow: nextWindowText,
    blessed(id, position, minutes) {
      if (!members.has(id)) return false;
      if (!member(id, minutes)) {
        members.delete(id);
        return false;
      }
      if (inside(position)) return true;
      members.delete(id);
      return false;
    },
    recoveryAt(id, position, minutes) {
      return api.blessed(id, position, minutes) ? BLESSING.recovery : 1;
    },
    join(id, minutes) {
      const session = active(minutes) ? sessionAt(minutes) : null;
      if (!session) return false;
      members.set(id, session);
      official.bubble.show('Thần linh phù hộ ngươi!', 2.2, clock);
      return true;
    },
    greet() {
      official.bubble.show(OFFICIAL_LINES[Math.floor(Math.random() * OFFICIAL_LINES.length)], 2, clock);
    },
    standFor() {
      return official.spots[Math.floor(Math.random() * official.spots.length)];
    },
    stayPoint() {
      for (let tries = 0; tries < 12; tries++) {
        const a = Math.random() * Math.PI * 2;
        const r = RING_BED.outer + 0.9 + Math.random() * 1.6;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (inBed(x, z)) continue;
        return new THREE.Vector3(PLAZA.x + x, 0, PLAZA.z + z);
      }
      return new THREE.Vector3(PLAZA.x, 0, PLAZA.z - RING_BED.outer - 1.2);
    },
    update(dt, minutes, camera) {
      clock += dt;
      official.update(clock, camera);
      const near = camera.position.distanceTo(aura.group.position) < VIEW_DISTANCE;
      aura.update(dt, near, strengthAt(minutes));
    },
  };
  return api;
}

export function createBlessingDialog({ blessing, minutes, onJoin }) {
  const dialog = document.getElementById('blessingDialog');
  const text = document.getElementById('blessingText');
  const yes = document.getElementById('blessingYes');
  const no = document.getElementById('blessingNo');
  let joining = false;
  no.addEventListener('click', () => dialog.close());
  yes.addEventListener('click', () => {
    dialog.close();
    if (joining) onJoin();
  });
  return {
    get isOpen() {
      return dialog.open;
    },
    open(id) {
      const now = minutes();
      blessing.greet();
      if (blessing.member(id, now)) return;
      joining = blessing.active(now);
      text.textContent = joining ? 'Ngươi có muốn tham gia nhận chúc phúc không?' : `Giờ chúc phúc chưa tới. Ngươi hãy quay lại vào khung giờ kế tiếp (${blessing.nextWindow(now)}) nhé.`;
      no.hidden = !joining;
      yes.textContent = joining ? 'Tham gia' : 'OK';
      dialog.showModal();
      yes.focus({ preventScroll: true });
    },
  };
}
