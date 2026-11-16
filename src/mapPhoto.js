import * as THREE from 'three';

const PIXELS_PER_METER = 6;
const HEIGHT = 160;
const DEPTH = 260;

export function captureMap({ renderer, scene, bounds, canvas, tile, hide, light }) {
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
}
