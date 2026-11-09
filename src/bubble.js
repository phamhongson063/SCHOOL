import * as THREE from 'three';
import { itemImage } from './itemArt.js';

const FAR = 40;
const OCCLUSION_EVERY = 0.25;
const TAIL = 9;
const MOOD_DROP = 0.3;
const MOOD_GAP = 4;

const BOWL = '<path d="M7 16H25Q24 23.5 16 24Q8 23.5 7 16Z" fill="#b8402e" stroke="#2b1c12" stroke-width="1.5" stroke-linejoin="round"/><path d="M13 24h6v1.6h-6z" fill="#7a2416"/>';
const MOODS = {
  hungry:
    '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="#fffaf0" stroke="#e0a21e" stroke-width="2.2"/><path d="M9.5 6.5 19 14.8M12.5 5.5 20.5 14" stroke="#8a5a2b" stroke-width="1.6" stroke-linecap="round"/><path d="M8.5 16Q10 11 16 11Q22 11 23.5 16Z" fill="#ffffff" stroke="#2b1c12" stroke-width="1.1"/>' +
    BOWL +
    '</svg>',
  exhausted:
    '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="#fff1ee" stroke="#b3261a" stroke-width="2.2"/><path d="M16 10.5a2.2 2.2 0 1 1 2.2-2.2 3.6 3.6 0 1 1-3.6-3.6" fill="none" stroke="#b3261a" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="16" cy="16.2" rx="8.4" ry="1.6" fill="#4a1a10"/>' +
    BOWL +
    '</svg>',
};

const active = new Set();
const head = new THREE.Vector3();
const screen = new THREE.Vector3();
const low = new THREE.Vector3();
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
  const badge = document.createElement('div');
  badge.className = 'mood';
  let mood = null;
  let bubbleHeight = 0;
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
      element.hidden = !visible || !shown;
      badge.hidden = !visible || !mood;
      if (!visible) return;
      const x = Math.round(((screen.x + 1) / 2) * window.innerWidth);
      const y = Math.round(((1 - screen.y) / 2) * window.innerHeight - TAIL);
      const depth = String(1000 - Math.round(distance * 10));
      if (shown) {
        element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        element.style.zIndex = depth;
        bubbleHeight ||= element.offsetHeight;
      }
      if (!mood) return;
      if (shown) {
        badge.style.transform = `translate(${x}px, ${y - bubbleHeight - MOOD_GAP}px) translate(-50%, -100%)`;
      } else {
        low.set(head.x, head.y - MOOD_DROP, head.z).project(camera);
        const lowX = Math.round(((low.x + 1) / 2) * window.innerWidth);
        const lowY = Math.round(((1 - low.y) / 2) * window.innerHeight);
        badge.style.transform = `translate(${lowX}px, ${lowY}px) translate(-50%, -100%)`;
      }
      badge.style.zIndex = depth;
    },
  };

  function hide() {
    shown = false;
    element.remove();
    if (!mood) active.delete(record);
  }

  function setMood(next) {
    if (next === mood) return;
    mood = next;
    if (!mood) {
      badge.remove();
      if (!shown) active.delete(record);
      return;
    }
    badge.innerHTML = MOODS[mood];
    badge.hidden = true;
    if (!badge.isConnected) speechLayer().append(badge);
    checkAt = 0;
    active.add(record);
  }

  return {
    sprite: anchor,
    get visible() {
      return shown;
    },
    show(text, duration, now) {
      element.replaceChildren(...content(text));
      element.hidden = true;
      bubbleHeight = 0;
      if (!element.isConnected) speechLayer().append(element);
      shown = true;
      until = now + duration;
      checkAt = 0;
      hiddenBehind = false;
      active.add(record);
    },
    hide,
    setMood,
    update(now) {
      if (shown && now > until) hide();
    },
  };
}
