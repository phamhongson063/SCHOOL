import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, shapes, shade, toonMaterial, canvasTexture } from './toon.js';
import { makeRandom } from './random.js';
import { STAIRS, HOUSE } from './school.js';

const C = {
  stone: 0xc2b8a6,
  stoneDark: 0x9e9484,
  plaster: 0xf3dfa6,
  brick: 0xb85c3e,
  wood: 0x744628,
  woodDark: 0x553220,
  roofUnder: 0x4a2c1a,
  ridge: 0x9a3e2a,
  gold: 0xf2c14e,
  teal: 0x3f9488,
  leaf: 0x5fae48,
  leafDark: 0x3f8a3a,
  leafLight: 0x86c75a,
  bamboo: 0xa3c95a,
  bambooNode: 0x7fa443,
  trunk: 0x7a5a3c,
  areca: 0xb0a690,
  straw: 0xe3c46e,
  water: 0x5bb8e6,
  hedge: 0x4f9a3f,
  thatchDark: 0x44392d,
  bambooDry: 0xe6c47a,
  bambooDryNode: 0xb08a40,
  mud: 0x8a6a48,
};

const UP = new THREE.Vector3(0, 1, 0);
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
      ctx.fillStyle = '#9e5238';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const f = 0.92 + rand() * 0.14;
          ctx.fillStyle = css(shade(0xc9714f, f));
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
      g.addColorStop(0, '#8e3524');
      g.addColorStop(0.5, '#cf6347');
      g.addColorStop(1, '#8e3524');
      ctx.fillStyle = g;
      ctx.fillRect(i * w, 0, w, s);
    }
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = 'rgba(60,20,10,0.35)';
      ctx.fillRect(0, j * (s / 4), s, 4);
    }
  });
}

function thatchTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = makeRandom(31);
    ctx.fillStyle = '#54483a';
    ctx.fillRect(0, 0, s, s);
    const colors = ['#7e705a', '#6a5a46', '#4a3f32', '#3a3128', '#8a7c64', '#625c4e', '#545440'];
    for (let i = 0; i < 1400; i++) {
      const x = rand() * s;
      const y = rand() * s;
      const len = 18 + rand() * 40;
      const tilt = (rand() - 0.5) * 6;
      ctx.strokeStyle = colors[Math.floor(rand() * colors.length)];
      ctx.lineWidth = 1 + rand() * 1.6;
      for (const dx of [-s, 0, s]) {
        for (const dy of [-s, 0, s]) {
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.lineTo(x + dx + tilt, y + dy + len);
          ctx.stroke();
        }
      }
    }
    for (let band = 0; band < 4; band++) {
      const y = (band * s) / 4;
      const g = ctx.createLinearGradient(0, y, 0, y + s / 4);
      g.addColorStop(0, 'rgba(60,40,15,0)');
      g.addColorStop(0.85, 'rgba(30,24,16,0.22)');
      g.addColorStop(1, 'rgba(30,24,16,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, s, s / 4);
    }
  });
}

function weaveTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = makeRandom(21);
    const cells = 8;
    const c = s / cells;
    const strips = 3;
    const sw = c / strips;
    ctx.fillStyle = '#5a5040';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const horizontal = (i + j) % 2 === 0;
        const x = i * c;
        const y = j * c;
        for (let k = 0; k < strips; k++) {
          const tone = 0.88 + rand() * 0.2;
          const g = horizontal
            ? ctx.createLinearGradient(0, y + k * sw, 0, y + (k + 1) * sw)
            : ctx.createLinearGradient(x + k * sw, 0, x + (k + 1) * sw, 0);
          g.addColorStop(0, css(shade(0xa49a80, tone * 0.85)));
          g.addColorStop(0.5, css(shade(0xd8cfb4, tone)));
          g.addColorStop(1, css(shade(0xa49a80, tone * 0.8)));
          ctx.fillStyle = g;
          if (horizontal) ctx.fillRect(x + 1, y + k * sw + 0.5, c - 2, sw - 1);
          else ctx.fillRect(x + k * sw + 0.5, y + 1, sw - 1, c - 2);
        }
      }
    }
  });
}

