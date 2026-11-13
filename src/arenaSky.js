import * as THREE from 'three';
import { Batch, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const DAY_CLOUD = new THREE.Color(0xffffff);
const NIGHT_CLOUD = new THREE.Color(0x5a6a8c);
const DAY_SEA = new THREE.Color(0xf4f7ff);
const NIGHT_SEA = new THREE.Color(0x3a4766);
const MARBLE = 0xf2efe6;
const JADE = 0x4fae94;
const JADE_DARK = 0x2f7a66;
const LACQUER = 0x9a2418;
const GILT = 0xd8b45a;
const ROCK = 0x8a8273;
const ROCK_DARK = 0x5e5850;
const MOSS = 0x6a9a4a;
const BANNER_GLYPHS = ['擂', '台', '仙', '道', '武', '魁'];

function paint(size, draw, height = size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  draw(canvas.getContext('2d'), size, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function puff(ctx, x, y, r, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.45})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function cloudTexture(seed) {
  const rand = makeRandom(seed);
  return paint(256, (ctx, w, h) => {
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand());
      const x = w / 2 + Math.cos(a) * d * w * 0.3;
      const y = h * 0.56 + Math.sin(a) * d * h * 0.16 - rand() * h * 0.1;
      puff(ctx, x, y, w * (0.08 + rand() * 0.14), 0.22 + rand() * 0.2);
    }
  }, 160);
}

function seaTexture(seed) {
  const rand = makeRandom(seed);
  const texture = paint(512, (ctx, w) => {
    for (let i = 0; i < 90; i++) {
      const x = rand() * w;
      const y = rand() * w;
      const r = w * (0.05 + rand() * 0.12);
      const alpha = 0.18 + rand() * 0.25;
      for (const dx of [-w, 0, w]) for (const dy of [-w, 0, w]) puff(ctx, x + dx, y + dy, r, alpha);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function haloTexture() {
  return paint(128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.25, 'rgba(255,220,150,0.55)');
    g.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

function waterTexture() {
  const rand = makeRandom(313);
  const texture = paint(64, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(170,220,255,0.45)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 20 + rand() * 60;
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + rand() * 0.5})`;
      ctx.lineWidth = 1 + rand() * 3;
      for (const dy of [-h, 0]) {
        ctx.beginPath();
        ctx.moveTo(x, y + dy);
        ctx.lineTo(x + (rand() - 0.5) * 2, y + dy + len);
        ctx.stroke();
      }
    }
  }, 256);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function shaftTexture() {
  return paint(64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,240,200,0.9)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const side = ctx.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.5, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, w, h);
  }, 256);
}

function bannerTexture(glyph) {
  return paint(64, (ctx, w, h) => {
    ctx.fillStyle = '#8a1d14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(0, 0, w, 6);
    ctx.fillRect(0, h - 22, w, 4);
    ctx.beginPath();
    ctx.moveTo(0, h - 16);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(w, h - 16);
    ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.font = `bold 44px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, w / 2, h * 0.42);
  }, 192);
}

const additive = (options) => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...options });

function pavilion(b, x, y, z, size) {
  const r = size;
  b.add(shapes.cylinder(r * 1.25, r * 1.3, 0.35, 8), MARBLE, { p: [x, y + 0.17, z], r: [0, Math.PI / 8, 0] });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(shapes.cylinder(0.12 * size, 0.14 * size, 2.4 * size, 8), LACQUER, { p: [x + Math.cos(a) * r, y + 0.35 + 1.2 * size, z + Math.sin(a) * r] });
  }
  const eave = y + 0.35 + 2.4 * size;
  b.add(shapes.cylinder(r * 1.05, r * 1.05, 0.18 * size, 8), LACQUER, { p: [x, eave, z], r: [0, Math.PI / 8, 0] });
  b.add(shapes.cone(r * 1.75, 1.1 * size, 8), JADE, { p: [x, eave + 0.6 * size, z], r: [0, Math.PI / 8, 0] });
  b.add(shapes.cylinder(r * 0.55, r * 0.6, 0.6 * size, 8), LACQUER, { p: [x, eave + 1.3 * size, z], r: [0, Math.PI / 8, 0] });
  b.add(shapes.cone(r * 1.05, 0.9 * size, 8), JADE_DARK, { p: [x, eave + 1.95 * size, z], r: [0, Math.PI / 8, 0] });
  b.add(shapes.sphere(0.2 * size, 10, 8), GILT, { p: [x, eave + 2.5 * size, z] });
  b.add(shapes.cone(0.12 * size, 0.6 * size, 6), GILT, { p: [x, eave + 2.85 * size, z] });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const tip = r * 1.72;
    b.add(shapes.cone(0.12 * size, 0.5 * size, 6), JADE, { p: [x + Math.cos(a) * tip, eave + 0.22 * size, z + Math.sin(a) * tip], r: [Math.cos(a) * -0.9, 0, Math.sin(a) * 0.9] });
  }
}

