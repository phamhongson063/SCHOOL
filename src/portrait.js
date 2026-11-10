import * as THREE from 'three';

const SIZE = 256;

function headSpan(model) {
  model.group.updateMatrixWorld(true);
  const top = new THREE.Box3().setFromObject(model.group, true).max.y;
  const neck = (model.group.getObjectByName('Neck') ?? model.head).getWorldPosition(new THREE.Vector3()).y;
  return { neck, height: top - neck };
}

function snapshot(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(SIZE, SIZE);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(new THREE.Color());
  const previousAlpha = renderer.getClearAlpha();
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousColor, previousAlpha);
    target.dispose();
  }
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(SIZE, SIZE);
  const row = SIZE * 4;
  for (let y = 0; y < SIZE; y++) image.data.set(pixels.subarray((SIZE - 1 - y) * row, (SIZE - y) * row), y * row);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function paintPortrait(renderer, model, img) {
  model.pose?.();
  model.face?.update?.(0, 'open');
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a888, 1));
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const light = new THREE.DirectionalLight(0xfff4e0, 2);
  light.position.set(0.8, 1.6, 2.4);
  scene.add(light, model.group);

  const { neck, height } = headSpan(model);
  const half = height * 0.68;
  const center = neck + height * 0.4;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
  camera.position.set(0, center, 5);
  camera.lookAt(0, center, 0);

  img.src = snapshot(renderer, scene, camera);
  scene.remove(model.group);
}
