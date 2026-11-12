import { CERTIFY } from './config.js';
import { DECKS, DECK_IDS, deckOf } from './studyDecks.js';
import { createStore } from './persist.js';
import { dayOf, gameNow } from './clock.js';

const KEY = 'truong-lang-xua.certify';

const today = () => dayOf(gameNow());

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const blankDeck = () => ({ day: null, cursor: 0, batch: [], carry: [], queue: [], certified: {}, weak: {}, counts: {}, viewed: [], qualified: null, examDay: null });

function cleanDeck(raw) {
  const deck = blankDeck();
  if (!raw || typeof raw !== 'object') return deck;
  const keys = (list) => (Array.isArray(list) ? list.filter((key) => typeof key === 'string') : []);
  const map = (value) => (value && typeof value === 'object' ? { ...value } : {});
  deck.day = Number.isFinite(raw.day) ? raw.day : null;
  deck.cursor = Number.isInteger(raw.cursor) && raw.cursor >= 0 ? raw.cursor : 0;
  deck.batch = keys(raw.batch);
  deck.carry = keys(raw.carry).filter((key) => deck.batch.includes(key));
  deck.queue = keys(raw.queue);
  deck.certified = map(raw.certified);
  deck.weak = map(raw.weak);
  deck.counts = map(raw.counts);
  deck.viewed = keys(raw.viewed);
  deck.qualified = Number.isFinite(raw.qualified) ? raw.qualified : null;
  deck.examDay = Number.isFinite(raw.examDay) ? raw.examDay : null;
  return deck;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      const actors = {};
      for (const [id, decks] of Object.entries(saved)) {
        actors[id] = {};
        for (const deck of DECK_IDS) actors[id][deck] = cleanDeck(decks?.[deck]);
      }
      return actors;
    }
  } catch {}
  return {};
}

const actors = load();
const store = createStore(KEY, () => actors);
const listeners = [];

function changed(actor) {
  store.save();
  for (const listener of listeners) listener(actor);
}

function fill(state, deck) {
  const cards = DECKS[deck].cards;
  state.batch = state.batch.filter((key) => !state.certified[key]);
  state.carry = state.carry.filter((key) => state.batch.includes(key));
  while (state.batch.length < CERTIFY.batch) {
    let key = null;
    if (state.queue.length) key = state.queue.shift();
    else if (state.cursor < cards.length) key = cards[state.cursor++].key;
    else break;
    if (state.certified[key] || state.batch.includes(key)) continue;
    state.batch.push(key);
  }
}

function deckState(actor, deck) {
  actors[actor] ??= {};
  const state = (actors[actor][deck] ??= blankDeck());
  const day = today();
  if (state.day !== day) {
    state.day = day;
    state.counts = {};
    state.viewed = [];
    state.qualified = null;
    fill(state, deck);
    store.save();
  }
  return state;
}

const learnKeys = (state) => state.batch.filter((key) => !state.carry.includes(key));

function revoke(state, key) {
  delete state.certified[key];
  delete state.weak[key];
  if (!state.batch.includes(key) && !state.queue.includes(key)) state.queue.push(key);
}

function totalQuestions(deck) {
  return Math.floor((CERTIFY.examMinutes * 60) / CERTIFY.seconds[deck]);
}

function oldKeys(state, count) {
  if (count <= 0) return [];
  const certified = Object.keys(state.certified);
  const weak = shuffle(certified.filter((key) => state.weak[key]));
  const rest = shuffle(certified.filter((key) => !state.weak[key]));
  return [...weak, ...rest].slice(0, count);
}

