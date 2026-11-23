import { LOTO } from './config.js';
import { DAY_MINUTES, minuteOfDay } from './clock.js';
import { hashText, makeRandom, shuffle } from './random.js';
import { DECKS, unitOf } from './studyDecks.js';

export const LOTO_CELLS = LOTO.size * LOTO.size;
export const OPEN = '.';
export const HIT = 'o';
export const LOCKED = 'x';
export const MISSED = '-';
export const callMinutes = LOTO.callSeconds / 60;

export const LOTO_CLUE_LABELS = { meaning: 'Nghĩa', reading: 'Cách đọc' };
const CLUE_KINDS = Object.keys(LOTO_CLUE_LABELS);
const CACHE_DAYS = 3;
const CARD_CACHE = 400;

const BY_CHAR = (() => {
  const map = new Map();
  const words = new Set();
  for (const card of DECKS[LOTO.deck].cards) {
    if (words.has(card.word)) continue;
    words.add(card.word);
    const list = map.get(card.kanji.char);
    if (list) list.push(card);
    else map.set(card.kanji.char, [card]);
  }
  return map;
})();

const neighborsOf = (char) => (BY_CHAR.get(char)?.[0]?.kanji.like ?? []).filter((other) => BY_CHAR.has(other));

const clueText = (card, kind) => String(card[kind] ?? '').trim();
const clueId = (text) => text.toLowerCase();

const LINES = (() => {
  const n = LOTO.size;
  const range = Array.from({ length: n }, (_, i) => i);
  return [
    ...range.map((r) => range.map((c) => r * n + c)),
    ...range.map((c) => range.map((r) => r * n + c)),
    range.map((i) => i * n + i),
    range.map((i) => i * n + (n - 1 - i)),
  ];
})();

const pools = new Map();
const cards = new Map();
const clusterMaps = new WeakMap();

function pickClusters(rand) {
  const used = new Set();
  const picked = [];
  for (const seed of shuffle([...BY_CHAR.keys()], rand)) {
    if (used.has(seed)) continue;
    const chars = [seed, ...neighborsOf(seed).filter((char) => !used.has(char))];
    if (chars.length < 2) continue;
    const words = chars.flatMap((char) => shuffle([...BY_CHAR.get(char)], rand).slice(0, LOTO.wordsPerKanji).map((card) => ({ card, char, cluster: seed })));
    if (picked.length + words.length > LOTO.pool) continue;
    for (const char of chars) used.add(char);
    picked.push(...words);
  }
  return picked;
}

function buildPool(day) {
  const rand = makeRandom(hashText(`loto:${day}`));
  const entries = pickClusters(rand);
  const counts = Object.fromEntries(CLUE_KINDS.map((kind) => [kind, new Map()]));
  for (const { card } of entries) {
    for (const kind of CLUE_KINDS) {
      const id = clueId(clueText(card, kind));
      if (id) counts[kind].set(id, (counts[kind].get(id) ?? 0) + 1);
    }
  }
  const calls = [];
  for (const { card, char, cluster } of entries) {
    const kinds = CLUE_KINDS.filter((kind) => clueText(card, kind) && counts[kind].get(clueId(clueText(card, kind))) === 1);
    if (!kinds.length) continue;
    const kind = kinds[Math.floor(rand() * kinds.length)];
    calls.push({ key: card.key, char, cluster, kind, text: clueText(card, kind) });
  }
  return shuffle(calls, rand);
}

function prune(day) {
  for (const cached of pools.keys()) if (cached < day - CACHE_DAYS) pools.delete(cached);
  if (cards.size > CARD_CACHE) cards.clear();
}

export function validCall(raw) {
  return !!raw && typeof raw.key === 'string' && !!unitOf(raw.key) && typeof raw.char === 'string' && typeof raw.cluster === 'string' && CLUE_KINDS.includes(raw.kind) && typeof raw.text === 'string' && raw.text.length > 0;
}

export function adoptPool(day, pool) {
  pools.set(day, pool.map(({ key, char, cluster, kind, text }) => ({ key, char, cluster, kind, text })));
  prune(day);
}

const sequences = new WeakMap();

export function lotoCalls(day) {
  const pool = lotoPool(day);
  let calls = sequences.get(pool);
  if (!calls) {
    calls = [];
    for (let round = 0; round < LOTO.rounds; round++) calls.push(...(round === 0 ? pool : shuffle([...pool], makeRandom(hashText(`loto:${day}:round:${round}`)))));
    sequences.set(pool, calls);
  }
  return calls;
}

export const roundOf = (day, index) => {
  const size = lotoPool(day).length || 1;
  return { round: Math.floor(index / size) + 1, turn: (index % size) + 1, size };
};

export function lotoPool(day) {
  if (!pools.has(day)) {
    pools.set(day, buildPool(day));
    prune(day);
  }
  return pools.get(day);
}

function interleave(lists) {
  const out = [];
  for (let i = 0; lists.some((list) => i < list.length); i++) for (const list of lists) if (i < list.length) out.push(list[i]);
  return out;
}

const CARD_JITTER = 0.2;

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

