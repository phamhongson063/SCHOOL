import * as THREE from 'three';
import { Batch, shapes, shade, toonMaterial, vertexMaterial, canvasTexture } from './toon.js';
import { between, makeRandom } from './random.js';
import { keepCanvas } from './canvasRestore.js';

const PAL = {
  wood: 0x6a3f24,
  woodMid: 0x7d4c2b,
  woodDark: 0x3f2516,
  woodLight: 0x9a6438,
  rafter: 0x3a2618,
  stone: 0xb3ab99,
  stoneDark: 0x8a8273,
  plinth: 0x7d776b,
  coping: 0x5c4a3e,
  mortar: 0xe6dcc4,
  ridge: 0x7e3a26,
  tileEnd: 0x8c3e28,
  lacquer: 0x9e2a1c,
  gold: 0xd9a63a,
  bronze: 0x8a6a3a,
  cream: 0xf2e8cf,
  ink: 0x1e1814,
  paper: 0xead2a0,
  leaf: 0x4f9a3f,
  leafDark: 0x386f2e,
  leafLight: 0x79b851,
  trunk: 0x6b4a32,
  pot: 0xa4552f,
  soil: 0x4a3324,
  burlap: 0xd2bd8c,
  basket: 0xb08850,
  basketDark: 0x87653a,
  rice: 0xf4efe2,
  straw: 0xc8a860,
  jade: 0x3f8f7a,
  yellows: [0xe8b84a, 0xf0c35a, 0xdca842, 0xf2cf6e, 0xe3ae3c, 0xeec060, 0xd9a43e, 0xf5d07a],
  shutters: [0x2f7f86, 0x3c8f9c, 0x2a6f9e, 0x4a9a8a, 0x3a7fa8],
  blooms: [0xd8327a, 0xe2489a, 0xc22a6e, 0xef6fae, 0xd0408a],
  lanterns: [0xd8321e, 0xf2b630, 0xe8762a, 0xc8261a, 0xf09a2a],
  roofTints: [
    [0xffffff, 0xc9c6a8],
    [0xf6ece2, 0xb6b896],
    [0xeee4d8, 0xa9ad88],
    [0xfff6ee, 0xd2c6a8],
  ],
};

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

const shared = { plaster: null, roof: null, lantern: null, glass: null, interior: null, screens: [] };
let glowLevel = 0;

function wrapDraw(size, draw) {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) draw(dx, dy);
  }
}

function plasterTexture() {
  return canvasTexture(
    256,
    (ctx, s) => {
      const rand = makeRandom(97);
      ctx.fillStyle = '#f8f2e6';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 80; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const r = 6 + rand() * 28;
        const squash = 0.45 + rand() * 0.45;
        const angle = rand() * Math.PI;
        const light = rand() < 0.3;
        const alpha = light ? 0.18 + rand() * 0.2 : 0.05 + rand() * 0.1;
        ctx.fillStyle = light ? `rgba(255,255,250,${alpha})` : `rgba(140,104,62,${alpha})`;
        wrapDraw(s, (dx, dy) => {
          ctx.beginPath();
          ctx.ellipse(x + dx, y + dy, r, r * squash, angle, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      for (let i = 0; i < 30; i++) {
        const x = rand() * s;
        const y = rand() * s;
        const w = 2 + rand() * 7;
        const h = 30 + rand() * 100;
        const alpha = 0.05 + rand() * 0.1;
        wrapDraw(s, (dx, dy) => {
          const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + h);
          g.addColorStop(0, `rgba(104,82,52,${alpha})`);
          g.addColorStop(1, 'rgba(104,82,52,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x + dx, y + dy, w, h);
        });
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const points = [[rand() * s, rand() * s]];
        for (let k = 0; k < 4; k++) {
          const [px, py] = points[points.length - 1];
          points.push([px + (rand() - 0.5) * 24, py + 6 + rand() * 14]);
        }
        ctx.strokeStyle = `rgba(90,70,48,${0.18 + rand() * 0.15})`;
        wrapDraw(s, (dx, dy) => {
          ctx.beginPath();
          points.forEach(([px, py], k) => (k ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
          ctx.stroke();
        });
      }
    },
    [0.4, 0.4],
  );
}

function tileTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = makeRandom(41);
    const cols = 8;
    const rows = 5;
    const cw = s / cols;
    const rh = s / rows;
    ctx.fillStyle = '#4a1d12';
    ctx.fillRect(0, 0, s, s);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const convex = c % 2 === 1;
        const tone = 0.84 + rand() * 0.3;
        const x = c * cw;
        const y = r * rh;
        const g = ctx.createLinearGradient(x, 0, x + cw, 0);
        if (convex) {
          g.addColorStop(0, css(shade(0x5e2618, tone)));
          g.addColorStop(0.42, css(shade(0xb85a3a, tone)));
          g.addColorStop(1, css(shade(0x4e1e12, tone)));
        } else {
          g.addColorStop(0, css(shade(0x6a2c1c, tone)));
          g.addColorStop(0.5, css(shade(0x8e4028, tone)));
          g.addColorStop(1, css(shade(0x6a2c1c, tone)));
        }
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cw, rh);
        ctx.fillStyle = 'rgba(255,214,170,0.16)';
        ctx.fillRect(x + 2, y + rh - 7, cw - 4, 3);
        ctx.fillStyle = 'rgba(24,8,4,0.5)';
        ctx.fillRect(x, y + rh - 4, cw, 4);
      }
    }
    for (let i = 0; i < 46; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const r = 3 + rand() * 12;
      const squash = 0.5 + rand() * 0.5;
      const angle = rand() * Math.PI;
      const lichen = rand() < 0.25;
      ctx.fillStyle = lichen ? `rgba(196,186,140,${0.18 + rand() * 0.15})` : `rgba(58,72,34,${0.18 + rand() * 0.22})`;
      wrapDraw(s, (dx, dy) => {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * squash, angle, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
}

export function plasterMaterial() {
  shared.plaster ??= toonMaterial({ muted: true, map: plasterTexture(), vertexColors: true });
  return shared.plaster;
}

function roofMaterial() {
  shared.roof ??= toonMaterial({ muted: true, map: tileTexture(), vertexColors: true, shadowSide: THREE.DoubleSide });
  return shared.roof;
}

function applyGlow() {
  if (shared.lantern) shared.lantern.emissiveIntensity = glowLevel * 1.1;
  if (shared.glass) shared.glass.emissiveIntensity = glowLevel * 0.85;
  if (shared.interior) shared.interior.emissiveIntensity = glowLevel * 0.6;
  for (const screen of shared.screens) screen.emissiveIntensity = glowLevel * screen.userData.glow;
}

function lanternMaterial() {
  if (!shared.lantern) {
    const material = toonMaterial({ vertexColors: true, emissive: 0xffd2a0, emissiveIntensity: 0 });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor * 1.6 + 0.25;',
      );
    };
    shared.lantern = material;
    applyGlow();
  }
  return shared.lantern;
}

function interiorMaterial() {
  if (!shared.interior) {
    const material = toonMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0 });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor;');
    };
    shared.interior = material;
    applyGlow();
  }
  return shared.interior;
}

function glassMaterial() {
  if (!shared.glass) {
    shared.glass = toonMaterial({ vertexColors: true, emissive: 0xffc46a, emissiveIntensity: 0 });
    applyGlow();
  }
  return shared.glass;
}

export function setNightGlow(k) {
  glowLevel = Math.min(1, Math.max(0, k));
  applyGlow();
}

export function texturedBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
    }
  }
  return g;
}

function createKit(seed) {
  return {
    rand: makeRandom(seed),
    body: new Batch(),
    walls: new Batch(),
    tiles: new Batch(),
    lamps: new Batch(),
    panes: new Batch(),
    interior: new Batch(),
    signs: [],
    lights: [],
    obstacles: [],
  };
}

function assemble(kit) {
  const group = new THREE.Group();
  const add = (batch, material, shadow) => {
    if (batch.parts.length) group.add(batch.mesh(material, { shadow }));
  };
  add(kit.body, vertexMaterial(), true);
  add(kit.walls, plasterMaterial(), true);
  add(kit.tiles, roofMaterial(), true);
  add(kit.lamps, lanternMaterial(), false);
  for (const sign of kit.signs) group.add(sign);
  add(kit.panes, glassMaterial(), false);
  add(kit.interior, interiorMaterial(), false);
  group.userData.lights = kit.lights;
  return group;
}

function block(kit, minX, minZ, maxX, maxZ, maxY = 3) {
  kit.obstacles.push({ minX, minZ, maxX, maxZ, minY: 0, maxY });
}

function plaster(kit, color, w, h, d, x, y, z) {
  kit.walls.add(texturedBox(w, h, d), color, { p: [x, y, z] });
}

function gableWall(kit, color, x, zFront, zBack, wallTop, ridgeTop, thickness) {
  const zMid = (zFront + zBack) / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-zFront, 0);
  shape.lineTo(-zFront, wallTop);
  shape.lineTo(-zMid, ridgeTop);
  shape.lineTo(-zBack, wallTop);
  shape.lineTo(-zBack, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(x - thickness / 2, 0, 0);
  kit.walls.add(geometry, color);

  const run = zFront - zMid;
  const rise = ridgeTop - wallTop;
  const len = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const b = kit.body;
  for (const side of [1, -1]) {
    b.add(shapes.box(thickness + 0.12, 0.1, len + 0.08), PAL.coping, {
      p: [x, (wallTop + ridgeTop) / 2 + 0.04, zMid + (side * run) / 2],
      r: [side * angle, 0, 0],
    });
    const zEnd = side > 0 ? zFront : zBack;
    b.add(shapes.box(thickness + 0.16, 0.24, 0.34), PAL.coping, { p: [x, wallTop + 0.08, zEnd - side * 0.1] });
    b.add(shapes.box(thickness + 0.1, 0.12, 0.2), PAL.coping, { p: [x, wallTop + 0.24, zEnd - side * 0.05], r: [-side * 0.5, 0, 0] });
  }
  b.add(shapes.box(thickness + 0.16, 0.22, 0.42), PAL.coping, { p: [x, ridgeTop + 0.1, zMid] });

  const out = Math.sign(x) || 1;
  const my = wallTop + rise * 0.42;
  b.add(shapes.cylinder(0.3, 0.3, 0.04, 12), PAL.mortar, { p: [x + out * (thickness / 2 + 0.02), my, zMid], r: [0, 0, Math.PI / 2] });
  b.add(shapes.cylinder(0.2, 0.2, 0.04, 12), shade(color, 0.8), { p: [x + out * (thickness / 2 + 0.04), my, zMid], r: [0, 0, Math.PI / 2] });
  for (const dz of [-0.1, 0, 0.1]) {
    b.add(shapes.box(0.03, 0.22, 0.04), PAL.woodDark, { p: [x + out * (thickness / 2 + 0.06), my, zMid + dz] });
  }
}

function roofPitch(kit, { x0, x1, ridgeZ, ridgeY, run, slope, facing, tint, tileEnds = false }) {
  const rise = run * slope;
  const len = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const width = x1 - x0;
  const hx = width / 2;
  const cx = (x0 + x1) / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-hx, -rise, run, hx, -rise, run, -hx, 0, 0, hx, -rise, run, hx, 0, 0, -hx, 0, 0], 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([x0, 0, x1, 0, x0, len, x1, 0, x1, len, x0, len], 2));
  geometry.computeVertexNormals();
  const rotation = [0, facing > 0 ? 0 : Math.PI, 0];
  const [clean, mossy] = tint;
  kit.tiles.add(geometry, clean, { p: [cx, ridgeY, ridgeZ], r: rotation, paint: (x, y, z) => (z > run * 0.5 ? mossy : clean) });

  const nz = rise / len;
  const ny = run / len;
  const b = kit.body;
  b.group([cx, ridgeY, ridgeZ], rotation, () => {
    b.add(shapes.box(width, 0.1, len), PAL.rafter, { p: [0, -rise / 2 - 0.07 * ny, run / 2 - 0.07 * nz], r: [angle, 0, 0] });
    b.add(shapes.box(width + 0.02, 0.07, 0.08), PAL.mortar, { p: [0, -rise - 0.02, run - 0.02] });
    if (!tileEnds) return;
    const sx = Math.sin(angle);
    const cy = Math.cos(angle);
    for (let x = -hx + 0.12; x < hx - 0.06; x += 0.25) {
      b.add(shapes.cylinder(0.065, 0.065, 0.18, 6), PAL.tileEnd, {
        p: [x, -rise + 0.05 * cy + 0.09 * sx, run + 0.05 * sx - 0.09 * cy],
        r: [Math.PI / 2 + angle, 0, 0],
      });
    }
  });
  return { rise, len, angle };
}

