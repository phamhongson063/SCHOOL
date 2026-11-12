import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';
import { BANK_ART } from './bankArt.js';

const GOLD = new THREE.Color(0xffd36b);
const MOTE = new THREE.Color(0xfff2b0);
const MOTES = 32;
const MOTE_RATE = 12;
const SPREAD = 0.75;
const PILLAR_HEIGHT = 2.4;
const POP_LIFT = 1.1;
const HEAD_LIFT = 2.4;
const POP_EVERY = 5;
const FLASH_FADE = 1.6;

function glowTexture(paint) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  paint(canvas.getContext('2d'), 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paint(ctx, 256));
}

function auraTexture() {
  return glowTexture((ctx, s) => {
    const c = s / 2;
    const fill = ctx.createRadialGradient(c, c, 0, c, c, c);
    fill.addColorStop(0, 'rgba(255,255,255,0.55)');
    fill.addColorStop(0.45, 'rgba(255,255,255,0.22)');
    fill.addColorStop(0.78, 'rgba(255,255,255,0.4)');
    fill.addColorStop(0.86, 'rgba(255,255,255,0.08)');
    fill.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, s, s);
  });
}

function runeTexture() {
  return glowTexture((ctx, s) => {
    const c = s / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.84, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = c * 0.78;
      ctx.save();
      ctx.translate(c + Math.cos(a) * r, c + Math.sin(a) * r);
      ctx.rotate(a + Math.PI / 4);
      const k = i % 3 === 0 ? 7 : 4;
      ctx.fillRect(-k / 2, -k / 2, k, k);
      ctx.restore();
    }
  });
}

function pillarTexture() {
  return glowTexture((ctx, s) => {
    const fill = ctx.createLinearGradient(0, s, 0, 0);
    fill.addColorStop(0, 'rgba(255,255,255,0.5)');
    fill.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    fill.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, s, s);
  });
}

function glowMaterial(map, color) {
  return new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
}

const moteVertex = /* glsl */ `
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

const moteFragment = /* glsl */ `
  uniform vec3 color;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(1.0, 0.0, d);
    float a = core * core * vAlpha;
    gl_FragColor = vec4(color * a, a);
  }
