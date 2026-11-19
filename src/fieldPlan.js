import { makeRandom } from './random.js';

export const SPACING = 2;
export const BED = { height: 0.22, width: 0.84, pitch: 2.2 };

const PLOT_EDGE = { north: 27.5, south: 43.5 };
const BED_MARGIN = 0.6;
const SOIL_SIDE = 1.3;

const PLOTS = [
  { side: 'south', x: -173.2, beds: [['tay-1', 10, 2000], ['tay-2', 10, 2013], ['tay-3', 10, 2026]] },
  { side: 'south', x: -153.6, beds: [['tay-4', 10, 2039], ['tay-5', 10, 2052], ['tay-6', 10, 2065]] },
  { side: 'south', x: -119.9, beds: [['tay-7', 10, 2078], ['tay-8', 10, 2091], ['tay-9', 10, 2104]] },
  { side: 'south', x: -104.5, beds: [['tay-10', 10, 2117], ['tay-11', 10, 2130], ['tay-12', 10, 2143]] },
  { side: 'south', x: -66.7, beds: [['tay-13', 10, 2156], ['tay-14', 10, 2169], ['rau-1', 10, 999]] },
  { side: 'south', x: -51.3, beds: [['rau-2', 10, 986], ['rau-3', 10, 830], ['rau-4', 10, 817]] },
  { side: 'north', x: 46.9, beds: [['rau-5', 10, 804]] },
  { side: 'north', x: 64.3, beds: [['rau-6', 10, 791], ['rau-7', 10, 778], ['rau-8', 10, 765]] },
  { side: 'south', x: 64.8, beds: [['rau-9', 10, 752], ['rau-10', 10, 739], ['rau-11', 10, 726]] },
  { side: 'south', x: 80.4, beds: [['rau-12', 10, 713], ['rau-13', 10, 700], ['rau-14', 10, 843]] },
  { side: 'north', x: 80.9, beds: [['rau-15', 10, 856], ['rau-16', 10, 869], ['rau-17', 10, 882]] },
  { side: 'south', x: 96, beds: [['rau-18', 10, 895], ['rau-19', 10, 908], ['rau-20', 10, 921]] },
  { side: 'north', x: 96.5, beds: [['rau-21', 10, 934], ['rau-22', 10, 947], ['rau-23', 10, 960]] },
  { side: 'south', x: 113.1, beds: [['rau-24', 10, 973], ['rau-25', 10, 1012], ['rau-26', 10, 1025]] },
  { side: 'north', x: 113.6, beds: [['banco-1', 9, 1700], ['banco-2', 9, 1713], ['banco-3', 9, 1726]] },
  { side: 'north', x: 129.2, beds: [['banco-4', 9, 1739], ['banco-5', 9, 1752], ['sau-1', 10, 3000]] },
  { side: 'south', x: 130.2, beds: [['sau-2', 10, 3013], ['sau-3', 10, 3026], ['sau-4', 10, 3039]] },
  { side: 'south', x: 142.8, beds: [['sau-5', 10, 3052], ['sau-6', 10, 3065], ['sau-7', 10, 3078]] },
  { side: 'north', x: 145.8, beds: [['sau-8', 10, 3091], ['sau-9', 10, 3104], ['sau-10', 10, 3117]] },
];

function plotField({ side, x, beds }, index) {
  const north = side === 'north';
  const length = Math.max(...beds.map(([, holes]) => holes)) * SPACING;
  const edge = PLOT_EDGE[side];
  const head = north ? edge - BED_MARGIN : edge + BED_MARGIN;
  const far = north ? head - length - BED_MARGIN : head + length + BED_MARGIN;
  const first = x - ((beds.length - 1) * BED.pitch) / 2;
  const soil = { x0: first - SOIL_SIDE, x1: first + (beds.length - 1) * BED.pitch + SOIL_SIDE, z0: Math.min(edge, far), z1: Math.max(edge, far), seed: 600 + index };
  return {
    id: `plot-${index + 1}`,
    region: `plot-${index + 1}`,
    name: `Ruộng số ${index + 1}`,
    seed: 900 + index,
    bounds: { x0: soil.x0 - 1, x1: soil.x1 + 1, z0: north ? soil.z0 - 1 : soil.z0, z1: north ? soil.z1 : soil.z1 + 1 },
    soil: [soil],
    paths: [],
    jars: [{ x: soil.x0 - 0.5, z: north ? soil.z0 + 0.4 : soil.z1 - 0.4 }],
    trees: [[soil.x1 + 0.2, north ? soil.z0 + 0.6 : soil.z1 - 1.2]],
    beds: beds.map(([id, holes, seed], k) => ({ id, x: first + k * BED.pitch, z: head, heading: north ? Math.PI : 0, holes, seed })),
  };
}

