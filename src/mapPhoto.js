import * as THREE from 'three';

const PIXELS_PER_METER = 6;
const HEIGHT = 160;
const DEPTH = 260;
const STORE = 'map-photo';
const QUALITY = 0.92;

const photoUrl = (key) => new URL(`map-photo/${encodeURIComponent(key)}`, document.baseURI).href;

const show = (image, blob) => (image.src = URL.createObjectURL(blob));

async function store(blob, key) {
  try {
    const cache = await caches.open(STORE);
    const url = photoUrl(key);
    const stale = (await cache.keys()).filter((request) => request.url !== url);
    await Promise.all(stale.map((request) => cache.delete(request)));
    await cache.put(url, new Response(blob));
  } catch {}
}

export async function restoreMap(image, key) {
  if (!key || !globalThis.caches) return false;
  try {
    const found = await (await caches.open(STORE)).match(photoUrl(key));
    if (!found) return false;
    show(image, await found.blob());
    return true;
  } catch {
    return false;
  }
}

export function showMap(canvas, image, key) {
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      show(image, blob);
      if (key && globalThis.caches) store(blob, key);
    },
    'image/webp',
    QUALITY,
  );
}

export function captureMap({ renderer, scene, bounds, tile, hide, light }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((bounds.x1 - bounds.x0) * PIXELS_PER_METER);
  canvas.height = Math.round((bounds.z1 - bounds.z0) * PIXELS_PER_METER);
  const context = canvas.getContext('2d');
  const half = tile / 2;
  const drawn = tile * PIXELS_PER_METER;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 1, DEPTH);
  camera.up.set(0, 0, -1);
  const size = renderer.getSize(new THREE.Vector2());
  const side = Math.max(1, Math.floor(Math.min(size.x, size.y, drawn / renderer.getPixelRatio())));
  const viewport = new THREE.Vector4();
  const source = renderer.domElement;
  const shown = hide.map((object) => object.visible);
  const fog = scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null;
  for (const object of hide) object.visible = false;
  if (fog) Object.assign(scene.fog, { near: DEPTH * 10, far: DEPTH * 20 });
  renderer.setViewport(0, 0, side, side);
  renderer.getCurrentViewport(viewport);
  try {
    for (let z = bounds.z0; z < bounds.z1; z += tile) {
      for (let x = bounds.x0; x < bounds.x1; x += tile) {
        const at = { x: x + half, z: z + half };
        camera.position.set(at.x, HEIGHT, at.z);
        camera.lookAt(at.x, 0, at.z);
        camera.updateMatrixWorld();
        light(camera, at);
        renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, camera);
        const top = source.height - viewport.y - viewport.w;
        context.drawImage(source, viewport.x, top, viewport.z, viewport.w, (x - bounds.x0) * PIXELS_PER_METER, (z - bounds.z0) * PIXELS_PER_METER, drawn, drawn);
      }
    }
  } finally {
    hide.forEach((object, i) => (object.visible = shown[i]));
    if (fog) Object.assign(scene.fog, fog);
    renderer.setViewport(0, 0, size.x, size.y);
  }
  return canvas;
}
