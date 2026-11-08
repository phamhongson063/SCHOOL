import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, shapes, shade, toonMaterial, canvasTexture } from './toon.js';
import { makeRandom } from './random.js';
import { STAIRS, HOUSE, KHUE_VAN_CAC, STELES, ENCLOSURE, POND, VU, STELE_SHEDS, CROSS_WALLS, SIDE_GATES, THUONG_DIEN, HO_VAN } from './school.js';
import { ROAD } from './road.js';

const C = {
  stone: 0xc2b8a6,
  stoneDark: 0x9e9484,
  plaster: 0xf3dfa6,
  brick: 0xb85c3e,
  wood: 0x744628,
  woodDark: 0x553220,
  roofUnder: 0x3b2a20,
  ridge: 0x7a5a46,
  gold: 0xb8954e,
  teal: 0x7b7f6c,
  leaf: 0x5fae48,
  leafDark: 0x3f8a3a,
  leafLight: 0x86c75a,
  trunk: 0x7a5a3c,
  lacquer: 0x7a3020,
  lacquerDark: 0x5a2418,
  beam: 0x4a2c1e,
  ochre: 0xc9a46a,
  dado: 0x7d7266,
  pillar: 0xe2ddd2,
  stele: 0x9d9a90,
  steleInk: 0x6d675c,
  turtle: 0x82827a,
  terracotta: 0x9a4a36,
};

const UP = new THREE.Vector3(0, 1, 0);
const HALL_Z = HOUSE.back + 10;
const HALL_FRONT = HOUSE.front + 2;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