export const FIELDS = PLOTS.map(plotField);

const LEGACY_ORDER = [
  ...[13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 2, 1, 25, 26].map((n) => [`rau-${n}`, 10]),
  ...[1, 2, 3, 4, 5].map((n) => [`banco-${n}`, 9]),
];

export const FIELD_TREES = FIELDS.flatMap((field) => field.trees);

export function bedShape(seed, { height = 0.22, halfWidth = 0.47 } = {}) {
  const rand = makeRandom(seed);
  const p = Array.from({ length: 5 }, () => rand() * Math.PI * 2);
  const skew = (rand() - 0.5) * 0.08;
  return {
    offset: (s) => Math.sin(s * 0.23 + p[0]) * 0.035 + Math.sin(s * 0.71 + p[1]) * 0.015 + skew * Math.sin(s * 0.05 + p[4]),
    height: (s) => height + Math.sin(s * 0.55 + p[2]) * 0.022 + Math.sin(s * 1.7 + p[3]) * 0.01,
    halfWidth: (s) => halfWidth + Math.sin(s * 0.4 + p[3]) * 0.03 + Math.sin(s * 1.3 + p[0]) * 0.012,
  };
}

function makeBed(field, spec, number) {
  const heading = spec.heading ?? 0;
  const ux = Math.sin(heading);
  const uz = Math.cos(heading);
  return {
    ...spec,
    heading,
    field: field.id,
    number,
    ux,
    uz,
    s0: spec.x * ux + spec.z * uz,
    length: spec.holes * SPACING,
    shape: bedShape(spec.seed, { height: BED.height }),
  };
}

export const BEDS = FIELDS.flatMap((field) => field.beds.map((spec, i) => makeBed(field, spec, i + 1)));
export const FIELD_OF = Object.fromEntries(FIELDS.map((field) => [field.id, field]));
export const SPOT_BED = BEDS.flatMap((bed, index) => Array(bed.holes).fill(index));
export const FIRST_SPOT = BEDS.map((_, index) => SPOT_BED.indexOf(index));
export const fieldOf = (index) => BEDS[SPOT_BED[index]].field;
export const bedsOf = (field) => BEDS.flatMap((bed, index) => (bed.field === field ? [index] : []));
export const leasePrice = (offer, bed) => Math.round(offer.perHole * BEDS[bed].holes);
export const bedPlace = (bed) => `${FIELD_OF[BEDS[bed].field].name} · luống ${BEDS[bed].number}`;

export function bedPoint(bed, u, v = bed.shape.offset(bed.s0 + u)) {
  return { x: bed.x + bed.ux * u + bed.uz * v, z: bed.z + bed.uz * u - bed.ux * v };
}

export const headPoint = (bed, u) => bedPoint(bed, u, bed.shape.offset(bed.s0));

export function toBed(bed, p) {
  const dx = p.x - bed.x;
  const dz = p.z - bed.z;
  return { u: dx * bed.ux + dz * bed.uz, v: dx * bed.uz - dz * bed.ux };
}

export const bedHead = (bed) => headPoint(BEDS[bed], -1);
export const signPoint = (bed) => headPoint(BEDS[bed], -0.35);

export function standsAt(bed, at) {
  if (!at) return false;
  const info = BEDS[bed];
  const { u, v } = toBed(info, at);
  const along = Math.min(Math.max(u, 0), info.length);
  return Math.abs(v - info.shape.offset(info.s0 + along)) <= BED.pitch && u >= -1.5 && u <= info.length + 1.5;
}

