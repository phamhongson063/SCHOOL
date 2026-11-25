import { LOTO, ODDS_MINUTES } from './config.js';
import { dayOf } from './clock.js';
import { createStore, readSaved } from './persist.js';
import { worldKey } from './saveKeys.js';
import { absorption } from './absorption.js';
import { fluency } from './fluency.js';
import {
  LOTO_CELLS,
  adoptPool,
  applyTap,
  blankMarks,
  callMinutes,
  closedCalls,
  hasBingo,
  lotoCalls,
  lotoCard,
  lotoPool,
  lotoSignOpen,
  lotoStart,
  lotoPrizeShare,
  nearBingo,
  npcCall,
  roundOf,
  validCall,
  validCard,
} from './lotoRules.js';

const KEY = worldKey('loto');
const MARKS = new RegExp(`^[.ox-]{${LOTO_CELLS}}$`);

const knownBy = (id) => (key) => absorption.chance(id, key);
const heardOdds = (id, key) => 1 - (1 - absorption.chance(id, key)) ** LOTO.rounds;
const cardOdds = (id, card) => (card.length ? card.reduce((sum, key) => sum + heardOdds(id, key), 0) / card.length : 0);

const blank = (day = null, last = null) => ({ day, start: LOTO.start, pool: day === null ? [] : lotoPool(day), joined: [], marks: {}, cards: {}, closed: 0, places: [], done: false, last });

const ids = (list) => (Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []);

function cleanPlaces(raw, winners, prize) {
  if (Array.isArray(raw)) return raw.filter((place) => ids(place?.ids).length).map((place) => ({ ids: ids(place.ids), prize: Number.isFinite(place.prize) ? place.prize : 0 }));
  const legacy = ids(winners);
  return legacy.length ? [{ ids: legacy, prize: Number.isFinite(prize) ? prize : 0 }] : [];
}

function keepCards(day, joined, raw) {
  return Object.fromEntries(joined.map((id) => [id, validCard(raw?.[id], day) ? [...raw[id]] : lotoCard(day, id)]));
}

function keepPool(day, raw) {
  if (Array.isArray(raw) && raw.length && raw.every(validCall)) adoptPool(day, raw);
  return lotoPool(day);
}

function cleanLast(raw) {
  if (!raw || !Number.isInteger(raw.day) || !Array.isArray(raw.entrants)) return null;
  return { day: raw.day, start: Number.isFinite(raw.start) ? raw.start : null, places: cleanPlaces(raw.places, raw.winners, raw.prize), entrants: ids(raw.entrants) };
}

