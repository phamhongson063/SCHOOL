import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';

function badgeTexture(emoji) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paintBadge(canvas.getContext('2d'), size, emoji);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paintBadge(ctx, size, emoji));
}

export function badgeMaterial(emoji) {
  return new THREE.SpriteMaterial({ map: badgeTexture(emoji), transparent: true, depthWrite: false });
}

function paintBadge(ctx, size, emoji) {
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = '#fff6d8';
  ctx.fill();
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = '#c9962f';
  ctx.stroke();
  ctx.font = `${size * 0.5}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.03);
}

let studyMaterial = null;

export function createStudyIcon() {
  studyMaterial ??= badgeMaterial('📖');
  const sprite = new THREE.Sprite(studyMaterial);
  sprite.scale.setScalar(0.42);
  sprite.renderOrder = 6;
  sprite.visible = false;
  return sprite;
}

export function blinkStudyIcons(t) {
  if (studyMaterial) studyMaterial.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * 3.2));
}