function ridgeCrest(kit, x0, x1, z, y, style) {
  const b = kit.body;
  const width = x1 - x0;
  const cx = (x0 + x1) / 2;
  b.add(shapes.box(width + 0.04, 0.08, 0.44), PAL.mortar, { p: [cx, y - 0.03, z] });
  b.add(shapes.box(width, 0.3, 0.34), PAL.ridge, { p: [cx, y + 0.14, z] });
  b.add(shapes.box(width + 0.02, 0.06, 0.38), PAL.mortar, { p: [cx, y + 0.3, z] });
  b.add(shapes.box(width - 0.1, 0.1, 0.24), shade(PAL.ridge, 0.85), { p: [cx, y + 0.38, z] });
  for (const side of [-1, 1]) {
    const ex = cx + side * (width / 2 - 0.16);
    b.add(shapes.box(0.32, 0.5, 0.4), PAL.ridge, { p: [ex, y + 0.42, z], r: [0, 0, -side * 0.18] });
    b.add(shapes.torus(0.15, 0.06, 8, Math.PI * 1.4), PAL.mortar, {
      p: [ex + side * 0.1, y + 0.78, z],
      r: [0, 0, side > 0 ? -0.6 : Math.PI + 0.6],
    });
  }
  if (style === 'disc') {
    b.add(shapes.box(0.5, 0.2, 0.3), PAL.ridge, { p: [cx, y + 0.5, z] });
    b.add(shapes.cylinder(0.26, 0.26, 0.1, 12), PAL.mortar, { p: [cx, y + 0.82, z], r: [Math.PI / 2, 0, 0] });
    b.add(shapes.cylinder(0.17, 0.17, 0.12, 12), PAL.gold, { p: [cx, y + 0.82, z], r: [Math.PI / 2, 0, 0] });
  } else if (style === 'gourd') {
    b.add(shapes.cylinder(0.16, 0.2, 0.16, 8), PAL.ridge, { p: [cx, y + 0.5, z] });
    b.add(shapes.sphere(0.2, 8, 6), PAL.jade, { p: [cx, y + 0.72, z] });
    b.add(shapes.sphere(0.13, 8, 6), PAL.jade, { p: [cx, y + 0.98, z] });
    b.add(shapes.cone(0.04, 0.14, 6), PAL.gold, { p: [cx, y + 1.15, z] });
  } else if (style === 'dragons') {
    const dragon = (side) => [
      new THREE.Vector3(cx + side * (width / 2 - 0.5), y + 0.45, z),
      new THREE.Vector3(cx + side * (width / 2 - 1.2), y + 1.05, z),
      new THREE.Vector3(cx + side * (width / 2 - 1.9), y + 0.6, z),
      new THREE.Vector3(cx + side * 1.4, y + 0.95, z),
      new THREE.Vector3(cx + side * 0.75, y + 0.85, z),
    ];
    for (const side of [-1, 1]) {
      b.add(shapes.tube(dragon(side), 0.11, 20), PAL.jade);
      b.add(shapes.sphere(0.17, 8, 6), PAL.jade, { p: [cx + side * 0.7, y + 0.9, z] });
      b.add(shapes.cone(0.05, 0.22, 5), PAL.gold, { p: [cx + side * 0.62, y + 1.08, z], r: [0, 0, side * 0.5] });
      for (let k = 1; k <= 3; k++) {
        const along = cx + side * (width / 2 - 0.5 - k * 0.55);
        b.add(shapes.cone(0.05, 0.18, 4), PAL.gold, { p: [along, y + 0.92 + (k % 2) * 0.15, z], flat: true });
      }
    }
    b.add(shapes.box(0.5, 0.24, 0.3), PAL.ridge, { p: [cx, y + 0.52, z] });
    b.add(shapes.sphere(0.24, 10, 8), PAL.gold, { p: [cx, y + 0.86, z] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add(shapes.cone(0.06, 0.24, 5), 0xe86a2a, {
        p: [cx + Math.cos(a) * 0.34, y + 0.86 + Math.sin(a) * 0.34, z],
        r: [0, 0, a - Math.PI / 2],
        flat: true,
      });
    }
  }
}

function doorEye(kit, x, y, z) {
  const b = kit.body;
  b.add(shapes.cylinder(0.14, 0.15, 0.08, 12), PAL.woodDark, { p: [x, y, z + 0.04], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.torus(0.122, 0.018, 12), PAL.gold, { p: [x, y, z + 0.082] });
  const face = z + 0.082;
  const r = 0.104;
  b.add(new THREE.CircleGeometry(r, 12, Math.PI / 2, Math.PI), PAL.ink, { p: [x, y, face] });
  b.add(new THREE.CircleGeometry(r, 12, -Math.PI / 2, Math.PI), PAL.cream, { p: [x, y, face] });
  b.add(new THREE.CircleGeometry(r / 2, 10), PAL.ink, { p: [x, y - r / 2, face + 0.002] });
  b.add(new THREE.CircleGeometry(r / 2, 10), PAL.cream, { p: [x, y + r / 2, face + 0.002] });
  b.add(new THREE.CircleGeometry(r / 6, 6), PAL.cream, { p: [x, y - r / 2, face + 0.004] });
  b.add(new THREE.CircleGeometry(r / 6, 6), PAL.ink, { p: [x, y + r / 2, face + 0.004] });
}

function plankPanel(kit, x0, x1, y0, y1, z, color, plank = 0.24) {
  const n = Math.max(1, Math.round((x1 - x0) / plank));
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    kit.body.add(shapes.box(w - 0.016, y1 - y0, 0.06), shade(color, 0.88 + kit.rand() * 0.2), {
      p: [x0 + w * (i + 0.5), (y0 + y1) / 2, z],
    });
  }
}

function barWindow(kit, x0, x1, y0, y1, z, paneColor = PAL.paper) {
  const b = kit.body;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  kit.panes.add(shapes.box(w, y1 - y0, 0.02), paneColor, { p: [cx, (y0 + y1) / 2, z - 0.05] });
  b.add(shapes.box(w + 0.04, 0.08, 0.12), PAL.woodMid, { p: [cx, y0, z] });
  b.add(shapes.box(w + 0.04, 0.08, 0.12), PAL.woodMid, { p: [cx, y1, z] });
  const n = Math.max(2, Math.round(w / 0.13));
  for (let i = 1; i < n; i++) {
    b.add(shapes.cylinder(0.024, 0.024, y1 - y0, 6), PAL.wood, { p: [x0 + (w * i) / n, (y0 + y1) / 2, z] });
  }
}

function lattice(kit, x0, x1, y0, y1, z, paneColor = PAL.paper) {
  const b = kit.body;
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  kit.panes.add(shapes.box(w, h, 0.02), paneColor, { p: [cx, cy, z - 0.04] });
  const cols = Math.max(2, Math.round(w / 0.18));
  for (let i = 1; i < cols; i++) b.add(shapes.box(0.03, h, 0.04), PAL.wood, { p: [x0 + (w * i) / cols, cy, z] });
  const rows = Math.max(1, Math.round(h / 0.22));
  for (let j = 1; j < rows; j++) b.add(shapes.box(w, 0.03, 0.04), PAL.wood, { p: [cx, y0 + (h * j) / rows, z] });
  for (const y of [y0, y1]) b.add(shapes.box(w + 0.04, 0.06, 0.08), PAL.woodMid, { p: [cx, y, z] });
}

function shutterWindow(kit, cx, y0, y1, width, color, zFace, { sill = true } = {}) {
  const b = kit.body;
  const h = y1 - y0;
  const ym = (y0 + y1) / 2;
  b.add(shapes.box(width + 0.18, h + 0.18, 0.06), PAL.woodDark, { p: [cx, ym, zFace + 0.02] });
  kit.panes.add(shapes.box(width, h, 0.02), PAL.paper, { p: [cx, ym, zFace + 0.06] });
  const bars = Math.max(2, Math.round(width / 0.16));
  for (let i = 1; i < bars; i++) {
    b.add(shapes.box(0.03, h, 0.03), PAL.wood, { p: [cx - width / 2 + (width * i) / bars, ym, zFace + 0.09] });
  }
  if (sill) b.add(shapes.box(width + 0.34, 0.07, 0.18), PAL.mortar, { p: [cx, y0 - 0.1, zFace + 0.08] });
  b.add(shapes.box(width + 0.34, 0.08, 0.16), PAL.mortar, { p: [cx, y1 + 0.12, zFace + 0.07] });
  const leaf = width / 2;
  for (const side of [-1, 1]) {
    b.group([cx + (side * width) / 2, ym, zFace + 0.09], [0, -side * 0.42, 0], () => {
      b.add(shapes.box(leaf, h, 0.05), color, { p: [(side * leaf) / 2, 0, 0.025] });
      const slats = Math.max(3, Math.round(h / 0.2));
      for (let k = 0; k < slats; k++) {
        b.add(shapes.box(leaf - 0.1, 0.035, 0.03), shade(color, 0.78), {
          p: [(side * leaf) / 2, -h / 2 + ((k + 0.5) * h) / slats, 0.06],
          r: [0.5, 0, 0],
        });
      }
      for (const dx of [0.04, leaf - 0.04]) b.add(shapes.box(0.06, h, 0.06), shade(color, 0.9), { p: [side * dx, 0, 0.05] });
    });
  }
}

function balcony(kit, x0, x1, y, depth, railColor) {
  const b = kit.body;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const front = depth - 0.08;
  b.add(shapes.box(w, 0.12, depth), PAL.wood, { p: [cx, y - 0.06, depth / 2 - 0.04] });
  b.add(shapes.box(w + 0.04, 0.12, 0.1), PAL.woodDark, { p: [cx, y - 0.1, depth - 0.04] });
  for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.6) {
    b.add(shapes.box(0.08, 0.1, depth - 0.1), PAL.woodDark, { p: [x, y - 0.17, depth / 2 - 0.05] });
  }
  for (const x of [x0 + 0.2, x1 - 0.2]) {
    b.add(shapes.box(0.12, 0.7, 0.12), PAL.woodDark, { p: [x, y - 0.55, 0.08] });
    b.limb([x, y - 0.8, 0.08], [x, y - 0.16, depth - 0.2], 0.05, PAL.woodDark, { capsule: false, seg: 4 });
  }
  const posts = Math.max(2, Math.round(w / 1.5));
  for (let i = 0; i <= posts; i++) {
    const x = x0 + 0.05 + ((w - 0.1) * i) / posts;
    b.add(shapes.box(0.1, 1.02, 0.1), shade(railColor, 0.85), { p: [x, y + 0.51, front] });
    b.add(shapes.box(0.13, 0.06, 0.13), shade(railColor, 0.7), { p: [x, y + 1.04, front] });
  }
  b.add(shapes.box(w, 0.07, 0.13), railColor, { p: [cx, y + 0.97, front] });
  b.add(shapes.box(w, 0.06, 0.08), railColor, { p: [cx, y + 0.16, front] });
  for (let x = x0 + 0.17; x < x1 - 0.1; x += 0.16) {
    b.add(shapes.box(0.045, 0.78, 0.045), railColor, { p: [x, y + 0.56, front] });
  }
  for (const x of [x0 + 0.05, x1 - 0.05]) {
    b.add(shapes.box(0.08, 0.07, front), railColor, { p: [x, y + 0.97, front / 2] });
    for (let z = 0.2; z < front - 0.05; z += 0.18) b.add(shapes.box(0.045, 0.78, 0.045), railColor, { p: [x, y + 0.56, z] });
  }
}

function silkLantern(kit, x, yTop, z, color, stretch = 1) {
  const b = kit.body;
  const cord = 0.16;
  b.limb([x, yTop, z], [x, yTop - cord, z], 0.008, PAL.ink, { capsule: false, seg: 4 });
  const top = yTop - cord;
  const h = 0.46 * stretch;
  const bodyTop = top - 0.04;
  const bodyBottom = bodyTop - h;
  b.add(shapes.cylinder(0.08, 0.1, 0.05, 8), PAL.gold, { p: [x, top - 0.02, z] });
  kit.lamps.add(
    shapes.lathe([[0.001, 0], [0.1, 0.0], [0.19, 0.14], [0.215, 0.5], [0.19, 0.86], [0.1, 1], [0.001, 1]], 8),
    color,
    { p: [x, bodyBottom, z], s: [1, h, 1] },
  );
  b.add(shapes.cylinder(0.1, 0.08, 0.05, 8), PAL.gold, { p: [x, bodyBottom - 0.01, z] });
  b.add(shapes.cone(0.045, 0.24, 6), shade(color, 0.7), { p: [x, bodyBottom - 0.16, z] });
  kit.lights.push({ position: new THREE.Vector3(x, bodyBottom + h / 2, z), tint: color });
}

function lanternRow(kit, xs, yAt, z, colors) {
  xs.forEach((x, i) => silkLantern(kit, x, yAt(x), z, colors[i % colors.length], 0.9 + kit.rand() * 0.4));
}

function bush(kit, x, y, z, size, colors) {
  const rand = kit.rand;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand();
    kit.body.add(shapes.ico(size * (0.6 + rand() * 0.35), 0), pick(rand, colors), {
      p: [x + Math.cos(a) * size * 0.45, y + rand() * size * 0.6, z + Math.sin(a) * size * 0.45],
      r: [rand() * 3, rand() * 3, 0],
      flat: true,
    });
  }
}

const POT_REACH = 0.34;
const POT_Z = 0.5;

function pottedPlant(kit, x, z, kind) {
  const b = kit.body;
  const rand = kit.rand;
  block(kit, x - POT_REACH, z - POT_REACH, x + POT_REACH, z + POT_REACH, 1.4);
  if (kind === 0) {
    b.add(shapes.lathe([[0.001, 0], [0.18, 0], [0.26, 0.3], [0.3, 0.36], [0.26, 0.38], [0.001, 0.38]], 8), PAL.pot, { p: [x, 0, z], flat: true });
    b.add(shapes.cylinder(0.24, 0.24, 0.02, 8), PAL.soil, { p: [x, 0.392, z] });
    bush(kit, x, 0.62, z, 0.32, [PAL.leaf, PAL.leafDark, PAL.leafLight]);
  } else if (kind === 1) {
    b.add(shapes.lathe([[0.001, 0], [0.14, 0], [0.24, 0.22], [0.22, 0.46], [0.16, 0.52], [0.18, 0.56], [0.001, 0.56]], 8), 0x2f5f8e, { p: [x, 0, z], flat: true });
    b.add(shapes.torus(0.235, 0.018, 8), PAL.cream, { p: [x, 0.26, z], r: [Math.PI / 2, 0, 0] });
    b.limb([x, 0.55, z], [x, 0.85, z], 0.03, PAL.trunk, { capsule: false, seg: 5 });
    bush(kit, x, 1.0, z, 0.3, [PAL.leafDark, PAL.leaf]);
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2;
      b.add(shapes.sphere(0.035, 5, 4), 0xf08a1e, { p: [x + Math.cos(a) * 0.26, 0.9 + rand() * 0.35, z + Math.sin(a) * 0.26] });
    }
  } else if (kind === 2) {
    b.add(shapes.box(0.5, 0.36, 0.5), PAL.stoneDark, { p: [x, 0.18, z] });
    b.add(shapes.box(0.56, 0.06, 0.56), PAL.stone, { p: [x, 0.38, z] });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const lean = 0.5 + rand() * 0.3;
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      b.add(shapes.cone(0.12, 0.9, 4), i % 2 ? PAL.leaf : PAL.leafLight, {
        p: [x + dir.x * 0.42, 0.42 + dir.y * 0.42, z + dir.z * 0.42],
        q,
        s: [1, 1, 0.3],
        flat: true,
      });
    }
  } else {
    b.add(shapes.cylinder(0.24, 0.18, 0.34, 8), 0x8c4a2c, { p: [x, 0.17, z], flat: true });
    b.add(shapes.torus(0.24, 0.025, 8), shade(0x8c4a2c, 0.8), { p: [x, 0.33, z], r: [Math.PI / 2, 0, 0] });
    bush(kit, x, 0.5, z, 0.26, [PAL.leaf, PAL.leafDark]);
    const bloom = pick(rand, [0xf5c430, 0xf2f0e6, 0xe85a8a]);
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2;
      b.add(shapes.sphere(0.05, 6, 4), bloom, { p: [x + Math.cos(a) * 0.2, 0.62 + rand() * 0.2, z + Math.sin(a) * 0.2] });
    }
  }
  block(kit, x - 0.28, z - 0.28, x + 0.28, z + 0.28, 1);
}

function bougainvillea(kit, x, topY, dir, reach, railY = 0) {
  const b = kit.body;
  const rand = kit.rand;
  const potZ = 0.34;
  b.add(shapes.cylinder(0.25, 0.2, 0.42, 8), PAL.pot, { p: [x, 0.21, potZ], flat: true });
  b.add(shapes.cylinder(0.23, 0.23, 0.02, 8), PAL.soil, { p: [x, 0.432, potZ] });
  const trunk = [
    [x, 0.38, potZ],
    [x + dir * 0.1, topY * 0.35, 0.22],
    [x - dir * 0.06, topY * 0.7, 0.16],
    [x + dir * 0.06, topY - 0.12, 0.14],
    [x + dir * reach * 0.6, topY - 0.06, 0.2],
    [x + dir * reach, topY - 0.22, 0.24],
  ];
  for (let i = 0; i < trunk.length - 1; i++) {
    b.limb(trunk[i], trunk[i + 1], i < 3 ? 0.045 : 0.03, PAL.trunk, { capsule: false, seg: 5 });
  }
  const cluster = (cx, cy, cz, r) => {
    const color = rand() < 0.62 ? pick(rand, PAL.blooms) : pick(rand, [PAL.leaf, PAL.leafDark]);
    b.add(shapes.ico(r, 0), color, { p: [cx, cy, cz], s: [1.3, 0.85, 1], r: [rand() * 3, rand() * 3, 0], flat: true });
  };
  for (let i = 0; i < 7; i++) {
    const t = 0.25 + (i / 7) * 0.7;
    cluster(x + (rand() - 0.5) * 0.35, topY * t, 0.16 + rand() * 0.15, 0.14 + rand() * 0.1);
  }
  for (let i = 0; i < 20; i++) {
    const t = rand();
    const droop = t > 0.5 && rand() < 0.4 ? rand() * 0.7 : 0;
    cluster(x + dir * t * reach, topY - 0.1 - rand() * 0.3 - droop, 0.14 + rand() * 0.32, 0.14 + rand() * 0.14);
  }
  if (railY > 0) {
    for (let i = 0; i < 9; i++) {
      cluster(x + dir * rand() * reach * 1.1, railY + (rand() - 0.3) * 0.5, 0.7 + rand() * 0.3, 0.15 + rand() * 0.12);
    }
  }
  block(kit, x - 0.28, potZ - 0.28, x + 0.28, potZ + 0.28, 1);
}

function riceSack(kit, x, y, z, turn, color = PAL.burlap) {
  const b = kit.body;
  b.add(shapes.sphere(0.3, 6, 4), shade(color, 0.92 + kit.rand() * 0.14), { p: [x, y + 0.3, z], s: [1, 1.15, 0.85], r: [0, turn, 0], flat: true });
  b.add(shapes.cone(0.12, 0.2, 5), shade(color, 0.85), { p: [x, y + 0.68, z], flat: true });
  b.add(shapes.cylinder(0.07, 0.07, 0.04, 5), 0x8a2a1c, { p: [x, y + 0.64, z] });
}

