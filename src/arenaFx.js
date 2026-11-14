import * as THREE from 'three';

const CHEST = 1.15;
const FLIGHT = 0.45;
const ARC = 0.9;
const TRAIL = 9;
const TRAIL_GAP = 0.035;
const SPARKS = 14;
const GRAVITY = 7;
const WARP = { life: 1.15, height: 7 };
const CHARGE = { life: 0.85, motes: 12 };
const LABEL = { life: 1.5, rise: 0.9, head: 2.15, width: 2.6, height: 0.65 };
const SHIELD = { life: 0.6 };

const TAU = Math.PI * 2;
const between = (a, b) => a + Math.random() * (b - a);
const easeOut = (k) => 1 - (1 - k) ** 3;

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function radial(ctx, size, stops) {
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [at, alpha] of stops) gradient.addColorStop(at, `rgba(255, 255, 255, ${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

const GLOW = canvasTexture(128, 128, (ctx, size) =>
  radial(ctx, size, [
    [0, 1],
    [0.18, 0.95],
    [0.42, 0.45],
    [0.7, 0.12],
    [1, 0],
  ]),
);

const CORE = canvasTexture(64, 64, (ctx, size) =>
  radial(ctx, size, [
    [0, 1],
    [0.35, 1],
    [0.6, 0.5],
    [1, 0],
  ]),
);

const SPARK = canvasTexture(64, 64, (ctx, size) => {
  const c = size / 2;
  radial(ctx, size, [
    [0, 1],
    [0.2, 0.7],
    [0.5, 0],
  ]);
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, h] of [
    [size, 3],
    [3, size],
  ]) {
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(c - w / 2, c - h / 2, w, h);
  }
});

const RING = canvasTexture(128, 128, (ctx, size) =>
  radial(ctx, size, [
    [0, 0],
    [0.62, 0],
    [0.8, 0.9],
    [0.86, 1],
    [0.94, 0.35],
    [1, 0],
  ]),
);

const RUNE = canvasTexture(256, 256, (ctx, size) => {
  const c = size / 2;
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.9, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.74, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, c * 0.32, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const inner = i % 2 ? 0.76 : 0.79;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * c * inner, c + Math.sin(a) * c * inner);
    ctx.lineTo(c + Math.cos(a) * c * 0.88, c + Math.sin(a) * c * 0.88);
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  for (const turn of [0, Math.PI / 3]) {
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = turn - Math.PI / 2 + (i / 3) * TAU;
      const x = c + Math.cos(a) * c * 0.72;
      const y = c + Math.sin(a) * c * 0.72;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * c * 0.82, c + Math.sin(a) * c * 0.82, 6, 0, TAU);
    ctx.fill();
  }
});

const COLUMN = canvasTexture(128, 256, (ctx, width, height) => {
  for (let x = 0; x < width; x += 4) {
    const strength = 0.35 + 0.65 * Math.abs(Math.sin(x * 0.21) * Math.cos(x * 0.07));
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.95 * strength})`);
    gradient.addColorStop(0.35, `rgba(255, 255, 255, ${0.55 * strength})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, 0, 4, height);
  }
});

const decalGeometry = new THREE.PlaneGeometry(1, 1);
const columnGeometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);

function material(Kind, map, color, opacity, extra = {}) {
  return new Kind({ map, color, transparent: true, opacity, depthWrite: false, ...extra });
}

const sprite = (map, color, opacity = 1) => new THREE.Sprite(material(THREE.SpriteMaterial, map, color, opacity));

function decal(map, color, opacity = 1) {
  const mesh = new THREE.Mesh(decalGeometry, material(THREE.MeshBasicMaterial, map, color, opacity, { side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function labelTexture(text, color) {
  return canvasTexture(512, 128, (ctx) => {
    ctx.font = '600 58px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(10, 4, 20, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, 256, 64, 496);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 0;
    ctx.fillText(text, 256, 64, 496);
  });
}

const chestOf = (at) => new THREE.Vector3(at.x, at.y + CHEST, at.z);

export function createArenaFx(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const effects = [];

  function spawn(objects, life, step, delay = 0) {
    for (const object of objects) {
      object.visible = false;
      root.add(object);
    }
    effects.push({ objects, life, step, age: -delay });
  }

  function later(delay, run) {
    effects.push({ objects: [], life: 1, step: run, age: -delay });
  }

  function dispose(effect) {
    for (const object of effect.objects) {
      root.remove(object);
      if (effect.ownsMap) object.material.map.dispose();
      object.material.dispose();
    }
  }

  function motes(base, color, { count, radius, rise, life, size, delay = 0 }) {
    const items = Array.from({ length: count }, () => {
      const a = Math.random() * TAU;
      const r = Math.sqrt(Math.random()) * radius;
      return { mesh: sprite(SPARK, color, 1), x: Math.cos(a) * r, z: Math.sin(a) * r, lift: between(0.6, 1) * rise, wait: Math.random() * 0.35, spin: between(2, 5), size: between(0.6, 1) * size };
    });
    spawn(
      items.map((item) => item.mesh),
      life,
      (k) => {
        for (const item of items) {
          const local = Math.max(0, (k - item.wait) / (1 - item.wait));
          const wobble = Math.sin(local * item.spin * Math.PI) * 0.12;
          item.mesh.position.set(base.x + item.x + wobble, base.y + item.lift * easeOut(local), base.z + item.z - wobble);
          item.mesh.scale.setScalar(item.size * (1 - local * 0.6));
          item.mesh.material.opacity = local <= 0 ? 0 : Math.min(1, local * 6) * (1 - local);
        }
      },
      delay,
    );
  }

  function runeCircle(base, color, { life, size, delay = 0 }) {
    const rune = decal(RUNE, color, 0.9);
    const glow = decal(GLOW, color, 0.6);
    rune.position.set(base.x, base.y + 0.06, base.z);
    glow.position.set(base.x, base.y + 0.04, base.z);
    spawn(
      [glow, rune],
      life,
      (k) => {
        const open = easeOut(Math.min(1, k / 0.3));
        const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        rune.scale.setScalar(size * (0.4 + 0.6 * open));
        rune.rotation.z = k * 2.4;
        rune.material.opacity = 0.9 * fade;
        glow.scale.setScalar(size * 1.2 * open);
        glow.material.opacity = 0.55 * fade;
      },
      delay,
    );
  }

  function impact(at, color, power) {
    const core = sprite(CORE, 0xffffff, 1);
    const halo = sprite(GLOW, color, 0.9);
    const wave = sprite(RING, color, 0.95);
    for (const mesh of [core, halo, wave]) mesh.position.copy(at);
    spawn([halo, wave, core], 0.5, (k) => {
      const burst = easeOut(Math.min(1, k / 0.35));
      core.scale.setScalar((0.5 + burst * 0.9) * power);
      core.material.opacity = Math.max(0, 1 - k * 2.2);
      halo.scale.setScalar((0.9 + burst * 1.8) * power);
      halo.material.opacity = 0.9 * (1 - k) ** 1.5;
      wave.scale.setScalar((0.4 + easeOut(k) * 3.2) * power);
      wave.material.opacity = 0.95 * (1 - k);
    });
    const sparks = Array.from({ length: Math.round(SPARKS * power) }, () => {
      const a = Math.random() * TAU;
      const up = between(-0.2, 0.9);
      const speed = between(2.5, 5.5) * Math.sqrt(power);
      return { mesh: sprite(SPARK, color, 1), v: new THREE.Vector3(Math.cos(a) * speed, up * speed, Math.sin(a) * speed), size: between(0.18, 0.34) * power };
    });
    spawn(
      sparks.map((spark) => spark.mesh),
      0.65,
      (k, age) => {
        for (const spark of sparks) {
          spark.mesh.position.set(at.x + spark.v.x * age, at.y + spark.v.y * age - (GRAVITY * age * age) / 2, at.z + spark.v.z * age);
          spark.mesh.scale.setScalar(spark.size * (1 - k * 0.7));
          spark.mesh.material.opacity = 1 - k * k;
        }
      },
    );
  }

  return {
    beam(at, color = 0xbfe8ff, size = 1) {
      const base = new THREE.Vector3(at.x, at.y, at.z);
      const column = new THREE.Mesh(columnGeometry, material(THREE.MeshBasicMaterial, COLUMN, color, 0.85, { side: THREE.DoubleSide }));
      const inner = new THREE.Mesh(columnGeometry, material(THREE.MeshBasicMaterial, COLUMN, 0xffffff, 0.7, { side: THREE.DoubleSide }));
      const height = WARP.height * size;
      spawn([column, inner], WARP.life, (k) => {
        const grow = easeOut(Math.min(1, k / 0.22));
        const fade = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
        const width = size * (0.75 - 0.35 * Math.max(0, k - 0.45));
        column.scale.set(width, height * grow, width);
        inner.scale.set(width * 0.45, height * grow * 0.9, width * 0.45);
        column.position.set(base.x, base.y + (height * grow) / 2, base.z);
        inner.position.set(base.x, base.y + (height * grow * 0.9) / 2, base.z);
        column.material.opacity = 0.85 * fade;
        inner.material.opacity = 0.7 * fade;
      });
      runeCircle(base, color, { life: WARP.life, size: 2.6 * size + 0.6 });
      motes(base, color, { count: 14, radius: 0.9 * size + 0.3, rise: height * 0.55, life: WARP.life, size: 0.32 });
    },
    charge(at, color) {
      const base = new THREE.Vector3(at.x, at.y, at.z);
      runeCircle(base, color, { life: CHARGE.life, size: 2.2 });
      motes(base, color, { count: CHARGE.motes, radius: 0.75, rise: 2.4, life: CHARGE.life, size: 0.3 });
      const hand = sprite(GLOW, color, 1);
      const spark = sprite(CORE, 0xffffff, 1);
      const chest = chestOf(at);
      hand.position.copy(chest);
      spark.position.copy(chest);
      spawn([hand, spark], 0.35, (k) => {
        const pulse = Math.sin(k * Math.PI);
        hand.scale.setScalar(0.5 + pulse * 1.1);
        hand.material.opacity = pulse;
        spark.scale.setScalar(0.2 + pulse * 0.35);
        spark.material.opacity = pulse;
      });
    },
    label(at, text, { color = '#ffffff', delay = 0, lift = 0, size = 1 } = {}) {
      const map = labelTexture(text, color);
      const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false }));
      mesh.renderOrder = 10;
      const base = new THREE.Vector3(at.x, at.y + LABEL.head + lift, at.z);
      spawn(
        [mesh],
        LABEL.life,
        (k) => {
          const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.22 ? 1.15 - ((k - 0.12) / 0.1) * 0.15 : 1;
          mesh.scale.set(LABEL.width * size * pop, LABEL.height * size * pop, 1);
          mesh.position.copy(base);
          mesh.position.y += LABEL.rise * Math.sqrt(k);
          mesh.material.opacity = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
        },
        delay,
      );
      effects.at(-1).ownsMap = true;
    },
    shield(at, delay = 0) {
      const chest = chestOf(at);
      const bubble = sprite(RING, 0x5fc4ff, 1);
      const fill = sprite(GLOW, 0x9ad8ff, 0.5);
      bubble.position.copy(chest);
      fill.position.copy(chest);
      spawn(
        [fill, bubble],
        SHIELD.life,
        (k) => {
          const open = easeOut(Math.min(1, k / 0.25));
          bubble.scale.setScalar(1.4 + open * 0.8);
          bubble.material.opacity = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
          fill.scale.setScalar(1.6 + open * 0.6);
          fill.material.opacity = 0.45 * (1 - k);
        },
        delay,
      );
    },
    cast(from, to, color, power = 1) {
      const start = chestOf(from);
      const end = chestOf(to);
      const pointAt = (k, out) => {
        const t = Math.min(1, Math.max(0, k));
        out.lerpVectors(start, end, t);
        out.y += Math.sin(t * Math.PI) * ARC;
        return out;
      };
      const core = sprite(CORE, 0xffffff, 1);
      const halo = sprite(GLOW, color, 1);
      const trail = Array.from({ length: TRAIL }, () => sprite(GLOW, color, 1));
      spawn([...trail, halo, core], FLIGHT, (k, age) => {
        pointAt(k, core.position);
        halo.position.copy(core.position);
        const flicker = 1 + Math.sin(age * 60) * 0.08;
        core.scale.setScalar(0.42 * power * flicker);
        halo.scale.setScalar(1.15 * power * flicker);
        halo.material.opacity = 0.95;
        trail.forEach((mesh, i) => {
          const back = k - (i + 1) * (TRAIL_GAP / FLIGHT);
          mesh.visible = back > 0;
          pointAt(back, mesh.position);
          const fade = 1 - (i + 1) / (TRAIL + 1);
          mesh.scale.setScalar(0.95 * power * fade);
          mesh.material.opacity = 0.75 * fade;
        });
      });
      later(FLIGHT, () => impact(end, color, power));
    },
    update(dt) {
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.age += dt;
        if (effect.age < 0) continue;
        const k = effect.age / effect.life;
        if (k >= 1 && effect.objects.length) {
          dispose(effect);
          effects.splice(i, 1);
          continue;
        }
        if (!effect.started) {
          effect.started = true;
          for (const object of effect.objects) object.visible = true;
        }
        effect.step(Math.min(1, k), effect.age);
        if (!effect.objects.length) effects.splice(i, 1);
      }
    },
  };
}
