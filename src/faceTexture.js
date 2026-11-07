import * as THREE from 'three';
import { shade } from './toon.js';

const SIZE = 256;
const LASH = '#2b1b14';
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

function openEye(ctx, cx, cy, side, iris, old) {
  const rx = old ? 13 : 21;
  const ry = old ? 14 : 29;
  if (!old) ellipse(ctx, cx + side * 2, cy + 2, rx + 3, ry + 1, '#ffffff');
  const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, rgba(shade(iris, 0.35)));
  g.addColorStop(0.55, rgba(iris));
  g.addColorStop(1, rgba(shade(iris, 1.6)));
  ellipse(ctx, cx, cy + 2, rx, ry, g);
  ellipse(ctx, cx, cy + 5, rx * 0.45, ry * 0.45, rgba(shade(iris, 0.25)));
  ellipse(ctx, cx - rx * 0.38, cy - ry * 0.36, rx * 0.36, ry * 0.3, '#ffffff');
  ellipse(ctx, cx + rx * 0.35, cy + ry * 0.42, rx * 0.16, rx * 0.16, 'rgba(255,255,255,0.9)');

  stroke(ctx, old ? 6 : 6.5, LASH, () => ctx.ellipse(cx, cy + 1, rx + 4, ry + 3, 0, Math.PI * 1.1, Math.PI * 1.9));
  const outerX = cx + side * (rx + 3);
  stroke(ctx, old ? 4 : 5, LASH, () => {
    ctx.moveTo(outerX - side * 3, cy - ry * 0.55);
    ctx.lineTo(outerX + side * 6, cy - ry * 0.75);
  });
  stroke(ctx, 2, 'rgba(43,27,20,0.55)', () => ctx.ellipse(cx, cy + 2, rx * 0.8, ry + 1, 0, Math.PI * 0.3, Math.PI * 0.7));

  if (old) {
    for (const dy of [-4, 4]) {
      stroke(ctx, 2, 'rgba(120,70,50,0.55)', () => {
        ctx.moveTo(outerX + side * 8, cy + dy);
        ctx.lineTo(outerX + side * 15, cy + dy * 1.8);
      });
    }
  }
}

function closedEye(ctx, cx, cy, old) {
  const r = old ? 13 : 19;
  stroke(ctx, 6, LASH, () => ctx.arc(cx, cy - r * 0.35, r, Math.PI * 0.15, Math.PI * 0.85));
}

function brows(ctx, eyes, color, { old, stern }) {
  eyes.forEach(([cx, side]) => {
    const inner = cx - side * 16;
    const outer = cx + side * 18;
    const y = old ? 70 : 64;
    const innerY = stern ? y + 10 : y + 2;
    const outerY = stern ? y - 4 : y + 1;
    if (old) {
      stroke(ctx, 13, 'rgba(160,150,140,0.9)', () => {
        ctx.moveTo(inner, innerY);
        ctx.quadraticCurveTo(cx, y - 6, outer, outerY + 4);
      });
      stroke(ctx, 9, color, () => {
        ctx.moveTo(inner, innerY);
        ctx.quadraticCurveTo(cx, y - 6, outer, outerY + 4);
      });
      return;
    }
    stroke(ctx, 5, color, () => {
      ctx.moveTo(inner, innerY);
      ctx.quadraticCurveTo(cx, y - 7, outer, outerY);
    });
  });
}

function blush(ctx, strength) {
  for (const x of [60, 196]) {
    const g = ctx.createRadialGradient(x, 150, 2, x, 150, 26);
    g.addColorStop(0, `rgba(255,120,130,${0.55 * strength})`);
    g.addColorStop(1, 'rgba(255,120,130,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, 150, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = -1; i <= 1; i++) {
      stroke(ctx, 2, `rgba(225,85,95,${0.7 * strength})`, () => {
        ctx.moveTo(x + i * 8 - 3, 155);
        ctx.lineTo(x + i * 8 + 3, 145);
      });
    }
  }
}

function mouth(ctx, state) {
  if (state === 'talk') {
    ctx.beginPath();
    ctx.moveTo(116, 172);
    ctx.quadraticCurveTo(128, 168, 140, 172);
    ctx.quadraticCurveTo(138, 192, 128, 192);
    ctx.quadraticCurveTo(118, 192, 116, 172);
    ctx.fillStyle = '#8a2f2a';
    ctx.fill();
    ellipse(ctx, 128, 186, 7, 4, '#e8838a');
    stroke(ctx, 3, '#5a1f1a', () => {
      ctx.moveTo(116, 172);
      ctx.quadraticCurveTo(128, 168, 140, 172);
      ctx.quadraticCurveTo(138, 192, 128, 192);
      ctx.quadraticCurveTo(118, 192, 116, 172);
    });
    return;
  }
  stroke(ctx, 4, '#7a3328', () => ctx.arc(128, 166, 10, Math.PI * 0.18, Math.PI * 0.82));
}

function draw(ctx, { iris, brow, old, state }) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  const eyes = [
    [84, -1],
    [172, 1],
  ];
  const cy = old ? 112 : 108;
  if (!old) blush(ctx, 1);
  else blush(ctx, 0.35);
  brows(ctx, eyes, brow, { old, stern: state === 'stern' });
  for (const [cx, side] of eyes) {
    if (state === 'blink') closedEye(ctx, cx, cy, old);
    else openEye(ctx, cx, cy, side, iris, old);
  }
  stroke(ctx, 3, 'rgba(150,80,60,0.55)', () => {
    ctx.moveTo(129, 146);
    ctx.lineTo(126, 152);
  });
  if (!old) mouth(ctx, state);
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
  cache.set(key, texture);
  return texture;
}

export function faceSet({ iris, brow, old = false }) {
  const states = old ? ['open', 'blink', 'stern'] : ['open', 'blink', 'talk'];
  return Object.fromEntries(states.map((state) => [state, faceTexture({ iris, brow, old, state })]));
}
