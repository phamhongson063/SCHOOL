import * as THREE from 'three';
import { LOW_POWER } from './quality.js';
import { outlineMaterial } from './toon.js';
import { cullCharacterOutlines } from './characterModels.js';

export const MAX_PIXEL_RATIO = Math.min(window.devicePixelRatio, LOW_POWER ? 1.25 : 1.5);
const MIN_PIXEL_RATIO = 0.75;
const SHADOW_REFRESH = 2;
const OUTLINE_DISTANCE = 26;
const CHARACTER_OUTLINE_DISTANCE = OUTLINE_DISTANCE;

export function createRenderTuning({ renderer, scene, camera, sun, frameRate }) {
  let pixelRatio = MAX_PIXEL_RATIO;
  const pace = { target: frameRate, frames: 0, since: 0, steady: 0 };
  let shadowKey = '';
  let shadowAt = 0;
  const outlines = [];
  const outlinePoint = new THREE.Vector3();
  let outlineCheck = 0;

  function adaptResolution(time, target) {
    if (target !== pace.target || !pace.since) {
      Object.assign(pace, { target, frames: 0, since: time });
      return;
    }
    pace.frames += 1;
    const span = time - pace.since;
    if (span < 3000) return;
    const fps = (pace.frames * 1000) / span;
    pace.frames = 0;
    pace.since = time;
    let next = pixelRatio;
    if (fps < target * 0.8) {
      next = Math.max(MIN_PIXEL_RATIO, pixelRatio - 0.25);
      pace.steady = 0;
    } else if (fps >= target * 0.95 && ++pace.steady >= 5) {
      next = Math.min(MAX_PIXEL_RATIO, pixelRatio + 0.25);
      pace.steady = 0;
    }
    if (next === pixelRatio) return;
    pixelRatio = next;
    renderer.setPixelRatio(pixelRatio);
  }

  function pauseResolution() {
    pace.since = 0;
  }

  function refreshShadows(t) {
    const p = sun.position;
    const key = `${p.x},${p.y},${p.z},${sun.intensity > 0}`;
    if (key === shadowKey && t < shadowAt) return;
    shadowKey = key;
    shadowAt = t + SHADOW_REFRESH;
    renderer.shadowMap.needsUpdate = true;
  }

  function invalidateShadows() {
    shadowAt = 0;
  }

  function trackOutlines() {
    scene.traverse((object) => {
      if (object.isMesh && object.material === outlineMaterial()) outlines.push(object);
    });
  }

  function updateOutlines(t) {
    if (t < outlineCheck) return;
    outlineCheck = t + 0.5;
    for (const outline of outlines) {
      outline.getWorldPosition(outlinePoint);
      outline.visible = outlinePoint.distanceToSquared(camera.position) < OUTLINE_DISTANCE * OUTLINE_DISTANCE;
    }
    cullCharacterOutlines(camera, CHARACTER_OUTLINE_DISTANCE);
  }

  return { adaptResolution, pauseResolution, refreshShadows, invalidateShadows, trackOutlines, updateOutlines };
}
