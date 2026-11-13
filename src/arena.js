import { ARENA } from './config.js';
import { certify } from './certify.js';
import { absorption } from './absorption.js';
import { economy } from './economy.js';
import { DECKS } from './studyDecks.js';
import { PLAYER } from './inventory.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';
import { DAY_MINUTES, dayOf } from './clock.js';

const KEY = worldKey('arena');
const PHASES = ['open', 'running', 'done'];
const SIDES = ['a', 'b'];
const LIVE_MINUTES = (ARENA.turns * (ARENA.read + ARENA.seconds)) / 60 + ARENA.grace;

const other = (side) => (side === 'a' ? 'b' : 'a');
const isHuman = (id) => id === PLAYER;
const sideOf = (match, id) => (match.a === id ? 'a' : match.b === id ? 'b' : null);
const signature = (event) => `${event.phase}:${event.round}:${event.rounds[event.round]?.filter((match) => match.winner).length ?? 0}`;
const loserOf = (match) => (match.winner === match.a ? match.b : match.a);

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const blankEvent = (at) => ({ at, phase: 'open', deck: ARENA.deck, entrants: [], drafted: [], considered: [], pot: 0, rounds: [], round: -1, places: [] });

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
    if (match && match.winner && match.winner !== id) return { round: round.length, forfeit: match.forfeit === id };
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
    isIdList(raw.considered) &&
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
    if (saved && typeof saved === 'object') {
      return {
        event: validEvent(saved.event) ? saved.event : null,
        champions: Array.isArray(saved.champions) ? saved.champions.filter((item) => Number.isFinite(item?.at) && typeof item?.id === 'string').slice(0, ARENA.champions) : [],
      };
    }
  } catch {}
  return { event: null, champions: [] };
}

export function damageOf({ correct, seconds }) {
  if (!correct) return 0;
  const left = Math.max(0, 1 - seconds / ARENA.seconds);
  return Math.round(ARENA.hit * (1 + ARENA.speed * left));
}

function cleanAnswer(raw) {
  const seconds = Number(raw?.seconds);
  return { correct: raw?.correct === true, seconds: Number.isFinite(seconds) ? Math.max(0, Math.min(ARENA.seconds, seconds)) : ARENA.seconds };
}

function newMatch(a, b) {
  return { a, b, winner: null, forfeit: null, live: false, startAt: null, hp: { a: ARENA.hp, b: ARENA.hp }, time: { a: 0, b: 0 }, asked: [], pending: null, turns: [] };
}

function pickKey(match, deck) {
  const pool = [...new Set([...certify.certified(match.a, deck), ...certify.certified(match.b, deck)])];
  if (!pool.length) return null;
  const asked = new Set(match.asked);
  const fresh = pool.filter((key) => !asked.has(key));
  const keys = fresh.length ? fresh : pool;
  return keys[Math.floor(Math.random() * keys.length)];
}

function decide(match) {
  const { hp, time } = match;
  let side;
  if (hp.a !== hp.b) side = hp.a > hp.b ? 'a' : 'b';
  else if (time.a !== time.b) side = time.a < time.b ? 'a' : 'b';
  else side = Math.random() < 0.5 ? 'a' : 'b';
  match.winner = match[side];
  match.live = false;
  match.pending = null;
}

function forfeit(match, id) {
  const side = sideOf(match, id);
  match.forfeit = id;
  match.winner = match[other(side)];
  match.live = false;
  match.pending = null;
}

function resolveTurn(match, key, answers) {
  const turn = { key };
  for (const side of SIDES) {
    const answer = cleanAnswer(answers[side]);
    turn[side] = { ...answer, damage: damageOf(answer) };
  }
  for (const side of SIDES) {
    match.hp[other(side)] = Math.max(0, match.hp[other(side)] - turn[side].damage);
    match.time[side] += turn[side].seconds;
  }
  match.asked.push(key);
  match.pending = null;
  match.turns.push(turn);
  turn.hp = { ...match.hp };
  if (match.hp.a <= 0 || match.hp.b <= 0 || match.turns.length >= ARENA.turns) decide(match);
  return turn;
}

function simulate(match, deck) {
  while (!match.winner) {
    const key = pickKey(match, deck);
    if (!key) {
      decide(match);
      break;
    }
    resolveTurn(match, key, { a: absorption.respond(match.a, key, ARENA.seconds), b: absorption.respond(match.b, key, ARENA.seconds) });
  }
}

function draw(event) {
  const entrants = shuffle([...event.entrants]);
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, entrants.length)));
  const pairs = size / 2;
  event.rounds = [Array.from({ length: pairs }, (_, i) => newMatch(entrants[i], entrants[pairs + i] ?? null))];
  event.round = -1;
}

function nextPairs(round) {
  return Array.from({ length: round.length / 2 }, (_, i) => newMatch(round[2 * i].winner, round[2 * i + 1].winner));
}

