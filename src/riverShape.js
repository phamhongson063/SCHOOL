export const DOCK = { x0: 44.6, x1: 46.4, z0: 68.8, z1: 76.6 };
export const DOCK_X = (DOCK.x0 + DOCK.x1) / 2;
export const BOAT_X = 38.5;
export const SEGMENT = 3;
export const WIDEN = { from: 60, to: 125, extra: 60 };
export const ISLE = { x: 162, z: 118, halfX: 34, halfZ: 25, round: 2.4 };
ISLE.x0 = ISLE.x - ISLE.halfX;
ISLE.x1 = ISLE.x + ISLE.halfX;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x, at, width, amount) => amount * Math.exp(-(((x - at) / width) ** 2));
const fade = (x) => smooth(4, 12, Math.abs(x - DOCK_X));

export function northBank(x) {
  const wave = 1.1 * Math.sin(x * 0.045 + 1) + 0.6 * Math.sin(x * 0.11 + 2.3) + 0.3 * Math.sin(x * 0.23 + 0.4) + bump(x, 8, 5, 1.6) + bump(x, -28, 6, -1.2) + bump(x, 78, 5, 1.4);
  return 70 + wave * fade(x);
}

export function southBank(x) {
  const wave = 1.3 * Math.sin(x * 0.05 + 4) + 0.7 * Math.sin(x * 0.13 + 0.7) + 0.35 * Math.sin(x * 0.27 + 1.9) + bump(x, 30, 6, -1.8) + bump(x, 92, 5, -1.5) + bump(x, -45, 7, -1.3);
  return 130 + wave * (0.4 + 0.6 * fade(x)) + WIDEN.extra * smooth(WIDEN.from, WIDEN.to, x);
}

function isleSpan(x) {
  const u = Math.abs(x - ISLE.x) / ISLE.halfX;
  return u >= 1 ? 0 : ISLE.halfZ * (1 - u ** ISLE.round);
}

export const inIsleSpan = (x) => x > ISLE.x0 && x < ISLE.x1;

export function isleNorth(x) {
  return ISLE.z - isleSpan(x) * (1 + 0.07 * Math.sin(x * 0.21 + 0.8) + 0.04 * Math.sin(x * 0.47 + 2.1));
}

export function isleSouth(x) {
  return ISLE.z + isleSpan(x) * (1 + 0.06 * Math.sin(x * 0.17 + 2.6) + 0.04 * Math.sin(x * 0.39 + 0.3));
}

export function laneSouth(x) {
  const open = southBank(x) - WIDEN.extra * smooth(WIDEN.from, WIDEN.to, x);
  return inIsleSpan(x) ? Math.min(open, isleNorth(x) - 1.5) : open;
}

export function onIsle(x, z, inset = 0) {
  return inIsleSpan(x) && z > isleNorth(x) + inset && z < isleSouth(x) - inset;
}

const CROSSING_X = ISLE.x - 2;
export const CROSSING = { x: CROSSING_X, half: 1.3, rail: 0.2, z0: northBank(CROSSING_X) - 2.5, z1: isleNorth(CROSSING_X) + 2.5, base: 0.12, rise: 1.5 };
CROSSING.length = CROSSING.z1 - CROSSING.z0;

export function deckHeight(z) {
  const t = Math.min(1, Math.max(0, (z - CROSSING.z0) / CROSSING.length));
  return CROSSING.base + CROSSING.rise * Math.sin(Math.PI * t);
}

export function crossingFloor(x, z) {
  const dx = Math.abs(x - CROSSING.x);
  if (dx > CROSSING.half + CROSSING.rail || z < CROSSING.z0 || z > CROSSING.z1) return null;
  return dx > CROSSING.half ? NaN : deckHeight(z);
}

export function crossingDeck(x, z) {
  const deck = crossingFloor(x, z);
  return deck === null || Number.isNaN(deck) ? null : deck;
}

export const clearOfCrossing = (x, margin = 0) => Math.abs(x - CROSSING.x) > CROSSING.half + CROSSING.rail + margin;

export function lowestNorth(x, half) {
  let low = Infinity;
  for (let s = x - half; s <= x + half + 1e-6; s += 0.25) low = Math.min(low, northBank(s));
  return low;
}
