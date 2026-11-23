import * as THREE from 'three';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { makeRandom } from './random.js';
import { keepCanvas } from './canvasRestore.js';
import { GROUND_LAYER } from './scenery.js';
import { createLanternGlow } from './lanternGlow.js';
import { blink, FIREFLY_GLOW, glowPoints } from './fireflies.js';
import { CROSSING, ISLE, deckHeight, inIsleSpan, isleNorth, northBank, onIsle } from './riverShape.js';

const LACQUER = 0xa12a1c;
const GILT = 0xd8b45a;
const CORD = 0x3a2414;
const STONE = 0x8a8273;
const WOOD_DARK = 0x553820;
const PANE = 0x5a4428;
const TINTS = [0xc8301c, 0xe8a030];
const LIT = new THREE.Color(0xffc46a);
const WATER_Y = 0.06;
const SHOWN = 0.02;

const CASTLE_STRING = { keepLift: 0.9, towerLift: 0.6, pole: 0.9, keepSag: 0.5, keepCount: 4, size: 0.14, drop: 0.16 };
const PLAZA_POST = { spread: 2.6, back: 0.5, height: 3.1, arm: 0.42, hang: 2.75, size: 0.22 };
const BRIDGE_POLE = { every: 4, top: 2.5, arm: 0.4, hang: 2.1, size: 0.17, sag: 0.35, count: 1, small: 0.1, drop: 0.12 };
const FLOATS = { count: 12, speed: [0.12, 0.22], margin: 10, fade: 6, bankGap: 2.2, lane: [0.25, 0.75] };
const FLIES = { count: 15, edge: 3, gap: 3, height: [0.7, 2.3], roam: [0.5, 1.6] };
const POOL = { radius: 1.6, strength: 0.22 };
const GLOW = { windows: 1.15, lanterns: 1.1, floats: 0.55, reflection: 0.6 };
const SHELL = { lit: 0.3, edge: 0.5, spread: 0.6 };
const HALO = { size: 1.1, plaza: 0.85, bridge: 0.6 };
const LAMP_LIGHT = {
  color: 0xffb466,
  plaza: { intensity: 10, distance: 7, height: 2.4, ahead: 0.8 },
  bridge: { intensity: 6, distance: 6, height: 2.2, at: [1 / 3, 2 / 3] },
};

function glowMaterial() {
  const material = toonMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0 });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor;',
    );
  };
  return material;
}

const sagAt = (a, b, s, sag) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s - sag * 4 * s * (1 - s), a[2] + (b[2] - a[2]) * s];

function festoon(frame, lamps, a, b, { sag, count, size, drop }) {
  const segments = 10;
  for (let i = 0; i < segments; i++) frame.limb(sagAt(a, b, i / segments, sag), sagAt(a, b, (i + 1) / segments, sag), 0.014, CORD, { capsule: false, seg: 4 });
  for (let k = 0; k < count; k++) {
    const [x, y, z] = sagAt(a, b, (k + 1) / (count + 1), sag);
    frame.limb([x, y, z], [x, y - drop, z], 0.01, CORD, { capsule: false, seg: 4 });
    lamps.push({ p: [x, y - drop - size * 1.4, z], size, tint: TINTS[k % 2], small: true });
  }
}

function lanternShell(b, { p: [x, y, z], size, tint }) {
  const lit = new THREE.Color(tint).lerp(LIT, SHELL.lit);
  const edge = new THREE.Color(tint).multiplyScalar(SHELL.edge);
  const paint = (_, py) => edge.clone().lerp(lit, Math.max(0, 1 - (py / size) ** 2) ** SHELL.spread);
  b.add(shapes.sphere(size, 10, 8), tint, { p: [x, y, z], s: [1, 1.25, 1], paint });
}

function lanternCaps(b, { p: [x, y, z], size }) {
  b.add(shapes.cylinder(size * 0.45, size * 0.5, size * 0.28, 8), GILT, { p: [x, y + size * 1.22, z] });
  b.add(shapes.cylinder(size * 0.5, size * 0.45, size * 0.28, 8), GILT, { p: [x, y - size * 1.22, z] });
}

