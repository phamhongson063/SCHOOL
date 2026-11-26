import { QUEST } from './config.js';
import { createStore, readEntries } from './persist.js';
import { worldKey } from './saveKeys.js';
import { makeRandom } from './random.js';
import { DECK_IDS } from './studyDecks.js';

const KEY = worldKey('quests');
const BOARD_VERSION = 2;
export const QUEST_KINDS = Object.keys(QUEST.kinds);
export const QUEST_SCOPES = ['day', 'week'];
const MIND_KIND = { learn: 'study', sit: 'study', farm: 'farm', fish: 'fish', hunt: 'hunt' };

export const weekOf = (day) => Math.floor((day + 3) / 7);
const periodOf = (scope, day) => (scope === 'week' ? weekOf(day) : day);
const SALT = { day: 1, week: 7919 };

const pickOf = (rand, list) => list[Math.floor(rand() * list.length)];

function rollGoal(rand, [lo, hi], unit = 1) {
  const choices = Math.floor((hi - lo) / unit) + 1;
  return lo + unit * Math.floor(rand() * choices);
}

function rollKind(rand) {
  const total = QUEST_KINDS.reduce((sum, kind) => sum + QUEST.kinds[kind].weight, 0);
  let roll = rand() * total;
  for (const kind of QUEST_KINDS) {
    roll -= QUEST.kinds[kind].weight;
    if (roll < 0) return kind;
  }
  return QUEST_KINDS.at(-1);
}

function rollStep(rand, scope, deck) {
  const kind = rollKind(rand);
  const spec = QUEST.kinds[kind];
  const step = { kind, goal: rollGoal(rand, spec[scope], spec.unit) };
  if (spec.deck) step.deck = deck ?? pickOf(rand, DECK_IDS);
  return step;
}

const stepId = (step) => `${step.kind}:${step.deck ?? ''}`;

function singleQuests(rand) {
  const seen = new Set();
  const board = [];
  for (let tries = 0; board.length < QUEST.day.count && tries < QUEST.day.count * 20; tries++) {
    const step = rollStep(rand, 'day');
    if (seen.has(stepId(step))) continue;
    seen.add(stepId(step));
    board.push([step]);
  }
  return board;
}

function chainQuests(rand) {
  const board = [];
  for (let n = 0; n < QUEST.week.count; n++) {
    const deck = pickOf(rand, DECK_IDS);
    const length = rollGoal(rand, QUEST.week.steps);
    const steps = [];
    for (let tries = 0; steps.length < length && tries < length * 20; tries++) {
      const step = rollStep(rand, 'week', deck);
      if (steps.some((other) => stepId(other) === stepId(step))) continue;
      steps.push(step);
    }
    board.push(steps);
  }
  return board;
}

const boardCache = { day: { at: null, board: [] }, week: { at: null, board: [] } };

export function questBoard(scope, day) {
  const at = periodOf(scope, day);
  const cache = boardCache[scope];
  if (cache.at === at) return cache.board;
  const rand = makeRandom(at * 31 + SALT[scope] + BOARD_VERSION * 104729);
  const lists = scope === 'week' ? chainQuests(rand) : singleQuests(rand);
  const board = lists.map((steps, index) => ({ scope, index, steps }));
  boardCache[scope] = { at, board };
  return board;
}

const allQuests = (day) => QUEST_SCOPES.flatMap((scope) => questBoard(scope, day));

const whole = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

function cleanPeriod(raw, scope) {
  if (!Number.isInteger(raw?.at) || raw.v !== BOARD_VERSION || !raw.taken || typeof raw.taken !== 'object') return null;
  const size = scope === 'week' ? QUEST.week.count : QUEST.day.count;
  const taken = {};
  for (const [index, held] of Object.entries(raw.taken)) {
    if (!/^\d+$/.test(index) || Number(index) >= size) continue;
    taken[index] = { step: whole(held?.step), count: whole(held?.count), paid: held?.paid === true };
  }
  return { at: raw.at, v: BOARD_VERSION, taken };
}

function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const entry = {};
  for (const scope of QUEST_SCOPES) {
    const period = cleanPeriod(raw[scope], scope);
    if (period) entry[scope] = period;
  }
  return entry;
}

const entries = readEntries(KEY, cleanEntry);
const store = createStore(KEY, () => entries);
const listeners = new Set();

function changed(id) {
  store.save();
  for (const listener of listeners) listener(id);
}

function periodFor(id, scope, day) {
  if (!Number.isInteger(day)) return null;
  const at = periodOf(scope, day);
  const entry = (entries[id] ??= {});
  const period = entry[scope];
  if (period && period.at > at) return null;
  if (!period || period.at < at) entry[scope] = { at, v: BOARD_VERSION, taken: {} };
  return entry[scope];
}

function peek(id, scope, day) {
  const period = entries[id]?.[scope];
  return period && period.at === periodOf(scope, day) ? period : null;
}

