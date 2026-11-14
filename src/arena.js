import { ARENA, DAYLIGHT } from './config.js';
import { certify } from './certify.js';
import { absorption } from './absorption.js';
import { ARENA_POOL, economy } from './economy.js';
import { DECKS } from './studyDecks.js';
import { PLAYER } from './inventory.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';
import { DAY_MINUTES, dayOf, minuteOfDay } from './clock.js';

const KEY = worldKey('arena');
const DATA_VERSION = 1;
const PHASES = ['open', 'running', 'done'];
const SIDES = ['a', 'b'];
const LIVE_MINUTES = (ARENA.finalSets * ARENA.turns * (ARENA.read + ARENA.seconds + ARENA.pause)) / 60 + ARENA.grace;

const other = (side) => (side === 'a' ? 'b' : 'a');
const isHuman = (id) => id === PLAYER;
const sideOf = (match, id) => (match.a === id ? 'a' : match.b === id ? 'b' : null);
const signature = (event) => `${event.phase}:${event.round}:${event.rounds[event.round]?.filter((match) => match.winner).length ?? 0}`;

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function sizeAt(at) {
  const minute = minuteOfDay(at);
  return minute >= DAYLIGHT.sunrise && minute < DAYLIGHT.sunset ? ARENA.size.day : ARENA.size.night;
}

export const capacityOf = (event) => event.size ?? sizeAt(event.at);

const blankEvent = (at) => ({ at, size: sizeAt(at), phase: 'open', deck: ARENA.deck, entrants: [], drafted: [], away: [], pot: 0, rounds: [], round: -1, places: [] });

function slotOf(now) {
  const day = dayOf(now);
  let best = null;
  for (const d of [day - 1, day, day + 1]) {
    for (const start of ARENA.starts) {
      const at = d * DAY_MINUTES + start;
      if (at - ARENA.lead <= now && (best === null || at > best)) best = at;
    }
  }
  return best;
}

export function nextStart(now) {
  const day = dayOf(now);
  let best = null;
  for (const d of [day, day + 1]) {
    for (const start of ARENA.starts) {
      const at = d * DAY_MINUTES + start;
      if (at > now && (best === null || at < best)) best = at;
    }
  }
  return best;
}

export function roundName(size) {
  return ARENA.rounds[size] ?? `Vòng ${size * 2}`;
}

export function exitOf(event, id) {
  for (const round of event.rounds) {
    const match = round.find((item) => item.a === id || item.b === id);
    if (match && match.winner && match.winner !== id) return { round: round.length, forfeit: match.forfeit === id, reason: match.reason };
  }
  return null;
}

const isIdList = (list) => Array.isArray(list) && list.every((id) => typeof id === 'string');

function validEvent(raw) {
  return (
    raw &&
    typeof raw === 'object' &&
    Number.isFinite(raw.at) &&
    PHASES.includes(raw.phase) &&
    DECKS[raw.deck] &&
    isIdList(raw.entrants) &&
    isIdList(raw.drafted) &&
    (raw.away === undefined || isIdList(raw.away)) &&
    Number.isFinite(raw.pot) &&
    Number.isInteger(raw.round) &&
    Array.isArray(raw.rounds) &&
    raw.rounds.every((round) => Array.isArray(round) && round.every((match) => match && typeof match === 'object' && match.hp && match.time && Array.isArray(match.turns) && Array.isArray(match.asked))) &&
    raw.round < raw.rounds.length &&
    Array.isArray(raw.places)
  );
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object' && saved.version === DATA_VERSION) {
      return {
        event: validEvent(saved.event) ? saved.event : null,
        champions: Array.isArray(saved.champions) ? saved.champions.filter((item) => Number.isFinite(item?.at) && typeof item?.id === 'string').slice(0, ARENA.champions) : [],
        purged: false,
      };
    }
    if (saved) return { event: null, champions: [], purged: true };
  } catch {}
  return { event: null, champions: [], purged: false };
}

export const turnSeconds = (turn) => ARENA.read + Math.max(turn.a.seconds, turn.b.seconds) + ARENA.pause + (turn.setWinner ? ARENA.setPause : 0);

export const matchMinutes = (match) => match.turns.reduce((sum, turn) => sum + turnSeconds(turn), 0) / 60;

const endOf = (match) => match.endAt ?? match.startAt + matchMinutes(match);

const freeAt = (match) => (match.reason === 'bye' ? match.endAt : endOf(match) + ARENA.breather / 60);