function castleLamps(frame, castle) {
  const { x, z, half, towerHeight, keepTiers } = castle;
  const lamps = [];
  const keepTop = keepTiers.reduce((sum, tier) => sum + tier.h, 0);
  const keep = [x, keepTop + CASTLE_STRING.keepLift, z];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const towers = corners.map(([sx, sz], i) => {
    const tx = x + sx * half;
    const tz = z + sz * half;
    if (i >= 2) frame.add(shapes.cylinder(0.035, 0.035, CASTLE_STRING.pole, 6), WOOD_DARK, { p: [tx, towerHeight + CASTLE_STRING.pole / 2, tz] });
    return [tx, towerHeight + CASTLE_STRING.towerLift, tz];
  });
  const string = { size: CASTLE_STRING.size, drop: CASTLE_STRING.drop };
  for (const tower of towers) festoon(frame, lamps, keep, tower, { ...string, sag: CASTLE_STRING.keepSag, count: CASTLE_STRING.keepCount });
  return lamps;
}

function castleWindows(castle) {
  const { x, z, half, tower: r, towerHeight: h, keepTiers } = castle;
  const panes = [];
  const pane = (cx, cz, radius, y, dir, w, height) => {
    const [dx, dz] = dir;
    panes.push({ p: [cx + dx * radius, y, cz + dz * radius], angle: Math.atan2(dx, dz), w, h: height });
  };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) {
    const tx = x + sx * half;
    const tz = z + sz * half;
    pane(tx, tz, r * 0.925, h * 0.72, [0, -1], 0.2, 0.4);
    pane(tx, tz, r * 0.96, h * 0.4, [sx * Math.SQRT1_2, sz * Math.SQRT1_2], 0.2, 0.36);
  }
  let base = 0;
  keepTiers.forEach(({ r: tr, h: th }, i) => {
    const sides = i < 2 ? [[0, -1], [1, 0], [0, 1], [-1, 0]] : [[0, -1], [0, 1]];
    for (const dir of sides) pane(x, z, tr * 0.955, base + th * 0.6, dir, 0.24, 0.48);
    base += th;
  });
  return panes;
}

function gatePane(b, castle) {
  const front = castle.z - castle.half - castle.thick / 2 - 0.035;
  b.add(shapes.box(1.12, 1.05, 0.04), PANE, { p: [castle.x, 0.84, front] });
  b.add(shapes.sphere(0.56, 16, 8), PANE, { p: [castle.x, 1.5, front], s: [1, 1, 0.05] });
}

function bridgeLamps(frame, { postGap, railHeight, inWater }) {
  const { x: cx, z0, length } = CROSSING;
  const posts = Math.round(length / postGap);
  const lamps = [];
  for (const side of [-1, 1]) {
    const x = cx + side * (CROSSING.half + CROSSING.rail / 2);
    const poles = [];
    for (let i = 0; i <= posts; i++) {
      if (i % BRIDGE_POLE.every && i !== posts) continue;
      const z = z0 + (i * length) / posts;
      const deck = deckHeight(z);
      const bottom = deck + railHeight;
      const top = deck + BRIDGE_POLE.top;
      frame.add(shapes.cylinder(0.045, 0.055, top - bottom, 8), LACQUER, { p: [x, (top + bottom) / 2, z] });
      frame.add(shapes.sphere(0.07, 8, 6), GILT, { p: [x, top + 0.05, z] });
      const ax = x + side * BRIDGE_POLE.arm;
      const armY = top - 0.15;
      frame.limb([x, armY, z], [ax, armY, z], 0.025, LACQUER, { capsule: false, seg: 5 });
      frame.limb([ax, armY, z], [ax, deck + BRIDGE_POLE.hang + BRIDGE_POLE.size * 1.4, z], 0.01, CORD, { capsule: false, seg: 4 });
      lamps.push({ p: [ax, deck + BRIDGE_POLE.hang, z], size: BRIDGE_POLE.size, tint: TINTS[(i / BRIDGE_POLE.every) % 2 ? 1 : 0], water: inWater(z) });
      poles.push([x, top - 0.1, z]);
    }
    for (let i = 0; i + 1 < poles.length; i++) {
      const start = lamps.length;
      festoon(frame, lamps, poles[i], poles[i + 1], { sag: BRIDGE_POLE.sag, count: BRIDGE_POLE.count, size: BRIDGE_POLE.small, drop: BRIDGE_POLE.drop });
      for (const lamp of lamps.slice(start)) lamp.water = inWater(lamp.p[2]);
    }
  }
  return lamps;
}

