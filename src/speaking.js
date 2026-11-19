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

function graphOf(segments) {
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
  for (const [from, to] of fillerRuns(segments)) nodes[ends[to]].push({ from: starts[from], ch: null, seg: -1 });
  return nodes;
}

function align(segments, heard) {
  const nodes = graphOf(segments);
  const said = [...soundOf(heard)];
  const cost = nodes.map(() => new Array(said.length + 1).fill(Infinity));
  const back = nodes.map(() => new Array(said.length + 1).fill(null));
  for (let j = 0; j <= said.length; j++) {
    cost[0][j] = j;
    back[0][j] = j ? { node: 0, at: j - 1, edge: null } : null;
  }
  for (let u = 1; u < nodes.length; u++) {
    for (let j = 0; j <= said.length; j++) {
      for (const edge of nodes[u]) {
        if (edge.ch === null) {
          if (cost[edge.from][j] < cost[u][j]) {
            cost[u][j] = cost[edge.from][j];
            back[u][j] = { node: edge.from, at: j, edge, miss: false };
          }
          continue;
        }
        const skip = cost[edge.from][j] + 1;
        if (skip < cost[u][j]) {
          cost[u][j] = skip;
          back[u][j] = { node: edge.from, at: j, edge, miss: true };
        }
        if (!j) continue;
        const miss = edge.ch !== said[j - 1];
        const step = cost[edge.from][j - 1] + (miss ? 1 : 0);
        if (step < cost[u][j]) {
          cost[u][j] = step;
          back[u][j] = { node: edge.from, at: j - 1, edge, miss };
        }
      }
      if (j && cost[u][j - 1] + 1 < cost[u][j]) {
        cost[u][j] = cost[u][j - 1] + 1;
        back[u][j] = { node: u, at: j - 1, edge: null };
      }
    }
  }
  const misses = new Set();
  let node = nodes.length - 1;
  let at = said.length;
  while (back[node][at]) {
    const step = back[node][at];
    if (step.edge && step.miss) misses.add(step.edge.seg);
    node = step.node;
    at = step.at;
  }
  return { distance: cost[nodes.length - 1][said.length], misses };
}

export function scoreSpeech(text, heards) {
  const segments = speechSegments(text);
  const length = segments.reduce((sum, segment) => sum + Math.max(0, ...segment.sounds.map((sound) => [...sound].length)), 0);
  let best = { score: 0, misses: new Set(segments.map((_, i) => i)), heard: heards[0] ?? '' };
  for (const heard of heards) {
    const { distance, misses } = align(segments, heard);
    const score = Math.max(0, 1 - distance / Math.max(length, SPEAK.minLength));
    if (score > best.score) best = { score, misses, heard };
  }
  return { ...best, passed: best.score >= SPEAK.pass };
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
  for (const key of speechKeys(actor, deck)) {
    for (const line of speechLines(key)) {
      at += lineSeconds(line.text);
      while (at <= seconds && Math.random() >= speechChance(actor, key, day)) at += SPEAK.retry + lineSeconds(line.text);
      if (at > seconds) return { done, seconds };
    }
    done.push({ key, at });
  }
  return { done, seconds: at };
}

export function applySpeech(actor, deck, done, elapsed, day) {
  for (const { key, at } of done) if (at <= elapsed) rewardSpeech(actor, deck, key, day);
}
