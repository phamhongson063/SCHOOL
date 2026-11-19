import { FLUENCY, SPEAK } from './config.js';
import { DECKS, DECK_IDS, unitOf } from './studyDecks.js';
import { certify } from './certify.js';
import { fluency } from './fluency.js';
import { absorption } from './absorption.js';
import { between } from './random.js';

const RUBY = /([㐀-鿿々〆Ａ-Ｚａ-ｚ]+)\{([^}]+)\}/g;
const SOUND = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー0-9a-z]/u;

export const SPEAK_DECKS = DECK_IDS.filter((id) => DECKS[id].speak);

const VOWEL_ROWS = {
  あ: 'あかさたなはまやらわがざだばぱぁゃゎ',
  い: 'いきしちにひみりぎじぢびぴぃ',
  う: 'うくすつぬふむゆるぐずづぶぷぅゅゔ',
  え: 'えけせてねへめれげぜでべぺぇ',
  お: 'おこそとのほもよろをごぞどぼぽぉょ',
};
const VOWEL = new Map(Object.entries(VOWEL_ROWS).flatMap(([vowel, row]) => [...row].map((ch) => [ch, vowel])));

function hiragana(ch) {
  const code = ch.codePointAt(0);
  return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
}

function lengthen(chars) {
  return chars.map((ch, i) => (ch === 'ー' && i ? (VOWEL.get(chars[i - 1]) ?? ch) : ch));
}

export const soundOf = (text) =>
  lengthen([...text.normalize('NFKC').toLowerCase()].map(hiragana).filter((ch) => SOUND.test(ch))).join('');

const soundAfter = (before, ch) => soundOf(before + ch).slice(soundOf(before).length);

export function joinPieces(pieces) {
  const joined = [];
  for (const piece of pieces) {
    const top = soundOf(piece[0] ?? '');
    if (!top) continue;
    const before = soundOf(joined.at(-1)?.[0] ?? '');
    if ([...before].length >= SPEAK.repeatSounds && top.startsWith(before)) joined[joined.length - 1] = piece;
    else joined.push(piece);
  }
  return joined;
}

export function speechSegments(text) {
  const segments = [];
  for (const part of text.split(/(\[[^\]]+\])/)) {
    if (!part) continue;
    const mark = part.startsWith('[');
    const body = mark ? part.slice(1, -1) : part;
    const loose = (chunk) => {
      for (const ch of chunk) {
        const before = segments.at(-1)?.text.slice(-1) ?? '';
        segments.push({ text: ch, reading: null, sounds: [soundAfter(before, ch)].filter(Boolean), mark });
      }
    };
    let last = 0;
    for (const match of body.matchAll(RUBY)) {
      loose(body.slice(last, match.index));
      segments.push({ text: match[1], reading: match[2], sounds: [...new Set([soundOf(match[1]), soundOf(match[2])].filter(Boolean))], mark });
      last = match.index + match[0].length;
    }
    loose(body.slice(last));
  }
  return segments;
}

export const speechReading = (text) =>
  speechSegments(text)
    .map((segment) => segment.reading ?? segment.text)
    .join('');

function fillerRuns(segments) {
  const quiet = (at) => !segments[at]?.sounds.length;
  const runs = [];
  segments.forEach((_, from) => {
    if (!quiet(from - 1) || quiet(from)) return;
    let text = '';
    for (let to = from; to < segments.length && !quiet(to); to++) {
      text += segments[to].text;
      if (quiet(to + 1) && SPEAK.fillers.includes(text)) runs.push([from, to]);
    }
  });
  return runs;
}

const HAN = /\p{Script=Han}/u;
const sayable = (text) => [...text.normalize('NFKC').toLowerCase()].map(hiragana).filter((ch) => SOUND.test(ch));
let readingBook = null;

function readings() {
  if (readingBook) return readingBook;
  const words = new Map();
  const add = (word, reading) => {
    const key = sayable(word).join('');
    const sound = soundOf(reading);
    if (!HAN.test(key) || !sound) return;
    if (!words.has(key)) words.set(key, new Set([soundOf(key)]));
    words.get(key).add(sound);
  };
  for (const id of DECK_IDS) {
    for (const card of DECKS[id].cards) {
      if (card.reading) add(card.word, card.reading);
      for (const example of card.examples) for (const [, text] of example.lines) for (const match of text.matchAll(RUBY)) add(match[1], match[2]);
    }
  }
  readingBook = { words, longest: Math.max(1, ...[...words.keys()].map((key) => [...key].length)) };
  return readingBook;
}

function heardChunks(heard) {
  const { words, longest } = readings();
  const chars = sayable(heard);
  const chunks = [];
  for (let i = 0; i < chars.length; ) {
    let size = Math.min(longest, chars.length - i);
    while (size > 0 && !words.has(chars.slice(i, i + size).join(''))) size -= 1;
    if (size) {
      chunks.push({ sounds: [...words.get(chars.slice(i, i + size).join(''))] });
      i += size;
    } else {
      chunks.push({ sounds: [soundAfter(chars[i - 1] ?? '', chars[i])].filter(Boolean) });
      i += 1;
    }
  }
  return chunks;
}

