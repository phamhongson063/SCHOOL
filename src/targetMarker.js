import * as THREE from 'three';

const GOLD = 0xffd24a;
const LIFT = 0.03;
const POP = { from: 1.7, time: 0.28 };
const BREATH = { speed: 4, amount: 0.06 };
const RIPPLE = { period: 1.1, grow: 1.4, opacity: 0.75 };

function flat(geometry, opacity) {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 5;
  return mesh;
}

export function createTargetMarker(scene) {
  const group = new THREE.Group();
  const ring = flat(new THREE.RingGeometry(0.24, 0.31, 48), 0.95);
  const dot = flat(new THREE.CircleGeometry(0.07, 24), 0.95);
  const ripple = flat(new THREE.RingGeometry(0.27, 0.31, 48), RIPPLE.opacity);
  group.add(ripple, ring, dot);
  group.visible = false;
  scene.add(group);
  let shownAt = null;

  return {
    get visible() {
      return group.visible;
    },
    show(point) {
      group.position.set(point.x, point.y + LIFT, point.z);
      group.visible = true;
      shownAt = null;
    },
    hide() {
      group.visible = false;
    },
    update(t) {
      if (!group.visible) return;
      shownAt ??= t;
      const age = t - shownAt;
      const pop = Math.min(1, age / POP.time);
      const settle = POP.from + (1 - POP.from) * (1 - (1 - pop) ** 3);
      ring.scale.setScalar(settle * (1 + Math.sin(age * BREATH.speed) * BREATH.amount));
      dot.scale.setScalar(pop);
      const wave = (age % RIPPLE.period) / RIPPLE.period;
      ripple.scale.setScalar(1 + wave * RIPPLE.grow);
      ripple.material.opacity = RIPPLE.opacity * (1 - wave) * pop;
    },
  };
}