export const certify = {
  onChange(listener) {
    listeners.push(listener);
  },
  totalQuestions,
  batch(actor, deck) {
    const state = deckState(actor, deck);
    return state.batch.map((key) => ({ key, ready: state.carry.includes(key), count: state.counts[key] ?? 0 }));
  },
  finished(actor, deck) {
    const state = deckState(actor, deck);
    return !state.batch.length && !state.queue.length && state.cursor >= DECKS[deck].cards.length;
  },
  learnLeft(actor, deck) {
    const state = deckState(actor, deck);
    return learnKeys(state).filter((key) => (state.counts[key] ?? 0) < CERTIFY.remember);
  },
  count(actor, deck, key) {
    return deckState(actor, deck).counts[key] ?? 0;
  },
  remember(actor, deck, key) {
    const state = deckState(actor, deck);
    state.counts[key] = (state.counts[key] ?? 0) + 1;
    if (!state.viewed.includes(key)) state.viewed.push(key);
    changed(actor);
  },
  forget(actor, deck, key) {
    const state = deckState(actor, deck);
    state.counts[key] = 0;
    if (!state.viewed.includes(key)) state.viewed.push(key);
    changed(actor);
  },
  viewed(actor, deck, key) {
    const state = deckState(actor, deck);
    if (state.viewed.includes(key)) return;
    state.viewed.push(key);
    changed(actor);
  },
  studyAll(actor, deck) {
    const state = deckState(actor, deck);
    for (const key of learnKeys(state)) {
      state.counts[key] = Math.max(state.counts[key] ?? 0, CERTIFY.remember);
      if (!state.viewed.includes(key)) state.viewed.push(key);
    }
    changed(actor);
  },
  certified(actor, deck) {
    return Object.keys(deckState(actor, deck).certified);
  },
  certifiedCount(actor, deck) {
    return Object.keys(deckState(actor, deck).certified).length;
  },
  needsInternal(actor, deck) {
    const state = deckState(actor, deck);
    return learnKeys(state).length > 0 && state.qualified !== state.day;
  },
  internalReady(actor, deck) {
    return this.needsInternal(actor, deck) && this.learnLeft(actor, deck).length === 0;
  },
  qualified(actor, deck) {
    const state = deckState(actor, deck);
    if (!state.batch.length) return false;
    return state.qualified === state.day || learnKeys(state).length === 0;
  },
  examTaken(actor, deck) {
    const state = deckState(actor, deck);
    return state.examDay === state.day;
  },
  internalQuestions(actor, deck) {
    const state = deckState(actor, deck);
    const fresh = learnKeys(state);
    return shuffle([...fresh, ...oldKeys(state, totalQuestions(deck) - fresh.length)]);
  },
  gradeInternal(actor, deck, results) {
    const state = deckState(actor, deck);
    const fresh = learnKeys(state);
    const failed = [];
    const revoked = [];
    for (const { key, correct } of results) {
      if (fresh.includes(key)) {
        if (!correct) {
          state.counts[key] = 0;
          failed.push(key);
        }
        continue;
      }
      if (!state.certified[key]) continue;
      if (correct) delete state.weak[key];
      else {
        revoke(state, key);
        revoked.push(key);
      }
    }
    const passed = results.length > 0 && results.every((result) => result.correct);
    if (passed) state.qualified = state.day;
    changed(actor);
    return { passed, failed, revoked };
  },
  examQuestions(actor, deck) {
    const state = deckState(actor, deck);
    const fresh = [...state.batch];
    return shuffle([...fresh, ...oldKeys(state, totalQuestions(deck) - fresh.length)]);
  },
  gradeExam(actor, deck, results) {
    const state = deckState(actor, deck);
    const fresh = [...state.batch];
    const failed = [];
    const passedFresh = [];
    const revoked = [];
    let right = 0;
    for (const { key, correct } of results) {
      if (correct) right += 1;
      if (fresh.includes(key)) {
        if (correct) passedFresh.push(key);
        else {
          state.counts[key] = 0;
          state.carry = state.carry.filter((item) => item !== key);
          failed.push(key);
        }
        continue;
      }
      if (!state.certified[key]) continue;
      if (correct) delete state.weak[key];
      else {
        revoke(state, key);
        revoked.push(key);
      }
    }
    const total = results.length;
    const score = total ? right / total : 0;
    const passed = total > 0 && failed.length === 0 && score >= CERTIFY.pass;
    const certified = [];
    if (passed) {
      for (const key of passedFresh) {
        state.certified[key] = state.day;
        certified.push(key);
      }
      state.batch = state.batch.filter((key) => !state.certified[key]);
      state.carry = state.carry.filter((key) => state.batch.includes(key));
    } else {
      for (const key of passedFresh) if (!state.carry.includes(key)) state.carry.push(key);
    }
    state.examDay = state.day;
    changed(actor);
    return { passed, right, total, score, certified, carried: passed ? [] : passedFresh, failed, revoked };
  },
  pool(actor) {
    const keys = [];
    for (const deck of DECK_IDS) {
      const state = deckState(actor, deck);
      keys.push(...Object.keys(state.certified), ...state.viewed.filter((key) => !state.certified[key]));
    }
    return keys;
  },
  markWeak(actor, key, correct) {
    const deck = deckOf(key);
    if (!deck || correct) return;
    const state = deckState(actor, deck);
    if (!state.certified[key] || state.weak[key]) return;
    state.weak[key] = state.day;
    changed(actor);
  },
};
