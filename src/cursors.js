const INK = '#2b3a12';
const GREEN = '#8cc63f';
const GREEN_DARK = '#6f9f2c';
const GREEN_LIGHT = '#acd862';
const ROSE = '#e8d84a';
const ROSE_DARK = '#c9b832';
const DROP = '#8fe3c8';

function paint(draw, size = 40) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  return canvas.toDataURL();
}

function stroke(ctx, width, color, path) {
  ctx.beginPath();
  path();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function shape(ctx, fill, path, outline = 1.5) {
  ctx.beginPath();
  path();
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline <= 0) return;
  ctx.lineWidth = outline;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drop(ctx, x, y, r) {
  shape(
    ctx,
    DROP,
    () => {
      ctx.moveTo(x + r * 0.9, y - r * 2);
      ctx.quadraticCurveTo(x + r, y - r * 0.2, x + r * 0.6, y + r * 0.5);
      ctx.arc(x, y, r, 0.6, Math.PI + 0.6);
    },
    1,
  );
}

function wateringCan(ctx) {
  const handle = () => ctx.arc(28, 17, 9, Math.PI * 1.02, Math.PI * 2.32);
  stroke(ctx, 5, INK, handle);
  stroke(ctx, 3, GREEN, handle);
  const spout = () => {
    ctx.moveTo(22, 27);
    ctx.lineTo(13, 22.5);
  };
  stroke(ctx, 5.5, INK, spout);
  stroke(ctx, 3, GREEN, spout);
  shape(ctx, GREEN, () => {
    ctx.moveTo(19, 18);
    ctx.lineTo(34, 16);
    ctx.lineTo(35.5, 31);
    ctx.quadraticCurveTo(28, 34.5, 21.5, 33);
  });
  shape(ctx, GREEN_DARK, () => {
    ctx.moveTo(30, 16.6);
    ctx.lineTo(34, 16);
    ctx.lineTo(35.5, 31);
    ctx.lineTo(31.5, 32.6);
  }, 0);
  ctx.beginPath();
  ctx.ellipse(26.5, 17, 7.6, 2.4, -0.13, 0, Math.PI * 2);
  ctx.fillStyle = GREEN_LIGHT;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(26.5, 17, 3.4, 1.1, -0.13, 0, Math.PI * 2);
  ctx.fillStyle = '#4f6e1a';
  ctx.fill();
  shape(ctx, ROSE_DARK, () => {
    ctx.moveTo(14, 22.5);
    ctx.lineTo(8, 16);
    ctx.lineTo(6.5, 29);
  });
  ctx.beginPath();
  ctx.ellipse(7.3, 22.5, 2.2, 6.4, 0.08, 0, Math.PI * 2);
  ctx.fillStyle = ROSE;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  drop(ctx, 3.5, 32, 1.6);
  drop(ctx, 8, 35.5, 1.6);
  drop(ctx, 3, 38, 1.3);
}

const WOOD = '#a8743f';
const WOOD_DARK = '#7d532a';
const METAL = '#9aa3a8';
const METAL_DARK = '#6b7378';
const METAL_EDGE = '#dfe4e7';

function hoe(ctx) {
  const handle = () => {
    ctx.moveTo(36, 4);
    ctx.lineTo(15, 25);
  };
  stroke(ctx, 6, '#2b1c12', handle);
  stroke(ctx, 3.5, WOOD, handle);
  stroke(ctx, 1.2, WOOD_DARK, () => {
    ctx.moveTo(34, 7);
    ctx.lineTo(18, 23);
  });
  shape(ctx, METAL_DARK, () => {
    ctx.moveTo(13.5, 21);
    ctx.lineTo(18.5, 26);
    ctx.lineTo(16, 28.5);
    ctx.lineTo(11, 23.5);
  });
  shape(ctx, METAL, () => {
    ctx.moveTo(12, 24.5);
    ctx.lineTo(17, 29);
    ctx.lineTo(10.5, 37.5);
    ctx.lineTo(2.5, 31);
  });
  stroke(ctx, 1.6, METAL_EDGE, () => {
    ctx.moveTo(3.8, 31.6);
    ctx.lineTo(10, 36.6);
  });
}

export const CURSORS = {
  seed: 'pointer',
  water: `url(${paint(wateringCan)}) 7 22, pointer`,
  hand: 'grab',
  hoe: `url(${paint(hoe)}) 6 34, pointer`,
};
