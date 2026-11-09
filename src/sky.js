import * as THREE from 'three';
import { Batch, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { DAYLIGHT } from './config.js';
import { minuteOfDay, dayOf, DAY_MINUTES } from './clock.js';
import { keepCanvas } from './canvasRestore.js';

const SYNODIC = 29.53;
const MOON_OFFSET = 10;
const DOME = 450;
const LIGHT_DISTANCE = 60;
const MIN_SHADOW_ELEVATION = 0.2;
const LIGHT_STEP = (0.75 * Math.PI) / 180;

const DAY = {
  top: new THREE.Color(0x5aa9e6),
  horizon: new THREE.Color(0xd8ecef),
  ground: new THREE.Color(0xcfe3e0),
  hemiSky: new THREE.Color(0xf2f8ff),
  hemiGround: new THREE.Color(0x7a766e),
  ambient: new THREE.Color(0xf6f6f3),
};
const DUSK = {
  top: new THREE.Color(0x3b4f8f),
  horizon: new THREE.Color(0xf0a060),
  ground: new THREE.Color(0x8a6a60),
};
const NIGHT = {
  top: new THREE.Color(0x050a1f),
  horizon: new THREE.Color(0x18264a),
  ground: new THREE.Color(0x101828),
  hemiSky: new THREE.Color(0x46588f),
  hemiGround: new THREE.Color(0x1a1a26),
  ambient: new THREE.Color(0x5a6a9a),
};
const SUN_COLOR = new THREE.Color(0xfdfbf6);
const SUNSET_COLOR = new THREE.Color(0xffa860);
const MOON_COLOR = new THREE.Color(0xa8bcff);

const smooth = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function arcAngle(t) {
  const { sunrise, sunset } = DAYLIGHT;
  const day = sunset - sunrise;
  if (t >= sunrise && t < sunset) return ((t - sunrise) / day) * Math.PI;
  const since = t >= sunset ? t - sunset : t + DAY_MINUTES - sunset;
  return Math.PI + (since / (DAY_MINUTES - day)) * Math.PI;
}

function directionAt(angle, out) {
  return out.set(Math.cos(angle), Math.sin(angle) * 0.92, 0.38 + 0.2 * Math.sin(angle)).normalize();
}

export function moonPhase(day) {
  const age = (((day + MOON_OFFSET) % SYNODIC) + SYNODIC) % SYNODIC;
  return age / SYNODIC;
}

export function moonLight(phase) {
  return (1 - Math.cos(phase * Math.PI * 2)) / 2;
}

function domeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      ground: { value: new THREE.Color() },
      glow: { value: new THREE.Color(0xffb070) },
      glowStrength: { value: 0 },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 ground;
      uniform vec3 glow;
      uniform float glowStrength;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 color = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, ground, min(1.0, -h * 5.0));
        float facing = max(0.0, dot(dir, sunDir));
        color += glow * pow(facing, 6.0) * glowStrength * (1.0 - min(1.0, abs(h) * 2.5));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}

function discTexture(paint, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  let last = null;
  keepCanvas(texture, (ctx) => {
    if (last) paint(ctx, size, ...last);
  });
  const redraw = (...args) => {
    last = args;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    paint(ctx, size, ...args);
    texture.needsUpdate = true;
  };
  return { texture, redraw };
}

function paintSun(ctx, s) {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,250,225,1)');
  g.addColorStop(0.22, 'rgba(255,240,190,1)');
  g.addColorStop(0.3, 'rgba(255,215,140,0.55)');
  g.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

const CRATERS = [
  [-0.3, -0.2, 0.18],
  [0.25, 0.3, 0.14],
  [0.1, -0.45, 0.1],
  [-0.15, 0.4, 0.11],
  [0.45, -0.1, 0.09],
];