`;

function createMotes() {
  const positions = new Float32Array(MOTES * 3);
  const alphas = new Float32Array(MOTES);
  const sizes = new Float32Array(MOTES);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const uniforms = { color: { value: MOTE }, scale: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: moteVertex,
    fragmentShader: moteFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  const buffer = new THREE.Vector2();
  points.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(buffer);
    uniforms.scale.value = buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  };
  const motes = Array.from({ length: MOTES }, () => ({ age: 0, life: 0, x: 0, y: 0, z: 0, rise: 0, sway: 0, phase: 0, size: 0 }));
  return { points, positions, alphas, sizes, motes, geometry };
}

export function createRegen({ scene, camera, purse }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const aura = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), glowMaterial(auraTexture(), GOLD));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.04;
  aura.renderOrder = 5;
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), glowMaterial(runeTexture(), GOLD));
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.05;
  rune.renderOrder = 5;
  const pillarGeometry = new THREE.CylinderGeometry(0.9, 1.05, PILLAR_HEIGHT, 32, 1, true);
  pillarGeometry.translate(0, PILLAR_HEIGHT / 2, 0);
  const pillar = new THREE.Mesh(pillarGeometry, glowMaterial(pillarTexture(), GOLD));
  pillar.renderOrder = 5;
  const motes = createMotes();
  root.add(aura, rune, pillar, motes.points);

  const hud = document.getElementById('vitals');
  const pops = document.getElementById('regenPops');

  const screen = new THREE.Vector3();
  let spawnDebt = 0;
  let shownOn = false;
  let mark = null;
  let flash = 0;
  let motesAlive = false;

  function spawnMote(mote) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * SPREAD;
    mote.age = 0;
    mote.life = 1.5 + Math.random() * 1.1;
    mote.x = Math.cos(a) * r;
    mote.z = Math.sin(a) * r;
    mote.y = 0.08 + Math.random() * 0.3;
    mote.rise = 0.45 + Math.random() * 0.5;
    mote.sway = 0.06 + Math.random() * 0.08;
    mote.phase = Math.random() * Math.PI * 2;
    mote.size = 0.07 + Math.random() * 0.08;
  }

  function updateMotes(dt, t, amount) {
    spawnDebt += dt * MOTE_RATE * (amount > 0.5 ? 1 : 0);
    let alive = false;
    motes.motes.forEach((mote, i) => {
      if (mote.age >= mote.life && spawnDebt >= 1) {
        spawnDebt -= 1;
        spawnMote(mote);
      }
      if (mote.age < mote.life) {
        mote.age += dt;
        mote.y += mote.rise * dt;
        alive = true;
      }
      const k = Math.min(1, mote.age / mote.life);
      const wobble = Math.sin(t * 2.2 + mote.phase) * mote.sway;
      motes.positions[i * 3] = mote.x + wobble;
      motes.positions[i * 3 + 1] = mote.y;
      motes.positions[i * 3 + 2] = mote.z + Math.cos(t * 1.8 + mote.phase) * mote.sway;
      motes.alphas[i] = mote.age < mote.life ? Math.sin(Math.PI * k) * (0.6 + 0.4 * amount) : 0;
      motes.sizes[i] = mote.size * (1 - 0.4 * k);
    });
    spawnDebt = Math.min(spawnDebt, MOTES);
    motes.geometry.attributes.position.needsUpdate = true;
    motes.geometry.attributes.alpha.needsUpdate = true;
    motes.geometry.attributes.size.needsUpdate = true;
    return alive;
  }

  function pop(gained, center) {
    flash = 1;
    spawnDebt += MOTES / 2;
    floatUp([`+${gained.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}⚡`], center);
  }

  function floatUp(parts, center, lift = POP_LIFT) {
    screen.set(center.x, center.y + lift, center.z).project(camera);
    if (screen.z > 1) return;
    const el = document.createElement('span');
    el.className = 'regen-pop';
    el.append(...parts);
    el.style.left = `${((screen.x + 1) / 2) * window.innerWidth + (Math.random() - 0.5) * 36}px`;
    el.style.top = `${((1 - screen.y) / 2) * window.innerHeight}px`;
    el.addEventListener('animationend', () => el.remove());
    pops.append(el);
  }

  function flyToBag(center) {
    screen.set(center.x, center.y + HEAD_LIFT, center.z).project(camera);
    if (screen.z > 1) return;
    const bag = document.getElementById('bagBtn');
    const target = bag.getBoundingClientRect();
    const x0 = ((screen.x + 1) / 2) * window.innerWidth;
    const y0 = ((1 - screen.y) / 2) * window.innerHeight;
    const dx = target.left + target.width / 2 - x0;
    const dy = target.top + target.height / 2 - y0;
    const el = document.createElement('span');
    el.className = 'intellect-fly';
    el.textContent = '💡';
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    pops.append(el);
    const motion = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%, -90%) scale(1.6)', opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - 90}px)) scale(1.15)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45)`, opacity: 0.3 },
      ],
      { duration: 1400, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' },
    );
    motion.onfinish = () => {
      el.remove();
      bag.classList.remove('bag-glint');
      void bag.offsetWidth;
      bag.classList.add('bag-glint');
    };
  }

  function showHud(on) {
    if (on === shownOn) return;
    shownOn = on;
    hud.classList.toggle('regen', on);
  }

  return {
    coin(gained, center) {
      spawnDebt += MOTES / 2;
      const icon = document.createElement('span');
      icon.className = 'regen-coin';
      icon.innerHTML = BANK_ART.silver;
      floatUp([`+${gained}`, icon], center, HEAD_LIFT);
    },
    intellect(gained, center) {
      flash = 1;
      spawnDebt += MOTES;
      const bulb = document.createElement('span');
      bulb.className = 'regen-bulb';
      bulb.textContent = '💡';
      floatUp([`+${gained}`, bulb], center, HEAD_LIFT);
      flyToBag(center);
    },
    update(dt, t, center, amount, resting, minutes) {
      if (!resting || amount < 1) mark = null;
      else if (!mark) mark = { minutes, energy: purse.energy };
      else if (minutes - mark.minutes >= POP_EVERY) {
        const gained = purse.energy - mark.energy;
        mark = { minutes, energy: purse.energy };
        if (gained >= 0.05) pop(gained, center);
      }
      flash = Math.max(0, flash - dt / FLASH_FADE);
      showHud(resting);

      if (resting || motesAlive || spawnDebt >= 1) motesAlive = updateMotes(dt, t, resting ? amount : 0);
      root.visible = amount > 0.01 || motesAlive;
      if (!root.visible) return;
      root.position.copy(center);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      const burst = flash * flash;
      aura.material.opacity = amount * (0.55 + 0.25 * pulse + 0.6 * burst);
      aura.scale.setScalar(0.92 + 0.08 * pulse + 0.25 * burst);
      rune.material.opacity = amount * (0.7 + 0.3 * burst);
      rune.rotation.z = t * 0.35;
      pillar.material.opacity = amount * (0.22 + 0.12 * pulse + 0.35 * burst);
      pillar.scale.set(1, 0.85 + 0.15 * amount, 1);
      pillar.rotation.y = -t * 0.2;
    },
  };
}

export function createRestGlow() {
  const aura = glowMaterial(auraTexture(), GOLD);
  const rune = glowMaterial(runeTexture(), GOLD);
  const pillar = glowMaterial(pillarTexture(), GOLD);
  const auraGeometry = new THREE.PlaneGeometry(1.9, 1.9);
  const runeGeometry = new THREE.PlaneGeometry(1.6, 1.6);
  const pillarGeometry = new THREE.CylinderGeometry(0.65, 0.75, 1.7, 24, 1, true);
  pillarGeometry.translate(0, 0.85, 0);
  const runes = [];

  return {
    spawn() {
      const group = new THREE.Group();
      const disc = new THREE.Mesh(auraGeometry, aura);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.04;
      disc.renderOrder = 5;
      const ring = new THREE.Mesh(runeGeometry, rune);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      ring.renderOrder = 5;
      const beam = new THREE.Mesh(pillarGeometry, pillar);
      beam.renderOrder = 5;
      group.add(disc, ring, beam);
      group.visible = false;
      runes.push(ring);
      return group;
    },
    update(t) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
      const blink = Math.max(0, Math.sin(t * 1.3)) ** 8;
      aura.opacity = 0.4 + 0.3 * pulse + 0.4 * blink;
      rune.opacity = 0.55 + 0.25 * pulse + 0.2 * blink;
      pillar.opacity = 0.14 + 0.12 * pulse + 0.3 * blink;
      for (const ring of runes) ring.rotation.z = t * 0.35;
    },
  };
}
