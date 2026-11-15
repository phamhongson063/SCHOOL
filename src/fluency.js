import { FLUENCY } from './config.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';

const KEY = worldKey('fluency');

function load() {
  const actors = {};
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const [id, cards] of Object.entries(saved)) {
        if (!cards || typeof cards !== 'object') continue;
        actors[id] = {};
        for (const [key, raw] of Object.entries(cards)) {
          if (!Array.isArray(raw) || !Number.isFinite(raw[0]) || !Number.isInteger(raw[1])) continue;
          actors[id][key] = [Math.max(0, Math.min(1, raw[0])), raw[1]];
        }
      }
    }
  } catch {}
  return actors;
}

const actors = load();
const store = createStore(KEY, () => actors);

const cardsOf = (id) => (actors[id] ??= {});

function strengthAt(card, day) {
  if (!card) return 0;
  const [strength, seen] = card;
  const gap = Number.isInteger(day) && day > seen ? day - seen : 0;
  return strength * FLUENCY.keep ** gap;
}

export const fluency = {
  of(id, key, day) {
    return strengthAt(cardsOf(id)[key], day);
  },
  recall(id, key, day, correct = true) {
    if (!Number.isInteger(day)) return;
    const cards = cardsOf(id);
    const current = strengthAt(cards[key], day);
    const next = correct ? current + (1 - current) * FLUENCY.gain : current * (1 - FLUENCY.slip);
    cards[key] = [Math.round(next * 1000) / 1000, day];
    store.save();
  },
  average(id, keys, day) {
    if (!keys.length) return 0;
    return keys.reduce((sum, key) => sum + this.of(id, key, day), 0) / keys.length;
  },
};
