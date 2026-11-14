import * as THREE from 'three';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { createArenaSky } from './arenaSky.js';

export const ISLAND = { x: 240, z: 30, y: 70, radius: 14 };
export const ISLAND_BOUNDS = { x0: 208, z0: -6, x1: 272, z1: 57 };

const WALK_RADIUS = ISLAND.radius - 0.9;
const RAIL_RADIUS = ISLAND.radius - 0.35;
const RAIL_SEGMENTS = 48;
const TILE = 2;
const TILE_DEPTH = 0.12;
const RIM_DEPTH = 0.2;
const SINK = -0.12;
const MARBLE = 0xf2efe6;
const SLATE = 0x3e4a58;
const JADE = 0x5fb8a0;
const ROCK = 0x8a8273;
const ROCK_DARK = 0x5e5850;
const LACQUER = 0x9a2418;
const GILT = 0xd8b45a;
const GLOW = 0xffd36e;
const SPIRIT = 0x9ad8ff;
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const GLYPHS = ['文', '智', '福', '學', '道', '神', '靈', '光', '德', '明', '聖', '仁'];

const STAGE_HEIGHT = 3.5;
const PLATFORMS = [
  { x: 221, z: 19, r: 3.5, lift: STAGE_HEIGHT },
  { x: 259, z: 19, r: 3.5, lift: STAGE_HEIGHT },
  { x: 221, z: 41, r: 3.5, lift: STAGE_HEIGHT },
  { x: 259, z: 41, r: 3.5, lift: STAGE_HEIGHT },
  { x: 213, z: 8, r: 3.5, lift: STAGE_HEIGHT },
  { x: 267, z: 8, r: 3.5, lift: STAGE_HEIGHT },
  { x: 213, z: 52, r: 3.5, lift: STAGE_HEIGHT },
  { x: 267, z: 52, r: 3.5, lift: STAGE_HEIGHT },
  { x: 240, z: 4, r: 5, lift: STAGE_HEIGHT + 2 },
].map((stage) => ({ ...stage, y: ISLAND.y + stage.lift }));
const FINAL_STAGE = PLATFORMS.at(-1);
const RING_STAGES = PLATFORMS.slice(0, -1);
const FIGHT_GAP = 1.6;
const SKY_GATE = { back: 60, width: 56, height: 28, top: 2.9, opacity: 0.62 };

const DAIS = { tiers: [2.3, 1.75, 1.2], step: 0.32 };
const DAIS_TOP = ISLAND.y + DAIS.tiers.length * DAIS.step;
const CRYSTAL_Y = DAIS_TOP + 1.4;
const BOARD = { width: 11, height: 6.45, y: ISLAND.y + 14, tilt: 0.26 };
const BOARD_STAND = { x: ISLAND.x, z: ISLAND.z + DAIS.tiers[0] + 1.2 };

const GATE = { x: ISLAND.x, z: ISLAND.z + ISLAND.radius - 2.4, radius: 1.85, tube: 0.32 };
const GATE_STAND = { x: GATE.x, z: GATE.z - 2.2 };
export const ARRIVAL = { x: ISLAND.x + 2.5, y: ISLAND.y, z: ISLAND.z + 6.5, facing: Math.PI };

const inDisc = (x, z, radius) => (x - ISLAND.x) ** 2 + (z - ISLAND.z) ** 2 <= radius * radius;
const facingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

