import { TRAITS } from './config.js';
import { createStore, readEntries } from './persist.js';
import { worldKey } from './saveKeys.js';
import { makeRandom, between } from './random.js';
import { dayOf } from './clock.js';
import { clamp } from './math.js';

const KEY = worldKey('traits');
export const SKILLS = ['farm', 'fish', 'hunt'];
const BASE_TASTES = ['farm', 'fish', 'hunt', 'study', 'blessing'];
const LATE_TASTES = ['loto', 'fireworks'];
export const TASTES = [...BASE_TASTES, ...LATE_TASTES];
const FACTS = ['study', 'pass', 'fail', 'tired', 'debt'];

const isShare = (value) => Number.isFinite(value) && value >= 0 && value <= 1;
const isAmount = (value) => Number.isFinite(value) && value >= 0;

function skillOf(xp) {
  const [lo, hi] = TRAITS.skill;
  return lo + (hi - lo) * (1 - Math.exp(-xp / TRAITS.skillDepth));
}

function xpOf(skill) {
  const [lo, hi] = TRAITS.skill;
  const reached = clamp((skill - lo) / (hi - lo), 0, 0.999);
  return -TRAITS.skillDepth * Math.log(1 - reached);
}

function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function freshEntry(id) {
  const rand = makeRandom(hashOf(id));
  const anchor = between(...TRAITS.anchor, rand);
  return {
    anchor,
    diligence: clamp(anchor + between(-TRAITS.startSpread, TRAITS.startSpread, rand), ...TRAITS.diligence),
    xp: Object.fromEntries(SKILLS.map((name) => [name, xpOf(between(...TRAITS.skillStart, rand))])),
    skill: {},
    taste: {
      ...Object.fromEntries(BASE_TASTES.map((name) => [name, between(...TRAITS.taste, rand)])),
      ...Object.fromEntries(LATE_TASTES.map((name) => [name, between(...TRAITS.taste, makeRandom(hashOf(`${id}:${name}`)))])),
    },
    thrift: rand(),
    comfort: rand(),
    innGoer: rand() < TRAITS.innGoer,
    day: null,
    facts: {},
    acts: {},
    work: {},
    last: {},
  };
}

function withSkills(entry) {
  entry.skill = Object.fromEntries(SKILLS.map((name) => [name, skillOf(entry.xp[name])]));
  return entry;
}

function cleanEntry(raw, id) {
  const entry = freshEntry(id);
  if (!raw || typeof raw !== 'object') return withSkills(entry);
  if (isShare(raw.anchor)) entry.anchor = raw.anchor;
  if (isShare(raw.diligence)) entry.diligence = clamp(raw.diligence, ...TRAITS.diligence);
  for (const name of SKILLS) {
    if (isAmount(raw.xp?.[name])) entry.xp[name] = raw.xp[name];
    else if (isShare(raw.skill?.[name])) entry.xp[name] = xpOf(clamp(raw.skill[name], ...TRAITS.skill));
  }
  for (const name of TASTES) if (Number.isFinite(raw.taste?.[name])) entry.taste[name] = clamp(raw.taste[name], ...TRAITS.taste);
  if (isShare(raw.thrift)) entry.thrift = raw.thrift;
  if (isShare(raw.comfort)) entry.comfort = raw.comfort;
  if (typeof raw.innGoer === 'boolean') entry.innGoer = raw.innGoer;
  entry.day = Number.isInteger(raw.day) ? raw.day : null;
  const facts = raw.facts && typeof raw.facts === 'object' ? raw.facts : {};
  entry.facts = Object.fromEntries(FACTS.filter((fact) => facts[fact] === true).map((fact) => [fact, true]));
  const acts = raw.acts && typeof raw.acts === 'object' ? raw.acts : {};
  entry.acts = Object.fromEntries(TASTES.filter((name) => isAmount(acts[name]) && acts[name] > 0).map((name) => [name, acts[name]]));
  const last = raw.last && typeof raw.last === 'object' ? raw.last : {};
  entry.last = Object.fromEntries(TASTES.filter((name) => isAmount(last[name]) && last[name] > 0).map((name) => [name, last[name]]));
  const work = raw.work && typeof raw.work === 'object' ? raw.work : {};
  entry.work = Object.fromEntries(SKILLS.filter((name) => isAmount(work[name]) && work[name] > 0).map((name) => [name, work[name]]));
  return withSkills(entry);
}

function load() {
  return readEntries(KEY, cleanEntry);
}

const entries = load();
const store = createStore(KEY, () => entries);
const practicedAt = new Map();

function entryOf(id) {
  if (!entries[id]) {
    entries[id] = withSkills(freshEntry(id));
    store.save();
  }
  return entries[id];
}

