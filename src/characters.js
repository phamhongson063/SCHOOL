import * as THREE from 'three';
import { Batch, shapes, shade, toonMaterial, characterMaterial, characterGradient } from './toon.js';
import { faceSet } from './faceTexture.js';

const OUTLINE = 0.008;
const WHITE = 0xfaf6ec;
const HAIR = 0x2a201b;
const GOLD = 0xf2c14e;
const UP = new THREE.Vector3(0, 1, 0);
const HEAD_SCALE = [1.05, 0.96, 1];

function part(parent, pivot, build) {
  const batch = new Batch();
  build(batch);
  const mesh = batch.mesh(characterMaterial(), { outline: OUTLINE });
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

function spike(b, base, dir, length, radius, color) {
  const d = dir.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d);
  const center = base.clone().addScaledVector(d, length / 2);
  b.add(shapes.cone(radius, length, 10), color, { p: center.toArray(), q });
}

function bangs(b, c, R, color) {
  const locks = [
    [-1.15, 0.45, 1.25, 0.2, 0.15],
    [-0.75, 0.6, 0.75, 0.19, 0.4],
    [-0.38, 0.66, 0.5, 0.18, 0.5],
    [0, 0.68, 0.42, 0.18, 0.5],
    [0.38, 0.66, 0.5, 0.18, 0.5],
    [0.75, 0.6, 0.75, 0.19, 0.4],
    [1.15, 0.45, 1.25, 0.2, 0.15],
  ];
  for (const [phi, height, length, radius, outward] of locks) {
    const radial = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    const reach = Math.sqrt(Math.max(0, 1.05 * 1.05 - height * height)) * R;
    const base = new THREE.Vector3(radial.x * reach, c + R * height, radial.z * reach);
    const dir = radial.clone().multiplyScalar(outward).add(new THREE.Vector3(0, -1, 0));
    spike(b, base, dir, R * length, R * radius, color);
  }
}

function curl(b, c, R, color, x = 0, z = 0.15, size = 1) {
  b.add(
    shapes.tube(
      [
        new THREE.Vector3(x, c + R * 0.9, R * z),
        new THREE.Vector3(x + R * 0.04 * size, c + R * (1.12 + 0.12 * size), R * (z + 0.05)),
        new THREE.Vector3(x + R * 0.1 * size, c + R * (1.2 + 0.2 * size), R * (z - 0.12)),
        new THREE.Vector3(x + R * 0.02 * size, c + R * (1.12 + 0.18 * size), R * (z - 0.25)),
      ],
      R * 0.07 * size,
      16,
    ),
    color,
  );
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
  b.add(shapes.cap(R * 1.07, Math.PI * 0.62, 24, 12), color, { p: [0, c, 0], r: [-0.55, 0, 0], s: HEAD_SCALE });
  bangs(b, c, R, color);
  if (style === 'player') curl(b, c, R, color, 0, 0.1, 1.3);
  if (style === 'bui') {
    b.add(shapes.sphere(R * 0.3, 12, 10), color, { p: [0, c + R * 0.7, -R * 0.85] });
    b.add(shapes.torus(R * 0.14, R * 0.05, 12), 0xc0392b, { p: [0, c + R * 0.62, -R * 0.68], r: [0.9, 0, 0] });
  }
  if (style === 'khan') {
    b.add(shapes.torus(R * 1.08, R * 0.11, 24), khan, { p: [0, c + R * 0.42, -R * 0.08], r: [Math.PI / 2 - 0.3, 0, 0], s: [HEAD_SCALE[0], 1, 1] });
  }
}

const IRIS = [0x6a3a1e, 0x4a2a18, 0x7a4a24];

