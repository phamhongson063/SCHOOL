import * as THREE from 'three';
import { shade } from './toon.js';
import { keepCanvas } from './canvasRestore.js';

const SIZE = 256;
const LINE = '#3a2016';
const MOUTH = '#6e2a20';
const cache = new Map();

function rgba(hex, a = 1) {
  return `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function stroke(ctx, width, color, draw) {
  ctx.beginPath();
  draw();
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
}

function openEye(ctx, cx, cy, iris, old) {
  const rx = old ? 10 : 14;
  const ry = old ? 11 : 19;
  const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, rgba(shade(iris, 0.28)));
  g.addColorStop(0.6, rgba(shade(iris, 0.55)));
  g.addColorStop(1, rgba(shade(iris, 1.25)));
  ellipse(ctx, cx, cy, rx, ry, g);
  ellipse(ctx, cx - rx * 0.32, cy - ry * 0.34, rx * 0.42, rx * 0.42, '#ffffff');
  ellipse(ctx, cx + rx * 0.36, cy + ry * 0.42, rx * 0.17, rx * 0.17, 'rgba(255,255,255,0.85)');
  if (old) {
    for (const [dy, dx] of [[-3, 6], [5, 5]]) {
      stroke(ctx, 2.2, 'rgba(140,80,58,0.55)', () => {
        const outer = cx + Math.sign(cx - 128) * (rx + 6);
        ctx.moveTo(outer, cy + dy);
        ctx.lineTo(outer + Math.sign(cx - 128) * dx, cy + dy * 1.6);
      });
    }
  }
}

function heroEye(ctx, cx, cy, iris) {
  const rx = 17;
  const ry = 23;
  const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, rgba(shade(iris, 0.35)));
  g.addColorStop(0.55, rgba(iris));
  g.addColorStop(1, rgba(shade(iris, 1.6)));
  ellipse(ctx, cx, cy, rx, ry, g);
  ellipse(ctx, cx, cy + 2, rx * 0.45, ry * 0.45, rgba(shade(iris, 0.3)));
  const side = Math.sign(cx - 128);
  stroke(ctx, 5, '#1e120c', () => ctx.ellipse(cx, cy + 1, rx + 1.5, ry + 1, 0, Math.PI * 1.08, Math.PI * 1.92));
  stroke(ctx, 3.5, '#1e120c', () => {
    ctx.moveTo(cx + side * (rx - 1), cy - ry * 0.55);
    ctx.lineTo(cx + side * (rx + 6), cy - ry * 0.8);
  });
  ellipse(ctx, cx - rx * 0.3, cy - ry * 0.32, rx * 0.4, rx * 0.4, '#ffffff');
  ellipse(ctx, cx + rx * 0.34, cy + ry * 0.36, rx * 0.2, rx * 0.2, 'rgba(255,255,255,0.9)');
}

function smile(ctx, bottom) {
  const path = () => {
    ctx.moveTo(113, 151);
    ctx.quadraticCurveTo(128, 156, 143, 151);
    ctx.quadraticCurveTo(141, bottom - 1, 128, bottom);
    ctx.quadraticCurveTo(115, bottom - 1, 113, 151);
  };
  ctx.beginPath();
  path();
  ctx.closePath();
  ctx.fillStyle = '#7a2a24';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(112, 148, 32, 7);
  ellipse(ctx, 128, bottom, 9, 6, '#f08a8a');
  ctx.restore();
  stroke(ctx, 3, MOUTH, path);
}

function closedEye(ctx, cx, cy, old) {
  const r = old ? 11 : 14;
  stroke(ctx, 5, LINE, () => ctx.arc(cx, cy - r * 0.45, r, Math.PI * 0.18, Math.PI * 0.82));
}

function brows(ctx, eyes, color, { old, stern }) {
  for (const cx of eyes) {
    const side = Math.sign(cx - 128);
    const inner = cx - side * 12;
    const outer = cx + side * 13;
    const y = old ? 78 : 74;
    const innerY = stern ? y + 8 : y + 1;
    const outerY = stern ? y - 3 : y + 2;
    if (old) {
      stroke(ctx, 10, 'rgba(150,140,130,0.9)', () => {
        ctx.moveTo(inner, innerY);
        ctx.quadraticCurveTo(cx, y - 6, outer, outerY + 4);
      });
      stroke(ctx, 6, color, () => {
        ctx.moveTo(inner, innerY);
        ctx.quadraticCurveTo(cx, y - 6, outer, outerY + 4);
      });
      continue;
    }
    stroke(ctx, 4.5, color, () => {
      ctx.moveTo(inner, innerY);
      ctx.quadraticCurveTo(cx, y - 5, outer, outerY);
    });
  }
}

function cheeks(ctx, strength) {
  for (const x of [62, 194]) {
    const g = ctx.createRadialGradient(x, 146, 1, x, 146, 24);
    g.addColorStop(0, `rgba(255,128,128,${0.62 * strength})`);
    g.addColorStop(0.6, `rgba(255,140,140,${0.32 * strength})`);
    g.addColorStop(1, 'rgba(255,140,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, 146, 24, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function mouth(ctx, state) {
  if (state === 'talk') {
    ctx.beginPath();
    ctx.moveTo(117, 160);
    ctx.lineTo(139, 160);
    ctx.quadraticCurveTo(139, 180, 128, 180);
    ctx.quadraticCurveTo(117, 180, 117, 160);
    ctx.closePath();
    ctx.fillStyle = '#7a2a24';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ellipse(ctx, 128, 180, 9, 6, '#f08a8a');
    ctx.restore();
    stroke(ctx, 3, MOUTH, () => {
      ctx.moveTo(117, 160);
      ctx.lineTo(139, 160);
      ctx.quadraticCurveTo(139, 180, 128, 180);
      ctx.quadraticCurveTo(117, 180, 117, 160);
    });
    return;
  }
  stroke(ctx, 3.5, MOUTH, () => ctx.arc(128, 154, 9, Math.PI * 0.2, Math.PI * 0.8));
}

function drawHero(ctx, { iris, brow, state }) {
  const eyes = [84, 172];
  const cy = 108;
  cheeks(ctx, 1.15);
  for (const cx of eyes) {
    const side = Math.sign(cx - 128);
    stroke(ctx, 6, brow, () => {
      ctx.moveTo(cx - side * 14, 72);
      ctx.quadraticCurveTo(cx, 63, cx + side * 15, 69);
    });
    if (state === 'blink') stroke(ctx, 5, '#1e120c', () => ctx.arc(cx, cy - 6, 16, Math.PI * 0.15, Math.PI * 0.85));
    else heroEye(ctx, cx, cy, iris);
  }
  ellipse(ctx, 128, 137, 3.5, 2.5, 'rgba(190,100,80,0.55)');
  if (state === 'stern') stroke(ctx, 3.5, MOUTH, () => ctx.arc(128, 160, 8, Math.PI * 1.15, Math.PI * 1.85));
  else smile(ctx, state === 'talk' ? 180 : 168);
}

function draw(ctx, { iris, brow, old, beard, state, hero }) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  if (hero) {
    drawHero(ctx, { iris, brow, state });
    return;
  }
  const eyes = [86, 170];
  const cy = old ? 114 : 112;
  cheeks(ctx, old ? 0.55 : 1);
  brows(ctx, eyes, brow, { old, stern: state === 'stern' });
  for (const cx of eyes) {
    if (state === 'blink') closedEye(ctx, cx, cy, old);
    else openEye(ctx, cx, cy, iris, old);
  }
  ellipse(ctx, 128, 138, 3.5, 2.5, 'rgba(190,100,80,0.55)');
  if (!beard) mouth(ctx, state);
}

export function faceTexture(options) {
  const key = JSON.stringify(options);
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  draw(canvas.getContext('2d'), options);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  keepCanvas(texture, (ctx) => draw(ctx, options));
  cache.set(key, texture);
  return texture;
}

export function faceSet({ iris, brow, old = false, beard = false, hero = false }) {
  const states = ['open', 'blink', 'talk', 'stern'];
  return Object.fromEntries(states.map((state) => [state, faceTexture({ iris, brow, old, beard, state, hero })]));
}
