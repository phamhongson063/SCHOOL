import * as THREE from 'three';
import { canvasTexture, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';

const PROFILE = [
  [-1, 0],
  [-0.86, 0.38],
  [-0.66, 0.8],
  [-0.4, 0.97],
  [0, 1.03],
  [0.4, 0.97],
  [0.66, 0.8],
  [0.86, 0.38],
  [1, 0],
];
const ENDS = [
  [0.45, 0.06, 0.55],
  [0.25, 0.55, 0.85],
];
const SOIL_DARK = new THREE.Color(0x5c3920);
const SOIL_LIGHT = new THREE.Color(0x96663d);

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function bedShape(seed, { height = 0.22, halfWidth = 0.47 } = {}) {
  const rand = makeRandom(seed);
  const p = Array.from({ length: 5 }, () => rand() * Math.PI * 2);
  const skew = (rand() - 0.5) * 0.08;
  return {
    offset: (z) => Math.sin(z * 0.23 + p[0]) * 0.035 + Math.sin(z * 0.71 + p[1]) * 0.015 + skew * Math.sin(z * 0.05 + p[4]),
    height: (z) => height + Math.sin(z * 0.55 + p[2]) * 0.022 + Math.sin(z * 1.7 + p[3]) * 0.01,
    halfWidth: (z) => halfWidth + Math.sin(z * 0.4 + p[3]) * 0.03 + Math.sin(z * 1.3 + p[0]) * 0.012,
  };
}

function rings(z0, z1, step) {
  const list = ENDS.map(([back, h, w]) => ({ z: z0 - back, h, w }));
  const count = Math.max(1, Math.round((z1 - z0) / step));
  for (let i = 0; i <= count; i++) list.push({ z: z0 + ((z1 - z0) * i) / count, h: 1, w: 1 });
  for (const [back, h, w] of [...ENDS].reverse()) list.push({ z: z1 + back, h, w });
  return list;
}

export function bedsGeometry(beds, z0, z1, step = 0.5) {
  const positions = [];
  const colors = [];
  const indices = [];
  const color = new THREE.Color();
  for (const { x, shape } of beds) {
    const start = positions.length / 3;
    const list = rings(z0, z1, step);
    for (const ring of list) {
      const cx = x + shape.offset(ring.z);
      const h = shape.height(ring.z) * ring.h;
      const w = shape.halfWidth(ring.z) * ring.w;
      for (const [px, py] of PROFILE) {
        const vx = cx + px * w;
        const vz = ring.z + (py > 0 && py < 1 ? (hash(vx, ring.z) - 0.5) * 0.04 : 0);
        const vy = py * h + (py > 0.5 ? (hash(ring.z, vx) - 0.5) * 0.02 : 0);
        positions.push(vx, vy, vz);
        const patch = 0.5 + 0.5 * Math.sin(vx * 1.9 + ring.z * 0.8) * Math.sin(ring.z * 0.37 - vx);
        color.copy(SOIL_DARK).lerp(SOIL_LIGHT, Math.min(1, hash(vx, ring.z) * 0.45 + patch * 0.35 + py * 0.2));
        colors.push(color.r, color.g, color.b);
      }
    }
    const n = PROFILE.length;
    for (let r = 0; r < list.length - 1; r++) {
      for (let i = 0; i < n - 1; i++) {
        const a = start + r * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function raggedPatch(x0, z0, x1, z1, seed, { wobble = 0.35, step = 0.7 } = {}) {
  const rand = makeRandom(seed);
  const points = [];
  const edge = (ax, az, bx, bz) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t + (rand() - 0.5) * wobble;
      const z = az + (bz - az) * t + (rand() - 0.5) * wobble;
      points.push(new THREE.Vector2(x, -z));
    }
  };
  edge(x0, z0, x1, z0);
  edge(x1, z0, x1, z1);
  edge(x1, z1, x0, z1);
  edge(x0, z1, x0, z0);
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function soilMaterial() {
  const texture = canvasTexture(
    256,
    (ctx, size) => {
      const rand = makeRandom(88);
      ctx.fillStyle = css(0x93673f);
      ctx.fillRect(0, 0, size, size);
      for (const [hex, count, rMin, rMax] of [
        [0x7d5532, 70, 6, 16],
        [0xa77a4e, 60, 5, 13],
        [0x6b4628, 160, 1, 3],
        [0xb88b5c, 120, 1, 2.5],
      ]) {
        ctx.fillStyle = css(hex);
        for (let i = 0; i < count; i++) {
          const x = rand() * size;
          const y = rand() * size;
          const r = rMin + rand() * (rMax - rMin);
          const a = rand() * Math.PI;
          for (const dx of [-size, 0, size]) {
            for (const dy of [-size, 0, size]) {
              ctx.beginPath();
              ctx.ellipse(x + dx, y + dy, r, r * 0.65, a, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    },
    [0.3, 0.3],
  );
  return toonMaterial({
    map: texture,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}
