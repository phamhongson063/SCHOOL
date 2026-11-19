import { makeRandom } from './random.js';

export const FARM_X = 143;
export const SPACING = 2;
export const BED = { height: 0.22, width: 0.84, pitch: 2.2 };

export const FIELDS = [
  {
    id: 'farm',
    region: 'farm',
    name: 'Ruộng rau màu',
    seed: 909,
    bounds: { x0: 111, z0: 40, x1: 176, z1: 65.5 },
    soil: [
      { x0: 112.7, z0: 40.4, x1: 140.9, z1: 61.6, seed: 61 },
      { x0: 145.3, z0: 40.4, x1: 173.5, z1: 61.6, seed: 62 },
    ],
    paths: [{ x0: 140.9, z0: 38.1, x1: 145.3, z1: 61.8, radius: 0.6 }],
    jars: [
      { x: 112.4, z: 40.1 },
      { x: 174.6, z: 40.1 },
    ],
    trees: [
      [111, 59.5],
      [123, 65.5],
      [137, 66.5],
      [152, 66],
      [167, 65],
      [176, 58.5],
    ],
    beds: [
      { id: 'rau-1', x: 114, z: 41, holes: 10, seed: 999 },
      { id: 'rau-2', x: 116.2, z: 41, holes: 10, seed: 986 },
      { id: 'rau-3', x: 118.4, z: 41, holes: 10, seed: 830 },
      { id: 'rau-4', x: 120.6, z: 41, holes: 10, seed: 817 },
      { id: 'rau-5', x: 122.8, z: 41, holes: 10, seed: 804 },
      { id: 'rau-6', x: 125, z: 41, holes: 10, seed: 791 },
      { id: 'rau-7', x: 127.2, z: 41, holes: 10, seed: 778 },
      { id: 'rau-8', x: 129.4, z: 41, holes: 10, seed: 765 },
      { id: 'rau-9', x: 131.6, z: 41, holes: 10, seed: 752 },
      { id: 'rau-10', x: 133.8, z: 41, holes: 10, seed: 739 },
      { id: 'rau-11', x: 136, z: 41, holes: 10, seed: 726 },
      { id: 'rau-12', x: 138.2, z: 41, holes: 10, seed: 713 },
      { id: 'rau-13', x: 140.4, z: 41, holes: 10, seed: 700 },
      { id: 'rau-14', x: 146.6, z: 41, holes: 10, seed: 843 },
      { id: 'rau-15', x: 148.8, z: 41, holes: 10, seed: 856 },
      { id: 'rau-16', x: 151, z: 41, holes: 10, seed: 869 },
      { id: 'rau-17', x: 153.2, z: 41, holes: 10, seed: 882 },
      { id: 'rau-18', x: 155.4, z: 41, holes: 10, seed: 895 },
      { id: 'rau-19', x: 157.6, z: 41, holes: 10, seed: 908 },
      { id: 'rau-20', x: 159.8, z: 41, holes: 10, seed: 921 },
      { id: 'rau-21', x: 162, z: 41, holes: 10, seed: 934 },
      { id: 'rau-22', x: 164.2, z: 41, holes: 10, seed: 947 },
      { id: 'rau-23', x: 166.4, z: 41, holes: 10, seed: 960 },
      { id: 'rau-24', x: 168.6, z: 41, holes: 10, seed: 973 },
      { id: 'rau-25', x: 170.8, z: 41, holes: 10, seed: 1012 },
      { id: 'rau-26', x: 173, z: 41, holes: 10, seed: 1025 },
    ],
  },
  {
    id: 'banco',
    region: 'bancoFarm',
    name: 'Ruộng Bàn Cờ',
    seed: 919,
    bounds: { x0: 156, z0: 7, x1: 170, z1: 31.5 },
    soil: [{ x0: 157.3, z0: 9, x1: 168.7, z1: 28.2, seed: 97 }],
    paths: [{ x0: 161.6, z0: 28, x1: 164.4, z1: 32.1, radius: 0.5 }],
    jars: [],
    trees: [],
    beds: [
      { id: 'banco-1', x: 158.6, z: 27.6, heading: Math.PI, holes: 9, seed: 1700 },
      { id: 'banco-2', x: 160.8, z: 27.6, heading: Math.PI, holes: 9, seed: 1713 },
      { id: 'banco-3', x: 163, z: 27.6, heading: Math.PI, holes: 9, seed: 1726 },
      { id: 'banco-4', x: 165.2, z: 27.6, heading: Math.PI, holes: 9, seed: 1739 },
      { id: 'banco-5', x: 167.4, z: 27.6, heading: Math.PI, holes: 9, seed: 1752 },
    ],
  },
  {
    id: 'west',
    region: 'westFarm',
    name: 'Ruộng Cổng Tây',
    seed: 929,
    bounds: { x0: -185, z0: 38.5, x1: -145, z1: 66 },
    soil: [
      { x0: -183.1, z0: 40.9, x1: -168.1, z1: 62.1, seed: 63 },
      { x0: -162.9, z0: 40.9, x1: -147.9, z1: 62.1, seed: 64 },
    ],
    paths: [{ x0: -167.7, z0: 36.6, x1: -163.3, z1: 62.3, radius: 0.6 }],
    jars: [
      { x: -183.4, z: 40.6 },
      { x: -147.6, z: 40.6 },
    ],
    trees: [
      [-184, 63.5],
      [-175, 65],
      [-156, 65],
      [-147, 63.5],
    ],
    beds: [
      { id: 'tay-1', x: -181.8, z: 41.5, holes: 10, seed: 2000 },
      { id: 'tay-2', x: -179.6, z: 41.5, holes: 10, seed: 2013 },
      { id: 'tay-3', x: -177.4, z: 41.5, holes: 10, seed: 2026 },
      { id: 'tay-4', x: -175.2, z: 41.5, holes: 10, seed: 2039 },
      { id: 'tay-5', x: -173, z: 41.5, holes: 10, seed: 2052 },
      { id: 'tay-6', x: -170.8, z: 41.5, holes: 10, seed: 2065 },
      { id: 'tay-7', x: -168.6, z: 41.5, holes: 10, seed: 2078 },
      { id: 'tay-8', x: -162.4, z: 41.5, holes: 10, seed: 2091 },
      { id: 'tay-9', x: -160.2, z: 41.5, holes: 10, seed: 2104 },
      { id: 'tay-10', x: -158, z: 41.5, holes: 10, seed: 2117 },
      { id: 'tay-11', x: -155.8, z: 41.5, holes: 10, seed: 2130 },
      { id: 'tay-12', x: -153.6, z: 41.5, holes: 10, seed: 2143 },
      { id: 'tay-13', x: -151.4, z: 41.5, holes: 10, seed: 2156 },
      { id: 'tay-14', x: -149.2, z: 41.5, holes: 10, seed: 2169 },
    ],
  },
  {
    id: 'north',
    region: 'northFarm',
    name: 'Ruộng Sau Làng',
    seed: 939,
    bounds: { x0: 36, z0: 3.5, x1: 95, z1: 16.3 },
    soil: [
      { x0: 43.5, z0: 5.3, x1: 64.6, z1: 15.9, seed: 65 },
      { x0: 67.5, z0: 5.3, x1: 88.6, z1: 15.9, seed: 66 },
    ],
    paths: [
      { x0: 41.4, z0: 5, x1: 43.4, z1: 16.3, radius: 0.5 },
      { x0: 64.8, z0: 5, x1: 67.2, z1: 16.3, radius: 0.5 },
    ],
    jars: [
      { x: 42.4, z: 4.4 },
      { x: 66, z: 4.4 },
    ],
    trees: [
      [38.5, 6],
      [92, 14],
      [92.5, 6.5],
    ],
    beds: [
      { id: 'sau-1', x: 44, z: 15, heading: Math.PI / 2, holes: 10, seed: 3000 },
      { id: 'sau-2', x: 44, z: 12.8, heading: Math.PI / 2, holes: 10, seed: 3013 },
      { id: 'sau-3', x: 44, z: 10.6, heading: Math.PI / 2, holes: 10, seed: 3026 },
      { id: 'sau-4', x: 44, z: 8.4, heading: Math.PI / 2, holes: 10, seed: 3039 },
      { id: 'sau-5', x: 44, z: 6.2, heading: Math.PI / 2, holes: 10, seed: 3052 },
      { id: 'sau-6', x: 68, z: 15, heading: Math.PI / 2, holes: 10, seed: 3065 },
      { id: 'sau-7', x: 68, z: 12.8, heading: Math.PI / 2, holes: 10, seed: 3078 },
      { id: 'sau-8', x: 68, z: 10.6, heading: Math.PI / 2, holes: 10, seed: 3091 },
      { id: 'sau-9', x: 68, z: 8.4, heading: Math.PI / 2, holes: 10, seed: 3104 },
      { id: 'sau-10', x: 68, z: 6.2, heading: Math.PI / 2, holes: 10, seed: 3117 },
    ],
  },
];

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