function load() {
  try {
    const saved = readSaved(KEY);
    if (saved && typeof saved === 'object' && Number.isInteger(saved.day) && saved.start !== LOTO.start) return blank(null, cleanLast(saved.last));
    if (saved && typeof saved === 'object' && Number.isInteger(saved.day)) {
      const joined = Array.isArray(saved.joined) ? saved.joined.filter((id) => typeof id === 'string' && MARKS.test(saved.marks?.[id] ?? '')) : [];
      return {
        day: saved.day,
        start: LOTO.start,
        pool: keepPool(saved.day, saved.pool),
        joined,
        marks: Object.fromEntries(joined.map((id) => [id, saved.marks[id]])),
        cards: keepCards(saved.day, joined, saved.cards),
        closed: Number.isInteger(saved.closed) && saved.closed >= 0 ? saved.closed : 0,
        places: cleanPlaces(saved.places, saved.winners, saved.prize),
        done: saved.done === true || Array.isArray(saved.winners),
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

export function createLoto({ charge, payout, award, human }) {
  let state = load();
  const store = createStore(KEY, () => state);

  const joinedOn = (day) => (state.day === day ? state.joined : []);
  const finished = () => state.done;
  const placed = () => new Set(state.places.flatMap((place) => place.ids));
  const placeIn = (who) => state.places.findIndex((place) => place.ids.includes(who)) + 1;
  const copyPlaces = (places) => places.map((place) => ({ ids: [...place.ids], prize: place.prize }));
  const cardFor = (id, day) => (state.day === day && state.cards[id]) || lotoCard(day, id, knownBy(id));
  const oddsCache = new Map();

  function oddsOf(id, now) {
    const stamp = Math.floor(now / ODDS_MINUTES);
    const cached = oddsCache.get(id);
    if (cached?.stamp === stamp) return cached.odds;
    const odds = cardOdds(id, cardFor(id, dayOf(now)));
    oddsCache.set(id, { stamp, odds });
    return odds;
  }
  const potOf = () => LOTO.purse;

  function settle(at) {
    const already = placed();
    const fresh = state.joined.filter((id) => !already.has(id) && hasBingo(state.marks[id]));
    if (fresh.length && state.places.length < LOTO.places) {
      const purse = Math.floor(potOf() * (LOTO.prizes[state.places.length] ?? 0));
      award(fresh, LOTO.intellect);
      state.places.push({ ids: fresh, prize: purse > 0 ? payout(fresh, purse, at) : 0 });
    }
    const left = state.joined.some((id) => !placed().has(id));
    state.done = state.places.length >= LOTO.places || !left || state.closed >= lotoCalls(state.day).length;
    if (finished()) state.last = { day: state.day, start: state.start, places: copyPlaces(state.places), entrants: [...state.joined] };
  }

  function current(now) {
    if (state.day === null || finished() || !state.joined.length) return null;
    const calls = lotoCalls(state.day);
    const index = state.closed;
    const opensAt = lotoStart(state.day) + index * callMinutes;
    if (index >= calls.length || now < opensAt || now >= opensAt + callMinutes) return null;
    return { index, call: calls[index], left: (opensAt + callMinutes - now) * 60, ...roundOf(state.day, index) };
  }

  return {
    tick(now) {
      if (state.day === null || finished() || !state.joined.length) return false;
      const day = state.day;
      const pool = lotoPool(day);
      const calls = lotoCalls(day);
      const target = closedCalls(day, now);
      if (state.closed >= target) return false;
      while (state.closed < target && !finished()) {
        const call = calls[state.closed];
        const at = lotoStart(day) + (state.closed + 1) * callMinutes;
        const already = placed();
        for (const id of state.joined) {
          if (human(id) || already.has(id)) continue;
          state.marks[id] = npcCall(cardFor(id, day), state.marks[id], call, pool, (key) => heard(id, key, at));
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
      state.cards[who] = lotoCard(day, who, knownBy(who));
      oddsCache.delete(who);
      store.save();
      return 'ok';
    },
    joined: (who, now) => joinedOn(dayOf(now)).includes(who),
    entrants: (now) => [...joinedOn(dayOf(now))],
    pot: () => potOf(),
    worth(id, now) {
      const rivals = joinedOn(dayOf(now)).filter((other) => other !== id).map((other) => oddsOf(other, now));
      return lotoPrizeShare(oddsOf(id, now), rivals) * potOf() - LOTO.fee;
    },
    places: (now) => (state.day === dayOf(now) ? copyPlaces(state.places) : []),
    placeOf: (who, now) => (state.day === dayOf(now) ? placeIn(who) : 0),
    current,
    cardOf: (who, now) => cardFor(who, dayOf(now)),
    bingo(who, now) {
      const marks = this.marksOf(who, now);
      return !!marks && hasBingo(marks);
    },
    marksOf: (who, now) => (joinedOn(dayOf(now)).includes(who) ? state.marks[who] : null),
    near(who, now) {
      const marks = this.marksOf(who, now);
      return !!marks && !finished() && !placeIn(who) && now >= lotoStart(dayOf(now)) && nearBingo(marks);
    },
    closedCount: (now) => (state.day === dayOf(now) ? state.closed : 0),
    callAt: (now, index) => lotoCalls(dayOf(now))[index] ?? null,
    result(now) {
      if (state.day !== dayOf(now) || !finished()) return null;
      return { places: copyPlaces(state.places), winners: [...placed()] };
    },
    lastResult: () => (state.last ? { ...state.last, places: copyPlaces(state.last.places), winners: state.last.places.flatMap((place) => place.ids), entrants: [...state.last.entrants] } : null),
    tap(who, cell, now) {
      const open = current(now);
      if (!open || !state.joined.includes(who) || placeIn(who)) return null;
      const { marks, result } = applyTap(cardFor(who, state.day), state.marks[who], new Set(open.call.keys), cell);
      if (!result) return null;
      state.marks[who] = marks;
      store.save();
      return result;
    },
  };
}
