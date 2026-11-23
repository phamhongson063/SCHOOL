import { FIREWORKS } from './config.js';
import { dayOf } from './clock.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';
import { certify } from './certify.js';
import { unitOf } from './studyDecks.js';
import {
  SHOW_SECONDS,
  fireworksEnd,
  fireworksLeft,
  fireworksOdds,
  fireworksPace,
  fireworksSignOpen,
  fireworksStart,
  fireworksWorth,
  glyphsOf,
  knownKeys,
  npcWord,
  placeOrder,
  runTally,
  showKeys,
  skyTiles,
  wordLimit,
  wordPoints,
} from './fireworksRules.js';

const KEY = worldKey('fireworks');
const PHASES = ['open', 'live', 'done'];
const ODDS_MINUTES = 10;

const ids = (list) => (Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []);
const freshPlay = () => ({ index: 0, filled: [], since: null, missed: false, score: 0, words: 0, lastAt: null, glyphs: 0, spent: 0 });
const blankShow = (day) => ({ day, start: FIREWORKS.start, phase: 'open', entrants: [], joinedAt: {}, keys: {}, runs: {}, cursor: {}, play: {}, pot: 0, places: [] });
const isCursor = (raw) => raw && Number.isInteger(raw.index) && raw.index >= 0 && Number.isFinite(raw.end) && (raw.ok === 0 || raw.ok === 1);

function cleanPlay(raw) {
  const play = freshPlay();
  if (!raw || typeof raw !== 'object') return play;
  for (const name of ['index', 'score', 'words', 'glyphs']) if (Number.isInteger(raw[name]) && raw[name] >= 0) play[name] = raw[name];
  for (const name of ['since', 'lastAt', 'spent']) if (Number.isFinite(raw[name])) play[name] = raw[name];
  play.filled = ids(raw.filled);
  play.missed = raw.missed === true;
  return play;
}

function cleanPlaces(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((place) => typeof place?.id === 'string')
    .map((place) => ({ id: place.id, score: Number.isFinite(place.score) ? place.score : 0, words: Number.isFinite(place.words) ? place.words : 0, prize: Number.isFinite(place.prize) ? place.prize : 0 }));
}

function cleanShow(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.day) || !PHASES.includes(raw.phase) || raw.start !== FIREWORKS.start) return null;
  const entrants = ids(raw.entrants);
  const shared = Array.isArray(raw.keys) ? ids(raw.keys).filter((key) => unitOf(key)) : null;
  const keys = {};
  for (const id of entrants) {
    const list = shared ?? ids(raw.keys?.[id]).filter((key) => unitOf(key));
    if (list.length) keys[id] = list;
  }
  if (raw.phase === 'live' && entrants.some((id) => !keys[id])) return null;
  const runs = {};
  for (const id of entrants) {
    const run = raw.runs?.[id];
    if (Array.isArray(run)) runs[id] = run.filter((entry) => Array.isArray(entry) && Number.isFinite(entry[0]) && Number.isInteger(entry[1]));
  }
  const play = {};
  for (const [id, value] of Object.entries(raw.play ?? {})) if (entrants.includes(id)) play[id] = cleanPlay(value);
  const joinedAt = Object.fromEntries(entrants.filter((id) => Number.isFinite(raw.joinedAt?.[id])).map((id) => [id, raw.joinedAt[id]]));
  const cursor = Object.fromEntries(entrants.filter((id) => isCursor(raw.cursor?.[id])).map((id) => [id, { ...raw.cursor[id] }]));
  return { day: raw.day, start: FIREWORKS.start, phase: raw.phase, entrants, joinedAt, keys, runs, cursor, play, pot: Number.isFinite(raw.pot) ? raw.pot : 0, places: cleanPlaces(raw.places) };
}

function cleanLast(raw) {
  if (!raw || !Number.isInteger(raw.day)) return null;
  return { day: raw.day, places: cleanPlaces(raw.places), entrants: ids(raw.entrants) };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      const titles = saved.titles && typeof saved.titles === 'object' ? Object.fromEntries(Object.entries(saved.titles).filter(([, count]) => Number.isInteger(count) && count > 0)) : {};
      const champions = Array.isArray(saved.champions) ? saved.champions.filter((item) => Number.isInteger(item?.day) && typeof item?.id === 'string').slice(0, FIREWORKS.champions) : [];
      return { show: cleanShow(saved.show), titles, champions, last: cleanLast(saved.last) };
    }
  } catch {}
  return { show: null, titles: {}, champions: [], last: null };
}

