import * as THREE from 'three';
import { shapes, toonMaterial } from './toon.js';
import { roundTree } from './scenery.js';
import { keepCanvas } from './canvasRestore.js';
import { clockText, dayOf, minuteOfDay } from './clock.js';
import { coins } from './format.js';
import { blessingSlots, economy } from './economy.js';

const STONE = 0xd8d4cc;
const STONE_DARK = 0xb2ada3;
const PATH = 0xe6e1d6;
const LAWN = 0x6fae4a;
const LAWN_EDGE = 0xb8b2a6;
const HEDGE = [0x3f8636, 0x4f9a3f, 0x47913b];
const BLOOMS = [0xe8475f, 0xf5d36a, 0xfaf3e6, 0xb07ad9, 0xf08a3c, 0xf28ab2];
const WOOD = 0x8a5a34;
const IRON = 0x2b2f38;
const WATER = 0x8fd0e6;
const FLAG = 0xc8261a;
const NAVY = '#24346a';
const BOARD = { w: 2.2, h: 1.45, px: 360, y: 1.55 };
const FOUNTAIN = { r: 2.1, rim: 0.5, ring: 3 };
const LIVE_DISTANCE = 90;
const BOARD_MS = 4000;
const GLOW = { intensity: 26, distance: 20 };

function rounded(w, h, d, r = 0.05) {
  return shapes.rounded(w, h, d, r);
}

function blockBox(obstacles, minX, minZ, maxX, maxZ, maxY = 1) {
  obstacles.push({ minX, minZ, maxX, maxZ, minY: 0, maxY });
}

function flowerBed(b, rand, obstacles, x, z, w, d) {
  b.add(rounded(w, 0.42, d, 0.08), STONE, { p: [x, 0.21, z] });
  b.add(rounded(w + 0.1, 0.06, d + 0.1, 0.03), STONE_DARK, { p: [x, 0.44, z] });
  b.add(shapes.box(w - 0.24, 0.02, d - 0.24), 0x4a3324, { p: [x, 0.46, z] });
  b.add(rounded(w - 0.6, 0.55, 0.5, 0.2), HEDGE[1], { p: [x, 0.74, z] });
  b.add(rounded(0.5, 0.55, d - 0.6, 0.2), HEDGE[0], { p: [x, 0.74, z] });
  for (let i = 0; i < 26; i++) {
    const px = x + (rand() - 0.5) * (w - 0.4);
    const pz = z + (rand() - 0.5) * (d - 0.4);
    if (Math.abs(px - x) < 0.35 || Math.abs(pz - z) < 0.35) continue;
    b.add(shapes.sphere(0.13 + rand() * 0.05, 8, 6), BLOOMS[Math.floor(rand() * BLOOMS.length)], { p: [px, 0.56, pz], s: [1, 0.75, 1] });
    b.add(shapes.sphere(0.12, 6, 4), HEDGE[2], { p: [px, 0.5, pz], s: [1.3, 0.5, 1.3] });
  }
  blockBox(obstacles, x - w / 2 - 0.05, z - d / 2 - 0.05, x + w / 2 + 0.05, z + d / 2 + 0.05, 1.1);
}

function bench(b, obstacles, x, z, alongZ) {
  const len = 1.7;
  const [sw, sd] = alongZ ? [0.5, len] : [len, 0.5];
  for (const k of [-1, 1]) {
    const lx = alongZ ? x : x + k * (len / 2 - 0.2);
    const lz = alongZ ? z + k * (len / 2 - 0.2) : z;
    b.add(rounded(alongZ ? 0.46 : 0.16, 0.42, alongZ ? 0.16 : 0.46, 0.03), STONE_DARK, { p: [lx, 0.21, lz] });
  }
  for (let i = 0; i < 3; i++) {
    const off = -0.16 + i * 0.16;
    b.add(rounded(alongZ ? 0.14 : len, 0.05, alongZ ? len : 0.14, 0.02), WOOD, {
      p: [alongZ ? x + off : x, 0.45, alongZ ? z : z + off],
    });
  }
  blockBox(obstacles, x - sw / 2, z - sd / 2, x + sw / 2, z + sd / 2, 0.6);
}

function hedgeRow(b, obstacles, x, z0, z1) {
  const len = z1 - z0;
  b.add(rounded(0.7, 0.8, len, 0.25), HEDGE[0], { p: [x, 0.4, (z0 + z1) / 2] });
  b.add(rounded(0.62, 0.12, len - 0.1, 0.06), HEDGE[1], { p: [x, 0.84, (z0 + z1) / 2] });
  blockBox(obstacles, x - 0.38, z0, x + 0.38, z1, 1);
}

