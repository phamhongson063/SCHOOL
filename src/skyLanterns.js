import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';
import { LANTERN } from './config.js';
import { landedAt } from './lanterns.js';

const PROFILE = [
  [0.3, 0],
  [0.36, 0.12],
  [0.42, 0.36],
  [0.45, 0.6],
  [0.43, 0.8],
  [0.35, 0.95],
  [0.2, 1.04],
  [0, 1.07],
];
const RIBS = 6;
const SPARKS = 12;
const SCALE = 1.2;
const DIM = new THREE.Color(0x8c8c8c);
const LIT = new THREE.Color(0xffffff);

function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paint(ctx, size));
}

function paintPaper(ctx, size) {
  const shade = ctx.createLinearGradient(0, 0, 0, size);
  shade.addColorStop(0, '#b81f14');
  shade.addColorStop(0.3, '#e2461d');
  shade.addColorStop(0.62, '#ff9a34');
  shade.addColorStop(0.86, '#ffd766');
  shade.addColorStop(1, '#fff2b0');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size / 2, size * 1.05, 0, size / 2, size * 1.05, size * 0.75);
  glow.addColorStop(0, 'rgba(255, 250, 210, 0.7)');
  glow.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(96, 32, 8, 0.55)';
  ctx.lineWidth = size / 128;
  for (let i = 0; i <= RIBS; i++) {
    const x = (i / RIBS) * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  ctx.fillStyle = '#c4161c';
  for (let i = 0; i < RIBS; i++) {
    const cx = ((i + 0.5) / RIBS) * size;
    const cy = size * 0.52;
    const r = size / 70;
    for (const [dx, dy] of [
      [-2.4, 0.6],
      [0, -0.8],
      [2.4, 0.6],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cx + dx * r, cy + dy * r, r * 0.8, r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintGlow(ctx, size) {
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255, 236, 170, 0.9)');
  g.addColorStop(0.25, 'rgba(255, 190, 90, 0.45)');
  g.addColorStop(0.6, 'rgba(255, 130, 40, 0.12)');
  g.addColorStop(1, 'rgba(255, 110, 30, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function paintFlame(ctx, size) {
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c * 1.1, 0, c, c * 1.1, c);
  g.addColorStop(0, 'rgba(255, 255, 240, 1)');
  g.addColorStop(0.3, 'rgba(255, 220, 110, 0.9)');
  g.addColorStop(0.7, 'rgba(255, 130, 30, 0.35)');
  g.addColorStop(1, 'rgba(255, 90, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function paintSpark(ctx, size) {
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255, 245, 200, 1)');
  g.addColorStop(0.4, 'rgba(255, 210, 90, 0.8)');
  g.addColorStop(1, 'rgba(255, 180, 60, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

let shared = null;

function sharedParts() {
  if (shared) return shared;
  const body = new THREE.LatheGeometry(
    PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    28,
  );
  const rim = new THREE.TorusGeometry(PROFILE[0][0], 0.014, 6, 32);
  rim.rotateX(Math.PI / 2);
  const wire = new THREE.BoxGeometry(PROFILE[0][0] * 2, 0.012, 0.012);
  shared = {
    body,
    rim,
    wire,
    paper: canvasTexture(256, paintPaper),
    glow: canvasTexture(128, paintGlow),
    flame: canvasTexture(64, paintFlame),
    spark: canvasTexture(32, paintSpark),
    frame: new THREE.MeshBasicMaterial({ color: 0x5a2a0e }),
  };
  return shared;
}

function buildLantern(id) {
  const parts = sharedParts();
  const group = new THREE.Group();
  const paper = new THREE.MeshBasicMaterial({ map: parts.paper, side: THREE.DoubleSide, transparent: true, opacity: 0.97 });
  const body = new THREE.Mesh(parts.body, paper);
  body.userData.lanternId = id;
  const rim = new THREE.Mesh(parts.rim, parts.frame);
  const wires = [0, Math.PI / 2].map((turn) => {
    const wire = new THREE.Mesh(parts.wire, parts.frame);
    wire.rotation.y = turn;
    return wire;
  });
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: parts.flame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flame.position.y = 0.06;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: parts.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 0.6;
  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({ map: parts.spark, size: 0.14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  const lantern = new THREE.Group();
  lantern.scale.setScalar(SCALE);
  lantern.add(body, rim, ...wires, flame);
  group.add(lantern, halo, sparks);
  const phase = Math.random() * Math.PI * 2;
  const orbit = Array.from({ length: SPARKS }, () => ({ angle: Math.random() * Math.PI * 2, radius: 0.6 + Math.random() * 0.9, lift: Math.random() * 1.6 - 0.3, speed: 0.25 + Math.random() * 0.45 }));
  return { group, lantern, body, paper, flame, halo, sparks, sparkPositions, sparkMaterial, phase, orbit };
}

function disposeLantern(view) {
  view.paper.dispose();
  view.flame.material.dispose();
  view.halo.material.dispose();
  view.sparkMaterial.dispose();
  view.sparks.geometry.dispose();
}

export function createSkyLanterns(scene, { known }) {
  const root = new THREE.Group();
  scene.add(root);
  const views = new Map();
  const clickables = [];

  function viewOf(lantern) {
    let view = views.get(lantern.id);
    if (!view) {
      view = buildLantern(lantern.id);
      views.set(lantern.id, view);
      root.add(view.group);
      clickables.push(view.body);
    }
    return view;
  }

  function drop(id) {
    const view = views.get(id);
    if (!view) return;
    root.remove(view.group);
    clickables.splice(clickables.indexOf(view.body), 1);
    disposeLantern(view);
    views.delete(id);
  }

  function pose(view, lantern, now, t) {
    const hover = lantern.y + LANTERN.hover;
    const sway = Math.sin(t * 0.9 + view.phase);
    let y = hover + Math.sin(t * 1.4 + view.phase) * 0.12;
    let x = lantern.x;
    let z = lantern.z;
    let fade = 1;
    if (now < landedAt(lantern)) {
      const k = Math.min(1, Math.max(0, (now - lantern.dropAt) / LANTERN.fall));
      const left = (1 - k) * (1 - k);
      y = hover + LANTERN.sky * left;
      x += Math.sin(t * 0.7 + view.phase) * 1.4 * left;
      z += Math.cos(t * 0.6 + view.phase) * 1.4 * left;
    }
    if (lantern.doneAt !== null) {
      const k = Math.min(1, Math.max(0, (now - lantern.doneAt) / LANTERN.rise));
      y = hover + LANTERN.sky * k * k;
      fade = 1 - Math.max(0, k - 0.6) / 0.4;
    }
    view.group.position.set(x, y, z);
    view.lantern.rotation.set(sway * 0.06, t * 0.15 + view.phase, Math.cos(t * 0.8 + view.phase) * 0.05);
    return fade;
  }

  function shine(view, lantern, fade, t) {
    const lit = known(lantern.key);
    const flicker = 0.85 + Math.sin(t * 9 + view.phase) * 0.08 + Math.sin(t * 23 + view.phase * 2) * 0.05;
    view.paper.color.copy(lit ? LIT : DIM);
    view.paper.opacity = 0.97 * fade;
    view.flame.material.opacity = fade * (lit ? 1 : 0.5);
    view.flame.scale.setScalar(0.24 * flicker);
    view.halo.material.opacity = fade * (lit ? 0.75 : 0.3) * flicker;
    view.halo.scale.setScalar(3.4 * (0.95 + flicker * 0.05));
    view.sparkMaterial.opacity = fade * (lit ? 0.9 : 0.35);
    for (const [i, spark] of view.orbit.entries()) {
      const a = spark.angle + t * spark.speed;
      view.sparkPositions[i * 3] = Math.cos(a) * spark.radius;
      view.sparkPositions[i * 3 + 1] = spark.lift + Math.sin(t * 1.3 + i) * 0.15;
      view.sparkPositions[i * 3 + 2] = Math.sin(a) * spark.radius;
    }
    view.sparks.geometry.attributes.position.needsUpdate = true;
  }

  return {
    clickables,
    lanternAt(object) {
      for (let node = object; node; node = node.parent) if (node.userData.lanternId !== undefined) return node.userData.lanternId;
      return null;
    },
    update(list, now, t) {
      const seen = new Set();
      for (const lantern of list) {
        if (now < lantern.dropAt) continue;
        seen.add(lantern.id);
        const view = viewOf(lantern);
        shine(view, lantern, pose(view, lantern, now, t), t);
      }
      for (const id of [...views.keys()]) if (!seen.has(id)) drop(id);
    },
  };
}