export const SPECTATORS = (() => {
  const rand = makeRandom(5150);
  const spots = [];
  const rings = [
    { radius: 5.2, count: 7 },
    { radius: 8.4, count: 9 },
  ];
  for (const { radius, count } of rings) {
    for (let i = 0; i < count; i++) {
      const angle = ((i + 0.5 + (rand() - 0.5) * 0.5) / count) * Math.PI * 2;
      const reach = radius + (rand() - 0.5) * 1.4;
      const spot = { x: ISLAND.x + Math.cos(angle) * reach, y: ISLAND.y, z: ISLAND.z + Math.sin(angle) * reach };
      if (Math.hypot(spot.x - GATE.x, spot.z - GATE.z) < 3.4 || Math.hypot(spot.x - ARRIVAL.x, spot.z - ARRIVAL.z) < 1.6) continue;
      spots.push({ ...spot, facing: facingTo(spot, ISLAND) });
    }
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return spots;
})();

export const STAGES = PLATFORMS;

export function stageOf(roundSize, index) {
  if (roundSize <= 1) return FINAL_STAGE;
  return RING_STAGES[index % RING_STAGES.length];
}

export function fighterSpot(roundSize, index, side) {
  const stage = stageOf(roundSize, index);
  const sign = side === 'a' ? -1 : 1;
  const spot = { x: stage.x + sign * FIGHT_GAP, y: stage.y, z: stage.z };
  return { ...spot, facing: facingTo(spot, stage) };
}

export function watchSpot(stage) {
  const dx = stage.x - ISLAND.x;
  const dz = stage.z - ISLAND.z;
  const reach = WALK_RADIUS - 1.2;
  const scale = reach / (Math.hypot(dx, dz) || 1);
  return { x: ISLAND.x + dx * scale, y: ISLAND.y, z: ISLAND.z + dz * scale };
}

export function wander(anchor, rand = Math.random) {
  for (let tries = 0; tries < 6; tries++) {
    const angle = rand() * Math.PI * 2;
    const reach = 0.4 + rand() * 1.4;
    const x = anchor.x + Math.cos(angle) * reach;
    const z = anchor.z + Math.sin(angle) * reach;
    if (!inDisc(x, z, WALK_RADIUS - 0.6) || inDisc(x, z, DAIS.tiers[0] + 0.6)) continue;
    if (Math.hypot(x - GATE.x, z - GATE.z) < 2.6) continue;
    return { x, y: ISLAND.y, z };
  }
  return { x: anchor.x, y: anchor.y, z: anchor.z };
}

export function onIsland(position) {
  return position.y > ISLAND.y - 10 && position.x >= ISLAND_BOUNDS.x0 && position.x <= ISLAND_BOUNDS.x1 && position.z >= ISLAND_BOUNDS.z0 && position.z <= ISLAND_BOUNDS.z1;
}

const VIEW_CLEARANCE = 0.35;
const RAIL_BAND = { inner: RAIL_RADIUS - 0.3, outer: RAIL_RADIUS + 0.3, top: ISLAND.y + 1.45 };
const GATE_REACH = GATE.radius + GATE.tube + 1.1;
const GATE_TOP = ISLAND.y + GATE.radius * 2 + 1.3;
const GATE_HOLE = { y: ISLAND.y + GATE.radius + 0.35, radius: GATE.radius - 0.15 };

function underRock(x, y, z, cx, top, cz, radius, depth) {
  return (x - cx) ** 2 + (z - cz) ** 2 <= radius * radius && y < top + VIEW_CLEARANCE && y > top - depth - 1.2;
}

function inGate(x, y, z) {
  if (Math.abs(x - GATE.x) > GATE_REACH || Math.abs(z - GATE.z) > 0.95 || y < ISLAND.y || y > GATE_TOP + VIEW_CLEARANCE) return false;
  return Math.hypot(x - GATE.x, y - GATE_HOLE.y) >= GATE_HOLE.radius;
}

export function islandBlocksView(x, y, z) {
  if (x < ISLAND_BOUNDS.x0 || x > ISLAND_BOUNDS.x1 || z < ISLAND_BOUNDS.z0 || z > ISLAND_BOUNDS.z1) return false;
  const reach = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  if (reach >= RAIL_BAND.inner && reach <= RAIL_BAND.outer && y < RAIL_BAND.top && y > ISLAND.y - 1) return true;
  if (underRock(x, y, z, ISLAND.x, ISLAND.y, ISLAND.z, ISLAND.radius + 0.5, 18)) return true;
  if (inGate(x, y, z)) return true;
  return PLATFORMS.some((stage) => underRock(x, y, z, stage.x, stage.y, stage.z, stage.r + 0.5, stage.r * 1.8));
}

export function islandFloor(x, z) {
  if (inDisc(x, z, WALK_RADIUS)) return ISLAND.y;
  for (const stage of PLATFORMS) if ((x - stage.x) ** 2 + (z - stage.z) ** 2 <= (stage.r - 0.3) ** 2) return stage.y;
  return null;
}

export function islandNavFloor(x, z) {
  return inDisc(x, z, WALK_RADIUS) ? ISLAND.y : NaN;
}

function obstacleBoxes() {
  const boxes = [];
  for (let i = 0; i < RAIL_SEGMENTS; i++) {
    const a0 = (i / RAIL_SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / RAIL_SEGMENTS) * Math.PI * 2;
    const xs = [Math.cos(a0), Math.cos(a1)].map((c) => ISLAND.x + c * RAIL_RADIUS);
    const zs = [Math.sin(a0), Math.sin(a1)].map((s) => ISLAND.z + s * RAIL_RADIUS);
    boxes.push({ minX: Math.min(...xs) - 0.2, maxX: Math.max(...xs) + 0.2, minZ: Math.min(...zs) - 0.2, maxZ: Math.max(...zs) + 0.2, minY: ISLAND.y, maxY: ISLAND.y + 1.2 });
  }
  const gate = GATE.radius + GATE.tube;
  boxes.push({ minX: GATE.x - gate - 0.3, maxX: GATE.x - gate + 0.5, minZ: GATE.z - 0.5, maxZ: GATE.z + 0.5, minY: ISLAND.y, maxY: ISLAND.y + 4.2 });
  boxes.push({ minX: GATE.x + gate - 0.5, maxX: GATE.x + gate + 0.3, minZ: GATE.z - 0.5, maxZ: GATE.z + 0.5, minY: ISLAND.y, maxY: ISLAND.y + 4.2 });
  const dais = DAIS.tiers[0] * 0.92;
  boxes.push({ minX: ISLAND.x - dais, maxX: ISLAND.x + dais, minZ: ISLAND.z - dais, maxZ: ISLAND.z + dais, minY: ISLAND.y, maxY: DAIS_TOP + 0.4 });
  return boxes;
}

function checker(b, cx, top, cz, radius, size, light, dark) {
  const span = Math.ceil(radius / size);
  for (let i = -span; i < span; i++) {
    for (let j = -span; j < span; j++) {
      const x = cx + (i + 0.5) * size;
      const z = cz + (j + 0.5) * size;
      if ((x - cx) ** 2 + (z - cz) ** 2 > (radius - size * 0.5) ** 2) continue;
      b.add(shapes.box(size, TILE_DEPTH, size), (i + j) % 2 === 0 ? light : dark, { p: [x, top - TILE_DEPTH / 2, z] });
    }
  }
}

function floatingRock(b, x, top, z, radius, depth) {
  const rim = top - TILE_DEPTH;
  const lid = rim - RIM_DEPTH - SINK;
  b.add(shapes.cylinder(radius + 0.12, radius + 0.12, RIM_DEPTH, 32), MARBLE, { p: [x, rim - RIM_DEPTH / 2, z] });
  b.add(shapes.cylinder(radius, radius * 0.96, 0.7, 32), ROCK, { p: [x, lid - 0.35, z] });
  b.add(shapes.cone(radius * 0.94, depth, 16), ROCK_DARK, { p: [x, lid - 0.7 - depth / 2, z], r: [Math.PI, 0, 0] });
}

function islandMesh() {
  const b = new Batch();
  floatingRock(b, ISLAND.x, ISLAND.y, ISLAND.z, ISLAND.radius + 0.3, 18);
  checker(b, ISLAND.x, ISLAND.y, ISLAND.z, ISLAND.radius - 0.4, TILE, MARBLE, SLATE);
  for (let i = 0; i < RAIL_SEGMENTS; i += 2) {
    const a = (i / RAIL_SEGMENTS) * Math.PI * 2;
    const x = ISLAND.x + Math.cos(a) * RAIL_RADIUS;
    const z = ISLAND.z + Math.sin(a) * RAIL_RADIUS;
    b.add(shapes.box(0.26, 1.05, 0.26), MARBLE, { p: [x, ISLAND.y + 0.52, z] });
    b.add(shapes.sphere(0.17, 10, 8), JADE, { p: [x, ISLAND.y + 1.12, z] });
  }
  b.add(shapes.torus(RAIL_RADIUS, 0.08, 120), JADE, { p: [ISLAND.x, ISLAND.y + 0.95, ISLAND.z], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.torus(RAIL_RADIUS, 0.05, 120), MARBLE, { p: [ISLAND.x, ISLAND.y + 0.45, ISLAND.z], r: [Math.PI / 2, 0, 0] });
  DAIS.tiers.forEach((radius, i) => {
    b.add(shapes.cylinder(radius, radius + 0.06, DAIS.step, 8), MARBLE, { p: [ISLAND.x, ISLAND.y + DAIS.step * (i + 0.5), ISLAND.z], r: [0, Math.PI / 8, 0] });
    b.add(shapes.cylinder(radius + 0.02, radius + 0.02, 0.04, 8), GILT, { p: [ISLAND.x, ISLAND.y + DAIS.step * (i + 1), ISLAND.z], r: [0, Math.PI / 8, 0] });
  });
  const gx = GATE.radius + GATE.tube;
  b.add(shapes.torus(GATE.radius, GATE.tube, 40), MARBLE, { p: [GATE.x, ISLAND.y + GATE.radius + 0.35, GATE.z] });
  b.add(shapes.torus(GATE.radius + GATE.tube * 0.9, 0.06, 40), GILT, { p: [GATE.x, ISLAND.y + GATE.radius + 0.35, GATE.z] });
  b.add(shapes.box(gx * 2 + 0.8, 0.4, 1), MARBLE, { p: [GATE.x, ISLAND.y + 0.2, GATE.z] });
  for (const side of [-1, 1]) {
    b.add(shapes.box(0.7, 0.9, 0.9), MARBLE, { p: [GATE.x + side * gx, ISLAND.y + 0.65, GATE.z] });
    b.add(shapes.cone(0.32, 0.6, 8), JADE, { p: [GATE.x + side * gx, ISLAND.y + 1.4, GATE.z] });
  }
  b.add(shapes.box(gx * 2 + 1.6, 0.16, 1.3), LACQUER, { p: [GATE.x, ISLAND.y + GATE.radius * 2 + 0.9, GATE.z], r: [0, 0, 0] });
  b.add(shapes.box(gx * 2 + 2.2, 0.1, 1.5), JADE, { p: [GATE.x, ISLAND.y + GATE.radius * 2 + 1.04, GATE.z] });
  return b.mesh(groundMaterial());
}

const groundMaterial = () => toonMaterial({ vertexColors: true, emissive: 0x2c2e34 });
const glowMaterial = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });

