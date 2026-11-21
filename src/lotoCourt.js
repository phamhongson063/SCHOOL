import * as THREE from 'three';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { COURT, courtBase, courtPoint, courtTop } from './terrain.js';
import { keeperNPC } from './village.js';
import { createAttention } from './attention.js';
import { keepCanvas } from './canvasRestore.js';
import { claimHold, createSlotClaims, lineSlots } from './blessingSpots.js';

const CALLER_LOOK = { shirt: 0x2e4a7a, pants: 0x2a2420, skin: 0xe0b088, style: 'khan', khan: 0x1f1e26, hairColor: 0x2a2420, iris: 0x3a2214 };
const CALLER_MODEL = 'man-brown';
const SEAT_OFFSETS = [-7.5, -5, -2.5, 0, 2.5, 5, 7.5];
const BOARD = { v: 6.55, bottom: 1.05, width: 3.6, height: 1.7, pixels: [768, 362] };
const VIEW_DISTANCE = 70;
const BOARD_FONT = '"BIZ UDPGothic", "Hiragino Sans", system-ui, sans-serif';
const CALLER_LINES = ['Lô tô chữ mở lúc 22:30 nhé!', 'Mua vé đi, quỹ thưởng to lắm!', 'Nghe kỹ, chạm cho chuẩn nha!'];

function fitText(ctx, text, maxWidth, size) {
  let font = size;
  ctx.font = `700 ${font}px ${BOARD_FONT}`;
  while (font > 28 && ctx.measureText(text).width > maxWidth) {
    font -= 4;
    ctx.font = `700 ${font}px ${BOARD_FONT}`;
  }
}

function paintBoard(ctx, width, height, board) {
  ctx.fillStyle = '#f6ecd2';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#6a3a1e';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, width - 14, height - 14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a2e22';
  ctx.font = `700 40px ${BOARD_FONT}`;
  ctx.fillText(board.title, width / 2, 58);
  ctx.fillStyle = '#2a1a10';
  fitText(ctx, board.text, width - 80, 92);
  ctx.fillText(board.text, width / 2, height / 2 + 16);
  if (board.note) {
    ctx.fillStyle = '#7a5a3a';
    ctx.font = `600 32px ${BOARD_FONT}`;
    ctx.fillText(board.note, width / 2, height - 48);
  }
}

function courtVector(u, v, y) {
  const at = courtPoint(u, v);
  return new THREE.Vector3(at.x, y, at.z);
}

export function createLotoCourt(scene) {
  const base = courtBase();
  const deck = base + COURT.stage.lift;
  const facing = COURT.turn + Math.PI;

  const board = { title: 'Lô tô chữ', text: '22:30', note: '' };
  const [width, height] = BOARD.pixels;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const paint = (ctx) => paintBoard(ctx, width, height, board);
  paint(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  keepCanvas(texture, paint);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.width, BOARD.height), toonMaterial({ map: texture }));
  const frame = new Batch();
  frame.add(shapes.box(BOARD.width + 0.24, BOARD.height + 0.24, 0.1), 0x5a3a22, { p: [0, 0, -0.06] });
  for (const side of [-1, 1]) frame.add(shapes.box(0.12, BOARD.bottom + BOARD.height / 2, 0.12), 0x5a3a22, { p: [side * (BOARD.width / 2 + 0.06), -(BOARD.bottom + BOARD.height / 2) / 2, -0.06] });
  const boardGroup = new THREE.Group();
  boardGroup.add(frame.mesh(), face);
  boardGroup.position.copy(courtVector(0, BOARD.v, deck + BOARD.bottom + BOARD.height / 2));
  boardGroup.rotation.y = facing;
  scene.add(boardGroup);
  freeze(boardGroup);

  const npc = keeperNPC(CALLER_LOOK, CALLER_MODEL);
  const at = courtVector(0, COURT.caller.v, deck);
  npc.walker.group.position.copy(at);
  npc.walker.group.rotation.y = facing;
  scene.add(npc.walker.group);
  const attention = createAttention(npc.walker.group);
  const stand = courtVector(0, COURT.caller.standV, base);

  const rows = lineSlots({ x: COURT.x, z: COURT.z }, COURT.turn, Array.from({ length: COURT.terraces }, (_, k) => ({ reach: COURT.front - COURT.step * (k + 0.5), offsets: SEAT_OFFSETS })));
  const claims = createSlotClaims(rows);
  const center = { x: COURT.x, z: COURT.z };
  let clock = 0;

  const repaint = () => {
    paint(canvas.getContext('2d'));
    texture.needsUpdate = true;
  };

  return {
    clickables: [npc.walker.group, boardGroup],
    caller: { ...npc, at, stand, attend: attention.attend, release: attention.release },
    stand,
    center,
    owns(object) {
      for (let node = object; node; node = node.parent) if (node === npc.walker.group || node === boardGroup) return true;
      return false;
    },
    inside: (position) => courtTop(position.x, position.z) !== null,
    spotFor(id, from, speed) {
      const slot = claims.claim(id, clock, claimHold(from, center, speed));
      return new THREE.Vector3(slot.x, courtTop(slot.x, slot.z) ?? base, slot.z);
    },
    leaveSpot: (id) => claims.release(id),
    greet() {
      npc.bubble.show(CALLER_LINES[Math.floor(Math.random() * CALLER_LINES.length)], 2.2, clock);
    },
    say(text, seconds) {
      npc.bubble.show(text, seconds, clock);
    },
    setBoard(next) {
      if (next.title === board.title && next.text === board.text && next.note === board.note) return;
      Object.assign(board, next);
      repaint();
    },
    update(t, camera) {
      clock = t;
      attention.update(t);
      const near = camera.position.distanceTo(at) < VIEW_DISTANCE;
      npc.walker.group.visible = near;
      boardGroup.visible = near;
      if (!near) return;
      npc.bubble.update(t);
      npc.walker.head.rotation.y = Math.sin(t * 0.5 + npc.phase) * 0.45;
      npc.walker.head.rotation.x = Math.sin(t * 0.9 + npc.phase) * 0.05;
      npc.walker.face?.update(t, npc.bubble.visible && Math.sin(t * 11) > 0 ? 'talk' : 'open');
      npc.walker.pose?.();
    },
  };
}
