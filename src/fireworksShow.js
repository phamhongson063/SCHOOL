import * as THREE from 'three';
import { paintedTexture } from './toon.js';
import { FIREWORKS } from './config.js';

const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
const COLORS = ['#ffd36b', '#ff7ab8', '#7fe3ff', '#a6ff8a', '#c79bff', '#ff9a5a'];
const FIELD = { yaw: 0.8, elev: [0.3, 0.85], dist: [15, 28], gap: 0.24, tries: 18, sway: [0.5, 1.5], swaySpeed: [0.18, 0.4], lift: [0.1, 0.3] };
const LAUNCH = { x: 14, z: [-2, 8], y: 0.6 };
const FAR = { yaw: 0.95, elev: [0.45, 0.95], dist: [34, 48], gap: 0.12, tries: 6, sway: [0.3, 0.8], swaySpeed: [0.15, 0.35], lift: [0.1, 0.25] };
const BASE_SIZE = 2.3;
const SHOT = { angle: 0.14, ...FIREWORKS.sky };
const AMBIENT = { angle: 0.075, rise: 0.8, hang: 4.4, fade: 1.2, pool: 12 };
const SPARKS = { count: 30, speed: [3.5, 6.5], gravity: 2.6, drag: 1.6, life: 1.5, size: 0.34, trail: 0.12 };
const TRAIL = 8;
const HALO = 1.3;
const GLYPH_CACHE = 80;
const WHITEN = 0.45;

const rand = (a, b) => a + Math.random() * (b - a);


function paintDot(ctx, size) {
  const c = size / 2;
  const dot = ctx.createRadialGradient(c, c, 0, c, c, c);
  dot.addColorStop(0, 'rgba(255,255,255,1)');
  dot.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  dot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = dot;
  ctx.fillRect(0, 0, size, size);
}

