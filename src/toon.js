import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let gradient = null;
let celGradient = null;
let sharedVertex = null;
let sharedCharacter = null;
let sharedOutline = null;

export function characterGradient() {
  if (!celGradient) {
    celGradient = new THREE.DataTexture(new Uint8Array([170, 255]), 2, 1, THREE.RedFormat);
    celGradient.minFilter = THREE.NearestFilter;
    celGradient.magFilter = THREE.NearestFilter;
    celGradient.generateMipmaps = false;
    celGradient.needsUpdate = true;
  }
  return celGradient;
}

export function characterMaterial() {
  sharedCharacter ??= toonMaterial({ vertexColors: true, gradientMap: characterGradient() });
  return sharedCharacter;
}

export function gradientMap() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([120, 180, 228, 255]), 4, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function toonMaterial(options = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: gradientMap(), ...options });
}

export function vertexMaterial() {
  sharedVertex ??= toonMaterial({ vertexColors: true });
  return sharedVertex;
}

export function outlineMaterial() {
  sharedOutline ??= new THREE.MeshBasicMaterial({ color: 0x2b1c12, side: THREE.BackSide });
  return sharedOutline;
}

export function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

export const shapes = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  rounded: (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, Math.max(0.001, Math.min(r, w / 2, h / 2, d / 2) - 0.001)),
  cylinder: (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg),
  sphere: (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h),
  cap: (r, thetaLength, w = 16, h = 8) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, thetaLength),
  capsule: (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg),
  cone: (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg),
  ico: (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail),
  torus: (r, tube, seg = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, 6, seg, arc),
  lathe: (points, seg = 16) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg),
  tube: (points, radius, seg = 32) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, radius, 6),
};

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const KEEP = new Set(['position', 'normal', 'uv']);

export class Batch {
  constructor() {
    this.parts = [];
    this.base = new THREE.Matrix4();
  }

  add(geometry, hex, t = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    for (const name of Object.keys(g.attributes)) {
      if (!KEEP.has(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (t.flat || !g.attributes.normal) g.computeVertexNormals();

    dummy.position.fromArray(t.p ?? [0, 0, 0]);
    if (t.q) dummy.quaternion.copy(t.q);
    else {
      const r = t.r ?? [0, 0, 0];
      dummy.rotation.set(r[0], r[1], r[2], t.order ?? 'XYZ');
    }
    const s = t.s ?? 1;
    if (typeof s === 'number') dummy.scale.setScalar(s);
    else dummy.scale.fromArray(s);
    dummy.updateMatrix();

    color.set(hex);
    const position = g.attributes.position;
    const count = position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      if (t.paint) color.set(t.paint(position.getX(i), position.getY(i), position.getZ(i)));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.base, dummy.matrix));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
    return this;
  }

  limb(from, to, radius, hex, { capsule = true, radiusEnd = radius, seg = 10 } = {}) {
    const a = new THREE.Vector3().fromArray(from);
    const b = new THREE.Vector3().fromArray(to);
    const dir = b.clone().sub(a);
    const len = Math.max(0.001, dir.length());
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    const geometry = capsule ? shapes.capsule(radius, len, seg) : shapes.cylinder(radiusEnd, radius, len, seg);
    return this.add(geometry, hex, { p: a.add(b).multiplyScalar(0.5).toArray(), q });
  }

  group(p, r, fn) {
    const saved = this.base.clone();
    dummy.position.fromArray(p);
    dummy.rotation.set(r[0], r[1], r[2]);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    this.base.multiply(dummy.matrix);
    fn();
    this.base.copy(saved);
    return this;
  }

  geometry() {
    const merged = mergeGeometries(this.parts, false);
    for (const part of this.parts) part.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }

  mesh(material = vertexMaterial(), { outline = 0, shadow = true } = {}) {
    const geometry = this.geometry();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    if (outline > 0) mesh.add(createOutline(geometry, outline));
    return mesh;
  }
}

export function createOutline(geometry, thickness) {
  const position = geometry.attributes.position.array;
  const normal = geometry.attributes.normal.array;
  const out = new Float32Array(position.length);
  for (let i = 0; i < position.length; i++) out[i] = position[i] + normal[i] * thickness;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, outlineMaterial());
  mesh.raycast = () => {};
  return mesh;
}

export function canvasTexture(size, paint, repeat = [1, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