function diligenceTarget(entry) {
  const { facts } = entry;
  let target = entry.anchor + (facts.study ? TRAITS.studyPull : -TRAITS.idlePull);
  if (facts.pass) target += TRAITS.passPull;
  if (facts.fail) target -= TRAITS.failPull;
  if (facts.tired) target -= TRAITS.tiredPull;
  if (facts.debt) target -= TRAITS.debtPull;
  return clamp(target, ...TRAITS.diligence);
}

function practiceDay(entry, name) {
  const share = Math.min(1, (entry.work[name] ?? 0) / TRAITS.fullDayEffort);
  entry.xp[name] = entry.xp[name] * (1 - TRAITS.skillForget) + share;
}

function settleTaste(entry, id) {
  const total = TASTES.reduce((sum, name) => sum + (entry.acts[name] ?? 0), 0);
  if (!(total > 0)) return;
  const base = freshEntry(id).taste;
  for (const name of TASTES) {
    const share = (entry.acts[name] ?? 0) / total;
    const target = base[name] + TRAITS.habitPull * (share - 1 / TASTES.length);
    entry.taste[name] = clamp(entry.taste[name] + (target - entry.taste[name]) * TRAITS.habitRate, ...TRAITS.taste);
  }
}

function driftDay(entry, id) {
  const { rate } = TRAITS;
  entry.diligence = clamp(entry.diligence + (diligenceTarget(entry) - entry.diligence) * rate, ...TRAITS.diligence);
  for (const name of SKILLS) practiceDay(entry, name);
  withSkills(entry);
  settleTaste(entry, id);
  entry.last = { ...entry.acts };
  entry.facts = {};
  entry.acts = {};
  entry.work = {};
}

function roll(entry, day, id) {
  if (entry.day !== null && day <= entry.day) return;
  if (entry.day !== null) {
    const gap = Math.min(day - entry.day, TRAITS.catchUp);
    for (let i = 0; i < gap; i++) driftDay(entry, id);
  }
  entry.day = day;
  entry.facts = {};
  entry.acts = {};
  entry.work = {};
}

export const traits = {
  note(id, fact, day) {
    if (!FACTS.includes(fact) || !Number.isInteger(day)) return;
    const entry = entryOf(id);
    roll(entry, day, id);
    if (entry.day !== day || entry.facts[fact]) return;
    entry.facts[fact] = true;
    store.save();
  },
  did(id, kind, day, minutes) {
    if (!TASTES.includes(kind) || !Number.isInteger(day) || !(minutes > 0)) return;
    const entry = entryOf(id);
    roll(entry, day, id);
    if (entry.day !== day) return;
    entry.acts[kind] = (entry.acts[kind] ?? 0) + minutes;
    store.save();
  },
  train(id, kind, effort, day) {
    if (!SKILLS.includes(kind) || !(effort > 0) || !Number.isInteger(day)) return;
    const entry = entryOf(id);
    roll(entry, day, id);
    if (entry.day !== day) return;
    entry.work[kind] = (entry.work[kind] ?? 0) + effort;
    store.save();
  },
  practice(id, kind, minutes) {
    if (!Number.isFinite(minutes)) return;
    const key = `${id}:${kind}`;
    if (minutes - (practicedAt.get(key) ?? -Infinity) < TRAITS.practiceGap) return;
    practicedAt.set(key, minutes);
    traits.did(id, kind, dayOf(minutes), TRAITS.practiceGap);
  },
  settle(id, day, { tired = false, debt = false } = {}) {
    if (!Number.isInteger(day)) return;
    const entry = entryOf(id);
    const before = entry.day;
    roll(entry, day, id);
    if (entry.day !== day) return;
    let changed = entry.day !== before;
    for (const [fact, on] of [['tired', tired], ['debt', debt]]) {
      if (!on || entry.facts[fact]) continue;
      entry.facts[fact] = true;
      changed = true;
    }
    if (changed) store.save();
  },
  diligence(id) {
    return entryOf(id).diligence;
  },
  skill(id, name) {
    return entryOf(id).skill[name] ?? TRAITS.skillStart[0];
  },
  taste(id, kind) {
    return entryOf(id).taste[kind] ?? 1;
  },
  thrift(id) {
    return entryOf(id).thrift;
  },
  comfort(id) {
    return entryOf(id).comfort;
  },
  innGoer(id) {
    return entryOf(id).innGoer;
  },
  lastActs(id) {
    return { ...entryOf(id).last };
  },
  view(id) {
    const entry = entries[id] ?? withSkills(freshEntry(id));
    return { diligence: entry.diligence, skill: { ...entry.skill }, taste: { ...entry.taste } };
  },
  snapshot(id) {
    const entry = entryOf(id);
    return { anchor: entry.anchor, diligence: entry.diligence, skill: { ...entry.skill }, taste: { ...entry.taste }, thrift: entry.thrift, comfort: entry.comfort };
  },
};