function openSack(kit, x, z, fill) {
  const b = kit.body;
  b.add(shapes.cylinder(0.3, 0.27, 0.55, 8), PAL.burlap, { p: [x, 0.275, z], flat: true });
  b.add(shapes.torus(0.3, 0.05, 8), shade(PAL.burlap, 0.85), { p: [x, 0.55, z], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.cap(0.28, Math.PI / 3, 8, 3), fill, { p: [x, 0.42, z], flat: true });
  block(kit, x - 0.32, z - 0.32, x + 0.32, z + 0.32, 1);
}

function produceBasket(kit, x, y, z, radius, produce) {
  const b = kit.body;
  const rand = kit.rand;
  b.add(shapes.cylinder(radius, radius * 0.75, radius * 0.7, 8), PAL.basket, { p: [x, y + radius * 0.35, z], flat: true });
  if (radius >= 0.3) b.add(shapes.torus(radius, 0.025, 8), PAL.basketDark, { p: [x, y + radius * 0.7, z], r: [Math.PI / 2, 0, 0] });
  const count = Math.round(radius * 14);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const rr = rand() * radius * 0.7;
    b.add(shapes.sphere(radius * 0.28, 5, 4), pick(rand, produce), {
      p: [x + Math.cos(a) * rr, y + radius * 0.72 + rand() * radius * 0.2, z + Math.sin(a) * rr],
      flat: true,
    });
  }
}

function clayJar(kit, x, y, z, scale, glaze) {
  kit.body.add(
    shapes.lathe([[0.001, 0], [0.2, 0], [0.33, 0.18], [0.36, 0.4], [0.28, 0.62], [0.2, 0.7], [0.23, 0.76], [0.001, 0.76]], 8),
    glaze,
    { p: [x, y, z], s: scale, flat: true },
  );
  if (scale > 0.7) kit.body.add(shapes.torus(0.35, 0.015, 8), shade(glaze, 0.7), { p: [x, y + 0.42 * scale, z], r: [Math.PI / 2, 0, 0], s: scale });
}

const SIGN_PX = 320;
const BRUSH_FONT = '"Water Brush", "Dancing Script", cursive';
const LATIN_FONT = '"BIZ UDPGothic", system-ui, -apple-system, "Segoe UI", sans-serif';
const cssHex = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

function paintSign(ctx, w, h, { lines, vertical, bg, fg, font }) {
  ctx.fillStyle = cssHex(bg);
  ctx.fillRect(0, 0, w, h);
  const edge = Math.min(w, h);
  ctx.strokeStyle = cssHex(fg);
  ctx.lineWidth = edge * 0.035;
  ctx.strokeRect(edge * 0.07, edge * 0.07, w - edge * 0.14, h - edge * 0.14);
  ctx.fillStyle = cssHex(fg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pad = edge * 0.16;
  if (vertical) {
    const cell = (h - pad * 2) / lines.length;
    let size = Math.min(cell * 0.84, (w - pad * 2) * 0.98);
    for (const word of lines) {
      ctx.font = `700 ${size}px ${font}`;
      const width = ctx.measureText(word).width;
      if (width > w - pad * 2) size *= (w - pad * 2) / width;
    }
    ctx.font = `700 ${size}px ${font}`;
    lines.forEach((word, i) => ctx.fillText(word, w / 2, pad + cell * (i + 0.53)));
    return;
  }
  const lineH = (h - pad * 2) / lines.length;
  let size = lineH * 0.8;
  for (const line of lines) {
    ctx.font = `700 ${size}px ${font}`;
    const width = ctx.measureText(line).width;
    if (width > w - pad * 2) size *= (w - pad * 2) / width;
  }
  ctx.font = `700 ${size}px ${font}`;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, pad + lineH * (i + 0.55)));
}

function signGeometry(w, h, d, twoSided) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const front = i >= 16 && i < 20;
    const back = twoSided && i >= 20 && i < 24;
    if (!front && !back) uv.setXY(i, 0.02, 0.02);
  }
  return geometry;
}

