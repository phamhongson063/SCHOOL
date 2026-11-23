import { FIREWORKS } from './config.js';
import { dayOf } from './clock.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';
import { certify } from './certify.js';
import { unitOf } from './studyDecks.js';
import {
  ERASE,
  SHOW_SECONDS,
  fireworksEnd,
  fireworksOdds,
  fireworksSignOpen,
  fireworksStart,
  fireworksWorth,
  glyphsOf,
  knownKeys,
  npcRun,
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
const freshPlay = () => ({ index: 0, filled: [], since: null, wrong: false, missed: false, score: 0, words: 0, lastAt: null });
const blankShow = (day) => ({ day, phase: 'open', entrants: [], keys: [], runs: {}, play: {}, pot: 0, places: [] });

function cleanPlay(raw) {
  const play = freshPlay();
  if (!raw || typeof raw !== 'object') return play;
  for (const name of ['index', 'score', 'words']) if (Number.isInteger(raw[name]) && raw[name] >= 0) play[name] = raw[name];
  for (const name of ['since', 'lastAt']) if (Number.isFinite(raw[name])) play[name] = raw[name];
  play.filled = ids(raw.filled);
  play.wrong = raw.wrong === true;
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
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.day) || !PHASES.includes(raw.phase)) return null;
  const keys = ids(raw.keys).filter((key) => unitOf(key));
  if (raw.phase === 'live' && !keys.length) return null;
  const entrants = ids(raw.entrants);
  const runs = {};
  for (const id of entrants) {
    const run = raw.runs?.[id];
    if (Array.isArray(run)) runs[id] = run.filter((entry) => Array.isArray(entry) && Number.isFinite(entry[0]) && Number.isInteger(entry[1]));
  }
  const play = {};
  for (const [id, value] of Object.entries(raw.play ?? {})) if (entrants.includes(id)) play[id] = cleanPlay(value);
  return { day: raw.day, phase: raw.phase, entrants, keys, runs, play, pot: Number.isFinite(raw.pot) ? raw.pot : 0, places: cleanPlaces(raw.places) };
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
  const keyAt = (show, index) => show.keys[index % show.keys.length];

  function tallyOf(show, id, seconds) {
    if (show.phase === 'open') return { score: 0, words: 0, lastAt: null };
    const play = show.play[id];
    if (play) return { score: play.score, words: play.words, lastAt: play.lastAt };
    return runTally(show.runs[id] ?? [], show.keys, seconds);
  }

  function begin(show) {
    if (!show.entrants.length) {
      show.phase = 'done';
      return;
    }
    show.keys = showKeys(show.day, show.entrants);
    show.pot = sponsor(fireworksStart(show.day));
    for (const id of show.entrants) {
      if (human(id)) show.play[id] = freshPlay();
      else show.runs[id] = npcRun(id, show.keys, show.day);
    }
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
    play.wrong = false;
    play.missed = false;
  }

  function current(who, now) {
    const show = liveShow(who, now);
    if (!show) return null;
    const play = show.play[who];
    const seconds = secondsOf(show, now);
    if (play.since === null) play.since = seconds;
    let key = keyAt(show, play.index);
    if (seconds - play.since > wordLimit(key)) {
      certify.markWeak(who, key, false);
      nextWord(play, seconds);
      key = keyAt(show, play.index);
      store.save();
    }
    const limit = wordLimit(key);
    return {
      key,
      index: play.index,
      answer: glyphsOf(key),
      filled: [...play.filled],
      wrong: play.wrong,
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
      state.show.entrants.push(who);
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
      const keys = knownKeys([id, ...rivals]);
      if (!keys.length) return -FIREWORKS.fee * need;
      const mine = oddsOf(id, keys, now);
      return fireworksWorth({ mine, rivals: rivals.map((other) => oddsOf(other, keys, now).score), pot: prize(now), need, diligence });
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
      if (char === ERASE) {
        if (!play.filled.length) return 'idle';
        play.filled.pop();
        play.wrong = false;
        store.save();
        return 'erase';
      }
      if (play.wrong) return 'blocked';
      play.filled.push(char);
      if (char !== word.answer[play.filled.length - 1]) {
        play.wrong = true;
        play.missed = true;
        store.save();
        return 'wrong';
      }
      if (play.filled.length < word.answer.length) {
        store.save();
        return 'hit';
      }
      const seconds = secondsOf(show, now);
      certify.markWeak(who, word.key, !play.missed);
      play.score += wordPoints(word.key);
      play.words += 1;
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
        for (const [at, index] of run) if (at > a && at <= b) out.push({ id, key: keyAt(show, index) });
      }
      return out;
    },
    result(now) {
      const show = showOn(dayOf(now));
      return show?.phase === 'done' ? show.places.map((place) => ({ ...place })) : null;
    },
    lastResult: () => (state.last ? { ...state.last, places: state.last.places.map((place) => ({ ...place })), entrants: [...state.last.entrants] } : null),
    titlesOf: (id) => state.titles[id] ?? 0,
    get champions() {
      return state.champions;
    },
    onFinish(listener) {
      finished.push(listener);
    },
  };
}
