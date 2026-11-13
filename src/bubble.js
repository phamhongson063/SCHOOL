import * as THREE from 'three';
import { itemImage } from './itemArt.js';
import { goldNodes } from './goldArt.js';

const FAR = 40;
const OCCLUSION_EVERY = 0.25;
const TAIL = 9;
const MOOD_DROP = 0.3;
const MOOD_GAP = 4;
const BADGE_STEP = 34;
const TRIP = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="#fffaf0" stroke="#5f9e3a" stroke-width="2.2"/><text x="16" y="21.5" text-anchor="middle" font-size="16">🌾</text></svg>';

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
    if (i % 2 === 0) return part ? goldNodes(part) : [];
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

const SIX = 'M6.8 0.6C6 0.2 5.1 0 4.2 0 1.6 0 0 2.8 0 7.5 0 11.8 1.6 14 4 14 6.4 14 8 12.2 8 9.6 8 7.1 6.4 5.4 4.1 5.4 2.2 5.4 0.7 6.6 0.1 8.3';
const DIGITS = [
  'M4 0C1.2 0 0 3 0 7s1.2 7 4 7 4-3 4-7-1.2-7-4-7Z',
  'M1.5 3.2 5 0V14',
  'M0.5 3.5C1 1 2.5 0 4 0c2.2 0 3.5 1.5 3.5 3.5 0 2-1.5 3.5-3.5 5.5L0.5 14H8',
  'M0.8 1.5C1.8 0.5 2.8 0 4 0c2 0 3.5 1.2 3.5 3.3S6 6.6 3.6 6.6C6.2 6.6 8 8 8 10.2 8 12.6 6.2 14 4 14 2.5 14 1.2 13.4 0.3 12.3',
  'M6 14V0L0 9.5H8',
  'M7.5 0H1.5L0.8 6.3C1.7 5.6 2.8 5.3 3.9 5.3 6.3 5.3 8 7 8 9.6 8 12.3 6.2 14 3.8 14 2.3 14 1 13.4 0.2 12.4',
  SIX,
  'M0 0H8L3 14',
  'M4 6.4C2 6.4 0.7 5.2 0.7 3.3 0.7 1.4 2.1 0 4 0s3.3 1.4 3.3 3.3c0 1.9-1.3 3.1-3.3 3.1Zm0 0C1.7 6.4 0 7.9 0 10.1 0 12.4 1.7 14 4 14s4-1.6 4-3.9c0-2.2-1.7-3.7-4-3.7Z',
  SIX,
];
const DIGIT_W = 8;
const DIGIT_H = 14;
const DIGIT_GAP = 3;

function digitPaths(number) {
  const digits = String(number).split('').map(Number);
  const scale = digits.length > 1 ? 0.78 : 1;
  const width = digits.length * DIGIT_W + (digits.length - 1) * DIGIT_GAP;
  const left = 16 - (width * scale) / 2;
  const top = 16 - (DIGIT_H * scale) / 2;
  return digits
    .map((digit, i) => {
      const flip = digit === 9 ? ` rotate(180 ${DIGIT_W / 2} ${DIGIT_H / 2})` : '';
      return `<path transform="translate(${left} ${top}) scale(${scale}) translate(${i * (DIGIT_W + DIGIT_GAP)} 0)${flip}" d="${DIGITS[digit]}"/>`;
    })
    .join('');
}

function seatBadge(turn) {
  return `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="#fff6d8" stroke="#c9962f" stroke-width="2.2"/><g fill="none" stroke="#6b4a12" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${digitPaths(turn)}</g></svg>`;
}

function makeBadge(html = '') {
  const el = document.createElement('div');
  el.className = 'mood';
  el.innerHTML = html;
  return { el, on: false };
}

export function createBubble() {
  const anchor = new THREE.Object3D();
  const element = document.createElement('div');
  element.className = 'speech';
  const moodBadge = makeBadge();
  const turnBadge = makeBadge();
  const tripBadge = makeBadge(TRIP);
  const badges = [moodBadge, turnBadge, tripBadge];
  const anyBadge = () => badges.some((badge) => badge.on);
  let mood = null;
  let turn = null;
  let trip = false;
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
      for (const badge of badges) badge.el.hidden = !visible || !badge.on;
      if (!visible) return;
      const x = Math.round(((screen.x + 1) / 2) * window.innerWidth);
      const y = Math.round(((1 - screen.y) / 2) * window.innerHeight - TAIL);
      const depth = String(1000 - Math.round(distance * 10));
      if (shown) {
        element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        element.style.zIndex = depth;
        bubbleHeight ||= element.offsetHeight;
      }
      const lit = badges.filter((badge) => badge.on);
      if (!lit.length) return;
      let badgeX = x;
      let badgeY = y - bubbleHeight - MOOD_GAP;
      if (!shown) {
        low.set(head.x, head.y - MOOD_DROP, head.z).project(camera);
        badgeX = Math.round(((low.x + 1) / 2) * window.innerWidth);
        badgeY = Math.round(((1 - low.y) / 2) * window.innerHeight);
      }
      lit.forEach((badge, i) => {
        const offset = (i - (lit.length - 1) / 2) * BADGE_STEP;
        badge.el.style.transform = `translate(${badgeX + offset}px, ${badgeY}px) translate(-50%, -100%)`;
        badge.el.style.zIndex = depth;
      });
    },
  };

  function hide() {
    shown = false;
    element.remove();
    if (!anyBadge()) active.delete(record);
  }

  function toggle(badge, on) {
    badge.on = on;
    if (!on) {
      badge.el.remove();
      if (!shown && !anyBadge()) active.delete(record);
      return;
    }
    badge.el.hidden = true;
    if (!badge.el.isConnected) speechLayer().append(badge.el);
    checkAt = 0;
    active.add(record);
  }

  function setMood(next) {
    if (next === mood) return;
    mood = next;
    if (mood) moodBadge.el.innerHTML = MOODS[mood];
    toggle(moodBadge, !!mood);
  }

  function setTurn(next) {
    if (next === turn) return;
    turn = next;
    if (turn !== null) turnBadge.el.innerHTML = seatBadge(turn);
    toggle(turnBadge, turn !== null);
  }

  function setTrip(next) {
    if (next === trip) return;
    trip = next;
    toggle(tripBadge, trip);
  }

  return {
    sprite: anchor,
    get visible() {
      return shown;
    },
    show(text, duration, now, { plain = false } = {}) {
      element.className = plain ? 'speech plain' : 'speech';
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
    setTurn,
    setTrip,
    update(now) {
      if (shown && now > until) hide();
    },
  };
}
