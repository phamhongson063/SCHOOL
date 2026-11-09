import { gameNow, DAY_MINUTES } from './clock.js';

const KEY = 'truong-lang-xua.n2Recall';
const LEGACY_INDEX_KEY = 'truong-lang-xua.n2Index';
const GAPS = [20, DAY_MINUTES, 3 * DAY_MINUTES, 10 * DAY_MINUTES, 30 * DAY_MINUTES];
export const MASTERED_BOX = 3;
const MASTERY_STEP = 3;

let data = null;

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function fromAnswerCount(saved) {
  const now = gameNow();
  const cards = {};
  for (const [word, card] of Object.entries(saved.cards)) {
    const box = Math.min(Math.max(0, card.box ?? 0), GAPS.length - 1);
    cards[word] = { box, due: now + GAPS[box] };
  }
  return { cards };
}

function load() {
  if (data) return data;
  try {
    const saved = JSON.parse(read(KEY));
    if (saved?.cards && typeof saved.cards === 'object') {
      if (Number.isFinite(saved.step)) {
        data = fromAnswerCount(saved);
        save();
      } else data = saved;
    }
  } catch {}
  data ??= { cards: {} };
  return data;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export const recall = {
  get mastery() {
    return Object.values(load().cards).reduce((sum, card) => sum + Math.floor(Math.max(0, card.box) / MASTERY_STEP), 0);
  },
  box(word) {
    return load().cards[word]?.box ?? -1;
  },
  due(word) {
    return load().cards[word]?.due ?? null;
  },
  record(word, remembered) {
    const state = load();
    const box = remembered ? Math.min((state.cards[word]?.box ?? 0) + 1, GAPS.length - 1) : 0;
    state.cards[word] = { box, due: gameNow() + GAPS[box] };
    save();
  },
  seed(words) {
    if (read(KEY) !== null) return;
    const learned = Number(read(LEGACY_INDEX_KEY));
    if (!Number.isInteger(learned) || learned <= 0) return;
    const state = load();
    const now = gameNow();
    words.slice(0, learned).forEach((word) => {
      state.cards[word] = { box: 1, due: now + GAPS[1] };
    });
    save();
  },
};
