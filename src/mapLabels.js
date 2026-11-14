import * as THREE from 'three';

const FONT = '"Water Brush"';
const EDGE = 1.15;
const MOVE_EPSILON = 0.2;
const ZOOM_STEP = 0.04;
const PAN_STEP = 0.3;
const GAP = 6;
const projected = new THREE.Vector3();

export function createMapLabels({ camera, zoom, onPick }) {
  const layer = document.createElement('div');
  layer.className = 'map-labels notranslate';
  layer.setAttribute('translate', 'no');
  layer.hidden = true;
  document.body.append(layer);
  const labels = [];
  let ready = !document.fonts;
  let shown = false;
  let measured = false;
  let laidOutZoom = NaN;
  let settling = false;
  const laidOutAt = new THREE.Vector3();

  function refreshLayer() {
    layer.hidden = !(shown && ready);
  }

  function setFlag(label, key, on, apply) {
    if (label[key] === on) return;
    label[key] = on;
    apply(on);
  }

  function place(label) {
    if (!label.stand) {
      label.front = false;
      return;
    }
    projected.copy(label.at).project(camera);
    label.front = projected.z < 1;
    label.x = ((projected.x + 1) / 2) * window.innerWidth;
    label.y = ((1 - projected.y) / 2) * window.innerHeight;
    const onScreen = label.front && Math.abs(projected.x) < EDGE && Math.abs(projected.y) < EDGE;
    setFlag(label, 'onScreen', onScreen, (on) => (label.el.style.visibility = on ? '' : 'hidden'));
    if (!onScreen) return;
    if (Math.abs(label.x - label.drawnX) < MOVE_EPSILON && Math.abs(label.y - label.drawnY) < MOVE_EPSILON) return;
    label.drawnX = label.x;
    label.drawnY = label.y;
    label.el.style.transform = `translate3d(${label.x}px, ${label.y}px, 0) translate(-50%, -100%)`;
  }

  function measure() {
    for (const label of labels) {
      label.w = label.el.offsetWidth;
      label.h = label.el.offsetHeight;
    }
    measured = true;
  }

  function declutter() {
    if (settling) {
      layer.classList.add('settling');
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.remove('settling')));
      settling = false;
    }
    const kept = [];
    for (const label of labels) {
      let clear = label.front;
      if (clear) {
        const box = { x0: label.x - label.w / 2 - GAP, x1: label.x + label.w / 2 + GAP, y0: label.y - label.h - GAP, y1: label.y + GAP };
        clear = !kept.some((other) => box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0);
        if (clear) kept.push(box);
      }
      setFlag(label, 'clear', clear, (on) => label.el.classList.toggle('muted', !on));
    }
  }

  function add(name, at = null, stand = null, lift = 5) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'map-label';
    el.textContent = name;
    const label = { el, at: new THREE.Vector3(), stand: null, lift, front: false, onScreen: true, clear: true, x: 0, y: 0, drawnX: NaN, drawnY: NaN, w: 0, h: 0 };
    el.addEventListener('click', () => label.stand && label.clear && onPick(label.stand));
    layer.append(el);
    labels.push(label);
    move(label, at, stand);
    return label;
  }

  function move(label, at, stand = at) {
    label.stand = at && stand ? { x: stand.x, z: stand.z } : null;
    if (at) label.at.set(at.x, label.lift, at.z);
    label.drawnX = NaN;
    laidOutZoom = NaN;
  }

  function relayout() {
    measured = false;
    laidOutZoom = NaN;
  }

  if (document.fonts) {
    queueMicrotask(() =>
      document.fonts
        .load(`32px ${FONT}`, labels.map((label) => label.el.textContent).join(''))
        .catch(() => {})
        .finally(() => {
          ready = true;
          settling = true;
          relayout();
          refreshLayer();
        }),
    );
  }
  window.addEventListener('resize', relayout);

  return {
    add,
    move,
    setShown(on) {
      if (on === shown) return;
      shown = on;
      if (on) {
        for (const label of labels) label.drawnX = NaN;
        laidOutZoom = NaN;
        settling = true;
      }
      refreshLayer();
    },
    update() {
      if (!shown || !ready) return;
      if (!measured) measure();
      for (const label of labels) place(label);
      const level = zoom();
      const panned = Math.hypot(camera.position.x - laidOutAt.x, camera.position.z - laidOutAt.z);
      if (Number.isFinite(laidOutZoom) && Math.abs(level - laidOutZoom) < laidOutZoom * ZOOM_STEP && panned < laidOutZoom * PAN_STEP) return;
      laidOutZoom = level;
      laidOutAt.copy(camera.position);
      declutter();
    },
  };
}
