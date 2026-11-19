import { ENERGY_PRICE, LANTERN, MIND } from './config.js';
import { DAY_MINUTES, dayOf, minuteOfDay } from './clock.js';
import { makeRandom } from './random.js';
import { DECKS, DECK_IDS, unitOf } from './studyDecks.js';
import { certify } from './certify.js';
import { absorption } from './absorption.js';
import { createStore } from './persist.js';
import { drainBetween } from './stamina.js';
import { worldKey } from './saveKeys.js';

const KEY = worldKey('lanterns');
const RUBY = /[㐀-鿿々〆Ａ-Ｚａ-ｚ]+\{([^}]+)\}/g;
const PHRASE_CARDS = DECK_IDS.filter((id) => DECKS[id].quiz === 'phrase')
  .flatMap((id) => DECKS[id].cards)
  .filter((card) => card.cloze);
const PHRASE_KEYS = PHRASE_CARDS.map((card) => card.key);

const kanaOf = (text) => Array.from(text.replace(RUBY, '$1').replace(/[[\]\s]/g, '')).join('');

export const answerOf = (key) => kanaOf(unitOf(key)?.cloze?.answer ?? '');

function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function lanternTiles(lantern) {
  const card = unitOf(lantern.key);
  const answer = Array.from(answerOf(lantern.key));
  const rand = makeRandom(hashOf(`${lantern.id}:${lantern.key}`));
  const used = new Set(answer);
  const siblings = PHRASE_CARDS.filter((other) => other.deck === card.deck && other.group === card.group).map((other) => answerOf(other.key));
  const others = shuffle(PHRASE_KEYS.map(answerOf), rand);
  const extras = [];
  for (const char of [...siblings, ...others].flatMap((text) => Array.from(text))) {
    if (extras.length >= LANTERN.extraTiles) break;
    if (used.has(char)) continue;
    used.add(char);
    extras.push(char);
  }
  return shuffle([...answer, ...extras], rand);
}

const tilesOf = (key) => Array.from(answerOf(key)).length;
const handSeconds = (key) => LANTERN.readSeconds + tilesOf(key) * LANTERN.tapSeconds;

export const lanternSeconds = (key) => handSeconds(key) + LANTERN.thinkSeconds;

export function lanternTry(id, key, day) {
  const { correct, seconds } = absorption.respond(id, key, LANTERN.thinkSeconds, day);
  return { correct, seconds: handSeconds(key) + seconds };
}

export function lanternEnergy(left, solved, now, start, end) {
  if (!(left > 0)) return 0;
  const elapsed = Math.max(0, now - start);
  const pace = (solved + LANTERN.pace * LANTERN.paceWeight) / (elapsed + LANTERN.paceWeight);
  const expected = Math.max(1, pace * Math.max(0, end - now));
  return Math.min(LANTERN.reward.energy, Math.floor(left), Math.max(1, Math.round(left / expected)));
}

export function lanternWorth(id, key, need, diligence, points) {
  const energy = points * ENERGY_PRICE * need;
  const intellect = LANTERN.reward.intellect * MIND.intellectValue * diligence;
  return absorption.chance(id, key) * (energy + intellect);
}

export const knowsLantern = (id, key) => certify.familiarity(id, key) !== 'new';

export function lanternWindow(minutes) {
  const m = minuteOfDay(minutes);
  if (m < LANTERN.start || m >= LANTERN.end) return null;
  const day = dayOf(minutes);
  return { day, start: day * DAY_MINUTES + LANTERN.start, end: day * DAY_MINUTES + LANTERN.end };
}

export const landedAt = (lantern) => lantern.dropAt + LANTERN.fall;

export function lanternNeed(now) {
  const day = dayOf(now);
  const start = day * DAY_MINUTES + LANTERN.start;
  const end = day * DAY_MINUTES + LANTERN.end;
  if (now < start - LANTERN.prepare || now >= end) return 0;
  return drainBetween(Math.max(now, start), end, 'walk');
}

export function signupOpen(minutes) {
  const m = minuteOfDay(minutes);
  return m >= LANTERN.signOpen && m < LANTERN.end;
}

export function festivalShare(from, to) {
  const day = dayOf(from);
  const start = day * DAY_MINUTES + LANTERN.start;
  const end = day * DAY_MINUTES + LANTERN.end;
  return Math.max(0, Math.min(to, end) - Math.max(from, start)) / (end - start);
}