function graphOf(segments, optional = []) {
  const nodes = [[]];
  const starts = [];
  const ends = [];
  let end = 0;
  segments.forEach((segment, seg) => {
    starts[seg] = end;
    ends[seg] = end;
    if (!segment.sounds.length) return;
    const tails = [];
    for (const sound of segment.sounds) {
      const chars = [...sound];
      let from = end;
      for (const ch of chars.slice(0, -1)) {
        nodes.push([{ from, ch, seg }]);
        from = nodes.length - 1;
      }
      tails.push({ from, ch: chars.at(-1), seg });
    }
    nodes.push(tails);
    end = nodes.length - 1;
    ends[seg] = end;
  });
  for (const [from, to] of optional) nodes[ends[to]].push({ from: starts[from], ch: null, seg: -1 });
  return nodes;
}

function heardGraph(pieces) {
  const nodes = [[]];
  const follow = (from, chunks) => {
    let at = from;
    for (const chunk of chunks) {
      if (!chunk.sounds.length) continue;
      const tails = [];
      for (const sound of chunk.sounds) {
        const chars = [...sound];
        let tail = at;
        for (const ch of chars.slice(0, -1)) {
          nodes.push([{ from: tail, ch }]);
          tail = nodes.length - 1;
        }
        tails.push({ from: tail, ch: chars.at(-1) });
      }
      nodes.push(tails);
      at = nodes.length - 1;
    }
    return at;
  };
  let end = 0;
  for (const piece of pieces) {
    const ends = [...new Set(piece)].map((alternative) => follow(end, heardChunks(alternative)));
    nodes.push([...new Set(ends)].map((from) => ({ from, ch: null })));
    end = nodes.length - 1;
  }
  return nodes;
}

function align(segments, pieces) {
  const want = graphOf(segments, fillerRuns(segments));
  const said = heardGraph(pieces);
  const cost = want.map(() => new Array(said.length).fill(Infinity));
  const back = want.map(() => new Array(said.length).fill(null));
  cost[0][0] = 0;
  for (let u = 0; u < want.length; u++) {
    for (let v = 0; v < said.length; v++) {
      const offer = (value, step) => {
        if (value < cost[u][v]) {
          cost[u][v] = value;
          back[u][v] = step;
        }
      };
      for (const extra of said[v]) offer(cost[u][extra.from] + (extra.ch === null ? 0 : 1), { u, v: extra.from, edge: null, miss: false });
      for (const edge of want[u]) {
        offer(cost[edge.from][v] + (edge.ch === null ? 0 : 1), { u: edge.from, v, edge, miss: edge.ch !== null });
        if (edge.ch === null) continue;
        for (const sound of said[v]) {
          if (sound.ch === null) continue;
          const miss = edge.ch !== sound.ch;
          offer(cost[edge.from][sound.from] + (miss ? 1 : 0), { u: edge.from, v: sound.from, edge, miss });
        }
      }
    }
  }
  const misses = new Set();
  let u = want.length - 1;
  let v = said.length - 1;
  while (back[u][v]) {
    const step = back[u][v];
    if (step.edge && step.miss) misses.add(step.edge.seg);
    u = step.u;
    v = step.v;
  }
  return { distance: cost[want.length - 1][said.length - 1], misses };
}

function passMark(length) {
  const [short, long] = SPEAK.passLength;
  const t = Math.min(1, Math.max(0, (length - short) / (long - short)));
  return SPEAK.pass[0] + (SPEAK.pass[1] - SPEAK.pass[0]) * t;
}

export function scoreSpeech(text, pieces) {
  const segments = speechSegments(text);
  const length = segments.reduce((sum, segment) => sum + Math.max(0, ...segment.sounds.map((sound) => [...sound].length)), 0);
  const { distance, misses } = align(segments, pieces);
  const score = Math.max(0, 1 - distance / Math.max(length, SPEAK.minLength));
  const last = segments.findLastIndex((segment) => segment.sounds.length);
  return { score, misses, passed: score >= passMark(length), ended: score > 0 && last >= 0 && !misses.has(last) };
}

export const speechLines = (key) => unitOf(key).examples[0].lines.map(([speaker, text, vi]) => ({ speaker, text, vi }));

export const speechKeys = (actor, deck) => certify.speakKeys(actor, deck, SPEAK.dialogs);

export function rewardSpeech(actor, deck, key, day) {
  certify.gradeReview(actor, deck, [{ key, correct: true }]);
  fluency.recall(actor, key, day, true);
}

export function speechChance(actor, key, day) {
  const fluent = FLUENCY.floor + (1 - FLUENCY.floor) * fluency.of(actor, key, day);
  return Math.max(SPEAK.minChance, absorption.chance(actor, key) * fluent);
}

const lineSeconds = (text) => between(...SPEAK.lineSeconds) + soundOf(speechReading(text)).length * SPEAK.kanaSeconds;

export function planSpeech(actor, deck, seconds, day) {
  const done = [];
  let at = 0;
  for (;;) {
    const keys = speechKeys(actor, deck);
    if (!keys.length) return { done, seconds: at };
    for (const key of keys) {
      for (const line of speechLines(key)) {
        at += lineSeconds(line.text);
        while (at <= seconds && Math.random() >= speechChance(actor, key, day)) at += SPEAK.retry + lineSeconds(line.text);
        if (at > seconds) return { done, seconds };
      }
      done.push({ key, at });
    }
  }
}

export function applySpeech(actor, deck, done, elapsed, day) {
  for (const { key, at } of done) if (at <= elapsed) rewardSpeech(actor, deck, key, day);
}
