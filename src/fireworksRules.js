import { FIREWORKS, LANTERN, MIND } from './config.js';
import { DAY_MINUTES, minuteOfDay } from './clock.js';
import { hashText, makeRandom, shuffle } from './random.js';
import { DECKS, DECK_IDS, unitOf } from './studyDecks.js';
import { absorption } from './absorption.js';
import { fluency } from './fluency.js';
import { certify } from './certify.js';

export const SHOW_SECONDS = FIREWORKS.minutes * 60;

const IS_KANJI = /[㐀-鿿々〆]/;
const IS_HIRAGANA = /[ぁ-ゖ]/;
const KATAKANA_TWINS = { 力: 'カ', 口: 'ロ', 工: 'エ', 夕: 'タ', 八: 'ハ', 二: 'ニ', 卜: 'ト', 千: 'チ', 才: 'オ', 三: 'ミ', 匕: 'ヒ', 乂: 'メ', 又: 'ヌ' };
const HIRAGANA_TWINS = {
  る: 'ろ', ろ: 'る', め: 'ぬ', ぬ: 'め', わ: 'ね', ね: 'れ', れ: 'わ', さ: 'ち', ち: 'さ', き: 'さ', は: 'ほ', ほ: 'ま', ま: 'ほ', い: 'こ', こ: 'い', り: 'い',
  く: 'へ', へ: 'く', あ: 'お', お: 'あ', す: 'む', む: 'す', た: 'な', な: 'た', う: 'つ', つ: 'う', し: 'も', も: 'し', け: 'は', ら: 'う', か: 'が', が: 'か',
  げ: 'け', じ: 'し', ず: 'す', ぶ: 'ふ', ふ: 'ぶ', ば: 'ぱ', び: 'ぴ', よ: 'ま', え: 'ん', ん: 'え', そ: 'て', て: 'そ', と: 'ど', ど: 'と',
};
const HIRAGANA_POOL = ['あ', 'お', 'ぬ', 'め', 'ね', 'れ', 'わ', 'る', 'ろ', 'さ', 'ち', 'き', 'は', 'ほ', 'ま', 'た', 'な', 'こ', 'い', 'り'];
const KATAKANA_POOL = ['ソ', 'ン', 'シ', 'ツ', 'ノ', 'メ', 'ヌ', 'ク', 'ケ', 'ム', 'ヨ', 'ラ', 'ワ', 'チ', 'テ', 'ナ', 'ネ'];

const LIKE = (() => {
  const map = new Map();
  for (const id of DECK_IDS.filter((deck) => DECKS[deck].quiz === 'kanji')) {
    for (const card of DECKS[id].cards) if (!map.has(card.kanji.char)) map.set(card.kanji.char, card.kanji.like ?? []);
  }
  return map;
})();

export const glyphsOf = (key) => Array.from(unitOf(key)?.word ?? '');
export const wordPoints = (key) => glyphsOf(key).length;
const shotOf = () => LANTERN.tapSeconds + FIREWORKS.aimSeconds;
export const shotSeconds = (key) => glyphsOf(key).length * shotOf();
const missSeconds = () => shotOf();
export const appearSeconds = () => FIREWORKS.sky.retire + FIREWORKS.sky.deal + FIREWORKS.sky.rise;
export const wordLimit = (key) => appearSeconds() + LANTERN.readSeconds + LANTERN.thinkSeconds + shotSeconds(key);

export const fireworksStart = (day) => day * DAY_MINUTES + FIREWORKS.start;
export const fireworksEnd = (day) => fireworksStart(day) + FIREWORKS.minutes;
export const fireworksGatherAt = (day) => fireworksStart(day) - FIREWORKS.gather;

export function fireworksSignOpen(now) {
  const m = minuteOfDay(now);
  return m >= FIREWORKS.signOpen && m < FIREWORKS.start + FIREWORKS.minutes;
}

export function fireworksLeft(now) {
  const m = minuteOfDay(now);
  return Math.max(0, Math.min(FIREWORKS.minutes, FIREWORKS.start + FIREWORKS.minutes - m));
}

export const fireworksStayMinutes = (now) => (fireworksLive(now) ? 0 : FIREWORKS.gather) + fireworksLeft(now);

export function fireworksLive(now) {
  const m = minuteOfDay(now);
  return m >= FIREWORKS.start && m < FIREWORKS.start + FIREWORKS.minutes;
}

