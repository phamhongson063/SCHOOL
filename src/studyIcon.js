import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';

function studyTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paintStudy(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paintStudy(ctx, size));
}

function paintStudy(ctx, size) {
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
  ctx.fillText('📖', size / 2, size / 2 + size * 0.03);
}

let studyMaterial = null;

export function createStudyIcon() {
  studyMaterial ??= new THREE.SpriteMaterial({ map: studyTexture(), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(studyMaterial);
  sprite.scale.setScalar(0.42);
  sprite.renderOrder = 6;
  sprite.visible = false;
  return sprite;
}

export function blinkStudyIcons(t) {
  if (studyMaterial) studyMaterial.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * 3.2));
}
