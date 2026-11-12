import { N2_VOCAB } from './vocabN2.js';
import { LESSONS } from './lessons.js';

const GIST = /^(.+?[.!?…])\s+(?=\p{Lu})/u;
const MARKS = /\[([^\]]+)\]/g;

export const plainText = (text) => text.replace(/\{[^}]+\}/g, '');

function gist(text) {
  const match = text.match(GIST);
  return match ? match[1] : text;
}

function clozeOf(lines) {
  const marks = lines.flatMap((line) => [...line[1].matchAll(MARKS)].map((match) => match[1]));
  if (!marks.length) return null;
  const answer = marks[0];
  return { answer, all: marks.every((mark) => plainText(mark) === plainText(answer)) };
}

const KANJI = /[㐀-鿿々〆]/;

function n2Keys(entries) {
  const seen = new Map();
  return entries.map((entry) => {
    const count = seen.get(entry.no) ?? 0;
    seen.set(entry.no, count + 1);
    return `n2:${entry.no}${count ? String.fromCharCode(97 + count) : ''}`;
  });
}

function linkSiblings(cards, entries) {
  const groups = new Map();
  entries.forEach((entry, i) => groups.set(entry.no, [...(groups.get(entry.no) ?? []), cards[i]]));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const card of group) {
      const others = group.filter((other) => other !== card);
      card.siblingMeanings = others.map((other) => other.meaning);
      card.kanjiChoices = KANJI.test(card.word)
        ? others.filter((other) => other.reading === card.reading && other.meaning !== card.meaning && other.word !== card.word).map((other) => other.word)
        : [];
    }
  }
  return cards;
}

const N2_KEYS = n2Keys(N2_VOCAB);

export const DECKS = {
  n2: {
    title: 'N2',
    label: 'Từ vựng N2',
    level: '単語 N2',
    unit: 'từ',
    cards: linkSiblings(N2_VOCAB.map((entry, i) => ({
      key: N2_KEYS[i],
      deck: 'n2',
      word: entry.word,
      reading: entry.reading,
      hanViet: entry.hanViet,
      meaning: entry.meaning,
      distractors: entry.distractors ?? [],
      note: '',
      examples: [
        [entry.example, entry.exampleVi],
        [entry.example2, entry.example2Vi],
      ]
        .filter(([text]) => text)
        .map(([text, vi]) => ({ title: '', lines: [['', text, vi]] })),
      siblingMeanings: [],
      kanjiChoices: [],
    })), N2_VOCAB),
  },
  sugu1: {
    title: 'すぐに使える①',
    label: 'すぐに使える①',
    level: 'すぐに使える①',
    unit: 'câu ví dụ',
    cards: LESSONS.flatMap((lesson) =>
      lesson.examples.map((example, i) => ({
        key: `sugu1:${lesson.no}:${i + 1}`,
        deck: 'sugu1',
        word: lesson.phrase,
        reading: '',
        hanViet: '',
        meaning: gist(lesson.meaning),
        note: '',
        examples: [example],
        cloze: clozeOf(example.lines),
      })),
    ),
  },
};

export const DECK_IDS = Object.keys(DECKS);

const UNITS = new Map(DECK_IDS.flatMap((id) => DECKS[id].cards.map((card) => [card.key, card])));

export const unitOf = (key) => UNITS.get(key) ?? null;

export const deckOf = (key) => UNITS.get(key)?.deck ?? null;
