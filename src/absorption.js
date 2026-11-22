import { ABSORB, FLUENCY } from './config.js';
import { fluency } from './fluency.js';
import { certify } from './certify.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';
import { between } from './random.js';
import { clamp } from './math.js';

const KEY = worldKey('absorption');
const FACTS = ['study', 'tired', 'debt'];

const isShare = (value) => Number.isFinite(value) && value >= 0 && value <= 1;

function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object' || !isShare(raw.talent) || !isShare(raw.value)) return null;
  const facts = raw.facts && typeof raw.facts === 'object' ? raw.facts : {};
  return {
    talent: raw.talent,
    value: clamp(raw.value, ABSORB.min, ABSORB.max),
    day: Number.isInteger(raw.day) ? raw.day : null,
    facts: Object.fromEntries(FACTS.filter((fact) => facts[fact] === true).map((fact) => [fact, true])),
  };
}

function load() {
  const entries = {};
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const [id, raw] of Object.entries(saved)) {
        const entry = cleanEntry(raw);
        if (entry) entries[id] = entry;
      }
    }
  } catch {}
  return entries;
}

const entries = load();
const store = createStore(KEY, () => entries);

function entryOf(id) {
  if (!entries[id]) {
    entries[id] = { talent: between(...ABSORB.talent), value: between(...ABSORB.start), day: null, facts: {} };
    store.save();
  }
  return entries[id];
}

function targetOf(entry) {
  const { facts } = entry;
  let target = entry.talent + (facts.study ? ABSORB.study : -ABSORB.idle);
  if (facts.tired) target -= ABSORB.tired;
  if (facts.debt) target -= ABSORB.debt;
  return clamp(target, ABSORB.min, ABSORB.max);
}

function roll(entry, day) {
  if (entry.day !== null && day <= entry.day) return;
  if (entry.day !== null) {
    const gap = Math.min(day - entry.day, ABSORB.catchUp);
    for (let i = 0; i < gap; i++) {
      entry.value = clamp(entry.value + (targetOf(entry) - entry.value) * ABSORB.rate, ABSORB.min, ABSORB.max);
      entry.facts = {};
    }
  }
  entry.day = day;
  entry.facts = {};
}

function holdOf(id, key) {
  const grasp = ABSORB.grasp[certify.familiarity(id, key)] ?? 0;
  return grasp * (1 - ABSORB.fade * (1 - entryOf(id).value));
}

const chanceOf = (hold) => Math.min(ABSORB.ceiling, ABSORB.guess + (1 - ABSORB.guess) * hold);

export const absorption = {
  note(id, fact, day) {
    if (!FACTS.includes(fact) || !Number.isInteger(day)) return;
    const entry = entryOf(id);
    roll(entry, day);
    if (entry.day !== day || entry.facts[fact]) return;
    entry.facts[fact] = true;
    store.save();
  },
  noted(id, fact, day) {
    const entry = entries[id];
    return !!entry && entry.day === day && entry.facts[fact] === true;
  },
  chance(id, key) {
    return chanceOf(holdOf(id, key));
  },
  answer(id, key) {
    return Math.random() < this.chance(id, key);
  },
  respond(id, key, limit, day = null) {
    const { think } = ABSORB;
    const hold = holdOf(id, key);
    const correct = Math.random() < chanceOf(hold);
    const fluent = hold * (FLUENCY.floor + (1 - FLUENCY.floor) * fluency.of(id, key, day));
    const share = correct && hold > 0 ? think.sure + (think.slow - think.sure) * (1 - fluent) : between(...think.guess);
    return { correct, seconds: Math.min(limit, limit * share * between(...think.jitter)) };
  },
  forgets(id) {
    return Math.random() < ABSORB.forget * (1 - entryOf(id).value);
  },
};