export function nextAt(event) {
  if (event?.phase !== 'running') return null;
  if (event.round < 0) return event.firstAt ?? event.at;
  const round = event.rounds[event.round];
  if (!round || round.some((match) => !match.winner)) return null;
  return Math.max(...round.map(endOf)) + ARENA.breather / 60;
}

export function damageOf({ correct, seconds }, limit = ARENA.seconds) {
  if (!correct) return 0;
  const left = Math.max(0, 1 - seconds / limit);
  return Math.round(ARENA.hit * (1 + ARENA.speed * left));
}

export const comboOf = (streak) => 1 + ARENA.combo.step * Math.min(Math.max(0, streak - 1), ARENA.combo.max);

export const enraged = (hp) => hp > 0 && hp <= ARENA.hp * ARENA.rage.below;

function cleanAnswer(raw, limit) {
  const seconds = Number(raw?.seconds);
  return { correct: raw?.correct === true, seconds: Number.isFinite(seconds) ? Math.max(0, Math.min(limit, seconds)) : limit };
}

function newMatch(a, b, need = 1) {
  return { a, b, winner: null, forfeit: null, live: false, startAt: null, hp: { a: ARENA.hp, b: ARENA.hp }, time: { a: 0, b: 0 }, streak: { a: 0, b: 0 }, set: 1, sets: { a: 0, b: 0 }, need, asked: [], pending: null, rival: null, tier: null, turns: [], reason: null, endAt: null };
}

const setTurns = (match) => match.turns.filter((turn) => (turn.set ?? 1) === (match.set ?? 1)).length;

export function tierOf(match) {
  const played = setTurns(match);
  if (played < ARENA.tiers.easy) return 'easy';
  return played >= ARENA.tiers.hard ? 'hard' : 'normal';
}

export const limitOf = (tier) => (tier === 'hard' ? ARENA.hardSeconds : ARENA.seconds);

function pickKey(match, deck, tier = 'normal') {
  const mine = new Set(certify.certified(match.a, deck));
  const theirs = new Set(certify.certified(match.b, deck));
  const pool = [...new Set([...mine, ...theirs])];
  if (!pool.length) return null;
  const asked = new Set(match.asked);
  const source = match.asked.length % 2 === 0 ? mine : theirs;
  const own = source.size ? [...source] : pool;
  const weak = (key) => certify.familiarity(match.a, key) === 'weak' || certify.familiarity(match.b, key) === 'weak';
  const preferred = tier === 'easy' ? pool.filter((key) => mine.has(key) && theirs.has(key)) : tier === 'hard' ? own.filter((key) => mine.has(key) !== theirs.has(key) || weak(key)) : own;
  for (const list of [preferred.filter((key) => !asked.has(key)), own.filter((key) => !asked.has(key)), pool.filter((key) => !asked.has(key)), pool]) {
    if (list.length) return list[Math.floor(Math.random() * list.length)];
  }
  return null;
}

function sideAhead(match) {
  const { hp, time } = match;
  if (hp.a !== hp.b) return hp.a > hp.b ? 'a' : 'b';
  if (time.a !== time.b) return time.a < time.b ? 'a' : 'b';
  return Math.random() < 0.5 ? 'a' : 'b';
}

function settle(match, side, reason) {
  match.reason = reason;
  match.winner = match[side];
  match.live = false;
  match.pending = null;
  match.rival = null;
  match.tier = null;
}

function decide(match, reason) {
  const sets = match.sets ?? { a: 0, b: 0 };
  settle(match, sets.a !== sets.b ? (sets.a > sets.b ? 'a' : 'b') : sideAhead(match), reason);
}

function forfeit(match, id, at) {
  const side = sideOf(match, id);
  match.forfeit = id;
  match.endAt = at;
  settle(match, other(side), 'forfeit');
}

function endSet(match, turn, reason) {
  const side = sideAhead(match);
  match.sets ??= { a: 0, b: 0 };
  match.sets[side] += 1;
  turn.setWinner = side;
  if (match.sets[side] >= (match.need ?? 1)) {
    settle(match, side, reason);
    return;
  }
  match.set = (match.set ?? 1) + 1;
  match.hp = { a: ARENA.hp, b: ARENA.hp };
  match.streak = { a: 0, b: 0 };
}

