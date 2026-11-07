import * as THREE from 'three';
import { Batch, shapes, shade, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { ENERGY, FOODS, MONEY, EATERY } from './config.js';
import { minuteOfDay, clockText } from './clock.js';
import { amount, coins } from './format.js';

const W = 5;
const D = 4.5;
const WALL = 0xe8b84a;
const WOOD = 0x6a3f24;
const WOOD_DARK = 0x3f2516;
const TILE = 0x8e3524;
const RIDGE = 0x7a2a1c;
const STONE = 0xb3ab99;

let glowMaterial = null;

export function eateryOpen(minutes) {
  const t = minuteOfDay(minutes);
  return t >= EATERY.open && t < EATERY.close;
}

export const eateryHours = () => `${clockText(EATERY.open)}–${clockText(EATERY.close)}`;

function roofPlane(b, z0, y0, z1, y1) {
  const dz = z1 - z0;
  const dy = y1 - y0;
  const length = Math.hypot(dz, dy);
  const angle = Math.atan2(dy, -dz);
  b.add(shapes.box(W + 0.7, 0.12, length), TILE, { p: [0, (y0 + y1) / 2, (z0 + z1) / 2], r: [angle, 0, 0] });
  const rows = Math.round(length / 0.32);
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    b.add(shapes.box(W + 0.72, 0.03, 0.05), shade(TILE, 0.82), { p: [0, y0 + dy * t + 0.07, z0 + dz * t], r: [angle, 0, 0] });
  }
}

export function createEatery({ seed = 9 } = {}) {
  const rand = makeRandom(seed);
  const b = new Batch();
  const obstacles = [];
  const block = (minX, minZ, maxX, maxZ, maxY = 3) => obstacles.push({ minX, minZ, maxX, maxZ, minY: 0, maxY });

  b.add(shapes.box(W, 0.06, D + 0.3), STONE, { p: [0, 0.03, -D / 2 + 0.15] });
  b.add(shapes.box(W, 3.2, 0.2), WALL, { p: [0, 1.6, -D + 0.1] });
  block(-W / 2, -D, W / 2, -D + 0.3);
  for (const side of [-1, 1]) {
    b.add(shapes.box(0.2, 3.2, D), WALL, { p: [side * (W / 2 - 0.1), 1.6, -D / 2] });
    b.add(shapes.box(0.26, 0.5, D + 0.02), shade(WALL, 0.7), { p: [side * (W / 2 - 0.1), 0.25, -D / 2] });
    block(side < 0 ? -W / 2 : W / 2 - 0.3, -D, side < 0 ? -W / 2 + 0.3 : W / 2, 0);
    b.add(shapes.box(0.22, 3.0, 0.22), WOOD_DARK, { p: [side * (W / 2 - 0.15), 1.5, -0.06] });
  }
  b.add(shapes.box(W - 0.04, 0.2, 0.22), WOOD, { p: [0, 2.98, -0.09] });

  roofPlane(b, 0.9, 3.05, -D / 2, 4.2);
  roofPlane(b, -D / 2, 4.2, -D - 0.4, 3.05);
  b.limb([-W / 2 - 0.35, 4.27, -D / 2], [W / 2 + 0.35, 4.27, -D / 2], 0.11, RIDGE, { capsule: false, seg: 8 });
  for (const side of [-1, 1]) {
    b.add(shapes.sphere(0.16, 8, 6), RIDGE, { p: [side * (W / 2 + 0.35), 4.32, -D / 2] });
    b.limb([side * (W / 2 + 0.35), 4.32, -D / 2], [side * (W / 2 + 0.6), 4.62, -D / 2], 0.06, RIDGE, { capsule: false, seg: 5 });
  }

  const counterW = W - 1.2;
  b.add(shapes.box(counterW, 0.9, 0.55), WOOD, { p: [0, 0.45, -0.75] });
  b.add(shapes.box(counterW + 0.1, 0.06, 0.65), WOOD_DARK, { p: [0, 0.93, -0.75] });
  block(-counterW / 2, -1.05, counterW / 2, -0.45, 1.2);
  b.add(shapes.cylinder(0.3, 0.26, 0.42, 14), 0x4a4a4a, { p: [-1.05, 1.17, -0.8] });
  b.add(shapes.cylinder(0.31, 0.31, 0.04, 14), 0x5a5a5a, { p: [-1.05, 1.4, -0.8] });
  b.add(shapes.sphere(0.05, 6, 4), 0x2a2a2a, { p: [-1.05, 1.44, -0.8] });
  b.add(shapes.cylinder(0.24, 0.24, 0.2, 10), 0x8a8a8a, { p: [-1.05, 0.98, -0.8] });
  for (let i = 0; i < 6; i++) {
    b.add(shapes.lathe([[0.001, 0], [0.06, 0], [0.11, 0.04], [0.12, 0.07], [0.001, 0.07]], 10), 0xf4efe2, { p: [0.9, 0.96 + i * 0.045, -0.7], flat: true });
  }
  b.add(shapes.cylinder(0.04, 0.04, 0.2, 8), 0x9a6438, { p: [1.25, 1.06, -0.62] });
  for (let i = 0; i < 6; i++) b.limb([1.25 + (rand() - 0.5) * 0.04, 1.1, -0.62], [1.25 + (rand() - 0.5) * 0.08, 1.28, -0.62 + (rand() - 0.5) * 0.06], 0.006, 0xd8c08a, { capsule: false, seg: 4 });
  b.add(shapes.cylinder(0.2, 0.16, 0.12, 10), 0x9a7a4a, { p: [0.15, 1.02, -0.75] });
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    b.add(shapes.ico(0.06, 0), i % 2 ? 0x5fae48 : 0x86c75a, { p: [0.15 + Math.cos(a) * 0.08, 1.1, -0.75 + Math.sin(a) * 0.08], s: [1, 0.5, 1], flat: true });
  }

  b.add(shapes.box(1.1, 0.06, 0.75), WOOD, { p: [1.25, 0.62, -3.05] });
  for (const [dx, dz] of [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]]) {
    b.add(shapes.box(0.05, 0.6, 0.05), WOOD_DARK, { p: [1.25 + dx, 0.3, -3.05 + dz] });
  }
  for (const [x, z] of [[0.45, -3.05], [2.05, -3.05], [1.25, -2.4]]) {
    b.add(shapes.cylinder(0.16, 0.16, 0.05, 10), 0xc0392b, { p: [x, 0.36, z] });
    b.add(shapes.cylinder(0.12, 0.14, 0.34, 8), 0xa02a1e, { p: [x, 0.17, z] });
  }
  block(0.25, -3.5, 2.25, -2.2, 1);
  b.add(shapes.box(0.9, 1.2, 0.05), 0x2a2a2a, { p: [-1.4, 1.7, -D + 0.23] });
  b.add(shapes.box(0.96, 1.26, 0.03), WOOD, { p: [-1.4, 1.7, -D + 0.21] });

  for (const x of [-1.6, 1.6]) b.limb([x, 2.74, 0.35], [x, 2.98, 0.2], 0.008, 0x3a2414, { capsule: false, seg: 4 });
  const mesh = b.mesh();
  const group = new THREE.Group();
  group.add(mesh);

  glowMaterial ??= toonMaterial({ vertexColors: true, emissive: 0xff7a2a, emissiveIntensity: 0 });
  const lamps = new Batch();
  for (const x of [-1.6, 1.6]) {
    lamps.add(shapes.sphere(0.2, 10, 8), x < 0 ? 0xd8321e : 0xf2b630, { p: [x, 2.45, 0.35], s: [1, 1.25, 1] });
    lamps.add(shapes.cylinder(0.09, 0.1, 0.05, 8), 0xf2c14e, { p: [x, 2.71, 0.35] });
    lamps.add(shapes.cylinder(0.1, 0.09, 0.05, 8), 0xf2c14e, { p: [x, 2.19, 0.35] });
  }
  const glow = lamps.mesh(glowMaterial, { shadow: false });
  group.add(glow);
  group.userData.lights = [-1.6, 1.6].map((x) => ({ position: new THREE.Vector3(x, 2.45, 0.35), tint: x < 0 ? 0xd8321e : 0xf2b630 }));

  return {
    group,
    obstacles,
    counter: { x: 0, z: 0.2 },
    keeper: { x: 0, z: -1.6, facing: 0 },
    plaque: { x: 0, y: 2.62, z: 0.06 },
  };
}

