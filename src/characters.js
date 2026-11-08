import * as THREE from 'three';
import { Batch, shapes, shade, toonMaterial, characterMaterial, characterGradient } from './toon.js';
import { faceSet } from './faceTexture.js';

const OUTLINE = 0.008;
const WHITE = 0xfaf6ec;
const HAIR = 0x33241c;
const HAIR_OUTLINE = 0.006;
const GOLD = 0xf2c14e;
const UP = new THREE.Vector3(0, 1, 0);
const HEAD_SCALE = [1.05, 0.96, 1];

function part(parent, pivot, build, outline = OUTLINE) {
  const batch = new Batch();
  build(batch);
  const mesh = batch.mesh(characterMaterial(), { outline });
  mesh.position.fromArray(pivot);
  parent.add(mesh);
  return mesh;
}

class Face {
  constructor(material, set) {
    this.material = material;
    this.set = set;
    this.nextBlink = 1 + Math.random() * 3;
    this.blinkUntil = 0;
  }

  update(t, mood = 'open') {
    if (t > this.nextBlink) {
      this.blinkUntil = t + 0.13;
      this.nextBlink = t + 2 + Math.random() * 3.5;
    }
    const map = (t < this.blinkUntil ? this.set.blink : this.set[mood]) ?? this.set.open;
    if (this.material.map !== map) this.material.map = map;
  }
}

