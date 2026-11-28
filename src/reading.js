import { DECKS, READINGS } from './studyDecks.js';
import { certify } from './certify.js';
import { absorption } from './absorption.js';
import { READING } from './config.js';
import { shuffle } from './random.js';

export const readingFee = () => READING.fee;

export const passageOpen = (actor, passage) => certify.groupsCertified(actor, passage.deck, passage.groups);

export const openPassages = (actor, room) => (READINGS[room]?.passages ?? []).filter((passage) => passageOpen(actor, passage));

export function pickPassage(actor, room, last = null) {
  const open = openPassages(actor, room);
  const pool = open.length > 1 ? open.filter((passage) => passage.id !== last) : open;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export const blankChoices = (blank) => shuffle([blank.answer, ...blank.wrong]);

export const passageSeconds = (passage) => passage.blanks.length * READING.blankSeconds;

function groupKey(deck, group) {
  const keys = (DECKS[deck]?.cards ?? []).filter((card) => card.group === group).map((card) => card.key);
  return keys[Math.floor(Math.random() * keys.length)] ?? null;
}

export function simulatePassage(actor, passage) {
  return passage.blanks.map((blank) => {
    const key = groupKey(passage.deck, blank.group);
    return !!key && absorption.answer(actor, key);
  });
}

export function simulateReading(actor, room, seconds) {
  const results = [];
  let left = seconds;
  let last = null;
  let passages = 0;
  for (;;) {
    const passage = pickPassage(actor, room, last);
    if (!passage || left < passageSeconds(passage)) break;
    left -= passageSeconds(passage);
    results.push(...simulatePassage(actor, passage));
    last = passage.id;
    passages += 1;
  }
  return { right: results.filter(Boolean).length, total: results.length, passages };
}