export function layoutSpots() {
  const spots = [];
  for (const bed of BEDS) {
    const rand = makeRandom(bed.seed + 31);
    for (let k = 0; k < bed.holes; k++) {
      const u = SPACING * (k + 0.5);
      const { x, z } = bedPoint(bed, u);
      spots.push({ x, y: bed.shape.height(bed.s0 + u) * 1.03, z, ux: bed.ux, uz: bed.uz, yaw: rand() * Math.PI * 2, scale: 0.9 + rand() * 0.2 });
    }
  }
  return spots;
}

const spotLocal = (spot, p) => {
  const dx = p.x - spot.x;
  const dz = p.z - spot.z;
  return { along: dx * spot.ux + dz * spot.uz, across: dx * spot.uz - dz * spot.ux };
};

export function spotAt(spots, point) {
  let best = -1;
  let bestD = Infinity;
  spots.forEach((spot, i) => {
    const { along, across } = spotLocal(spot, point);
    const da = Math.abs(across);
    const dl = Math.abs(along);
    if (da > 0.75 || dl > SPACING / 2 || da + dl >= bestD) return;
    bestD = da + dl;
    best = i;
  });
  return best;
}

const REACH = { across: 0.45, along: 1.3 };

export function standFor(spot, from) {
  const { along, across } = spotLocal(spot, from);
  const side = across < 0 ? -1 : 1;
  const offset = (side * BED.pitch) / 2;
  if (Math.abs(across - offset) < REACH.across && Math.abs(along) <= REACH.along) return { x: from.x, z: from.z };
  return { x: spot.x + spot.uz * offset, z: spot.z - spot.ux * offset };
}

export function bedBox(bed) {
  const half = BED.width / 2;
  const corners = [
    bedPoint(bed, 0, -half),
    bedPoint(bed, 0, half),
    bedPoint(bed, bed.length, -half),
    bedPoint(bed, bed.length, half),
  ];
  const xs = corners.map((p) => p.x);
  const zs = corners.map((p) => p.z);
  return { minX: Math.min(...xs), minZ: Math.min(...zs), maxX: Math.max(...xs), maxZ: Math.max(...zs), minY: 0, maxY: 1.6 };
}

export function fieldObstacles(field) {
  const info = FIELD_OF[field];
  const block = (x0, z0, x1, z1) => ({ minX: x0, minZ: z0, maxX: x1, maxZ: z1, minY: 0, maxY: 1.6 });
  return [
    ...bedsOf(field).map((bed) => bedBox(BEDS[bed])),
    ...info.jars.map(({ x, z }) => block(x - 0.45, z - 0.45, x + 0.45, z + 0.45)),
    ...info.trees.map(([x, z]) => block(x + 0.2, z + 0.2, x + 0.8, z + 0.8)),
  ];
}

export function spotsFromSave(saved, legacy) {
  const beds = saved && typeof saved.beds === 'object' && saved.beds ? saved.beds : legacyBeds(legacy?.spots);
  const found = [];
  if (!beds) return found;
  BEDS.forEach((bed, index) => {
    const list = beds[bed.id];
    if (!Array.isArray(list)) return;
    list.slice(0, bed.holes).forEach((spot, k) => found.push([FIRST_SPOT[index] + k, spot]));
  });
  return found;
}

export function spotsToSave(spots) {
  return { beds: Object.fromEntries(BEDS.map((bed, index) => [bed.id, spots.slice(FIRST_SPOT[index], FIRST_SPOT[index] + bed.holes)])) };
}

export function leasesFromSave(saved, legacy) {
  const leases = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : legacyBeds(legacy, 1);
  return BEDS.map((bed) => leases?.[bed.id] ?? null);
}

export function leasesToSave(leases) {
  return Object.fromEntries(BEDS.flatMap((bed, index) => (leases[index] ? [[bed.id, leases[index]]] : [])));
}

function legacyBeds(list, size) {
  if (!Array.isArray(list)) return null;
  const beds = {};
  let at = 0;
  for (const [id, holes] of LEGACY_ORDER) {
    const span = size ?? holes;
    beds[id] = size ? list[at] : list.slice(at, at + span);
    at += span;
  }
  return beds;
}