function lawn(b, rand, x0, z0, x1, z1) {
  b.add(rounded(x1 - x0, 0.05, z1 - z0, 0.02), LAWN_EDGE, { p: [(x0 + x1) / 2, 0.025, (z0 + z1) / 2] });
  b.add(rounded(x1 - x0 - 0.2, 0.06, z1 - z0 - 0.2, 0.02), LAWN, { p: [(x0 + x1) / 2, 0.035, (z0 + z1) / 2] });
  for (let i = 0; i < 8; i++) {
    const x = x0 + 0.6 + rand() * (x1 - x0 - 1.2);
    const z = z0 + 0.6 + rand() * (z1 - z0 - 3.5);
    b.add(shapes.sphere(0.32 + rand() * 0.15, 10, 8), HEDGE[Math.floor(rand() * HEDGE.length)], { p: [x, 0.25, z], s: [1, 0.7, 1] });
  }
}

export function hallPlazaLayout(plaza, hallFront) {
  const mid = (plaza.x0 + plaza.x1) / 2;
  const steps = hallFront - 1.25;
  return { mid, steps, fountain: { x: mid, z: (plaza.z0 + steps) / 2 }, board: { x: mid + 4.2, z: steps - 1.05 } };
}

export function buildHallPlaza(b, rand, plaza, hallFront, obstacles) {
  const { mid, steps, fountain, board } = hallPlazaLayout(plaza, hallFront);
  const fx = fountain.x;
  const fz = fountain.z;
  b.add(shapes.box(3.2, 0.03, fz - FOUNTAIN.ring - plaza.z0), PATH, { p: [mid, 0.015, (plaza.z0 + fz - FOUNTAIN.ring) / 2] });
  b.add(shapes.box(3.2, 0.03, steps - (fz + FOUNTAIN.ring)), PATH, { p: [mid, 0.015, (steps + fz + FOUNTAIN.ring) / 2] });
  b.add(new THREE.RingGeometry(FOUNTAIN.r - 0.05, FOUNTAIN.ring + 0.05, 40).rotateX(-Math.PI / 2), PATH, { p: [fx, 0.03, fz] });
  b.add(shapes.cylinder(FOUNTAIN.r, FOUNTAIN.r + 0.1, FOUNTAIN.rim, 32), STONE, { p: [fx, FOUNTAIN.rim / 2, fz] });
  b.add(shapes.torus(FOUNTAIN.r - 0.08, 0.12, 32), STONE_DARK, { p: [fx, FOUNTAIN.rim, fz], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.cylinder(FOUNTAIN.r - 0.18, FOUNTAIN.r - 0.18, 0.04, 32), 0x3f7f96, { p: [fx, FOUNTAIN.rim - 0.08, fz] });
  b.add(shapes.cylinder(0.32, 0.45, 0.9, 16), STONE, { p: [fx, 0.45, fz] });
  b.add(shapes.cylinder(0.85, 0.3, 0.22, 24), STONE, { p: [fx, 1.0, fz] });
  b.add(shapes.cylinder(0.75, 0.75, 0.03, 24), 0x3f7f96, { p: [fx, 1.11, fz] });
  b.add(shapes.cylinder(0.12, 0.16, 0.5, 12), STONE_DARK, { p: [fx, 1.3, fz] });
  blockBox(obstacles, fx - FOUNTAIN.r - 0.1, fz - FOUNTAIN.r - 0.1, fx + FOUNTAIN.r + 0.1, fz + FOUNTAIN.r + 0.1, 1.2);

  for (const side of [-1, 1]) {
    flowerBed(b, rand, obstacles, mid + side * 5.6, fz, 3.2, 4.4);
    bench(b, obstacles, mid + side * (FOUNTAIN.ring + 0.6), fz, true);
    hedgeRow(b, obstacles, side < 0 ? plaza.x0 + 0.6 : plaza.x1 - 0.6, plaza.z0 + 0.8, steps - 1.2);
  }

  for (const side of [-1, 1]) {
    const x0 = side < 0 ? plaza.x0 + 0.3 : mid + 9.1;
    const x1 = side < 0 ? mid - 9.1 : plaza.x1 - 0.3;
    lawn(b, rand, x0, hallFront - 1.6, x1, plaza.z1 - 0.3);
  }
  for (const [x, z] of [
    [plaza.x0 + 1.5, plaza.z1 - 2],
    [plaza.x1 - 2.5, plaza.z1 - 2],
  ]) {
    roundTree(b, rand, { x, z, h: 4 });
    obstacles.push({ minX: x + 0.2, maxX: x + 0.8, minZ: z + 0.2, maxZ: z + 0.8, minY: 0, maxY: 4 });
  }

  for (const k of [-1, 1]) {
    const x = board.x + k * (BOARD.w / 2 - 0.12);
    b.add(rounded(0.12, BOARD.y + BOARD.h / 2 + 0.1, 0.12, 0.03), IRON, { p: [x, (BOARD.y + BOARD.h / 2 + 0.1) / 2, board.z] });
  }
  b.add(rounded(BOARD.w + 0.14, BOARD.h + 0.14, 0.08, 0.03), IRON, { p: [board.x, BOARD.y, board.z + 0.02] });
  b.add(rounded(BOARD.w + 0.3, 0.08, 0.3, 0.02), IRON, { p: [board.x, BOARD.y + BOARD.h / 2 + 0.12, board.z] });
  blockBox(obstacles, board.x - BOARD.w / 2 - 0.1, board.z - 0.2, board.x + BOARD.w / 2 + 0.1, board.z + 0.2, 2.4);
}

function waterMaterial(opacity) {
  return toonMaterial({ color: WATER, transparent: true, opacity, depthWrite: false, emissive: 0x2a6a80, emissiveIntensity: 0.25 });
}

function createWater(fx, fz) {
  const group = new THREE.Group();
  const jet = new THREE.Mesh(shapes.cylinder(0.05, 0.09, 1.3, 10).translate(0, 0.65, 0), waterMaterial(0.7));
  jet.position.set(fx, 1.55, fz);
  const crown = new THREE.Mesh(shapes.cone(0.42, 0.5, 14).rotateX(Math.PI), waterMaterial(0.5));
  crown.position.set(fx, 2.75, fz);
  group.add(jet, crown);
  const arcs = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const reach = FOUNTAIN.r - 0.5 - 0.7;
    const curve = [
      new THREE.Vector3(Math.cos(a) * 0.7, 1.12, Math.sin(a) * 0.7),
      new THREE.Vector3(Math.cos(a) * (0.7 + reach * 0.45), 1.6, Math.sin(a) * (0.7 + reach * 0.45)),
      new THREE.Vector3(Math.cos(a) * (0.7 + reach), FOUNTAIN.rim - 0.06, Math.sin(a) * (0.7 + reach)),
    ];
    const arc = new THREE.Mesh(shapes.tube(curve, 0.035, 16), waterMaterial(0.55));
    arc.position.set(fx, 0, fz);
    group.add(arc);
    arcs.push(arc);
  }
  const ripples = [0, 0.5].map((offset) => {
    const ripple = new THREE.Mesh(shapes.torus(1, 0.02, 32).rotateX(Math.PI / 2), waterMaterial(0.6));
    ripple.position.set(fx, FOUNTAIN.rim - 0.05, fz);
    ripple.userData.offset = offset;
    group.add(ripple);
    return ripple;
  });
  return {
    group,
    update(t) {
      const pulse = 0.92 + Math.sin(t * 3.1) * 0.06 + Math.sin(t * 7.3) * 0.02;
      jet.scale.set(1, pulse, 1);
      crown.position.y = 1.55 + 1.3 * pulse - 0.1;
      crown.rotation.y = t * 0.8;
      crown.scale.setScalar(0.9 + Math.sin(t * 4.2) * 0.08);
      arcs.forEach((arc, k) => {
        arc.scale.y = 0.96 + Math.sin(t * 3.4 + k) * 0.04;
      });
      for (const ripple of ripples) {
        const phase = (t * 0.35 + ripple.userData.offset) % 1;
        ripple.scale.setScalar(0.4 + phase * (FOUNTAIN.r - 0.65));
        ripple.material.opacity = 0.6 * (1 - phase);
      }
    },
  };
}

