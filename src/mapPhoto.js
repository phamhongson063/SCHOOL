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

const MIN_TILE = 40;
const MAX_TILE = 160;
const FAR = { x: 1e5, z: 1e5 };

const isAdditive = (material) => (Array.isArray(material) ? material.some(isAdditive) : material?.blending === THREE.AdditiveBlending);

function glowsOf(scene) {
  const glows = [];
  scene.traverse((object) => {
    if (isAdditive(object.material)) glows.push(object);
  });
  return glows;
}

export function createMapCapture({ renderer, scene, bounds, hide, light, look }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((bounds.x1 - bounds.x0) * PIXELS_PER_METER);
  canvas.height = Math.round((bounds.z1 - bounds.z0) * PIXELS_PER_METER);
  const context = canvas.getContext('2d');
  const screen = renderer.getSize(new THREE.Vector2());
  const fit = Math.floor((Math.min(screen.x, screen.y) * renderer.getPixelRatio()) / PIXELS_PER_METER);
  const tile = Math.max(MIN_TILE, Math.min(MAX_TILE, fit));
  const half = tile / 2;
  const drawn = tile * PIXELS_PER_METER;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 1, DEPTH);
  camera.up.set(0, 0, -1);
  const tiles = [];
  for (let z = bounds.z0; z < bounds.z1; z += tile) {
    for (let x = bounds.x0; x < bounds.x1; x += tile) tiles.push({ x, z });
  }
  const viewport = new THREE.Vector4();
  const size = new THREE.Vector2();
  let next = 0;
  let glows = null;

  function step(count) {
    if (next >= tiles.length) return true;
    glows ??= glowsOf(scene);
    const hidden = [...hide, ...glows];
    const shown = hidden.map((object) => object.visible);
    const fog = scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null;
    renderer.getSize(size);
    const side = Math.max(1, Math.floor(Math.min(size.x, size.y, drawn / renderer.getPixelRatio())));
    const source = renderer.domElement;
    for (const object of hidden) object.visible = false;
    if (fog) Object.assign(scene.fog, { near: DEPTH * 10, far: DEPTH * 20 });
    look(true);
    light(camera, FAR);
    renderer.shadowMap.needsUpdate = true;
    renderer.setViewport(0, 0, side, side);
    renderer.getCurrentViewport(viewport);
    try {
      for (let i = 0; i < count && next < tiles.length; i++, next++) {
        const { x, z } = tiles[next];
        camera.position.set(x + half, HEIGHT, z + half);
        camera.lookAt(x + half, 0, z + half);
        camera.updateMatrixWorld();
        renderer.render(scene, camera);
        const top = source.height - viewport.y - viewport.w;
        context.drawImage(source, viewport.x, top, viewport.z, viewport.w, (x - bounds.x0) * PIXELS_PER_METER, (z - bounds.z0) * PIXELS_PER_METER, drawn, drawn);
      }
    } finally {
      hidden.forEach((object, i) => (object.visible = shown[i]));
      if (fog) Object.assign(scene.fog, fog);
      look(false);
      renderer.setViewport(0, 0, size.x, size.y);
    }
    return next >= tiles.length;
  }

  return { canvas, step };
}