function paintMoon(ctx, s, phase) {
  const image = ctx.createImageData(s, s);
  const angle = phase * Math.PI * 2;
  const lx = Math.sin(angle);
  const lz = -Math.cos(angle);
  const r = s * 0.42;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const nx = (x + 0.5 - s / 2) / r;
      const ny = (y + 0.5 - s / 2) / r;
      const d2 = nx * nx + ny * ny;
      const i = (y * s + x) * 4;
      if (d2 > 1) {
        const halo = Math.max(0, 1 - (Math.sqrt(d2) - 1) / 0.18);
        image.data[i] = 220;
        image.data[i + 1] = 230;
        image.data[i + 2] = 255;
        image.data[i + 3] = halo * halo * 40 * moonLight(phase);
        continue;
      }
      const nz = Math.sqrt(1 - d2);
      const lit = nx * lx + nz * lz;
      let shade = 1;
      for (const [cx, cy, cr] of CRATERS) {
        if ((nx - cx) ** 2 + (ny - cy) ** 2 < cr * cr) shade = 0.82;
      }
      const light = THREE.MathUtils.clamp(lit * 6, 0, 1);
      image.data[i] = (70 + 180 * light) * shade;
      image.data[i + 1] = (78 + 172 * light) * shade;
      image.data[i + 2] = (110 + 130 * light) * shade;
      image.data[i + 3] = 40 + 215 * light;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function createStars() {
  const rand = makeRandom(1717);
  const count = 700;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rand();
    const v = 0.04 + rand() * 0.96;
    const a = u * Math.PI * 2;
    const h = Math.pow(v, 0.7);
    const ring = Math.sqrt(1 - h * h);
    positions.set([Math.cos(a) * ring * (DOME - 20), h * (DOME - 20), Math.sin(a) * ring * (DOME - 20)], i * 3);
    tint.setHSL(0.58 + rand() * 0.12, 0.4, 0.75 + rand() * 0.25);
    const bright = 0.45 + rand() * 0.55;
    colors.set([tint.r * bright, tint.g * bright, tint.b * bright], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 2.2,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -9;
  return points;
}

export function createSky(scene, { renderer }) {
  scene.background = null;
  scene.fog = new THREE.Fog(DAY.horizon.clone(), 70, 190);

  const sky = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME, 32, 16), domeMaterial());
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  sky.add(dome);
  const stars = createStars();
  sky.add(stars);

  const sunDisc = discTexture(paintSun);
  sunDisc.redraw();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunDisc.texture, transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.setScalar(70);
  sunSprite.renderOrder = -8;
  sky.add(sunSprite);

  const moonDisc = discTexture(paintMoon, 96);
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonDisc.texture, transparent: true, depthWrite: false, fog: false }));
  moonSprite.scale.setScalar(30);
  moonSprite.renderOrder = -7;
  sky.add(moonSprite);
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(DAY.hemiSky.clone(), DAY.hemiGround.clone(), 1.0);
  const ambient = new THREE.AmbientLight(DAY.ambient.clone(), 0.45);
  scene.add(hemi, ambient);

  const light = new THREE.DirectionalLight(SUN_COLOR.clone(), 2.2);
  light.castShadow = true;
  scene.add(light, light.target);

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const sunLightDir = new THREE.Vector3();
  const moonLightDir = new THREE.Vector3();
  const lightDir = new THREE.Vector3();
  const center = new THREE.Vector3();
  const sunTint = new THREE.Color();
  let moonDay = null;
  let phase = 0;
  let night = 0;

  function follow(position, span) {
    if (Math.hypot(position.x - center.x, position.z - center.z) >= span * 0.27) {
      center.set(Math.round(position.x / 4) * 4, 0, Math.round(position.z / 4) * 4);
    }
    light.target.position.copy(center);
    light.position.copy(center).addScaledVector(lightDir, LIGHT_DISTANCE);
  }

  return {
    light,
    get night() {
      return night;
    },
    get phase() {
      return phase;
    },
    update(minutes, camera, focus, span) {
      const day = dayOf(minutes);
      if (day !== moonDay) {
        moonDay = day;
        phase = moonPhase(day);
        moonDisc.redraw(phase);
        moonSprite.scale.setScalar(24 + 12 * moonLight(phase));
      }
      const t = minuteOfDay(minutes);
      const angle = arcAngle(t);
      directionAt(angle, sunDir);
      directionAt(angle - phase * Math.PI * 2, moonDir);
      const stepped = Math.round(angle / LIGHT_STEP) * LIGHT_STEP;
      directionAt(stepped, sunLightDir);
      directionAt(stepped - phase * Math.PI * 2, moonLightDir);
      const sunUp = sunDir.y;
      const moonUp = moonDir.y;
      const dayK = smooth(-0.12, 0.22, sunUp);
      const duskK = Math.max(0, 1 - Math.abs(sunUp) / 0.28) * (1 - smooth(0.15, 0.3, sunUp));
      night = 1 - dayK;
      const moonBright = moonLight(phase);

      const u = dome.material.uniforms;
      u.top.value.copy(NIGHT.top).lerp(DAY.top, dayK).lerp(DUSK.top, duskK * 0.5);
      u.horizon.value.copy(NIGHT.horizon).lerp(DAY.horizon, dayK).lerp(DUSK.horizon, duskK * 0.75);
      u.ground.value.copy(NIGHT.ground).lerp(DAY.ground, dayK).lerp(DUSK.ground, duskK * 0.5);
      u.sunDir.value.copy(sunDir);
      u.glowStrength.value = duskK * 0.9;
      scene.fog.color.copy(u.horizon.value);
      renderer.setClearColor(u.horizon.value);

      sky.position.copy(camera.position);
      sunSprite.position.copy(sunDir).multiplyScalar(DOME - 40);
      sunSprite.visible = sunUp > -0.15;
      sunSprite.material.color.copy(SUN_COLOR).lerp(SUNSET_COLOR, duskK);
      moonSprite.position.copy(moonDir).multiplyScalar(DOME - 50);
      moonSprite.visible = moonUp > -0.1 && moonBright > 0.02;
      moonSprite.material.opacity = 0.35 + 0.65 * night;
      stars.material.opacity = smooth(0.35, 0.95, night) * 0.95;

      hemi.color.copy(NIGHT.hemiSky).lerp(DAY.hemiSky, dayK);
      hemi.groundColor.copy(NIGHT.hemiGround).lerp(DAY.hemiGround, dayK);
      hemi.intensity = 0.84 + 0.16 * dayK;
      ambient.color.copy(NIGHT.ambient).lerp(DAY.ambient, dayK);
      ambient.intensity = 0.64 - 0.19 * dayK + 0.16 * moonBright * night;

      const sunPower = 2.2 * smooth(-0.04, 0.25, sunUp);
      const moonPower = 1.1 * moonBright * smooth(-0.02, 0.2, moonUp) * night;
      if (sunPower >= moonPower) {
        lightDir.copy(sunLightDir);
        sunTint.copy(SUN_COLOR).lerp(SUNSET_COLOR, duskK * 0.8);
        light.intensity = sunPower;
      } else {
        lightDir.copy(moonLightDir);
        sunTint.copy(MOON_COLOR);
        light.intensity = moonPower;
      }
      light.color.copy(sunTint);
      if (lightDir.y < MIN_SHADOW_ELEVATION) {
        lightDir.y = MIN_SHADOW_ELEVATION;
        lightDir.normalize();
      }
      follow(focus, span);
      return night;
    },
  };
}

