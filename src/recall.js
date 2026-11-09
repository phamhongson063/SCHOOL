const KEY = 'truong-lang-xua.n2Recall';
const LEGACY_INDEX_KEY = 'truong-lang-xua.n2Index';
const GAPS = [3, 10, 30, 80, 200];
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

function load() {
  if (data) return data;
  try {
    const saved = JSON.parse(read(KEY));
    if (Number.isFinite(saved?.step) && saved.cards && typeof saved.cards === 'object') data = saved;
  } catch {}
  data ??= { step: 0, cards: {} };
  return data;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export const recall = {
  get step() {
    return load().step;
  },
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
    state.step += 1;
    state.cards[word] = { box, due: state.step + GAPS[box] };
    save();
  },
  seed(words) {
    if (read(KEY) !== null) return;
    const learned = Number(read(LEGACY_INDEX_KEY));
    if (!Number.isInteger(learned) || learned <= 0) return;
    const state = load();
    words.slice(0, learned).forEach((word, i) => {
      state.cards[word] = { box: 1, due: i };
    });
    save();
  },
};