function blotchTexture(base, spots, repeat, seed) {
  return canvasTexture(
    256,
    (ctx, s) => {
      const rand = makeRandom(seed);
      ctx.fillStyle = css(base);
      ctx.fillRect(0, 0, s, s);
      for (const [hex, count, rMin, rMax] of spots) {
        ctx.fillStyle = css(hex);
        for (let i = 0; i < count; i++) {
          const x = rand() * s;
          const y = rand() * s;
          const r = rMin + rand() * (rMax - rMin);
          const a = rand() * Math.PI;
          for (const dx of [-s, 0, s]) {
            for (const dy of [-s, 0, s]) {
              ctx.beginPath();
              ctx.ellipse(x + dx, y + dy, r, r * 0.6, a, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    },
    repeat,
  );
}

function floorTexture(repeat) {
  return canvasTexture(
    256,
    (ctx, s) => {
      const rand = makeRandom(5);
      const n = 4;
      const t = s / n;
      ctx.fillStyle = '#6e4232';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const f = 0.92 + rand() * 0.14;
          ctx.fillStyle = css(shade(0x9c624a, f));
          ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(i * t + 4, j * t + 4, t - 8, 6);
        }
      }
    },
    repeat,
  );
}

function roofTexture() {
  return canvasTexture(128, (ctx, s) => {
    const cols = 4;
    const w = s / cols;
    for (let i = 0; i < cols; i++) {
      const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      g.addColorStop(0, '#5e3d2e');
      g.addColorStop(0.5, '#8c5e44');
      g.addColorStop(1, '#5e3d2e');
      ctx.fillStyle = g;
      ctx.fillRect(i * w, 0, w, s);
    }
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = 'rgba(30,18,10,0.45)';
      ctx.fillRect(0, j * (s / 4), s, 4);
    }
    const rand = makeRandom(23);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${70 + rand() * 30},${80 + rand() * 25},55,${0.15 + rand() * 0.2})`;
      ctx.fillRect(rand() * s, rand() * s, 2 + rand() * 6, 2 + rand() * 4);
    }
  });
}

export function roundedRectGeometry(x0, z0, x1, z1, r) {
  const s = new THREE.Shape();
  const ay = -z1;
  const by = -z0;
  s.moveTo(x0 + r, ay);
  s.lineTo(x1 - r, ay);
  s.quadraticCurveTo(x1, ay, x1, ay + r);
  s.lineTo(x1, by - r);
  s.quadraticCurveTo(x1, by, x1 - r, by);
  s.lineTo(x0 + r, by);
  s.quadraticCurveTo(x0, by, x0, by - r);
  s.lineTo(x0, ay + r);
  s.quadraticCurveTo(x0, ay, x0 + r, ay);
  const g = new THREE.ShapeGeometry(s, 6);
  g.rotateX(-Math.PI / 2);
  return g;
}

export function hipRoof({ cx, cz, hx, hz, ridge, eaveY, height, lift, thickness, rings, tile = 0.9, falloff = 5, curve = 1.3, jagged = 0, seed = 1 }) {
  const rand = makeRandom(seed);
  const sides = [
    [[-1, 1], [1, 1], 28],
    [[1, 1], [1, -1], 16],
    [[1, -1], [-1, -1], 28],
    [[-1, -1], [-1, 1], 16],
  ];
  const perRing = sides.reduce((n, s) => n + s[2], 0) + 1;
  const slope = Math.hypot(hz, height);
  const positions = [];
  const uvs = [];
  const corners = [[], [], [], []];

  for (let r = -1; r <= rings; r++) {
    const t = Math.max(0, r) / rings;
    const ex = hx - (hx - ridge) * t;
    const ez = hz * (1 - t);
    const y = eaveY + height * Math.pow(t, curve) - (r < 0 ? thickness : 0);
    const v = (r < 0 ? -thickness : t * slope) / tile;
    let arc = 0;
    let first = null;
    sides.forEach(([from, to, count], s) => {
      const len = s % 2 === 0 ? 2 * ex : 2 * ez;
      for (let k = 0; k < count; k++) {
        const u = k / count;
        const x = (from[0] + (to[0] - from[0]) * u) * ex;
        const z = (from[1] + (to[1] - from[1]) * u) * ez;
        const d = Math.min(u, 1 - u) * len;
        const curl = lift * Math.pow(1 - t, 3) * Math.pow(Math.max(0, 1 - d / falloff), 2);
        const fringe = r < 0 ? rand() * jagged : 0;
        const point = [cx + x, y + curl - fringe, cz + z];
        positions.push(...point);
        uvs.push(arc / tile, v);
        if (k === 0) {
          first ??= point;
          if (r >= 0) corners[s].push(v3(...point));
        }
        arc += len / count;
      }
    });
    positions.push(...first);
    uvs.push(arc / tile, v);
  }

  const indices = [];
  for (let r = 0; r < rings + 1; r++) {
    for (let p = 0; p < perRing - 1; p++) {
      const a = r * perRing + p;
      const c = a + perRing;
      indices.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indexed.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, corners, cx, cz, ridge, ridgeY: eaveY + height, eaveY, height, hz, curve };
}

let tileMaterials = null;

export function tileRoofMeshes(options) {
  tileMaterials ??= [toonMaterial({ map: roofTexture(), shadowSide: THREE.DoubleSide }), toonMaterial({ color: C.roofUnder, side: THREE.BackSide })];
  const roof = hipRoof({ thickness: 0.15, rings: 8, tile: 0.9, curve: 1, ...options });
  return roofMeshes(roof.geometry, ...tileMaterials);
}

function roofMeshes(geometry, top, under) {
  const outer = new THREE.Mesh(geometry, top);
  outer.castShadow = true;
  outer.receiveShadow = true;
  const inner = new THREE.Mesh(geometry, under);
  return [outer, inner];
}

function hipRidges(b, roof, radius) {
  for (const points of roof.corners) {
    const eave = points[0];
    const out = v3(eave.x - roof.cx, 0, eave.z - roof.cz).normalize();
    const tip = eave.clone().addScaledVector(out, radius * 6).add(v3(0, radius * 6, 0));
    const mid = eave.clone().addScaledVector(out, radius * 3).add(v3(0, radius * 1.5, 0));
    const along = points.map((p) => p.clone().add(v3(0, radius * 0.8, 0)));
    b.add(shapes.tube([tip, mid, ...along], radius, 48), C.ridge);
    b.add(shapes.sphere(radius * 1.5, 8, 6), C.ridge, { p: tip.toArray() });
  }
}

function ridgeDecor(b, roof, { scale = 1, dragons = true } = {}) {
  const { cx, cz, ridge, ridgeY } = roof;
  const y = ridgeY + 0.12 * scale;
  b.add(shapes.rounded(ridge * 2 + 0.8 * scale, 0.45 * scale, 0.55 * scale, 0.1 * scale), C.ridge, { p: [cx, y, cz] });
  for (const side of [-1, 1]) {
    const ex = cx + side * (ridge + 0.3 * scale);
    b.add(
      shapes.tube(
        [v3(ex, y, cz), v3(ex + side * 0.25 * scale, y + 0.6 * scale, cz), v3(ex + side * 0.05 * scale, y + 1.1 * scale, cz), v3(ex - side * 0.3 * scale, y + 1.0 * scale, cz)],
        0.16 * scale,
        16,
      ),
      C.ridge,
    );
    if (!dragons) continue;
    b.add(
      shapes.tube(
        [v3(cx + side * 2.9, y + 0.2, cz), v3(cx + side * 2.2, y + 0.8, cz), v3(cx + side * 1.5, y + 0.35, cz), v3(cx + side * 0.85, y + 0.85, cz)],
        0.13,
        24,
      ),
      C.teal,
    );
    b.add(shapes.sphere(0.22, 10, 8), C.teal, { p: [cx + side * 0.8, y + 0.9, cz] });
  }
  b.add(shapes.sphere(0.38 * scale, 14, 10), C.gold, { p: [cx, y + 0.7 * scale, cz] });
  if (dragons) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const dir = v3(Math.cos(a), Math.sin(a), 0);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      b.add(shapes.cone(0.08, 0.3, 6), C.gold, { p: [cx + dir.x * 0.5, y + 0.7 + dir.y * 0.5, cz], q });
    }
  }
}

function brickTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = makeRandom(11);
    const rows = 8;
    const h = s / rows;
    const w = s / 4;
    ctx.fillStyle = '#cbbda2';
    ctx.fillRect(0, 0, s, s);
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 ? w / 2 : 0;
      for (let c = -1; c < 5; c++) {
        const x = c * w + offset;
        ctx.fillStyle = css(shade(0x8c4a34, 0.85 + rand() * 0.3));
        ctx.fillRect(x + 2, r * h + 2, w - 4, h - 4);
        ctx.fillStyle = 'rgba(255,220,190,0.1)';
        ctx.fillRect(x + 2, r * h + 2, w - 4, 3);
      }
    }
  });
}

function plasterTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = makeRandom(17);
    ctx.fillStyle = css(C.ochre);
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = rand() < 0.75 ? `rgba(150,95,30,${0.04 + rand() * 0.08})` : `rgba(255,240,200,${0.05 + rand() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(rand() * s, rand() * s, 4 + rand() * 22, 3 + rand() * 14, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function texturedBox(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  }
  return g;
}

function foundation(scene, b, clickables) {
  const material = toonMaterial({ map: brickTexture() });
  const depth = HALL_FRONT - HOUSE.foundationBack;
  const centerZ = (HALL_FRONT + HOUSE.foundationBack) / 2;
  const parts = [texturedBox(31, 1, depth).translate(0.5, 0.5, centerZ)];
  const { x0, x1, top, count, rise, tread, cheek, post } = STAIRS;
  const width = x1 - x0;
  const cx = (x0 + x1) / 2;
  for (let k = 1; k <= count; k++) {
    const stepDepth = (count + 1 - k) * tread;
    parts.push(texturedBox(width, k * rise, stepDepth).translate(cx, (k * rise) / 2, top + stepDepth / 2));
  }
  const body = new THREE.Mesh(mergeGeometries(parts, false), material);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);
  clickables.push(body);

  const TREAD = 0xd3cab9;
  const COPING = 0xddd4c4;
  b.add(shapes.box(31.3, 0.18, depth + 0.3), C.stoneDark, { p: [0.5, 0.09, centerZ] });
  b.add(shapes.rounded(31.2, 0.14, 0.42, 0.03), COPING, { p: [0.5, 0.94, HALL_FRONT - 0.15] });
  b.add(shapes.rounded(31.2, 0.14, 0.42, 0.03), COPING, { p: [0.5, 0.94, HOUSE.foundationBack + 0.15] });
  for (const x of [-14.85, 15.85]) b.add(shapes.rounded(0.42, 0.14, depth + 0.2, 0.03), COPING, { p: [x, 0.94, centerZ] });

  for (let k = 1; k <= count; k++) {
    const front = top + (count + 1 - k) * tread;
    b.add(shapes.rounded(width + 0.06, 0.05, tread + 0.05, 0.015), TREAD, { p: [cx, k * rise - 0.02, front - tread / 2 + 0.02] });
  }

  const run = count * tread;
  const profile = new THREE.Shape();
  profile.moveTo(0, 0);
  profile.lineTo(run, 0);
  profile.lineTo(run, 0.5);
  profile.lineTo(0.12, 1.12);
  profile.lineTo(0, 1.12);
  profile.closePath();
  const extrude = { depth: cheek - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 };
  for (const [x, side] of [[x0 - 0.04, -1], [x1 + cheek - 0.04, 1]]) {
    b.add(new THREE.ExtrudeGeometry(profile, extrude), C.stone, { p: [x, 0, top], r: [0, -Math.PI / 2, 0] });
    const px = side < 0 ? x0 - cheek / 2 : x1 + cheek / 2;
    const pz = top + run + post / 2;
    b.add(shapes.rounded(post, 0.62, post, 0.04), C.stone, { p: [px, 0.31, pz] });
    b.add(shapes.rounded(post + 0.08, 0.07, post + 0.08, 0.02), COPING, { p: [px, 0.655, pz] });
    b.add(shapes.sphere(0.15, 14, 10), COPING, { p: [px, 0.83, pz] });
  }
}

const TIE_Y = 6.6;

function house(b, walls) {
  const { back, front, midColumn, windows } = HOUSE;
  const backZ = back + 0.5;
  const frontZ = front + 0.5;
  const sideStart = back + 1;
  const sideEnd = front;
  const centerZ = (backZ + frontZ) / 2;
  const span = frontZ - backZ + 0.6;
  const T = 0.2;
  const panel = (w, h, d, x, y, z) => walls.push(texturedBox(w, h, d, 3).translate(x, y, z));

  panel(27, 4.5, T, 0.5, 3.75, backZ);
  b.add(shapes.box(27, 0.5, T + 0.06), C.dado, { p: [0.5, 1.25, backZ] });
  b.add(shapes.box(27, 0.18, T + 0.08), C.beam, { p: [0.5, 5.9, backZ] });

  for (const x of [-13.5, 14.5]) {
    let z = sideStart;
    for (const [z0, z1] of windows) {
      panel(T, 4.5, z0 - z, x, 3.75, (z + z0) / 2);
      panel(T, 1.5, z1 - z0, x, 2.25, (z0 + z1) / 2);
      panel(T, 1, z1 - z0, x, 5.5, (z0 + z1) / 2);
      const zc = (z0 + z1) / 2;
      for (const y of [3, 5]) b.add(shapes.box(T + 0.16, 0.16, z1 - z0 + 0.16), C.lacquer, { p: [x, y, zc] });
      for (const zz of [z0, z1]) b.add(shapes.box(T + 0.16, 2.16, 0.16), C.lacquer, { p: [x, 4, zz] });
      for (let zz = z0 + 0.3; zz < z1 - 0.1; zz += 0.3) b.add(shapes.box(0.08, 2, 0.08), C.lacquerDark, { p: [x, 4, zz] });
      z = z1;
    }
    panel(T, 4.5, sideEnd - z, x, 3.75, (z + sideEnd) / 2);
    b.add(shapes.box(T + 0.06, 0.5, sideEnd - sideStart), C.dado, { p: [x, 1.25, (sideStart + sideEnd) / 2] });
    b.add(shapes.box(T + 0.08, 0.18, sideEnd - sideStart), C.beam, { p: [x, 5.9, (sideStart + sideEnd) / 2] });
  }

  const columns = [];
  for (const x of [-13.5, -4.5, 5.5, 14.5]) columns.push([x, backZ], [x, frontZ]);
  columns.push([-13.5, midColumn + 0.5], [14.5, midColumn + 0.5]);
  for (const [x, z] of columns) {
    b.add(shapes.cylinder(0.42, 0.48, 0.26, 14), C.stone, { p: [x, 1.13, z] });
    b.add(shapes.cylinder(0.25, 0.28, 5.1, 16), C.lacquer, { p: [x, 3.81, z] });
    b.add(shapes.cylinder(0.3, 0.3, 0.1, 16), C.gold, { p: [x, 6.05, z] });
  }

  for (const z of [backZ, frontZ]) b.add(shapes.box(29.6, 0.42, 0.36), C.beam, { p: [0.5, 6.35, z] });
  for (const x of [-13.5, 14.5, -4.5, 5.5]) b.add(shapes.box(0.36, 0.42, span), C.beam, { p: [x, 6.35, centerZ] });

  const posts = [-13.5, -4.5, 5.5, 14.5];
  const z = frontZ + 0.05;
  for (let k = 0; k < posts.length - 1; k++) {
    const x0 = posts[k] + 0.3;
    const x1 = posts[k + 1] - 0.3;
    const cx = (x0 + x1) / 2;
    for (const y of [5.45, 6.05]) b.add(shapes.box(x1 - x0, 0.1, 0.12), C.lacquer, { p: [cx, y, z] });
    for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.4) {
      b.add(shapes.box(0.05, 0.62, 0.06), C.gold, { p: [x, 5.75, z], r: [0, 0, 0.5] });
      b.add(shapes.box(0.05, 0.62, 0.06), C.gold, { p: [x, 5.75, z], r: [0, 0, -0.5] });
    }
    for (const side of [-1, 1]) {
      const x = side < 0 ? x0 : x1;
      b.add(shapes.box(0.6, 0.1, 0.12), C.lacquer, { p: [x - side * 0.22, 5.2, z], r: [0, 0, side * 0.7] });
    }
  }

  const gableTop = 7.2;
  const gableH = gableTop - 6.55;
  panel(29.6, gableH, 0.1, 0.5, 6.55 + gableH / 2, frontZ + 0.3);
  panel(29.6, gableH, 0.1, 0.5, 6.55 + gableH / 2, backZ - 0.3);
  for (const x of [-13.8, 14.8]) panel(0.1, gableH, span, x, 6.55 + gableH / 2, centerZ);
}

function trusses(b, roof) {
  const yAt = (d) => roof.eaveY + roof.height * Math.pow(Math.max(0, 1 - d / roof.hz), roof.curve);
  const top = yAt(0) - 0.45;
  const beam = HOUSE.front + 0.5 - roof.cz;
  for (const x of [-4.5, 5.5]) {
    for (const side of [-1, 1]) {
      const rafter = beam + 0.6;
      b.limb([x, yAt(rafter) - 0.35, roof.cz + side * rafter], [x, top, roof.cz], 0.17, C.beam, { capsule: false, seg: 6 });
      b.limb([x, TIE_Y, roof.cz + side * beam], [x, yAt(beam) - 0.35, roof.cz + side * beam], 0.15, C.beam, { capsule: false, seg: 6 });
      b.limb([x, TIE_Y, roof.cz + side * beam * 0.5], [x, yAt(beam * 0.5) - 0.35, roof.cz + side * beam * 0.5], 0.12, C.beam, {
        capsule: false,
        seg: 6,
      });
    }
    b.limb([x, TIE_Y, roof.cz], [x, top, roof.cz], 0.18, C.beam, { capsule: false, seg: 6 });
  }
}

function tiledRoof(options) {
  return hipRoof({ thickness: 0.14, rings: 6, tile: 0.9, curve: 1, ...options });
}

function roundWindow(b, x, y, z, rotY) {
  b.group([x, y, z], [0, rotY, 0], () => {
    b.add(shapes.cylinder(0.56, 0.56, 0.04, 24), 0x2a1810, { p: [0, 0, 0], r: [Math.PI / 2, 0, 0] });
    b.add(shapes.torus(0.6, 0.07, 24), C.gold, { p: [0, 0, 0.02] });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.limb([0, 0, 0.03], [Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0.03], 0.025, C.gold, { capsule: false, seg: 4 });
    }
    b.add(shapes.sphere(0.1, 10, 8), C.gold, { p: [0, 0, 0.04] });
  });
}

function khueVanCac(b) {
  const { x: cx, z: cz, half } = KHUE_VAN_CAC;
  for (const dx of [-half, half]) {
    for (const dz of [-half, half]) {
      b.add(shapes.box(1.1, 0.2, 1.1), C.stone, { p: [cx + dx, 0.1, cz + dz] });
      b.add(shapes.box(0.9, 3.1, 0.9), C.pillar, { p: [cx + dx, 1.65, cz + dz] });
      b.add(shapes.box(1.0, 0.18, 1.0), C.stone, { p: [cx + dx, 3.17, cz + dz] });
    }
  }
  for (const d of [-half, half]) {
    b.add(shapes.box(half * 2, 0.3, 0.4), C.beam, { p: [cx, 3.1, cz + d] });
    b.add(shapes.box(0.4, 0.3, half * 2), C.beam, { p: [cx + d, 3.1, cz] });
  }
  const deck = half + 0.6;
  b.add(shapes.box(deck * 2, 0.22, deck * 2), C.beam, { p: [cx, 3.4, cz] });
  for (const side of [-1, 1]) {
    b.add(shapes.box(deck * 2, 0.08, 0.1), C.lacquer, { p: [cx, 4.0, cz + side * (deck - 0.05)] });
    b.add(shapes.box(0.1, 0.08, deck * 2), C.lacquer, { p: [cx + side * (deck - 0.05), 4.0, cz] });
    for (let t = -deck + 0.1; t <= deck - 0.1 + 1e-6; t += 0.5) {
      b.add(shapes.box(0.07, 0.5, 0.07), C.lacquerDark, { p: [cx + t, 3.75, cz + side * (deck - 0.05)] });
      b.add(shapes.box(0.07, 0.5, 0.07), C.lacquerDark, { p: [cx + side * (deck - 0.05), 3.75, cz + t] });
    }
  }
  const body = 1.6;
  b.add(shapes.box(body * 2, 2.0, body * 2), C.terracotta, { p: [cx, 4.5, cz] });
  for (const y of [3.55, 5.45]) b.add(shapes.box(body * 2 + 0.12, 0.12, body * 2 + 0.12), C.lacquer, { p: [cx, y, cz] });
  roundWindow(b, cx, 4.5, cz + body + 0.01, 0);
  roundWindow(b, cx, 4.5, cz - body - 0.01, Math.PI);
  roundWindow(b, cx + body + 0.01, 4.5, cz, Math.PI / 2);
  roundWindow(b, cx - body - 0.01, 4.5, cz, -Math.PI / 2);

  const lower = tiledRoof({ cx, cz, hx: 2.7, hz: 2.7, ridge: 0.25, eaveY: 5.5, height: 1.5, lift: 0.45, falloff: 1.2 });
  hipRidges(b, lower, 0.06);
  b.add(shapes.box(2.9, 1.1, 2.9), C.terracotta, { p: [cx, 6.45, cz] });
  b.add(shapes.box(3.0, 0.1, 3.0), C.gold, { p: [cx, 6.92, cz] });
  const upper = tiledRoof({ cx, cz, hx: 2.05, hz: 2.05, ridge: 0.3, eaveY: 7.0, height: 1.25, lift: 0.4, falloff: 1.0 });
  hipRidges(b, upper, 0.06);
  ridgeDecor(b, upper, { scale: 0.35, dragons: false });
  return [lower.geometry, upper.geometry];
}

function steles(b) {
  for (const { x, z, side } of STELES) {
    b.group([x, 0, z], [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0], () => {
      b.add(shapes.sphere(0.5, 14, 10), C.turtle, { p: [0, 0.22, 0], s: [0.9, 0.5, 1.25] });
      b.add(shapes.sphere(0.18, 10, 8), C.turtle, { p: [0, 0.3, 0.68], s: [1, 0.85, 1.2] });
      for (const [lx, lz] of [[-0.4, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4]]) {
        b.add(shapes.sphere(0.13, 8, 6), C.turtle, { p: [lx, 0.08, lz], s: [1.2, 0.6, 1] });
      }
      b.add(shapes.box(0.8, 1.35, 0.16), C.stele, { p: [0, 1.12, 0] });
      b.add(shapes.cylinder(0.4, 0.4, 0.15, 16), C.stele, { p: [0, 1.8, 0], r: [Math.PI / 2, 0, 0] });
      b.add(shapes.box(0.92, 0.1, 0.22), shade(C.stele, 0.9), { p: [0, 0.48, 0] });
      for (let i = 0; i < 6; i++) b.add(shapes.box(0.04, 0.9, 0.02), C.steleInk, { p: [-0.25 + i * 0.1, 1.05, 0.085] });
    });
  }
}

const WALL_H = 2.6;
const COPING_TILE = 0x5e3d2e;
const BALUSTER = 0xcfcac0;
const GLAZE = 0x5f8a6a;
const INNER_GATES = CROSS_WALLS.filter((z) => z !== Math.floor(KHUE_VAN_CAC.z)).map((z) => z + 0.5);

function tamQuan(b, z) {
  const pier = (x, h) => {
    b.add(shapes.box(1.15, 0.25, 1.15), C.stone, { p: [x, 0.12, z] });
    b.add(shapes.box(0.9, h, 0.9), C.ochre, { p: [x, h / 2, z] });
    b.add(shapes.box(1.05, 0.22, 1.05), C.stone, { p: [x, h, z] });
  };
  pier(-2.5, 4);
  pier(3.5, 4);
  pier(-6.5, 3.1);
  pier(7.5, 3.1);
  b.add(shapes.box(5.2, 0.45, 0.5), C.lacquer, { p: [0.5, 3.6, z] });
  const roofs = [];
  const main = tiledRoof({ cx: 0.5, cz: z, hx: 4.9, hz: 2.0, ridge: 3.2, eaveY: 4.3, height: 1.35, lift: 0.55, falloff: 1.5 });
  ridgeDecor(b, main, { scale: 0.55, dragons: true });
  hipRidges(b, main, 0.08);
  roofs.push(main.geometry);
  for (const side of [-1, 1]) {
    const cx = side < 0 ? -4.5 : 5.5;
    b.add(shapes.box(3.1, 2.8, 0.7), C.ochre, { p: [cx, 1.4, z] });
    for (const face of [-1, 1]) {
      b.add(shapes.box(1.7, 2.2, 0.06), C.lacquerDark, { p: [cx, 1.1, z + face * 0.37] });
      b.add(shapes.box(0.04, 2.2, 0.08), C.beam, { p: [cx, 1.1, z + face * 0.38] });
    }
    b.add(shapes.box(3.6, 0.3, 0.8), C.lacquer, { p: [cx, 2.95, z] });
    const wing = tiledRoof({ cx, cz: z, hx: 2.6, hz: 1.5, ridge: 1.5, eaveY: 3.35, height: 0.9, lift: 0.35, falloff: 1.0 });
    ridgeDecor(b, wing, { scale: 0.35, dragons: false });
    hipRidges(b, wing, 0.06);
    roofs.push(wing.geometry);
  }
  return roofs;
}

function longRoof(cx, cz, length, depth, eaveY, height) {
  const roof = hipRoof({ cx: 0, cz: 0, hx: length / 2, hz: depth / 2, ridge: length / 2 - depth / 2, eaveY, height, lift: 0.35, falloff: 1.2, thickness: 0.14, rings: 6, tile: 0.9, curve: 1 });
  return roof.geometry.rotateY(Math.PI / 2).translate(cx, 0, cz);
}

function compound(b, bricks) {
  const { x0, x1, front, back } = ENCLOSURE;
  const left = x0 + 0.5;
  const right = x1 + 0.5;
  const rowWall = (xa, xb, z) => {
    bricks.push(texturedBox(xb - xa, WALL_H, 0.5).translate((xa + xb) / 2, WALL_H / 2, z));
    b.add(shapes.box(xb - xa + 0.1, 0.18, 0.75), COPING_TILE, { p: [(xa + xb) / 2, WALL_H + 0.09, z] });
  };
  const sideWall = (x, za, zb) => {
    bricks.push(texturedBox(0.5, WALL_H, zb - za).translate(x, WALL_H / 2, (za + zb) / 2));
    b.add(shapes.box(0.75, 0.2, zb - za + 0.1), COPING_TILE, { p: [x, WALL_H + 0.1, (za + zb) / 2] });
  };
  rowWall(left - 0.25, right + 0.25, back + 0.5);
  sideWall(left, back + 0.25, front + 0.75);
  sideWall(right, back + 0.25, front + 0.75);
  const roofs = [];
  for (const z of INNER_GATES) {
    rowWall(left, -6.95, z);
    rowWall(7.95, right, z);
    roofs.push(...tamQuan(b, z));
  }
  const [westGate, eastGate] = SIDE_GATES;
  rowWall(left, westGate - 1.9, KHUE_VAN_CAC.z);
  rowWall(westGate + 1.9, KHUE_VAN_CAC.x - KHUE_VAN_CAC.half - 0.5, KHUE_VAN_CAC.z);
  rowWall(KHUE_VAN_CAC.x + KHUE_VAN_CAC.half + 0.5, eastGate - 1.9, KHUE_VAN_CAC.z);
  rowWall(eastGate + 1.9, right, KHUE_VAN_CAC.z);
  for (const x of SIDE_GATES) roofs.push(sideGate(b, x, KHUE_VAN_CAC.z));
  roofs.push(...steleSheds(b), ...thuongDien(b), ...vuHouses(b));
  thienQuang(b);
  return roofs;
}

function thienQuang(b) {
  const { x, z, half } = POND;
  const edge = half + 0.3;
  for (const side of [-1, 1]) {
    b.add(shapes.box(edge * 2 + 0.6, 0.3, 0.6), C.stone, { p: [x, 0.15, z + side * edge] });
    b.add(shapes.box(0.6, 0.3, edge * 2 - 0.6), C.stone, { p: [x + side * edge, 0.15, z] });
  }
  const rail = edge + 0.1;
  for (const side of [-1, 1]) {
    for (const along of ['x', 'z']) {
      const at = (t) => (along === 'x' ? [x + t, z + side * rail] : [x + side * rail, z + t]);
      const span = rail * 2;
      const steps = Math.round(span / 1.75);
      for (let k = 0; k <= steps; k++) {
        if (along === 'z' && (k === 0 || k === steps)) continue;
        const [px, pz] = at(-rail + (span * k) / steps);
        b.add(shapes.box(0.22, 1.0, 0.22), BALUSTER, { p: [px, 0.8, pz] });
      }
      const [mx, mz] = at(0);
      const size = along === 'x' ? [span, 0.12, 0.22] : [0.2, 0.12, span - 0.22];
      b.add(shapes.box(...size), BALUSTER, { p: [mx, 1.25, mz] });
      b.add(shapes.box(...size), BALUSTER, { p: [mx, 0.38, mz] });
      for (let k = 0; k < steps; k++) {
        const [px, pz] = at(-rail + (span * (k + 0.5)) / steps);
        b.add(shapes.box(along === 'x' ? 1.2 : 0.08, 0.4, along === 'x' ? 0.08 : 1.2), GLAZE, { p: [px, 0.8, pz] });
      }
    }
  }
}

function steleSheds(b) {
  const roofs = [];
  for (const shed of STELE_SHEDS) {
    for (const dx of [-3, 3]) {
      for (let pz = shed.z0 + 0.5; pz <= shed.z1; pz += 4) {
        b.add(shapes.box(0.5, 0.15, 0.5), C.stone, { p: [shed.x + dx, 0.08, pz] });
        b.add(shapes.cylinder(0.14, 0.16, 2.9, 10), C.lacquerDark, { p: [shed.x + dx, 1.5, pz] });
      }
      b.add(shapes.box(0.2, 0.25, shed.z1 - shed.z0), C.beam, { p: [shed.x + dx, 2.95, (shed.z0 + shed.z1) / 2] });
    }
    b.add(shapes.box(7.4, 0.1, shed.z1 - shed.z0 + 0.6), C.stone, { p: [shed.x, 0.05, (shed.z0 + shed.z1) / 2] });
    roofs.push(longRoof(shed.x, (shed.z0 + shed.z1) / 2, shed.z1 - shed.z0 + 1.6, 8.2, 3.0, 1.7));
  }
  return roofs;
}

function sideGate(b, x, z) {
  for (const side of [-1, 1]) {
    const px = x + side * 1.45;
    b.add(shapes.box(1.05, 0.2, 1.0), C.stone, { p: [px, 0.1, z] });
    b.add(shapes.box(0.9, 2.9, 0.8), C.ochre, { p: [px, 1.55, z] });
    b.add(shapes.box(1.0, 0.18, 0.9), C.stone, { p: [px, 3.05, z] });
  }
  b.add(shapes.box(2.0, 0.5, 0.7), C.ochre, { p: [x, 2.75, z] });
  b.add(shapes.box(2.1, 0.12, 0.5), C.beam, { p: [x, 2.42, z] });
  const roof = tiledRoof({ cx: x, cz: z, hx: 2.3, hz: 1.05, ridge: 1.2, eaveY: 3.15, height: 0.8, lift: 0.3, falloff: 0.9 });
  hipRidges(b, roof, 0.05);
  ridgeDecor(b, roof, { scale: 0.3, dragons: false });
  return roof.geometry;
}

function thuongDien(b) {
  const { x, z, hx, hz } = THUONG_DIEN;
  b.add(shapes.box(hx * 2 + 1.6, 0.04, hz * 2 + 2.4), C.stone, { p: [x, 0.02, z + 0.4] });
  b.add(shapes.box(hx * 2, 4.2, hz * 2), C.ochre, { p: [x, 2.1, z] });
  b.add(shapes.box(hx * 2 + 0.06, 0.5, hz * 2 + 0.06), C.dado, { p: [x, 0.25, z] });
  const front = z + hz;
  for (let px = x - hx + 1.4; px < x + hx - 1; px += 2.6) {
    b.add(shapes.box(2.2, 3.0, 0.06), C.lacquerDark, { p: [px + 0.9, 1.9, front + 0.03] });
    for (let k = 0; k < 4; k++) b.add(shapes.box(0.04, 3.0, 0.08), C.beam, { p: [px + 0.35 + k * 0.55, 1.9, front + 0.05] });
  }
  for (let px = x - hx + 0.5; px <= x + hx - 0.5; px += 4.2) {
    b.add(shapes.cylinder(0.36, 0.42, 0.2, 12), C.stone, { p: [px, 0.1, front + 1.0] });
    b.add(shapes.cylinder(0.22, 0.25, 4.2, 14), C.lacquer, { p: [px, 2.2, front + 1.0] });
  }
  b.add(shapes.box(hx * 2 + 0.4, 0.34, 0.3), C.beam, { p: [x, 4.4, front + 1.0] });
  const lower = tiledRoof({ cx: x, cz: z, hx: hx + 2.5, hz: hz + 2.5, ridge: 7, eaveY: 4.6, height: 3, lift: 0.6, falloff: 2.5, thickness: 0.25, rings: 12 });
  const upper = tiledRoof({ cx: x, cz: z, hx, hz: hz + 0.2, ridge: 7, eaveY: 6.3, height: 2.3, lift: 0.5, falloff: 2, thickness: 0.25, rings: 10 });
  for (const side of [-1, 1]) {
    b.add(shapes.box((hx - 0.6) * 2, 1.0, 0.14), C.ochre, { p: [x, 6.0, z + side * (hz - 0.4)] });
    b.add(shapes.box(0.14, 1.0, (hz - 0.4) * 2), C.ochre, { p: [x + side * (hx - 0.6), 6.0, z] });
  }
  hipRidges(b, lower, 0.1);
  hipRidges(b, upper, 0.1);
  ridgeDecor(b, upper, { scale: 0.8, dragons: true });
  return [lower.geometry, upper.geometry];
}

function hoVanLake(b, rand) {
  const { x0, z0, x1, z1, island } = HO_VAN;
  const kerb = 0.4;
  for (const z of [z0 - kerb / 2, z1 + kerb / 2]) b.add(shapes.box(x1 - x0 + kerb * 2, 0.35, kerb), C.stone, { p: [(x0 + x1) / 2, 0.17, z] });
  for (const x of [x0 - kerb / 2, x1 + kerb / 2]) b.add(shapes.box(kerb, 0.35, z1 - z0), C.stone, { p: [x, 0.17, (z0 + z1) / 2] });
  b.add(shapes.sphere(island.r, 18, 8), C.leafDark, { p: [island.x, -0.6, island.z], s: [1, 0.3, 1] });
  for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    b.add(shapes.cylinder(0.1, 0.12, 2.2, 8), C.lacquer, { p: [island.x + dx * 0.7, 1.1, island.z + dz * 0.7] });
  }
  b.add(shapes.box(2.2, 0.12, 2.2), C.beam, { p: [island.x, 2.25, island.z] });
  const lower = tiledRoof({ cx: island.x, cz: island.z, hx: 1.7, hz: 1.7, ridge: 0.2, eaveY: 2.3, height: 0.9, lift: 0.35, falloff: 0.9 });
  const upper = tiledRoof({ cx: island.x, cz: island.z, hx: 1.2, hz: 1.2, ridge: 0.2, eaveY: 2.9, height: 0.8, lift: 0.3, falloff: 0.8 });
  hipRidges(b, lower, 0.05);
  hipRidges(b, upper, 0.05);
  for (let i = 0; i < 140; i++) {
    const x = x0 + 0.8 + rand() * (x1 - x0 - 1.6);
    const z = z0 + 0.8 + rand() * (z1 - z0 - 1.6);
    if (Math.hypot(x - island.x, z - island.z) < island.r + 0.6) continue;
    const r = 0.3 + rand() * 0.3;
    b.add(shapes.cylinder(r, r, 0.02, 10), rand() < 0.5 ? C.leafDark : C.leaf, { p: [x, 0.1 + rand() * 0.01, z] });
    if (rand() < 0.22) {
      b.add(shapes.cone(0.12, 0.22, 6), 0xe58aa6, { p: [x + 0.1, 0.22, z], r: [Math.PI, 0, 0] });
      b.add(shapes.sphere(0.06, 6, 4), 0xf5d36a, { p: [x + 0.1, 0.24, z] });
    }
  }
  return [lower.geometry, upper.geometry];
}

function vuHouses(b) {
  const roofs = [];
  for (const vu of VU) {
    const mid = (vu.z0 + vu.z1) / 2;
    const length = vu.z1 - vu.z0;
    b.add(shapes.box(4, 0.3, length + 0.4), C.stone, { p: [vu.x, 0.15, mid] });
    b.add(shapes.box(3.6, 2.8, length), C.ochre, { p: [vu.x, 1.6, mid] });
    const face = vu.x < 0 ? 1 : -1;
    for (let pz = vu.z0 + 1.5; pz < vu.z1; pz += 3) {
      b.add(shapes.box(0.06, 2.2, 1.8), C.lacquerDark, { p: [vu.x + face * 1.82, 1.4, pz] });
      b.add(shapes.cylinder(0.14, 0.16, 2.9, 10), C.lacquer, { p: [vu.x + face * 2.3, 1.5, pz - 1.5] });
    }
    roofs.push(longRoof(vu.x, mid, length + 1.6, 5.6, 3.0, 1.8));
  }
  return roofs;
}

export function roundTree(b, rand, { x, z, h }) {
  const bx = x + 0.5;
  const bz = z + 0.5;
  b.limb([bx, 0, bz], [bx, h + 0.5, bz], 0.22, C.trunk, { capsule: false, seg: 7, radiusEnd: 0.16 });
  b.add(shapes.ico(1.7, 1), C.leaf, { p: [bx, h + 1.0, bz], s: [1, 0.85, 1], flat: true });
  b.add(shapes.ico(1.2, 1), C.leafLight, { p: [bx + 0.9, h + 1.6, bz + 0.3], flat: true });
  b.add(shapes.ico(1.1, 1), C.leafDark, { p: [bx - 0.8, h + 0.6, bz - 0.5], flat: true });
}

export const GROUND_LAYER = { earth: 1, field: 2, mark: 3 };

export function groundDecal(geometry, material, layer, y = 0.01) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.renderOrder = layer;
  mesh.receiveShadow = true;
  return mesh;
}

export function earthMaterial() {
  return toonMaterial({
    map: blotchTexture(0xdcb684, [[0xcfa774, 60, 4, 12], [0xe8c798, 50, 4, 10], [0xb9ad98, 40, 1, 3]], [0.25, 0.25], 2),
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

export function markMaterial(color) {
  return toonMaterial({
    color,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function createScenery(scene, layout) {
  const rand = makeRandom(4242);
  const clickables = [];
  const addFlat = (mesh) => {
    mesh.receiveShadow = true;
    scene.add(mesh);
    clickables.push(mesh);
    return mesh;
  };

  const ground = addFlat(
    new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      toonMaterial({ map: blotchTexture(0x8cc152, [[0x9fd162, 70, 6, 14], [0x7bb045, 70, 4, 10]], [250, 250], 1) }),
    ),
  );
  ground.rotation.x = -Math.PI / 2;

  const paving = toonMaterial({ map: brickTexture(), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pathEnd = STAIRS.top + STAIRS.count * STAIRS.tread;
  const pondFront = POND.z + POND.half + 1.2;
  const pondBack = POND.z - POND.half - 1.2;
  const ringX0 = POND.x - POND.half - 3.2;
  const ringX1 = POND.x + POND.half + 3.2;
  const tdBack = THUONG_DIEN.z - THUONG_DIEN.hz - 4.5;
  const tdFront = THUONG_DIEN.z + THUONG_DIEN.hz + 4.5;
  const laneX0 = THUONG_DIEN.x - THUONG_DIEN.hx - 5;
  const laneX1 = THUONG_DIEN.x + THUONG_DIEN.hx + 5;
  for (const [x0, z0, x1, z1] of [
    [-1.5, pathEnd, 2.5, tdBack],
    [laneX0, tdBack, laneX1, tdBack + 1.5],
    [laneX0, tdBack + 1.5, laneX0 + 2, tdFront - 1.5],
    [laneX1 - 2, tdBack + 1.5, laneX1, tdFront - 1.5],
    [laneX0, tdFront - 1.5, laneX1, tdFront],
    [-1.5, tdFront, 2.5, pondBack],
    [-1.5, pondFront, 2.5, ROAD.z0],
    [ringX0, pondBack, ringX1, pondBack + 1.2],
    [ringX0, pondFront - 1.2, ringX1, pondFront],
    [ringX0, pondBack + 1.2, ringX0 + 2, pondFront - 1.2],
    [ringX1 - 2, pondBack + 1.2, ringX1, pondFront - 1.2],
  ]) {
    addFlat(groundDecal(roundedRectGeometry(x0, z0, x1, z1, 0.3), paving, GROUND_LAYER.earth));
  }
  const pondWater = toonMaterial({ color: 0x5f8a6a, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const lake = addFlat(groundDecal(roundedRectGeometry(HO_VAN.x0, HO_VAN.z0, HO_VAN.x1, HO_VAN.z1, 0.2), pondWater, GROUND_LAYER.mark, 0.05));
  lake.receiveShadow = false;
  const well = addFlat(new THREE.Mesh(new THREE.PlaneGeometry(POND.half * 2, POND.half * 2), pondWater));
  well.rotation.x = -Math.PI / 2;
  well.position.set(POND.x, 0.05, POND.z);
  well.receiveShadow = false;

  const floorDepth = HALL_FRONT - HOUSE.foundationBack;
  const floor = addFlat(new THREE.Mesh(new THREE.PlaneGeometry(31, floorDepth), toonMaterial({ map: floorTexture([15.5, floorDepth / 2]) })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.5, 1.003, (HALL_FRONT + HOUSE.foundationBack) / 2);


  const roofTop = toonMaterial({ map: roofTexture(), shadowSide: THREE.DoubleSide });
  const roofUnder = toonMaterial({ color: C.roofUnder, side: THREE.BackSide });

  const env = new Batch();
  const walls = [];
  house(env, walls);
  foundation(scene, env, clickables);
  const bricks = [];
  const gateRoofs = [...khueVanCac(env), ...compound(env, bricks), ...hoVanLake(env, rand)];
  steles(env);
  const brickWalls = new THREE.Mesh(mergeGeometries(bricks, false), toonMaterial({ map: brickTexture() }));
  brickWalls.castShadow = true;
  brickWalls.receiveShadow = true;
  scene.add(brickWalls);
  clickables.push(brickWalls);
  for (const tree of layout.trees) roundTree(env, rand, tree);

  const main = hipRoof({ cx: 0.5, cz: HALL_Z, hx: 16.6, hz: 12.1, ridge: 6.5, eaveY: 6.4, height: 5, lift: 0.8, falloff: 4, thickness: 0.3, rings: 18, tile: 0.9, curve: 1 });
  const upper = hipRoof({ cx: 0.5, cz: HALL_Z, hx: 13.4, hz: 9, ridge: 6.5, eaveY: 8.6, height: 3.6, lift: 0.7, falloff: 3, thickness: 0.3, rings: 14, tile: 0.9, curve: 1 });
  trusses(env, main);

  const plaster = new THREE.Mesh(mergeGeometries(walls, false), toonMaterial({ map: plasterTexture() }));
  plaster.castShadow = true;
  plaster.receiveShadow = true;
  scene.add(plaster);
  clickables.push(plaster);

  const envMesh = env.mesh();
  scene.add(envMesh);
  clickables.push(envMesh);

  for (const geometry of gateRoofs) {
    for (const mesh of roofMeshes(geometry, roofTop, roofUnder)) {
      scene.add(mesh);
      clickables.push(mesh);
    }
  }


  const roof = new THREE.Group();
  roof.add(...roofMeshes(main.geometry, roofTop, roofUnder), ...roofMeshes(upper.geometry, roofTop, roofUnder));
  const decor = new Batch();
  const band = { x: 12.5, z: 8.1 };
  for (const side of [-1, 1]) {
    decor.add(shapes.box(band.x * 2, 1.4, 0.16), C.ochre, { p: [0.5, 8.0, HALL_Z + side * band.z] });
    decor.add(shapes.box(0.16, 1.4, band.z * 2), C.ochre, { p: [0.5 + side * band.x, 8.0, HALL_Z] });
    decor.add(shapes.box(band.x * 2 + 0.3, 0.2, 0.3), C.beam, { p: [0.5, 8.65, HALL_Z + side * band.z] });
    decor.add(shapes.box(0.3, 0.2, band.z * 2 + 0.3), C.beam, { p: [0.5 + side * band.x, 8.65, HALL_Z] });
  }
  for (let x = -10; x <= 11; x += 3) decor.add(shapes.box(1.2, 0.5, 0.06), C.lacquer, { p: [x, 8.15, HALL_Z + band.z + 0.1] });
  hipRidges(decor, main, 0.14);
  hipRidges(decor, upper, 0.14);
  ridgeDecor(decor, upper, { scale: 1, dragons: true });
  roof.add(decor.mesh());
  scene.add(roof);

  return { roof, clickables };
}
