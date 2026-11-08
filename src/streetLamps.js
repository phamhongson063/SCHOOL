import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, freeze, shapes, toonMaterial } from './toon.js';
import { GROUND_LAYER } from './scenery.js';
import { ROAD, TREES } from './road.js';
import { createLanternGlow } from './lanternGlow.js';

const SPACING = 14;
const END_MARGIN = 6;
const INSET = 0.45;
const HEIGHT = 3.2;
const ARM = 0.7;
const POOL_RADIUS = 4.5;
const POOL_STRENGTH = 0.55;
const LAMP_GLOW = 1.8;
const POOL_COLOR = 0xffc27a;
const POOL_LAYER = GROUND_LAYER.mark + 3;
const TREE_CLEARANCE = 2.5;
const STONE = 0x8a8273;
const WOOD = 0x3a2414;
const BRASS = 0xb8862e;
const PAPER = 0xf6e2b0;

const BLOCKED = [
  { x0: 43.5, x1: 50.5, sides: ['south'] },
  { x0: -73, x1: -67, sides: ['south'] },
  ...TREES.map(([x, z]) => ({ x0: x - TREE_CLEARANCE, x1: x + 1 + TREE_CLEARANCE, sides: [z < ROAD.z0 ? 'north' : 'south'] })),
];

const blocked = (x, side) => BLOCKED.some((span) => span.sides.includes(side) && x >= span.x0 && x <= span.x1);

function lampSpots() {
  const spots = [];
  let northFirst = true;
  for (let x = ROAD.x0 + END_MARGIN; x <= ROAD.x1 - END_MARGIN; x += SPACING) {
    const order = northFirst ? ['north', 'south'] : ['south', 'north'];
    northFirst = !northFirst;
    const side = order.find((option) => !blocked(x, option));
    if (!side) continue;
    const toward = side === 'north' ? 1 : -1;
    spots.push({ x, z: side === 'north' ? ROAD.z0 - INSET : ROAD.z1 + INSET, toward });
  }
  return spots;
}

function poolTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStreetLamps() {
  const group = new THREE.Group();
  const spots = lampSpots();
  const posts = new Batch();
  const lamps = new Batch();
  const pools = [];
  const halos = [];

  for (const { x, z, toward } of spots) {
    const headZ = z + toward * ARM;
    posts.add(shapes.cylinder(0.16, 0.2, 0.25, 8), STONE, { p: [x, 0.125, z] });
    posts.add(shapes.cylinder(0.06, 0.075, HEIGHT, 8), WOOD, { p: [x, HEIGHT / 2, z] });
    posts.add(shapes.box(0.07, 0.07, ARM + 0.1), WOOD, { p: [x, HEIGHT - 0.1, z + (toward * ARM) / 2] });
    posts.add(shapes.cone(0.24, 0.18, 4), WOOD, { p: [x, HEIGHT - 0.32, headZ], r: [0, Math.PI / 4, 0] });
    posts.add(shapes.box(0.3, 0.04, 0.3), BRASS, { p: [x, HEIGHT - 0.74, headZ] });
    lamps.add(shapes.box(0.24, 0.32, 0.24), PAPER, { p: [x, HEIGHT - 0.56, headZ] });
    halos.push({ position: new THREE.Vector3(x, HEIGHT - 0.56, headZ), tint: 0xf2b630 });
    const pool = new THREE.CircleGeometry(POOL_RADIUS, 32);
    pool.rotateX(-Math.PI / 2);
    pool.translate(x, 0, headZ + toward * 0.6);
    pools.push(pool);
  }

  const postMesh = posts.mesh();
  const lampMaterial = toonMaterial({ vertexColors: true, emissive: 0xffb050, emissiveIntensity: 0 });
  const lampMesh = lamps.mesh(lampMaterial, { shadow: false });

  const poolMaterial = new THREE.MeshBasicMaterial({
    map: poolTexture(),
    color: POOL_COLOR,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });
  const poolMesh = new THREE.Mesh(mergeGeometries(pools, false), poolMaterial);
  for (const pool of pools) pool.dispose();
  poolMesh.position.y = 0.04;
  poolMesh.renderOrder = POOL_LAYER;
  poolMesh.visible = false;

  const glow = createLanternGlow(halos);
  group.add(postMesh, lampMesh, poolMesh, glow.object);
  freeze(group);

  let night = 0;

  return {
    group,
    setNight(k) {
      night = k;
      lampMaterial.emissiveIntensity = k * LAMP_GLOW;
      poolMaterial.opacity = k * POOL_STRENGTH;
      poolMesh.visible = k > 0.01;
    },
    update(t) {
      glow.update(t, night);
    },
  };
}