function stageMesh(stage, material) {
  const b = new Batch();
  floatingRock(b, stage.x, stage.y, stage.z, stage.r + 0.2, stage.r * 1.8);
  checker(b, stage.x, stage.y, stage.z, stage.r - 0.1, stage.r > 4 ? 1 : 0.875, MARBLE, SLATE);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const x = stage.x + Math.cos(a) * (stage.r - 0.25);
    const z = stage.z + Math.sin(a) * (stage.r - 0.25);
    b.add(shapes.cylinder(0.12, 0.15, 2.2, 8), LACQUER, { p: [x, stage.y + 1.1, z] });
    b.add(shapes.cone(0.26, 0.34, 8), JADE, { p: [x, stage.y + 2.38, z] });
  }
  return b.mesh(material);
}

function stageGlow(stage, material) {
  const b = new Batch();
  b.add(shapes.torus(stage.r + 0.32, 0.07, 64), GLOW, { p: [stage.x, stage.y - 0.2, stage.z], r: [Math.PI / 2, 0, 0] });
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    b.add(shapes.sphere(0.16, 10, 8), GLOW, { p: [stage.x + Math.cos(a) * (stage.r - 0.25), stage.y + 2.0, stage.z + Math.sin(a) * (stage.r - 0.25)] });
  }
  return b.mesh(material, { shadow: false });
}

