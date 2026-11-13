import { LOCAL_PLAYER, PREFIX, selfKey, worldKey } from './saveKeys.js';
import { removeGameItem, writeGameItem } from './seal.js';
import { without } from './persist.js';

const isMap = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const list = (value) => (Array.isArray(value) ? value : []);
const withOwner = (swap) => (item) => (isMap(item) ? { ...item, owner: swap(item.owner) } : item);
const splitPlayer = (saved) => (isMap(saved) ? [without(saved, LOCAL_PLAYER), saved[LOCAL_PLAYER]] : [null]);

const MOVES = [
  { name: 'ledger', mine: true, split: splitPlayer },
  { name: 'certify', mine: true, split: splitPlayer },
  {
    name: 'bank',
    mine: true,
    split: (saved) => {
      if (!isMap(saved)) return [null];
      const accounts = isMap(saved.accounts) ? saved.accounts : {};
      return [{ ...saved, accounts: without(accounts, LOCAL_PLAYER) }, accounts[LOCAL_PLAYER]];
    },
  },
  { name: 'economy', split: (saved) => [saved] },
  { name: 'river', split: (saved) => [saved] },
  { name: 'estate', split: (saved, swap) => [isMap(saved) ? Object.fromEntries(Object.entries(saved).map(([house, owner]) => [house, swap(owner)])) : null] },
  { name: 'farm', from: 'farm.v2', split: (saved, swap) => [isMap(saved) ? { ...saved, spots: list(saved.spots).map(withOwner(swap)) } : null] },
  { name: 'farmLeases', split: (saved, swap) => [list(saved).map(withOwner(swap))] },
  {
    name: 'villagers',
    split: (saved, swap) => [isMap(saved) ? { ...saved, rests: list(saved.rests).map((rest) => (Array.isArray(rest) ? [rest[0], swap(rest[1]), ...rest.slice(2)] : rest)) } : null],
  },
  {
    name: 'ranking',
    split: (saved, swap) => [isMap(saved) ? { ...saved, rows: list(saved.rows).map((row) => (isMap(row) ? { ...row, id: swap(row.id) } : row)) } : null],
  },
];

function readLegacy(key) {
  const text = localStorage.getItem(key);
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function splitLegacySave(uid) {
  const swap = (id) => (id === LOCAL_PLAYER ? uid : id);
  for (const move of MOVES) {
    const legacy = PREFIX + (move.from ?? move.name);
    try {
      const saved = readLegacy(legacy);
      if (saved === undefined) continue;
      const [world, mine] = move.split(saved, swap);
      if (world != null) writeGameItem(worldKey(move.name), JSON.stringify(world));
      if (move.mine && mine != null) writeGameItem(selfKey(move.name), JSON.stringify(mine));
      removeGameItem(legacy);
    } catch {}
  }
}
