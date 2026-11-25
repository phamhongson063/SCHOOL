import { DECKS, DECK_IDS, plainText, unitOf } from './studyDecks.js';
import { makeRandom, shuffle } from './random.js';
import { LETTERS } from './format.js';

export const KIND_LABELS = { kanji: 'Chữ Hán nào?', reading: 'Cách đọc?', meaning: 'Nghĩa là gì?' };

const MEANINGS = [...new Set(Object.values(DECKS).flatMap((deck) => deck.cards.map((card) => card.meaning)))];
const shownWord = (card) => plainText(card.word).replace(/[[\]]/g, '');
const MEANINGS_BY_WORD = (() => {
  const map = new Map();
  for (const card of Object.values(DECKS).flatMap((deck) => deck.cards)) {
    const word = shownWord(card);
    if (!map.has(word)) map.set(word, new Set());
    map.get(word).add(card.meaning);
  }
  return map;
})();
const KANJI_WORDS = DECK_IDS.filter((id) => DECKS[id].quiz === 'vocab')
  .flatMap((id) => DECKS[id].cards.map((card) => plainText(card.word)))
  .filter((word) => /[㐀-鿿]/.test(word));

function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const seeded = (seed) => makeRandom(hashOf(seed));

function kanjiQuestion(card, rand) {
  const answer = plainText(card.word);
  const near = KANJI_WORDS.filter((word) => word !== answer && word.length === answer.length);
  const wrong = [...new Set([...(card.kanjiChoices ?? []).map(plainText), ...shuffle([...near], rand)])].filter((word) => word !== answer).slice(0, LETTERS.length - 1);
  return { word: card.reading, hint: card.meaning, kind: 'kanji', answer, options: shuffle([answer, ...wrong], rand) };
}

export function buildQuestion(key, tier, rand = Math.random) {
  const card = unitOf(key);
  if (tier === 'hard' && card.reading && card.kanjiChoices?.length) return kanjiQuestion(card, rand);
  const reading = !!card.reading && (card.distractors?.length ?? 0) >= LETTERS.length - 1 && rand() < 0.5;
  const answer = reading ? card.reading : card.meaning;
  const word = shownWord(card);
  const sameWord = MEANINGS_BY_WORD.get(word);
  const pool = reading ? card.distractors : MEANINGS.filter((meaning) => meaning !== card.meaning && !sameWord.has(meaning) && !(card.siblingMeanings ?? []).includes(meaning));
  const options = shuffle([answer, ...shuffle([...pool], rand).slice(0, LETTERS.length - 1)], rand);
  return { word, hint: '', kind: reading ? 'reading' : 'meaning', answer, options };
}

export function pickOf(question, correct, rand) {
  if (correct) return question.answer;
  const wrong = question.options.filter((option) => option !== question.answer);
  return wrong[Math.floor(rand() * wrong.length)];
}
