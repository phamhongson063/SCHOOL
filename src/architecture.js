import * as THREE from 'three';
import { Batch, shapes, shade, toonMaterial, vertexMaterial, canvasTexture } from './toon.js';
import { makeRandom } from './random.js';

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
const between = (rand, a, b) => a + rand() * (b - a);

const shared = { plaster: null, roof: null, lantern: null, glass: null };
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

function plasterMaterial() {
  shared.plaster ??= toonMaterial({ map: plasterTexture(), vertexColors: true });
  return shared.plaster;
}

function roofMaterial() {
  shared.roof ??= toonMaterial({ map: tileTexture(), vertexColors: true, shadowSide: THREE.DoubleSide });
  return shared.roof;
}

function applyGlow() {
  if (shared.lantern) shared.lantern.emissiveIntensity = glowLevel * 1.1;
  if (shared.glass) shared.glass.emissiveIntensity = glowLevel * 0.85;
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

function texturedBox(w, h, d) {
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

function pottedPlant(kit, x, z, kind) {
  const b = kit.body;
  const rand = kit.rand;
  if (kind === 0) {
    b.add(shapes.lathe([[0.001, 0], [0.18, 0], [0.26, 0.3], [0.3, 0.36], [0.26, 0.38], [0.001, 0.38]], 8), PAL.pot, { p: [x, 0, z], flat: true });
    b.add(shapes.cylinder(0.24, 0.24, 0.02, 8), PAL.soil, { p: [x, 0.36, z] });
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
  b.add(shapes.cylinder(0.23, 0.23, 0.02, 8), PAL.soil, { p: [x, 0.41, potZ] });
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
  const slope = between(rand, 0.48, 0.58);
  const T = 0.25;
  const P = 0.42;
  const lip = 0.22;
  const groundH = levels === 2 ? between(rand, 3.2, 3.4) : between(rand, 3.6, 3.9);
  const upperH = between(rand, 2.55, 2.85);
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
  b.add(shapes.box(db + 0.5, 0.16, 0.5), PAL.stone, { p: [0, 0.08, 0.27] });

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
  const potX = db / 2 + 0.42;
  pottedPlant(kit, -potX, 0.5, Math.floor(rand() * 4));
  if (rand() < 0.75) pottedPlant(kit, potX, 0.5, Math.floor(rand() * 4));

  block(kit, -W / 2, -D, W / 2, 0.1, 3.2);
  return { group: assemble(kit), obstacles: kit.obstacles, door: { x: 0, z: 0.85 }, plaque: { x: 0, y: PLAQUE_Y, z: 0.1 } };
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
  b.add(shapes.box(W - 2 * P, 0.05, 0.3), PAL.stoneDark, { p: [0, 0.025, 0.05] });
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

  b.add(shapes.box(2.4, 0.9, 0.55), PAL.woodMid, { p: [0, 0.45, -1.3] });
  b.add(shapes.box(2.5, 0.08, 0.62), PAL.woodDark, { p: [0, 0.04, -1.3] });
  b.add(shapes.box(2.56, 0.07, 0.7), PAL.woodDark, { p: [0, 0.935, -1.3] });
  for (const x of [-0.8, 0, 0.8]) b.add(shapes.box(0.66, 0.56, 0.03), PAL.wood, { p: [x, 0.48, -1.012] });
  b.add(shapes.box(0.3, 0.03, 0.18), PAL.woodDark, { p: [0.7, 0.985, -1.35] });
  b.add(shapes.cylinder(0.018, 0.018, 0.45, 6), PAL.bronze, { p: [0.7, 1.22, -1.35] });
  b.add(shapes.box(0.56, 0.025, 0.025), PAL.bronze, { p: [0.7, 1.44, -1.35] });
  for (const dx of [-0.26, 0.26]) {
    b.limb([0.7 + dx, 1.44, -1.35], [0.7 + dx, 1.2, -1.35], 0.006, PAL.ink, { capsule: false, seg: 4 });
    b.add(shapes.cylinder(0.11, 0.08, 0.03, 8), PAL.bronze, { p: [0.7 + dx, 1.19, -1.35] });
  }
  b.add(shapes.box(0.44, 0.03, 0.24), PAL.woodDark, { p: [-0.65, 0.985, -1.3] });
  for (let row = 0; row < 5; row++) {
    for (let k = 0; k < 5; k++) {
      b.add(shapes.box(0.05, 0.035, 0.03), k % 2 ? 0x8a2a1c : 0x3a2418, { p: [-0.83 + k * 0.09, 1.017, -1.39 + row * 0.045] });
    }
  }
  produceBasket(kit, 0.05, 0.97, -1.3, 0.16, PRODUCE.eggs);
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

function lacquerColumn(kit, x, z, height) {
  const b = kit.body;
  b.add(shapes.cylinder(0.22, 0.25, 0.16, 8), PAL.stone, { p: [x, 0.08, z], flat: true });
  b.add(shapes.cylinder(0.14, 0.15, height - 0.16, 8), PAL.lacquer, { p: [x, 0.16 + (height - 0.16) / 2, z] });
  b.add(shapes.cylinder(0.165, 0.165, 0.06, 8), PAL.gold, { p: [x, 0.22, z] });
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
  b.add(shapes.box(W - 2 * T, 0.03, 5.05), 0xb0583a, { p: [0, 0.015, -5.175] });

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
