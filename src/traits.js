import { TRAITS } from './config.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';
import { makeRandom, between } from './random.js';

const KEY = worldKey('traits');
export const SKILLS = ['farm', 'fish', 'hunt'];
export const TASTES = ['farm', 'fish', 'hunt', 'study', 'blessing'];
const FACTS = ['study', 'pass', 'fail', 'tired', 'debt'];

const clamp = (value, [lo, hi]) => Math.max(lo, Math.min(hi, value));
const isShare = (value) => Number.isFinite(value) && value >= 0 && value <= 1;

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
    diligence: clamp(anchor + between(-TRAITS.startSpread, TRAITS.startSpread, rand), TRAITS.diligence),
    skill: Object.fromEntries(SKILLS.map((name) => [name, between(...TRAITS.skillStart, rand)])),
    taste: Object.fromEntries(TASTES.map((name) => [name, between(...TRAITS.taste, rand)])),
    thrift: rand(),
    comfort: rand(),
    innGoer: rand() < TRAITS.innGoer,
    day: null,
    facts: {},
    acts: {},
    last: {},
  };
}

function cleanEntry(raw, id) {
  const entry = freshEntry(id);
  if (!raw || typeof raw !== 'object') return entry;
  if (isShare(raw.anchor)) entry.anchor = raw.anchor;
  if (isShare(raw.diligence)) entry.diligence = clamp(raw.diligence, TRAITS.diligence);
  for (const name of SKILLS) if (isShare(raw.skill?.[name])) entry.skill[name] = clamp(raw.skill[name], TRAITS.skill);
  for (const name of TASTES) if (Number.isFinite(raw.taste?.[name])) entry.taste[name] = clamp(raw.taste[name], TRAITS.taste);
  if (isShare(raw.thrift)) entry.thrift = raw.thrift;
  if (isShare(raw.comfort)) entry.comfort = raw.comfort;
  if (typeof raw.innGoer === 'boolean') entry.innGoer = raw.innGoer;
  entry.day = Number.isInteger(raw.day) ? raw.day : null;
  const facts = raw.facts && typeof raw.facts === 'object' ? raw.facts : {};
  entry.facts = Object.fromEntries(FACTS.filter((fact) => facts[fact] === true).map((fact) => [fact, true]));
  const acts = raw.acts && typeof raw.acts === 'object' ? raw.acts : {};
  entry.acts = Object.fromEntries(TASTES.filter((name) => Number.isInteger(acts[name]) && acts[name] > 0).map((name) => [name, acts[name]]));
  const last = raw.last && typeof raw.last === 'object' ? raw.last : {};
  entry.last = Object.fromEntries(TASTES.filter((name) => Number.isInteger(last[name]) && last[name] > 0).map((name) => [name, last[name]]));
  return entry;
}

function load() {
  const entries = {};
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const [id, raw] of Object.entries(saved)) entries[id] = cleanEntry(raw, id);
    }
  } catch {}
  return entries;
}

const entries = load();
const store = createStore(KEY, () => entries);

function entryOf(id) {
  if (!entries[id]) {
    entries[id] = freshEntry(id);
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
  return clamp(target, TRAITS.diligence);
}

const skillTarget = (entry, name) => clamp((entry.acts[name] ?? 0) > 0 ? TRAITS.skillUsed : TRAITS.skillIdle, TRAITS.skill);

function driftDay(entry) {
  const { rate } = TRAITS;
  entry.diligence = clamp(entry.diligence + (diligenceTarget(entry) - entry.diligence) * rate, TRAITS.diligence);
  for (const name of SKILLS) entry.skill[name] = clamp(entry.skill[name] + (skillTarget(entry, name) - entry.skill[name]) * rate, TRAITS.skill);
  const busiest = TASTES.reduce((best, name) => ((entry.acts[name] ?? 0) > (entry.acts[best] ?? 0) ? name : best), TASTES[0]);
  if ((entry.acts[busiest] ?? 0) > 0) {
    for (const name of TASTES) entry.taste[name] = clamp(entry.taste[name] + (name === busiest ? TRAITS.habitGain : -TRAITS.habitFade), TRAITS.taste);
  }
  entry.last = { ...entry.acts };
  entry.facts = {};
  entry.acts = {};
}

function roll(entry, day) {
  if (entry.day !== null && day <= entry.day) return;
  if (entry.day !== null) {
    const gap = Math.min(day - entry.day, TRAITS.catchUp);
    for (let i = 0; i < gap; i++) driftDay(entry);
  }
  entry.day = day;
  entry.facts = {};
  entry.acts = {};
}

export const traits = {
  note(id, fact, day) {
    if (!FACTS.includes(fact) || !Number.isInteger(day)) return;
    const entry = entryOf(id);
    roll(entry, day);
    if (entry.day !== day || entry.facts[fact]) return;
    entry.facts[fact] = true;
    store.save();
  },
  did(id, kind, day) {
    if (!TASTES.includes(kind) || !Number.isInteger(day)) return;
    const entry = entryOf(id);
    roll(entry, day);
    if (entry.day !== day) return;
    entry.acts[kind] = (entry.acts[kind] ?? 0) + 1;
    store.save();
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
    const entry = entries[id] ?? freshEntry(id);
    return { diligence: entry.diligence, skill: { ...entry.skill }, taste: { ...entry.taste } };
  },
  snapshot(id) {
    const entry = entryOf(id);
    return { anchor: entry.anchor, diligence: entry.diligence, skill: { ...entry.skill }, taste: { ...entry.taste }, thrift: entry.thrift, comfort: entry.comfort };
  },
};
