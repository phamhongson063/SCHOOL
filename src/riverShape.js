export const DOCK = { x0: 44.6, x1: 46.4, z0: 68.8, z1: 76.6 };
export const DOCK_X = (DOCK.x0 + DOCK.x1) / 2;
export const BOAT_X = 38.5;
export const SEGMENT = 3;

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
  return 130 + wave * (0.4 + 0.6 * fade(x));
}

export function lowestNorth(x, half) {
  let low = Infinity;
  for (let s = x - half; s <= x + half + 1e-6; s += 0.25) low = Math.min(low, northBank(s));
  return low;
}
