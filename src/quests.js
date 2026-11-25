import { QUEST } from './config.js';
import { createStore, readEntries } from './persist.js';
import { worldKey } from './saveKeys.js';
import { makeRandom } from './random.js';

const KEY = worldKey('quests');
export const QUEST_KINDS = Object.keys(QUEST.kinds);
export const QUEST_SCOPES = ['day', 'week'];

export const weekOf = (day) => Math.floor((day + 3) / 7);
const periodOf = (scope, day) => (scope === 'week' ? weekOf(day) : day);
const SALT = { day: 1, week: 7919 };

const boardCache = { day: { at: null, board: [] }, week: { at: null, board: [] } };

export function questBoard(scope, day) {
  const at = periodOf(scope, day);
  const cache = boardCache[scope];
  if (cache.at === at) return cache.board;
  const rand = makeRandom(at * 31 + SALT[scope]);
  const kinds = [...QUEST_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const board = kinds.slice(0, QUEST[scope].count).map((kind, index) => {
    const [lo, hi] = QUEST.kinds[kind][scope];
    return { scope, index, kind, goal: lo + Math.floor(rand() * (hi - lo + 1)) };
  });
  boardCache[scope] = { at, board };
  return board;
}

const allQuests = (day) => QUEST_SCOPES.flatMap((scope) => questBoard(scope, day));

function cleanPeriod(raw, scope) {
  const at = Number.isInteger(raw?.at) ? raw.at : Number.isInteger(raw?.day) ? raw.day : null;
  if (at === null || !raw.taken || typeof raw.taken !== 'object') return null;
  const taken = {};
  for (const [index, held] of Object.entries(raw.taken)) {
    if (!/^\d+$/.test(index) || Number(index) >= QUEST[scope].count) continue;
    taken[index] = { count: Number.isFinite(held?.count) && held.count > 0 ? Math.floor(held.count) : 0, paid: held?.paid === true };
  }
  return { at, taken };
}

function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const entry = {};
  const legacy = Number.isInteger(raw.day) ? raw : null;
  for (const scope of QUEST_SCOPES) {
    const period = cleanPeriod(scope === 'day' && legacy ? legacy : raw[scope], scope);
    if (period) entry[scope] = period;
  }
  return entry;
}

function load() {
  return readEntries(KEY, cleanEntry);
}

const entries = load();
const store = createStore(KEY, () => entries);

function periodFor(id, scope, day) {
  if (!Number.isInteger(day)) return null;
  const at = periodOf(scope, day);
  const entry = (entries[id] ??= {});
  const period = entry[scope];
  if (period && period.at > at) return null;
  if (!period || period.at < at) entry[scope] = { at, taken: {} };
  return entry[scope];
}

function peek(id, scope, day) {
  const period = entries[id]?.[scope];
  return period && period.at === periodOf(scope, day) ? period : null;
}

function statusOf(quest, held) {
  if (!held) return 'open';
  if (held.paid) return 'done';
  return held.count >= quest.goal ? 'ready' : 'active';
}

function claim(period, quest, pay) {
  const held = period.taken[quest.index];
  if (statusOf(quest, held) !== 'ready') return null;
  held.paid = true;
  return pay(quest.scope);
}

export const quests = {
  view(id, day) {
    return allQuests(day).map((quest) => {
      const held = peek(id, quest.scope, day)?.taken[quest.index] ?? null;
      return { ...quest, icon: QUEST.kinds[quest.kind].icon, name: QUEST.kinds[quest.kind].name, count: Math.min(held?.count ?? 0, quest.goal), status: statusOf(quest, held) };
    });
  },
  accept(id, scope, index, day) {
    const quest = questBoard(scope, day)[index];
    const period = quest && periodFor(id, scope, day);
    if (!period || period.taken[index]) return false;
    period.taken[index] = { count: 0, paid: false };
    store.save();
    return true;
  },
  turnIn(id, scope, index, day, pay) {
    const quest = questBoard(scope, day)[index];
    const period = quest && peek(id, scope, day);
    if (!period) return null;
    const paid = claim(period, quest, pay);
    if (paid !== null) store.save();
    return paid;
  },
  note(id, kind, day, amount = 1) {
    if (!(amount > 0)) return;
    let changed = false;
    for (const quest of allQuests(day)) {
      const held = peek(id, quest.scope, day)?.taken[quest.index];
      if (quest.kind !== kind || statusOf(quest, held) !== 'active') continue;
      held.count = Math.min(quest.goal, held.count + amount);
      changed = true;
    }
    if (changed) store.save();
  },
  wantsVisit(id, day) {
    return quests.view(id, day).some((quest) => quest.status === 'open' || quest.status === 'ready');
  },
  visit(id, day, pay) {
    const result = { taken: 0, done: 0, paid: 0 };
    for (const quest of allQuests(day)) {
      const period = periodFor(id, quest.scope, day);
      if (!period) continue;
      if (!period.taken[quest.index]) {
        period.taken[quest.index] = { count: 0, paid: false };
        result.taken += 1;
        continue;
      }
      const paid = claim(period, quest, pay);
      if (paid === null) continue;
      result.done += 1;
      result.paid += paid;
    }
    store.save();
    return result;
  },
  pull(id, kind, day) {
    const taken = peek(id, 'day', day)?.taken;
    const active = taken && questBoard('day', day).some((quest) => quest.kind === kind && statusOf(quest, taken[quest.index]) === 'active');
    return active ? 1 + QUEST.pull : 1;
  },
};
