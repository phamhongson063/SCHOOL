import * as THREE from 'three';
import { Batch, freeze, labelBox, shapes, toonMaterial } from './toon.js';
import { CERTIFY } from './config.js';
import { dateText, hoursText, DAY_MINUTES } from './clock.js';
import { keepCanvas } from './canvasRestore.js';

export const NOTICE = { x: -5.6, z: 31.4 };
export const NOTICE_STAND = { x: -5.6, z: 32.9 };

const WIDTH = 1.9;
const HEIGHT = 1.45;
const PX = 300;
const FONT = '"BIZ UDPGothic", system-ui, -apple-system, "Segoe UI", sans-serif';

function paint(ctx, w, h, day) {
  ctx.fillStyle = '#f4e7c4';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(140,100,40,0.08)';
  for (let y = 0; y < h; y += 7) ctx.fillRect(0, y, w, 2);
  ctx.strokeStyle = '#8a1d14';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a1d14';
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText('TRƯỜNG KHẢO THÍ', w / 2, 62);
  ctx.fillStyle = '#4a2e18';
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(`Ngày ${dateText(day * DAY_MINUTES)}`, w / 2, 110);
  const rows = [
    ['Mở cửa', hoursText({ open: CERTIFY.open, close: CERTIFY.close })],
    ['Lệ phí', `${CERTIFY.examFee} đồng + ${CERTIFY.examIntellect} trí lực`],
    ['Đậu', `≥ ${Math.round(CERTIFY.pass * 100)}%`],
  ];
  ctx.font = `600 28px ${FONT}`;
  rows.forEach(([label, value], i) => {
    const y = 175 + i * 52;
    ctx.fillStyle = '#2b1c12';
    ctx.textAlign = 'left';
    ctx.fillText(label, 50, y);
    ctx.textAlign = 'right';
    ctx.fillText(value, w - 50, y);
  });
}

export function createNoticeBoard(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * PX);
  canvas.height = Math.round(HEIGHT * PX);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  let shownDay = null;
  keepCanvas(texture, (ctx) => {
    if (shownDay !== null) paint(ctx, canvas.width, canvas.height, shownDay);
  });

  const group = new THREE.Group();
  group.position.set(NOTICE.x, 0, NOTICE.z);
  const b = new Batch();
  const WOOD = 0x6b4425;
  const DARK = 0x4a2c1a;
  for (const side of [-1, 1]) {
    b.add(shapes.box(0.14, 2.75, 0.14), WOOD, { p: [side * (WIDTH / 2 + 0.12), 1.375, 0] });
    b.add(shapes.box(0.24, 0.12, 0.24), 0x9e9484, { p: [side * (WIDTH / 2 + 0.12), 0.06, 0] });
  }
  b.add(shapes.box(WIDTH + 0.5, 0.1, 0.16), DARK, { p: [0, 2.72, 0] });
  b.add(shapes.box(WIDTH + 0.9, 0.08, 0.7), 0x9a3e2a, { p: [0, 2.9, 0.02], r: [0.12, 0, 0] });
  b.add(shapes.box(WIDTH + 0.9, 0.08, 0.7), 0x8e3524, { p: [0, 2.96, -0.08], r: [-0.4, 0, 0] });
  b.add(shapes.cylinder(0.07, 0.07, WIDTH + 1, 8), 0x7a2a1c, { p: [0, 3.06, -0.04], r: [0, 0, Math.PI / 2] });
  b.add(shapes.box(WIDTH + 0.16, HEIGHT + 0.16, 0.06), DARK, { p: [0, 1.75, -0.03] });
  const frame = b.mesh();
  group.add(frame);

  const panel = new THREE.Mesh(labelBox(WIDTH, HEIGHT, 0.05), toonMaterial({ map: texture }));
  panel.position.set(0, 1.75, 0.01);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);
  scene.add(group);
  freeze(group);

  const refresh = (day) => {
    if (day === shownDay) return;
    shownDay = day;
    paint(canvas.getContext('2d'), canvas.width, canvas.height, day);
    texture.needsUpdate = true;
  };
  document.fonts?.ready.then(() => {
    const day = shownDay;
    shownDay = null;
    if (day !== null) refresh(day);
  });

  const obstacles = [-1, 1].map((sideX) => {
    const x = NOTICE.x + sideX * (WIDTH / 2 + 0.12);
    return { minX: x - 0.12, minZ: NOTICE.z - 0.12, maxX: x + 0.12, maxZ: NOTICE.z + 0.12, minY: 0, maxY: 3 };
  });

  return {
    group,
    clickables: [frame, panel],
    obstacles,
    stand: NOTICE_STAND,
    owns(object) {
      for (let node = object; node; node = node.parent) if (node === group) return true;
      return false;
    },
    refresh,
  };
}
