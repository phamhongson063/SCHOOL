import { TRAITS } from './config.js';
import { DECKS, DECK_IDS, plainText } from './studyDecks.js';
import { certify } from './certify.js';
import { traits, SKILLS, TASTES } from './traits.js';
import { trade } from './trade.js';
import { PLAYER } from './inventory.js';

const HOMELANDS = [
  { flag: '🇻🇳', name: 'Việt Nam', people: ['Long'] },
  { flag: '🇯🇵', name: 'Nhật Bản', people: ['Kaito', 'Sakura', 'Haru', 'Hiroshi', 'Ryo', 'Akemi', 'Kenji', 'Takeshi', 'Yumi', 'Sora', 'Hana', 'Yoshiko', 'Haruto', 'Ken'] },
  { flag: '🇰🇷', name: 'Hàn Quốc', people: ['Minho', 'Yuna', 'Jiwoo', 'Taeyang', 'Soojin', 'Hyejin', 'Eunji', 'Dongwoo', 'Minji', 'Youngsoo', 'Jinho', 'Sunhee'] },
  { flag: '🇨🇳', name: 'Trung Quốc', people: ['Mei', 'Haoran', 'Xiaoyu', 'Wei', 'Liang', 'Jianguo', 'Fang', 'Meiling', 'Zhiwei', 'Shen'] },
  { flag: '🇺🇸', name: 'Mỹ', people: ['Jake', 'Riley', 'Tyler', 'Daniel', 'Noah', 'Bobby', 'Jessica', 'Mason'] },
  { flag: '🇬🇧', name: 'Anh', people: ['Emily', 'Lily', 'Walter', 'Martha', 'Henry', 'Grace', 'Clara'] },
];
const PLAYER_HOMELAND = HOMELANDS[0];
const HOMELAND_OF = new Map(HOMELANDS.flatMap((land) => land.people.map((name) => [name, land])));

export function homelandOf(id, name) {
  const land = id === PLAYER ? PLAYER_HOMELAND : HOMELAND_OF.get(name);
  return land ? { flag: land.flag, name: land.name } : null;
}

export function netWorth(id, { ledger, bank, estate }) {
  return Math.floor(ledger.accounts[id]?.money ?? 0) + bank.deposited(id) - bank.debt(id) - Math.ceil(trade.debtOf(id)) + (estate.houseOf(id)?.price ?? 0);
}

const share = (value, [lo, hi]) => Math.max(0, Math.min(1, (value - lo) / (hi - lo)));

export function habitsOf(id) {
  const { taste } = traits.view(id);
  return TASTES.map((kind) => ({ kind, share: share(taste[kind], TRAITS.taste) }));
}

export function abilitiesOf(id) {
  const { diligence, skill } = traits.view(id);
  return {
    diligence: share(diligence, [0, 1]),
    skills: SKILLS.map((kind) => ({ kind, share: share(skill[kind], [0, 1]) })),
  };
}

const PHRASE_LINE = /\[/;
const cardOrder = new Map();
const cardText = new Map();

function orderOf(deck) {
  if (!cardOrder.has(deck)) cardOrder.set(deck, new Map(DECKS[deck].cards.map((card, i) => [card.key, { card, index: i }])));
  return cardOrder.get(deck);
}

function textOf(deck, card) {
  if (cardText.has(card.key)) return cardText.get(card.key);
  let text;
  if (DECKS[deck].quiz === 'phrase') {
    const lines = card.examples.flatMap((example) => example.lines);
    const line = lines.find((entry) => PHRASE_LINE.test(entry[1])) ?? lines[0];
    text = { title: line ? plainText(line[1]).replace(/[[\]]/g, '') : card.word, reading: '', meaning: card.word };
  } else {
    text = { title: card.word, reading: card.reading, meaning: card.meaning };
  }
  cardText.set(card.key, text);
  return text;
}

export function certifiedDecks(id) {
  return DECK_IDS.map((deck) => ({ deck, title: DECKS[deck].title, count: certify.certifiedDays(id, deck).length }));
}

export function certifiedRows(id, deck) {
  const order = orderOf(deck);
  return certify
    .certifiedDays(id, deck)
    .map(([key, day]) => ({ entry: order.get(key), day }))
    .filter(({ entry }) => entry)
    .sort((a, b) => b.day - a.day || a.entry.index - b.entry.index)
    .map(({ entry, day }) => ({ key: entry.card.key, day, ...textOf(deck, entry.card) }));
}
