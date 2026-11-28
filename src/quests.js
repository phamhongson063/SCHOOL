import { CERTIFY, QUEST } from './config.js';
import { createStore, readEntries } from './persist.js';
import { worldKey } from './saveKeys.js';
import { makeRandom } from './random.js';
import { DECKS, DECK_IDS } from './studyDecks.js';
import { certify } from './certify.js';

const KEY = worldKey('quests');
const BOARD_VERSION = 3;
export const QUEST_KINDS = Object.keys(QUEST.kinds);
export const QUEST_SCOPES = ['day', 'week'];

export const weekOf = (day) => Math.floor((day + 3) / 7);
const periodOf = (scope, day) => (scope === 'week' ? weekOf(day) : day);
const SALT = { day: 1, week: 7919 };

const pickOf = (rand, list) => list[Math.floor(rand() * list.length)];

const decksFor = (kind) => {
  const spec = QUEST.kinds[kind];
  return spec.deck ? DECK_IDS.filter((id) => !spec.needs || DECKS[id][spec.needs]) : [];
};
const DECKS_FOR = Object.fromEntries(QUEST_KINDS.map((kind) => [kind, decksFor(kind)]));
const usable = (kind) => !QUEST.kinds[kind].deck || DECKS_FOR[kind].length > 0;

function rollGoal(rand, [lo, hi], unit = 1) {
  const choices = Math.floor((hi - lo) / unit) + 1;
  return lo + unit * Math.floor(rand() * choices);
}

function rollWeighted(rand, items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = rand() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll < 0) return item;
  }
  return items.at(-1);
}

const DAY_KINDS = QUEST_KINDS.filter(usable);

function makeStep(rand, kind, scope, deck) {
  const spec = QUEST.kinds[kind];
  const step = { kind, goal: rollGoal(rand, spec[scope], spec.unit) };
  if (spec.deck) step.deck = deck ?? pickOf(rand, DECKS_FOR[kind]);
  return step;
}

const stepId = (step) => `${step.kind}:${step.deck ?? ''}`;

function singleQuests(rand) {
  const seen = new Set();
  const board = [];
  for (let tries = 0; board.length < QUEST.day.count && tries < QUEST.day.count * 20; tries++) {
    const step = makeStep(rand, rollWeighted(rand, DAY_KINDS, (kind) => QUEST.kinds[kind].weight), 'day');
    if (seen.has(stepId(step))) continue;
    seen.add(stepId(step));
    board.push([step]);
  }
  return board;
}

const pathDecks = (path) => DECK_IDS.filter((id) => path.steps.every((kind) => !QUEST.kinds[kind].deck || DECKS_FOR[kind].includes(id)));
const PATHS = QUEST.week.paths.filter((path) => path.steps.every(usable) && (!path.steps.some((kind) => QUEST.kinds[kind].deck) || pathDecks(path).length));