function createFlag(anchor, turn) {
  const geometry = new THREE.PlaneGeometry(1.2, 0.7, 12, 2).translate(0.6, 0, 0);
  const base = geometry.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geometry, toonMaterial({ color: FLAG, side: THREE.DoubleSide }));
  mesh.position.set(anchor.x, anchor.y, anchor.z);
  mesh.rotation.y = turn;
  mesh.castShadow = true;
  const phase = Math.random() * Math.PI * 2;
  return {
    mesh,
    update(t) {
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        const reach = x / 1.2;
        position.setZ(i, Math.sin(x * 4.2 - t * 5 + phase + y * 0.6) * 0.13 * reach);
        position.setY(i, y - reach * reach * 0.05 + Math.sin(x * 3 - t * 4 + phase) * 0.02 * reach);
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    },
  };
}

function createClockHands(at, r, turn) {
  const pivot = new THREE.Group();
  pivot.position.set(at.x, at.y, at.z);
  pivot.rotation.y = turn;
  const material = toonMaterial({ color: IRON });
  const hour = new THREE.Group();
  hour.add(new THREE.Mesh(shapes.box(0.07, r * 0.52, 0.02).translate(0, r * 0.2, 0), material));
  const minute = new THREE.Group();
  minute.position.z = 0.015;
  minute.add(new THREE.Mesh(shapes.box(0.045, r * 0.78, 0.02).translate(0, r * 0.33, 0), material));
  const cap = new THREE.Mesh(shapes.cylinder(0.07, 0.07, 0.04, 12).rotateX(Math.PI / 2), toonMaterial({ color: 0xc9a24a }));
  cap.position.z = 0.03;
  pivot.add(hour, minute, cap);
  return {
    group: pivot,
    update(minutes) {
      const m = minuteOfDay(minutes);
      minute.rotation.z = -((m % 60) / 60) * Math.PI * 2;
      hour.rotation.z = -(((m / 60) % 12) / 12) * Math.PI * 2;
    },
  };
}