function glowMesh() {
  const b = new Batch();
  for (let i = 0; i < RAIL_SEGMENTS; i += 4) {
    const a = (i / RAIL_SEGMENTS) * Math.PI * 2;
    b.add(shapes.sphere(0.13, 10, 8), GLOW, { p: [ISLAND.x + Math.cos(a) * RAIL_RADIUS, ISLAND.y + 1.32, ISLAND.z + Math.sin(a) * RAIL_RADIUS] });
  }
  b.add(shapes.torus(ISLAND.radius + 0.44, 0.07, 140), GLOW, { p: [ISLAND.x, ISLAND.y - 0.2, ISLAND.z], r: [Math.PI / 2, 0, 0] });
  return b.mesh(glowMaterial(), { shadow: false });
}

function canvasTexture(size, paint, height = size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  paint(canvas.getContext('2d'), size, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function runeTexture() {
  return canvasTexture(512, (ctx, size) => {
    const c = size / 2;
    ctx.strokeStyle = '#bfe8ff';
    ctx.fillStyle = '#bfe8ff';
    ctx.shadowColor = '#7cc4ff';
    ctx.shadowBlur = 12;
    for (const [radius, width] of [
      [244, 6],
      [214, 3],
      [150, 4],
      [118, 2],
    ]) {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(c, c, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = `bold 34px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    GLYPHS.forEach((glyph, i) => {
      const a = (i / GLYPHS.length) * Math.PI * 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * 182, c + Math.sin(a) * 182);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
    });
    ctx.lineWidth = 3;
    for (const offset of [0, Math.PI / 6]) {
      ctx.beginPath();
      for (let k = 0; k <= 3; k++) {
        const a = offset + (k / 3) * Math.PI * 2 - Math.PI / 2;
        const x = c + Math.cos(a) * 150;
        const y = c + Math.sin(a) * 150;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function swirlTexture() {
  return canvasTexture(256, (ctx, size) => {
    const c = size / 2;
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.35, 'rgba(160,210,255,0.7)');
    glow.addColorStop(0.8, 'rgba(110,90,220,0.35)');
    glow.addColorStop(1, 'rgba(110,90,220,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      for (let k = 0; k <= 60; k++) {
        const t = k / 60;
        const a = arm * (Math.PI / 2) + t * Math.PI * 2.2;
        const r = t * c * 0.95;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function threadTexture() {
  const texture = canvasTexture(64, (ctx, size) => {
    const fade = ctx.createLinearGradient(0, 0, 0, size);
    fade.addColorStop(0, 'rgba(255,240,200,0)');
    fade.addColorStop(0.35, 'rgba(255,230,170,0.5)');
    fade.addColorStop(1, 'rgba(255,250,230,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, size, size);
    const edge = ctx.createLinearGradient(0, 0, size, 0);
    edge.addColorStop(0, 'rgba(0,0,0,1)');
    edge.addColorStop(0.5, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, size, size);
  });
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function haloTexture() {
  return canvasTexture(256, (ctx, size) => {
    const c = size / 2;
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgba(255,236,170,0.9)');
    glow.addColorStop(0.45, 'rgba(255,214,120,0.35)');
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  });
}

function skyGateTexture() {
  return canvasTexture(
    1024,
    (ctx, w, h) => {
      const glowing = (color, blur) => {
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
      };
      const opening = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, w * 0.26);
      opening.addColorStop(0, 'rgba(255,246,214,0.75)');
      opening.addColorStop(0.5, 'rgba(255,226,170,0.3)');
      opening.addColorStop(1, 'rgba(255,226,170,0)');
      ctx.fillStyle = opening;
      ctx.fillRect(0, 0, w, h);

      glowing('rgba(255,214,160,0.9)', 28);
      for (const cx of [0.25, 0.75]) {
        const pillar = ctx.createLinearGradient(0, h * 0.06, 0, h);
        pillar.addColorStop(0, '#f08a74');
        pillar.addColorStop(0.5, '#d65a4c');
        pillar.addColorStop(1, 'rgba(214,90,76,0)');
        ctx.fillStyle = pillar;
        ctx.fillRect(w * (cx - 0.015), h * 0.06, w * 0.03, h * 0.94);
        ctx.fillStyle = '#ffe2a0';
        for (const band of [0.24, 0.42]) ctx.fillRect(w * (cx - 0.019), h * band, w * 0.038, h * 0.012);
      }

      ctx.fillStyle = '#d65a4c';
      ctx.fillRect(w * 0.19, h * 0.2, w * 0.62, h * 0.024);
      ctx.fillRect(w * 0.13, h * 0.135, w * 0.74, h * 0.03);

      const roof = ctx.createLinearGradient(0, h * 0.02, 0, h * 0.13);
      roof.addColorStop(0, '#b4f0dc');
      roof.addColorStop(1, '#4fae94');
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(w * 0.05, h * 0.015);
      ctx.quadraticCurveTo(w * 0.5, h * 0.11, w * 0.95, h * 0.015);
      ctx.lineTo(w * 0.92, h * 0.07);
      ctx.quadraticCurveTo(w * 0.5, h * 0.155, w * 0.08, h * 0.07);
      ctx.closePath();
      ctx.fill();
      glowing('rgba(255,230,170,0.9)', 10);
      ctx.strokeStyle = '#ffe2a0';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#f2c96a';
      ctx.fillRect(w * 0.465, h * 0.09, w * 0.07, h * 0.135);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8a1a14';
      ctx.font = `900 ${h * 0.05}px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('天', w / 2, h * 0.128);
      ctx.fillText('門', w / 2, h * 0.188);

      glowing('rgba(255,255,255,0.8)', 40);
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      for (let i = 0; i < 18; i++) {
        const x = w * (0.08 + (i / 17) * 0.84);
        const y = h * (0.66 + Math.sin(i * 2.3) * 0.06);
        ctx.beginPath();
        ctx.arc(x, y, h * (0.07 + ((i * 37) % 5) * 0.012), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'destination-in';
      const fade = ctx.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, 'rgba(0,0,0,1)');
      fade.addColorStop(0.45, 'rgba(0,0,0,1)');
      fade.addColorStop(0.92, 'rgba(0,0,0,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w, h);
    },
    512,
  );
}

const additive = (options) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...options });

let moteMap = null;

function moteTexture() {
  moteMap ??= canvasTexture(64, (ctx, size) => {
    const c = size / 2;
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  });
  return moteMap;
}

function motes(count, spread, low, high, color, size, seed) {
  const rand = makeRandom(seed);
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * spread;
    positions.set([Math.cos(a) * r, low + rand() * (high - low), Math.sin(a) * r], i * 3);
    speeds[i] = 0.25 + rand() * 0.6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, map: moteTexture(), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  points.frustumCulled = false;
  return {
    points,
    update(dt) {
      const list = geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        let y = list[i * 3 + 1] + speeds[i] * dt;
        if (y > high) y = low;
        list[i * 3 + 1] = y;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

function skyLayout() {
  const lamps = [
    { x: ISLAND.x, y: CRYSTAL_Y, z: ISLAND.z, size: 5 },
    { x: GATE.x, y: ISLAND.y + GATE.radius + 0.35, z: GATE.z, size: 6 },
  ];
  for (let i = 0; i < RAIL_SEGMENTS; i += 4) {
    const a = (i / RAIL_SEGMENTS) * Math.PI * 2;
    lamps.push({ x: ISLAND.x + Math.cos(a) * RAIL_RADIUS, y: ISLAND.y + 1.32, z: ISLAND.z + Math.sin(a) * RAIL_RADIUS, size: 1.1 });
  }
  for (const [index, stage] of PLATFORMS.entries()) {
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      lamps.push({ x: stage.x + Math.cos(a) * (stage.r - 0.25), y: stage.y + 2.0, z: stage.z + Math.sin(a) * (stage.r - 0.25), size: 1.2, stage: index });
    }
  }
  const banners = [0.15, 0.85, 1.15, 1.85].map((turn) => {
    const a = turn * Math.PI;
    return { x: ISLAND.x + Math.cos(a) * (RAIL_RADIUS - 0.5), z: ISLAND.z + Math.sin(a) * (RAIL_RADIUS - 0.5), angle: -a + Math.PI / 2 };
  });
  return {
    ...ISLAND,
    lamps,
    banners,
    falls: [{ angle: 0 }, { angle: Math.PI }, { angle: Math.PI * 1.32 }],
    pavilions: [
      { x: ISLAND.x + 30, z: ISLAND.z + 4, lift: 3, size: 1.3 },
      { x: ISLAND.x - 31, z: ISLAND.z - 2, lift: 6, size: 1.1 },
      { x: ISLAND.x + 6, z: ISLAND.z + 34, lift: -2, size: 0.9 },
    ],
  };
}

export function createArenaIsland({ onPortal, onBoard, boardSize, camera, night = () => 0, overview = () => false, shown = () => true }) {
  const obstacles = obstacleBoxes();
  const canvas = document.createElement('canvas');
  canvas.width = boardSize.width;
  canvas.height = boardSize.height;
  const board = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const runes = runeTexture();
  const swirl = swirlTexture();
  const halo = haloTexture();
  let painted = null;
  let focused = null;
  let facing = 1;

  function skyBoard() {
    const holder = new THREE.Group();
    holder.position.set(ISLAND.x, BOARD.y, ISLAND.z);
    const tilt = new THREE.Group();
    tilt.rotation.x = BOARD.tilt;
    holder.add(tilt);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.width * 1.7, BOARD.height * 1.9), additive({ map: halo, opacity: 0.55 }));
    glow.position.z = -0.12;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.width, BOARD.height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
    face.userData.board = true;
    const rods = new Batch();
    for (const side of [-1, 1]) {
      const y = (side * BOARD.height) / 2 + side * 0.12;
      rods.add(shapes.cylinder(0.16, 0.16, BOARD.width + 0.6, 16), LACQUER, { p: [0, y, 0], r: [0, 0, Math.PI / 2] });
      for (const end of [-1, 1]) rods.add(shapes.sphere(0.28, 12, 10), GILT, { p: [end * (BOARD.width / 2 + 0.42), y, 0] });
    }
    tilt.add(glow, face, rods.mesh(toonMaterial({ vertexColors: true, emissive: 0x3a2a1a }), { shadow: false }));
    return { holder, face };
  }

  return {
    paintBoard(key, paint) {
      if (key === painted) return;
      painted = key;
      paint(board);
      texture.needsUpdate = true;
    },
    focusStage(stage, toward = 1) {
      focused = stage;
      facing = toward;
    },
    region: {
      id: 'arena',
      name: 'Lôi đài',
      bounds: ISLAND_BOUNDS,
      staticNav: true,
      shown,
      obstacles,
      target(hit) {
        if (hit.object.userData.board) return { kind: 'board', id: 'board', index: 'board', x: ISLAND.x, z: ISLAND.z, stand: BOARD_STAND };
        if (!hit.object.userData.portal) return null;
        return { kind: 'portal', id: 'portal', index: 'portal', x: GATE.x, z: GATE.z, stand: GATE_STAND };
      },
      actionFor() {
        return { id: 'visit', hint: 'hand' };
      },
      topOf(target) {
        return target.kind === 'board' ? new THREE.Vector3(ISLAND.x, CRYSTAL_Y + 1, ISLAND.z) : new THREE.Vector3(GATE.x, ISLAND.y + GATE.radius * 2 + 1.6, GATE.z);
      },
      act(action, target) {
        if (target.kind === 'portal') onPortal();
        if (target.kind === 'board') onBoard();
        return null;
      },
      load() {
        const group = new THREE.Group();
        const scenery = new THREE.Group();
        const ground = islandMesh();
        scenery.add(ground, glowMesh());
        const stageSolid = groundMaterial();
        const stageLight = glowMaterial();
        const stageParts = PLATFORMS.map((stage) => {
          const part = new THREE.Group();
          const solid = stageMesh(stage, stageSolid);
          part.add(solid, stageGlow(stage, stageLight));
          scenery.add(part);
          return { stage, part, solid };
        });
        freeze(scenery);

        const vortex = new THREE.Mesh(new THREE.CircleGeometry(GATE.radius - 0.05, 40), additive({ map: swirl, opacity: 0.9 }));
        vortex.position.set(GATE.x, ISLAND.y + GATE.radius + 0.35, GATE.z);
        vortex.userData.portal = true;
        const gateRunes = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), additive({ map: runes, opacity: 0.75 }));
        gateRunes.rotation.x = -Math.PI / 2;
        gateRunes.position.set(GATE.x, ISLAND.y + 0.03, GATE.z - 2);
        gateRunes.userData.portal = true;

        const daisRunes = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), additive({ map: runes, opacity: 0.6, color: 0xffe6a8 }));
        daisRunes.rotation.x = -Math.PI / 2;
        daisRunes.position.set(ISLAND.x, DAIS_TOP + 0.06, ISLAND.z);
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: 0xbff0e0, transparent: true, opacity: 0.92 }));
        crystal.position.set(ISLAND.x, CRYSTAL_Y, ISLAND.z);
        crystal.userData.board = true;
        const beamHeight = BOARD.y - BOARD.height / 2 - CRYSTAL_Y;
        const thread = threadTexture();
        const beam = new THREE.Group();
        beam.position.set(ISLAND.x, CRYSTAL_Y + beamHeight / 2, ISLAND.z);
        for (const turn of [0, Math.PI / 2]) {
          const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.22, beamHeight), additive({ map: thread, color: 0xffe6a8, opacity: 0.55 }));
          ribbon.rotation.y = turn;
          beam.add(ribbon);
        }
        const threadMotes = motes(36, 0.18, 0, beamHeight, 0xffe6a8, 0.22, 63);
        threadMotes.points.position.set(ISLAND.x, CRYSTAL_Y, ISLAND.z);

        const stageRunes = stageParts.map(({ stage }) => {
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(stage.r * 1.7, stage.r * 1.7), additive({ map: runes, opacity: 0.5, color: 0xffe6a8 }));
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(stage.x, stage.y + 0.02, stage.z);
          return mesh;
        });

        const sky = skyBoard();
        const gateMotes = motes(60, 1.6, 0.2, 5, 0xbfe8ff, 0.3, 77);
        gateMotes.points.position.set(GATE.x, ISLAND.y, GATE.z);
        const islandMotes = motes(140, ISLAND.radius + 6, -4, 16, 0xffe6a8, 0.35, 91);
        islandMotes.points.position.set(ISLAND.x, ISLAND.y, ISLAND.z);

        const skyGate = new THREE.Group();
        const gateFace = new THREE.Mesh(
          new THREE.PlaneGeometry(SKY_GATE.width, SKY_GATE.height),
          new THREE.MeshBasicMaterial({ map: skyGateTexture(), transparent: true, depthWrite: false, opacity: SKY_GATE.opacity }),
        );
        const gateHalo = new THREE.Mesh(new THREE.PlaneGeometry(SKY_GATE.width * 0.8, SKY_GATE.height * 1.3), additive({ map: halo, opacity: 0.4 }));
        gateHalo.position.set(0, -SKY_GATE.height * 0.1, -0.5);
        skyGate.add(gateHalo, gateFace);
        skyGate.visible = false;

        const heaven = createArenaSky(skyLayout());
        group.add(scenery, heaven.group, skyGate, vortex, gateRunes, daisRunes, crystal, beam, threadMotes.points, ...stageRunes, sky.holder, gateMotes.points, islandMotes.points);
        const look = new THREE.Vector3();
        return {
          group,
          clickables: [ground, ...stageParts.map(({ solid }) => solid), vortex, gateRunes, crystal, sky.face],
          update(t, dt = 0) {
            for (const [i, { stage, part }] of stageParts.entries()) {
              const shown = !focused || stage === focused;
              part.visible = shown;
              stageRunes[i].visible = shown;
              heaven.showStage(i, shown);
            }
            skyGate.visible = Boolean(focused);
            if (focused) {
              skyGate.position.set(focused.x, focused.y + SKY_GATE.top - SKY_GATE.height / 2, focused.z - facing * SKY_GATE.back);
              skyGate.rotation.y = facing > 0 ? 0 : Math.PI;
              gateFace.material.opacity = SKY_GATE.opacity + Math.sin(t * 0.8) * 0.08;
              gateHalo.material.opacity = 0.32 + Math.sin(t * 1.3) * 0.12;
            }
            vortex.rotation.z = -t * 1.4;
            gateRunes.rotation.z = t * 0.35;
            daisRunes.rotation.z = -t * 0.25;
            for (const [i, mesh] of stageRunes.entries()) mesh.rotation.z = t * (i % 2 ? 0.2 : -0.2);
            crystal.rotation.y = t * 0.9;
            crystal.position.y = CRYSTAL_Y + Math.sin(t * 1.6) * 0.15;
            for (const ribbon of beam.children) ribbon.material.opacity = 0.45 + Math.sin(t * 2.1) * 0.15;
            threadMotes.update(dt * 4);
            sky.holder.position.y = BOARD.y + Math.sin(t * 0.7) * 0.3;
            camera.getWorldPosition(look);
            sky.holder.rotation.y = Math.atan2(look.x - ISLAND.x, look.z - ISLAND.z);
            gateMotes.update(dt);
            islandMotes.update(dt);
            heaven.showBackdrop(!overview());
            heaven.update(t, dt, Math.min(1, Math.max(0, night())));
          },
        };
      },
    },
  };
}