export function createFireworks({ charge, sponsor, pay, refund, award, prize, human }) {
  const state = load();
  const store = createStore(KEY, () => state);
  const finished = [];
  const oddsCache = new Map();

  const showOn = (day) => (state.show?.day === day ? state.show : null);
  const secondsOf = (show, now) => Math.max(0, Math.min(SHOW_SECONDS, (now - fireworksStart(show.day)) * 60));
  const keyAt = (show, id, index) => show.keys[id][index % show.keys[id].length];

  function tallyOf(show, id, seconds) {
    if (show.phase === 'open') return { score: 0, words: 0, lastAt: null };
    const play = show.play[id];
    if (play) return { score: play.score, words: play.words, lastAt: play.lastAt };
    return runTally(show.runs[id] ?? [], show.keys[id] ?? [], seconds);
  }

  function startWord(show, id, index, from) {
    const word = npcWord(id, keyAt(show, id, index), show.day);
    show.cursor[id] = { index, end: from + word.seconds, ok: word.correct ? 1 : 0 };
  }

  function enter(show, id, from) {
    show.keys[id] = showKeys(show.day, id);
    if (human(id)) {
      show.play[id] = freshPlay();
      return;
    }
    show.runs[id] = [];
    startWord(show, id, 0, from);
  }

  function stepNpcs(show, seconds) {
    let changed = false;
    for (const [id, cursor] of Object.entries(show.cursor)) {
      let at = cursor;
      while (at && at.end <= seconds && at.end <= SHOW_SECONDS) {
        show.runs[id] ??= [];
        show.runs[id].push([Math.round(at.end * 10) / 10, at.index, at.ok]);
        startWord(show, id, at.index + 1, at.end);
        at = show.cursor[id];
        changed = true;
      }
    }
    return changed;
  }

  function begin(show) {
    if (!show.entrants.length) {
      show.phase = 'done';
      return;
    }
    show.pot = sponsor(fireworksStart(show.day));
    for (const id of show.entrants) enter(show, id, show.joinedAt[id] ?? 0);
    show.phase = 'live';
  }

  function finish(show) {
    const rows = placeOrder(show.entrants.map((id) => ({ id, ...tallyOf(show, id, SHOW_SECONDS) })));
    let paid = 0;
    show.places = rows.map((row, rank) => {
      const share = row.score > 0 ? FIREWORKS.prizes[rank] ?? 0 : 0;
      const money = Math.floor(show.pot * share);
      if (money > 0) pay(row.id, money);
      paid += money;
      const intellect = row.words * FIREWORKS.intellect;
      if (intellect > 0) award(row.id, intellect);
      return { id: row.id, score: row.score, words: row.words, prize: money };
    });
    refund(show.pot - paid);
    const champion = show.places[0];
    if (champion && champion.score > 0) {
      state.titles[champion.id] = (state.titles[champion.id] ?? 0) + 1;
      state.champions = [{ day: show.day, id: champion.id }, ...state.champions].slice(0, FIREWORKS.champions);
    }
    show.phase = 'done';
    state.last = { day: show.day, places: show.places.map((place) => ({ ...place })), entrants: [...show.entrants] };
    for (const listener of finished) listener(state.last);
  }

  function advance(now) {
    const show = state.show;
    if (!show) return false;
    let changed = false;
    if (show.phase === 'open' && now >= fireworksStart(show.day)) {
      begin(show);
      changed = true;
    }
    if (show.phase === 'live' && stepNpcs(show, secondsOf(show, now))) changed = true;
    if (show.phase === 'live' && now >= fireworksEnd(show.day)) {
      finish(show);
      changed = true;
    }
    return changed;
  }

  function liveShow(who, now) {
    const show = showOn(dayOf(now));
    if (show?.phase !== 'live' || now >= fireworksEnd(show.day) || !show.play[who]) return null;
    return show;
  }

  function nextWord(play, seconds) {
    play.index += 1;
    play.filled = [];
    play.since = seconds;
    play.missed = false;
  }

  function current(who, now) {
    const show = liveShow(who, now);
    if (!show) return null;
    const play = show.play[who];
    const seconds = secondsOf(show, now);
    if (play.since === null) play.since = seconds;
    let key = keyAt(show, who, play.index);
    if (seconds - play.since > wordLimit(key)) {
      certify.markWeak(who, key, false);
      nextWord(play, seconds);
      key = keyAt(show, who, play.index);
      store.save();
    }
    const limit = wordLimit(key);
    return {
      key,
      index: play.index,
      answer: glyphsOf(key),
      filled: [...play.filled],
      left: Math.max(0, limit - (seconds - play.since)),
      limit,
      score: play.score,
      words: play.words,
      tiles: skyTiles(key, `${show.day}:${play.index}`),
    };
  }

  function oddsOf(id, keys, now) {
    const stamp = Math.floor(now / ODDS_MINUTES);
    const cached = oddsCache.get(id);
    if (cached?.stamp === stamp && cached.size === keys.length) return cached.odds;
    const odds = fireworksOdds(id, keys);
    oddsCache.set(id, { stamp, size: keys.length, odds });
    return odds;
  }

  return {
    tick(now) {
      if (advance(now)) store.save();
    },
    register(who, now) {
      advance(now);
      const day = dayOf(now);
      if (!fireworksSignOpen(now)) return 'closed';
      if (showOn(day)?.entrants.includes(who)) return 'already';
      if (!charge(who, FIREWORKS.fee)) return 'poor';
      if (!showOn(day)) state.show = blankShow(day);
      const show = state.show;
      show.entrants.push(who);
      show.joinedAt[who] = secondsOf(show, now);
      if (show.phase === 'live') enter(show, who, secondsOf(show, now));
      else advance(now);
      oddsCache.clear();
      store.save();
      return 'ok';
    },
    joined: (who, now) => !!showOn(dayOf(now))?.entrants.includes(who),
    entrants: (now) => [...(showOn(dayOf(now))?.entrants ?? [])],
    pot(now) {
      const show = showOn(dayOf(now));
      return show && show.phase !== 'open' ? show.pot : prize(now);
    },
    worth(id, now, need, diligence) {
      const rivals = (showOn(dayOf(now))?.entrants ?? []).filter((other) => other !== id);
      const keys = knownKeys(id);
      if (!keys.length) return -FIREWORKS.fee * need;
      const full = oddsOf(id, keys, now);
      const left = fireworksLeft(now) / FIREWORKS.minutes;
      const mine = { score: full.score * left, words: full.words * left };
      return fireworksWorth({ mine, rivals: rivals.map((other) => oddsOf(other, knownKeys(other), now).score), pot: prize(now), need, diligence });
    },
    live(now) {
      const show = showOn(dayOf(now));
      return show?.phase === 'live' && now < fireworksEnd(show.day);
    },
    playing: (who, now) => !!liveShow(who, now),
    standings(now) {
      const show = showOn(dayOf(now));
      if (!show) return [];
      if (show.phase === 'done') return show.places.map(({ id, score }) => ({ id, score }));
      const seconds = secondsOf(show, now);
      return placeOrder(show.entrants.map((id) => ({ id, ...tallyOf(show, id, seconds) }))).map(({ id, score }) => ({ id, score }));
    },
    current,
    shoot(who, char, now) {
      const word = current(who, now);
      if (!word) return null;
      const show = liveShow(who, now);
      const play = show.play[who];
      if (char !== word.answer[play.filled.length]) {
        play.missed = true;
        store.save();
        return 'wrong';
      }
      play.filled.push(char);
      if (play.filled.length < word.answer.length) {
        store.save();
        return 'hit';
      }
      const seconds = secondsOf(show, now);
      certify.markWeak(who, word.key, !play.missed);
      play.score += wordPoints(word.key);
      play.words += 1;
      play.glyphs += word.answer.length;
      play.spent += seconds - play.since;
      play.lastAt = seconds;
      nextWord(play, seconds);
      store.save();
      return 'done';
    },
    burstsBetween(from, to, now) {
      const show = showOn(dayOf(now));
      if (show?.phase !== 'live') return [];
      const a = secondsOf(show, from);
      const b = secondsOf(show, to);
      const out = [];
      for (const [id, run] of Object.entries(show.runs)) {
        for (const [at, index, ok = 1] of run) if (ok && at > a && at <= b) out.push({ id, key: keyAt(show, id, index) });
      }
      return out;
    },
    result(now) {
      const show = showOn(dayOf(now));
      return show?.phase === 'done' ? show.places.map((place) => ({ ...place })) : null;
    },
    lastResult: () => (state.last ? { ...state.last, places: state.last.places.map((place) => ({ ...place })), entrants: [...state.last.entrants] } : null),
    pace(who) {
      const play = state.show?.play[who];
      return play ? fireworksPace(play) : null;
    },
    titlesOf: (id) => state.titles[id] ?? 0,
    get champions() {
      return state.champions;
    },
    onFinish(listener) {
      finished.push(listener);
    },
  };
}
