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

export const DECKS = {
  n2: {
    title: 'N2',
    label: 'Từ vựng N2',
    level: '単語 N2',
    unit: 'từ',
    cards: N2_VOCAB.map((entry) => ({
      key: `n2:${entry.no}`,
      deck: 'n2',
      word: entry.word,
      reading: entry.reading,
      hanViet: entry.hanViet,
      meaning: entry.meaning,
      distractors: entry.distractors ?? [],
      note: '',
      examples: [{ title: '', lines: [['', entry.example, entry.exampleVi]] }],
    })),
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