function plazaLamps(frame, castleFront, castleX) {
  const lamps = [];
  const z = castleFront - PLAZA_POST.back;
  for (const side of [-1, 1]) {
    const x = castleX + side * PLAZA_POST.spread;
    frame.add(shapes.box(0.36, 0.3, 0.36), STONE, { p: [x, 0.15, z] });
    frame.add(shapes.cylinder(0.06, 0.08, PLAZA_POST.height, 8), LACQUER, { p: [x, PLAZA_POST.height / 2, z] });
    frame.add(shapes.sphere(0.09, 8, 6), GILT, { p: [x, PLAZA_POST.height + 0.06, z] });
    const armY = PLAZA_POST.height - 0.12;
    const az = z - PLAZA_POST.arm;
    frame.limb([x, armY, z], [x, armY, az], 0.03, LACQUER, { capsule: false, seg: 5 });
    frame.limb([x, armY, az], [x, PLAZA_POST.hang + PLAZA_POST.size * 1.4, az], 0.012, CORD, { capsule: false, seg: 4 });
    lamps.push({ p: [x, PLAZA_POST.hang, az], size: PLAZA_POST.size, tint: TINTS[0], pool: true });
  }
  return lamps;
}

function poolTexture() {
  const size = 64;
  const paint = (ctx) => {
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  };
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, paint);
}

const reflectionVertex = /* glsl */ `
  attribute vec3 spot;
  attribute vec3 glow;
  attribute vec2 size;
  attribute float phase;
  uniform float time;
  uniform float night;
  varying vec3 vGlow;
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    vec2 toward = cameraPosition.xz - spot.xz;
    float reach = length(toward);
    vec2 dir = reach > 0.001 ? toward / reach : vec2(0.0, 1.0);
    vec2 side = vec2(-dir.y, dir.x);
    float along = position.y * size.y;
    float sway = sin(time * 2.2 + along * 3.5 + phase) * 0.12 * position.y * size.x;
    vec2 xz = spot.xz + dir * along + side * (position.x * size.x * (1.0 + 0.7 * position.y) + sway);
    vGlow = glow * night;
    vUv = position.xy;
    vPhase = phase;
    gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, spot.y, xz.y, 1.0);
  }
`;

const reflectionFragment = /* glsl */ `
  uniform float time;
  varying vec3 vGlow;
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    float across = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x));
    float fall = pow(1.0 - vUv.y, 1.4) * smoothstep(0.0, 0.06, vUv.y);
    float ripple = 0.5 + 0.5 * sin(vUv.y * 34.0 - time * 3.0 + vPhase);
    gl_FragColor = vec4(vGlow * across * fall * (0.35 + 0.65 * ripple), 1.0);
  }
`;

function createReflections(count) {
  const base = new THREE.PlaneGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.attributes.position);
  const spot = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  const glow = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  const size = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  const phase = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  spot.setUsage(THREE.DynamicDrawUsage);
  glow.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('spot', spot);
  geometry.setAttribute('glow', glow);
  geometry.setAttribute('size', size);
  geometry.setAttribute('phase', phase);
  geometry.instanceCount = count;
  const uniforms = { time: { value: 0 }, night: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: reflectionVertex,
    fragmentShader: reflectionFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = GROUND_LAYER.mark + 4;
  mesh.raycast = () => {};
  const color = new THREE.Color();
  return {
    mesh,
    set(i, { x, z, tint, strength, width, length }) {
      spot.setXYZ(i, x, WATER_Y, z);
      color.setHex(tint).lerp(new THREE.Color(0xffc070), 0.5).multiplyScalar(strength);
      glow.setXYZ(i, color.r, color.g, color.b);
      size.setXY(i, width, length);
      phase.setX(i, Math.random() * Math.PI * 2);
    },
    flush() {
      spot.needsUpdate = true;
      glow.needsUpdate = true;
    },
    update(t, night) {
      uniforms.time.value = t;
      uniforms.night.value = night;
      mesh.visible = night > SHOWN;
    },
  };
}

