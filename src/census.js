import { CENSUS } from './config.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';

const KEY = worldKey('census');

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object' && saved.days && typeof saved.days === 'object') {
      const days = {};
      for (const [day, page] of Object.entries(saved.days)) {
        if (!Number.isInteger(Number(day)) || !page || typeof page.worth !== 'object') continue;
        days[day] = { worth: page.worth, supply: Number.isFinite(page.supply) ? page.supply : null, fund: Number.isFinite(page.fund) ? page.fund : null };
      }
      return { days };
    }
  } catch {}
  return { days: {} };
}

const state = load();
const store = createStore(KEY, () => state);

const sorted = (values) => [...values].sort((a, b) => a - b);

export function gini(values) {
  const list = sorted(values).map((value) => Math.max(0, value));
  const total = list.reduce((sum, value) => sum + value, 0);
  if (!list.length || total <= 0) return 0;
  const weighted = list.reduce((sum, value, i) => sum + value * (i + 1), 0);
  return (2 * weighted) / (list.length * total) - (list.length + 1) / list.length;
}

export function spread(values) {
  if (!values.length) return { mean: 0, sd: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  return { mean: round(mean), sd: round(sd) };
}

export function entropy(counts) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total <= 0) return 0;
  return round(-Object.values(counts).filter((count) => count > 0).reduce((sum, count) => sum + (count / total) * Math.log(count / total), 0));
}

export function tiersOf(worth, tiers = CENSUS.tiers) {
  const ids = Object.keys(worth).sort((a, b) => worth[a] - worth[b]);
  const tierOf = {};
  ids.forEach((id, i) => (tierOf[id] = Math.min(tiers - 1, Math.floor((i * tiers) / ids.length))));
  return tierOf;
}

export function mobility(before, after, tiers = CENSUS.tiers) {
  const from = tiersOf(before, tiers);
  const to = tiersOf(after, tiers);
  const matrix = Array.from({ length: tiers }, () => Array(tiers).fill(0));
  let moved = 0;
  let counted = 0;
  for (const id of Object.keys(after)) {
    if (from[id] === undefined) continue;
    matrix[from[id]][to[id]] += 1;
    counted += 1;
    if (from[id] !== to[id]) moved += 1;
  }
  return { matrix, moved, counted };
}

const round = (value) => Math.round(value * 1000) / 1000;

export const census = {
  record(day, worth, supply, fund) {
    if (!Number.isInteger(day)) return;
    state.days[day] = { worth, supply, fund };
    for (const key of Object.keys(state.days)) if (Number(key) <= day - CENSUS.days) delete state.days[key];
    store.save();
  },
  report({ day, worth, traits, acts, supply, fund }) {
    const days = Object.keys(state.days).map(Number).sort((a, b) => a - b);
    const first = days[0];
    const values = Object.values(worth);
    const list = sorted(values);
    const sums = {};
    for (const row of acts) for (const [kind, count] of Object.entries(row)) sums[kind] = (sums[kind] ?? 0) + count;
    return {
      day,
      people: values.length,
      gini: round(gini(values)),
      worth: { min: list[0] ?? 0, median: list[Math.floor(list.length / 2)] ?? 0, max: list[list.length - 1] ?? 0 },
      mobility: first === undefined ? null : { fromDay: first, toDay: day, ...mobility(state.days[first].worth, worth) },
      traits: {
        diligence: spread(traits.map((row) => row.diligence)),
        farm: spread(traits.map((row) => row.skill.farm)),
        fish: spread(traits.map((row) => row.skill.fish)),
        hunt: spread(traits.map((row) => row.skill.hunt)),
      },
      activity: { counts: sums, entropy: entropy(sums) },
      supply: { now: supply, fund, history: days.map((past) => ({ day: past, supply: state.days[past].supply, fund: state.days[past].fund })) },
    };
  },
};