function rank(items, rand, scoreOf) {
  return items
    .map((item) => ({ item, score: scoreOf(item) + rand() * CARD_JITTER }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

export function lotoCard(day, id, known = null) {
  const pool = lotoPool(day);
  const cacheKey = `${day}:${id}`;
  const cached = known ? null : cards.get(cacheKey);
  if (cached?.pool === pool) return cached.keys;
  const rand = makeRandom(hashText(`loto:${day}:${id}`));
  const clusters = new Map();
  for (const call of pool) {
    const chars = clusters.get(call.cluster) ?? new Map();
    clusters.set(call.cluster, chars);
    const list = chars.get(call.char);
    if (list) list.push(call.key);
    else chars.set(call.char, [call.key]);
  }
  const knownOf = (list) => mean(list.map(known));
  const groups = [...clusters.values()].map((chars) => [...chars.values()]);
  const ordered = known ? rank(groups, rand, (lists) => knownOf(lists.flat())) : shuffle(groups, rand);
  const keys = [];
  for (const lists of ordered) {
    const room = LOTO_CELLS - keys.length;
    if (room < 2) break;
    const sorted = known ? rank(lists.map((list) => rank(list, rand, known)), rand, knownOf) : shuffle(lists.map((list) => shuffle([...list], rand)), rand);
    keys.push(...interleave(sorted).slice(0, room));
  }
  const card = shuffle(keys, rand);
  if (!known) cards.set(cacheKey, { pool, keys: card });
  return card;
}

export const validCard = (card, day) => Array.isArray(card) && card.length > 0 && card.length <= LOTO_CELLS && card.every((key) => lotoPool(day).some((call) => call.key === key));

function clusterOf(pool) {
  let map = clusterMaps.get(pool);
  if (!map) {
    map = new Map(pool.map((entry) => [entry.key, entry.cluster]));
    clusterMaps.set(pool, map);
  }
  return map;
}

export const blankMarks = () => OPEN.repeat(LOTO_CELLS);

const setMark = (marks, cell, mark) => marks.slice(0, cell) + mark + marks.slice(cell + 1);

export function applyTap(card, marks, called, cell) {
  if (!(cell >= 0 && cell < card.length) || marks[cell] !== OPEN) return { marks, result: null };
  if (called.has(card[cell])) return { marks: setMark(marks, cell, HIT), result: 'hit' };
  return { marks: setMark(marks, cell, LOCKED), result: 'wrong' };
}

export function npcCall(card, marks, call, pool, respond, rand = Math.random) {
  const cell = card.indexOf(call.key);
  if (cell < 0 || marks[cell] !== OPEN) return marks;
  const called = new Set([call.key]);
  if (respond(call.key)) return applyTap(card, marks, called, cell).marks;
  const cluster = clusterOf(pool);
  const lookalikes = card.map((key, i) => i).filter((i) => i !== cell && marks[i] === OPEN && cluster.get(card[i]) === call.cluster);
  let next = marks;
  if (lookalikes.length && rand() < LOTO.slip) next = applyTap(card, marks, called, lookalikes[Math.floor(rand() * lookalikes.length)]).marks;
  return next;
}

export const hasBingo = (marks) => LINES.some((line) => line.every((cell) => marks[cell] === HIT));

export function nearBingo(marks) {
  if (hasBingo(marks)) return false;
  return LINES.some((line) => line.filter((cell) => marks[cell] === HIT).length === LOTO.size - 1 && line.some((cell) => marks[cell] === OPEN));
}

export const lotoStart = (day) => day * DAY_MINUTES + LOTO.start;
export const lotoGatherAt = (day) => lotoStart(day) - LOTO.gather;
export const lotoEnd = (day) => lotoStart(day) + lotoCalls(day).length * callMinutes;
export const lotoMinutes = (day) => lotoCalls(day).length * callMinutes;

export function lotoSignOpen(now) {
  const m = minuteOfDay(now);
  return m >= LOTO.signOpen && m < LOTO.start;
}

export function closedCalls(day, now) {
  const done = Math.floor((now - lotoStart(day)) / callMinutes);
  return Math.max(0, Math.min(lotoCalls(day).length, done));
}

const lineChance = (odds) => 1 - (1 - Math.max(0, odds) ** LOTO.size) ** LINES.length;

export function lotoPrizeShare(mine, rivals, shares = LOTO.prizes) {
  const chances = [lineChance(mine), ...rivals.map(lineChance)];
  const total = chances.reduce((sum, chance) => sum + chance, 0);
  if (!(total > 0)) return 0;
  const top = shares.length;
  let finishers = [1, ...new Array(top).fill(0)];
  for (const chance of chances) {
    const next = new Array(top + 1).fill(0);
    finishers.forEach((p, k) => {
      next[k] += p * (1 - chance);
      next[Math.min(top, k + 1)] += p * chance;
    });
    finishers = next;
  }
  const atLeast = (k) => finishers.slice(k).reduce((sum, p) => sum + p, 0);
  return (chances[0] / total) * shares.reduce((sum, share, k) => sum + share * atLeast(k + 1), 0);
}
