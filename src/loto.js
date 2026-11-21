import { LOTO } from './config.js';
import { dayOf } from './clock.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';
import { absorption } from './absorption.js';
import { fluency } from './fluency.js';
import {
  LOTO_CELLS,
  adoptPool,
  applyTap,
  blankMarks,
  callMinutes,
  closeCall,
  closedCalls,
  hasBingo,
  lotoCard,
  lotoPool,
  lotoSignOpen,
  lotoStart,
  lotoWinOdds,
  nearBingo,
  npcCall,
  validCall,
} from './lotoRules.js';

const KEY = worldKey('loto');
const MARKS = new RegExp(`^[.ox-]{${LOTO_CELLS}}$`);

const ODDS_MINUTES = 10;
const oddsCache = new Map();

export function lotoOdds(id, now) {
  const day = dayOf(now);
  const stamp = Math.floor(now / ODDS_MINUTES);
  const cached = oddsCache.get(id);
  if (cached?.stamp === stamp) return cached.odds;
  const pool = lotoPool(day);
  const odds = pool.length ? pool.reduce((sum, call) => sum + absorption.chance(id, call.key), 0) / pool.length : 0;
  oddsCache.set(id, { stamp, odds });
  return odds;
}

export function lotoWorth(id, now, entrants, pot) {
  const rivals = entrants.filter((other) => other !== id).map((other) => lotoOdds(other, now));
  return lotoWinOdds(lotoOdds(id, now), rivals) * (pot + LOTO.fee) - LOTO.fee;
}

const blank = (day = null, last = null) => ({ day, pool: day === null ? [] : lotoPool(day), joined: [], marks: {}, closed: 0, winners: null, prize: 0, last });

function keepPool(day, raw) {
  if (Array.isArray(raw) && raw.length && raw.every(validCall)) adoptPool(day, raw);
  return lotoPool(day);
}

function cleanLast(raw) {
  if (!raw || !Number.isInteger(raw.day) || !Array.isArray(raw.winners) || !Array.isArray(raw.entrants)) return null;
  const ids = (list) => list.filter((id) => typeof id === 'string');
  return { day: raw.day, winners: ids(raw.winners), entrants: ids(raw.entrants), prize: Number.isFinite(raw.prize) ? raw.prize : 0 };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object' && Number.isInteger(saved.day)) {
      const joined = Array.isArray(saved.joined) ? saved.joined.filter((id) => typeof id === 'string' && MARKS.test(saved.marks?.[id] ?? '')) : [];
      return {
        day: saved.day,
        pool: keepPool(saved.day, saved.pool),
        joined,
        marks: Object.fromEntries(joined.map((id) => [id, saved.marks[id]])),
        closed: Number.isInteger(saved.closed) && saved.closed >= 0 ? saved.closed : 0,
        winners: Array.isArray(saved.winners) ? saved.winners.filter((id) => typeof id === 'string') : null,
        prize: Number.isFinite(saved.prize) ? saved.prize : 0,
        last: cleanLast(saved.last),
      };
    }
  } catch {}
  return blank();
}

function heard(id, key, at) {
  const day = dayOf(at);
  const answer = absorption.respond(id, key, LOTO.callSeconds, day);
  fluency.recall(id, key, day, answer.correct);
  return answer.correct && answer.seconds < LOTO.callSeconds;
}

export function createLoto({ charge, payout, budget, human }) {
  let state = load();
  const store = createStore(KEY, () => state);

  const joinedOn = (day) => (state.day === day ? state.joined : []);
  const finished = () => state.winners !== null;
  const potOf = (day) => joinedOn(day).length * LOTO.fee + Math.max(0, Math.floor(budget(day)));

  function settle(at) {
    const winners = state.joined.filter((id) => hasBingo(state.marks[id]));
    if (winners.length) {
      state.winners = winners;
      state.prize = payout(winners, potOf(state.day), at);
    } else if (state.closed >= lotoPool(state.day).length) state.winners = [];
    if (finished()) state.last = { day: state.day, winners: [...state.winners], entrants: [...state.joined], prize: state.prize };
  }

  function current(now) {
    if (state.day === null || finished() || !state.joined.length) return null;
    const pool = lotoPool(state.day);
    const index = state.closed;
    const opensAt = lotoStart(state.day) + index * callMinutes;
    if (index >= pool.length || now < opensAt || now >= opensAt + callMinutes) return null;
    return { index, call: pool[index], left: (opensAt + callMinutes - now) * 60, total: pool.length };
  }

  return {
    tick(now) {
      if (state.day === null || finished() || !state.joined.length) return false;
      const day = state.day;
      const pool = lotoPool(day);
      const target = closedCalls(day, now);
      if (state.closed >= target) return false;
      while (state.closed < target && !finished()) {
        const call = pool[state.closed];
        const at = lotoStart(day) + (state.closed + 1) * callMinutes;
        for (const id of state.joined) {
          const card = lotoCard(day, id);
          const marks = state.marks[id];
          state.marks[id] = human(id) ? closeCall(card, marks, call) : npcCall(card, marks, call, pool, (key) => heard(id, key, at));
        }
        state.closed += 1;
        settle(at);
      }
      store.save();
      return true;
    },
    register(who, now) {
      const day = dayOf(now);
      if (!lotoSignOpen(now)) return 'closed';
      if (joinedOn(day).includes(who)) return 'already';
      if (!charge(who, LOTO.fee)) return 'poor';
      if (state.day !== day) state = blank(day, state.last);
      state.joined.push(who);
      state.marks[who] = blankMarks();
      store.save();
      return 'ok';
    },
    joined: (who, now) => joinedOn(dayOf(now)).includes(who),
    entrants: (now) => [...joinedOn(dayOf(now))],
    pot: (now) => potOf(dayOf(now)),
    current,
    cardOf: (who, now) => lotoCard(dayOf(now), who),
    bingo(who, now) {
      const marks = this.marksOf(who, now);
      return !!marks && hasBingo(marks);
    },
    marksOf: (who, now) => (joinedOn(dayOf(now)).includes(who) ? state.marks[who] : null),
    near(who, now) {
      const marks = this.marksOf(who, now);
      return !!marks && !finished() && now >= lotoStart(dayOf(now)) && nearBingo(marks);
    },
    closedCount: (now) => (state.day === dayOf(now) ? state.closed : 0),
    callAt: (now, index) => lotoPool(dayOf(now))[index] ?? null,
    result(now) {
      if (state.day !== dayOf(now) || !finished()) return null;
      return { winners: [...state.winners], prize: state.prize };
    },
    lastResult: () => (state.last ? { ...state.last, winners: [...state.last.winners], entrants: [...state.last.entrants] } : null),
    tap(who, cell, now) {
      const open = current(now);
      if (!open || !state.joined.includes(who)) return null;
      const { marks, result } = applyTap(lotoCard(state.day, who), state.marks[who], open.call, cell);
      if (!result) return null;
      state.marks[who] = marks;
      store.save();
      return result;
    },
  };
}