function chainQuests(rand) {
  const seen = new Set();
  const board = [];
  for (let tries = 0; board.length < QUEST.week.count && tries < QUEST.week.count * 20; tries++) {
    const path = rollWeighted(rand, PATHS, (item) => item.weight);
    const deck = path.steps.some((kind) => QUEST.kinds[kind].deck) ? pickOf(rand, pathDecks(path)) : null;
    const id = `${path.steps.join('>')}:${deck ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    board.push(path.steps.map((kind) => makeStep(rand, kind, 'week', deck)));
  }
  return board;
}

const deckLeft = (id, deck) => !certify.finished(id, deck);
const hasCertified = (id, deck) => certify.certifiedCount(id, deck) > 0;

const STEP_OPEN = {
  day: {
    learn: (id, deck, left) => certify.learnLeft(id, deck).length >= left,
    sit: (id, deck) => certify.learnLeft(id, deck).length > 0 || hasCertified(id, deck),
    review: hasCertified,
    speak: hasCertified,
    internal: (id, deck) => certify.needsInternal(id, deck) && certify.internalTriesLeft(id, deck) > 0 && !certify.examTaken(id, deck),
    exam: (id, deck) => certify.batch(id, deck).length > 0 && !certify.examTaken(id, deck),
  },
  week: {
    learn: deckLeft,
    sit: (id, deck) => deckLeft(id, deck) || hasCertified(id, deck),
    review: (id, deck) => deckLeft(id, deck) || hasCertified(id, deck),
    speak: (id, deck) => deckLeft(id, deck) || hasCertified(id, deck),
    internal: deckLeft,
    exam: deckLeft,
  },
};

export function stepOpen(id, step, scope, left, money) {
  const spec = QUEST.kinds[step.kind];
  if (!spec.deck) return true;
  if (!DECKS_FOR[step.kind].includes(step.deck)) return false;
  if (!(money >= certify.fee(step.deck, CERTIFY[spec.fee] ?? 0))) return false;
  return STEP_OPEN[scope][step.kind](id, step.deck, left);
}

const questOpen = (id, quest, money) => quest.steps.every((step) => stepOpen(id, step, quest.scope, step.goal, money));

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

function take(id, quest, day, money) {
  const period = periodFor(id, quest.scope, day);
  if (!period || period.taken[quest.index] || activeCount(id, day) >= QUEST.active || !questOpen(id, quest, money)) return false;
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
  view(id, day, money) {
    return allQuests(day).map((quest) => {
      const held = heldOf(id, quest, day);
      const status = statusOf(quest, held);
      const step = status === 'active' ? held.step : status === 'open' ? 0 : quest.steps.length;
      const count = status === 'active' ? Math.min(Math.floor(held.count), quest.steps[step].goal) : 0;
      const blocked = status === 'open' && !questOpen(id, quest, money);
      return { ...quest, status, step, count, blocked };
    });
  },
  active(id, day) {
    return activeCount(id, day);
  },
  accept(id, scope, index, day, money) {
    const quest = questBoard(scope, day)[index];
    if (!quest || !take(id, quest, day, money)) return false;
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
  tend(id, day, { money, pay, fit }) {
    const result = { taken: 0, done: 0, dropped: 0, paid: 0 };
    for (const quest of allQuests(day)) {
      const held = heldOf(id, quest, day);
      const status = statusOf(quest, held);
      if (status === 'ready') {
        const paid = claim(id, quest, day, pay);
        if (paid === null) continue;
        result.done += 1;
        result.paid += paid;
      } else if (status === 'active' && !stepOpen(id, quest.steps[held.step], quest.scope, stepLeft(quest, held), money) && drop(id, quest, day)) {
        result.dropped += 1;
      }
    }
    const room = QUEST.active - activeCount(id, day);
    if (room > 0) {
      const picks = allQuests(day)
        .filter((quest) => statusOf(quest, heldOf(id, quest, day)) === 'open' && questOpen(id, quest, money))
        .map((quest) => ({ quest, score: quest.steps.reduce((sum, step) => sum + fit(step), 0) / quest.steps.length }))
        .filter((pick) => pick.score >= QUEST.minFit)
        .sort((a, b) => b.score - a.score)
        .slice(0, room);
      for (const { quest } of picks) if (take(id, quest, day, money)) result.taken += 1;
    }
    if (result.taken || result.done || result.dropped) changed(id);
    return result;
  },
  pull(id, kind, day, quest = null) {
    const steps = currentSteps(id, day);
    const mind = steps.some((step) => QUEST.kinds[step.kind].mind === kind) ? QUEST.pull : 0;
    const exact = quest && steps.some((step) => step.kind === quest) ? QUEST.pull : 0;
    return 1 + mind + exact;
  },
  deckPull(id, deck, day) {
    return currentSteps(id, day).some((step) => step.deck === deck) ? QUEST.deckPull : 0;
  },
};

certify.onPass((actor, deck, kind, day) => quests.note(actor, kind, day, 1, deck));
