import * as THREE from 'three';
import { Batch, freeze, shade, shapes } from './toon.js';
import { makeRandom } from './random.js';
import { earthMaterial, groundDecal, GROUND_LAYER, roundedRectGeometry, roundTree } from './scenery.js';
import { ROAD } from './road.js';
import { CROSSING, ISLE, deckHeight, isleNorth, northBank, onIsle } from './riverShape.js';

export const ISLE_NAME = 'Cù lao Hoài';

const WOOD = 0x7a5232;
const WOOD_LIGHT = 0x8a603a;
const WOOD_DARK = 0x553820;
const LACQUER = 0xa12a1c;
const LACQUER_DARK = 0x7a1e14;
const GILT = 0xd8b45a;
const BUSH = [0x5fae48, 0x4f9a3e, 0x6fbe52];
const PLANK = 0.32;
const POST_GAP = 1.8;
const PILE_GAP = 3.6;
const RAIL_HEIGHT = 0.9;
const STRINGER_STEP = 0.8;
const LANDING = { half: 1.3, depth: 10 };
const LANE = { half: 1.1 };
const TREES = { count: 28, gap: 6.5, edge: 4.5, tries: 600 };
const MEADOW = { x: ISLE.x + 3, z: ISLE.z + 2, radius: 9 };
const BUSHES = 40;

const landingZ = isleNorth(CROSSING.x);
export const ISLE_LOOK = { x: ISLE.x, z: ISLE.z };
export const ISLE_STAND = { x: CROSSING.x, z: landingZ + LANDING.depth - 1 };
export const ISLE_BOUNDS = { x0: ISLE.x0 - 2, z0: CROSSING.z1 - 4, x1: ISLE.x1 + 2, z1: Math.ceil(ISLE.z + ISLE.halfZ * 1.1) + 4 };

const slopeAt = (z) => (deckHeight(z + 0.05) - deckHeight(z - 0.05)) / 0.1;
const railX = (side) => CROSSING.x + side * (CROSSING.half + CROSSING.rail / 2);
const inWater = (z) => z > northBank(CROSSING.x) + 0.6 && z < landingZ - 0.6;

function bridge(b) {
  const { x: cx, half, z0, z1, length } = CROSSING;
  const planks = Math.round(length / PLANK);
  for (let i = 0; i < planks; i++) {
    const z = z0 + (i + 0.5) * (length / planks);
    b.add(shapes.box(half * 2 + 0.1, 0.07, (length / planks) * 0.92), i % 2 ? WOOD_LIGHT : WOOD, {
      p: [cx, deckHeight(z) - 0.035, z],
      r: [-Math.atan(slopeAt(z)), 0, 0],
    });
  }
  for (let z = z0; z < z1 - 1e-6; z += STRINGER_STEP) {
    const next = Math.min(z1, z + STRINGER_STEP);
    for (const side of [-1, 1]) {
      const x = cx + side * (half - 0.2);
      b.limb([x, deckHeight(z) - 0.14, z], [x, deckHeight(next) - 0.14, next], 0.09, WOOD_DARK, { capsule: false, seg: 6 });
    }
  }
  for (let z = z0 + PILE_GAP / 2; z < z1; z += PILE_GAP) {
    if (!inWater(z)) continue;
    const top = deckHeight(z) - 0.15;
    for (const side of [-1, 1]) b.limb([cx + side * (half - 0.2), -0.9, z], [cx + side * (half - 0.2), top, z], 0.12, WOOD_DARK, { capsule: false, seg: 7 });
    b.add(shapes.box(half * 2 + 0.2, 0.14, 0.16), WOOD_DARK, { p: [cx, top - 0.12, z] });
  }
  const posts = Math.round(length / POST_GAP);
  for (const side of [-1, 1]) {
    const x = railX(side);
    for (let i = 0; i <= posts; i++) {
      const z = z0 + (i * length) / posts;
      const end = i === 0 || i === posts;
      const deck = deckHeight(z);
      const h = end ? RAIL_HEIGHT + 0.35 : RAIL_HEIGHT + 0.08;
      b.add(shapes.box(end ? 0.2 : 0.13, h, end ? 0.2 : 0.13), LACQUER, { p: [x, deck + h / 2 - 0.05, z] });
      b.add(shapes.sphere(end ? 0.12 : 0.07, 8, 6), end ? GILT : LACQUER_DARK, { p: [x, deck + h + 0.02, z], s: [1, 1.3, 1] });
      if (i === posts) continue;
      const next = z0 + ((i + 1) * length) / posts;
      const nextDeck = deckHeight(next);
      b.limb([x, deck + RAIL_HEIGHT, z], [x, nextDeck + RAIL_HEIGHT, next], 0.055, LACQUER, { capsule: false, seg: 6 });
      b.limb([x, deck + 0.38, z], [x, nextDeck + 0.38, next], 0.035, LACQUER_DARK, { capsule: false, seg: 5 });
      const mid = (z + next) / 2;
      b.add(shapes.box(0.04, RAIL_HEIGHT - 0.42, 0.04), LACQUER_DARK, { p: [x, deckHeight(mid) + 0.38 + (RAIL_HEIGHT - 0.38) / 2, mid] });
    }
  }
}