export function lanternSignWorth(id, need, diligence, points, busy = 0) {
  const keys = PHRASE_KEYS.filter((key) => knowsLantern(id, key));
  if (!keys.length) return -LANTERN.fee * need;
  const sample = keys.length > 12 ? keys.filter((_, i) => i % Math.ceil(keys.length / 12) === 0) : keys;
  const each = sample.reduce((sum, key) => sum + lanternWorth(id, key, need, diligence, points), 0) / sample.length;
  const share = Math.min(keys.length, LANTERN.count) / LANTERN.count;
  return each * share * LANTERN.count * 0.3 * (1 - busy) - LANTERN.fee * need;
}

const blank = () => ({ day: null, seq: 0, solved: 0, list: [], locks: {}, tally: {} });
const blankSignup = () => ({ day: null, ids: [] });

function validLantern(raw) {
  return raw && Number.isInteger(raw.id) && typeof raw.key === 'string' && unitOf(raw.key) && ['x', 'y', 'z', 'dropAt'].every((name) => Number.isFinite(raw[name]));
}

function counts(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => Number.isInteger(value) && value > 0));
}

export function lanternStandings(ids, tally) {
  return ids.map((id, order) => ({ id, score: tally[id] ?? 0, order }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ id, score }) => ({ id, score }));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      return {
        day: Number.isInteger(saved.day) ? saved.day : null,
        seq: Number.isInteger(saved.seq) ? saved.seq : 0,
        solved: Number.isInteger(saved.solved) ? saved.solved : 0,
        list: Array.isArray(saved.list) ? saved.list.filter(validLantern).map((raw) => ({ ...raw, doneAt: Number.isFinite(raw.doneAt) ? raw.doneAt : null, by: raw.by ?? null })) : [],
        locks: saved.locks && typeof saved.locks === 'object' ? saved.locks : {},
        tally: counts(saved.tally),
        totals: counts(saved.totals),
        signup: Number.isInteger(saved.signup?.day) && Array.isArray(saved.signup?.ids) ? { day: saved.signup.day, ids: saved.signup.ids.filter((id) => typeof id === 'string') } : blankSignup(),
      };
    }
  } catch {}
  return { ...blank(), signup: blankSignup(), totals: {} };
}