function rafterTexture() {
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#241a12';
    ctx.fillRect(0, 0, s, s);
    for (let y = 8; y < s; y += 32) {
      ctx.fillStyle = '#5e4a32';
      ctx.fillRect(0, y, s, 5);
    }
    for (let x = 0; x < s; x += 32) {
      const g = ctx.createLinearGradient(x + 4, 0, x + 20, 0);
      g.addColorStop(0, '#7a6038');
      g.addColorStop(0.5, '#b8965e');
      g.addColorStop(1, '#7a6038');
      ctx.fillStyle = g;
      ctx.fillRect(x + 4, 0, 16, s);
      ctx.fillStyle = '#5e4a2c';
      ctx.fillRect(x + 4, 60, 16, 3);
    }
  });
}

function skyTexture() {
  return canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#5aa9e6');
    g.addColorStop(0.6, '#a9d7f0');
    g.addColorStop(1, '#e6f2f0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export const HORIZON = 0xd8ecef;

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

function roofMeshes(geometry, top, under) {
  const outer = new THREE.Mesh(geometry, top);
  outer.castShadow = true;
  outer.receiveShadow = true;
  const inner = new THREE.Mesh(geometry, under);
  inner.receiveShadow = true;
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

function lateriteTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = makeRandom(11);
    const rows = 4;
    const h = s / rows;
    const w = s / 2;
    ctx.fillStyle = '#d9c8a6';
    ctx.fillRect(0, 0, s, s);
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 ? w / 2 : 0;
      for (let c = -1; c < 3; c++) {
        const x = c * w + offset;
        ctx.fillStyle = css(shade(0xb06a42, 0.85 + rand() * 0.3));
        ctx.fillRect(x + 3, r * h + 3, w - 6, h - 6);
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = `rgba(80,40,22,${0.35 + rand() * 0.35})`;
          ctx.beginPath();
          ctx.ellipse(x + 8 + rand() * (w - 16), r * h + 8 + rand() * (h - 16), 1.5 + rand() * 3.5, 1 + rand() * 2.5, rand() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,230,200,0.12)';
        ctx.fillRect(x + 3, r * h + 3, w - 6, 5);
      }
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
  const material = toonMaterial({ map: lateriteTexture() });
  const depth = 8 - HOUSE.foundationBack;
  const centerZ = (8 + HOUSE.foundationBack) / 2;
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
  b.add(shapes.rounded(31.2, 0.14, 0.42, 0.03), COPING, { p: [0.5, 0.94, 7.85] });
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

function bambooPole(b, from, to, radius, nodeEvery = 0.7) {
  b.limb(from, to, radius, C.bambooDry, { capsule: false, seg: 10 });
  const a = new THREE.Vector3().fromArray(from);
  const dir = new THREE.Vector3().fromArray(to).sub(a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  for (let d = nodeEvery * 0.6; d < len - 0.1; d += nodeEvery) {
    const p = a.clone().addScaledVector(dir, d / len);
    b.add(shapes.cylinder(radius * 1.12, radius * 1.12, 0.04, 10), C.bambooDryNode, { p: p.toArray(), q });
  }
}

function house(b, woven) {
  const { back, front, midColumn, windows } = HOUSE;
  const backZ = back + 0.5;
  const frontZ = front + 0.5;
  const sideStart = back + 1;
  const sideEnd = front;
  const centerZ = (backZ + frontZ) / 2;
  const span = frontZ - backZ + 0.6;
  const T = 0.2;
  const face = T / 2 + 0.05;
  const panel = (w, h, d, x, y, z) => woven.push(texturedBox(w, h, d).translate(x, y, z));

  panel(27, 6.5, T, 0.5, 4.75, backZ);
  b.add(shapes.box(27, 0.5, T + 0.06), C.mud, { p: [0.5, 1.25, backZ] });

  for (const x of [-13.5, 14.5]) {
    const out = x < 0 ? -1 : 1;
    let z = sideStart;
    for (const [z0, z1] of windows) {
      panel(T, 6.5, z0 - z, x, 4.75, (z + z0) / 2);
      panel(T, 1.5, z1 - z0, x, 2.25, (z0 + z1) / 2);
      panel(T, 3, z1 - z0, x, 6.5, (z0 + z1) / 2);
      const zc = (z0 + z1) / 2;
      for (const y of [3, 5]) bambooPole(b, [x, y, z0], [x, y, z1], 0.06, 0.9);
      for (const zz of [z0, z1]) bambooPole(b, [x, 3, zz], [x, 5, zz], 0.06, 0.9);
      for (let zz = z0 + 0.3; zz < z1 - 0.1; zz += 0.3) b.limb([x, 3, zz], [x, 5, zz], 0.03, C.bambooDry, { capsule: false, seg: 6 });

      const len = z1 - z0 + 0.2;
      const hinge = x + out * (T / 2 + 0.05);
      const shutter = texturedBox(0.06, 1.5, len).translate(0, -0.75, 0);
      shutter.rotateZ(out * 0.6);
      woven.push(shutter.translate(hinge, 5.05, zc));
      for (const zz of [z0 + 0.4, z1 - 0.4]) {
        b.limb([x + out * (T / 2 + 0.03), 3.02, zz], [hinge + out * 1.5 * Math.sin(0.6), 5.05 - 1.5 * Math.cos(0.6), zz], 0.025, C.bambooDryNode, {
          capsule: false,
          seg: 6,
        });
      }
      z = z1;
    }
    panel(T, 6.5, sideEnd - z, x, 4.75, (z + sideEnd) / 2);
    b.add(shapes.box(T + 0.06, 0.5, sideEnd - sideStart), C.mud, { p: [x, 1.25, (sideStart + sideEnd) / 2] });
  }

  for (const off of [-1, 1]) {
    for (const y of [1.55, 4.2, 7.6]) {
      bambooPole(b, [-13.5, y, backZ + off * face], [14.5, y, backZ + off * face], 0.055, 1.2);
      for (const x of [-13.5, 14.5]) bambooPole(b, [x + off * face, y, sideStart], [x + off * face, y, sideEnd], 0.055, 1.2);
    }
    for (let x = -11; x <= 12; x += 2.5) b.limb([x, 1.5, backZ + off * face], [x, 8, backZ + off * face], 0.06, C.bambooDry, { capsule: false, seg: 8 });
    for (const x of [-13.5, 14.5]) {
      for (let z = sideStart + 1.5; z < sideEnd - 0.5; z += 2.5) {
        if (windows.some(([z0, z1]) => z > z0 - 0.2 && z < z1 + 0.2)) continue;
        b.limb([x + off * face, 1.5, z], [x + off * face, 8, z], 0.06, C.bambooDry, { capsule: false, seg: 8 });
      }
    }
  }

  const columns = [];
  for (const x of [-13.5, -4.5, 5.5, 14.5]) columns.push([x, backZ], [x, frontZ]);
  columns.push([-13.5, midColumn + 0.5], [14.5, midColumn + 0.5]);
  for (const [x, z] of columns) {
    b.add(shapes.cylinder(0.36, 0.42, 0.22, 12), C.stoneDark, { p: [x, 1.11, z] });
    bambooPole(b, [x, 1.2, z], [x, 8.3, z], 0.24, 0.75);
  }

  for (const z of [backZ, frontZ]) bambooPole(b, [-14.3, 8.35, z], [15.3, 8.35, z], 0.2, 1.4);
  for (const x of [-13.5, 14.5, -4.5, 5.5]) bambooPole(b, [x, 8.35, centerZ - span / 2], [x, 8.35, centerZ + span / 2], 0.2, 1.4);

  const gableTop = 10.65;
  const gableH = gableTop - 8.6;
  panel(29.6, gableH, 0.1, 0.5, 8.6 + gableH / 2, frontZ + 0.3);
  panel(29.6, gableH, 0.1, 0.5, 8.6 + gableH / 2, backZ - 0.3);
  for (const x of [-13.8, 14.8]) panel(0.1, gableH, span, x, 8.6 + gableH / 2, centerZ);
}

function trusses(b, roof) {
  const yAt = (d) => roof.eaveY + roof.height * Math.pow(Math.max(0, 1 - d / roof.hz), roof.curve);
  const top = yAt(0) - 0.45;
  const beam = HOUSE.front + 0.5 - roof.cz;
  for (const x of [-4.5, 5.5]) {
    for (const side of [-1, 1]) {
      const rafter = beam + 0.6;
      b.limb([x, yAt(rafter) - 0.35, roof.cz + side * rafter], [x, top, roof.cz], 0.17, C.bambooDry, { capsule: false, seg: 6 });
      b.limb([x, 8.6, roof.cz + side * beam], [x, yAt(beam) - 0.35, roof.cz + side * beam], 0.15, C.bambooDry, { capsule: false, seg: 6 });
      b.limb([x, 8.6, roof.cz + side * beam * 0.5], [x, yAt(beam * 0.5) - 0.35, roof.cz + side * beam * 0.5], 0.12, C.bambooDry, {
        capsule: false,
        seg: 6,
      });
    }
    b.limb([x, 8.6, roof.cz], [x, top, roof.cz], 0.18, C.bambooDry, { capsule: false, seg: 6 });
  }
}

function gate(b) {
  for (const x of [-2.5, 3.5]) {
    b.add(shapes.box(0.9, 4, 0.9), C.brick, { p: [x, 2, 30.5] });
    b.add(shapes.box(1.1, 0.25, 1.1), C.stone, { p: [x, 0.12, 30.5] });
    b.add(shapes.box(1.05, 0.2, 1.05), C.stone, { p: [x, 3.95, 30.5] });
  }
  b.add(shapes.box(5.2, 0.45, 0.5), C.woodDark, { p: [0.5, 3.6, 30.5] });
  const roof = hipRoof({ cx: 0.5, cz: 30.5, hx: 4.7, hz: 1.9, ridge: 3.2, eaveY: 4.15, height: 1.25, lift: 0.45, thickness: 0.15, rings: 6, falloff: 1.5 });
  ridgeDecor(b, roof, { scale: 0.5, dragons: false });
  hipRidges(b, roof, 0.08);
  return roof.geometry;
}

function hedge(b, rand) {
  const segment = (x0, z0, x1, z1) =>
    b.add(shapes.rounded(x1 - x0, 1.9, z1 - z0, 0.4), C.hedge, { p: [(x0 + x1) / 2, 0.95, (z0 + z1) / 2] });
  segment(-28, -20, 29, -19);
  segment(-28, 30, -3, 31);
  segment(4, 30, 29, 31);
  segment(-28, -19.5, -27, 30.5);
  segment(28, -19.5, 29, 30.5);
  const flowers = [0xe8506a, 0xf5d547, 0xffffff, 0xf08bb0];
  for (let i = 0; i < 120; i++) {
    const side = Math.floor(rand() * 4);
    const t = rand();
    let x;
    let z;
    if (side === 0) [x, z] = [-28 + t * 57, -19.5 + (rand() < 0.5 ? -0.52 : 0.52)];
    else if (side === 1) [x, z] = [-28 + t * 57, 30.5 + (rand() < 0.5 ? -0.52 : 0.52)];
    else [x, z] = [side === 2 ? -27.5 + (rand() < 0.5 ? -0.52 : 0.52) : 28.5 + (rand() < 0.5 ? -0.52 : 0.52), -19.5 + t * 50];
    if (side === 1 && x > -3.2 && x < 4.2) continue;
    b.add(shapes.sphere(0.08, 6, 4), flowers[i % flowers.length], { p: [x, 0.5 + rand() * 1.3, z] });
  }
}

function pond(b, rand, { x, z, r }) {
  const cx = x + 0.5;
  const cz = z + 0.5;
  for (let a = 0; a < Math.PI * 2; a += 0.15) {
    const rr = r + 0.55 + rand() * 0.2;
    b.add(shapes.ico(0.25 + rand() * 0.15, 0), shade(C.stone, 0.85 + rand() * 0.25), {
      p: [cx + Math.cos(a) * rr, 0.06, cz + Math.sin(a) * rr],
      s: [1.3, 0.6, 1],
      r: [0, rand() * 3, 0],
      flat: true,
    });
  }
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const rr = rand() * (r - 1);
    const px = cx + Math.cos(a) * rr;
    const pz = cz + Math.sin(a) * rr;
    b.add(shapes.cylinder(0.32, 0.32, 0.03, 10), i % 2 ? C.leaf : C.leafDark, { p: [px, 0.06, pz] });
    if (i % 3 === 0) {
      b.add(shapes.cone(0.12, 0.2, 6), 0xf28bb0, { p: [px + 0.1, 0.17, pz], flat: true });
      b.add(shapes.sphere(0.04, 6, 4), C.gold, { p: [px + 0.1, 0.26, pz] });
    }
  }
}

function arecaPalm(b, rand, { x, z, h }) {
  const bx = x + 0.5;
  const bz = z + 0.5;
  const lean = (rand() - 0.5) * 0.5;
  const points = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    points.push([bx + Math.sin(t * 1.4) * lean, t * h, bz + Math.sin(t * 1.4) * lean * 0.5]);
  }
  for (let i = 0; i < 4; i++) {
    b.limb(points[i], points[i + 1], 0.14 - i * 0.012, C.areca, { capsule: false, seg: 8, radiusEnd: 0.13 - i * 0.012 });
  }
  for (let y = 0.45; y < h - 0.2; y += 0.45) {
    const t = y / h;
    b.add(shapes.cylinder(0.14, 0.14, 0.035, 8), shade(C.areca, 0.78), {
      p: [bx + Math.sin(t * 1.4) * lean, y, bz + Math.sin(t * 1.4) * lean * 0.5],
    });
  }
  const top = points[4];
  b.add(shapes.cylinder(0.12, 0.16, 0.7, 8), 0x7d9a45, { p: [top[0], top[1] + 0.3, top[2]] });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rand() * 0.3;
    const droop = i < 2 ? 0.7 : -0.2 - rand() * 0.4;
    const dir = v3(Math.cos(a) * Math.cos(droop), Math.sin(droop), Math.sin(a) * Math.cos(droop));
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    const p = v3(top[0], top[1] + 0.6, top[2]).addScaledVector(dir, 1.1);
    b.add(shapes.cone(0.3, 2.3, 4), i % 2 ? C.leaf : C.leafDark, { p: p.toArray(), q, s: [1, 1, 0.25], flat: true });
  }
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    b.add(shapes.sphere(0.07, 6, 4), 0x9ab83c, { p: [top[0] + Math.cos(a) * 0.18, top[1] - 0.05 - rand() * 0.2, top[2] + Math.sin(a) * 0.18] });
  }
}

