import * as THREE from 'three';
import { Batch, freeze, shapes } from './toon.js';
import { plaqueBoard } from './village.js';
import { ATM } from './config.js';
import { PLAYER } from './inventory.js';
import { amount, coins } from './format.js';
import { closable } from './dialog.js';
import { setRich } from './goldArt.js';
import { BANK_ART } from './bankArt.js';

const BODY = { w: 0.72, h: 1.7, d: 0.55 };
const BASE = 0.08;
const STAND_GAP = 0.95;
const FRONT = BODY.d / 2;

function buildAtm() {
  const group = new THREE.Group();
  const b = new Batch();
  b.add(shapes.box(BODY.w + 0.12, BASE, BODY.d + 0.12), 0x8a8273, { p: [0, BASE / 2, 0] });
  b.add(shapes.rounded(BODY.w, BODY.h, BODY.d, 0.05), 0x1f4a6e, { p: [0, BASE + BODY.h / 2, 0] });
  b.add(shapes.box(BODY.w + 0.08, 0.12, BODY.d + 0.14), 0x163650, { p: [0, BASE + BODY.h + 0.06, 0.03] });
  b.add(shapes.box(0.5, 0.36, 0.03), 0x0f1a24, { p: [0, 1.28, FRONT + 0.01] });
  b.add(shapes.box(0.42, 0.28, 0.02), 0x5fb4e6, { p: [0, 1.28, FRONT + 0.03] });
  b.add(shapes.box(0.54, 0.05, 0.18), 0xc9c4b8, { p: [0, 1.02, FRONT + 0.08], r: [0.3, 0, 0] });
  b.add(shapes.box(0.14, 0.025, 0.02), 0x0b0f14, { p: [0.16, 0.92, FRONT + 0.01] });
  b.add(shapes.box(0.36, 0.035, 0.02), 0x0b0f14, { p: [0, 0.74, FRONT + 0.01] });
  const body = b.mesh();
  group.add(body);
  const sign = plaqueBoard(['ATM'], { bg: 0x1f4a6e, fg: '#fff3c4', border: 0xf2c14e });
  sign.mesh.scale.setScalar(0.4);
  sign.mesh.position.set(0, BASE + BODY.h - 0.13, FRONT + 0.02);
  group.add(sign.mesh);
  return { group, clickables: [body, sign.mesh] };
}

export function createAtms(scene, heightAt) {
  const root = new THREE.Group();
  const atms = ATM.spots.map((spot) => {
    const built = buildAtm();
    const y = heightAt(spot.x, spot.z);
    built.group.position.set(spot.x, y, spot.z);
    root.add(built.group);
    const stand = { x: spot.x, z: spot.z + FRONT + STAND_GAP };
    const line = [stand, { x: spot.x + 0.9, z: stand.z + 0.7 }, { x: spot.x + 4, z: stand.z + 0.7 }];
    return { id: spot.id, name: spot.name, x: spot.x, y, z: spot.z, group: built.group, clickables: built.clickables, stand, look: { x: spot.x, z: spot.z }, line };
  });
  scene.add(root);
  freeze(root);

  return {
    list: atms.map(({ id, name, stand, look, line }) => ({ id, name, stand, look, line })),
    clickables: atms.flatMap((atm) => atm.clickables),
    obstacles: atms.map(({ x, y, z }) => ({ minX: x - BODY.w / 2 - 0.06, maxX: x + BODY.w / 2 + 0.06, minZ: z - BODY.d / 2 - 0.06, maxZ: z + BODY.d / 2 + 0.06, minY: y, maxY: y + 2 })),
    atmOf(object) {
      for (let node = object; node; node = node.parent) {
        const atm = atms.find((item) => item.group === node);
        if (atm) return atm;
      }
      return null;
    },
  };
}

export function createAtmUI({ bank, purse, owner = PLAYER }) {
  const dialog = document.getElementById('atmDialog');
  const title = document.getElementById('atmTitle');
  const money = document.getElementById('atmMoney');
  const balance = document.getElementById('atmBalance');
  const form = document.getElementById('atmForm');
  const input = document.getElementById('atmAmount');
  const note = document.getElementById('atmNote');
  for (const node of dialog.querySelectorAll('[data-art]')) {
    node.innerHTML = BANK_ART[node.dataset.art];
    node.setAttribute('aria-hidden', 'true');
  }

  function render() {
    money.textContent = amount(purse.money);
    setRich(balance, `Số dư: ${coins(bank.atmBalance(owner))} · Phí rút: ${coins(ATM.fee)}`);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = Math.floor(Number(input.value) || 0);
    if (value <= 0) {
      note.textContent = 'Nhập số tiền trước nhé.';
      return;
    }
    const result = event.submitter?.value === 'deposit' ? bank.atmDeposit(owner, purse, value) : bank.atmWithdraw(owner, purse, value);
    setRich(note, result.text);
    if (result.ok) input.value = '';
    render();
  });
  closable(dialog);
  purse.onChange(() => {
    if (dialog.open) render();
  });
  bank.onChange(() => {
    if (dialog.open) render();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open(atm) {
      title.textContent = `ATM · ${atm.name}`;
      note.textContent = '';
      input.value = '';
      render();
      dialog.showModal();
    },
    close() {
      dialog.close();
    },
  };
}