export function createStudent(options) {
  const { shirt, pants, skin } = options;
  const group = new THREE.Group();
  const trim = shade(shirt, 0.7);

  part(group, [0, 0, 0], (b) => {
    b.add(shapes.sphere(0.2, 16, 12), pants, { p: [0, 0.09, 0], s: [1.2, 0.5, 0.95] });
    b.limb([-0.22, 0.07, 0.17], [0.15, 0.07, 0.04], 0.07, pants);
    b.limb([0.22, 0.07, 0.17], [-0.15, 0.07, 0.04], 0.07, pants);
    for (const side of [-1, 1]) b.add(shapes.sphere(0.055, 10, 8), skin, { p: [side * 0.25, 0.06, 0.19], s: [1, 0.7, 1.3] });
    b.add(shapes.lathe([[0, 0], [0.19, 0], [0.2, 0.05], [0.18, 0.2], [0.15, 0.3], [0.09, 0.37], [0, 0.38]], 20), shirt, {
      p: [0, 0.12, 0],
      s: [1, 1, 0.82],
    });
    b.add(shapes.torus(0.07, 0.02, 16), trim, { p: [0, 0.48, 0], r: [Math.PI / 2, 0, 0] });
    b.add(shapes.box(0.018, 0.2, 0.01), trim, { p: [-0.035, 0.38, 0.155], r: [0.25, 0, 0.35] });
    for (const y of [0.42, 0.34]) b.add(shapes.sphere(0.013, 6, 4), trim, { p: [-0.07, y, 0.15] });
    b.add(shapes.cylinder(0.05, 0.05, 0.06, 10), skin, { p: [0, 0.5, 0] });
  });

  const R = 0.3;
  const c = R * 0.95;
  const head = part(group, [0, 0.5, 0], (b) => {
    skull(b, c, R, skin);
    hair(b, c, R, options);
  });
  const face = attachFace(head, c, R, faceSet({ iris: options.iris ?? IRIS[0], brow: HAIR }));

  const arm = (side, extra) =>
    part(group, [side * 0.17, 0.43, 0], (b) => {
      b.limb([0, 0, 0], [side * 0.01, -0.12, 0.08], 0.06, shirt);
      b.limb([side * 0.01, -0.12, 0.08], [-side * 0.04, -0.1, 0.24], 0.055, shirt, { capsule: false, radiusEnd: 0.07 });
      b.add(shapes.sphere(0.05, 10, 8), skin, { p: [-side * 0.05, -0.1, 0.29] });
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
    b.add(shapes.lathe([[0, 0], [0.25, 0], [0.25, 0.06], [0.21, 0.22], [0.17, 0.34], [0.1, 0.41], [0, 0.42]], 22), GOWN, {
      p: [0, 0.12, 0],
      s: [1, 1, 0.82],
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
        BEARD,
      );
    }
    b.add(shapes.sphere(R * 0.32, 14, 10), BEARD, { p: [0, c - R * 0.72, R * 0.7], s: [1.1, 0.9, 0.8] });
    b.add(shapes.cone(R * 0.3, R * 1.1, 14), BEARD, { p: [0, c - R * 1.25, R * 0.72], r: [Math.PI + 0.2, 0, 0] });
  });
  const face = attachFace(head, c, R, faceSet({ iris: 0x3a2a20, brow: BEARD, old: true }));

  const arm = (side, extra) =>
    part(group, [side * 0.21, 0.48, 0], (b) => {
      b.limb([0, 0, 0], [side * 0.01, -0.13, 0.07], 0.075, GOWN);
      b.limb([side * 0.01, -0.13, 0.07], [-side * 0.03, -0.11, 0.27], 0.07, GOWN, { capsule: false, radiusEnd: 0.095 });
      b.add(shapes.cylinder(0.075, 0.075, 0.035, 14), WHITE, { p: [-side * 0.035, -0.11, 0.29], r: [Math.PI / 2, 0, 0] });
      b.add(shapes.sphere(0.052, 10, 8), SKIN, { p: [-side * 0.04, -0.11, 0.34] });
      extra?.(b);
    });
  const leftArm = arm(1);
  const rightArm = arm(-1, (b) => {
    b.limb([0.04, -0.13, 0.33], [0.1, 0.3, 1.1], 0.015, 0xc39a5a, { capsule: false, seg: 6 });
  });

  return { group, head, leftArm, rightArm, face };
}