function startRound(event, at, present) {
  const index = event.round + 1;
  if (index > 0) event.rounds[index] = nextPairs(event.rounds[index - 1]);
  event.round = index;
  for (const match of event.rounds[index]) {
    match.startAt = at;
    if (!match.a || !match.b) {
      match.winner = match.a ?? match.b;
      continue;
    }
    const human = [match.a, match.b].find(isHuman);
    if (human) {
      if (present(human)) match.live = true;
      else forfeit(match, human);
      continue;
    }
    simulate(match, event.deck);
  }
}

export function createArena({ ledger, roster = () => [] }) {
  const state = load();
  const store = createStore(KEY, () => state);
  const finished = [];

  function eventOf(at) {
    if (at === null || (state.event && state.event.at > at)) return null;
    if (!state.event || state.event.at < at) {
      if (state.event) wrapUp(state.event);
      state.event = blankEvent(at);
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
    const pool = shuffle(roster().filter((id) => !isHuman(id) && !taken.has(id)));
    const ready = pool.filter((id) => certify.certifiedCount(id, event.deck) > 0);
    const rest = pool.filter((id) => !ready.includes(id));
    for (const id of [...ready, ...rest]) {
      if (event.entrants.length >= ARENA.size) break;
      event.entrants.push(id);
      event.drafted.push(id);
    }
  }

  function placesOf(event) {
    const final = event.rounds.at(-1)?.[0];
    if (!final?.winner) return [];
    const places = [
      { rank: 1, id: final.winner },
      { rank: 2, id: loserOf(final) },
    ];
    const semis = event.rounds.length >= 2 ? event.rounds.at(-2) : [];
    for (const match of semis) places.push({ rank: 3, id: loserOf(match) });
    return places.filter((place) => place.id);
  }

  function finish(event) {
    let paid = 0;
    event.places = placesOf(event).map(({ rank, id }) => {
      const prize = ARENA.places.find((place) => place.rank === rank);
      const money = Math.floor(event.pot * (prize?.share ?? 0));
      const intellect = prize?.intellect ?? 0;
      const purse = ledger.purse(id);
      if (money > 0) economy.reward(purse, money);
      if (intellect > 0) purse.addIntellect(intellect);
      paid += money;
      return { rank, id, money, intellect };
    });
    if (event.pot - paid > 0) economy.collect(event.pot - paid);
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
    draw(event);
    event.phase = 'running';
    startRound(event, at, present);
  }

  function advance(event, now, present) {
    while (event.phase === 'running') {
      const round = event.rounds[event.round];
      const at = round[0].startAt;
      for (const match of round) if (match.live && now >= match.startAt + LIVE_MINUTES) forfeit(match, [match.a, match.b].find(isHuman));
      if (round.some((match) => !match.winner)) return;
      const next = at + ARENA.roundMinutes;
      if (now < next) return;
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
    return event.rounds[event.round].find((match) => match.live && sideOf(match, id)) ?? null;
  }

  function blocked(id) {
    const event = state.event;
    if (event?.phase !== 'open') return 'closed';
    if (event.entrants.includes(id)) return 'joined';
    if (event.entrants.length >= ARENA.size) return 'full';
    if (ledger.purse(id).money < ARENA.fee) return 'money';
    return null;
  }

  return {
    tick(now, { present = () => false } = {}) {
      const event = eventOf(slotOf(now));
      if (!event) return;
      const before = signature(event);
      if (event.phase === 'open' && now >= event.at) begin(event, event.at, present);
      if (event.phase === 'running') advance(event, now, present);
      if (signature(event) !== before) store.save();
    },
    onFinish(listener) {
      finished.push(listener);
    },
    get event() {
      return state.event;
    },
    get champions() {
      return state.champions;
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
    consider(id) {
      const event = state.event;
      if (isHuman(id) || event?.phase !== 'open' || event.considered.includes(id) || !roster().includes(id)) return false;
      event.considered.push(id);
      store.save();
      const { npc } = ARENA;
      if (blocked(id) || certify.certifiedCount(id, event.deck) < npc.minCertified) return false;
      return ledger.purse(id).money >= ARENA.fee + npc.reserve && Math.random() < npc.eager;
    },
    liveMatch,
    question(id) {
      const match = liveMatch(id);
      if (!match) return null;
      if (!match.pending) {
        match.pending = pickKey(match, state.event.deck);
        if (!match.pending) {
          decide(match);
          store.save();
          return null;
        }
        store.save();
      }
      const side = sideOf(match, id);
      return { key: match.pending, seconds: ARENA.seconds, hp: { ...match.hp }, side, opponent: match[other(side)], turn: match.turns.length + 1 };
    },
    play(id, answer) {
      const match = liveMatch(id);
      if (!match?.pending) return null;
      const side = sideOf(match, id);
      const rival = other(side);
      const key = match.pending;
      const turn = resolveTurn(match, key, { [side]: answer, [rival]: absorption.respond(match[rival], key, ARENA.seconds) });
      store.save();
      return turn;
    },
  };
}
