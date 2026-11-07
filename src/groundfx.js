import * as THREE from 'three';

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function footTexture() {
  return canvasTexture(64, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(34, 70, 17, 30, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(31, 108, 13, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    const toes = [
      [20, 30, 7],
      [30, 25, 6],
      [39, 25, 5.5],
      [47, 29, 5],
      [53, 36, 4.5],
    ];
    for (const [x, y, r] of toes) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
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

export class Footprints {
  constructor(scene, { max = 400, life = 7 } = {}) {
    this.max = max;
    this.life = life;
    this.cursor = 0;
    this.now = 0;
    this.born = new Float32Array(max).fill(-1e9);
    this.dummy = new THREE.Object3D();

    const geometry = new THREE.PlaneGeometry(0.1, 0.18);
    geometry.rotateX(-Math.PI / 2);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.fade.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aFade', this.fade);

    const material = new THREE.MeshBasicMaterial({
      color: 0x4a3322,
      map: footTexture(),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute float aFade;\nvarying float vFade;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvFade = aFade;',
      );
      shader.fragmentShader = `varying float vFade;\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.a *= vFade;',
      );
    };

    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.raycast = () => {};
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    scene.add(this.mesh);
  }

  step(x, y, z, facing, side) {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    const rx = Math.cos(facing);
    const rz = -Math.sin(facing);
    const i = this.cursor;
    this.cursor = (i + 1) % this.max;
    this.dummy.position.set(x + rx * side * 0.075 + fx * 0.16, y + 0.015, z + rz * side * 0.075 + fz * 0.16);
    this.dummy.rotation.set(0, facing + Math.PI, 0);
    this.dummy.scale.set(side, 1, 1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.born[i] = this.now;
  }

  update(now) {
    this.now = now;
    const array = this.fade.array;
    let changed = false;
    for (let i = 0; i < this.max; i++) {
      const age = now - this.born[i];
      const value = age < 0 || age > this.life ? 0 : Math.min(1, (this.life - age) / (this.life * 0.5)) * 0.5;
      if (array[i] === value) continue;
      array[i] = value;
      changed = true;
    }
    if (changed) this.fade.needsUpdate = true;
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
