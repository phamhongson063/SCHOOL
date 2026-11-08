import * as THREE from 'three';
import { itemImage } from './itemArt.js';

const WIDTH = 512;
const HEIGHT = 200;
const INK = '#2b1c12';

function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const ICON = 64;
const ICON_GAP = 6;

function pieces(ctx, text) {
  return text.split(/\[\[(\w+)\]\]/).flatMap((part, i) => {
    if (i % 2 === 0) return part ? [{ text: part, width: ctx.measureText(part).width }] : [];
    const image = itemImage(part);
    return image ? [{ image, width: ICON + ICON_GAP }] : [];
  });
}

function draw(ctx, text) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.font = 'bold 46px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const parts = pieces(ctx, text);
  const natural = parts.reduce((sum, part) => sum + part.width, 0);
  const fit = Math.min(1, (WIDTH - 90) / Math.max(1, natural));
  const w = natural * fit + 60;
  const h = 96;
  const x = (WIDTH - w) / 2;
  const y = 16;

  ctx.beginPath();
  roundedRect(ctx, x, y, w, h, 44);
  ctx.moveTo(WIDTH / 2 - 18, y + h - 1);
  ctx.lineTo(WIDTH / 2, y + h + 38);
  ctx.lineTo(WIDTH / 2 + 18, y + h - 1);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(WIDTH / 2 - 15, y + h - 6, 30, 8);

  ctx.save();
  ctx.translate((WIDTH - natural * fit) / 2, y + h / 2 + 2);
  ctx.scale(fit, fit);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let cursor = 0;
  for (const part of parts) {
    if (part.image) ctx.drawImage(part.image, cursor + ICON_GAP / 2, -ICON / 2 - 2, ICON, ICON);
    else ctx.fillText(part.text, cursor, 0);
    cursor += part.width;
  }
  ctx.restore();
}

export function createBubble() {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.center.set(0.5, 0);
  sprite.scale.set(1.4, (1.4 * HEIGHT) / WIDTH, 1);
  sprite.renderOrder = 5;
  sprite.visible = false;
  let until = 0;

  return {
    sprite,
    get visible() {
      return sprite.visible;
    },
    show(text, duration, now) {
      draw(canvas.getContext('2d'), text);
      texture.needsUpdate = true;
      sprite.visible = true;
      until = now + duration;
    },
    hide() {
      sprite.visible = false;
    },
    update(now) {
      if (sprite.visible && now > until) sprite.visible = false;
    },
  };
}