function floatingIslet(b, x, y, z, radius, rand) {
  b.add(shapes.cylinder(radius, radius * 0.9, 0.5, 10), MOSS, { p: [x, y - 0.25, z] });
  b.add(shapes.cone(radius * 0.9, radius * 2, 9), ROCK_DARK, { p: [x, y - 0.5 - radius, z], r: [Math.PI, rand() * 3, 0] });
  b.add(shapes.ico(radius * 0.35, 0), ROCK, { p: [x + radius * 0.3, y + radius * 0.15, z - radius * 0.2] });
}

function crane() {
  const group = new THREE.Group();
  const body = new Batch();
  body.add(shapes.sphere(0.35, 10, 8), 0xffffff, { s: [1, 0.8, 2] });
  body.add(shapes.cylinder(0.05, 0.08, 0.9, 6), 0xffffff, { p: [0, 0.35, 0.75], r: [0.9, 0, 0] });
  body.add(shapes.sphere(0.12, 8, 6), 0xffffff, { p: [0, 0.65, 1.1] });
  body.add(shapes.sphere(0.06, 6, 4), 0xc81e1e, { p: [0, 0.75, 1.1] });
  body.add(shapes.cone(0.04, 0.35, 5), 0x2a2a2a, { p: [0, 0.62, 1.32], r: [Math.PI / 2, 0, 0] });
  body.add(shapes.cylinder(0.025, 0.025, 1.1, 5), 0x2a2a2a, { p: [0, -0.1, -0.9], r: [Math.PI / 2 + 0.2, 0, 0] });
  const material = toonMaterial({ vertexColors: true, emissive: 0x3a3a40 });
  group.add(body.mesh(material, { shadow: false }));
  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.25, 0.1, 0);
    const wing = new Batch();
    wing.add(shapes.box(1.6, 0.04, 0.7), 0xffffff, { p: [side * 0.8, 0, 0] });
    wing.add(shapes.box(0.5, 0.045, 0.5), 0x1e1e1e, { p: [side * 1.45, 0, -0.1] });
    pivot.add(wing.mesh(material, { shadow: false }));
    group.add(pivot);
    return { pivot, side };
  });
  return { group, wings };
}

