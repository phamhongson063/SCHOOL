import * as THREE from 'three';

const FONT = '"Water Brush"';
const EDGE = 1.15;
const MOVE_EPSILON = 0.2;
const projected = new THREE.Vector3();

export function createMapLabels({ camera, onPick }) {
  const layer = document.createElement('div');
  layer.className = 'map-labels notranslate';
  layer.setAttribute('translate', 'no');
  layer.hidden = true;
  document.body.append(layer);
  const labels = [];
  let ready = !document.fonts;
  let shown = false;

  function refreshLayer() {
    layer.hidden = !(shown && ready);
  }

  function place(label) {
    projected.copy(label.at).project(camera);
    const visible = label.stand !== null && projected.z < 1 && Math.abs(projected.x) < EDGE && Math.abs(projected.y) < EDGE;
    if (visible !== label.visible) {
      label.visible = visible;
      label.el.style.visibility = visible ? '' : 'hidden';
    }
    if (!visible) return;
    const x = ((projected.x + 1) / 2) * window.innerWidth;
    const y = ((1 - projected.y) / 2) * window.innerHeight;
    if (Math.abs(x - label.x) < MOVE_EPSILON && Math.abs(y - label.y) < MOVE_EPSILON) return;
    label.x = x;
    label.y = y;
    label.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
  }

  function add(name, at = null, stand = null, lift = 5) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'map-label';
    el.textContent = name;
    const label = { el, at: new THREE.Vector3(), stand: null, lift, visible: true, x: NaN, y: NaN };
    el.addEventListener('click', () => label.stand && onPick(label.stand));
    layer.append(el);
    labels.push(label);
    move(label, at, stand);
    return label;
  }

  function move(label, at, stand = at) {
    label.stand = at && stand ? { x: stand.x, z: stand.z } : null;
    if (at) label.at.set(at.x, label.lift, at.z);
    label.x = NaN;
    if (shown) place(label);
  }

  if (document.fonts) {
    const names = () => labels.map((label) => label.el.textContent).join('');
    queueMicrotask(() =>
      document.fonts
        .load(`32px ${FONT}`, names())
        .catch(() => {})
        .finally(() => {
          ready = true;
          refreshLayer();
        }),
    );
  }

  return {
    add,
    move,
    setShown(on) {
      if (on === shown) return;
      shown = on;
      if (on) for (const label of labels) label.x = NaN;
      refreshLayer();
    },
    update() {
      if (!shown) return;
      for (const label of labels) place(label);
    },
  };
}
