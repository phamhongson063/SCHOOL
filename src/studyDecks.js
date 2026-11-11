import { N2_VOCAB } from './vocabN2.js';
import { LESSONS } from './lessons.js';

const GIST = /^(.+?[.!?…])\s+(?=\p{Lu})/u;

function splitMeaning(text) {
  const match = text.match(GIST);
  return match ? { meaning: match[1], note: text.slice(match[0].length) } : { meaning: text, note: '' };
}

export const DECKS = {
  n2: {
    title: 'N2',
    label: 'Từ vựng N2',
    unit: 'từ mới',
    cards: N2_VOCAB.map((entry) => ({
      key: entry.word,
      word: entry.word,
      reading: entry.reading,
      hanViet: entry.hanViet,
      meaning: entry.meaning,
      note: '',
      examples: [{ title: '', lines: [['', entry.example, entry.exampleVi]] }],
    })),
  },
  sugu1: {
    title: 'すぐに使える①',
    label: 'すぐに使える①',
    unit: 'mẫu câu',
    cards: LESSONS.map((lesson) => ({
      key: `sugu1:${lesson.no}`,
      word: lesson.phrase,
      reading: lesson.romaji,
      hanViet: '',
      ...splitMeaning(lesson.meaning),
      examples: lesson.examples,
    })),
  },
};
