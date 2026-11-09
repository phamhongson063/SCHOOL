import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';

const HALO_SIZE = 2.8;
const WARM = new THREE.Color(0xffc070);

function paintHalo(ctx, size) {
  const c = size / 2;
  ctx.globalCompositeOperation = 'lighter';
  const rays = 10;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const length = c * (i % 2 ? 0.62 : 0.98);
    const spread = i % 2 ? 0.07 : 0.05;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, length);
    gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(angle - spread) * length, c + Math.sin(angle - spread) * length);
    ctx.lineTo(c + Math.cos(angle + spread) * length, c + Math.sin(angle + spread) * length);
    ctx.closePath();
    ctx.fill();
  }
  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.55);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
}

function haloTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paintHalo(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paintHalo(ctx, size));
}

const vertexShader = /* glsl */ `
  attribute vec3 tint;
  attribute float phase;
  uniform float time;
  uniform float night;
  uniform float scale;
  uniform float steady;
  varying vec3 vTint;
  varying float vGlow;
  varying float vSpin;
  void main() {
    float flicker = mix(0.62 + 0.2 * sin(time * 2.1 + phase) + 0.12 * sin(time * 5.3 + phase * 2.7) + 0.06 * sin(time * 11.0 + phase * 4.1), 0.9, steady);
    vGlow = night * flicker;
    vTint = tint;
    vSpin = time * 0.3 + phase;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = scale * (0.75 + 0.45 * flicker) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vTint;
  varying float vGlow;
  varying float vSpin;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin);
    float s = sin(vSpin);
    p = mat2(c, -s, s, c) * p + 0.5;
    float a = texture2D(map, p).a;
    gl_FragColor = vec4(vTint * a * vGlow, 1.0);
  }
`;

export function createLanternGlow(lights, { warmth = 0.55, steady = false } = {}) {
  const positions = new Float32Array(lights.length * 3);
  const tints = new Float32Array(lights.length * 3);
  const phases = new Float32Array(lights.length);
  const color = new THREE.Color();
  lights.forEach(({ position, tint }, i) => {
    position.toArray(positions, i * 3);
    color.setHex(tint).lerp(WARM, warmth).toArray(tints, i * 3);
    phases[i] = Math.random() * Math.PI * 2;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 3));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  geometry.computeBoundingSphere();

  const uniforms = {
    map: { value: haloTexture() },
    time: { value: 0 },
    night: { value: 0 },
    scale: { value: 1 },
    steady: { value: steady ? 1 : 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 5;
  const buffer = new THREE.Vector2();
  points.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(buffer);
    uniforms.scale.value = (HALO_SIZE * buffer.y) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  };

  return {
    object: points,
    update(t, night) {
      uniforms.time.value = t;
      uniforms.night.value = night;
      points.visible = night > 0.02;
    },
  };
}