export function createLanterns({ ground, roster, reward, charge, budget }) {
  let state = load();
  const store = createStore(KEY, () => state);
  const claims = new Map();

  const endOf = () => state.day * DAY_MINUTES + LANTERN.end;
  const live = () => state.list.filter((lantern) => lantern.doneAt === null);
  const find = (id) => state.list.find((lantern) => lantern.id === id) ?? null;

  const signedOn = (day) => (state.signup.day === day ? state.signup.ids : []);
  const signed = (who, day) => signedOn(day).includes(who);

  function nextKey(rand) {
    const lit = live();
    const taken = new Set(lit.map((lantern) => lantern.key));
    const entrants = signedOn(state.day);
    const ids = entrants.length ? entrants : roster();
    const knowers = new Map();
    for (const key of PHRASE_KEYS) {
      if (taken.has(key)) continue;
      const who = ids.filter((id) => knowsLantern(id, key));
      if (who.length) knowers.set(key, who);
    }
    if (!knowers.size) return null;
    const able = new Set([...knowers.values()].flat());
    const held = new Map([...able].map((id) => [id, lit.filter((lantern) => knowsLantern(id, lantern.key)).length]));
    const fewest = Math.min(...held.values());
    const needy = [...able].filter((id) => held.get(id) === fewest);
    const target = needy[Math.floor(rand() * needy.length)];
    const keys = [...knowers].filter(([, who]) => who.includes(target));
    let roll = rand() * keys.reduce((sum, [, who]) => sum + who.length, 0);
    for (const [key, who] of keys) {
      roll -= who.length;
      if (roll < 0) return key;
    }
    return keys[keys.length - 1][0];
  }

  function landingSpot(rand) {
    const others = live();
    let best = null;
    let bestGap = -1;
    for (let i = 0; i < LANTERN.candidates; i++) {
      const spot = ground.pick(rand);
      if (!spot) continue;
      const gap = others.reduce((nearest, other) => Math.min(nearest, Math.hypot(other.x - spot.x, other.z - spot.z)), Infinity);
      if (gap > bestGap) {
        best = spot;
        bestGap = gap;
      }
    }
    return best;
  }

  function spawn(dropAt) {
    const rand = makeRandom(hashOf(`${state.day}:${state.seq + 1}`));
    const key = nextKey(rand);
    if (!key) return false;
    state.seq += 1;
    const spot = landingSpot(rand);
    if (!spot) return false;
    state.list.push({ id: state.seq, key, x: spot.x, y: spot.y, z: spot.z, dropAt, doneAt: null, by: null });
    return true;
  }

  function fill(now, slot) {
    let changed = false;
    for (let i = live().length; i < LANTERN.count; i++) {
      if (!spawn(Math.max(now, slot.start + (i / LANTERN.count) * LANTERN.stagger))) break;
      changed = true;
    }
    return changed;
  }

  function energyAt(now) {
    const day = dayOf(now);
    const start = day * DAY_MINUTES + LANTERN.start;
    const solved = state.day === day ? state.solved : 0;
    return lanternEnergy(budget(now), solved, Math.max(now, start), start, day * DAY_MINUTES + LANTERN.end);
  }

  function releaseLantern(id) {
    for (const [who, claimed] of claims) if (claimed === id) claims.delete(who);
  }

  function blocker(who, lantern, now) {
    if (!lantern || lantern.doneAt !== null || now >= endOf()) return 'gone';
    if (now < landedAt(lantern)) return 'falling';
    if (!signed(who, state.day)) return 'unregistered';
    if (!knowsLantern(who, lantern.key)) return 'unknown';
    if ((state.locks[lantern.id]?.[who] ?? -Infinity) > now) return 'locked';
    return null;
  }

  return {
    tick(now) {
      const slot = lanternWindow(now);
      let changed = false;
      if (slot && state.day !== slot.day) {
        state = { ...blank(), signup: state.signup, totals: state.totals };
        state.day = slot.day;
        claims.clear();
        changed = true;
      }
      if (state.day === null) return;
      if (now >= endOf()) {
        for (const lantern of live()) {
          lantern.doneAt = endOf();
          changed = true;
        }
        claims.clear();
      } else if (slot && fill(now, slot)) changed = true;
      const before = state.list.length;
      state.list = state.list.filter((lantern) => lantern.doneAt === null || now < lantern.doneAt + LANTERN.rise);
      if (changed || state.list.length !== before) store.save();
    },
    active: (now) => lanternWindow(now) !== null,
    standings(now) {
      const slot = lanternWindow(now);
      if (!slot) return [];
      return lanternStandings(signedOn(slot.day), state.day === slot.day ? state.tally : {});
    },
    totalOf: (who) => state.totals[who] ?? 0,
    energyAt,
    signed: (who, now) => signed(who, dayOf(now)),
    register(who, now) {
      const day = dayOf(now);
      if (!signupOpen(now)) return 'closed';
      if (signed(who, day)) return 'already';
      if (!charge(who, LANTERN.fee)) return 'poor';
      if (state.signup.day !== day) state.signup = { day, ids: [] };
      state.signup.ids.push(who);
      store.save();
      return 'ok';
    },
    get list() {
      return state.list;
    },
    get: find,
    blocker(who, id, now) {
      return blocker(who, find(id), now);
    },
    lockLeft(who, id, now) {
      return Math.max(0, ((state.locks[id]?.[who] ?? now) - now) * 60);
    },
    attempt(who, id, answer, now) {
      const lantern = find(id);
      const reason = blocker(who, lantern, now);
      if (reason) return { ok: false, reason };
      if (answer !== answerOf(lantern.key)) {
        state.locks[id] = { ...state.locks[id], [who]: now + LANTERN.lock / 60 };
        store.save();
        return { ok: false, reason: 'wrong' };
      }
      const energy = energyAt(now);
      lantern.doneAt = now;
      lantern.by = who;
      state.solved += 1;
      state.tally[who] = (state.tally[who] ?? 0) + 1;
      state.totals[who] = (state.totals[who] ?? 0) + 1;
      delete state.locks[id];
      releaseLantern(id);
      const prize = reward(who, now, energy);
      const slot = lanternWindow(now);
      if (slot) fill(now, slot);
      store.save();
      return { ok: true, prize };
    },
    pickFor(who, point, now) {
      if (!lanternWindow(now) || !signed(who, dayOf(now))) return null;
      const taken = new Set([...claims].filter(([other]) => other !== who).map(([, id]) => id));
      let best = null;
      let bestGap = Infinity;
      for (const lantern of live()) {
        if (taken.has(lantern.id) || !knowsLantern(who, lantern.key) || (state.locks[lantern.id]?.[who] ?? -Infinity) > now) continue;
        const gap = point ? Math.hypot(lantern.x - point.x, lantern.z - point.z) : 0;
        if (gap < bestGap) {
          best = lantern;
          bestGap = gap;
        }
      }
      return best;
    },
    claim(who, id) {
      claims.set(who, id);
    },
    claimOf(who) {
      const lantern = find(claims.get(who));
      return lantern && lantern.doneAt === null ? lantern : null;
    },
    release(who) {
      claims.delete(who);
    },
  };
}