const CLOUD_SPAN = 320;

export function createClouds(scene) {
  const group = new THREE.Group();
  const material = toonMaterial({ vertexColors: true, emissive: 0x8a8a8a });
  const rand = makeRandom(9);
  const dayEmissive = new THREE.Color(0x8a8a8a);
  const nightEmissive = new THREE.Color(0x10141f);

  const b = new Batch();
  for (let i = 0; i < 22; i++) {
    const puffs = 3 + Math.floor(rand() * 4);
    const cx = rand() * 300 - 150;
    const cy = 45 + rand() * 10;
    const cz = rand() * 300 - 150;
    for (let j = 0; j < puffs; j++) {
      const r = 2.2 + rand() * 2.4;
      b.add(shapes.ico(r, 1), 0xffffff, {
        p: [cx + (j - puffs / 2) * 2.6 + rand(), cy + rand() * 1.2, cz + (rand() - 0.5) * 3],
        s: [1.2, 0.7, 1],
        flat: true,
      });
    }
  }
  const geometry = b.geometry();
  for (const offset of [0, -CLOUD_SPAN]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = offset;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  scene.add(group);

  return {
    update(dt, night = 0) {
      material.emissive.copy(dayEmissive).lerp(nightEmissive, night);
      group.position.x += dt * 1.5;
      if (group.position.x >= CLOUD_SPAN) group.position.x -= CLOUD_SPAN;
    },
  };
}