const heldOf = (id, quest, day) => peek(id, quest.scope, day)?.taken[quest.index] ?? null;

function statusOf(quest, held) {
  if (!held) return 'open';
  if (held.paid) return 'done';
  return held.step >= quest.steps.length ? 'ready' : 'active';
}

function activeCount(id, day) {
  return allQuests(day).filter((quest) => {
    const status = statusOf(quest, heldOf(id, quest, day));
    return status === 'active' || status === 'ready';
  }).length;
}

function currentSteps(id, day) {
  return allQuests(day)
    .filter((quest) => statusOf(quest, heldOf(id, quest, day)) === 'active')
    .map((quest) => quest.steps[heldOf(id, quest, day).step]);
}

function take(id, quest, day) {
  const period = periodFor(id, quest.scope, day);
  if (!period || period.taken[quest.index] || activeCount(id, day) >= QUEST.active) return false;
  period.taken[quest.index] = { step: 0, count: 0, paid: false };
  return true;
}

function claim(id, quest, day, pay) {
  const held = heldOf(id, quest, day);
  if (statusOf(quest, held) !== 'ready') return null;
  held.paid = true;
  return pay(quest.scope);
}

function drop(id, quest, day) {
  const period = peek(id, quest.scope, day);
  const held = period?.taken[quest.index];
  if (!held || held.paid) return false;
  delete period.taken[quest.index];
  return true;
}

function stepLeft(quest, held) {
  return quest.steps[held.step].goal - held.count;
}

export const quests = {
  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  view(id, day) {
    return allQuests(day).map((quest) => {
      const held = heldOf(id, quest, day);
      const status = statusOf(quest, held);
      const step = status === 'active' ? held.step : status === 'open' ? 0 : quest.steps.length;
      const count = status === 'active' ? Math.min(Math.floor(held.count), quest.steps[step].goal) : 0;
      return { ...quest, status, step, count };
    });
  },
  active(id, day) {
    return activeCount(id, day);
  },
  accept(id, scope, index, day) {
    const quest = questBoard(scope, day)[index];
    if (!quest || !take(id, quest, day)) return false;
    changed(id);
    return true;
  },
  drop(id, scope, index, day) {
    const quest = questBoard(scope, day)[index];
    if (!quest || !drop(id, quest, day)) return false;
    changed(id);
    return true;
  },
  turnIn(id, scope, index, day, pay) {
    const quest = questBoard(scope, day)[index];
    const paid = quest ? claim(id, quest, day, pay) : null;
    if (paid !== null) changed(id);
    return paid;
  },
  note(id, kind, day, amount = 1, deck = null) {
    if (!(amount > 0)) return;
    let moved = false;
    for (const quest of allQuests(day)) {
      const held = heldOf(id, quest, day);
      if (statusOf(quest, held) !== 'active') continue;
      const step = quest.steps[held.step];
      if (step.kind !== kind || (step.deck && step.deck !== deck)) continue;
      held.count += amount;
      if (held.count >= step.goal) {
        held.step += 1;
        held.count = 0;
      }
      moved = true;
    }
    if (moved) changed(id);
  },
  tend(id, day, { pay, fit }) {
    const result = { taken: 0, done: 0, dropped: 0, paid: 0 };
    for (const quest of allQuests(day)) {
      const held = heldOf(id, quest, day);
      const status = statusOf(quest, held);
      if (status === 'ready') {
        const paid = claim(id, quest, day, pay);
        if (paid === null) continue;
        result.done += 1;
        result.paid += paid;
      } else if (status === 'active' && !(fit(quest.steps[held.step], quest.scope, stepLeft(quest, held)) > 0) && drop(id, quest, day)) {
        result.dropped += 1;
      }
    }
    const room = QUEST.active - activeCount(id, day);
    if (room > 0) {
      const picks = allQuests(day)
        .filter((quest) => statusOf(quest, heldOf(id, quest, day)) === 'open')
        .map((quest) => {
          const fits = quest.steps.map((step) => fit(step, quest.scope, step.goal));
          return { quest, score: fits.every((value) => value > 0) ? fits.reduce((sum, value) => sum + value, 0) / fits.length : 0 };
        })
        .filter((pick) => pick.score >= QUEST.minFit)
        .sort((a, b) => b.score - a.score)
        .slice(0, room);
      for (const { quest } of picks) if (take(id, quest, day)) result.taken += 1;
    }
    if (result.taken || result.done || result.dropped) changed(id);
    return result;
  },
  pull(id, kind, day) {
    return currentSteps(id, day).some((step) => MIND_KIND[step.kind] === kind) ? 1 + QUEST.pull : 1;
  },
  deckPull(id, deck, day) {
    return currentSteps(id, day).some((step) => step.deck === deck) ? QUEST.deckPull : 0;
  },
};
