import * as THREE from 'three';

const FADE_RATE = 2.5;
const LOOK_AHEAD = 6;
const OPEN_REACH = 40;

const DETACHED = 0;
const HIDDEN = 1;
const SHOWN = 2;

const sources = new Set();
const placed = new WeakSet();

export function pooledLight(color, intensity, distance, decay) {
  const light = new THREE.PointLight(color, intensity, distance, decay);
  light.visible = false;
  sources.add(light);
  return light;
}

function placement(light, scene) {
  let shown = true;
  for (let node = light.parent; node; node = node.parent) {
    if (node === scene) return shown ? SHOWN : HIDDEN;
    if (!node.visible) shown = false;
  }
  return DETACHED;
}

export function createLightPool(scene, size) {
  const slots = Array.from({ length: size }, () => {
    const light = new THREE.PointLight(0xffffff, 0, 1, 2);
    scene.add(light);
    return { light, source: null, weight: 0 };
  });
  let lit = true;
  const focus = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const spot = new THREE.Vector3();
  const scores = new Map();
  const ranked = [];

  function rank(camera) {
    camera.getWorldPosition(focus);
    focus.addScaledVector(camera.getWorldDirection(ahead), LOOK_AHEAD);
    scores.clear();
    ranked.length = 0;
    for (const light of sources) {
      const state = placement(light, scene);
      if (state === DETACHED) {
        if (placed.has(light)) sources.delete(light);
        continue;
      }
      placed.add(light);
      if (state === HIDDEN || light.intensity <= 0) continue;
      const reach = light.distance > 0 ? light.distance : OPEN_REACH;
      scores.set(light, spot.setFromMatrixPosition(light.matrixWorld).distanceTo(focus) - reach);
      ranked.push(light);
    }
    ranked.sort((a, b) => scores.get(a) - scores.get(b));
    if (ranked.length > size) ranked.length = size;
  }

  function apply() {
    for (const { light, source, weight } of slots) {
      if (!source || placement(source, scene) !== SHOWN) {
        light.intensity = 0;
        continue;
      }
      light.position.setFromMatrixPosition(source.matrixWorld);
      light.color.copy(source.color);
      light.distance = source.distance;
      light.decay = source.decay;
      light.intensity = source.intensity * weight;
    }
  }

  function update(dt, camera) {
    rank(camera);
    for (const slot of slots) {
      if (!slot.source) continue;
      if (!scores.has(slot.source)) {
        slot.source = null;
        slot.weight = 0;
      } else if (ranked.includes(slot.source)) {
        slot.weight = Math.min(1, slot.weight + dt * FADE_RATE);
      } else if ((slot.weight -= dt * FADE_RATE) <= 0) {
        slot.source = null;
        slot.weight = 0;
      }
    }
    for (const light of ranked) {
      if (slots.some((slot) => slot.source === light)) continue;
      const free = slots.find((slot) => !slot.source);
      if (!free) break;
      free.source = light;
      free.weight = 0;
    }
    const inUse = slots.some((slot) => slot.source);
    if (inUse !== lit) {
      lit = inUse;
      for (const slot of slots) slot.light.visible = lit;
    }
    apply();
  }

  return { update, apply };
}
