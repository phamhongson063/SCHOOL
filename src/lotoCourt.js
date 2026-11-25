import * as THREE from 'three';
import { pooledLight } from './lightPool.js';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { createLotoStage } from './architecture.js';
import { createLanternGlow } from './lanternGlow.js';
import { createCourtLight, createLotoAura } from './lotoAura.js';
import { COURT, courtBase, courtPoint, courtTop } from './terrain.js';
import { idleKeeper, keeperNPC } from './village.js';
import { createAttention } from './attention.js';
import { keepCanvas } from './canvasRestore.js';
import { claimHold, createSlotClaims, lineSlots } from './blessingSpots.js';

const CALLER_LOOK = { shirt: 0x2e4a7a, pants: 0x2a2420, skin: 0xe0b088, style: 'khan', khan: 0x1f1e26, hairColor: 0x2a2420, iris: 0x3a2214 };
const CALLER_MODEL = 'man-brown';
const SEAT_OFFSETS = [-7.5, -5, -2.5, 0, 2.5, 5, 7.5];
const BOARD = { v: 6.55, bottom: 1.05, width: 3.6, height: 1.7, pixels: [768, 362] };
const VIEW_DISTANCE = 70;
const AURA_DISTANCE = 120;
const LIGHTS = {
  caller: { color: 0xffd29a, intensity: 18, distance: 9, height: 2.6, ahead: 1.2 },
  canopy: { color: 0xffc480, intensity: 40, distance: 24, height: 7, row: 2 },
};
const STAGE_SPOTS = [{ v: 5.4, size: 7 }, { v: 3.3, size: 5 }];
const FRAME = { lacquer: 0x7a1e16, gold: 0xd9a63a, post: 0x5a1610 };
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
  const bg = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.6);
  bg.addColorStop(0, '#3a1410');
  bg.addColorStop(1, '#170806');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d9a63a';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, width - 60, height - 60);
  ctx.fillStyle = '#d9a63a';
  for (const [x, y] of [[30, 30], [width - 30, 30], [30, height - 30], [width - 30, height - 30]]) {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8b85a';
  ctx.font = `700 38px ${BOARD_FONT}`;
  ctx.fillText(board.title, width / 2, 68);
  ctx.save();
  ctx.shadowColor = 'rgba(255,200,100,0.9)';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffe7a8';
  fitText(ctx, board.text, width - 100, 96);
  ctx.fillText(board.text, width / 2, height / 2 + 14);
  ctx.restore();
  if (board.note) {
    ctx.fillStyle = '#d8b27a';
    let size = 30;
    ctx.font = `600 ${size}px ${BOARD_FONT}`;
    while (size > 16 && ctx.measureText(board.note).width > width - 90) {
      size -= 2;
      ctx.font = `600 ${size}px ${BOARD_FONT}`;
    }
    ctx.fillText(board.note, width / 2, height - 62);
  }
}