function bambooStalk(b, rand, { x, z, h }) {
  const bx = x + 0.5 + (rand() - 0.5) * 0.4;
  const bz = z + 0.5 + (rand() - 0.5) * 0.4;
  const lx = (rand() - 0.5) * 0.8;
  const lz = (rand() - 0.5) * 0.8;
  const height = h + 0.5;
  b.limb([bx, 0, bz], [bx + lx, height, bz + lz], 0.085, C.bamboo, { capsule: false, seg: 8, radiusEnd: 0.07 });
  for (let y = 0.8; y < height - 0.3; y += 0.85) {
    const t = y / height;
    b.add(shapes.cylinder(0.095, 0.095, 0.05, 8), C.bambooNode, { p: [bx + lx * t, y, bz + lz * t] });
  }
  for (let i = 0; i < 3; i++) {
    const t = 0.72 + i * 0.12;
    b.add(shapes.ico(0.55 + rand() * 0.25, 0), i % 2 ? C.leaf : C.leafLight, {
      p: [bx + lx * t + (rand() - 0.5) * 0.8, height * t, bz + lz * t + (rand() - 0.5) * 0.8],
      s: [1.3, 0.55, 1.3],
      r: [0, rand() * 3, 0],
      flat: true,
    });
  }
}

function banyan(b, rand, { x, z }) {
  const bx = x + 1;
  const bz = z + 1;
  b.add(shapes.cylinder(0.75, 1.05, 6.5, 10), C.trunk, { p: [bx, 3.25, bz], flat: true });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.limb([bx + Math.cos(a) * 0.6, 1.2, bz + Math.sin(a) * 0.6], [bx + Math.cos(a) * 1.5, 0, bz + Math.sin(a) * 1.5], 0.22, C.trunk, {
      capsule: false,
      seg: 6,
      radiusEnd: 0.12,
    });
  }
  const branches = [[-2.6, 7.2, 0.3], [2.8, 7.4, -0.4], [0.4, 7.6, 2.7], [-0.5, 7.5, -2.6], [1.5, 8.6, 1.2]];
  for (const [ox, oy, oz] of branches) {
    b.limb([bx, 5.5, bz], [bx + ox, oy, bz + oz], 0.35, C.trunk, { capsule: false, seg: 7, radiusEnd: 0.2 });
  }
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2;
    const rr = 1.6 + rand() * 1.6;
    const px = bx + Math.cos(a) * rr;
    const pz = bz + Math.sin(a) * rr;
    b.limb([px, 6.6 + rand() * 0.6, pz], [px, 0, pz], 0.045, shade(C.trunk, 0.8), { capsule: false, seg: 5 });
  }
  const blobs = [[0, 9.2, 0, 3.1], [2.9, 8.3, 1, 2.4], [-2.7, 8.4, -0.4, 2.5], [0.8, 8.1, -2.8, 2.3], [-0.9, 8.2, 2.8, 2.4], [2.1, 9.8, -1.6, 2.0], [-2, 9.9, 1.5, 2.0], [0, 10.7, 0, 2.0]];
  blobs.forEach(([ox, oy, oz, r], i) => {
    b.add(shapes.ico(r, 1), [C.leaf, C.leafDark, C.leafLight][i % 3], { p: [bx + ox, oy, bz + oz], s: [1, 0.8, 1], flat: true });
  });
}