function conicalHat(b, c, R, color) {
  const height = R * 0.85;
  b.add(shapes.cone(R * 1.45, height, 28), color, { p: [0, c + R * 0.55 + height / 2, 0] });
  b.add(shapes.torus(R * 1.43, R * 0.03, 36), shade(color, 0.78), { p: [0, c + R * 0.56, 0], r: [Math.PI / 2, 0, 0] });
  b.add(shapes.torus(R * 0.98, R * 0.018, 30), shade(color, 0.82), { p: [0, c + R * 0.84, 0], r: [Math.PI / 2, 0, 0] });
}

export function createWalker({ shirt, pants, skin, style = 'toc', khan = 0x3a3430, iris = 0x6a3a1e, sash = null, hat = null }) {
  const group = new THREE.Group();
  const trim = shade(shirt, 0.7);

  part(group, [0, 0, 0], (b) => {
    b.add(shapes.sphere(0.17, 14, 10), pants, { p: [0, 0.43, 0], s: [1.1, 0.5, 0.9] });
    b.add(shapes.lathe([[0, 0], [0.2, 0], [0.21, 0.06], [0.18, 0.26], [0.15, 0.38], [0.09, 0.45], [0, 0.46]], 20), shirt, {
      p: [0, 0.42, 0],
      s: [1, 1, 0.82],
    });
    if (sash) {
      b.add(shapes.torus(0.19, 0.035, 20), sash, { p: [0, 0.49, 0], r: [Math.PI / 2, 0, 0], s: [1.06, 0.86, 1] });
      b.add(shapes.sphere(0.04, 8, 6), sash, { p: [0.11, 0.49, 0.13] });
      b.limb([0.11, 0.48, 0.14], [0.13, 0.34, 0.15], 0.022, sash);
      b.limb([0.12, 0.48, 0.14], [0.17, 0.36, 0.12], 0.02, sash);
    }
    b.add(shapes.torus(0.075, 0.022, 16), trim, { p: [0, 0.875, 0], r: [Math.PI / 2, 0, 0] });
    b.add(shapes.box(0.018, 0.24, 0.01), trim, { p: [-0.04, 0.72, 0.155], r: [0.2, 0, 0.35] });
    for (const y of [0.78, 0.68, 0.59]) b.add(shapes.sphere(0.013, 6, 4), trim, { p: [-0.075, y, 0.15] });
    b.add(shapes.cylinder(0.05, 0.05, 0.06, 10), skin, { p: [0, 0.89, 0] });
  });

  const R = 0.36;
  const c = R * 0.95;
  const head = part(group, [0, 0.88, 0], (b) => {
    skull(b, c, R, skin);
    hair(b, c, R, { style, khan });
    if (hat) conicalHat(b, c, R, hat);
  });
  const face = attachFace(head, c, R, faceSet({ iris, brow: HAIR }));

  const leg = (side) =>
    part(group, [side * 0.075, 0.42, 0], (b) => {
      b.limb([0, -0.02, 0], [0, -0.32, 0], 0.07, pants, { capsule: false, radiusEnd: 0.082 });
      b.add(shapes.sphere(0.058, 10, 8), skin, { p: [0, -0.355, 0.03], s: [1, 0.65, 1.45] });
      b.add(shapes.rounded(0.1, 0.025, 0.17, 0.01), 0x7a4a2a, { p: [0, -0.405, 0.03] });
    });
  const leftLeg = leg(1);
  const rightLeg = leg(-1);

  const arm = (side) =>
    part(group, [side * 0.18, 0.82, 0], (b) => {
      b.limb([0, 0, 0], [side * 0.03, -0.24, 0], 0.055, shirt, { capsule: false, radiusEnd: 0.07 });
      b.add(shapes.sphere(0.055, 10, 8), shirt, { p: [0, 0, 0] });
      b.add(shapes.sphere(0.055, 10, 8), skin, { p: [side * 0.035, -0.29, 0] });
    });
  const leftArm = arm(1);
  const rightArm = arm(-1);

  return { group, head, leftLeg, rightLeg, leftArm, rightArm, face };
}

export function createPlayer() {
  return createWalker({ shirt: 0x3b6fb0, pants: 0xf4efe2, skin: 0xf6caa4, style: 'player', iris: 0x7a4422, sash: 0xd8443a });
}