function paintHalo(ctx, size) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,255,0.55)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const length = c * (i % 2 ? 0.7 : 0.98);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a - 0.04) * length, c + Math.sin(a - 0.04) * length);
    ctx.lineTo(c + Math.cos(a + 0.04) * length, c + Math.sin(a + 0.04) * length);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paintGlyph(ctx, size, char) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `800 ${size * 0.62}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.strokeText(char, c, c * 1.05);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(char, c, c * 1.05);
}

function createTextures(inUse) {
  const glyphs = new Map();
  const dot = paintedTexture(64, 64, paintDot);
  const halo = paintedTexture(128, 128, paintHalo);
  const blank = paintedTexture(4, 4, (ctx, size) => ctx.clearRect(0, 0, size, size));
  function trim() {
    for (const [char, texture] of glyphs) {
      if (glyphs.size <= GLYPH_CACHE) return;
      if (inUse(texture)) continue;
      glyphs.delete(char);
      texture.dispose();
    }
  }
  return {
    dot,
    halo,
    blank,
    glyph(char) {
      let texture = glyphs.get(char);
      if (texture) glyphs.delete(char);
      else texture = paintedTexture(128, 128, (ctx, size) => paintGlyph(ctx, size, char));
      glyphs.set(char, texture);
      if (glyphs.size > GLYPH_CACHE) trim();
      return texture;
    },
  };
}

function createShell(textures, group, angle, glow = true) {
  const glyph = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.blank, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.halo, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  glyph.renderOrder = 12;
  halo.renderOrder = 11;
  glyph.visible = false;
  halo.visible = false;
  const count = SPARKS.count + TRAIL;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sparks = new THREE.Points(geometry, new THREE.PointsMaterial({ map: textures.dot, size: SPARKS.size, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  sparks.frustumCulled = false;
  sparks.renderOrder = 10;
  sparks.visible = false;
  group.add(sparks, halo, glyph);
  return {
    glyph,
    halo,
    sparks,
    positions,
    colors,
    velocity: Array.from({ length: SPARKS.count }, () => new THREE.Vector3()),
    from: new THREE.Vector3(),
    base: new THREE.Vector3(),
    sway: { amp: 0, speed: 0, lift: 0, since: 0 },
    to: new THREE.Vector3(),
    tint: new THREE.Color(),
    phase: 'wait',
    clock: Math.random(),
    burstAge: Infinity,
    char: null,
    word: null,
    angle,
    glow,
    size: BASE_SIZE,
    seed: Math.random() * 10,
  };
}

function hideShell(shell) {
  shell.glyph.visible = false;
  shell.halo.visible = false;
  shell.sparks.visible = false;
}

function burst(shell, scale = 1) {
  shell.burstAge = 0;
  shell.sparks.visible = true;
  shell.sparks.material.size = SPARKS.size * (shell.size / BASE_SIZE + 0.4);
  const p = shell.to;
  for (let i = 0; i < SPARKS.count; i++) {
    const v = shell.velocity[i].set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    if (v.lengthSq() < 0.01) v.set(0, 1, 0);
    v.normalize().multiplyScalar(rand(...SPARKS.speed) * scale * (shell.size / BASE_SIZE + 0.3));
    shell.positions.set([p.x, p.y, p.z], i * 3);
  }
}

function paintSparks(shell, dt, rising, head) {
  const { positions, colors, tint } = shell;
  if (rising) {
    for (let i = 0; i < SPARKS.count; i++) colors.set([0, 0, 0], i * 3);
    for (let k = 0; k < TRAIL; k++) {
      const back = k * 0.09;
      const at = (SPARKS.count + k) * 3;
      positions.set([head.x - shell.dir.x * back, head.y - shell.dir.y * back, head.z - shell.dir.z * back], at);
      const fade = 1 - k / TRAIL;
      colors.set([fade, fade * 0.85, fade * 0.6], at);
    }
  } else {
    if (shell.burstAge >= SPARKS.life) {
      shell.sparks.visible = false;
      return;
    }
    for (let k = 0; k < TRAIL; k++) colors.set([0, 0, 0], (SPARKS.count + k) * 3);
    shell.burstAge += dt;
    const life = Math.max(0, 1 - shell.burstAge / SPARKS.life);
    const drag = Math.exp(-SPARKS.drag * dt);
    for (let i = 0; i < SPARKS.count; i++) {
      const v = shell.velocity[i];
      v.multiplyScalar(drag);
      v.y -= SPARKS.gravity * dt;
      positions[i * 3] += v.x * dt;
      positions[i * 3 + 1] += v.y * dt;
      positions[i * 3 + 2] += v.z * dt;
      const twinkle = life * (0.6 + 0.4 * Math.sin(shell.burstAge * 30 + i));
      colors.set([tint.r * twinkle, tint.g * twinkle, tint.b * twinkle], i * 3);
    }
  }
  shell.sparks.geometry.attributes.position.needsUpdate = true;
  shell.sparks.geometry.attributes.color.needsUpdate = true;
}

export function createFireworksShow({ anchor, eye }) {
  const group = new THREE.Group();
  group.visible = false;
  const shells = [];
  const ambient = [];
  const textures = createTextures((texture) => shells.some((shell) => shell.glyph.material.map === texture) || ambient.some((shell) => shell.glyph.material.map === texture));
  for (let i = 0; i < AMBIENT.pool; i++) ambient.push(createShell(textures, group, AMBIENT.angle, false));
  const white = new THREE.Color(0xffffff);
  let word = null;
  let tiles = [];
  let deal = 0;
  const head = new THREE.Vector3();

  const viewer = new THREE.Vector3(eye.x, eye.y, eye.z);
  const facing = Math.atan2(anchor.x - eye.x, anchor.z - eye.z);
  const look = (point) => point.clone().sub(viewer).normalize();

  function spot(field, avoid) {
    const seen = avoid.map(look);
    let best = null;
    let bestGap = -1;
    for (let i = 0; i < field.tries; i++) {
      const yaw = facing + rand(-field.yaw, field.yaw);
      const elev = rand(...field.elev);
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
      const gap = seen.reduce((nearest, other) => Math.min(nearest, other.angleTo(dir)), Infinity);
      if (gap > bestGap) {
        best = viewer.clone().addScaledVector(dir, rand(...field.dist));
        bestGap = gap;
      }
      if (gap > field.gap * 1.5) break;
    }
    return best;
  }

  function launch(shell, char, field, timing) {
    shell.char = char;
    shell.word = word;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    shell.tint.set(color);
    shell.glyph.material.map = textures.glyph(char);
    shell.glyph.material.color.copy(shell.tint).lerp(white, WHITEN);
    shell.halo.material.color.copy(shell.tint);
    const taken = [...shells, ...ambient].filter((other) => other !== shell && other.phase !== 'wait').map((other) => other.glyph.visible ? other.glyph.position : other.to);
    shell.to.copy(spot(field, taken));
    shell.size = viewer.distanceTo(shell.to) * Math.tan(shell.angle);
    shell.sparks.material.size = SPARKS.trail * (shell.size / BASE_SIZE + 0.4);
    const side = Math.random() < 0.5 ? -1 : 1;
    shell.sway.amp = side * rand(...field.sway);
    shell.sway.speed = rand(...field.swaySpeed);
    shell.sway.lift = rand(...field.lift);
    shell.from.set(anchor.x + rand(-LAUNCH.x, LAUNCH.x), LAUNCH.y, anchor.z + rand(...LAUNCH.z));
    shell.dir = shell.to.clone().sub(shell.from).normalize();
    shell.timing = timing;
    shell.phase = 'rise';
    shell.clock = 0;
    shell.burstAge = Infinity;
    shell.sparks.visible = true;
  }

  function nextChar(shell) {
    const index = shells.indexOf(shell);
    return tiles[index] ?? null;
  }

  function step(shell, dt, t, field, timing, relaunch) {
    shell.clock += dt;
    if (shell.phase === 'wait') {
      if (shell.clock < shell.delay) return;
      const char = relaunch(shell);
      if (char) launch(shell, char, field, timing);
      else hideShell(shell);
      return;
    }
    if (shell.phase === 'rise') {
      const k = Math.min(1, shell.clock / timing.rise);
      const ease = 1 - (1 - k) ** 2;
      head.lerpVectors(shell.from, shell.to, ease);
      paintSparks(shell, dt, true, head);
      if (k >= 1) {
        shell.phase = 'hang';
        shell.clock = 0;
        burst(shell);
        shell.base.copy(shell.to);
        shell.sway.since = t;
        shell.glyph.position.copy(shell.to);
        shell.halo.position.copy(shell.to);
        shell.glyph.visible = true;
        shell.halo.visible = shell.glow;
      }
      return;
    }
    paintSparks(shell, dt, false, head);
    shell.base.y -= dt * 0.12;
    const { amp, speed, lift, since } = shell.sway;
    const age = t - since;
    shell.glyph.position.set(shell.base.x + amp * Math.sin(speed * age), shell.base.y + lift * Math.sin(speed * 1.7 * age), shell.base.z);
    shell.halo.position.copy(shell.glyph.position);
    let glow = 1;
    let grow = 1;
    if (shell.phase === 'hang') {
      const k = Math.min(1, shell.clock / 0.4);
      grow = (1 - (1 - k) ** 3) * (1 + 0.15 * Math.sin(k * Math.PI));
      if (shell.clock >= timing.hang) {
        shell.phase = 'fade';
        shell.clock = 0;
      }
    } else if (shell.phase === 'fade' || shell.phase === 'retire') {
      const span = shell.phase === 'fade' ? timing.fade : SHOT.retire;
      glow = Math.max(0, 1 - shell.clock / span);
      if (glow <= 0) {
        shell.phase = 'wait';
        shell.clock = 0;
        shell.delay = rand(...SHOT.wait);
        hideShell(shell);
        return;
      }
    } else if (shell.phase === 'pop') {
      const k = Math.min(1, shell.clock / SHOT.pop);
      glow = 1 - k;
      grow = 1 + k * 0.9;
      if (k >= 1) {
        shell.phase = 'wait';
        shell.clock = 0;
        shell.delay = rand(...SHOT.wait);
        hideShell(shell);
        return;
      }
    }
    const twinkle = 0.82 + 0.18 * Math.sin(t * 9 + shell.seed) * Math.sin(t * 3.7 + shell.seed * 2);
    shell.glyph.material.opacity = glow * twinkle;
    shell.glyph.scale.setScalar(shell.size * grow * (1 + 0.02 * Math.sin(t * 2.4 + shell.seed)));
    shell.halo.material.opacity = glow * (0.55 + 0.25 * Math.sin(t * 5.3 + shell.seed));
    shell.halo.scale.setScalar(shell.size * HALO * grow * (1 + 0.04 * Math.sin(t * 1.7 + shell.seed)));
  }

  const shotTiming = { rise: SHOT.rise, hang: SHOT.hang, fade: SHOT.fade };
  const ambientTiming = { rise: AMBIENT.rise, hang: AMBIENT.hang, fade: AMBIENT.fade };

  return {
    group,
    setWord(id, next) {
      if (id === word && next.length === tiles.length) return;
      word = id;
      tiles = [...next];
      deal += 1;
      while (shells.length < tiles.length) {
        const shell = createShell(textures, group, SHOT.angle);
        shell.delay = 0;
        shells.push(shell);
      }
      shells.forEach((shell, i) => {
        if (shell.phase === 'wait') {
          shell.clock = 0;
          shell.delay = (i / Math.max(1, tiles.length)) * SHOT.deal;
        } else {
          shell.phase = 'retire';
          shell.clock = 0;
        }
      });
    },
    clear() {
      word = null;
      tiles = [];
      for (const shell of [...shells, ...ambient]) {
        shell.phase = 'wait';
        shell.clock = 0;
        shell.delay = Infinity;
        hideShell(shell);
      }
    },
    show(on) {
      group.visible = on;
    },
    get visible() {
      return group.visible;
    },
    pick(raycaster) {
      const live = shells.filter((shell) => shell.word === word && shell.glyph.visible && (shell.phase === 'hang' || (shell.phase === 'fade' && shell.clock < SHOT.fade * 0.6)));
      const hit = raycaster.intersectObjects(live.map((shell) => shell.glyph), false)[0];
      return hit ? live.find((shell) => shell.glyph === hit.object) : null;
    },
    pop(shell) {
      shell.phase = 'pop';
      shell.clock = 0;
      shell.to.copy(shell.glyph.position);
      burst(shell, 1.5);
    },
    ambient(char) {
      const shell = ambient.find((item) => item.phase === 'wait' && !item.pending);
      if (!shell) return;
      shell.delay = 0;
      shell.clock = 0;
      shell.pending = char;
    },
    update(dt, t) {
      if (!group.visible) return;
      for (const shell of shells) {
        step(shell, dt, t, FIELD, shotTiming, (item) => {
          const char = nextChar(item);
          if (!char) item.delay = Infinity;
          return char;
        });
      }
      for (const shell of ambient) {
        if (shell.phase === 'wait' && !shell.pending) continue;
        step(shell, dt, t, FAR, ambientTiming, (item) => {
          const char = item.pending;
          item.pending = null;
          item.delay = Infinity;
          return char;
        });
      }
    },
  };
}
