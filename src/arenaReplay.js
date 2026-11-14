import { ARENA } from './config.js';
import { PLAYER } from './inventory.js';
import { matchMinutes, turnSeconds } from './arena.js';

export const SKILLS = [
  { name: 'Kiếm khí', icon: '🗡️', color: 0x4f8dff },
  { name: 'Lôi kích', icon: '⚡', color: 0x9b5cff },
  { name: 'Hỏa phù', icon: '🔥', color: 0xff5a1f },
  { name: 'Băng tiễn', icon: '❄️', color: 0x1fb8f0 },
  { name: 'Phong nhận', icon: '🌀', color: 0x22c66e },
  { name: 'Kim quang', icon: '✨', color: 0xffb21c },
];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const skillOf = (seed) => SKILLS[hash(seed) % SKILLS.length];

export const hitSeconds = (turn) => ARENA.read + Math.max(turn.a.seconds, turn.b.seconds);


export function onStage(match, now) {
  if (!match.a || !match.b || match.forfeit) return false;
  if (match.live || match.a === PLAYER || match.b === PLAYER) return match.live;
  if (!match.turns.length || match.startAt === null) return false;
  return now >= match.startAt && now < match.startAt + matchMinutes(match);
}

export function replayState(match, now) {
  if (match.live) {
    const last = match.turns.length - 1;
    return { index: last, elapsed: Infinity, resolved: match.turns.length, hp: { ...match.hp }, live: true };
  }
  let clock = (now - match.startAt) * 60;
  let resolved = 0;
  let hp = { a: ARENA.hp, b: ARENA.hp };
  for (let i = 0; i < match.turns.length; i++) {
    const turn = match.turns[i];
    if (i > 0 && (turn.set ?? 1) !== (match.turns[i - 1].set ?? 1)) hp = { a: ARENA.hp, b: ARENA.hp };
    const span = turnSeconds(turn);
    const hit = hitSeconds(turn);
    if (clock < span) {
      if (clock >= hit) {
        resolved = i + 1;
        hp = { ...turn.hp };
      }
      return { index: i, elapsed: clock, resolved, hp, live: false };
    }
    clock -= span;
    resolved = i + 1;
    hp = { ...turn.hp };
  }
  return { index: match.turns.length - 1, elapsed: Infinity, resolved, hp, live: false };
}

export function resolveAt(match, index) {
  let seconds = 0;
  for (let i = 0; i < index; i++) seconds += turnSeconds(match.turns[i]);
  return match.startAt + (seconds + hitSeconds(match.turns[index])) / 60;
}
