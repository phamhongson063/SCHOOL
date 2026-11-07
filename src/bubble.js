import * as THREE from 'three';

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

function draw(ctx, text) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.font = 'bold 46px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const textWidth = Math.min(WIDTH - 90, ctx.measureText(text).width);
  const w = textWidth + 60;
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

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, WIDTH / 2, y + h / 2 + 2, WIDTH - 90);
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