export function roundTree(b, rand, { x, z, h }) {
  const bx = x + 0.5;
  const bz = z + 0.5;
  b.limb([bx, 0, bz], [bx, h + 0.5, bz], 0.22, C.trunk, { capsule: false, seg: 7, radiusEnd: 0.16 });
  b.add(shapes.ico(1.7, 1), C.leaf, { p: [bx, h + 1.0, bz], s: [1, 0.85, 1], flat: true });
  b.add(shapes.ico(1.2, 1), C.leafLight, { p: [bx + 0.9, h + 1.6, bz + 0.3], flat: true });
  b.add(shapes.ico(1.1, 1), C.leafDark, { p: [bx - 0.8, h + 0.6, bz - 0.5], flat: true });
}

function haystack(b, { x, z }) {
  const bx = x + 0.5;
  const bz = z + 0.5;
  b.add(shapes.lathe([[0, 0], [2.6, 0], [2.5, 0.6], [2.15, 1.5], [1.5, 2.4], [0.8, 3.2], [0.2, 3.9], [0, 4.0]], 14), C.straw, {
    p: [bx, 0, bz],
    flat: true,
  });
  b.limb([bx, 3.5, bz], [bx, 4.8, bz], 0.06, C.trunk, { capsule: false, seg: 6 });
}

