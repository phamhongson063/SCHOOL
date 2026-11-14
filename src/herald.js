import { ARENA, BLESSING, HERALD } from './config.js';
import { DAY_MINUTES, dayOf } from './clock.js';

const EVENTS = [
  { kind: 'blessing', starts: () => BLESSING.windows.map(([start]) => start) },
  { kind: 'arena', starts: () => ARENA.starts },
];

function nextAt(now, starts) {
  const day = dayOf(now);
  let best = null;
  for (const d of [day, day + 1]) {
    for (const start of starts) {
      const at = d * DAY_MINUTES + start;
      if (at > now && (best === null || at < best)) best = at;
    }
  }
  return best;
}

export function heralds(now) {
  return EVENTS.map(({ kind, starts }) => ({ kind, at: nextAt(now, starts()) }))
    .filter(({ at }) => at !== null && at - now <= HERALD.lead)
    .map((item) => ({ ...item, left: Math.max(1, Math.ceil(item.at - now)), beat: `${item.at}:${Math.floor((HERALD.lead - (item.at - now)) / HERALD.every)}` }));
}
