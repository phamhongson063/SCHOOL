import * as THREE from 'three';
import { itemImage } from './itemArt.js';

const FAR = 40;
const OCCLUSION_EVERY = 0.25;
const TAIL = 9;

const active = new Set();
const head = new THREE.Vector3();
const screen = new THREE.Vector3();
let layer = null;
let blocked = () => false;

function speechLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'speech-layer notranslate';
  layer.setAttribute('translate', 'no');
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  return layer;
}

function content(text) {
  return text.split(/\[\[(\w+)\]\]/).flatMap((part, i) => {
    if (i % 2 === 0) return part ? [document.createTextNode(part)] : [];
    const image = itemImage(part);
    if (!image) return [];
    const icon = document.createElement('img');
    icon.src = image.src;
    icon.alt = '';
    icon.draggable = false;
    return [icon];
  });
}

function inScene(object) {
  for (let node = object; node; node = node.parent) {
    if (!node.visible) return false;
    if (node.isScene) return true;
  }
  return false;
}

export function setBubbleOcclusion(test) {
  blocked = test;
}

export function updateBubbles(camera, now) {
  for (const bubble of active) bubble.place(camera, now);
}

export function createBubble() {
  const anchor = new THREE.Object3D();
  const element = document.createElement('div');
  element.className = 'speech';
  let until = 0;
  let shown = false;
  let checkAt = 0;
  let hiddenBehind = false;

  const record = {
    place(camera, now) {
      anchor.updateWorldMatrix(true, false);
      anchor.getWorldPosition(head);
      const distance = head.distanceTo(camera.position);
      let visible = inScene(anchor) && distance < FAR;
      if (visible) {
        screen.copy(head).project(camera);
        visible = screen.z > -1 && screen.z < 1 && Math.abs(screen.x) < 1.2 && Math.abs(screen.y) < 1.2;
      }
      if (visible && now >= checkAt) {
        checkAt = now + OCCLUSION_EVERY;
        hiddenBehind = blocked(camera.position, head);
      }
      visible &&= !hiddenBehind;
      element.hidden = !visible;
      if (!visible) return;
      const x = ((screen.x + 1) / 2) * window.innerWidth;
      const y = ((1 - screen.y) / 2) * window.innerHeight - TAIL;
      element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
      element.style.zIndex = String(1000 - Math.round(distance * 10));
    },
  };

  function hide() {
    shown = false;
    active.delete(record);
    element.remove();
  }

  return {
    sprite: anchor,
    get visible() {
      return shown;
    },
    show(text, duration, now) {
      element.replaceChildren(...content(text));
      element.hidden = true;
      if (!element.isConnected) speechLayer().append(element);
      shown = true;
      until = now + duration;
      checkAt = 0;
      hiddenBehind = false;
      active.add(record);
    },
    hide,
    update(now) {
      if (shown && now > until) hide();
    },
  };
}
