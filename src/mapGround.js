import { WORLD } from './config.js';
import { MOUNTAIN, inStream, terrainBlocked } from './terrain.js';
import { northBank } from './riverShape.js';
import { ROAD } from './road.js';
import { STREET } from './villagerData.js';
import { PLAZA_ZONE } from './quarter.js';
import { FIELDS } from './fieldPlan.js';

const COLORS = {
  grass: [143, 174, 93],
  hill: [112, 140, 74],
  peak: [158, 148, 122],
  paved: [222, 202, 158],
  soil: [140, 104, 66],
  water: [86, 140, 178],
  wood: [164, 124, 78],
  block: [112, 86, 64],
  tree: [74, 104, 56],
  void: [38, 52, 68],
};
const BLOCKED = [null, COLORS.block, COLORS.water, COLORS.tree, COLORS.void];
const HILL = { from: 0.5, to: 10 };
const PEAK = { from: 16, to: 36 };
const RELIEF = 0.35;
const LIGHT = { min: 0.72, max: 1.22 };
const RIVER_EDGE = 0.3;

const rect = ([x0, z0, x1, z1]) => ({ x0, z0, x1, z1 });
const PAVED = [rect([ROAD.x0, ROAD.z0, ROAD.x1, ROAD.z1]), ...STREET.map(rect), PLAZA_ZONE];
const SOIL = FIELDS.flatMap((field) => field.soil);
const within = (list, x, z) => list.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
const onMountain = (x, z) => x > MOUNTAIN.x0 && x < MOUNTAIN.x1 && z > MOUNTAIN.z0 && z < MOUNTAIN.z1;

const ramp = (from, to, value) => Math.min(1, Math.max(0, (value - from) / (to - from)));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function landColor(x, z, h) {
  if (within(PAVED, x, z)) return COLORS.paved;
  if (within(SOIL, x, z)) return COLORS.soil;
  if (z >= northBank(x) - RIVER_EDGE) return COLORS.wood;
  return mix(mix(COLORS.grass, COLORS.hill, ramp(HILL.from, HILL.to, h)), COLORS.peak, ramp(PEAK.from, PEAK.to, h));
}

function blockedKind(x, z) {
  if (x > WORLD.x1) return 4;
  if (z >= northBank(x)) return 2;
  if (!onMountain(x, z)) return 1;
  if (inStream(x, z)) return 2;
  return terrainBlocked(x, z) ? 3 : 1;
}

export function createMapGround() {
  let kinds = null;

  return function paint({ heights, w, d, x0, z0, cell }) {
    if (kinds?.length !== w * d) kinds = new Uint8Array(w * d);
    const data = new Uint8ClampedArray(w * d * 4);
    for (let j = 0; j < d; j++) {
      const z = z0 + (j + 0.5) * cell;
      for (let i = 0; i < w; i++) {
        const n = j * w + i;
        const x = x0 + (i + 0.5) * cell;
        const h = heights[n];
        let color;
        let light = 1;
        if (Number.isNaN(h)) {
          kinds[n] ||= blockedKind(x, z);
          color = BLOCKED[kinds[n]];
        } else if (x > WORLD.x1) color = COLORS.paved;
        else {
          color = landColor(x, z, h);
          const west = i > 0 && !Number.isNaN(heights[n - 1]) ? heights[n - 1] : h;
          const north = j > 0 && !Number.isNaN(heights[n - w]) ? heights[n - w] : h;
          light = Math.min(LIGHT.max, Math.max(LIGHT.min, 1 + (h - west + (h - north)) * RELIEF));
        }
        const p = n * 4;
        data[p] = color[0] * light;
        data[p + 1] = color[1] * light;
        data[p + 2] = color[2] * light;
        data[p + 3] = 255;
      }
    }
    return { width: w, height: d, data };
  };
}