export function skyTiles(key, salt) {
  const card = unitOf(key);
  const answer = glyphsOf(key);
  const rand = makeRandom(hashText(`${key}:${salt}`));
  const used = new Set(answer);
  const decoys = [];
  const add = (list, cap = Infinity) => {
    let added = 0;
    for (const char of list) {
      if (decoys.length >= FIREWORKS.decoys || added >= cap) return;
      if (!char || used.has(char)) continue;
      used.add(char);
      decoys.push(char);
      added += 1;
    }
  };
  const kanji = answer.filter((char) => IS_KANJI.test(char)).flatMap((char) => shuffle([...(LIKE.get(char) ?? [])], rand));
  const reading = shuffle(Array.from(card?.reading ?? ''), rand);
  add(kanji, 3);
  add(answer.map((char) => KATAKANA_TWINS[char]));
  add(answer.filter((char) => IS_HIRAGANA.test(char)).map((char) => HIRAGANA_TWINS[char]));
  add(reading, 2);
  if (!decoys.some((char) => KATAKANA_POOL.includes(char) || Object.values(KATAKANA_TWINS).includes(char))) add(shuffle([...KATAKANA_POOL], rand), 1);
  add(kanji);
  add(reading);
  add(shuffle([...KATAKANA_POOL], rand), 6);
  add(shuffle([...HIRAGANA_POOL], rand), 5);
  add(shuffle([...LIKE.keys()], rand));
  const copies = Array.from({ length: FIREWORKS.answerCopies }, () => answer).flat();
  const sky = shuffle([...copies, ...decoys], rand);
  return { answer, decoys, sky };
}

export function attemptSeconds(key, { correct, seconds }, first) {
  return (first ? appearSeconds() + LANTERN.readSeconds : 0) + seconds + (correct ? shotSeconds(key) : missSeconds());
}

export function npcWord(id, key, day) {
  const limit = wordLimit(key);
  let spent = 0;
  for (let first = true; ; first = false) {
    const answer = absorption.respond(id, key, LANTERN.thinkSeconds, day);
    fluency.recall(id, key, day, answer.correct);
    spent += attemptSeconds(key, answer, first);
    if (answer.correct && spent <= limit) return { correct: true, seconds: spent };
    if (spent >= limit) return { correct: false, seconds: limit };
  }
}

export function runTally(run, keys, seconds) {
  let score = 0;
  let words = 0;
  let lastAt = null;
  for (const [at, index, ok = 1] of run) {
    if (at > seconds) break;
    if (!ok) continue;
    score += wordPoints(keys[index % keys.length]);
    words += 1;
    lastAt = at;
  }
  return { score, words, lastAt };
}

export function knownKeys(ids, deck = FIREWORKS.deck) {
  const known = new Set(ids.flatMap((id) => certify.certified(id, deck)));
  return [...known].sort();
}

export function showKeys(day, entrants, salt = 0, deck = FIREWORKS.deck) {
  const known = knownKeys(entrants, deck);
  const pool = known.length ? known : DECKS[deck].cards.map((card) => card.key);
  const rand = makeRandom(hashText(`fireworks:${day}:${salt}`));
  const keys = [];
  while (keys.length < FIREWORKS.words) keys.push(...shuffle([...pool], rand));
  return keys.slice(0, FIREWORKS.words);
}

export function fireworksOdds(id, keys) {
  if (!keys.length) return { score: 0, words: 0 };
  const step = Math.max(1, Math.ceil(keys.length / FIREWORKS.sample));
  const sample = keys.filter((_, i) => i % step === 0);
  let points = 0;
  let words = 0;
  let seconds = 0;
  for (const key of sample) {
    const p = absorption.chance(id, key);
    const hit = 1 - (1 - p) ** 2;
    points += hit * wordPoints(key);
    words += hit;
    seconds += hit * (appearSeconds() + LANTERN.readSeconds + LANTERN.thinkSeconds / 2 + shotSeconds(key)) + (1 - hit) * wordLimit(key);
  }
  if (!(seconds > 0)) return { score: 0, words: 0 };
  return { score: (SHOW_SECONDS * points) / seconds, words: (SHOW_SECONDS * words) / seconds };
}

export function fireworksWorth({ mine, rivals, pot, need, diligence }) {
  const field = rivals.reduce((sum, score) => sum + score, mine.score);
  const share = field > 0 ? mine.score / field : 0;
  return need * (pot * share - FIREWORKS.fee) + mine.words * FIREWORKS.intellect * MIND.intellectValue * diligence;
}

export function placeOrder(rows) {
  return rows
    .map((row, order) => ({ ...row, order }))
    .sort((a, b) => b.score - a.score || (a.lastAt ?? Infinity) - (b.lastAt ?? Infinity) || a.order - b.order)
    .map(({ order, ...row }) => row);
}