function resolveTurn(match, key, answers, tier = 'normal') {
  const limit = limitOf(tier);
  const turn = { key, tier, limit, set: match.set ?? 1 };
  match.streak ??= { a: 0, b: 0 };
  const moves = {};
  for (const side of SIDES) {
    moves[side] = cleanAnswer(answers[side], limit);
    match.streak[side] = moves[side].correct ? match.streak[side] + 1 : 0;
    match.time[side] += moves[side].seconds;
  }
  const right = SIDES.filter((side) => moves[side].correct);
  let striker = right.length === 1 ? right[0] : null;
  if (right.length === 2 && moves.a.seconds !== moves.b.seconds) striker = moves.a.seconds < moves.b.seconds ? 'a' : 'b';
  turn.striker = striker;
  for (const side of SIDES) {
    const move = moves[side];
    const strikes = side === striker;
    const rage = strikes && enraged(match.hp[side]);
    const combo = move.correct ? match.streak[side] : 0;
    const guarded = strikes && moves[other(side)].correct;
    const damage = strikes ? Math.round(damageOf(move, limit) * comboOf(combo) * (rage ? ARENA.rage.boost : 1) * (guarded ? ARENA.guard : 1)) : 0;
    turn[side] = { ...move, damage, combo, rage, blocked: move.correct && !strikes };
  }
  if (striker) match.hp[other(striker)] = Math.max(0, match.hp[other(striker)] - turn[striker].damage);
  match.asked.push(key);
  match.pending = null;
  match.rival = null;
  match.tier = null;
  match.turns.push(turn);
  turn.hp = { ...match.hp };
  if (match.hp.a <= 0 || match.hp.b <= 0) endSet(match, turn, 'ko');
  else if (setTurns(match) >= ARENA.turns) endSet(match, turn, 'turns');
  return turn;
}

function simulate(match, deck) {
  while (!match.winner) {
    const tier = tierOf(match);
    const key = pickKey(match, deck, tier);
    if (!key) {
      decide(match, 'empty');
      break;
    }
    const limit = limitOf(tier);
    resolveTurn(match, key, { a: absorption.respond(match.a, key, limit), b: absorption.respond(match.b, key, limit) }, tier);
  }
}

function draw(event) {
  const entrants = shuffle([...event.entrants]);
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, entrants.length)));
  const pairs = size / 2;
  const need = pairs === 1 ? Math.ceil(ARENA.finalSets / 2) : 1;
  event.rounds = [Array.from({ length: pairs }, (_, i) => newMatch(entrants[i], entrants[pairs + i] ?? null, need))];
  event.round = -1;
}

function nextPairs(round) {
  const need = round.length === 2 ? Math.ceil(ARENA.finalSets / 2) : 1;
  return Array.from({ length: round.length / 2 }, (_, i) => newMatch(round[2 * i].winner, round[2 * i + 1].winner, need));
}

function startMatch(match, at, present, deck) {
  match.startAt = at;
  if (!match.a || !match.b) {
    match.winner = match.a ?? match.b;
    match.reason = 'bye';
    match.endAt = at;
    return;
  }
  const human = [match.a, match.b].find(isHuman);
  if (human) {
    if (present(human)) match.live = true;
    else forfeit(match, human, at);
    return;
  }
  simulate(match, deck);
  match.endAt = at + matchMinutes(match);
}

function startRound(event, at, present) {
  const index = event.round + 1;
  if (index > 0) event.rounds[index] = nextPairs(event.rounds[index - 1]);
  event.round = index;
  event.rounds[index].forEach((match, i) => {
    if (i < ARENA.stages || !match.a || !match.b) startMatch(match, at, present, event.deck);
  });
}

function startWaiting(event, now, present) {
  const round = event.rounds[event.round];
  round.forEach((match, i) => {
    if (match.startAt !== null || i < ARENA.stages) return;
    const before = round[i - ARENA.stages];
    if (!before.winner) return;
    const at = freeAt(before);
    if (now >= at) startMatch(match, Number.isFinite(now) ? Math.max(at, now) : at, present, event.deck);
  });
}

