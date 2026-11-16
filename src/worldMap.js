import { closable } from './dialog.js';

const SCALE = 4;
const FONT = '"Water Brush"';
const GAP = 6;
const TAP_GAP = 350;
const TAP_SLOP = 12;

export function createWorldMap({ bounds, onPick, onWalk, onClose }) {
  const dialog = document.getElementById('mapDialog');
  const view = dialog.querySelector('.map-view');
  const sheet = dialog.querySelector('.map-sheet');
  const canvas = dialog.querySelector('.map-ground');
  const layer = dialog.querySelector('.map-labels');
  const labels = [];
  let measured = false;
  let locked = false;
  let press = null;
  let drag = null;
  let lastTap = null;

  sheet.style.width = `${(bounds.x1 - bounds.x0) * SCALE}px`;
  sheet.style.height = `${(bounds.z1 - bounds.z0) * SCALE}px`;

  const toSheet = (at) => ({ x: (at.x - bounds.x0) * SCALE, y: (at.z - bounds.z0) * SCALE });

  const inside = (at) => at.x >= bounds.x0 && at.x <= bounds.x1 && at.z >= bounds.z0 && at.z <= bounds.z1;

  function place(label) {
    label.el.hidden = !label.stand || !inside(label.at);
    if (label.el.hidden) return;
    const { x, y } = toSheet(label.at);
    label.x = x;
    label.y = y;
    label.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  function declutter() {
    if (!dialog.open) return;
    if (!measured) {
      for (const label of labels) {
        label.w = label.el.offsetWidth;
        label.h = label.el.offsetHeight;
      }
      measured = true;
    }
    const kept = [];
    for (const label of labels) {
      let clear = !label.el.hidden;
      if (clear) {
        const box = { x0: label.x - label.w / 2 - GAP, x1: label.x + label.w / 2 + GAP, y0: label.y - label.h / 2 - GAP, y1: label.y + label.h / 2 + GAP };
        clear = !kept.some((other) => box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0);
        if (clear) kept.push(box);
      }
      label.clear = clear;
      label.el.classList.toggle('muted', !clear);
    }
  }

  function relayout() {
    measured = false;
    declutter();
  }

  function add(name, at = null, stand = at, { lead = false, kind = '', image = null } = {}) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = kind ? `map-label ${kind}` : 'map-label';
    if (image) {
      const img = document.createElement('img');
      img.src = image;
      img.alt = name;
      img.draggable = false;
      img.addEventListener('load', relayout, { once: true });
      el.append(img);
    } else el.textContent = name;
    const label = { el, at: { x: 0, z: 0 }, stand: null, clear: true, x: 0, y: 0, w: 0, h: 0 };
    el.addEventListener('click', () => {
      if (!locked && label.stand && label.clear) onPick(label.stand);
    });
    layer.append(el);
    if (lead) labels.unshift(label);
    else labels.push(label);
    move(label, at, stand);
    return label;
  }

  function move(label, at, stand = at) {
    label.stand = at && stand ? { x: stand.x, z: stand.z } : null;
    if (at) label.at = { x: at.x, z: at.z };
    place(label);
    relayout();
  }

  function center(at) {
    const { x, y } = toSheet(at);
    view.scrollLeft = x - view.clientWidth / 2;
    view.scrollTop = y - view.clientHeight / 2;
  }

  function worldAt(clientX, clientY) {
    const box = sheet.getBoundingClientRect();
    return { x: bounds.x0 + (clientX - box.left) / SCALE, z: bounds.z0 + (clientY - box.top) / SCALE };
  }

  view.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    press = event.target.closest('.map-label') ? null : { x: event.clientX, y: event.clientY };
    if (event.pointerType !== 'mouse') return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });
  view.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - (press?.x ?? drag.x), event.clientY - (press?.y ?? drag.y)) <= TAP_SLOP) return;
    if (!drag.moved) {
      drag.moved = true;
      view.setPointerCapture(event.pointerId);
      view.classList.add('dragging');
    }
    view.scrollLeft -= event.clientX - drag.x;
    view.scrollTop -= event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  const endDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId);
    view.classList.remove('dragging');
    drag = null;
  };
  view.addEventListener('pointerup', (event) => {
    endDrag(event);
    if (!press || locked) {
      press = null;
      return;
    }
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP;
    press = null;
    if (moved) {
      lastTap = null;
      return;
    }
    const now = performance.now();
    const second = lastTap && now - lastTap.at < TAP_GAP && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= TAP_SLOP * 2;
    lastTap = second ? null : { at: now, x: event.clientX, y: event.clientY };
    if (second) onWalk(worldAt(event.clientX, event.clientY));
  });
  view.addEventListener('pointercancel', (event) => {
    endDrag(event);
    press = null;
    lastTap = null;
  });

  closable(dialog);
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    locked = false;
    press = null;
    lastTap = null;
    onClose();
  });

  if (document.fonts) {
    queueMicrotask(() =>
      document.fonts
        .load(`32px ${FONT}`, labels.map((label) => label.el.textContent).join(''))
        .catch(() => {})
        .finally(relayout),
    );
  }
  window.addEventListener('resize', relayout);

  return {
    add,
    move,
    canvas,
    get isOpen() {
      return dialog.open;
    },
    open(at, { locked: lock = false } = {}) {
      if (dialog.open) return;
      locked = lock;
      dialog.classList.toggle('locked', lock);
      layer.classList.add('settling');
      dialog.showModal();
      relayout();
      center(at);
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.remove('settling')));
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
