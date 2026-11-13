import { CERTIFY } from './config.js';
import { DECKS, DECK_IDS, deckOf } from './studyDecks.js';
import { createPairStore, without } from './persist.js';
import { selfKey, worldKey } from './saveKeys.js';
import { PLAYER } from './inventory.js';
import { dayOf, gameNow } from './clock.js';

const WORLD_KEY = worldKey('certify');
const SELF_KEY = selfKey('certify');

const today = () => dayOf(gameNow());

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const blankDeck = () => ({ day: null, cursor: 0, batch: [], carry: [], queue: [], certified: {}, weak: {}, counts: {}, viewed: [], qualified: null, examDay: null });

function cleanDeck(raw, id) {
  const deck = blankDeck();
  if (!raw || typeof raw !== 'object') return deck;
  const cards = DECKS[id].cards;
  const known = new Set(cards.map((card) => card.key));
  const latest = today() + 1;
  const pastDay = (value) => Number.isInteger(value) && value <= latest;
  const keys = (list) => (Array.isArray(list) ? [...new Set(list.filter((key) => known.has(key)))] : []);
  const days = (value) => Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {}).filter(([key, day]) => known.has(key) && pastDay(day)));
  const tallies = (value) => Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {}).filter(([key, count]) => known.has(key) && Number.isInteger(count) && count >= 0));
  deck.day = pastDay(raw.day) ? raw.day : null;
  deck.cursor = Number.isInteger(raw.cursor) && raw.cursor >= 0 ? Math.min(raw.cursor, cards.length) : 0;
  deck.certified = days(raw.certified);
  deck.weak = Object.fromEntries(Object.entries(days(raw.weak)).filter(([key]) => deck.certified[key] !== undefined));
  deck.batch = keys(raw.batch).filter((key) => deck.certified[key] === undefined);
  deck.carry = keys(raw.carry).filter((key) => deck.batch.includes(key));
  deck.queue = keys(raw.queue).filter((key) => deck.certified[key] === undefined && !deck.batch.includes(key));
  deck.counts = tallies(raw.counts);
  deck.viewed = keys(raw.viewed);
  deck.qualified = pastDay(raw.qualified) ? raw.qualified : null;
  deck.examDay = pastDay(raw.examDay) ? raw.examDay : null;
  return deck;
}

function restoreSkipped(state, deck) {
  const cards = DECKS[deck].cards;
  const end = Math.min(state.cursor, cards.length);
  for (let i = 0; i < end; i++) {
    const { key } = cards[i];
    if (state.certified[key] || state.batch.includes(key) || state.queue.includes(key)) continue;
    state.queue.push(key);
  }
  return state;
}

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

const cleanActor = (decks) => Object.fromEntries(DECK_IDS.map((deck) => [deck, restoreSkipped(cleanDeck(decks?.[deck], deck), deck)]));

function load() {
  const world = readJSON(WORLD_KEY);
  const mine = readJSON(SELF_KEY);
  const actors = {};
  if (world && typeof world === 'object') for (const [id, decks] of Object.entries(world)) actors[id] = cleanActor(decks);
  if (mine && typeof mine === 'object') actors[PLAYER] = cleanActor(mine);
  return actors;
}

const actors = load();
const store = createPairStore(WORLD_KEY, () => without(actors, PLAYER), SELF_KEY, () => actors[PLAYER] ?? null);
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
  examExtra(actor, deck, last = null) {
    const state = deckState(actor, deck);
    const pool = [...state.batch, ...Object.keys(state.certified)];
    const choices = pool.length > 1 ? pool.filter((key) => key !== last) : pool;
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
  },
  gradeExam(actor, deck, results) {
    const state = deckState(actor, deck);
    const fresh = [...state.batch];
    const failed = [];
    const passedFresh = [];
    const revoked = [];
    let right = 0;
    const answers = new Map();
    for (const { key, correct } of results) {
      if (correct) right += 1;
      answers.set(key, (answers.get(key) ?? true) && correct);
    }
    for (const [key, correct] of answers) {
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