function pickTrees(rand) {
  const trees = [];
  const clearOfLanding = (x, z) => Math.abs(x - CROSSING.x) > LANDING.half + 3 || z > landingZ + LANDING.depth + 3;
  const clearOfMeadow = (x, z) => Math.hypot(x - MEADOW.x, z - MEADOW.z) > MEADOW.radius;
  for (let i = 0; i < TREES.tries && trees.length < TREES.count; i++) {
    const x = ISLE.x0 + rand() * (ISLE.x1 - ISLE.x0);
    const z = ISLE.z - ISLE.halfZ + rand() * ISLE.halfZ * 2;
    if (!onIsle(x, z, TREES.edge) || !clearOfLanding(x, z) || !clearOfMeadow(x, z)) continue;
    if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < TREES.gap)) continue;
    trees.push({ x, z, h: 4 + Math.floor(rand() * 2) });
  }
  return trees;
}

function bushes(b, rand, trees) {
  let placed = 0;
  for (let i = 0; i < BUSHES * 6 && placed < BUSHES; i++) {
    const x = ISLE.x0 + rand() * (ISLE.x1 - ISLE.x0);
    const z = ISLE.z - ISLE.halfZ + rand() * ISLE.halfZ * 2;
    if (!onIsle(x, z, 2.5) || Math.abs(x - CROSSING.x) < LANDING.half + 1.5) continue;
    if (trees.some((tree) => Math.hypot(tree.x + 0.5 - x, tree.z + 0.5 - z) < 1.6)) continue;
    const r = 0.35 + rand() * 0.35;
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      b.add(shapes.ico(r * (0.7 + rand() * 0.4), 1), shade(BUSH[k], 0.9 + rand() * 0.2), {
        p: [x + Math.cos(a) * r * 0.6, r * 0.55, z + Math.sin(a) * r * 0.6],
        s: [1, 0.8, 1],
        flat: true,
      });
    }
    placed++;
  }
}

export function createRiverIsle() {
  const trees = pickTrees(makeRandom(7171));
  const rails = [-1, 1].map((side) => ({
    minX: railX(side) - CROSSING.rail / 2,
    maxX: railX(side) + CROSSING.rail / 2,
    minZ: CROSSING.z0,
    maxZ: CROSSING.z1,
    minY: -1,
    maxY: 4,
  }));
  const obstacles = [...rails, ...trees.map(({ x, z }) => ({ minX: x + 0.2, minZ: z + 0.2, maxX: x + 0.8, maxZ: z + 0.8, minY: 0, maxY: 3 }))];
  let built = null;

  function build() {
    const group = new THREE.Group();
    const earth = earthMaterial();
    const paths = [
      groundDecal(roundedRectGeometry(CROSSING.x - LANE.half, ROAD.z1 - 0.5, CROSSING.x + LANE.half, CROSSING.z0 + 0.5, 0.5), earth, GROUND_LAYER.earth),
      groundDecal(roundedRectGeometry(CROSSING.x - LANDING.half, landingZ + 0.5, CROSSING.x + LANDING.half, landingZ + LANDING.depth, 0.6), earth, GROUND_LAYER.earth),
    ];
    group.add(...paths);
    const deck = new Batch();
    bridge(deck);
    const bridgeMesh = deck.mesh();
    bridgeMesh.renderOrder = GROUND_LAYER.mark + 2;
    const b = new Batch();
    const rand = makeRandom(7272);
    for (const tree of trees) roundTree(b, rand, tree);
    bushes(b, rand, trees);
    const details = b.mesh();
    group.add(bridgeMesh, details);
    freeze(group);
    return { group, clickables: [bridgeMesh, ...paths], obstacles: [] };
  }

  return {
    obstacles,
    region: {
      id: 'isle',
      name: ISLE_NAME,
      bounds: ISLE_BOUNDS,
      staticNav: true,
      load() {
        built ??= build();
        return built;
      },
    },
  };
}