function paintBoard(ctx, w, h, info) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#f4efe2';
  ctx.lineWidth = w * 0.008;
  ctx.strokeRect(w * 0.03, w * 0.03, w - w * 0.06, h - w * 0.06);
  ctx.fillStyle = '#fbf8f0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = (size) => `700 ${size}px "BIZ UDPGothic", system-ui, sans-serif`;
  ctx.font = font(h * 0.085);
  ctx.fillText('NGÂN KHỐ LÀNG', w / 2, h * 0.12);
  ctx.fillStyle = '#ffd36e';
  ctx.font = font(h * 0.14);
  ctx.fillText(info.money, w / 2, h * 0.27);
  ctx.fillStyle = '#fbf8f0';
  ctx.font = font(h * 0.06);
  ctx.fillText(`Chúc phúc hôm nay · ${info.times.length} buổi`, w / 2, h * 0.43);
  ctx.font = font(h * 0.055);
  const cols = 3;
  info.times.forEach((text, i) => {
    const col = i % cols;
    const line = Math.floor(i / cols);
    ctx.fillText(text, w * (0.2 + col * 0.3), h * (0.54 + line * 0.085));
  });
  ctx.font = font(h * 0.06);
  ctx.fillText(`Giải lôi đài mỗi trận · ${info.prize}`, w / 2, h * 0.88);
}

function createBoard(at) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(BOARD.w * BOARD.px);
  canvas.height = Math.round(BOARD.h * BOARD.px);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  let info = { money: '', times: [], prize: '' };
  const draw = (ctx) => paintBoard(ctx, canvas.width, canvas.height, info);
  keepCanvas(texture, draw);
  const material = toonMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h), material);
  mesh.position.set(at.x, BOARD.y, at.z - 0.025);
  mesh.rotation.y = Math.PI;
  let key = null;
  let checked = -Infinity;
  return {
    mesh,
    update(minutes) {
      const stamp = performance.now();
      if (stamp - checked < BOARD_MS) return;
      checked = stamp;
      const next = {
        money: coins(economy.treasury),
        times: blessingSlots(dayOf(minutes)).map(({ start, end }) => `${clockText(start)}–${clockText(end)}`),
        prize: coins(economy.arenaPrize(minutes)),
      };
      const nextKey = JSON.stringify(next);
      if (nextKey === key) return;
      key = nextKey;
      info = next;
      draw(canvas.getContext('2d'));
      texture.needsUpdate = true;
    },
    setNight(k) {
      material.emissiveIntensity = k * 0.55;
    },
  };
}

export function createHallLife({ plaza, hallFront, built, toWorld, turn }) {
  const { fountain, board } = hallPlazaLayout(plaza, hallFront);
  const group = new THREE.Group();
  const water = createWater(fountain.x, fountain.z);
  const clockAt = toWorld(built.clock);
  const clock = createClockHands({ x: clockAt.x, y: built.clock.y, z: clockAt.z }, built.clock.r, turn);
  const flags = built.flags.map((anchor) => {
    const at = toWorld(anchor);
    return createFlag({ x: at.x, y: anchor.y, z: at.z }, turn);
  });
  const notice = createBoard(board);
  const glowAt = toWorld(built.glow);
  const light = new THREE.PointLight(0xffe2a8, 0, GLOW.distance, 2);
  light.position.set(glowAt.x, built.glow.y, glowAt.z);
  group.add(water.group, clock.group, notice.mesh, light, ...flags.map((flag) => flag.mesh));
  const center = new THREE.Vector3(fountain.x, 2, fountain.z);
  return {
    group,
    update(t, minutes, camera) {
      clock.update(minutes);
      notice.update(minutes);
      if (camera.position.distanceTo(center) > LIVE_DISTANCE) return;
      water.update(t);
      for (const flag of flags) flag.update(t);
    },
    setNight(k) {
      light.intensity = k * GLOW.intensity;
      notice.setNight(k);
    },
  };
}
