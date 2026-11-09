import * as THREE from 'three';
import { Batch, shapes, shade, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { ENERGY, FOODS, MONEY, EATERY } from './config.js';
import { isOpenAt, hoursText } from './clock.js';
import { amount, coins, notEnough } from './format.js';
import { plasterMaterial, texturedBox } from './architecture.js';
import { closable } from './dialog.js';

const W = 6.6;
const D = 5.8;
const H = 3.7;
const LIFT = H - 3.2;
const RISE = 1.3;
const LAMP_X = 2.1;
const WALL = 0xe8b84a;
const WOOD = 0x6a3f24;
const WOOD_DARK = 0x3f2516;
const TILE = 0x8e3524;
const RIDGE = 0x7a2a1c;
const STONE = 0xb3ab99;

let glowMaterial = null;

export const eateryOpen = (minutes) => isOpenAt(EATERY, minutes);
export const eateryHours = () => hoursText(EATERY);

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
  const walls = new Batch();
  const obstacles = [];
  const block = (minX, minZ, maxX, maxZ, maxY = 3) => obstacles.push({ minX, minZ, maxX, maxZ, minY: 0, maxY });

  b.add(shapes.box(W, 0.06, D + 0.2), STONE, { p: [0, 0.03, -D / 2 + 0.2] });
  walls.add(texturedBox(W, H, 0.2), WALL, { p: [0, H / 2, -D + 0.1] });
  block(-W / 2, -D, W / 2, -D + 0.3);
  for (const side of [-1, 1]) {
    walls.add(texturedBox(0.2, H, D), WALL, { p: [side * (W / 2 - 0.1), H / 2, -D / 2] });
    walls.add(texturedBox(0.26, 0.5, D + 0.02), shade(WALL, 0.7), { p: [side * (W / 2 - 0.1), 0.25, -D / 2] });
    block(side < 0 ? -W / 2 : W / 2 - 0.3, -D, side < 0 ? -W / 2 + 0.3 : W / 2, 0);
    b.add(shapes.box(0.22, H - 0.2, 0.22), WOOD_DARK, { p: [side * (W / 2 - 0.15), (H - 0.2) / 2, -0.06] });
  }
  b.add(shapes.box(W - 0.04, 0.2, 0.22), WOOD, { p: [0, H - 0.22, -0.09] });

  const eave = H - 0.15;
  const ridge = eave + RISE;
  roofPlane(b, 0.9, eave, -D / 2, ridge);
  roofPlane(b, -D / 2, ridge, -D - 0.4, eave);
  b.limb([-W / 2 - 0.35, ridge + 0.07, -D / 2], [W / 2 + 0.35, ridge + 0.07, -D / 2], 0.12, RIDGE, { capsule: false, seg: 8 });
  for (const side of [-1, 1]) {
    b.add(shapes.sphere(0.17, 8, 6), RIDGE, { p: [side * (W / 2 + 0.35), ridge + 0.12, -D / 2] });
    b.limb([side * (W / 2 + 0.35), ridge + 0.12, -D / 2], [side * (W / 2 + 0.62), ridge + 0.44, -D / 2], 0.065, RIDGE, { capsule: false, seg: 5 });
  }

  const counterW = W - 1.2;
  b.add(shapes.box(counterW, 0.6, 0.55), WOOD, { p: [0, 0.3, -0.75] });
  b.add(shapes.box(counterW + 0.1, 0.06, 0.65), WOOD_DARK, { p: [0, 0.63, -0.75] });
  block(-counterW / 2, -1.05, counterW / 2, -0.45, 1.2);
  b.add(shapes.cylinder(0.3, 0.26, 0.42, 14), 0x4a4a4a, { p: [-1.05, 0.87, -0.8] });
  b.add(shapes.cylinder(0.31, 0.31, 0.04, 14), 0x5a5a5a, { p: [-1.05, 1.1, -0.8] });
  b.add(shapes.sphere(0.05, 6, 4), 0x2a2a2a, { p: [-1.05, 1.14, -0.8] });
  b.add(shapes.cylinder(0.24, 0.24, 0.2, 10), 0x8a8a8a, { p: [-1.05, 0.68, -0.8] });
  for (let i = 0; i < 6; i++) {
    b.add(shapes.lathe([[0.001, 0], [0.06, 0], [0.11, 0.04], [0.12, 0.07], [0.001, 0.07]], 10), 0xf4efe2, { p: [0.9, 0.66 + i * 0.045, -0.7], flat: true });
  }
  b.add(shapes.cylinder(0.04, 0.04, 0.2, 8), 0x9a6438, { p: [1.25, 0.76, -0.62] });
  for (let i = 0; i < 6; i++) b.limb([1.25 + (rand() - 0.5) * 0.04, 0.8, -0.62], [1.25 + (rand() - 0.5) * 0.08, 0.98, -0.62 + (rand() - 0.5) * 0.06], 0.006, 0xd8c08a, { capsule: false, seg: 4 });
  b.add(shapes.cylinder(0.2, 0.16, 0.12, 10), 0x9a7a4a, { p: [0.15, 0.72, -0.75] });
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    b.add(shapes.ico(0.06, 0), i % 2 ? 0x5fae48 : 0x86c75a, { p: [0.15 + Math.cos(a) * 0.08, 0.8, -0.75 + Math.sin(a) * 0.08], s: [1, 0.5, 1], flat: true });
  }

  const tableZ = -D + 1.45;
  for (const tx of [-1.7, 1.7]) {
    b.add(shapes.box(1.1, 0.06, 0.75), WOOD, { p: [tx, 0.62, tableZ] });
    for (const [dx, dz] of [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]]) {
      b.add(shapes.box(0.05, 0.6, 0.05), WOOD_DARK, { p: [tx + dx, 0.3, tableZ + dz] });
    }
    for (const [x, z] of [[tx - 0.8, tableZ], [tx + 0.8, tableZ], [tx, tableZ + 0.65]]) {
      b.add(shapes.cylinder(0.16, 0.16, 0.05, 10), 0xc0392b, { p: [x, 0.36, z] });
      b.add(shapes.cylinder(0.12, 0.14, 0.34, 8), 0xa02a1e, { p: [x, 0.17, z] });
    }
    block(tx - 1.0, tableZ - 0.45, tx + 1.0, tableZ + 0.85, 1);
  }
  b.add(shapes.box(0.9, 1.2, 0.05), 0x2a2a2a, { p: [0, 1.7 + LIFT, -D + 0.23] });
  b.add(shapes.box(0.96, 1.26, 0.03), WOOD, { p: [0, 1.7 + LIFT, -D + 0.21] });

  for (const x of [-LAMP_X, LAMP_X]) b.limb([x, 2.74 + LIFT, 0.35], [x, H - 0.22, 0.2], 0.008, 0x3a2414, { capsule: false, seg: 4 });
  const mesh = b.mesh();
  const group = new THREE.Group();
  group.add(mesh, walls.mesh(plasterMaterial()));

  glowMaterial ??= toonMaterial({ vertexColors: true, emissive: 0xff7a2a, emissiveIntensity: 0 });
  const lamps = new Batch();
  for (const x of [-LAMP_X, LAMP_X]) {
    lamps.add(shapes.sphere(0.22, 10, 8), x < 0 ? 0xd8321e : 0xf2b630, { p: [x, 2.45 + LIFT, 0.35], s: [1, 1.25, 1] });
    lamps.add(shapes.cylinder(0.1, 0.11, 0.05, 8), 0xf2c14e, { p: [x, 2.73 + LIFT, 0.35] });
    lamps.add(shapes.cylinder(0.11, 0.1, 0.05, 8), 0xf2c14e, { p: [x, 2.17 + LIFT, 0.35] });
  }
  const glow = lamps.mesh(glowMaterial, { shadow: false });
  group.add(glow);
  group.userData.lights = [-LAMP_X, LAMP_X].map((x) => ({ position: new THREE.Vector3(x, 2.45 + LIFT, 0.35), tint: x < 0 ? 0xd8321e : 0xf2b630 }));

  return {
    group,
    obstacles,
    counter: { x: 0, z: 0.2 },
    keeper: { x: 0, z: -1.6, facing: 0 },
    plaque: { x: 0, y: 2.62 + LIFT, z: 0.06 },
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
  const title = document.getElementById('foodTitle');
  const badge = dialog.querySelector('.sched-badge');
  const EATERY_MENU = {
    title: title.textContent,
    icon: badge.textContent,
    foods: FOODS,
    hungry: 'Bà chủ quán: "Ăn gì con? Đồ ăn nóng hổi đây!"',
    full: 'Bà chủ quán: "Con còn no mà, lát đói ghé lại nghen!"',
  };
  let menu = EATERY_MENU;

  function render() {
    header.textContent = `⚡ ${Math.floor(purse.energy)}/${ENERGY.max} · ${MONEY.icon} ${amount(purse.money)}`;
    const full = purse.full;
    list.replaceChildren(
      ...Object.entries(menu.foods).map(([, food]) => {
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
            note.textContent = notEnough(food.price);
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

  closable(dialog);
  purse.onChange(() => {
    if (dialog.open) render();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open(next = EATERY_MENU) {
      menu = next;
      title.textContent = menu.title;
      badge.textContent = menu.icon;
      note.textContent = purse.full ? menu.full : menu.hungry;
      render();
      dialog.showModal();
    },
  };
}
