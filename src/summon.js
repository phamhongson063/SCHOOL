import * as THREE from 'three';
import { keepCanvas } from './canvasRestore.js';
import { makeRandom } from './random.js';

const DAY_KEY = 'truong-lang-xua.summonDay';
const SPARKS = 90;
const DURATION = { vanish: 1.3, appear: 1.2 };
const VEIL_MS = 450;
const PILLAR_HEIGHT = 3.4;
const TINTS = [0xfff2b0, 0xffd76a, 0xffffff, 0xbfe8ff];
const TAU = Math.PI * 2;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => v * v * (3 - 2 * v);

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return keepCanvas(texture, (ctx) => paint(ctx, width, height));
}

function sparkTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function pillarTexture() {
  return canvasTexture(4, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function createSummonFx(scene) {
  const positions = new Float32Array(SPARKS * 3);
  const colors = new Float32Array(SPARKS * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    size: 0.16,
    map: sparkTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(geometry, sparkMaterial);
  sparks.frustumCulled = false;
  sparks.visible = false;

  const pillarMaterial = new THREE.MeshBasicMaterial({
    map: pillarTexture(),
    color: 0xfff1c0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, PILLAR_HEIGHT, 24, 1, true), pillarMaterial);
  pillar.frustumCulled = false;
  pillar.visible = false;
  scene.add(sparks, pillar);

  const color = new THREE.Color();
  const seeds = Array.from({ length: SPARKS }, (_, i) => {
    color.setHex(TINTS[i % TINTS.length]).toArray(colors, i * 3);
    return { angle: 0, radius: 0, spin: 0, height: 0, delay: 0 };
  });
  let run = null;

  function placeSparks(k) {
    const { kind, origin } = run;
    for (const [i, s] of seeds.entries()) {
      const u = clamp01((k - s.delay) / (1 - s.delay));
      let r;
      let y;
      if (kind === 'vanish') {
        r = s.radius * (1 - u * 0.6);
        y = s.height * 0.5 + smooth(u) * 3.2;
      } else {
        r = s.radius * (0.25 + (1 - u) * 0.9);
        y = 3.4 - smooth(u) * (3.4 - s.height * 0.6);
      }
      const a = s.angle + s.spin * u * 2.4;
      positions[i * 3] = origin.x + Math.cos(a) * r;
      positions[i * 3 + 1] = origin.y + y;
      positions[i * 3 + 2] = origin.z + Math.sin(a) * r;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  function scaleModels(k) {
    const { kind, models, bases } = run;
    for (const [i, model] of models.entries()) {
      const base = bases[i];
      if (kind === 'vanish') {
        const e = smooth(clamp01((k - 0.15) / 0.7));
        const w = Math.max(0.001, 1 - e);
        const h = Math.max(0.001, (1 - e) * (1 + e * 1.4));
        model.scale.set(base.x * w, base.y * h, base.z * w);
      } else {
        const e = smooth(clamp01((k - 0.3) / 0.6));
        const s = Math.max(0.001, e + Math.sin(e * Math.PI) * 0.15);
        model.scale.set(base.x * s, base.y * s, base.z * s);
      }
    }
  }

  function apply(k) {
    placeSparks(k);
    scaleModels(k);
    const glow = Math.sin(Math.PI * k);
    pillarMaterial.opacity = glow * 0.6;
    const narrow = run.kind === 'vanish' ? 1 - k * 0.6 : 0.4 + (1 - k) * 0.8;
    pillar.scale.set(narrow, 1, narrow);
    sparkMaterial.opacity = 1 - smooth(clamp01((k - 0.8) / 0.2));
  }

  return {
    play(kind, origin, models, bases) {
      return new Promise((done) => {
        for (const s of seeds) {
          s.angle = Math.random() * TAU;
          s.radius = 0.2 + Math.random() * 0.55;
          s.spin = (1.2 + Math.random() * 2.4) * (Math.random() < 0.5 ? -1 : 1);
          s.height = Math.random() * 2.2;
          s.delay = Math.random() * 0.35;
        }
        geometry.attributes.color.needsUpdate = true;
        run = { kind, t: 0, origin: origin.clone(), models, bases, done };
        pillar.position.set(origin.x, origin.y + PILLAR_HEIGHT / 2, origin.z);
        sparks.visible = true;
        pillar.visible = true;
        apply(0);
      });
    },
    update(dt) {
      if (!run) return;
      run.t += dt;
      const k = Math.min(1, run.t / DURATION[run.kind]);
      apply(k);
      if (k < 1) return;
      const { done, kind, models, bases } = run;
      if (kind === 'appear') models.forEach((model, i) => model.scale.copy(bases[i]));
      run = null;
      sparks.visible = false;
      pillar.visible = false;
      done();
    },
  };
}

function loadDay() {
  try {
    return localStorage.getItem(DAY_KEY);
  } catch {
    return null;
  }
}

function planFor(day, periods) {
  const rand = makeRandom(day * 104729 + 71);
  rand();
  return { period: 1 + Math.floor(rand() * periods), offset: 10 + Math.floor(rand() * 40) };
}

export function createSummon({ scene, models, ready, inClass, prepare, teleport, settle }) {
  const fx = createSummonFx(scene);
  const dialog = document.getElementById('summonDialog');
  const ok = document.getElementById('summonOk');
  const veil = document.getElementById('summonVeil');
  let firedDay = loadDay();
  let active = false;

  const fade = (on) =>
    new Promise((done) => {
      veil.classList.toggle('on', on);
      setTimeout(done, VEIL_MS);
    });

  function markFired(day) {
    firedDay = String(day);
    try {
      localStorage.setItem(DAY_KEY, firedDay);
    } catch {}
  }

  async function run() {
    const list = models();
    const bases = list.map((model) => model.scale.clone());
    const from = prepare();
    await fx.play('vanish', from, list, bases);
    await fade(true);
    const arrival = teleport();
    await fade(false);
    await fx.play('appear', arrival.spot, list, bases);
    settle(arrival);
    active = false;
  }

  dialog.addEventListener('cancel', (event) => event.preventDefault());
  ok.addEventListener('click', () => {
    dialog.close();
    run();
  });

  return {
    get active() {
      return active;
    },
    update(dt, ctx) {
      fx.update(dt);
      if (active || String(ctx.day) === firedDay) return;
      const phase = ctx.phase;
      if (phase.kind !== 'period') return;
      const plan = planFor(ctx.day, phase.schedule.periods);
      if (phase.period < plan.period) return;
      if (phase.period === plan.period && phase.end - phase.start - phase.remaining < plan.offset) return;
      if (inClass()) {
        markFired(ctx.day);
        return;
      }
      if (!ready()) return;
      markFired(ctx.day);
      active = true;
      dialog.showModal();
      ok.focus({ preventScroll: true });
    },
  };
}