function courtSurfaces() {
  const { halfU, halfV, front, step, rise, terraces, stage } = COURT;
  const surfaces = [{ x0: -halfU, x1: halfU, z0: -halfV, z1: -front, y: 0 }];
  for (let k = 0; k < terraces; k++) {
    const edge = -front + step * k;
    surfaces.push({ x0: -halfU, x1: halfU, z0: edge, z1: edge + step, y: rise * (k + 1) });
    surfaces.push({ x0: -halfU, x1: halfU, z0: edge - 0.015, y: rise * k, y1: rise * (k + 1) });
  }
  surfaces.push({ x0: -stage.halfU, x1: stage.halfU, z0: -stage.to, z1: -stage.from, y: stage.lift + 0.02 });
  return surfaces;
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
  const faceMaterial = toonMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.25 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.width, BOARD.height), faceMaterial);
  const frame = new Batch();
  const legHeight = BOARD.bottom + BOARD.height / 2;
  frame.add(shapes.box(BOARD.width + 0.3, BOARD.height + 0.3, 0.1), FRAME.lacquer, { p: [0, 0, -0.06] });
  frame.add(shapes.box(BOARD.width + 0.38, 0.05, 0.14), FRAME.gold, { p: [0, BOARD.height / 2 + 0.17, -0.06] });
  frame.add(shapes.box(BOARD.width + 0.38, 0.05, 0.14), FRAME.gold, { p: [0, -BOARD.height / 2 - 0.17, -0.06] });
  const legTop = BOARD.height / 2 + 0.12;
  for (const side of [-1, 1]) {
    const x = side * (BOARD.width / 2 + 0.2);
    frame.add(shapes.cylinder(0.08, 0.09, legHeight + legTop, 8), FRAME.post, { p: [x, (legTop - legHeight) / 2, -0.06] });
    frame.add(shapes.cylinder(0.11, 0.11, 0.05, 8), FRAME.gold, { p: [x, legTop - 0.03, -0.06] });
    frame.add(shapes.cylinder(0.12, 0.12, 0.05, 8), FRAME.gold, { p: [x, -legHeight + 0.1, -0.06] });
  }
  const boardGroup = new THREE.Group();
  boardGroup.add(frame.mesh(), face);
  boardGroup.position.copy(courtVector(0, BOARD.v, deck + BOARD.bottom + BOARD.height / 2));
  boardGroup.rotation.y = facing;
  scene.add(boardGroup);
  freeze(boardGroup);

  const stage = createLotoStage({
    half: COURT.stage.halfU,
    front: -COURT.stage.from,
    back: -COURT.stage.to,
    lift: COURT.stage.lift,
    posts: COURT.posts.map(([u, v]) => [-u, -v]),
    poles: COURT.lanterns.map(([u, v]) => [-u, -v]),
    audience: { front: -COURT.front, step: COURT.step, rise: COURT.rise, count: COURT.terraces, half: COURT.halfU, poleX: COURT.rowPole },
  });
  stage.group.position.set(COURT.x, base, COURT.z);
  stage.group.rotation.y = facing;
  scene.add(stage.group);
  freeze(stage.group);
  const glow = createLanternGlow(stage.group.userData.lights.map(({ position, tint, intensity }) => ({ position: stage.group.localToWorld(position.clone()), tint, intensity: (intensity ?? 1) * 0.7 })), { rays: false });
  scene.add(glow.object);
  const courtLight = createCourtLight({
    spots: [...stage.pools, ...STAGE_SPOTS.map(({ v, size }) => ({ position: new THREE.Vector3(0, 0, -v), size }))],
    surfaces: courtSurfaces(),
    bounds: { x0: -COURT.halfU, x1: COURT.halfU, z0: -COURT.halfV, z1: COURT.halfV },
  });
  courtLight.group.position.copy(stage.group.position);
  courtLight.group.rotation.y = facing;
  scene.add(courtLight.group);
  freeze(courtLight.group);
  const lamps = Object.entries({
    caller: new THREE.Vector3(0, COURT.stage.lift + LIGHTS.caller.height, -COURT.caller.v + LIGHTS.caller.ahead),
    canopy: new THREE.Vector3(0, COURT.rise * (LIGHTS.canopy.row + 1) + LIGHTS.canopy.height, -COURT.front + COURT.step * (LIGHTS.canopy.row + 0.5)),
  }).map(([kind, local]) => {
    const spec = LIGHTS[kind];
    const lamp = pooledLight(spec.color, 0, spec.distance, 2);
    lamp.position.copy(stage.group.localToWorld(local));
    scene.add(lamp);
    return { lamp, spec };
  });
  const aura = createLotoAura({ pearl: stage.pearl - COURT.stage.lift });
  const stageMiddle = (COURT.stage.from + COURT.stage.to) / 2;
  aura.group.position.copy(courtVector(0, stageMiddle, deck));
  aura.group.rotation.y = facing;
  scene.add(aura.group);

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
    clickables: [npc.walker.group, boardGroup, stage.group],
    caller: { ...npc, at, stand, attend: attention.attend, release: attention.release },
    stand,
    center,
    owns(object) {
      for (let node = object; node; node = node.parent) if (node === npc.walker.group || node === boardGroup || node === stage.group) return true;
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
    update(t, camera, night) {
      clock = t;
      attention.update(t);
      glow.update(t, night);
      courtLight.update(night);
      for (const { lamp, spec } of lamps) lamp.intensity = night * spec.intensity;
      faceMaterial.emissiveIntensity = 0.25 + 0.6 * night;
      const distance = camera.position.distanceTo(at);
      aura.group.visible = distance < AURA_DISTANCE;
      if (aura.group.visible) aura.update(t, night);
      const near = distance < VIEW_DISTANCE;
      npc.walker.group.visible = near;
      boardGroup.visible = near;
      if (!near) return;
      idleKeeper(npc, t);
    },
  };
}