function thatchDecor(b, roof) {
  const { cx, cz, ridge, ridgeY } = roof;
  const y = ridgeY + 0.15;
  b.limb([cx - ridge - 0.6, y, cz], [cx + ridge + 0.6, y, cz], 0.42, C.thatchDark, { seg: 14 });
  for (let x = cx - ridge; x <= cx + ridge + 0.01; x += 1) {
    b.add(shapes.torus(0.43, 0.035, 16), C.bambooDryNode, { p: [x, y, cz], r: [0, Math.PI / 2, 0] });
  }
  for (let x = cx - ridge + 0.4; x <= cx + ridge - 0.3; x += 1.6) {
    for (const side of [-1, 1]) {
      b.limb([x, y - 0.75, cz + side * 0.95], [x, y + 0.75, cz - side * 0.55], 0.05, C.bambooDry, { capsule: false, seg: 6 });
    }
  }
  for (const points of roof.corners) {
    b.add(shapes.tube(points.map((p) => p.clone().add(v3(0, 0.12, 0))), 0.26, 40), C.thatchDark);
  }
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

export function createSky(scene) {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(HORIZON, 70, 190);
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
      new THREE.PlaneGeometry(400, 400),
      toonMaterial({ map: blotchTexture(0x8cc152, [[0x9fd162, 70, 6, 14], [0x7bb045, 70, 4, 10]], [100, 100], 1) }),
    ),
  );
  ground.rotation.x = -Math.PI / 2;

  const earth = earthMaterial();
  addFlat(groundDecal(roundedRectGeometry(-15, 8, 16, 27, 2), earth, GROUND_LAYER.earth));
  addFlat(groundDecal(roundedRectGeometry(-2, 26.5, 3, 34, 0.6), earth, GROUND_LAYER.earth));

  const floorDepth = 8 - HOUSE.foundationBack;
  const floor = addFlat(new THREE.Mesh(new THREE.PlaneGeometry(31, floorDepth), toonMaterial({ map: floorTexture([15.5, floorDepth / 2]) })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.5, 1.003, (8 + HOUSE.foundationBack) / 2);

  const { pond: p } = layout;
  const water = addFlat(
    new THREE.Mesh(new THREE.CircleGeometry(p.r + 0.45, 48), toonMaterial({ color: C.water, transparent: true, opacity: 0.9 })),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(p.x + 0.5, 0.03, p.z + 0.5);

  const roofTop = toonMaterial({ map: roofTexture(), shadowSide: THREE.DoubleSide });
  const thatchTop = toonMaterial({ map: thatchTexture(), shadowSide: THREE.DoubleSide });
  const thatchUnder = toonMaterial({ map: rafterTexture(), side: THREE.BackSide });
  const roofUnder = toonMaterial({ color: C.roofUnder, side: THREE.BackSide });

  const env = new Batch();
  const woven = [];
  house(env, woven);
  foundation(scene, env, clickables);
  const gateRoof = gate(env);
  hedge(env, rand);
  pond(env, rand, p);
  for (const palm of layout.arecas) arecaPalm(env, rand, palm);
  for (const stalk of layout.bamboos) bambooStalk(env, rand, stalk);
  banyan(env, rand, layout.banyan);
  for (const tree of layout.trees) roundTree(env, rand, tree);
  haystack(env, layout.haystack);

  const main = hipRoof({
    cx: 0.5,
    cz: -3,
    hx: 16.6,
    hz: 12.1,
    ridge: 6.5,
    eaveY: 8.75,
    height: 11,
    lift: 0,
    thickness: 0.45,
    rings: 22,
    tile: 1.2,
    curve: 1,
    jagged: 0.14,
    seed: 7,
  });
  trusses(env, main);

  const weave = new THREE.Mesh(mergeGeometries(woven, false), toonMaterial({ map: weaveTexture() }));
  weave.castShadow = true;
  weave.receiveShadow = true;
  scene.add(weave);
  clickables.push(weave);

  const envMesh = env.mesh();
  scene.add(envMesh);
  clickables.push(envMesh);

  for (const mesh of roofMeshes(gateRoof, roofTop, roofUnder)) {
    scene.add(mesh);
    clickables.push(mesh);
  }

  const roof = new THREE.Group();
  roof.add(...roofMeshes(main.geometry, thatchTop, thatchUnder));
  const decor = new Batch();
  thatchDecor(decor, main);
  roof.add(decor.mesh());
  scene.add(roof);

  return { roof, clickables };
}