function lotusGeometry() {
  const b = new Batch();
  b.add(shapes.cylinder(0.36, 0.38, 0.04, 14), 0x3f7a34, { p: [0, 0.02, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(shapes.sphere(0.13, 8, 6), 0xf09ab4, { p: [Math.cos(a) * 0.17, 0.1, Math.sin(a) * 0.17], s: [0.7, 1.2, 1], r: [Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5] });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    b.add(shapes.sphere(0.09, 8, 6), 0xffd2de, { p: [Math.cos(a) * 0.08, 0.15, Math.sin(a) * 0.08], s: [0.7, 1.3, 1] });
  }
  b.add(shapes.cylinder(0.04, 0.045, 0.14, 8), 0xfff2c0, { p: [0, 0.22, 0] });
  b.add(shapes.sphere(0.03, 6, 4), 0xffe08a, { p: [0, 0.32, 0], s: [1, 1.6, 1] });
  return b.geometry();
}

function channel(x) {
  const north = northBank(x) + FLOATS.bankGap;
  const south = inIsleSpan(x) ? isleNorth(x) - FLOATS.bankGap : north + 12;
  return [north, Math.max(north, south)];
}

function createFloats(rand) {
  const from = ISLE.x0 - FLOATS.margin;
  const to = ISLE.x1 + FLOATS.margin;
  const items = Array.from({ length: FLOATS.count }, () => ({
    x: from + rand() * (to - from),
    lane: FLOATS.lane[0] + rand() * (FLOATS.lane[1] - FLOATS.lane[0]),
    speed: FLOATS.speed[0] + rand() * (FLOATS.speed[1] - FLOATS.speed[0]),
    turn: rand() * Math.PI * 2,
    spin: (rand() - 0.5) * 0.3,
    phase: rand() * Math.PI * 2,
  }));
  const material = glowMaterial();
  const mesh = new THREE.InstancedMesh(lotusGeometry(), material, FLOATS.count);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  const matrix = new THREE.Matrix4();
  const spin = new THREE.Quaternion();
  const place = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const smooth = (v) => Math.min(1, Math.max(0, v / FLOATS.fade));
  return {
    mesh,
    material,
    step(t, dt, night) {
      mesh.visible = night > SHOWN;
      if (!mesh.visible) return;
      items.forEach((item, i) => {
        item.x += item.speed * dt;
        if (item.x > to) item.x = from;
        item.turn += item.spin * dt;
        const [north, south] = channel(item.x);
        const z = north + (south - north) * item.lane + Math.sin(t * 0.3 + item.phase) * 0.3;
        const fade = smooth(item.x - from) * smooth(to - item.x);
        place.set(item.x, 0.03 + Math.sin(t * 1.2 + item.phase) * 0.02, z);
        spin.setFromAxisAngle(UP, item.turn);
        mesh.setMatrixAt(i, matrix.compose(place, spin, scale.setScalar(Math.max(0.001, fade))));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function createIsleFireflies(rand, clearOfCastle) {
  const homes = [];
  for (let tries = 0; tries < FLIES.count * 40 && homes.length < FLIES.count; tries++) {
    const x = ISLE.x0 + rand() * (ISLE.x1 - ISLE.x0);
    const z = ISLE.z - ISLE.halfZ + rand() * ISLE.halfZ * 2;
    if (!onIsle(x, z, FLIES.edge) || !clearOfCastle(x, z)) continue;
    if (homes.some((home) => Math.hypot(home.x - x, home.z - z) < FLIES.gap)) continue;
    homes.push({
      x,
      z,
      y: FLIES.height[0] + rand() * (FLIES.height[1] - FLIES.height[0]),
      roam: FLIES.roam[0] + rand() * (FLIES.roam[1] - FLIES.roam[0]),
      rate: 1.4 + rand() * 1.8,
      phase: rand() * Math.PI * 2,
      drift: 0.25 + rand() * 0.35,
    });
  }
  const swarm = glowPoints(homes.length, 0.24);
  swarm.points.raycast = () => {};
  return {
    points: swarm.points,
    step(t, night) {
      swarm.points.visible = night > SHOWN;
      if (!swarm.points.visible) return;
      homes.forEach((fly, i) => {
        const a = t * fly.drift + fly.phase;
        swarm.positions[i * 3] = fly.x + Math.cos(a) * fly.roam + Math.sin(a * 2.3) * 0.25;
        swarm.positions[i * 3 + 1] = fly.y + Math.sin(a * 1.7) * 0.35;
        swarm.positions[i * 3 + 2] = fly.z + Math.sin(a * 0.8) * fly.roam;
        const k = blink(t, fly) * night;
        swarm.colors[i * 3] = FIREFLY_GLOW.r * k;
        swarm.colors[i * 3 + 1] = FIREFLY_GLOW.g * k;
        swarm.colors[i * 3 + 2] = FIREFLY_GLOW.b * k;
      });
      swarm.geometry.attributes.position.needsUpdate = true;
      swarm.geometry.attributes.color.needsUpdate = true;
    },
  };
}

export function createIsleLights({ castle, castleFront, bridge, clearOfCastle }) {
  const rand = makeRandom(9191);
  const group = new THREE.Group();
  const s = castle.scale;
  const offset = [castle.x * (1 - s), 0, castle.z * (1 - s)];

  const frame = new Batch();
  const shells = new Batch();
  const panes = new Batch();
  let castleSet = [];
  frame.group(offset, [0, 0, 0], () => {
    castleSet = castleLamps(frame, castle);
  }, s);
  shells.group(offset, [0, 0, 0], () => {
    for (const lamp of castleSet) lanternShell(shells, lamp);
  }, s);
  frame.group(offset, [0, 0, 0], () => {
    for (const lamp of castleSet) lanternCaps(frame, lamp);
  }, s);
  panes.group(offset, [0, 0, 0], () => {
    for (const { p, angle, w, h } of castleWindows(castle)) panes.add(shapes.box(w, h, 0.06), PANE, { p, r: [0, angle, 0] });
    gatePane(panes, castle);
  }, s);
  const plaza = plazaLamps(frame, castleFront, castle.x);
  const bridgeSet = bridgeLamps(frame, bridge);
  for (const lamp of [...plaza, ...bridgeSet]) {
    lanternShell(shells, lamp);
    lanternCaps(frame, lamp);
  }

  const lanternMaterial = glowMaterial();
  const paneMaterial = toonMaterial({ vertexColors: true, emissive: 0xffbf5a, emissiveIntensity: 0 });
  const frameMesh = frame.mesh(undefined, { shadow: false });
  const shellMesh = shells.mesh(lanternMaterial, { shadow: false });
  const paneMesh = panes.mesh(paneMaterial, { shadow: false });

  const haloed = [
    ...plaza.map((lamp) => ({ ...lamp, strength: HALO.plaza })),
    ...bridgeSet.filter((lamp) => !lamp.small).map((lamp) => ({ ...lamp, strength: HALO.bridge })),
  ];
  const glow = createLanternGlow(haloed.map(({ p, tint, strength }) => ({ position: new THREE.Vector3(...p), tint, intensity: strength })), { rays: false, size: HALO.size });

  const poolMaterial = new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0xffc070, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const poolShape = new THREE.PlaneGeometry(POOL.radius * 2, POOL.radius * 2).rotateX(-Math.PI / 2);
  const pools = plaza.map(({ p: [x, , z] }) => {
    const mesh = new THREE.Mesh(poolShape, poolMaterial);
    mesh.position.set(x, 0.05, z);
    mesh.renderOrder = GROUND_LAYER.mark + 3;
    mesh.raycast = () => {};
    return mesh;
  });

  const floats = createFloats(rand);
  const mirrored = bridgeSet.filter((lamp) => lamp.water && !lamp.small);
  const reflections = createReflections(mirrored.length);
  mirrored.forEach(({ p: [x, y, z], tint }, i) => {
    reflections.set(i, { x, z, tint, strength: GLOW.reflection, width: 0.45, length: Math.min(4, Math.max(1.5, y * 1.1)) });
  });
  reflections.flush();

  const fireflies = createIsleFireflies(rand, clearOfCastle);

  group.add(frameMesh, shellMesh, paneMesh, glow.object, ...pools, reflections.mesh, floats.mesh, fireflies.points);
  freeze(group);

  let night = 0;
  return {
    group,
    setNight(k) {
      night = Math.min(1, Math.max(0, k));
      lanternMaterial.emissiveIntensity = night * GLOW.lanterns;
      floats.material.emissiveIntensity = night * GLOW.floats;
      paneMaterial.emissiveIntensity = night * GLOW.windows;
      poolMaterial.opacity = night * POOL.strength;
      for (const pool of pools) pool.visible = night > SHOWN;
    },
    update(t, dt) {
      glow.update(t, night);
      reflections.update(t, night);
      fireflies.step(t, night);
      floats.step(t, dt, night);
    },
  };
}

export function createIsleLamps({ castleX, castleFront }) {
  const group = new THREE.Group();
  const { plaza, bridge } = LAMP_LIGHT;
  const lamp = (x, y, z, spec) => {
    const light = new THREE.PointLight(LAMP_LIGHT.color, 0, spec.distance, 2);
    light.position.set(x, y, z);
    group.add(light);
    return { light, spec };
  };
  const lamps = [
    lamp(castleX, plaza.height, castleFront - PLAZA_POST.back - plaza.ahead, plaza),
    ...bridge.at.map((k) => {
      const z = CROSSING.z0 + CROSSING.length * k;
      return lamp(CROSSING.x, deckHeight(z) + bridge.height, z, bridge);
    }),
  ];
  return {
    group,
    setNight(k) {
      const night = Math.min(1, Math.max(0, k));
      for (const { light, spec } of lamps) light.intensity = night * spec.intensity;
    },
  };
}