function textSign(kit, x, y, z, w, h, { text, across = false, vertical = false, bg = PAL.lacquer, fg = PAL.gold, brush = true } = {}) {
  kit.body.group([x, y, z], across ? [0, Math.PI / 2, 0] : [0, 0, 0], () => {
    kit.body.add(shapes.box(w + 0.07, h + 0.07, 0.05), PAL.woodDark);
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(64, Math.round(w * SIGN_PX));
  canvas.height = Math.max(64, Math.round(h * SIGN_PX));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const options = { lines: Array.isArray(text) ? text : [text], vertical, bg, fg, font: brush ? BRUSH_FONT : LATIN_FONT };
  keepCanvas(texture, (ctx) => paintSign(ctx, canvas.width, canvas.height, options));
  const paint = () => {
    paintSign(canvas.getContext('2d'), canvas.width, canvas.height, options);
    texture.needsUpdate = true;
  };
  paint();
  document.fonts?.load(`700 64px ${options.font}`, options.lines.join(' ')).then(paint, () => {});
  const mesh = new THREE.Mesh(signGeometry(w, h, 0.07, across), toonMaterial({ map: texture }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = across ? Math.PI / 2 : 0;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  kit.signs.push(mesh);
}

function lanternXs(half, perSide, clear) {
  const xs = [];
  for (let i = 0; i < perSide; i++) {
    const x = clear + ((half - clear) * (i + 0.5)) / perSide;
    xs.push(-x, x);
  }
  return xs;
}

function lanternColors(rand) {
  const first = pick(rand, PAL.lanterns);
  return rand() < 0.5 ? [first] : [first, pick(rand, PAL.lanterns)];
}

const PLAQUE_Y = 2.7;

function shophousePotXs(width) {
  const db = Math.min(1.9, (width - 0.84) * 0.42);
  const x = db / 2 + 0.42;
  return [-x, x];
}

export function shophousePots(width) {
  return shophousePotXs(width).map((x) => ({ minX: x - POT_REACH, maxX: x + POT_REACH, minZ: POT_Z - POT_REACH, maxZ: POT_Z + POT_REACH, minY: 0, maxY: 1.4 }));
}

export function createShophouse({ seed = 1, width = 7, depth = 9, stories } = {}) {
  const kit = createKit(seed);
  const { rand, body: b } = kit;
  const W = width;
  const D = depth;
  const levels = stories === 1 || stories === 2 ? stories : rand() < 0.45 ? 2 : 1;
  const wall = shade(pick(rand, PAL.yellows), 0.94 + rand() * 0.1);
  const shutter = pick(rand, PAL.shutters);
  const doorWood = pick(rand, [PAL.woodDark, 0x4e2e1a, 0x5a3520, 0x34241a]);
  const roofTint = pick(rand, PAL.roofTints);
  const slope = between(0.48, 0.58, rand);
  const T = 0.25;
  const P = 0.42;
  const lip = 0.22;
  const groundH = levels === 2 ? between(3.2, 3.4, rand) : between(3.6, 3.9, rand);
  const upperH = between(2.55, 2.85, rand);
  const wallTop = levels === 2 ? groundH + upperH : groundH;
  const xa = -W / 2 + P;
  const xb = W / 2 - P;
  const db = Math.min(1.9, (xb - xa) * 0.42);
  const frontDepth = Math.min(5.4, Math.max(4, D * 0.55));
  const yard = D - frontDepth >= 3.4 ? 1.2 : 0;
  const rearFront = -frontDepth - yard;
  const rearDepth = D - frontDepth - yard;
  const rearTop = levels === 2 && rand() < 0.5 ? wallTop - 0.5 : Math.max(2.9, groundH - 0.2);
  const overhang = levels === 2 ? 1.1 : 0.8;
  const roofX0 = -W / 2 + 0.04;
  const roofX1 = W / 2 - 0.04;

  const frontRidgeY = wallTop + (frontDepth / 2) * slope;
  for (const side of [-1, 1]) gableWall(kit, wall, side * (W / 2 - T / 2), 0, -frontDepth, wallTop + lip, frontRidgeY + lip, T);
  const frontRoof = { x0: roofX0, x1: roofX1, ridgeZ: -frontDepth / 2, ridgeY: frontRidgeY, slope, tint: roofTint };
  roofPitch(kit, { ...frontRoof, run: frontDepth / 2 + overhang, facing: 1, tileEnds: true });
  roofPitch(kit, { ...frontRoof, run: frontDepth / 2 + (yard ? 0.4 : 0.05), facing: -1 });
  ridgeCrest(kit, -W / 2 + T, W / 2 - T, -frontDepth / 2, frontRidgeY, pick(rand, ['disc', 'gourd', 'plain']));
  plaster(kit, wall, W - 2 * T, wallTop, T, 0, wallTop / 2, -frontDepth + T / 2);

  if (rearDepth > 1.2) {
    const rearRidgeY = rearTop + (rearDepth / 2) * slope;
    const zMid = rearFront - rearDepth / 2;
    for (const side of [-1, 1]) gableWall(kit, wall, side * (W / 2 - T / 2), rearFront, -D, rearTop + lip, rearRidgeY + lip, T);
    const rearRoof = { x0: roofX0, x1: roofX1, ridgeZ: zMid, ridgeY: rearRidgeY, slope, tint: roofTint };
    roofPitch(kit, { ...rearRoof, run: rearDepth / 2 + (yard ? 0.4 : 0.02), facing: 1 });
    roofPitch(kit, { ...rearRoof, run: rearDepth / 2 + 0.3, facing: -1 });
    ridgeCrest(kit, -W / 2 + T, W / 2 - T, zMid, rearRidgeY, 'plain');
    plaster(kit, wall, W - 2 * T, rearTop, T, 0, rearTop / 2, -D + T / 2);
    if (yard) {
      b.add(shapes.box(W - 2 * T, rearTop - 0.1, 0.1), PAL.woodDark, { p: [0, (rearTop - 0.1) / 2, rearFront - 0.09] });
      plankPanel(kit, -0.9, 0.9, 0.05, 1.0, rearFront + 0.01, PAL.wood);
      lattice(kit, -0.9, 0.9, 1.0, 2.2, rearFront + 0.03);
    }
  }
  if (yard) {
    const zc = -frontDepth - yard / 2;
    for (const side of [-1, 1]) {
      plaster(kit, wall, T, 2.7, yard + 0.02, side * (W / 2 - T / 2), 1.35, zc);
      b.add(shapes.box(T + 0.1, 0.1, yard + 0.1), PAL.coping, { p: [side * (W / 2 - T / 2), 2.75, zc] });
    }
    b.add(shapes.box(W - 2 * T, 0.04, yard), PAL.stone, { p: [0, 0.02, zc] });
    clayJar(kit, W / 2 - T - 0.45, 0.04, zc, 0.85, 0x6e4a32);
    bush(kit, -W / 2 + T + 0.5, 0.3, zc, 0.35, [PAL.leaf, PAL.leafDark, PAL.leafLight]);
  }

  for (const side of [-1, 1]) {
    const px = side * (W / 2 - P / 2);
    plaster(kit, wall, P, wallTop, T + 0.08, px, wallTop / 2, -T / 2 + 0.04);
    b.add(shapes.box(P + 0.04, 0.5, T + 0.14), PAL.plinth, { p: [px, 0.25, -T / 2 + 0.04] });
    b.add(shapes.box(P + 0.08, 0.12, T + 0.16), PAL.mortar, { p: [px, groundH - 0.06, -T / 2 + 0.05] });
    if (levels === 2) b.add(shapes.box(P + 0.08, 0.12, T + 0.16), PAL.mortar, { p: [px, wallTop - 0.08, -T / 2 + 0.05] });
  }

  const Hg = groundH;
  b.add(shapes.box(xb - xa, Hg, 0.08), PAL.woodDark, { p: [0, Hg / 2, -0.1] });
  for (const x of [xa + 0.09, -db / 2, db / 2, xb - 0.09]) b.add(shapes.box(0.18, Hg, 0.16), PAL.woodMid, { p: [x, Hg / 2, 0] });
  b.add(shapes.box(xb - xa, 0.22, 0.2), PAL.woodMid, { p: [0, Hg - 0.11, 0.01] });

  b.add(shapes.box(db - 0.18, 0.2, 0.22), PAL.wood, { p: [0, 0.1, 0] });
  plankPanel(kit, -db / 2 + 0.09, db / 2 - 0.09, 0.2, 2.1, -0.03, doorWood);
  b.add(shapes.box(0.03, 1.9, 0.08), PAL.ink, { p: [0, 1.15, -0.01] });
  for (const dx of [-0.1, 0.1]) b.add(shapes.torus(0.05, 0.012, 8), PAL.bronze, { p: [dx, 1.15, 0.02] });
  b.add(shapes.box(db - 0.1, 0.24, 0.16), PAL.wood, { p: [0, 2.22, 0] });
  for (const side of [-1, 1]) doorEye(kit, side * db * 0.26, 2.22, 0.08);

  const bayStyle = rand() < 0.55 ? 'window' : 'planks';
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? xa + 0.18 : db / 2 + 0.09;
    const x1 = side < 0 ? -db / 2 - 0.09 : xb - 0.18;
    const cx = (x0 + x1) / 2;
    const bw = x1 - x0;
    b.add(shapes.box(bw, 0.16, 0.18), PAL.stoneDark, { p: [cx, 0.08, 0] });
    if (bayStyle === 'window') {
      plankPanel(kit, x0, x1, 0.16, 0.95, -0.03, PAL.wood);
      barWindow(kit, x0, x1, 0.95, 2.1, 0);
    } else {
      plankPanel(kit, x0, x1, 0.16, 2.1, -0.03, doorWood);
    }
    b.add(shapes.box(bw, 0.24, 0.16), PAL.woodMid, { p: [cx, 2.22, 0] });
    if (Hg - 0.22 - 2.34 > 0.3) lattice(kit, x0, x1, 2.34, Hg - 0.22, 0);
  }

  b.add(shapes.box(W, 0.08, 0.34), PAL.stoneDark, { p: [0, 0.04, 0.17] });
  b.add(shapes.box(db + 0.5, 0.14, 0.5), PAL.stone, { p: [0, 0.07, 0.27] });

  const colors = lanternColors(rand);
  const lanternSet = lanternXs(W / 2 - 0.5, W >= 6.5 && rand() < 0.5 ? 2 : 1, 1.3);
  if (levels === 2) {
    plaster(kit, wall, xb - xa, upperH, T, 0, groundH + upperH / 2, -T / 2);
    balcony(kit, -W / 2 + 0.12, W / 2 - 0.12, groundH + 0.06, 0.95, rand() < 0.5 ? PAL.woodMid : shutter);
    const inner = xb - xa;
    const y0 = groundH + 0.12;
    if (inner >= 5.2) {
      shutterWindow(kit, 0, y0 + 0.05, y0 + 2.0, 1.1, shutter, 0, { sill: false });
      for (const side of [-1, 1]) shutterWindow(kit, side * (inner / 2 - 0.85), y0 + 0.8, y0 + 1.95, 0.85, shutter, 0);
    } else {
      for (const side of [-1, 1]) shutterWindow(kit, (side * inner) / 4, y0 + 0.8, y0 + 1.95, 0.85, shutter, 0);
    }
    b.add(shapes.box(W - 0.1, 0.14, 0.12), PAL.mortar, { p: [0, wallTop - 0.07, 0.04] });
    lanternRow(kit, lanternSet, () => groundH - 0.24, 0.6, colors);
  } else {
    lanternRow(kit, lanternSet, () => wallTop - 0.55 * slope - 0.15, 0.55, colors);
  }

  if (rand() < 0.6) {
    const side = rand() < 0.5 ? -1 : 1;
    const topY = levels === 2 ? groundH - 0.25 : wallTop - 0.45;
    bougainvillea(kit, side * (W / 2 - 0.3), topY, -side, Math.max(0.5, W / 2 - 1.6), levels === 2 ? groundH + 0.9 : 0);
  }
  for (const x of shophousePotXs(W)) pottedPlant(kit, x, POT_Z, Math.floor(rand() * 4));

  block(kit, -W / 2, -D, W / 2, 0.1, 3.2);
  return { group: assemble(kit), obstacles: kit.obstacles, door: { x: 0, z: 0.85 }, plaque: { x: 0, y: PLAQUE_Y, z: 0.1 } };
}

const MART = {
  wall: 0xf1ece4,
  navy: 0x24346a,
  navyDark: 0x1a2550,
  frame: 0x2b2b35,
  concrete: 0xc9c4bc,
  stripe: [0x2d4fa0, 0xf4f1ea],
  strip: 0xf4f8ff,
  bulb: 0xfff1c8,
  floor: 0xe9e1d2,
  ceiling: 0xf7f1e6,
  room: 0xf3e3c6,
  wainscot: 0xc9a77c,
  rail: 0xa8835a,
  shelf: 0xf1ede5,
  shelfEdge: 0xdcd6ca,
  ink: '#22346c',
  cream: '#fff6e0',
  chalk: '#ebe7dc',
};
const MART_GOODS = [0xe8453c, 0xf2b632, 0x3fa7d6, 0x59b36b, 0xf07c2a, 0xd94f8a, 0xf6f6f2, 0x2f6db5, 0x8bc34a];
const MART_PRODUCTS = MART_GOODS.map(css);
const MART_LEAVES = [0x4f9a3f, 0x5fae48, 0x3f8636, 0x6cbf52];
const rbox = (w, h, d, r = 0.04) => shapes.rounded(w, h, d, r);

function paintedPanel(kit, w, h, paint, { glow = 0, p = [0, 0, 0], r = [0, 0, 0] } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * SIGN_PX);
  canvas.height = Math.round(h * SIGN_PX);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const draw = (ctx) => paint(ctx, canvas.width, canvas.height);
  keepCanvas(texture, draw);
  const redraw = () => {
    draw(canvas.getContext('2d'));
    texture.needsUpdate = true;
  };
  redraw();
  document.fonts?.load(`700 64px ${LATIN_FONT}`).then(redraw, () => {});
  const material = toonMaterial(glow ? { map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0 } : { map: texture });
  if (glow) {
    material.userData.glow = glow;
    shared.screens.push(material);
    applyGlow();
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(...p);
  mesh.rotation.set(...r);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  kit.signs.push(mesh);
  return mesh;
}

function drawCart(ctx, cx, cy, size, color) {
  const lerp = (a, b, t) => a + (b - a) * t;
  const x = cx - size * 0.5;
  const y = cy - size * 0.42;
  const at = (fx, fy) => [x + size * fx, y + size * fy];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.085;
  ctx.beginPath();
  ctx.moveTo(...at(-0.06, 0));
  ctx.lineTo(...at(0.12, 0));
  ctx.lineTo(...at(0.26, 0.62));
  ctx.lineTo(...at(0.9, 0.62));
  ctx.lineTo(...at(1, 0.2));
  ctx.lineTo(...at(0.16, 0.2));
  ctx.moveTo(...at(0.26, 0.62));
  ctx.lineTo(...at(0.31, 0.74));
  ctx.lineTo(...at(0.92, 0.74));
  ctx.stroke();
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  for (let k = 1; k <= 3; k++) {
    ctx.moveTo(...at(lerp(0.16, 1, k / 4), 0.2));
    ctx.lineTo(...at(lerp(0.26, 0.9, k / 4), 0.62));
  }
  ctx.moveTo(...at(0.21, 0.41));
  ctx.lineTo(...at(0.95, 0.41));
  ctx.stroke();
  for (const fx of [0.38, 0.84]) {
    ctx.beginPath();
    ctx.arc(...at(fx, 0.86), size * 0.075, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundedPanel(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintMartSign(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2c4182');
  bg.addColorStop(1, '#1c2b5c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(214,224,250,0.85)';
  ctx.lineWidth = h * 0.04;
  roundedPanel(ctx, h * 0.09, h * 0.09, w - h * 0.18, h - h * 0.18, h * 0.12);
  ctx.stroke();
  drawCart(ctx, h * 0.95, h * 0.5, h * 0.62, MART.cream);
  const left = h * 1.6;
  const room = w - left - h * 0.35;
  let size = h * 0.56;
  ctx.font = `800 ${size}px ${LATIN_FONT}`;
  const width = ctx.measureText('SIÊU THỊ').width;
  if (width > room) size *= room / width;
  ctx.font = `800 ${size}px ${LATIN_FONT}`;
  ctx.fillStyle = MART.cream;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,236,190,0.6)';
  ctx.shadowBlur = h * 0.08;
  ctx.fillText('SIÊU THỊ', left + room / 2, h * 0.54);
  ctx.shadowBlur = 0;
}

function paintBlade(ctx, w, h) {
  ctx.fillStyle = MART.ink;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = MART.cream;
  ctx.lineWidth = w * 0.05;
  roundedPanel(ctx, w * 0.09, w * 0.09, w - w * 0.18, h - w * 0.18, w * 0.1);
  ctx.stroke();
  drawCart(ctx, w * 0.5, h * 0.5, w * 0.6, MART.cream);
}

function paintChalkboard(ctx, w, h) {
  ctx.fillStyle = '#2c2a28';
  ctx.fillRect(0, 0, w, h);
  drawCart(ctx, w * 0.5, h * 0.36, w * 0.5, MART.chalk);
  ctx.strokeStyle = MART.chalk;
  ctx.lineWidth = w * 0.03;
  ctx.lineCap = 'round';
  for (const [y, len] of [[0.66, 0.5], [0.78, 0.36]]) {
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * y);
    ctx.lineTo(w * (0.25 + len), h * y);
    ctx.stroke();
  }
}

function paintBackWall(ctx, w, h) {
  const rand = makeRandom(71);
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#fbe9c6');
  wall.addColorStop(1, '#efcf98');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  const top = h * 0.16;
  const bottom = h * 0.94;
  ctx.fillStyle = '#f6f3ec';
  ctx.fillRect(w * 0.02, top, w * 0.96, bottom - top);
  for (const row of [0.34, 0.5, 0.66, 0.82, 0.94]) {
    ctx.fillStyle = '#d4ccbd';
    ctx.fillRect(w * 0.02, h * row, w * 0.96, h * 0.014);
    if (row > 0.9) continue;
    let x = w * 0.03;
    while (x < w * 0.96) {
      const bw = w * (0.012 + rand() * 0.016);
      const bh = h * (0.07 + rand() * 0.06);
      ctx.fillStyle = MART_PRODUCTS[Math.floor(rand() * MART_PRODUCTS.length)];
      ctx.fillRect(x, h * row - bh, bw, bh);
      x += bw + w * 0.004;
    }
  }
  for (const fx of [0.2, 0.5, 0.8]) {
    const glow = ctx.createRadialGradient(w * fx, h * 0.1, 0, w * fx, h * 0.1, w * 0.18);
    glow.addColorStop(0, 'rgba(255,244,214,0.8)');
    glow.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h * 0.6);
  }
}

function martShrub(kit, x, y, z, size) {
  const rand = kit.rand;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand();
    const r = size * (0.45 + rand() * 0.25);
    kit.body.add(shapes.sphere(r, 10, 8), pick(rand, MART_LEAVES), {
      p: [x + Math.cos(a) * size * 0.55, y + rand() * size * 0.35, z + Math.sin(a) * size * 0.3],
    });
  }
  kit.body.add(shapes.sphere(size * 0.6, 10, 8), pick(rand, MART_LEAVES), { p: [x, y + size * 0.35, z] });
}

function martAwning(kit, x0, x1, top, bottom, depth, z0) {
  const b = kit.body;
  const count = Math.max(6, Math.round((x1 - x0) / 0.42));
  const step = (x1 - x0) / count;
  const segments = 6;
  const profile = (t) => [z0 + depth * Math.sin((t * Math.PI) / 2), top - (top - bottom) * (1 - Math.cos((t * Math.PI) / 2))];
  for (let k = 0; k < segments; k++) {
    const [za, ya] = profile(k / segments);
    const [zb, yb] = profile((k + 1) / segments);
    const len = Math.hypot(zb - za, yb - ya) + 0.015;
    const angle = Math.atan2(ya - yb, zb - za);
    for (let i = 0; i < count; i++) {
      b.add(shapes.box(step + 0.002, 0.04, len), MART.stripe[i % 2], { p: [x0 + step * (i + 0.5), (ya + yb) / 2, (za + zb) / 2], r: [angle, 0, 0] });
    }
  }
  const front = z0 + depth;
  for (let i = 0; i < count; i++) {
    const x = x0 + step * (i + 0.5);
    b.add(shapes.box(step + 0.002, 0.18, 0.04), MART.stripe[i % 2], { p: [x, bottom - 0.09, front] });
    b.add(shapes.cylinder(step / 2, step / 2, 0.03, 14), MART.stripe[i % 2], { p: [x, bottom - 0.18, front], r: [Math.PI / 2, 0, 0] });
  }
  const shape = new THREE.Shape();
  shape.moveTo(z0, bottom - 0.18);
  for (let k = 0; k <= segments; k++) shape.lineTo(...profile(k / segments));
  shape.lineTo(front, bottom - 0.18);
  shape.closePath();
  for (const x of [x0, x1]) {
    const cap = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
    cap.rotateY(-Math.PI / 2);
    cap.translate(x + 0.015, 0, 0);
    b.add(cap, MART.stripe[1]);
  }
}

function martPlanter(kit, x, z) {
  const b = kit.body;
  b.add(rbox(1.3, 0.5, 0.55, 0.07), MART.concrete, { p: [x, 0.25, z] });
  b.add(rbox(1.38, 0.07, 0.63, 0.03), shade(MART.concrete, 1.08), { p: [x, 0.51, z] });
  b.add(shapes.box(1.2, 0.02, 0.45), PAL.soil, { p: [x, 0.54, z] });
  for (const dx of [-0.36, 0.02, 0.38]) martShrub(kit, x + dx, 0.66, z, 0.3);
  block(kit, x - 0.69, z - 0.32, x + 0.69, z + 0.32, 1);
}

function martChalkboard(kit, x, z) {
  const b = kit.body;
  const tilt = 0.22;
  for (const side of [1, -1]) {
    b.group([x, 0.43, z + side * 0.09], [-side * tilt, 0, 0], () => b.add(rbox(0.62, 0.88, 0.04, 0.018), 0x6b4a2c));
  }
  paintedPanel(kit, 0.52, 0.76, paintChalkboard, { p: [x, 0.436, z + 0.115], r: [-tilt, 0, 0] });
  block(kit, x - 0.33, z - 0.3, x + 0.33, z + 0.3, 1);
}

function martStreetLamp(kit, x, z) {
  const b = kit.body;
  const dark = 0x2a2420;
  const pole = 3.7;
  b.add(shapes.lathe([[0.001, 0], [0.26, 0], [0.24, 0.12], [0.16, 0.2], [0.12, 0.42], [0.1, 0.5], [0.001, 0.5]], 14), dark, { p: [x, 0, z] });
  b.add(shapes.cylinder(0.065, 0.085, pole - 0.5, 12), dark, { p: [x, 0.5 + (pole - 0.5) / 2, z] });
  for (const y of [1.3, pole - 0.08]) b.add(shapes.torus(0.09, 0.03, 14), dark, { p: [x, y, z], r: [Math.PI / 2, 0, 0] });
  const headY = pole + 0.3;
  b.add(shapes.cylinder(0.14, 0.2, 0.08, 8), dark, { p: [x, pole + 0.04, z] });
  kit.lamps.add(shapes.cylinder(0.18, 0.13, 0.42, 8), 0xffe2a0, { p: [x, headY, z] });
  b.add(shapes.cylinder(0.22, 0.22, 0.05, 8), dark, { p: [x, headY + 0.23, z] });
  b.add(shapes.cone(0.27, 0.24, 8), dark, { p: [x, headY + 0.37, z] });
  b.add(shapes.sphere(0.05, 8, 6), dark, { p: [x, headY + 0.52, z] });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 8;
    b.limb([x + Math.cos(a) * 0.17, headY - 0.21, z + Math.sin(a) * 0.17], [x + Math.cos(a) * 0.2, headY + 0.21, z + Math.sin(a) * 0.2], 0.012, dark, { capsule: false, seg: 4 });
  }
  kit.lights.push({ position: new THREE.Vector3(x, headY, z), tint: 0xffd28a });
  const armY = 3.25;
  b.limb([x, armY, z], [x + 0.86, armY, z], 0.025, dark, { capsule: true, seg: 6 });
  b.add(shapes.torus(0.16, 0.014, 16, Math.PI), dark, { p: [x + 0.17, armY - 0.17, z], r: [0, 0, Math.PI / 2] });
  for (const dx of [0.29, 0.77]) b.limb([x + dx, armY, z], [x + dx, armY - 0.12, z], 0.01, dark, { capsule: false, seg: 3 });
  b.add(rbox(0.62, 0.92, 0.06, 0.03), MART.navyDark, { p: [x + 0.53, armY - 0.6, z] });
  paintedPanel(kit, 0.56, 0.86, paintBlade, { glow: 0.8, p: [x + 0.53, armY - 0.6, z + 0.035] });
  block(kit, x - 0.27, z - 0.27, x + 0.27, z + 0.27, 3.6);
}

function martGondola(kit, cx, z, width) {
  const p = kit.interior;
  const rand = kit.rand;
  const top = 1.45;
  p.add(rbox(width, 0.14, 0.62, 0.04), MART.shelfEdge, { p: [cx, 0.19, z] });
  p.add(shapes.box(width - 0.06, top - 0.26, 0.05), MART.shelf, { p: [cx, (top + 0.26) / 2, z] });
  for (const side of [-1, 1]) p.add(rbox(0.05, top - 0.12, 0.62, 0.02), MART.shelfEdge, { p: [cx + (side * width) / 2, 0.12 + (top - 0.12) / 2, z] });
  for (const y of [0.6, 1.02, top]) p.add(rbox(width, 0.04, 0.6, 0.015), MART.shelf, { p: [cx, y, z] });
  for (const y of [0.26, 0.62, 1.04]) {
    let x = cx - width / 2 + 0.06;
    while (x < cx + width / 2 - 0.12) {
      const w = 0.07 + rand() * 0.07;
      const h = 0.12 + rand() * 0.18;
      p.add(shapes.box(w, h, 0.22), pick(rand, MART_GOODS), { p: [x + w / 2, y + h / 2, z + 0.17] });
      x += w + 0.02;
    }
  }
}

function martInterior(kit, { inner, open, front, back, ceiling }) {
  const p = kit.interior;
  const b = kit.body;
  const depth = front - back;
  p.add(shapes.box(2 * inner, 0.02, depth), MART.floor, { p: [0, 0.13, (front + back) / 2] });
  p.add(shapes.box(2 * inner, 0.05, depth), MART.ceiling, { p: [0, ceiling, (front + back) / 2] });
  p.add(shapes.box(2 * inner, 0.3, 0.05), MART.ceiling, { p: [0, ceiling - 0.15, front] });
  const wallH = ceiling - 0.14;
  const midZ = (front + back) / 2;
  const sideW = inner - open;
  for (const side of [-1, 1]) {
    p.add(shapes.box(0.02, wallH, depth), MART.room, { p: [side * (inner - 0.01), 0.14 + wallH / 2, midZ] });
    p.add(shapes.box(0.03, 0.9, depth), MART.wainscot, { p: [side * (inner - 0.025), 0.59, midZ] });
    p.add(rbox(0.05, 0.05, depth, 0.02), MART.rail, { p: [side * (inner - 0.03), 1.05, midZ] });
    p.add(shapes.box(sideW, wallH, 0.02), MART.room, { p: [side * (open + sideW / 2), 0.14 + wallH / 2, front - 0.01] });
  }
  paintedPanel(kit, 2 * inner, ceiling - 0.14, paintBackWall, { glow: 0.75, p: [0, 0.14 + (ceiling - 0.14) / 2, back + 0.02] });
  const aisle = 0.7;
  const shelfW = inner - aisle - 0.9;
  for (const [i, z] of [-2.2, -3.6, -5.0, -6.4, -7.7].entries()) {
    const shift = i % 2 ? 0.25 : 0;
    for (const side of [-1, 1]) martGondola(kit, side * (aisle + shelfW / 2 + shift), z, shelfW - 0.3 * (i % 2));
  }
  const counterX = inner - 0.9;
  p.add(rbox(1.0, 0.92, 0.5, 0.05), 0xd9d4ca, { p: [counterX, 0.58, -1.05] });
  p.add(rbox(1.08, 0.05, 0.58, 0.02), 0x8a6a4a, { p: [counterX, 1.06, -1.05] });
  p.add(rbox(0.32, 0.22, 0.26, 0.03), MART.frame, { p: [counterX - 0.15, 1.2, -1.1] });
  const lampXs = [-0.75, -0.25, 0.25, 0.75].map((f) => f * inner);
  for (const z of [-1.5, -4.8]) {
    for (const x of lampXs) {
      b.limb([x, ceiling, z], [x, ceiling - 0.42, z], 0.008, MART.frame, { capsule: false, seg: 3 });
      b.add(shapes.cone(0.17, 0.15, 14), 0x30343c, { p: [x, ceiling - 0.48, z] });
      kit.lamps.add(shapes.sphere(0.06, 10, 8), MART.bulb, { p: [x, ceiling - 0.57, z] });
    }
  }
}

export function createMiniMart({ seed = 1 } = {}) {
  const kit = createKit(seed);
  const b = kit.body;
  const W = 11.4;
  const D = 9;
  const H = 4.3;
  const T = 0.25;
  const P = 0.75;
  const G = 2.9;
  const RECESS = 0.4;
  const half = W / 2;
  const open = half - P;
  const face = 0.1;
  const wall = MART.wall;

  b.add(shapes.box(W - 0.1, 0.12, D - 0.1), PAL.stone, { p: [0, 0.06, -D / 2] });
  b.add(rbox(W - 2 * T, H, T, 0.06), wall, { p: [0, H / 2, -D + T / 2] });
  b.add(rbox(W - 2 * T + 0.04, 0.3, T + 0.06, 0.06), MART.navyDark, { p: [0, 0.15, -D + T / 2] });
  for (const side of [-1, 1]) {
    const pillarX = side * (open + (P - T) / 2);
    b.add(rbox(T, H, D + face, 0.08), wall, { p: [side * (half - T / 2), H / 2, (face - D) / 2] });
    b.add(rbox(T + 0.06, 0.3, D + face + 0.04, 0.06), MART.navyDark, { p: [side * (half - T / 2), 0.15, (face - D) / 2] });
    b.add(rbox(P - T, H, T + face, 0.05), wall, { p: [pillarX, H / 2, (face - T) / 2] });
    b.add(rbox(P - T + 0.02, 0.32, T + face + 0.06, 0.05), MART.navyDark, { p: [pillarX, 0.16, (face - T) / 2 + 0.02] });
    b.add(shapes.box(0.06, G, RECESS - T), wall, { p: [side * (open + 0.03), G / 2, -(RECESS + T) / 2] });
    b.add(rbox(0.16, H + 0.1, 0.16, 0.06), MART.navy, { p: [side * half, (H + 0.1) / 2, face - 0.04] });
  }
  b.add(rbox(2 * open, H - G, T + face, 0.05), wall, { p: [0, (G + H) / 2, (face - T) / 2] });
  b.add(shapes.box(2 * open, 0.05, RECESS + face), shade(wall, 0.9), { p: [0, G - 0.025, (face - RECESS) / 2] });

  b.add(shapes.box(W, 0.16, D), MART.navyDark, { p: [0, H + 0.08, -D / 2] });
  b.add(rbox(W + 0.28, 0.3, 0.36, 0.07), MART.navy, { p: [0, H + 0.1, face] });
  b.add(rbox(W + 0.38, 0.07, 0.44, 0.03), MART.navyDark, { p: [0, H + 0.27, face] });
  for (const side of [-1, 1]) {
    b.add(rbox(0.32, 0.3, D + 0.1, 0.07), MART.navy, { p: [side * (half + 0.03), H + 0.1, -D / 2 + 0.05] });
    b.add(rbox(0.42, 0.07, D + 0.16, 0.03), MART.navyDark, { p: [side * (half + 0.03), H + 0.27, -D / 2 + 0.05] });
  }
  b.add(rbox(2 * open + 0.14, 0.13, 0.2, 0.05), MART.navy, { p: [0, G + 0.08, face + 0.03] });
  b.add(rbox(0.95, 0.6, 0.75, 0.1), wall, { p: [0, H + 0.48, -1.3] });
  b.add(rbox(1.1, 0.08, 0.9, 0.035), MART.navy, { p: [0, H + 0.82, -1.3] });
  b.add(shapes.sphere(0.2, 12, 8), wall, { p: [0, H + 0.86, -1.3], s: [1, 0.6, 1] });

  const signY = (G + H) / 2 + 0.06;
  b.add(rbox(4.76, 1.0, 0.16, 0.07), MART.navyDark, { p: [0, signY, face + 0.08] });
  paintedPanel(kit, 4.6, 0.86, paintMartSign, { glow: 0.9, p: [0, signY, face + 0.165] });
  for (const x of [-1.7, 0, 1.7]) {
    b.limb([x, H - 0.05, face], [x, H + 0.12, face + 0.42], 0.02, MART.frame, { capsule: false, seg: 4 });
    b.add(shapes.cone(0.13, 0.16, 14), MART.frame, { p: [x, H + 0.08, face + 0.46], r: [0.45, 0, 0] });
    kit.lamps.add(shapes.sphere(0.055, 10, 8), MART.bulb, { p: [x, H, face + 0.43] });
  }
  for (const side of [-1, 1]) {
    for (const y of [signY + 0.16, signY - 0.12]) kit.lamps.add(rbox(1.05, 0.08, 0.05, 0.025), MART.strip, { p: [side * (half - 0.66), y, face + 0.03] });
  }
  for (let i = 0; i < 6; i++) kit.lamps.add(rbox(0.42, 0.06, 0.05, 0.02), MART.strip, { p: [half - P / 2, 1.15 + i * 0.24, face + 0.03] });

  martAwning(kit, -open - 0.12, open + 0.12, G, G - 0.42, 0.95, face);

  const glass = -RECESS;
  martInterior(kit, { inner: half - T, open, front: glass - 0.05, back: -D + T, ceiling: G + 0.3 });
  b.add(rbox(2 * open, 0.13, RECESS + face + 0.3, 0.04), PAL.stone, { p: [0, 0.065, (glass + face + 0.3) / 2] });
  b.add(rbox(2 * open, 0.1, 0.1, 0.03), MART.frame, { p: [0, G - 0.05, glass] });
  b.add(rbox(1.56, 0.07, 0.1, 0.03), MART.frame, { p: [0, 2.2, glass] });
  b.add(rbox(2 * open, 0.1, 0.12, 0.03), MART.frame, { p: [0, 0.17, glass] });
  const posts = [-0.78, 0, 0.78];
  const bays = Math.max(1, Math.round((open - 0.78) / 0.85));
  for (const side of [-1, 1]) {
    for (let k = 1; k <= bays; k++) posts.push(side * (k === bays ? open - 0.05 : 0.78 + ((open - 0.78) * k) / bays));
  }
  for (const x of posts) {
    const door = Math.abs(x) < 0.8;
    b.add(rbox(door ? 0.1 : 0.08, G - 0.12, 0.1, 0.03), MART.frame, { p: [x, 0.12 + (G - 0.12) / 2, glass] });
  }
  for (const side of [-1, 1]) {
    b.add(rbox(open - 0.78, 0.26, 0.08, 0.03), MART.frame, { p: [(side * (open + 0.78)) / 2, 0.3, glass] });
    b.add(rbox(0.035, 0.55, 0.05, 0.015), 0xc8ccd4, { p: [side * 0.1, 1.15, glass + 0.07] });
  }
  b.add(rbox(1.6, 0.025, 0.7, 0.012), 0x3a3a3c, { p: [0, 0.013, face + 0.45] });

  for (const side of [-1, 1]) martPlanter(kit, side * 2.4, face + 0.32);
  martChalkboard(kit, -half + 0.65, 1.9);
  martStreetLamp(kit, -half - 0.75, 1.35);

  block(kit, -half, -D, half, face, H + 0.3);
  return { group: assemble(kit), obstacles: kit.obstacles, door: { x: 0, z: 0.85 } };
}

const PRODUCE = {
  greens: [0x5aa83e, 0x3f8a3a, 0x7cbf4a],
  warm: [0xe8762a, 0xd8401e, 0xf2a83a],
  roots: [0x7a3a6e, 0xb88a4a, 0xe6d8a0],
  fruit: [0xf2c830, 0x8cc63e, 0xe85a2a],
  eggs: [0xf2e8d0, 0xe8d0a8],
};
const GLAZES = [0x6e4a32, 0x8a4a2a, 0x5a3a28, 0x3d5f6e, 0x7a5a3a];

function chiliBraid(kit, x, yTop, z, length) {
  const b = kit.body;
  const rand = kit.rand;
  b.limb([x, yTop, z], [x, yTop - length, z], 0.012, PAL.straw, { capsule: false, seg: 4 });
  const garlic = rand() < 0.35;
  for (let y = yTop - 0.15; y > yTop - length; y -= 0.11) {
    for (const side of [-1, 1]) {
      if (garlic) b.add(shapes.sphere(0.05, 6, 4), 0xf0e6d4, { p: [x + side * 0.04, y, z], flat: true });
      else b.add(shapes.cone(0.025, 0.16, 5), rand() < 0.85 ? 0xc8261a : 0xe86a1e, { p: [x + side * 0.035, y - 0.04, z], r: [0, 0, Math.PI - side * 0.3], flat: true });
    }
  }
}

function shelfUnit(kit, cx, z, width, levels) {
  const b = kit.body;
  const rand = kit.rand;
  const height = levels[levels.length - 1] + 0.1;
  for (const dx of [-width / 2, 0, width / 2]) b.add(shapes.box(0.08, height, 0.5), PAL.woodDark, { p: [cx + dx, height / 2, z] });
  for (const y of levels) b.add(shapes.box(width, 0.05, 0.5), PAL.woodMid, { p: [cx, y, z] });
  for (const y of levels.slice(0, -1)) {
    const count = Math.round(width / 0.9);
    for (let i = 0; i < count; i++) {
      const x = cx - width / 2 + (width * (i + 0.5)) / count;
      if (rand() < 0.5) clayJar(kit, x, y + 0.025, z, 0.42 + rand() * 0.15, pick(rand, GLAZES));
      else produceBasket(kit, x, y + 0.025, z, 0.18 + rand() * 0.04, pick(rand, Object.values(PRODUCE)));
    }
  }
}

export function createMarket({ seed = 1 } = {}) {
  const kit = createKit(seed);
  const { rand, body: b } = kit;
  const W = 10;
  const D = 8;
  const T = 0.25;
  const P = 0.5;
  const lip = 0.22;
  const wall = shade(pick(rand, PAL.yellows), 0.95 + rand() * 0.08);
  const roofTint = pick(rand, PAL.roofTints);
  const slope = 0.5;
  const wallTop = 4.6;
  const beamY = 3.25;
  const pentTop = 3.78;
  const pentSlope = 0.42;
  const ridgeY = wallTop + (D / 2) * slope;
  const xa = -W / 2 + P;
  const xb = W / 2 - P;

  for (const side of [-1, 1]) gableWall(kit, wall, side * (W / 2 - T / 2), 0, -D, wallTop + lip, ridgeY + lip, T);
  const roof = { x0: -W / 2 + 0.04, x1: W / 2 - 0.04, ridgeZ: -D / 2, ridgeY, slope, tint: roofTint };
  roofPitch(kit, { ...roof, run: D / 2 + 0.45, facing: 1, tileEnds: true });
  roofPitch(kit, { ...roof, run: D / 2 + 0.4, facing: -1 });
  ridgeCrest(kit, -W / 2 + T, W / 2 - T, -D / 2, ridgeY, pick(rand, ['disc', 'gourd']));
  plaster(kit, wall, W - 2 * T, wallTop, T, 0, wallTop / 2, -D + T / 2);
  roofPitch(kit, { x0: -W / 2 + 0.04, x1: W / 2 - 0.04, ridgeZ: 0, ridgeY: pentTop, run: 1.15, slope: pentSlope, facing: 1, tint: roofTint, tileEnds: true });
  b.add(shapes.box(W - 0.1, 0.1, 0.14), PAL.mortar, { p: [0, pentTop + 0.03, 0.02] });

  for (const side of [-1, 1]) {
    const px = side * (W / 2 - P / 2);
    plaster(kit, wall, P, wallTop, T + 0.08, px, wallTop / 2, -T / 2 + 0.04);
    b.add(shapes.box(P + 0.04, 0.5, T + 0.14), PAL.plinth, { p: [px, 0.25, -T / 2 + 0.04] });
    b.add(shapes.box(P + 0.08, 0.12, T + 0.16), PAL.mortar, { p: [px, wallTop - 0.08, -T / 2 + 0.05] });
  }

  b.add(shapes.box(W - 2 * T, 0.03, D - T), 0xb4704c, { p: [0, 0.015, -(D - T) / 2] });
  for (const x of [xa + 0.1, -1.5, 1.5, xb - 0.1]) {
    b.add(shapes.box(0.2, beamY, 0.2), PAL.woodMid, { p: [x, beamY / 2, 0] });
    b.add(shapes.box(0.3, 0.12, 0.3), PAL.stone, { p: [x, 0.06, 0] });
    block(kit, x - 0.16, -0.16, x + 0.16, 0.16);
  }
  b.add(shapes.box(xb - xa, 0.22, 0.22), PAL.woodMid, { p: [0, beamY, 0] });
  b.add(shapes.box(W - 2 * P, wallTop - beamY, 0.1), PAL.woodDark, { p: [0, (wallTop + beamY) / 2, -0.14] });
  for (const [x0, x1] of [[xa + 0.2, -1.6], [-1.4, 1.4], [1.6, xb - 0.2]]) lattice(kit, x0, x1, pentTop + 0.1, wallTop - 0.2, -0.02);
  b.add(shapes.box(2.8, 0.66, 0.08), PAL.woodDark, { p: [0, 2.86, 0.02] });
  b.add(shapes.box(2.9, 0.05, 0.1), PAL.gold, { p: [0, 2.52, 0.03] });
  for (const side of [-1, 1]) {
    const inner = side * 1.6;
    const outer = side * (xb - 0.2);
    b.add(shapes.box(Math.abs(outer - inner), 0.2, 0.06), PAL.woodMid, { p: [(inner + outer) / 2, 3.04, 0.02] });
    for (const post of [side * 1.5, side * (xb - 0.1)]) {
      const dir = post === side * 1.5 ? side : -side;
      b.limb([post + dir * 0.1, 2.55, 0.02], [post + dir * 0.6, 3.12, 0.02], 0.045, PAL.woodDark, { capsule: false, seg: 4 });
    }
    textSign(kit, side * 1.5, 1.75, 0.14, 0.3, 1.4, { text: side < 0 ? ['Mua', 'May', 'Bán', 'Đắt'] : ['Tấn', 'Tài', 'Tấn', 'Lộc'], vertical: true });
  }

  b.limb([-1.5, 3.0, 0.1], [-1.5, 3.0, 1.0], 0.025, PAL.ink, { capsule: false, seg: 5 });
  for (const dz of [0.48, 0.98]) b.limb([-1.5, 3.0, dz], [-1.5, 2.96, dz], 0.012, PAL.ink, { capsule: false, seg: 4 });
  textSign(kit, -1.5, 2.55, 0.73, 0.7, 0.8, { text: ['NÔNG', 'SẢN'], across: true, bg: 0xe8c45a, fg: PAL.lacquer, brush: false });

  b.add(shapes.box(2.4, 0.6, 0.55), PAL.woodMid, { p: [0, 0.3, -1.3] });
  b.add(shapes.box(2.5, 0.08, 0.62), PAL.woodDark, { p: [0, 0.04, -1.3] });
  b.add(shapes.box(2.56, 0.07, 0.7), PAL.woodDark, { p: [0, 0.635, -1.3] });
  for (const x of [-0.8, 0, 0.8]) b.add(shapes.box(0.66, 0.36, 0.03), PAL.wood, { p: [x, 0.33, -1.012] });
  b.add(shapes.box(0.3, 0.03, 0.18), PAL.woodDark, { p: [0.7, 0.685, -1.35] });
  b.add(shapes.cylinder(0.018, 0.018, 0.45, 6), PAL.bronze, { p: [0.7, 0.92, -1.35] });
  b.add(shapes.box(0.56, 0.025, 0.025), PAL.bronze, { p: [0.7, 1.14, -1.35] });
  for (const dx of [-0.26, 0.26]) {
    b.limb([0.7 + dx, 1.14, -1.35], [0.7 + dx, 0.9, -1.35], 0.006, PAL.ink, { capsule: false, seg: 4 });
    b.add(shapes.cylinder(0.11, 0.08, 0.03, 8), PAL.bronze, { p: [0.7 + dx, 0.89, -1.35] });
  }
  b.add(shapes.box(0.44, 0.03, 0.24), PAL.woodDark, { p: [-0.65, 0.685, -1.3] });
  for (let row = 0; row < 5; row++) {
    for (let k = 0; k < 5; k++) {
      b.add(shapes.box(0.05, 0.035, 0.03), k % 2 ? 0x8a2a1c : 0x3a2418, { p: [-0.83 + k * 0.09, 0.717, -1.39 + row * 0.045] });
    }
  }
  produceBasket(kit, 0.05, 0.67, -1.3, 0.16, PRODUCE.eggs);
  block(kit, -1.28, -1.65, 1.28, -0.95, 1.2);

  const tables = [PRODUCE.greens, PRODUCE.warm, PRODUCE.fruit, PRODUCE.roots];
  for (const side of [-1, 1]) {
    const cx = side * 3.15;
    b.add(shapes.box(2.1, 0.08, 1.05), PAL.woodMid, { p: [cx, 0.66, -0.98] });
    b.add(shapes.box(1.95, 0.04, 0.9), PAL.woodDark, { p: [cx, 0.2, -0.98] });
    for (const dx of [-0.98, 0.98]) {
      for (const dz of [-0.45, 0.45]) b.add(shapes.box(0.08, 0.62, 0.08), PAL.woodDark, { p: [cx + dx, 0.31, -0.98 + dz] });
    }
    for (const dx of [-0.65, 0, 0.65]) produceBasket(kit, cx + dx, 0.7, -0.98, 0.28, pick(rand, tables));
    for (const dx of [-0.45, 0.45]) produceBasket(kit, cx + dx, 0.22, -0.98, 0.22, pick(rand, tables));
    block(kit, cx - 1.05, -1.52, cx + 1.05, -0.44, 1.2);
  }

  for (const z of [-2.6, -5.4]) b.add(shapes.box(W - 2 * T, 0.2, 0.2), PAL.wood, { p: [0, 3.3, z] });
  for (const x of [-3.4, -2.7, 2.7, 3.4]) chiliBraid(kit, x, 3.2, -2.6, 0.9 + rand() * 0.2);
  for (const x of [-1.25, 1.25]) silkLantern(kit, x, 3.2, -2.75, pick(rand, PAL.lanterns));

  shelfUnit(kit, -2.3, -7.5, 3.6, [0.05, 0.75, 1.45, 2.15]);
  shelfUnit(kit, 2.3, -7.5, 3.6, [0.05, 0.75, 1.45, 2.15]);
  block(kit, -4.6, -7.8, 4.6, -7.2);

  const sacks = [[-4.15, 0, -3.0], [-4.15, 0, -3.6], [-4.15, 0, -4.2], [-3.55, 0, -3.3], [-3.55, 0, -3.9], [-4.15, 0.55, -3.3], [-4.15, 0.55, -3.9], [-3.55, 0.55, -3.6]];
  for (const [x, y, z] of sacks) riceSack(kit, x, y, z, rand() * 3);
  block(kit, -4.6, -4.55, -3.2, -2.65, 1.6);
  openSack(kit, -3.0, -5.3, PAL.rice);
  openSack(kit, -3.75, -5.45, 0x8a3a2a);
  openSack(kit, -3.3, -6.15, 0xd8b04a);

  for (const [x, z, s] of [[4.05, -3.15, 1.1], [4.05, -4.05, 0.95], [3.3, -3.55, 0.8]]) {
    clayJar(kit, x, 0.03, z, s, pick(rand, GLAZES));
    b.add(shapes.cylinder(0.24 * s, 0.24 * s, 0.04, 8), PAL.wood, { p: [x, 0.03 + 0.77 * s, z] });
  }
  block(kit, 2.9, -4.55, 4.6, -2.7, 1.6);
  produceBasket(kit, 3.95, 0.03, -5.45, 0.38, PRODUCE.greens);
  produceBasket(kit, 3.2, 0.03, -5.95, 0.32, PRODUCE.warm);
  block(kit, 2.85, -6.35, 4.4, -5.05, 1);

  const vine = rand() < 0.5 ? (rand() < 0.5 ? -1 : 1) : 0;
  if (vine) bougainvillea(kit, vine * (W / 2 - 0.3), beamY - 0.15, -vine, 1.3);
  const colors = lanternColors(rand);
  const xs = [-2.5, 2.5];
  if (vine !== -1) xs.push(-3.8);
  if (vine !== 1) xs.push(3.8);
  lanternRow(kit, xs, () => pentTop - 0.6 * pentSlope - 0.15, 0.6, colors);
  pottedPlant(kit, vine === -1 ? -3.9 : -4.45, 0.62, Math.floor(rand() * 4));
  pottedPlant(kit, vine === 1 ? 3.9 : 4.45, 0.62, Math.floor(rand() * 4));

  block(kit, -W / 2, -D, -W / 2 + T + 0.1, 0.1);
  block(kit, W / 2 - T - 0.1, -D, W / 2, 0.1);
  block(kit, -W / 2, -D, W / 2, -D + T + 0.1);
  block(kit, -W / 2, -0.2, xa + 0.05, 0.12);
  block(kit, xb - 0.05, -0.2, W / 2, 0.12);
  return {
    group: assemble(kit),
    obstacles: kit.obstacles,
    counter: { x: 0, z: -0.35 },
    keeper: { x: 0, z: -2.2, facing: 0 },
    plaque: { x: 0, y: 2.86, z: 0.12 },
  };
}

function lacquerColumn(kit, x, z, height, floor = 0) {
  const b = kit.body;
  b.add(shapes.cylinder(0.22, 0.25, 0.16, 8), PAL.stone, { p: [x, floor + 0.08, z], flat: true });
  b.add(shapes.cylinder(0.14, 0.15, height - floor - 0.16, 8), PAL.lacquer, { p: [x, floor + 0.16 + (height - floor - 0.16) / 2, z] });
  b.add(shapes.cylinder(0.165, 0.165, 0.06, 8), PAL.gold, { p: [x, floor + 0.22, z] });
  b.add(shapes.cylinder(0.165, 0.165, 0.06, 8), PAL.gold, { p: [x, height - 0.35, z] });
}

function bonsai(kit, x, z) {
  const b = kit.body;
  const rand = kit.rand;
  b.add(shapes.box(0.5, 0.55, 0.5), PAL.stoneDark, { p: [x, 0.275, z] });
  b.add(shapes.box(0.6, 0.07, 0.6), PAL.stone, { p: [x, 0.585, z] });
  b.add(shapes.lathe([[0.001, 0], [0.24, 0], [0.32, 0.14], [0.34, 0.18], [0.001, 0.18]], 8), 0x2f5f8e, { p: [x, 0.62, z], flat: true });
  b.limb([x, 0.78, z], [x + 0.12, 1.1, z + 0.05], 0.05, PAL.trunk, { capsule: false, seg: 5 });
  b.limb([x + 0.12, 1.1, z + 0.05], [x - 0.08, 1.4, z], 0.04, PAL.trunk, { capsule: false, seg: 5 });
  for (const [dx, dy, dz, r] of [[0.22, 1.12, 0.05, 0.26], [-0.18, 1.32, -0.02, 0.24], [0.02, 1.52, 0.02, 0.2]]) {
    b.add(shapes.ico(r, 0), pick(rand, [PAL.leaf, PAL.leafDark]), { p: [x + dx, dy, z + dz], s: [1.4, 0.55, 1.2], flat: true });
  }
  block(kit, x - 0.32, z - 0.32, x + 0.32, z + 0.32, 1.6);
}

export function createChiefHouse({ seed = 1 } = {}) {
  const kit = createKit(seed);
  const { rand, body: b } = kit;
  const W = 9;
  const D = 8;
  const T = 0.3;
  const P = 0.5;
  const lip = 0.24;
  const wall = shade(pick(rand, PAL.yellows), 0.98 + rand() * 0.06);
  const roofTint = pick(rand, PAL.roofTints);
  const slope = 0.55;
  const wallTop = 3.9;
  const ridgeY = wallTop + (D / 2) * slope;
  const frontZ = -0.2;
  const innerZ = -2.6;
  const columnXs = [-3.3, -1.25, 1.25, 3.3];
  const roofAt = (z) => wallTop + (0 - z) * slope;

  for (const side of [-1, 1]) gableWall(kit, wall, side * (W / 2 - T / 2), 0, -D, wallTop + lip, ridgeY + lip, T);
  const roof = { x0: -W / 2 + 0.04, x1: W / 2 - 0.04, ridgeZ: -D / 2, ridgeY, slope, tint: roofTint };
  roofPitch(kit, { ...roof, run: D / 2 + 0.95, facing: 1, tileEnds: true });
  roofPitch(kit, { ...roof, run: D / 2 + 0.45, facing: -1 });
  ridgeCrest(kit, -W / 2 + T, W / 2 - T, -D / 2, ridgeY, 'dragons');
  plaster(kit, wall, W - 2 * T, wallTop, T, 0, wallTop / 2, -D + T / 2);

  for (const side of [-1, 1]) {
    const px = side * (W / 2 - P / 2);
    plaster(kit, wall, P, wallTop, T + 0.1, px, wallTop / 2, -T / 2 + 0.05);
    b.add(shapes.box(P + 0.04, 0.55, T + 0.16), PAL.plinth, { p: [px, 0.275, -T / 2 + 0.05] });
    b.add(shapes.box(P + 0.08, 0.14, T + 0.18), PAL.mortar, { p: [px, wallTop - 0.08, -T / 2 + 0.06] });
  }

  b.add(shapes.box(W, 0.07, 0.35), PAL.stoneDark, { p: [0, 0.035, 0.12] });
  b.add(shapes.box(2.4, 0.06, 0.36), PAL.stone, { p: [0, 0.03, 0.47] });
  b.add(shapes.box(W - 2 * T, 0.03, 2.75), 0xc9c0ac, { p: [0, 0.015, -1.325] });
  b.add(shapes.box(W - 2 * T, 0.03, 5), 0xb0583a, { p: [0, 0.015, -5.2] });

  for (const x of columnXs) {
    lacquerColumn(kit, x, frontZ, wallTop);
    lacquerColumn(kit, x, innerZ, roofAt(innerZ) - 0.1);
    b.add(shapes.box(0.18, 0.22, frontZ - innerZ - 0.1), PAL.lacquer, { p: [x, 3.52, (frontZ + innerZ) / 2] });
    block(kit, x - 0.24, frontZ - 0.24, x + 0.24, frontZ + 0.24);
  }
  b.add(shapes.box(W - 2 * T, 0.26, 0.24), PAL.lacquer, { p: [0, wallTop - 0.13, frontZ] });
  b.add(shapes.box(W - 2 * T, 0.04, 0.26), PAL.gold, { p: [0, wallTop - 0.28, frontZ] });
  b.add(shapes.box(W - 2 * T, 0.24, 0.22), PAL.lacquer, { p: [0, 3.52, innerZ] });

  b.add(shapes.box(2.2, 0.8, 0.08), PAL.woodDark, { p: [0, 3.02, frontZ] });
  for (const y of [2.64, 3.4]) b.add(shapes.box(2.2, 0.04, 0.03), PAL.gold, { p: [0, y, frontZ + 0.05] });
  for (const side of [-1, 1]) {
    const x0 = side * 1.4;
    const x1 = side * 3.15;
    const cx = (x0 + x1) / 2;
    const w = Math.abs(x1 - x0);
    b.add(shapes.box(w, 0.06, 0.08), PAL.lacquer, { p: [cx, 3.2, frontZ] });
    for (let k = 1; k < 9; k++) b.add(shapes.box(0.03, 0.4, 0.04), PAL.woodMid, { p: [x0 + (side * w * k) / 9, 3.42, frontZ] });
    for (const [post, dir] of [[side * 1.25, side], [side * 3.3, -side], [side * 3.3, side]]) {
      b.limb([post + dir * 0.12, 2.9, frontZ], [post + dir * 0.55, 3.62, frontZ], 0.045, PAL.lacquer, { capsule: false, seg: 4 });
    }
  }

  for (const [x0, x1] of [[-4.2, -3.3], [-3.3, -1.25], [1.25, 3.3], [3.3, 4.2]]) {
    const a = x0 + 0.15;
    const c = x1 - 0.15;
    const cx = (a + c) / 2;
    plankPanel(kit, a, c, 0.03, 0.9, innerZ, PAL.woodMid, 0.3);
    lattice(kit, a, c, 0.9, 2.55, innerZ + 0.03);
    b.add(shapes.box(c - a, 0.95, 0.06), PAL.woodDark, { p: [cx, 3.0, innerZ] });
  }
  const gableFill = roofAt(innerZ) - 0.15;
  b.add(shapes.box(W - 2 * T, gableFill - 3.64, 0.06), PAL.woodDark, { p: [0, (gableFill + 3.64) / 2, innerZ] });
  block(kit, -W / 2, innerZ - 0.15, -1.08, innerZ + 0.15);
  block(kit, 1.08, innerZ - 0.15, W / 2, innerZ + 0.15);
  textSign(kit, 0, 4.15, innerZ + 0.1, 1.9, 0.55, { text: 'Quốc Thái Dân An' });

  b.add(shapes.box(1.9, 0.07, 0.76), PAL.lacquer, { p: [0, 0.8, -3.9] });
  b.add(shapes.box(1.94, 0.02, 0.8), PAL.gold, { p: [0, 0.76, -3.9] });
  b.add(shapes.box(1.8, 0.14, 0.03), PAL.lacquer, { p: [0, 0.68, -3.53] });
  for (let x = -0.75; x <= 0.76; x += 0.25) b.add(shapes.sphere(0.02, 6, 4), PAL.gold, { p: [x, 0.68, -3.51] });
  for (const dx of [-0.88, 0.88]) {
    for (const dz of [-0.32, 0.32]) {
      b.add(shapes.box(0.08, 0.76, 0.08), PAL.lacquer, { p: [dx, 0.38, -3.9 + dz] });
      b.add(shapes.box(0.11, 0.04, 0.11), PAL.gold, { p: [dx, 0.02, -3.9 + dz] });
    }
  }
  b.add(shapes.box(0.42, 0.006, 0.3), PAL.cream, { p: [0.1, 0.838, -3.88] });
  for (let i = 0; i < 6; i++) b.add(shapes.box(0.02, 0.004, 0.2), PAL.ink, { p: [0.0 + i * 0.05, 0.842, -3.88] });
  b.add(shapes.box(0.18, 0.04, 0.12), 0x45454c, { p: [-0.35, 0.855, -3.85] });
  b.add(shapes.cylinder(0.05, 0.045, 0.18, 8), PAL.bronze, { p: [-0.7, 0.925, -3.95] });
  for (const dx of [-0.015, 0.015]) b.limb([-0.7 + dx, 0.9, -3.95], [-0.7 + dx * 4, 1.15, -3.95], 0.008, PAL.ink, { capsule: false, seg: 4 });
  b.add(shapes.box(0.32, 0.05, 0.24), 0xe0b84e, { p: [0.65, 0.86, -3.95], r: [0, 0.1, 0] });
  b.add(shapes.box(0.3, 0.05, 0.22), 0x9c3324, { p: [0.66, 0.91, -3.95], r: [0, -0.08, 0] });
  b.add(shapes.box(0.07, 0.07, 0.07), PAL.lacquer, { p: [-0.1, 0.87, -3.7] });
  block(kit, -1.0, -4.3, 1.0, -3.5, 1.2);

  b.add(shapes.box(0.66, 0.06, 0.56), PAL.woodDark, { p: [0, 0.48, -5.45] });
  b.add(shapes.box(0.66, 0.75, 0.06), PAL.woodDark, { p: [0, 0.88, -5.7] });
  b.add(shapes.box(0.5, 0.5, 0.02), PAL.lacquer, { p: [0, 0.92, -5.665] });
  for (const dx of [-0.31, 0.31]) {
    b.add(shapes.box(0.06, 0.3, 0.5), PAL.woodDark, { p: [dx, 0.66, -5.45] });
    for (const dz of [-0.24, 0.24]) b.add(shapes.box(0.06, 0.48, 0.06), PAL.woodDark, { p: [dx, 0.24, -5.45 + dz] });
  }
  block(kit, -0.4, -5.78, 0.4, -5.15, 1.2);

  b.add(shapes.box(3.6, 3.0, 0.03), 0x7a1e14, { p: [0, 1.75, -D + T + 0.02] });
  for (const y of [0.27, 3.23]) b.add(shapes.box(3.6, 0.05, 0.04), PAL.gold, { p: [0, y, -D + T + 0.03] });
  textSign(kit, 0, 2.95, -D + T + 0.06, 2.2, 0.6, { text: 'Quang Tiền Dụ Hậu' });
  for (const side of [-1, 1]) textSign(kit, side * 1.45, 1.75, -D + T + 0.06, 0.32, 1.7, { text: side < 0 ? ['Phúc', 'Như', 'Đông', 'Hải'] : ['Thọ', 'Tỷ', 'Nam', 'Sơn'], vertical: true });
  const altarZ = -7.35;
  b.add(shapes.box(2.4, 0.08, 0.55), PAL.lacquer, { p: [0, 1.0, altarZ] });
  b.add(shapes.box(2.3, 0.85, 0.03), PAL.lacquer, { p: [0, 0.52, altarZ + 0.26] });
  for (const y of [0.15, 0.9]) b.add(shapes.box(2.3, 0.03, 0.04), PAL.gold, { p: [0, y, altarZ + 0.28] });
  for (const dx of [-1.12, 1.12]) b.add(shapes.box(0.08, 0.96, 0.5), PAL.lacquer, { p: [dx, 0.48, altarZ] });
  b.add(shapes.lathe([[0.001, 0], [0.12, 0], [0.16, 0.06], [0.17, 0.16], [0.13, 0.22], [0.15, 0.25], [0.001, 0.25]], 8), PAL.bronze, { p: [0, 1.04, altarZ] });
  for (let i = -1; i <= 1; i++) b.limb([i * 0.03, 1.25, altarZ], [i * 0.04, 1.5, altarZ], 0.006, 0xa0302a, { capsule: false, seg: 4 });
  for (const dx of [-0.75, 0.75]) {
    b.add(shapes.cylinder(0.05, 0.08, 0.32, 8), PAL.bronze, { p: [dx, 1.2, altarZ] });
    b.add(shapes.cylinder(0.03, 0.03, 0.16, 6), 0xc8261a, { p: [dx, 1.44, altarZ] });
  }
  for (const dx of [-0.42, 0.42]) {
    b.add(shapes.lathe([[0.001, 0], [0.07, 0], [0.1, 0.1], [0.06, 0.24], [0.08, 0.3], [0.001, 0.3]], 8), PAL.cream, { p: [dx, 1.04, altarZ - 0.08] });
    bush(kit, dx, 1.42, altarZ - 0.08, 0.14, [0xf5c430, 0xf08a1e, PAL.leaf]);
  }
  b.add(shapes.cylinder(0.16, 0.1, 0.05, 8), PAL.gold, { p: [0.0, 1.07, altarZ + 0.15] });
  for (let i = 0; i < 5; i++) b.add(shapes.sphere(0.05, 6, 4), pick(rand, PRODUCE.fruit), { p: [Math.cos(i * 1.3) * 0.07, 1.13 + (i > 3 ? 0.06 : 0), altarZ + 0.15 + Math.sin(i * 1.3) * 0.07] });
  block(kit, -1.4, -D, 1.4, -6.95, 1.4);

  b.add(shapes.cylinder(0.45, 0.45, 0.05, 10), PAL.woodDark, { p: [-3.0, 0.62, -5.2] });
  b.add(shapes.cylinder(0.08, 0.14, 0.6, 8), PAL.woodDark, { p: [-3.0, 0.3, -5.2] });
  for (const dx of [-0.7, 0.7]) {
    b.add(shapes.cylinder(0.2, 0.17, 0.42, 8), PAL.lacquer, { p: [-3.0 + dx, 0.21, -5.2] });
    block(kit, -3.0 + dx - 0.22, -5.42, -3.0 + dx + 0.22, -4.98, 0.5);
  }
  b.add(shapes.sphere(0.08, 8, 6), 0x8e4a35, { p: [-3.05, 0.71, -5.2], s: [1, 0.8, 1] });
  for (const [dx, dz] of [[0.15, 0.1], [0.12, -0.12], [-0.18, 0.12]]) b.add(shapes.cylinder(0.03, 0.024, 0.04, 8), PAL.cream, { p: [-3.0 + dx, 0.665, -5.2 + dz] });
  block(kit, -3.48, -5.68, -2.52, -4.72, 0.8);

  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    b.limb([3.0 + dx * 0.36, 0, -4.6 + dz * 0.36], [3.0 + dx * 0.26, 0.5, -4.6 + dz * 0.26], 0.035, PAL.woodDark, { capsule: false, seg: 5 });
  }
  b.add(shapes.lathe([[0.001, 0], [0.38, 0], [0.44, 0.12], [0.46, 0.25], [0.44, 0.38], [0.38, 0.5], [0.001, 0.5]], 10), PAL.lacquer, { p: [3.0, 0.48, -4.6] });
  b.add(shapes.cylinder(0.37, 0.37, 0.02, 10), 0xf0dcb0, { p: [3.0, 0.99, -4.6] });
  b.limb([2.75, 1.02, -4.7], [3.2, 1.02, -4.48], 0.02, PAL.woodLight);
  block(kit, 2.5, -5.1, 3.5, -4.1, 1.1);

  const colors = lanternColors(rand);
  lanternRow(kit, [-3.9, -2.3, 2.3, 3.9], () => roofAt(0.45) - 0.15, 0.45, colors.includes(PAL.lanterns[0]) ? colors : [PAL.lanterns[0], ...colors]);
  for (const x of [-0.65, 0.65]) silkLantern(kit, x, 3.4, innerZ - 0.1, PAL.lanterns[0]);
  for (const side of [-1, 1]) bonsai(kit, side * 2.3, 0.75);

  block(kit, -W / 2, -D, -W / 2 + T + 0.08, 0.12);
  block(kit, W / 2 - T - 0.08, -D, W / 2, 0.12);
  block(kit, -W / 2, -D, W / 2, -D + T + 0.08);
  return {
    group: assemble(kit),
    obstacles: kit.obstacles,
    desk: { x: 0, z: -2.95 },
    chief: { x: 0, z: -4.75, facing: 0 },
    plaque: { x: 0, y: 3.0, z: frontZ + 0.1 },
  };
}

function abacus(kit, x, y, z) {
  const b = kit.body;
  b.add(shapes.box(0.5, 0.03, 0.26), PAL.woodDark, { p: [x, y + 0.015, z] });
  for (const dz of [-0.12, 0.12]) b.add(shapes.box(0.5, 0.04, 0.03), PAL.woodDark, { p: [x, y + 0.05, z + dz] });
  b.add(shapes.box(0.5, 0.04, 0.02), PAL.woodDark, { p: [x, y + 0.05, z - 0.04] });
  for (let i = 0; i < 7; i++) {
    const rx = x - 0.21 + i * 0.07;
    b.add(shapes.cylinder(0.006, 0.006, 0.24, 4), PAL.bronze, { p: [rx, y + 0.05, z], r: [Math.PI / 2, 0, 0] });
    for (const dz of [-0.08, 0.02, 0.05, 0.08]) b.add(shapes.sphere(0.022, 6, 4), PAL.lacquer, { p: [rx, y + 0.05, z + dz], s: [1, 0.7, 1] });
  }
}

function coinStack(kit, x, y, z, count) {
  for (let i = 0; i < count; i++) kit.body.add(shapes.cylinder(0.045, 0.045, 0.014, 10), PAL.gold, { p: [x, y + 0.007 + i * 0.016, z] });
}

function strongbox(kit, x, z, w, h) {
  const b = kit.body;
  b.add(shapes.box(w, h, 0.6), 0x3a3a40, { p: [x, h / 2, z] });
  b.add(shapes.box(w - 0.1, h - 0.1, 0.03), 0x4a4a52, { p: [x, h / 2, z + 0.31] });
  b.add(shapes.cylinder(0.09, 0.09, 0.04, 12), PAL.gold, { p: [x + w * 0.18, h * 0.55, z + 0.33], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.box(0.04, 0.22, 0.04), PAL.gold, { p: [x - w * 0.2, h * 0.55, z + 0.33] });
  for (const dy of [0.12, h - 0.12]) b.add(shapes.box(w + 0.02, 0.05, 0.62), 0x2a2a2e, { p: [x, dy, z] });
}

function coinGeometry(r, hole, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r, 0, Math.PI * 2, false);
  const square = new THREE.Path();
  square.moveTo(-hole, -hole);
  square.lineTo(-hole, hole);
  square.lineTo(hole, hole);
  square.lineTo(hole, -hole);
  square.lineTo(-hole, -hole);
  shape.holes.push(square);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function giantCoin(kit, x, y, z, r) {
  const b = kit.body;
  const hole = r * 0.26;
  b.add(coinGeometry(r, hole, 0.1), PAL.gold, { p: [x, y, z] });
  b.add(shapes.torus(r - 0.04, 0.035, 28), shade(PAL.gold, 0.78), { p: [x, y, z + 0.05] });
  for (const side of [-1, 1]) {
    b.add(shapes.box(2 * hole + 0.1, 0.05, 0.04), shade(PAL.gold, 0.78), { p: [x, y + side * (hole + 0.025), z + 0.06] });
    b.add(shapes.box(0.05, 2 * hole, 0.04), shade(PAL.gold, 0.78), { p: [x + side * (hole + 0.025), y, z + 0.06] });
  }
}

function coinFrame(kit, x, z, r) {
  const b = kit.body;
  const y = r + 0.45;
  const top = y + r + 0.2;
  for (const side of [-1, 1]) {
    b.add(shapes.box(0.12, top, 0.12), PAL.lacquer, { p: [x + side * (r + 0.14), top / 2, z] });
    b.add(shapes.box(0.3, 0.12, 0.4), PAL.woodDark, { p: [x + side * (r + 0.14), 0.06, z] });
  }
  b.add(shapes.box(2 * r + 0.5, 0.12, 0.14), PAL.lacquer, { p: [x, top, z] });
  b.add(shapes.box(2 * r + 0.3, 0.1, 0.12), PAL.lacquer, { p: [x, 0.35, z] });
  b.limb([x, top, z], [x, y + r, z], 0.015, PAL.ink, { capsule: false, seg: 4 });
  giantCoin(kit, x, y, z, r);
}

function eaveTip(kit, x, y, z, side) {
  const b = kit.body;
  b.limb([x, y, z], [x + side * 0.32, y + 0.42, z + 0.22], 0.06, PAL.ridge, { capsule: false, seg: 5 });
  b.add(shapes.sphere(0.075, 8, 6), PAL.ridge, { p: [x + side * 0.33, y + 0.45, z + 0.23] });
}

function pentRoof(kit, { x0, x1, zWall, eaveY, run, tint }) {
  const slope = 0.42;
  const ridgeY = eaveY + run * slope;
  roofPitch(kit, { x0, x1, ridgeZ: zWall, ridgeY, run, slope, facing: 1, tint, tileEnds: true });
  kit.body.add(shapes.box(x1 - x0, 0.14, 0.22), PAL.ridge, { p: [(x0 + x1) / 2, ridgeY + 0.05, zWall + 0.06] });
  for (const [x, side] of [[x0, -1], [x1, 1]]) eaveTip(kit, x, eaveY, zWall + run, side);
}

export function createBank({ seed = 1, width = 8.4, depth = 8 } = {}) {
  const kit = createKit(seed);
  const b = kit.body;
  const W = width;
  const D = depth;
  const half = W / 2;
  const T = 0.25;
  const lip = 0.24;
  const wall = 0xd9a441;
  const wood = 0x5a1a12;
  const roofTint = PAL.roofTints[2];
  const front = -0.5;
  const facade = -1.7;
  const hallBack = -4.6;
  const floors = [3.8, 2.8, 2.6];
  const levels = floors.reduce((list, h) => [...list, list[list.length - 1] + h], [0]);
  const wallTop = levels[3];
  const g = floors[0];
  const inner = half - T;
  const posts = [-(inner - 0.15), -1.4, 1.4, inner - 0.15];
  const slope = 0.5;

  const ridgeZ = (front - D) / 2;
  const ridgeY = wallTop + ((front + D) / 2) * slope;
  for (const side of [-1, 1]) gableWall(kit, wall, side * (half - T / 2), front, -D, wallTop + lip, ridgeY + lip, T);
  const roof = { x0: -half - 0.1, x1: half + 0.1, ridgeZ, ridgeY, slope, tint: roofTint };
  const run = (front + D) / 2 + 1.0;
  roofPitch(kit, { ...roof, run, facing: 1, tileEnds: true });
  roofPitch(kit, { ...roof, run: (front + D) / 2 + 0.3, facing: -1 });
  ridgeCrest(kit, -half + T, half - T, ridgeZ, ridgeY, 'dragons');
  for (const [x, side] of [[-half - 0.1, -1], [half + 0.1, 1]]) eaveTip(kit, x, ridgeY - run * slope, ridgeZ + run, side);
  plaster(kit, wall, W - 2 * T, wallTop, T, 0, wallTop / 2, -D + T / 2);

  const plinth = 0.15;
  const porchFront = front + 0.15;
  b.add(shapes.box(W, plinth, 0.25), PAL.stoneDark, { p: [0, plinth / 2, porchFront + 0.125] });
  b.add(shapes.box(W - 2 * T, plinth, porchFront - facade), PAL.stone, { p: [0, plinth / 2, (porchFront + facade) / 2] });
  b.add(shapes.box(W - 2 * T, plinth, facade - hallBack), 0xb0583a, { p: [0, plinth / 2, (facade + hallBack) / 2] });
  b.add(shapes.box(W - 2 * T, 0.14, front - hallBack), wood, { p: [0, g - 0.07, (front + hallBack) / 2] });
  plaster(kit, wall, W - 2 * T, g, T, 0, g / 2, hallBack - T / 2);

  for (const x of posts) lacquerColumn(kit, x, front, g, plinth);
  b.add(shapes.box(W - 2 * T, 0.3, 0.3), PAL.lacquer, { p: [0, g - 0.15, front] });
  b.add(shapes.box(W - 2 * T, 0.05, 0.32), PAL.gold, { p: [0, g - 0.32, front] });
  for (const x of posts) {
    for (const side of [-1, 1]) {
      if (Math.abs(x + side * 0.5) > inner) continue;
      b.limb([x, g - 0.95, front], [x + side * 0.45, g - 0.3, front], 0.05, PAL.lacquer, { capsule: false, seg: 4 });
    }
  }

  const door = 1.2;
  b.add(shapes.box(2 * door, g - 2.9, 0.12), wood, { p: [0, (2.9 + g) / 2, facade] });
  for (const side of [-1, 1]) {
    b.add(shapes.box(0.2, g, 0.2), wood, { p: [side * door, g / 2, facade] });
    const x0 = side < 0 ? -inner : door + 0.1;
    const x1 = side < 0 ? -door - 0.1 : inner;
    plankPanel(kit, x0, x1, 0.04, 1.0, facade, wood);
    lattice(kit, x0, x1, 1.0, 2.7, facade + 0.03);
    b.add(shapes.box(x1 - x0, g - 2.7, 0.1), wood, { p: [(x0 + x1) / 2, (2.7 + g) / 2, facade] });
  }
  b.add(shapes.box(2 * door + 0.4, 0.06, 0.4), PAL.stoneDark, { p: [0, plinth + 0.03, facade] });

  textSign(kit, 0, g - 0.78, front + 0.2, 2.5, 0.64, { text: 'Tiền Trang', bg: PAL.ink, fg: PAL.gold });
  const couplets = [['Tài', 'Nguyên', 'Quảng', 'Tiến'], ['Lợi', 'Tức', 'Hưng', 'Long']];
  for (const [k, side] of [-1, 1].entries()) {
    textSign(kit, side * 1.4, 1.7, front + 0.2, 0.32, 1.8, { text: couplets[k], vertical: true, bg: PAL.ink, fg: PAL.gold });
  }
  for (const side of [-1, 1]) {
    const x = side * (1.4 + posts[3]) / 2;
    coinFrame(kit, x, (front + facade) / 2, 0.62);
    silkLantern(kit, x, g - 0.32, front + 0.1, PAL.lanterns[0], 1.3);
  }

  const counterZ = facade - 0.6;
  const counterW = 2 * door + 0.4;
  b.add(shapes.box(counterW, 0.72, 0.5), PAL.wood, { p: [0, 0.36, counterZ] });
  b.add(shapes.box(counterW + 0.1, 0.05, 0.6), PAL.woodDark, { p: [0, 0.745, counterZ] });
  for (const x of [-0.85, 0, 0.85]) b.add(shapes.box(0.6, 0.4, 0.03), PAL.lacquer, { p: [x, 0.38, counterZ + 0.26] });
  const barZ = counterZ + 0.22;
  for (let x = -counterW / 2 + 0.1; x <= counterW / 2 - 0.09; x += 0.14) {
    if (Math.abs(x) < 0.28) continue;
    b.add(shapes.cylinder(0.014, 0.014, 0.8, 6), PAL.bronze, { p: [x, 1.17, barZ] });
  }
  b.add(shapes.box(counterW, 0.05, 0.08), PAL.bronze, { p: [0, 1.59, barZ] });
  b.add(shapes.torus(0.27, 0.025, 10, Math.PI), PAL.bronze, { p: [0, 1.05, barZ] });
  abacus(kit, -0.8, 0.77, counterZ);
  coinStack(kit, 0.7, 0.77, counterZ, 5);
  coinStack(kit, 0.84, 0.77, counterZ + 0.07, 3);
  b.add(shapes.box(0.36, 0.03, 0.26), PAL.cream, { p: [0.2, 0.785, counterZ], r: [0, 0.15, 0] });
  strongbox(kit, -2.3, hallBack + 0.45, 1.0, 1.3);
  strongbox(kit, 2.3, hallBack + 0.45, 1.0, 1.3);
  textSign(kit, 0, 2.5, hallBack + 0.02, 1.6, 0.48, { text: 'Tín Nghĩa' });

  for (const [i, h] of floors.entries()) {
    if (i === 0) continue;
    const y0 = levels[i];
    plaster(kit, wall, W - 2 * T, h, T, 0, y0 + h / 2, front - T / 2);
    for (const x of posts) b.add(shapes.box(0.2, h, 0.16), wood, { p: [x, y0 + h / 2, front + 0.06] });
    b.add(shapes.box(W - 2 * T, 0.16, 0.18), wood, { p: [0, y0 + h - 0.1, front + 0.06] });
    pentRoof(kit, { x0: -half - 0.15, x1: half + 0.15, zWall: front, eaveY: y0 - 0.05, run: 1.1, tint: roofTint });
    const sides = [[-posts[3] + 0.2, -1.6], [1.6, posts[3] - 0.2]];
    if (i === 1) {
      lattice(kit, -1.2, 1.2, y0 + 0.75, y0 + 2.25, front + 0.06);
      for (const [x0, x1] of sides) lattice(kit, x0, x1, y0 + 0.9, y0 + 2.1, front + 0.06);
      const railZ = front + 0.3;
      for (const y of [y0 + 0.55, y0 + 0.95]) b.add(shapes.box(W - 2 * T, 0.06, 0.06), PAL.lacquer, { p: [0, y, railZ] });
      for (let x = -inner + 0.1; x <= inner - 0.05; x += 0.22) b.add(shapes.box(0.04, 0.4, 0.04), PAL.lacquer, { p: [x, y0 + 0.75, railZ] });
      for (const side of [-1, 1]) silkLantern(kit, side * 2.6, levels[2] - 0.1, front + 0.85, PAL.lanterns[1], 1.1);
    } else {
      giantCoin(kit, 0, y0 + 1.3, front + 0.1, 0.6);
      for (const [x0, x1] of sides) lattice(kit, x0, x1, y0 + 0.7, y0 + 1.9, front + 0.06);
    }
  }
  for (const side of [-1, 1]) bonsai(kit, side * (half - 0.55), 0.35);

  block(kit, -half, -D, half, 0.1, 3.2);
  return {
    group: assemble(kit),
    obstacles: kit.obstacles,
    door: { x: 0, z: 0.85 },
    teller: { x: 0, y: plinth, z: counterZ - 0.65, facing: 0 },
  };
}

const FISH_TONES = [0xa8b0a0, 0x7a8a3a, 0x8a96a0, 0x6a7078, 0xc0a070];

function fishShape(kit, x, y, z, len, color, rotation = [0, 0, 0]) {
  const b = kit.body;
  b.group([x, y, z], rotation, () => {
    b.add(shapes.sphere(len * 0.5, 8, 6), color, { s: [0.32, 0.42, 1], flat: true });
    b.add(shapes.cone(len * 0.2, len * 0.28, 4), shade(color, 0.78), { p: [0, 0, -len * 0.6], r: [Math.PI / 2, 0, 0], s: [0.22, 1, 1], flat: true });
    b.add(shapes.cone(len * 0.08, len * 0.18, 4), shade(color, 0.85), { p: [0, len * 0.2, -len * 0.05], s: [0.2, 1, 1.6], flat: true });
    for (const side of [-1, 1]) b.add(shapes.sphere(len * 0.045, 5, 4), PAL.ink, { p: [side * len * 0.15, len * 0.05, len * 0.34] });
  });
}

function thatchSlope(kit, width, ridgeZ, ridgeY, run, rise, facing) {
  const b = kit.body;
  const len = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  b.group([0, ridgeY - rise / 2, ridgeZ + (facing * run) / 2], [facing * angle, 0, 0], () => {
    b.add(shapes.box(width, 0.2, len), PAL.straw);
    for (let k = -len / 2 + 0.3; k < len / 2; k += 0.45) b.add(shapes.box(width + 0.04, 0.07, 0.14), shade(PAL.straw, 0.82), { p: [0, 0.12, k * facing] });
    b.add(shapes.box(width + 0.06, 0.1, 0.16), shade(PAL.straw, 0.7), { p: [0, 0, (facing * len) / 2] });
  });
}

function fishNet(kit, x, z0, z1, y0, y1) {
  const b = kit.body;
  const color = 0x8a7a5a;
  for (const z of [z0, z1]) b.limb([x, 0, z], [x, y1 + 0.1, z], 0.035, PAL.woodLight, { capsule: false, seg: 5 });
  b.limb([x, y1, z0], [x, y1, z1], 0.03, PAL.woodLight, { capsule: false, seg: 5 });
  const cols = 7;
  const rows = 6;
  for (let i = 0; i <= cols; i++) {
    const z = z0 + ((z1 - z0) * i) / cols;
    b.limb([x, y1, z], [x, y0 + Math.sin((i / cols) * Math.PI) * -0.15, z + 0.05], 0.008, color, { capsule: false, seg: 3 });
  }
  for (let j = 1; j <= rows; j++) {
    const y = y1 - ((y1 - y0) * j) / rows;
    b.limb([x, y, z0], [x, y - 0.06, z1], 0.008, color, { capsule: false, seg: 3 });
  }
  for (let i = 1; i < 5; i++) b.add(shapes.sphere(0.05, 6, 4), 0xd9d2c0, { p: [x, y0 + 0.02, z0 + ((z1 - z0) * i) / 5] });
}

function fishTub(kit, x, z) {
  const b = kit.body;
  const rand = kit.rand;
  b.add(shapes.cylinder(0.46, 0.38, 0.42, 12), PAL.woodMid, { p: [x, 0.21, z] });
  for (const y of [0.08, 0.34]) b.add(shapes.torus(0.43, 0.025, 12), PAL.woodDark, { p: [x, y, z], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.cylinder(0.42, 0.42, 0.02, 12), 0x4f8fb9, { p: [x, 0.39, z] });
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    fishShape(kit, x + Math.cos(a) * 0.18, 0.41, z + Math.sin(a) * 0.18, 0.32, pick(rand, FISH_TONES), [0.15, a, 0]);
  }
  block(kit, x - 0.48, z - 0.48, x + 0.48, z + 0.48, 0.5);
}

export function createFishShop({ seed = 1 } = {}) {
  const kit = createKit(seed);
  const { rand, body: b } = kit;
  const W = 7;
  const D = 5.5;
  const eave = 2.5;
  const ridge = 3.65;
  const overhang = 0.75;
  const half = W / 2;

  b.add(shapes.box(W, 0.12, D), PAL.stone, { p: [0, 0.06, -D / 2] });
  for (let x = -half + 0.5; x < half; x += 1) b.add(shapes.box(0.04, 0.005, D - 0.1), PAL.stoneDark, { p: [x, 0.123, -D / 2] });

  for (const x of [-half + 0.15, half - 0.15]) {
    for (const z of [-0.15, -D + 0.15]) b.limb([x, 0.12, z], [x, eave, z], 0.09, PAL.woodMid, { capsule: false, seg: 6 });
    b.limb([x, 0.12, -D / 2], [x, ridge, -D / 2], 0.08, PAL.woodMid, { capsule: false, seg: 6 });
  }
  for (const z of [-0.15, -D + 0.15]) b.add(shapes.box(W, 0.14, 0.14), PAL.wood, { p: [0, eave - 0.05, z] });
  b.add(shapes.box(W + 0.2, 0.14, 0.16), PAL.woodDark, { p: [0, ridge, -D / 2] });

  plankPanel(kit, -half + 0.1, half - 0.1, 0.12, eave - 0.12, -D + 0.1, PAL.woodMid);
  for (const side of [-1, 1]) {
    const x = side * (half - 0.08);
    b.add(shapes.box(0.12, 1.1, D - 0.3), PAL.woodMid, { p: [x, 0.67, -D / 2] });
    b.add(shapes.box(0.16, 0.08, D - 0.2), PAL.woodDark, { p: [x, 1.24, -D / 2] });
  }

  const run = D / 2 + overhang;
  thatchSlope(kit, W + 0.9, -D / 2, ridge + 0.12, run, ridge - eave + 0.35, 1);
  thatchSlope(kit, W + 0.9, -D / 2, ridge + 0.12, run, ridge - eave + 0.35, -1);
  b.add(shapes.cylinder(0.14, 0.14, W + 0.95, 8), shade(PAL.straw, 0.75), { p: [0, ridge + 0.22, -D / 2], r: [0, 0, Math.PI / 2] });
  fishShape(kit, 0, ridge + 0.75, -D / 2, 1.5, 0xd8481e, [0, Math.PI / 2, 0.12]);
  for (const side of [-1, 1]) fishShape(kit, side * (half + 0.3), ridge + 0.4, -D / 2, 0.6, PAL.gold, [-0.5, side * Math.PI / 2, 0]);

  b.add(shapes.box(4.4, 0.8, 0.7), PAL.wood, { p: [0, 0.52, -0.6] });
  b.add(shapes.box(4.6, 0.07, 0.82), PAL.woodLight, { p: [0, 0.95, -0.6] });
  for (let i = 0; i < 4; i++) {
    const x = -1.65 + i * 1.1;
    b.add(shapes.box(0.95, 0.015, 0.6), i % 2 ? PAL.leaf : PAL.leafDark, { p: [x, 0.995, -0.6], r: [0, (rand() - 0.5) * 0.3, 0] });
    for (let k = 0; k < 2; k++) fishShape(kit, x + (k - 0.5) * 0.35, 1.04, -0.6 + (rand() - 0.5) * 0.12, 0.42 + rand() * 0.15, pick(rand, FISH_TONES), [0, Math.PI / 2 + (rand() - 0.5) * 0.4, Math.PI / 2]);
  }
  block(kit, -2.3, -0.95, 2.3, -0.25, 1.1);

  for (const side of [-1, 1]) {
    const x0 = side * 1.05;
    const x1 = side * (half - 0.2);
    b.limb([x0, eave - 0.2, 0.25], [x1, eave - 0.2, 0.25], 0.025, PAL.woodLight, { capsule: false, seg: 5 });
    for (let x = Math.min(x0, x1) + 0.25; x < Math.max(x0, x1) - 0.1; x += 0.42) {
      b.limb([x, eave - 0.2, 0.25], [x, eave - 0.42, 0.25], 0.006, PAL.ink, { capsule: false, seg: 3 });
      fishShape(kit, x, eave - 0.66, 0.25, 0.42, shade(0xb08a5a, 0.85 + rand() * 0.25), [Math.PI / 2, rand() * 0.6, 0]);
    }
  }

  fishTub(kit, -half + 0.35, 0.75);
  fishTub(kit, half - 0.35, 0.75);
  produceBasket(kit, -2.6, 0.12, -2.2, 0.36, FISH_TONES);
  produceBasket(kit, -2.0, 0.12, -2.9, 0.3, FISH_TONES);
  clayJar(kit, 2.5, 0.12, -2.4, 0.9, 0x5a4a3a);
  clayJar(kit, 2.9, 0.12, -3.3, 0.75, 0x6a5040);
  block(kit, -3.0, -3.25, -1.65, -1.8, 1);
  block(kit, 2.1, -3.7, 3.25, -2.0, 1);
  fishNet(kit, half + 0.2, -D + 0.6, -1.2, 0.5, 2.2);

  lanternRow(kit, [-2.6, 2.6], () => eave - 0.08, 0.4, [0xd8321e, 0xf2b630]);

  block(kit, -half, -D, half, -D + 0.25);
  block(kit, -half, -D, -half + 0.25, -0.05, 1.3);
  block(kit, half - 0.25, -D, half, -0.05, 1.3);
  block(kit, half, -D + 0.5, half + 0.35, -1.1, 2.3);
  return {
    group: assemble(kit),
    obstacles: kit.obstacles,
    counter: { x: 0, z: 0.35 },
    keeper: { x: 0, z: -1.5, facing: 0 },
    plaque: { x: 0, y: 2.0, z: 0.32 },
  };
}