export function setEateryGlow(k) {
  if (glowMaterial) glowMaterial.emissiveIntensity = k * 1.6;
}

export function createFoodUI({ purse }) {
  const dialog = document.getElementById('foodDialog');
  const list = document.getElementById('foodList');
  const header = document.getElementById('foodMoney');
  const note = document.getElementById('foodNote');

  function render() {
    header.textContent = `⚡ ${Math.floor(purse.energy)}/${ENERGY.max} · ${MONEY.icon} ${amount(purse.money)}`;
    const full = purse.energy >= ENERGY.max - 0.5;
    list.replaceChildren(
      ...Object.entries(FOODS).map(([, food]) => {
        const node = document.createElement('div');
        node.className = 'shop-row';
        const icon = document.createElement('span');
        icon.className = 'shop-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = food.icon;
        const text = document.createElement('div');
        text.className = 'shop-text';
        const name = document.createElement('strong');
        name.textContent = food.name;
        const info = document.createElement('small');
        info.textContent = `+${food.energy} năng lượng · ${coins(food.price)}`;
        text.append(name, info);
        const actions = document.createElement('div');
        actions.className = 'shop-actions';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Ăn';
        button.disabled = full || purse.money < food.price;
        button.addEventListener('click', () => {
          if (!purse.spend(food.price)) {
            note.textContent = `Không đủ tiền! Cần ${coins(food.price)}.`;
            return;
          }
          purse.addEnergy(food.energy);
          note.textContent = `Ngon quá! ${food.name} +${food.energy} năng lượng.`;
          render();
        });
        actions.append(button);
        node.append(icon, text, actions);
        return node;
      }),
    );
  }

  dialog.querySelector('.sched-x').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  purse.onChange(() => {
    if (dialog.open) render();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open() {
      note.textContent = purse.energy >= ENERGY.max - 0.5 ? 'Bà chủ quán: "Con còn no mà, lát đói ghé lại nghen!"' : 'Bà chủ quán: "Ăn gì con? Đồ ăn nóng hổi đây!"';
      render();
      dialog.showModal();
    },
  };
}