function attachFace(head, c, R, set) {
  const geometry = new THREE.SphereGeometry(R * 1.008, 36, 24, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.36, Math.PI * 0.44);
  geometry.scale(...HEAD_SCALE);
  geometry.translate(0, c, 0);
  const material = toonMaterial({
    map: set.open,
    gradientMap: characterGradient(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.raycast = () => {};
  mesh.renderOrder = 1;
  head.add(mesh);
  return new Face(material, set);
}

function skull(b, c, R, skin) {
  b.add(shapes.sphere(R, 28, 20), skin, { p: [0, c, 0], s: HEAD_SCALE });
  for (const side of [-1, 1]) {
    b.add(shapes.sphere(R * 0.2, 10, 8), skin, { p: [side * R * 1.0, c - R * 0.08, -R * 0.05], s: [0.4, 0.8, 0.6] });
  }
}

function curl(b, c, R, color, x = 0, z = 0.15, size = 1, lift = 0) {
  const y = c + R * lift;
  b.add(
    shapes.tube(
      [
        new THREE.Vector3(x, y + R * 0.9, R * z),
        new THREE.Vector3(x + R * 0.04 * size, y + R * (1.12 + 0.12 * size), R * (z + 0.05)),
        new THREE.Vector3(x + R * 0.1 * size, y + R * (1.2 + 0.2 * size), R * (z - 0.12)),
        new THREE.Vector3(x + R * 0.02 * size, y + R * (1.12 + 0.18 * size), R * (z - 0.25)),
      ],
      R * 0.07 * size,
      16,
    ),
    color,
  );
}

const TEAR = [[0, 0], [0.08, 0.03], [0.22, 0.12], [0.4, 0.27], [0.55, 0.46], [0.62, 0.64], [0.57, 0.8], [0.4, 0.93], [0.18, 0.99], [0, 1]];

function lockGeometry(bend) {
  const geometry = shapes.lathe(TEAR, 18);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    position.setX(i, position.getX(i) + bend * 4 * y * (1 - y));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function surfacePoint(c, R, phi, h, lift) {
  const r = Math.sqrt(Math.max(0, 1 - h * h));
  return new THREE.Vector3(Math.sin(phi) * r * HEAD_SCALE[0] * lift * R, c + h * HEAD_SCALE[1] * lift * R, Math.cos(phi) * r * lift * R);
}

function lock(b, c, R, color, base, tip, width, bend = 0, baseLift = 1.15, tipLift = 1.07) {
  const a = surfacePoint(c, R, base[0], base[1], baseLift);
  const t = surfacePoint(c, R, tip[0], tip[1], tipLift);
  const y = a.clone().sub(t);
  const len = y.length();
  y.normalize();
  const z = a.clone().add(t).multiplyScalar(0.5);
  z.y -= c;
  z.normalize().addScaledVector(y, -z.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  b.add(lockGeometry(bend), color, { p: t.toArray(), q, s: [width * R, len, width * R * 0.42] });
}

function hairCap(b, c, R, color) {
  b.add(shapes.cap(R * 1.17, 1.67, 30, 16), color, { p: [0, c + R * 0.03, 0], r: [-0.68, 0, 0], s: [1.12, 0.95, 1.04] });
  b.add(shapes.sphere(R * 1.06, 24, 18), color, { p: [0, c + R * 0.16, -R * 0.2], s: [1.16, 0.96, 1] });
}

const CROWNS = {
  short: [
    [[1.3, 0.5], [1.68, 0.12], 0.46, 0.35, 1.38],
    [[-1.3, 0.5], [-1.68, 0.12], 0.46, -0.35, 1.38],
    [[1.05, 0.8], [1.45, 0.62], 0.44, 0.3, 1.42],
    [[-1.05, 0.8], [-1.45, 0.62], 0.44, -0.3, 1.42],
    [[0.45, 0.95], [0.8, 0.86], 0.4, 0.25, 1.36],
    [[-0.45, 0.95], [-0.8, 0.86], 0.4, -0.25, 1.36],
    [[2.05, 0.66], [2.3, 0.12], 0.46, 0.3, 1.28],
    [[-2.05, 0.66], [-2.3, 0.12], 0.46, -0.3, 1.28],
    [[2.85, 0.7], [3.05, 0.05], 0.48, 0.2, 1.28],
    [[-2.85, 0.7], [-3.05, 0.05], 0.48, -0.2, 1.28],
    [[3.0, 0.92], [2.7, 0.78], 0.42, 0.2, 1.36],
  ],
  long: [
    [[1.25, 0.62], [1.5, 0.3], 0.42, 0.3, 1.32],
    [[-1.25, 0.62], [-1.5, 0.3], 0.42, -0.3, 1.32],
    [[1.3, 0.5], [1.5, -0.3], 0.46, 0.25, 1.26],
    [[-1.3, 0.5], [-1.5, -0.3], 0.46, -0.25, 1.26],
    [[2.1, 0.6], [2.3, -0.4], 0.5, 0.25, 1.24],
    [[-2.1, 0.6], [-2.3, -0.4], 0.5, -0.25, 1.24],
    [[2.9, 0.62], [3.1, -0.45], 0.52, 0.15, 1.24],
    [[-2.9, 0.62], [-3.1, -0.45], 0.52, -0.15, 1.24],
  ],
};

function crown(b, c, R, color, kind) {
  for (const [base, tip, width, bend, reach] of CROWNS[kind]) lock(b, c, R, color, base, tip, width, bend, 1.12, reach);
}

const FRINGES = {
  swept: [
    [[-0.6, 0.62], [-0.5, 0.24], 0.4, 0.25],
    [[-0.22, 0.76], [-0.02, 0.15], 0.46, 0.35],
    [[0.16, 0.78], [0.4, 0.19], 0.44, 0.4],
    [[0.52, 0.68], [0.78, 0.3], 0.4, 0.4],
    [[0.02, 0.84], [0.16, 0.46], 0.3, 0.3],
  ],
  parted: [
    [[-0.05, 0.88], [-0.22, 0.34], 0.36, -0.3],
    [[0.05, 0.88], [0.22, 0.34], 0.36, 0.3],
    [[-0.26, 0.8], [-0.5, 0.2], 0.42, -0.35],
    [[0.26, 0.8], [0.5, 0.2], 0.42, 0.35],
    [[-0.56, 0.66], [-0.82, 0.08], 0.38, -0.25],
    [[0.56, 0.66], [0.82, 0.08], 0.38, 0.25],
  ],
  blunt: [
    [[-0.62, 0.66], [-0.68, 0.22], 0.4, -0.12],
    [[-0.31, 0.75], [-0.34, 0.18], 0.42, -0.06],
    [[0, 0.77], [0, 0.17], 0.42, 0],
    [[0.31, 0.75], [0.34, 0.18], 0.42, 0.06],
    [[0.62, 0.66], [0.68, 0.22], 0.4, 0.12],
  ],
};

function fringe(b, c, R, color, kind, mirror = 1) {
  for (const [base, tip, width, bend] of FRINGES[kind]) {
    lock(b, c, R, color, [base[0] * mirror, base[1]], [tip[0] * mirror, tip[1]], width, bend * mirror);
  }
}

function sideburns(b, c, R, color, low) {
  for (const side of [-1, 1]) {
    lock(b, c, R, color, [side * 1.2, 0.45], [side * 1.08, low], 0.3, side * 0.2);
    lock(b, c, R, color, [side * 1.48, 0.32], [side * 1.42, low - 0.06], 0.32, side * 0.15);
  }
}

function bob(b, c, R, color) {
  for (const side of [-1, 1]) {
    b.add(shapes.sphere(R * 0.5, 16, 12), color, { p: [side * R * 0.9, c - R * 0.3, -R * 0.14], s: [0.5, 1.15, 0.95] });
  }
  b.add(shapes.sphere(R * 0.88, 18, 12), color, { p: [0, c - R * 0.28, -R * 0.42], s: [1.15, 0.8, 0.78] });
}

function curls(b, c, R, color) {
  const rows = [
    [0.94, 1, 0, 0.26],
    [0.72, 8, 0, 0.24],
    [0.42, 8, 0.75, 0.24],
    [0.1, 7, 1.15, 0.24],
  ];
  for (const [height, count, gap, size] of rows) {
    const reach = Math.sqrt(Math.max(0, 1.04 - height * height)) * R;
    for (let i = 0; i < count; i++) {
      const phi = count === 1 ? 0 : gap ? gap + (i / (count - 1)) * (Math.PI * 2 - 2 * gap) : (i / count) * Math.PI * 2;
      b.add(shapes.sphere(R * size, 10, 8), color, {
        p: [Math.sin(phi) * reach * HEAD_SCALE[0], c + height * R * HEAD_SCALE[1], Math.cos(phi) * reach],
      });
    }
  }
  const fringe = Math.sqrt(1.04 - 0.6 * 0.6) * R;
  for (let i = -3; i <= 3; i++) {
    const phi = i * 0.3;
    b.add(shapes.sphere(R * 0.19, 10, 8), color, { p: [Math.sin(phi) * fringe * HEAD_SCALE[0], c + R * 0.6 * HEAD_SCALE[1], Math.cos(phi) * fringe] });
  }
}

function hair(b, c, R, { style, khan, color = HAIR }) {
  if (style === 'chom' || style === 'bachom') {
    const tufts = style === 'chom' ? [[0, 0.95, 0.18, 0.24]] : [[0, 0.97, 0, 0.22], [-0.82, 0.55, -0.1, 0.18], [0.82, 0.55, -0.1, 0.18]];
    for (const [x, y, z, r] of tufts) {
      b.add(shapes.sphere(R * r, 12, 10), color, { p: [x * R, c + y * R, z * R], s: [1, 0.85, 1] });
    }
    curl(b, c, R, color, 0, style === 'chom' ? 0.22 : 0.02, 1.1);
    return;
  }
  if (style === 'curly') {
    b.add(shapes.cap(R * 1.04, Math.PI * 0.6, 24, 10), color, { p: [0, c, 0], r: [-0.55, 0, 0], s: HEAD_SCALE });
    curls(b, c, R, color);
    return;
  }
  hairCap(b, c, R, color);
  if (style === 'bui') {
    crown(b, c, R, color, 'long');
    fringe(b, c, R, color, 'parted');
    sideburns(b, c, R, color, -0.4);
    b.add(shapes.sphere(R * 0.42, 18, 14), color, { p: [0, c + R * 0.82, -R * 1.18] });
    b.add(shapes.torus(R * 0.22, R * 0.06, 16), 0xc0392b, { p: [0, c + R * 0.72, -R * 0.98], r: [0.9, 0, 0] });
    return;
  }
  if (style === 'bob') {
    crown(b, c, R, color, 'long');
    fringe(b, c, R, color, 'blunt');
    bob(b, c, R, color);
    return;
  }
  if (style !== 'khan') crown(b, c, R, color, 'short');
  fringe(b, c, R, color, 'swept', style === 'player' ? -1 : 1);
  sideburns(b, c, R, color, -0.12);
  if (style === 'player') curl(b, c, R, color, 0, 0.05, 1.3, 0.28);
  if (style === 'khan') {
    b.add(shapes.torus(R * 1.2, R * 0.13, 28), khan, { p: [0, c + R * 0.5, -R * 0.08], r: [Math.PI / 2 - 0.3, 0, 0], s: [1.06, 1.04, 1] });
  }
}

function beard(b, c, R, color) {
  for (const side of [-1, 1]) {
    b.add(
      shapes.tube(
        [
          new THREE.Vector3(side * R * 0.04, c - R * 0.36, R * 0.99),
          new THREE.Vector3(side * R * 0.28, c - R * 0.44, R * 0.93),
          new THREE.Vector3(side * R * 0.44, c - R * 0.6, R * 0.8),
        ],
        R * 0.065,
        12,
      ),
      color,
    );
  }
  b.add(shapes.sphere(R * 0.32, 14, 10), color, { p: [0, c - R * 0.72, R * 0.7], s: [1.1, 0.9, 0.8] });
  b.add(shapes.cone(R * 0.3, R * 1.1, 14), color, { p: [0, c - R * 1.25, R * 0.72], r: [Math.PI + 0.2, 0, 0] });
}

function glasses(b, c, R) {
  const frame = 0x3a2a1c;
  for (const side of [-1, 1]) {
    b.add(shapes.torus(R * 0.16, R * 0.022, 18), frame, { p: [side * R * 0.34, c - R * 0.14, R * 1.0] });
    b.limb([side * R * 0.5, c - R * 0.12, R * 0.95], [side * R * 0.98, c - R * 0.06, R * 0.3], R * 0.016, frame, { capsule: false, seg: 5 });
  }
  b.limb([-R * 0.18, c - R * 0.1, R * 1.03], [R * 0.18, c - R * 0.1, R * 1.03], R * 0.018, frame, { capsule: false, seg: 5 });
}

const browOf = (color) => (color === HAIR ? HAIR : shade(color, 0.75));

const IRIS = [0x6a3a1e, 0x4a2a18, 0x7a4a24];

function shirtFront(b, trim, y0, rows, depth) {
  const top = rows[0];
  const bottom = rows[rows.length - 1];
  const tilt = Math.atan2(depth(0) - depth(1), top - bottom);
  b.add(shapes.box(0.014, top - bottom + 0.06, 0.01), trim, { p: [0, y0 + (top + bottom) / 2, depth(0.5) + 0.008], r: [tilt, 0, 0] });
  rows.forEach((y, i) => b.add(shapes.sphere(0.015, 8, 6), shade(trim, 1.25), { p: [0.022, y0 + y, depth(i / Math.max(1, rows.length - 1)) + 0.01] }));
}

function apronShape(b, color, { y, height, top, bottom, arc }) {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, 18, 1, true, -arc / 2, arc);
  b.add(geometry, color, { p: [0, y, 0], s: [1, 1, 0.86] });
}

function scarfShape(b, color, y) {
  b.add(shapes.torus(0.105, 0.036, 20), color, { p: [0, y, 0.01], r: [Math.PI / 2 - 0.12, 0, 0] });
  b.limb([0.07, y - 0.02, 0.1], [0.11, y - 0.17, 0.15], 0.03, color, { capsule: true, seg: 8 });
  b.add(shapes.sphere(0.03, 8, 6), shade(color, 0.75), { p: [0.11, y - 0.19, 0.15] });
}

export function createStudent(options) {
  const { shirt, pants, skin, hairColor = HAIR } = options;
  const group = new THREE.Group();
  const trim = shade(shirt, 0.7);

  part(group, [0, 0, 0], (b) => {
    b.add(shapes.sphere(0.2, 16, 12), pants, { p: [0, 0.09, 0], s: [1.2, 0.5, 0.95] });
    b.limb([-0.22, 0.07, 0.17], [0.15, 0.07, 0.04], 0.072, pants);
    b.limb([0.22, 0.07, 0.17], [-0.15, 0.07, 0.04], 0.072, pants);
    for (const side of [-1, 1]) b.add(shapes.sphere(0.058, 10, 8), skin, { p: [side * 0.25, 0.06, 0.19], s: [1, 0.7, 1.3] });
    b.add(shapes.lathe([[0, 0], [0.195, 0], [0.215, 0.05], [0.205, 0.17], [0.175, 0.28], [0.11, 0.36], [0, 0.38]], 22), shirt, {
      p: [0, 0.12, 0],
      s: [1, 1, 0.84],
    });
    b.add(shapes.torus(0.2, 0.02, 22), trim, { p: [0, 0.135, 0], r: [Math.PI / 2, 0, 0], s: [1.02, 0.84, 1] });
    b.add(shapes.torus(0.07, 0.022, 16), trim, { p: [0, 0.48, 0], r: [Math.PI / 2, 0, 0] });
    shirtFront(b, trim, 0.12, [0.28, 0.21, 0.14], (k) => 0.147 + k * 0.027);
    b.add(shapes.cylinder(0.05, 0.05, 0.06, 10), skin, { p: [0, 0.5, 0] });
  });

  const R = 0.3;
  const c = R * 0.95;
  const head = part(group, [0, 0.5, 0], (b) => {
    skull(b, c, R, skin);
    if (options.beardColor) beard(b, c, R, options.beardColor);
  });
  part(head, [0, 0, 0], (b) => hair(b, c, R, { ...options, color: hairColor }), HAIR_OUTLINE);
  const face = attachFace(head, c, R, faceSet({ iris: options.iris ?? IRIS[0], brow: browOf(hairColor), old: !!options.old, beard: !!options.beardColor }));

  const arm = (side, extra) =>
    part(group, [side * 0.17, 0.43, 0], (b) => {
      b.limb([0, 0, 0], [side * 0.01, -0.12, 0.08], 0.062, shirt);
      b.limb([side * 0.01, -0.12, 0.08], [-side * 0.04, -0.1, 0.24], 0.056, shirt, { capsule: false, radiusEnd: 0.07 });
      b.add(shapes.torus(0.066, 0.012, 14), trim, { p: [-side * 0.036, -0.1, 0.235] });
      b.add(shapes.sphere(0.056, 12, 10), skin, { p: [-side * 0.05, -0.1, 0.29] });
      extra?.(b);
    });
  const leftArm = arm(1);
  const rightArm = arm(-1, (b) => {
    b.limb([0.05, -0.12, 0.32], [0.05, 0.04, 0.32], 0.011, 0xd8c08a, { capsule: false, seg: 6 });
    b.add(shapes.cone(0.016, 0.045, 6), 0x111111, { p: [0.05, -0.14, 0.32], r: [Math.PI, 0, 0] });
  });

  return { group, head, leftArm, rightArm, face };
}

export function createTeacher() {
  const GOWN = 0x26252e;
  const EDGE = 0x45435a;
  const SKIN = 0xeab08a;
  const BEARD = 0xf6f3ec;
  const TURBAN = 0x1f1e26;
  const group = new THREE.Group();

  part(group, [0, 0, 0], (b) => {
    b.add(shapes.sphere(0.27, 18, 12), GOWN, { p: [0, 0.1, 0.02], s: [1.2, 0.5, 1.0] });
    for (const side of [-1, 1]) b.add(shapes.sphere(0.06, 10, 8), 0xf0ebe0, { p: [side * 0.27, 0.06, 0.24], s: [1, 0.7, 1.3] });
    b.add(shapes.lathe([[0, 0], [0.25, 0], [0.255, 0.06], [0.22, 0.22], [0.18, 0.34], [0.11, 0.41], [0, 0.42]], 24), GOWN, {
      p: [0, 0.12, 0],
      s: [1, 1, 0.84],
    });
    b.add(shapes.box(0.03, 0.3, 0.012), EDGE, { p: [-0.05, 0.38, 0.17], r: [0.2, 0, -0.4] });
    b.add(shapes.torus(0.075, 0.026, 16), WHITE, { p: [0, 0.53, 0], r: [Math.PI / 2, 0, 0] });
    for (const y of [0.44, 0.34]) b.add(shapes.sphere(0.015, 6, 4), GOLD, { p: [-0.12, y, 0.16] });
    b.add(shapes.cylinder(0.055, 0.055, 0.06, 10), SKIN, { p: [0, 0.55, 0] });
  });

  const R = 0.32;
  const c = R * 0.95;
  const head = part(group, [0, 0.55, 0], (b) => {
    skull(b, c, R, SKIN);
    b.add(shapes.cap(R * 1.04, Math.PI * 0.5, 22, 10), 0xdedad2, { p: [0, c, 0], r: [-1.25, 0, 0], s: HEAD_SCALE });
    b.add(shapes.cylinder(R * 1.1, R * 1.13, R * 0.52, 26), TURBAN, { p: [0, c + R * 0.64, 0] });
    b.add(shapes.cap(R * 1.527, Math.PI * 0.25, 26, 6), TURBAN, { p: [0, c - R * 0.18, 0] });
    for (const y of [0.45, 0.64, 0.83]) {
      b.add(shapes.torus(R * 1.12, R * 0.04, 26), 0x3a3846, { p: [0, c + R * y, 0], r: [Math.PI / 2, 0, 0] });
    }
    beard(b, c, R, BEARD);
    glasses(b, c, R);
  });
  const face = attachFace(head, c, R, faceSet({ iris: 0x3a2a20, brow: BEARD, old: true, beard: true }));

  const arm = (side, extra) =>
    part(group, [side * 0.21, 0.48, 0], (b) => {
      b.limb([0, 0, 0], [side * 0.01, -0.13, 0.07], 0.075, GOWN);
      b.limb([side * 0.01, -0.13, 0.07], [-side * 0.03, -0.11, 0.27], 0.07, GOWN, { capsule: false, radiusEnd: 0.095 });
      b.add(shapes.cylinder(0.075, 0.075, 0.035, 14), WHITE, { p: [-side * 0.035, -0.11, 0.29], r: [Math.PI / 2, 0, 0] });
      b.add(shapes.sphere(0.056, 12, 10), SKIN, { p: [-side * 0.04, -0.11, 0.34] });
      extra?.(b);
    });
  const leftArm = arm(1);
  const rightArm = arm(-1, (b) => {
    b.limb([0.04, -0.13, 0.33], [0.1, 0.3, 1.1], 0.015, 0xc39a5a, { capsule: false, seg: 6 });
  });

  return { group, head, leftArm, rightArm, face };
}

function conicalHat(b, c, R, color) {
  const height = R * 0.95;
  const base = c + R * 0.66;
  b.add(shapes.cone(R * 1.62, height, 30), color, { p: [0, base + height / 2, 0] });
  b.add(shapes.torus(R * 1.6, R * 0.032, 38), shade(color, 0.78), { p: [0, base + R * 0.01, 0], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.torus(R * 1.1, R * 0.02, 32), shade(color, 0.82), { p: [0, base + R * 0.31, 0], r: [Math.PI / 2, 0, 0] });
}

export function createWalker({
  shirt,
  pants,
  skin,
  style = 'toc',
  khan = 0x3a3430,
  iris = 0x6a3a1e,
  sash = null,
  hat = null,
  hairColor = HAIR,
  old = false,
  beardColor = null,
  apron = null,
  scarf = null,
  shoes = 0x6b4226,
}) {
  const group = new THREE.Group();
  const trim = shade(shirt, 0.7);

  const body = part(group, [0, 0, 0], (b) => {
    b.add(shapes.sphere(0.175, 16, 12), pants, { p: [0, 0.44, 0], s: [1.1, 0.55, 0.92] });
    b.add(shapes.lathe([[0, 0], [0.205, 0], [0.225, 0.06], [0.222, 0.18], [0.2, 0.3], [0.155, 0.4], [0.085, 0.46], [0, 0.47]], 24), shirt, {
      p: [0, 0.4, 0],
      s: [1, 1, 0.84],
    });
    b.add(shapes.torus(0.21, 0.022, 24), trim, { p: [0, 0.415, 0], r: [Math.PI / 2, 0, 0], s: [1.03, 0.84, 1] });
    if (!apron) shirtFront(b, trim, 0.4, [0.34, 0.25, 0.16], (k) => 0.155 + k * 0.031);
    if (sash) {
      b.add(shapes.torus(0.19, 0.035, 20), sash, { p: [0, 0.49, 0], r: [Math.PI / 2, 0, 0], s: [1.06, 0.86, 1] });
      b.add(shapes.sphere(0.04, 8, 6), sash, { p: [0.11, 0.49, 0.13] });
      b.limb([0.11, 0.48, 0.14], [0.13, 0.34, 0.15], 0.022, sash);
      b.limb([0.12, 0.48, 0.14], [0.17, 0.36, 0.12], 0.02, sash);
    }
    if (apron) {
      apronShape(b, apron, { y: 0.54, height: 0.28, top: 0.232, bottom: 0.242, arc: 1.7 });
      apronShape(b, apron, { y: 0.74, height: 0.13, top: 0.165, bottom: 0.215, arc: 1.05 });
      b.add(shapes.torus(0.225, 0.016, 24), shade(apron, 0.8), { p: [0, 0.67, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.86, 1] });
      b.add(shapes.torus(0.1, 0.012, 16), shade(apron, 0.8), { p: [0, 0.84, 0.02], r: [Math.PI / 2 - 0.35, 0, 0] });
    }
    b.add(shapes.torus(0.078, 0.024, 16), trim, { p: [0, 0.865, 0], r: [Math.PI / 2, 0, 0] });
    if (scarf) scarfShape(b, scarf, 0.85);
    b.add(shapes.cylinder(0.05, 0.05, 0.06, 10), skin, { p: [0, 0.89, 0] });
  });

  const R = 0.36;
  const c = R * 0.95;
  const head = part(group, [0, 0.88, 0], (b) => {
    skull(b, c, R, skin);
    if (beardColor) beard(b, c, R, beardColor);
    if (hat) conicalHat(b, c, R, hat);
  });
  part(head, [0, 0, 0], (b) => hair(b, c, R, { style, khan, color: hairColor }), HAIR_OUTLINE);
  const face = attachFace(head, c, R, faceSet({ iris, brow: browOf(hairColor), old, beard: !!beardColor }));

  const leg = (side) =>
    part(group, [side * 0.075, 0.42, 0], (b) => {
      b.limb([0, -0.02, 0], [0, -0.32, 0], 0.072, pants, { capsule: false, radiusEnd: 0.084 });
      b.add(shapes.sphere(0.062, 12, 10), shoes, { p: [0, -0.35, 0.035], s: [1, 0.68, 1.45] });
      b.add(shapes.rounded(0.11, 0.03, 0.18, 0.012), shade(shoes, 0.6), { p: [0, -0.4, 0.035] });
    });
  const leftLeg = leg(1);
  const rightLeg = leg(-1);

  const arm = (side) =>
    part(group, [side * 0.18, 0.82, 0], (b) => {
      b.limb([0, 0, 0], [side * 0.03, -0.22, 0], 0.057, shirt, { capsule: false, radiusEnd: 0.072 });
      b.add(shapes.sphere(0.058, 12, 10), shirt, { p: [0, 0, 0] });
      b.add(shapes.torus(0.068, 0.013, 16), trim, { p: [side * 0.028, -0.215, 0], r: [Math.PI / 2, 0, 0] });
      b.add(shapes.sphere(0.06, 12, 10), skin, { p: [side * 0.035, -0.285, 0], s: [1, 1.05, 0.95] });
    });
  const leftArm = arm(1);
  const rightArm = arm(-1);

  return { group, body, head, leftLeg, rightLeg, leftArm, rightArm, face };
}

export function createPlayer() {
  return createWalker({ shirt: 0x3b6fb0, pants: 0xf4efe2, skin: 0xf6caa4, style: 'player', iris: 0x7a4422, sash: 0xd8443a });
}
