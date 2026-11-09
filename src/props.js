import * as THREE from 'three';
import { Batch, labelBox, shapes, shade, toonMaterial, vertexMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { keepCanvas } from './canvasRestore.js';

const OUTLINE = 0.01;
const WOOD = 0xa8693a;
const WOOD_DARK = 0x5e3820;
const LACQUER = 0xb02e1f;
const GOLD = 0xf2c14e;
const PAPER = 0xfbf5e4;
const INK = 0x1a1618;
const STRAW = 0xe6cf8f;
const STRAW_DARK = 0xcdb070;
const MAT_EDGE = 0xb0402c;
const BOOKS = [0xe0b84e, 0x9c3324, 0x3d5f8f, 0x7a5233, PAPER, 0x5e8a4a];

function finish(batch, material = vertexMaterial()) {
  return batch.mesh(material, { outline: OUTLINE });
}

function inkStrokes(b, rand, cx, y, cz, w, d, count) {
  for (let i = 0; i < count; i++) {
    const x = cx + (rand() - 0.5) * w;
    const z = cz + (rand() - 0.5) * d;
    b.add(shapes.box(0.012 + rand() * 0.04, 0.004, 0.012), INK, { p: [x, y, z], r: [0, rand() * Math.PI, 0] });
  }
}

export function studentFurniture(seed) {
  const rand = makeRandom(seed);
  const b = new Batch();
  b.add(shapes.box(1.0, 0.02, 0.72), STRAW, { p: [0, 0.01, -0.03] });
  for (let x = -0.4; x <= 0.41; x += 0.1) b.add(shapes.box(0.012, 0.022, 0.6), STRAW_DARK, { p: [x, 0.011, -0.03] });
  for (const z of [-0.36, 0.3]) b.add(shapes.box(1.02, 0.032, 0.07), MAT_EDGE, { p: [0, 0.016, z] });

  b.add(shapes.rounded(0.86, 0.05, 0.42, 0.02), WOOD, { p: [0, 0.275, 0.44] });
  for (const x of [-0.38, 0.38]) {
    for (const z of [0.28, 0.6]) b.add(shapes.box(0.05, 0.25, 0.05), WOOD_DARK, { p: [x, 0.125, z] });
  }
  b.add(shapes.box(0.38, 0.006, 0.28), PAPER, { p: [-0.02, 0.303, 0.4] });
  inkStrokes(b, rand, -0.02, 0.307, 0.4, 0.3, 0.2, 9);
  b.add(shapes.rounded(0.14, 0.03, 0.1, 0.012), 0x45454c, { p: [-0.3, 0.315, 0.55] });
  b.add(shapes.cylinder(0.03, 0.03, 0.004, 10), INK, { p: [-0.3, 0.332, 0.55] });
  b.add(shapes.box(0.13, 0.03, 0.17), BOOKS[Math.floor(rand() * 3)], { p: [0.3, 0.315, 0.53], r: [0, rand() * 0.4 - 0.2, 0] });
  return finish(b);
}

export function teacherPlatform() {
  const b = new Batch();
  b.add(shapes.rounded(3.0, 0.12, 2.25, 0.04), WOOD_DARK, { p: [0, 0.44, 0] });
  for (const x of [-1.4, 0, 1.4]) {
    for (const z of [-1.02, 1.02]) b.add(shapes.box(0.16, 0.38, 0.16), shade(WOOD_DARK, 0.85), { p: [x, 0.19, z] });
  }
  for (const z of [-1.1, 1.1]) b.add(shapes.box(2.7, 0.1, 0.04), shade(WOOD_DARK, 0.75), { p: [0, 0.33, z] });

  b.add(shapes.box(2.5, 0.02, 1.9), STRAW, { p: [0, 0.51, 0] });
  for (const z of [-0.92, 0.92]) b.add(shapes.box(2.52, 0.032, 0.08), MAT_EDGE, { p: [0, 0.516, z] });
  for (const x of [-1.22, 1.22]) b.add(shapes.box(0.08, 0.03, 1.92), MAT_EDGE, { p: [x, 0.515, 0] });
  for (let x = -1.0; x <= 1.01; x += 0.5) {
    for (let z = -0.65; z <= 0.66; z += 0.43) {
      b.add(shapes.cylinder(0.07, 0.07, 0.006, 10), 0xc4473a, { p: [x, 0.523, z] });
      b.add(shapes.cylinder(0.025, 0.025, 0.008, 8), GOLD, { p: [x, 0.526, z] });
    }
  }
  b.add(shapes.rounded(0.78, 0.1, 0.66, 0.045), 0x8e2f22, { p: [0, 0.57, -0.36] });
  b.add(shapes.rounded(0.66, 0.012, 0.54, 0.005), GOLD, { p: [0, 0.621, -0.36] });
  return finish(b);
}

export function lacquerDesk() {
  const rand = makeRandom(31);
  const b = new Batch();
  b.add(shapes.rounded(1.7, 0.06, 0.5, 0.02), LACQUER, { p: [0, 0.39, 0.2] });
  b.add(shapes.box(1.72, 0.012, 0.52), GOLD, { p: [0, 0.362, 0.2] });
  b.add(shapes.box(1.6, 0.1, 0.03), LACQUER, { p: [0, 0.31, 0.44] });
  for (let x = -0.7; x <= 0.71; x += 0.35) b.add(shapes.sphere(0.018, 8, 6), GOLD, { p: [x, 0.31, 0.46] });
  for (const x of [-0.78, 0.78]) {
    for (const z of [0.0, 0.4]) {
      b.add(shapes.box(0.08, 0.34, 0.08), LACQUER, { p: [x, 0.19, z] });
      b.add(shapes.box(0.11, 0.035, 0.11), GOLD, { p: [x, 0.018, z] });
    }
  }
  b.add(shapes.box(0.3, 0.04, 0.22), 0xe0b84e, { p: [0.62, 0.44, 0.2], r: [0, 0.08, 0] });
  b.add(shapes.box(0.3, 0.04, 0.22), 0x9c3324, { p: [0.62, 0.48, 0.2], r: [0, -0.06, 0] });
  b.add(shapes.box(0.28, 0.04, 0.2), 0xe0b84e, { p: [0.63, 0.52, 0.21], r: [0, 0.14, 0] });
  b.add(shapes.rounded(0.2, 0.04, 0.14, 0.015), 0x45454c, { p: [-0.12, 0.44, 0.22] });
  b.add(shapes.cylinder(0.04, 0.04, 0.004, 10), INK, { p: [-0.12, 0.462, 0.22] });
  b.add(shapes.box(0.26, 0.006, 0.32), PAPER, { p: [0.2, 0.423, 0.2] });
  inkStrokes(b, rand, 0.2, 0.427, 0.2, 0.2, 0.24, 8);
  b.add(shapes.cylinder(0.06, 0.055, 0.2, 14), 0x8a6a3e, { p: [-0.6, 0.52, 0.22] });
  for (const [dx, dz, tilt] of [[0, 0, 0.1], [0.025, 0.02, -0.15], [-0.02, -0.02, 0.2]]) {
    b.limb([-0.6 + dx, 0.5, 0.22 + dz], [-0.6 + dx + tilt * 0.3, 0.74, 0.22 + dz], 0.01, 0x3a2a1a, { capsule: false, seg: 6 });
  }
  return finish(b);
}

export function teaSet() {
  const b = new Batch();
  b.add(shapes.rounded(0.42, 0.03, 0.32, 0.01), WOOD_DARK, { p: [0, 0.015, 0] });
  b.add(shapes.sphere(0.09, 14, 10), 0x8e4a35, { p: [-0.06, 0.1, 0], s: [1, 0.8, 1] });
  b.add(shapes.cylinder(0.04, 0.05, 0.03, 12), 0x7a3e2c, { p: [-0.06, 0.175, 0] });
  b.add(shapes.sphere(0.015, 6, 4), 0x7a3e2c, { p: [-0.06, 0.2, 0] });
  b.limb([0.01, 0.09, 0], [0.09, 0.15, 0], 0.014, 0x8e4a35);
  b.add(shapes.torus(0.045, 0.011, 12), 0x8e4a35, { p: [-0.15, 0.11, 0] });
  for (const [x, z] of [[0.1, 0.09], [0.14, -0.02], [0.08, -0.1]]) {
    b.add(shapes.cylinder(0.032, 0.025, 0.04, 12), 0xf6f2ea, { p: [x, 0.05, z] });
  }
  return finish(b);
}

export function bookshelf(seed) {
  const rand = makeRandom(seed);
  const b = new Batch();
  b.add(shapes.box(1.5, 1.9, 0.04), WOOD_DARK, { p: [0, 0.95, 0.02] });
  for (const x of [-0.72, 0.72]) b.add(shapes.box(0.06, 1.9, 0.5), WOOD_DARK, { p: [x, 0.95, 0.25] });
  const shelves = [0.03, 0.65, 1.27, 1.87];
  for (const y of shelves) b.add(shapes.box(1.5, 0.05, 0.5), WOOD_DARK, { p: [0, y, 0.25] });
  for (const y of shelves.slice(0, 3)) {
    let x = -0.66;
    while (x < 0.62) {
      if (rand() < 0.18) {
        const r = 0.04 + rand() * 0.02;
        b.add(shapes.cylinder(r, r, 0.4, 10), PAPER, { p: [x + r, y + 0.03 + r, 0.28], r: [Math.PI / 2, 0, 0] });
        x += r * 2 + 0.02;
        continue;
      }
      const w = Math.min(0.04 + rand() * 0.05, 0.66 - x);
      const h = 0.3 + rand() * 0.22;
      b.add(shapes.box(w, h, 0.36), BOOKS[Math.floor(rand() * BOOKS.length)], { p: [x + w / 2, y + 0.025 + h / 2, 0.26] });
      x += w + 0.005;
    }
  }
  return finish(b);
}

export function drum() {
  const b = new Batch();
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    b.limb([x * 0.34, 0, z * 0.34], [x * 0.24, 0.42, z * 0.24], 0.035, WOOD_DARK, { capsule: false, seg: 8 });
  }
  b.add(
    shapes.lathe([[0, 0], [0.38, 0], [0.44, 0.12], [0.46, 0.25], [0.44, 0.38], [0.38, 0.5], [0, 0.5]], 22),
    LACQUER,
    { p: [0, 0.4, 0] },
  );
  b.add(shapes.cylinder(0.37, 0.37, 0.02, 22), 0xf0dcb0, { p: [0, 0.91, 0] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    for (const [y, r] of [[0.44, 0.39], [0.86, 0.39]]) {
      b.add(shapes.sphere(0.02, 6, 4), GOLD, { p: [Math.cos(a) * r, y, Math.sin(a) * r] });
    }
  }
  b.limb([-0.25, 0.94, -0.1], [0.2, 0.94, 0.12], 0.02, 0x8a5a2b);
  b.limb([-0.2, 0.94, 0.12], [0.25, 0.94, -0.05], 0.02, 0x8a5a2b);
  return finish(b);
}

export function jar(seed) {
  const rand = makeRandom(seed);
  const b = new Batch();
  const glaze = rand() < 0.5 ? 0x8a4a2a : 0x6e4a32;
  b.add(
    shapes.lathe(
      [[0, 0], [0.2, 0], [0.32, 0.12], [0.38, 0.3], [0.36, 0.5], [0.28, 0.66], [0.24, 0.72], [0.28, 0.78], [0.26, 0.8], [0.21, 0.78], [0.2, 0.7], [0, 0.7]],
      20,
    ),
    glaze,
  );
  b.add(shapes.torus(0.355, 0.015, 20), shade(glaze, 0.7), { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.cylinder(0.205, 0.205, 0.01, 18), 0x3d6f8e, { p: [0, 0.74, 0] });
  return finish(b);
}

export function lantern() {
  const b = new Batch();
  b.limb([0, 0, 0], [0, -0.16, 0], 0.008, 0x3a2414, { capsule: false, seg: 6 });
  b.add(shapes.cylinder(0.12, 0.13, 0.05, 14), GOLD, { p: [0, -0.18, 0] });
  b.add(shapes.lathe([[0, 0], [0.13, 0], [0.22, 0.08], [0.25, 0.21], [0.22, 0.34], [0.13, 0.42], [0, 0.42]], 16), 0xd8321e, {
    p: [0, -0.62, 0],
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(shapes.box(0.01, 0.4, 0.01), 0x9c1e12, { p: [Math.cos(a) * 0.235, -0.41, Math.sin(a) * 0.235] });
  }
  b.add(shapes.cylinder(0.13, 0.12, 0.05, 14), GOLD, { p: [0, -0.645, 0] });
  b.add(shapes.cone(0.05, 0.16, 10), 0xc0281a, { p: [0, -0.75, 0], r: [Math.PI, 0, 0] });
  return finish(b, toonMaterial({ vertexColors: true, emissive: 0x5a1a08 }));
}

function cssColor(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

const CALLIGRAPHY = '"Water Brush", "Dancing Script", cursive';
const PLAIN_FONT = '"BIZ UDPGothic", system-ui, sans-serif';
const PLAIN_SCALE = 0.62;
const PX_PER_M = 256;

function wordFont(word, size, plain) {
  return plain.has(word) ? `700 ${size * PLAIN_SCALE}px ${PLAIN_FONT}` : `${size}px ${CALLIGRAPHY}`;
}

function lineWidth(ctx, line, size, plain) {
  if (!plain.size) {
    ctx.font = `${size}px ${CALLIGRAPHY}`;
    return ctx.measureText(line).width;
  }
  ctx.font = `${size}px ${CALLIGRAPHY}`;
  const space = ctx.measureText(' ').width;
  return line.split(' ').reduce((sum, word, i) => {
    ctx.font = wordFont(word, size, plain);
    return sum + ctx.measureText(word).width + (i ? space : 0);
  }, 0);
}

function drawLine(ctx, line, cx, y, size, plain) {
  if (!plain.size) {
    ctx.fillText(line, cx, y);
    return;
  }
  ctx.font = `${size}px ${CALLIGRAPHY}`;
  const space = ctx.measureText(' ').width;
  let left = cx - lineWidth(ctx, line, size, plain) / 2;
  ctx.textAlign = 'left';
  for (const word of line.split(' ')) {
    ctx.font = wordFont(word, size, plain);
    ctx.fillText(word, left, y);
    left += ctx.measureText(word).width + space;
  }
  ctx.textAlign = 'center';
  ctx.font = `${size}px ${CALLIGRAPHY}`;
}

function drawBoard(ctx, w, h, { lines, bg, fg, border, seal, plain = new Set() }) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = cssColor(bg);
  ctx.fillRect(0, 0, w, h);
  const edge = Math.min(w, h);
  ctx.strokeStyle = cssColor(border);
  ctx.lineWidth = edge * 0.045;
  ctx.strokeRect(edge * 0.04, edge * 0.04, w - edge * 0.08, h - edge * 0.08);
  ctx.lineWidth = edge * 0.012;
  ctx.strokeRect(edge * 0.1, edge * 0.1, w - edge * 0.2, h - edge * 0.2);

  const pad = edge * 0.16;
  const lineH = (h - pad * 2) / lines.length;
  const maxW = w - pad * 2;
  let size = lineH * 0.72;
  for (const line of lines) {
    const measured = lineWidth(ctx, line, size, plain);
    if (measured > maxW) size *= maxW / measured;
  }
  ctx.font = `${size}px ${CALLIGRAPHY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const y = pad + lineH * (i + 0.55);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    drawLine(ctx, line, w / 2 + size * 0.03, y + size * 0.03, size, plain);
    ctx.fillStyle = fg;
    drawLine(ctx, line, w / 2, y, size, plain);
  });

  if (seal) {
    const s = edge * 0.2;
    const x = w - pad - s * 0.4;
    const y = h - pad - s * 0.7;
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#f7e6c4';
    ctx.lineWidth = s * 0.09;
    ctx.strokeRect(x + s * 0.14, y + s * 0.14, s * 0.72, s * 0.72);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.5, y + s * 0.25);
    ctx.lineTo(x + s * 0.5, y + s * 0.75);
    ctx.moveTo(x + s * 0.28, y + s * 0.5);
    ctx.lineTo(x + s * 0.72, y + s * 0.5);
    ctx.stroke();
  }
}

export function textBoard({ lines, width, height, depth, bg, fg, border, seal = false, plain = [] }) {
  const plainWords = new Set(plain);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * PX_PER_M);
  canvas.height = Math.round(height * PX_PER_M);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const paint = () => {
    drawBoard(canvas.getContext('2d'), canvas.width, canvas.height, { lines, bg, fg, border, seal, plain: plainWords });
    texture.needsUpdate = true;
  };
  keepCanvas(texture, (ctx) => drawBoard(ctx, canvas.width, canvas.height, { lines, bg, fg, border, seal, plain: plainWords }));
  paint();
  document.fonts?.load(`64px "Water Brush"`, lines.join(' ')).then(paint, () => {});

  const mesh = new THREE.Mesh(labelBox(width, height, depth), toonMaterial({ map: texture }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