export function createArenaSky(island) {
  const rand = makeRandom(8080);
  const group = new THREE.Group();
  const center = new THREE.Vector3(island.x, island.y, island.z);
  const cloudMaterials = [cloudTexture(11), cloudTexture(23), cloudTexture(37)].map((map) => new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0.95, fog: false }));
  const clouds = [];

  function addCloud({ reach, low, high, size, speed, opacity = 1 }) {
    const material = cloudMaterials[Math.floor(rand() * cloudMaterials.length)];
    const sprite = new THREE.Sprite(opacity === 1 ? material : material.clone());
    sprite.material.opacity = opacity * 0.95;
    const angle = rand() * Math.PI * 2;
    const distance = reach[0] + rand() * (reach[1] - reach[0]);
    const width = size[0] + rand() * (size[1] - size[0]);
    sprite.scale.set(width, width * 0.55, 1);
    sprite.position.set(center.x + Math.cos(angle) * distance, center.y + low + rand() * (high - low), center.z + Math.sin(angle) * distance);
    sprite.renderOrder = -1;
    group.add(sprite);
    clouds.push({ sprite, angle, distance, speed: speed * (0.6 + rand() * 0.8) });
  }

  for (let i = 0; i < 46; i++) addCloud({ reach: [16, 90], low: -16, high: -6, size: [22, 48], speed: 0.012 });
  for (let i = 0; i < 18; i++) addCloud({ reach: [15, 28], low: -3, high: 1.5, size: [8, 16], speed: 0.02, opacity: 0.7 });
  for (let i = 0; i < 16; i++) addCloud({ reach: [30, 90], low: 8, high: 30, size: [14, 30], speed: 0.008, opacity: 0.8 });

  const seas = [
    { y: -9, repeat: 7, speed: [0.004, 0.002], opacity: 0.85 },
    { y: -13, repeat: 5, speed: [-0.002, 0.003], opacity: 0.95 },
  ].map(({ y, repeat, speed, opacity }, i) => {
    const map = seaTexture(500 + i);
    map.repeat.set(repeat, repeat);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, color: DAY_SEA.clone() }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, center.y + y, center.z);
    mesh.renderOrder = -2;
    group.add(mesh);
    return { mesh, speed };
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(280, 32), new THREE.MeshBasicMaterial({ color: DAY_SEA.clone() }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, center.y - 18, center.z);
  group.add(floor);

  const mistMaterial = cloudMaterials[1].clone();
  mistMaterial.opacity = 0.32;
  const mists = Array.from({ length: 12 }, (_, i) => {
    const sprite = new THREE.Sprite(mistMaterial);
    const width = 6 + rand() * 6;
    sprite.scale.set(width, width * 0.35, 1);
    group.add(sprite);
    return { sprite, angle: (i / 12) * Math.PI * 2 + rand(), radius: 6 + rand() * 9, lift: 0.4 + rand() * 1.2, speed: 0.03 + rand() * 0.04 };
  });

  const halo = haloTexture();
  const halos = island.lamps.map(({ x, y, z, size }) => {
    const sprite = new THREE.Sprite(additive({ map: halo, opacity: 0.6 }));
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(size);
    group.add(sprite);
    return { sprite, size, phase: rand() * Math.PI * 2 };
  });

  const shaftMap = shaftTexture();
  const shafts = Array.from({ length: 5 }, (_, i) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5 + rand() * 4, 46), new THREE.MeshBasicMaterial({ map: shaftMap, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const angle = (i / 5) * Math.PI * 2 + rand();
    mesh.position.set(center.x + Math.cos(angle) * (10 + rand() * 20), center.y + 14, center.z + Math.sin(angle) * (10 + rand() * 20));
    mesh.rotation.z = (rand() - 0.5) * 0.5;
    group.add(mesh);
    return { mesh, phase: rand() * Math.PI * 2 };
  });

  const waterMap = waterTexture();
  const falls = island.falls.map(({ angle }) => {
    const radius = island.radius + 0.45;
    const width = 2.6;
    const height = 30;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: waterMap.clone(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 }));
    mesh.material.map.repeat.set(1, 4);
    mesh.material.map.needsUpdate = true;
    mesh.position.set(center.x + Math.cos(angle) * radius, center.y - 0.3 - height / 2, center.z + Math.sin(angle) * radius);
    mesh.rotation.y = -angle + Math.PI / 2;
    group.add(mesh);
    const spray = new THREE.Sprite(mistMaterial);
    spray.scale.set(9, 3.5, 1);
    spray.position.set(mesh.position.x, center.y - 9, mesh.position.z);
    group.add(spray);
    return mesh;
  });

  const scenery = new Batch();
  for (const { x, z, lift, size } of island.pavilions) {
    floatingIslet(scenery, x, center.y + lift, z, size * 2.4, rand);
    pavilion(scenery, x, center.y + lift, z, size);
  }
  const islets = [];
  for (let i = 0; i < 12; i++) {
    const angle = rand() * Math.PI * 2;
    const reach = 20 + rand() * 18;
    const piece = new Batch();
    floatingIslet(piece, 0, 0, 0, 0.6 + rand() * 1.1, rand);
    const mesh = piece.mesh(toonMaterial({ vertexColors: true, emissive: 0x24262a }), { shadow: false });
    mesh.position.set(center.x + Math.cos(angle) * reach, center.y - 5 + rand() * 14, center.z + Math.sin(angle) * reach);
    group.add(mesh);
    islets.push({ mesh, base: mesh.position.y, phase: rand() * Math.PI * 2, spin: (rand() - 0.5) * 0.1 });
  }
  const sceneryMesh = scenery.mesh(toonMaterial({ vertexColors: true, emissive: 0x2c2e34 }));
  group.add(sceneryMesh);

  const banners = island.banners.map(({ x, z, angle }, i) => {
    const pole = new Batch();
    pole.add(shapes.cylinder(0.07, 0.09, 5.4, 8), LACQUER, { p: [0, 2.7, 0] });
    pole.add(shapes.cylinder(0.04, 0.04, 1.2, 6), GILT, { p: [0, 5.2, 0], r: [0, 0, Math.PI / 2] });
    pole.add(shapes.cone(0.1, 0.4, 6), GILT, { p: [0, 5.6, 0] });
    const holder = new THREE.Group();
    holder.position.set(x, center.y, z);
    holder.rotation.y = angle;
    holder.add(pole.mesh(toonMaterial({ vertexColors: true, emissive: 0x2a1a10 }), { shadow: false }));
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.3), new THREE.MeshBasicMaterial({ map: bannerTexture(BANNER_GLYPHS[i % BANNER_GLYPHS.length]), side: THREE.DoubleSide, transparent: true }));
    const swing = new THREE.Group();
    swing.position.set(0, 5.15, 0);
    cloth.position.set(0, -1.7, 0);
    swing.add(cloth);
    holder.add(swing);
    group.add(holder);
    return { swing, phase: rand() * Math.PI * 2 };
  });

  const cranes = Array.from({ length: 4 }, (_, i) => {
    const bird = crane();
    group.add(bird.group);
    return { ...bird, radius: 26 + i * 6 + rand() * 4, height: 9 + rand() * 10, speed: (0.08 + rand() * 0.05) * (i % 2 ? -1 : 1), angle: rand() * Math.PI * 2, flap: 2.4 + rand() };
  });

  let tint = -1;
  const cloudColor = new THREE.Color();
  const seaColor = new THREE.Color();

  return {
    group,
    update(t, dt, night) {
      if (Math.abs(night - tint) > 0.02) {
        tint = night;
        cloudColor.copy(DAY_CLOUD).lerp(NIGHT_CLOUD, night);
        seaColor.copy(DAY_SEA).lerp(NIGHT_SEA, night);
        for (const material of new Set(clouds.map((item) => item.sprite.material))) material.color.copy(cloudColor);
        mistMaterial.color.copy(cloudColor);
        for (const { mesh } of seas) mesh.material.color.copy(seaColor);
        floor.material.color.copy(seaColor);
        for (const shaft of shafts) shaft.mesh.visible = night < 0.6;
      }
      for (const cloud of clouds) {
        cloud.angle += cloud.speed * dt;
        cloud.sprite.position.x = center.x + Math.cos(cloud.angle) * cloud.distance;
        cloud.sprite.position.z = center.z + Math.sin(cloud.angle) * cloud.distance;
      }
      for (const { mesh, speed } of seas) {
        mesh.material.map.offset.x += speed[0] * dt;
        mesh.material.map.offset.y += speed[1] * dt;
      }
      for (const mist of mists) {
        mist.angle += mist.speed * dt;
        mist.sprite.position.set(center.x + Math.cos(mist.angle) * mist.radius, center.y + mist.lift + Math.sin(t * 0.5 + mist.angle) * 0.2, center.z + Math.sin(mist.angle) * mist.radius);
      }
      for (const item of halos) item.sprite.scale.setScalar(item.size * (0.9 + Math.sin(t * 2 + item.phase) * 0.1));
      for (const shaft of shafts) shaft.mesh.material.opacity = 0.08 + Math.sin(t * 0.4 + shaft.phase) * 0.04;
      for (const fall of falls) fall.material.map.offset.y += dt * 0.9;
      for (const islet of islets) {
        islet.mesh.position.y = islet.base + Math.sin(t * 0.5 + islet.phase) * 0.5;
        islet.mesh.rotation.y += islet.spin * dt;
      }
      for (const banner of banners) banner.swing.rotation.x = Math.sin(t * 1.3 + banner.phase) * 0.12;
      for (const bird of cranes) {
        bird.angle += bird.speed * dt;
        const x = center.x + Math.cos(bird.angle) * bird.radius;
        const z = center.z + Math.sin(bird.angle) * bird.radius;
        bird.group.position.set(x, center.y + bird.height + Math.sin(t * 0.6 + bird.radius) * 1.2, z);
        bird.group.rotation.y = Math.atan2(-Math.sin(bird.angle) * Math.sign(bird.speed), Math.cos(bird.angle) * Math.sign(bird.speed));
        for (const wing of bird.wings) wing.pivot.rotation.z = wing.side * Math.sin(t * bird.flap) * 0.6;
      }
    },
  };
}
