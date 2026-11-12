import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paint(ctx, width, height));
}

function blobTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

const DUST_COLOR = new THREE.Color(0xd9c7a3);

const dustVertex = /* glsl */ `
  attribute float alpha;
  attribute float size;
  uniform float scale;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 color;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.2, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(color, a);
  }
`;

export class Dust {
  constructor(scene, { max = 96 } = {}) {
    this.max = max;
    this.cursor = 0;
    this.alive = 0;
    this.last = null;
    this.puffs = Array.from({ length: max }, () => ({ age: 0, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0 }));
    this.positions = new Float32Array(max * 3);
    this.alphas = new Float32Array(max);
    this.sizes = new Float32Array(max);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry = geometry;
    const uniforms = { color: { value: DUST_COLOR }, scale: { value: 1 } };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: dustVertex, fragmentShader: dustFragment, transparent: true, depthWrite: false });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.points.raycast = () => {};
    this.points.visible = false;
    const buffer = new THREE.Vector2();
    this.points.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(buffer);
      uniforms.scale.value = buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    };
    scene.add(this.points);
  }

  puff(x, y, z, fx, fz, strong) {
    const p = this.puffs[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    if (p.age >= p.life) this.alive += 1;
    const side = (Math.random() - 0.5) * 0.5;
    const back = 0.2 + Math.random() * 0.25 + (strong ? 0.25 : 0);
    p.age = 0;
    p.life = 0.55 + Math.random() * 0.35;
    p.x = x - fx * 0.18 + fz * side * 0.2;
    p.y = y + 0.06;
    p.z = z - fz * 0.18 - fx * side * 0.2;
    p.vx = -fx * back + fz * side;
    p.vy = 0.25 + Math.random() * 0.2;
    p.vz = -fz * back - fx * side;
    p.size = (strong ? 0.34 : 0.26) * (0.85 + Math.random() * 0.3);
  }

  step(x, y, z, facing, strong = false) {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    this.puff(x, y, z, fx, fz, strong);
    if (strong) this.puff(x, y, z, fx, fz, strong);
    this.points.visible = true;
  }

  update(now) {
    const dt = this.last === null ? 0 : Math.min(0.1, Math.max(0, now - this.last));
    this.last = now;
    if (!this.alive) return;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.puffs[i];
      if (p.age >= p.life) {
        this.alphas[i] = 0;
        continue;
      }
      p.age += dt;
      const drag = Math.exp(-3 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy *= Math.exp(-1.5 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = Math.min(1, p.age / p.life);
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.alphas[i] = k >= 1 ? 0 : 0.42 * Math.min(1, k * 6) * (1 - k);
      this.sizes[i] = p.size * (1 + k * 1.6);
      if (k < 1) alive += 1;
    }
    this.alive = alive;
    this.points.visible = alive > 0;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }
}

let sharedBlob = null;

export function createBlobShadow(parent, radius = 0.3) {
  sharedBlob ??= blobTexture();
  const geometry = new THREE.CircleGeometry(radius, 24);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: sharedBlob,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  mesh.raycast = () => {};
  parent.add(mesh);
  return {
    mesh,
    place(x, y, z, lift = 0) {
      const s = Math.max(0.45, 1 - lift * 1.6);
      mesh.position.set(x, y + 0.012, z);
      mesh.scale.set(s, 1, s);
      material.opacity = 0.55 * s;
    },
    setVisible(visible) {
      mesh.visible = visible;
    },
  };
}
