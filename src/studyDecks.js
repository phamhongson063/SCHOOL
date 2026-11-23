import { N2_VOCAB } from './vocabN2.js';
import { LESSONS } from './lessons.js';
import { KANJI_N2 } from './kanjiN2.js';
import { KANJI_N3 } from './kanjiN3.js';
import { vaultItem } from './vault.js';

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

const KANJI_RUN = /([㐀-鿿々〆]+)/;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function rubyOf(word, reading) {
  const parts = word.split(KANJI_RUN).filter(Boolean);
  const match = reading.match(new RegExp(`^${parts.map((part) => (KANJI.test(part) ? '(.+?)' : escapeRegex(part))).join('')}$`));
  if (!match) return `${word}{${reading}}`;
  let next = 1;
  return parts.map((part) => (KANJI.test(part) ? `${part}{${match[next++]}}` : part)).join('');
}

const kanjiCards = (list, prefix, deck) =>
  list.flatMap((kanji) =>
    kanji.words.map((entry, i) => ({
      key: `${prefix}:${kanji.no}:${i + 1}`,
      deck,
      group: kanji.no,
      word: entry.word,
      reading: entry.reading,
      hanViet: entry.hanViet,
      meaning: entry.meaning,
      distractors: entry.wrong,
      writeChoices: kanji.like.map((other) => entry.word.replaceAll(kanji.kanji, other)),
      note: '',
      kanji: { char: kanji.kanji, hanViet: kanji.hanViet, parts: kanji.parts, on: kanji.on, kun: kanji.kun, like: kanji.like },
      examples: [{ title: '', lines: [['', entry.example.replace(`[${entry.word}]`, `[${rubyOf(entry.word, entry.reading)}]`), entry.vi]] }],
    })),
  );

function sentenceOf(ja, vi, wrong) {
  if (typeof ja !== 'string') return null;
  const lines = [['', ja, vi ?? '']];
  const cloze = clozeOf(lines);
  return cloze ? { lines, cloze, wrong: Array.isArray(wrong) ? wrong : [] } : null;
}

function practiceByGroup(units, deck) {
  const byGroup = new Map();
  if (!Array.isArray(units)) return byGroup;
  for (const unit of units) {
    const groups = Array.isArray(unit?.groups) ? unit.groups : [];
    for (const item of Array.isArray(unit?.practice) ? unit.practice : []) {
      const sentence = sentenceOf(item?.ja, item?.vi, item?.wrong);
      if (!sentence || !groups.includes(item.group)) continue;
      byGroup.set(item.group, [...(byGroup.get(item.group) ?? []), { ...sentence, deck, groups }]);
    }
  }
  return byGroup;
}

function grammarCards(points, units, prefix, deck) {
  if (!Array.isArray(points)) return [];
  const meanings = new Map(points.map((point) => [point.no, point.meaning]));
  const practice = practiceByGroup(units, deck);
  return points.flatMap((point) =>
    (point.examples ?? []).flatMap((example, i) => {
      const sentence = sentenceOf(example?.ja, example?.vi);
      if (!sentence) return [];
      const { lines, cloze } = sentence;
      const audio = typeof example.audio === 'string' ? example.audio : null;
      return [
        {
          key: `${prefix}:${point.no}:${i + 1}`,
          deck,
          group: point.no,
          word: point.word,
          reading: '',
          hanViet: '',
          meaning: point.meaning,
          note: '',
          grammar: {
            gloss: point.gloss ?? '',
            form: point.form ?? '',
            explain: point.explain ?? '',
            follow: Array.isArray(point.follow) ? point.follow : [],
          },
          examples: [{ title: '', lines }],
          cloze,
          wrong: example.wrong ?? [],
          audio,
          listen: audio ? sentenceOf(example.listen, example.vi, example.listenWrong) : null,
          practice: practice.get(point.no) ?? [],
          siblingMeanings: (point.near ?? []).map((no) => meanings.get(no)).filter(Boolean),
        },
      ];
    }),
  );
}

const VAULT_DECKS = {
  grammarN2: {
    title: '文法 N2',
    label: 'Ngữ pháp N2',
    teacher: 'Alice',
    level: '文法 N2',
    unit: 'câu',
    quiz: 'grammar',
    choices: 4,
    wholeGroups: true,
    cards: (points) => grammarCards(points, vaultItem('grammarN2Units'), 'gn2', 'grammarN2'),
  },
};

export const VAULT_DECK_IDS = Object.keys(VAULT_DECKS);

function vaultDecks() {
  return Object.fromEntries(
    VAULT_DECK_IDS.map((id) => [id, { ...VAULT_DECKS[id], cards: VAULT_DECKS[id].cards(vaultItem(id)) }]).filter(([, deck]) => deck.cards.length),
  );
}

export const DECKS = {
  n2: {
    title: 'N2',
    label: 'Từ vựng N2',
    teacher: 'Aiko',
    level: '単語 N2',
    unit: 'từ',
    quiz: 'vocab',
    choices: 4,
    cards: linkSiblings(N2_VOCAB.map((entry, i) => ({
      key: N2_KEYS[i],
      deck: 'n2',
      group: entry.no,
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
    teacher: 'Megan',
    level: 'すぐに使える①',
    unit: 'câu ví dụ',
    quiz: 'phrase',
    choices: 0,
    speak: true,
    cards: LESSONS.flatMap((lesson) =>
      lesson.examples.map((example, i) => ({
        key: `sugu1:${lesson.no}:${i + 1}`,
        deck: 'sugu1',
        group: lesson.no,
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
  kanjiN2: {
    title: '漢字 N2',
    label: 'Kanji N2',
    teacher: 'Xiulan',
    level: '漢字 N2',
    unit: 'từ',
    quiz: 'kanji',
    choices: 4,
    cards: kanjiCards(KANJI_N2, 'kn2', 'kanjiN2'),
  },
  kanjiN3: {
    title: '漢字 N3',
    label: 'Kanji N3',
    teacher: 'Seoyeon',
    level: '漢字 N3',
    unit: 'từ',
    quiz: 'kanji',
    choices: 4,
    cards: kanjiCards(KANJI_N3, 'kn3', 'kanjiN3'),
  },
  ...vaultDecks(),
};

export const DECK_IDS = Object.keys(DECKS);

export const sentenceDeck = (deck) => DECKS[deck].quiz === 'phrase' || DECKS[deck].quiz === 'grammar';

const UNITS = new Map(DECK_IDS.flatMap((id) => DECKS[id].cards.map((card) => [card.key, card])));

export const unitOf = (key) => UNITS.get(key) ?? null;

export const deckOf = (key) => UNITS.get(key)?.deck ?? null;