export function createArena({ ledger, roster = () => [] }) {
  const state = load();
  const purged = state.purged;
  delete state.purged;
  const store = createStore(KEY, () => ({ version: DATA_VERSION, savedAt: Date.now(), ...state }));
  if (purged) store.save();
  const finished = [];
  const thought = new Map();

  function eventOf(at, now) {
    if (at === null || (state.event && state.event.at > at)) return null;
    if (!state.event || state.event.at < at) {
      if (state.event) wrapUp(state.event);
      state.event = blankEvent(at);
      if (now >= at) state.event.phase = 'done';
      store.save();
    }
    return state.event;
  }

  function refund(event) {
    for (const id of event.entrants) if (!event.drafted.includes(id)) ledger.purse(id).earn(ARENA.fee);
    event.pot = 0;
  }

  function draft(event) {
    const taken = new Set(event.entrants);
    const count = new Map(roster().map((id) => [id, certify.certifiedCount(id, event.deck)]));
    const pool = shuffle(roster().filter((id) => !isHuman(id) && !taken.has(id))).sort((a, b) => count.get(b) - count.get(a));
    for (const id of pool) {
      if (event.entrants.length >= capacityOf(event)) break;
      event.entrants.push(id);
      event.drafted.push(id);
    }
  }

  function placesOf(event) {
    const final = event.rounds.at(-1)?.[0];
    if (!final?.winner) return [];
    const matches = event.rounds.flat();
    const { base, perWin, champion } = ARENA.reward;
    return event.entrants.map((id) => {
      const mine = matches.filter((match) => sideOf(match, id));
      const lost = mine.find((match) => match.winner && match.winner !== id);
      const rank = id === final.winner ? 1 : lost ? event.rounds.find((round) => round.includes(lost)).length + 1 : null;
      const fought = mine.some((match) => match.a && match.b && match.forfeit !== id);
      const wins = mine.filter((match) => match.winner === id).length;
      const weight = fought ? base + perWin * wins + (rank === 1 ? champion : 0) : 0;
      return { rank, id, weight };
    }).filter((place) => place.rank !== null);
  }

  function finish(event) {
    const places = placesOf(event);
    const total = places.reduce((sum, place) => sum + place.weight, 0);
    let paid = 0;
    event.places = places
      .map(({ rank, id, weight }) => {
        const money = total > 0 ? Math.floor((event.pot * weight) / total) : 0;
        if (money > 0) economy.reward(ledger.purse(id), money);
        paid += money;
        return { rank, id, money };
      })
      .sort((a, b) => a.rank - b.rank);
    if (event.pot - paid > 0) ledger.purse(ARENA_POOL).earn(event.pot - paid);
    const champion = event.places.find((place) => place.rank === 1);
    if (champion) state.champions = [{ at: event.at, id: champion.id }, ...state.champions].slice(0, ARENA.champions);
    event.phase = 'done';
    for (const listener of finished) listener(event);
  }

  function begin(event, at, present) {
    draft(event);
    if (event.entrants.length < 2) {
      refund(event);
      event.phase = 'done';
      for (const listener of finished) listener(event);
      return;
    }
    const pool = ledger.purse(ARENA_POOL);
    const prize = pool.money;
    if (prize > 0 && pool.spend(prize)) event.pot += prize;
    draw(event);
    event.phase = 'running';
    event.firstAt = at + ARENA.opening;
  }

  function advance(event, now, present) {
    if (event.phase === 'running' && event.round < 0) {
      const first = event.firstAt ?? event.at;
      if (now < first) return;
      startRound(event, first, present);
    }
    while (event.phase === 'running') {
      const round = event.rounds[event.round];
      for (const match of round) if (match.live && now >= match.startAt + LIVE_MINUTES) forfeit(match, [match.a, match.b].find(isHuman), Number.isFinite(now) ? now : match.startAt + LIVE_MINUTES);
      startWaiting(event, now, present);
      const next = nextAt(event);
      if (next === null || now < next) return;
      if (round.length === 1) finish(event);
      else startRound(event, Number.isFinite(now) ? Math.max(next, now) : next, present);
    }
  }

  function wrapUp(event) {
    const absent = () => false;
    if (event.phase === 'open') begin(event, event.at, absent);
    advance(event, Infinity, absent);
  }

  function liveMatch(id) {
    const event = state.event;
    if (event?.phase !== 'running') return null;
    return event.rounds[event.round]?.find((match) => match.live && sideOf(match, id)) ?? null;
  }

  function prizeShare(event, id) {
    const strength = new Map(roster().map((who) => [who, certify.certifiedCount(who, event.deck) + 1]));
    const power = (who) => strength.get(who) ?? certify.certifiedCount(who, event.deck) + 1;
    const rivals = event.entrants.filter((who) => who !== id);
    const taken = new Set([id, ...rivals]);
    const hopefuls = roster().filter((who) => !taken.has(who)).sort((a, b) => power(b) - power(a));
    const field = [...rivals, ...hopefuls].slice(0, capacityOf(event) - 1);
    return power(id) / field.reduce((sum, who) => sum + power(who), power(id));
  }

  function blocked(id) {
    const event = state.event;
    if (event?.phase !== 'open') return 'closed';
    if (event.entrants.includes(id)) return 'joined';
    if (event.entrants.length >= capacityOf(event)) return 'full';
    if (ledger.purse(id).money < ARENA.fee) return 'money';
    return null;
  }

  return {
    tick(now, { present = () => false } = {}) {
      const event = eventOf(slotOf(now), now);
      if (!event) return;
      const before = signature(event);
      const here = (id) => present(id) && !event.away?.includes(id);
      if (event.phase === 'open' && now >= event.at) begin(event, event.at, here);
      if (event.phase === 'running') advance(event, now, here);
      if (signature(event) !== before) store.save();
    },
    version: DATA_VERSION,
    purged,
    onFinish(listener) {
      finished.push(listener);
    },
    get event() {
      return state.event;
    },
    get champions() {
      return state.champions;
    },
    get prize() {
      const event = state.event;
      if (event?.phase === 'running') return event.pot;
      return ledger.purse(ARENA_POOL).money + (event?.phase === 'open' ? event.pot : 0);
    },
    blocked,
    register(id) {
      if (blocked(id) || !ledger.purse(id).spend(ARENA.fee)) return false;
      const event = state.event;
      event.entrants.push(id);
      event.pot += ARENA.fee;
      store.save();
      return true;
    },
    consider(id, now) {
      const event = state.event;
      if (isHuman(id) || event?.phase !== 'open' || blocked(id) || !roster().includes(id)) return false;
      const { npc } = ARENA;
      if (now < (thought.get(id) ?? -Infinity) + npc.rethink) return false;
      thought.set(id, now);
      if (ledger.purse(id).money < ARENA.fee + npc.reserve) return false;
      const prize = ledger.purse(ARENA_POOL).money + event.pot;
      return prize * prizeShare(event, id) > ARENA.fee && Math.random() < npc.eager;
    },
    liveMatch,
    clash(id, now, span) {
      const event = state.event;
      if (!event?.entrants.includes(id)) return null;
      if (event.phase === 'open') return now + span > event.at ? 'soon' : null;
      if (event.phase === 'running' && !exitOf(event, id) && !event.away?.includes(id)) return 'running';
      return null;
    },
    mayEnter(id) {
      const event = state.event;
      return event?.phase === 'running' && event.entrants.includes(id);
    },
    away(id) {
      return !!state.event?.away?.includes(id);
    },
    leave(id, now) {
      const event = state.event;
      if (event?.phase !== 'running' || !event.entrants.includes(id)) return;
      event.away ??= [];
      if (!event.away.includes(id)) event.away.push(id);
      const match = liveMatch(id);
      if (match) forfeit(match, id, now);
      store.save();
    },
    back(id) {
      const event = state.event;
      if (!event?.away?.includes(id)) return;
      event.away = event.away.filter((other) => other !== id);
      store.save();
    },
    question(id, now) {
      const match = liveMatch(id);
      if (!match) return null;
      const side = sideOf(match, id);
      const rival = other(side);
      if (!match.pending) {
        const tier = tierOf(match);
        match.pending = pickKey(match, state.event.deck, tier);
        if (!match.pending) {
          decide(match, 'empty');
          match.endAt = now;
          store.save();
          return null;
        }
        match.tier = tier;
        match.rival = absorption.respond(match[rival], match.pending, limitOf(tier));
        store.save();
      }
      match.tier ??= tierOf(match);
      const limit = limitOf(match.tier);
      match.rival ??= absorption.respond(match[rival], match.pending, limit);
      return {
        key: match.pending,
        seconds: limit,
        tier: match.tier,
        hp: { ...match.hp },
        side,
        opponent: match[rival],
        turn: setTurns(match) + 1,
        set: match.set ?? 1,
        sets: { ...(match.sets ?? { a: 0, b: 0 }) },
        need: match.need ?? 1,
        rival: { ...match.rival },
      };
    },
    play(id, answer, now) {
      const match = liveMatch(id);
      if (!match?.pending) return null;
      const side = sideOf(match, id);
      const rival = other(side);
      const key = match.pending;
      const tier = match.tier ?? tierOf(match);
      const turn = resolveTurn(match, key, { [side]: answer, [rival]: match.rival ?? absorption.respond(match[rival], key, limitOf(tier)) }, tier);
      if (match.winner) match.endAt = now;
      store.save();
      return turn;
    },
  };
}
