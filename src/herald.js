import { ARENA, FIREWORKS, HERALD, LANTERN, LOTO } from './config.js';
import { DAY_MINUTES, dayOf } from './clock.js';
import { blessingSlots } from './economy.js';
import { slotStarts } from './fireworksSchedule.js';
import { arenaStarts } from './arenaSchedule.js';

const EVENTS = [
  { kind: 'blessing', starts: (day) => blessingSlots(day).map(({ start }) => start), lead: HERALD.lead },
  { kind: 'arena', starts: (day) => arenaStarts(day), lead: ARENA.lead },
  { kind: 'lantern', starts: () => [LANTERN.start], lead: LANTERN.heraldLead },
  { kind: 'loto', starts: () => [LOTO.start], lead: LOTO.heraldLead },
  { kind: 'fireworks', starts: (day) => slotStarts(day), lead: FIREWORKS.heraldLead },
];

function nextAt(now, starts) {
  const day = dayOf(now);
  let best = null;
  for (const d of [day, day + 1]) {
    for (const start of starts(d)) {
      const at = d * DAY_MINUTES + start;
      if (at > now && (best === null || at < best)) best = at;
    }
  }
  return best;
}

export function heralds(now) {
  return EVENTS.map(({ kind, starts, lead }) => ({ kind, lead, at: nextAt(now, starts) }))
    .filter(({ at, lead }) => at !== null && at - now <= lead)
    .map(({ lead, ...item }) => ({ ...item, left: Math.max(1, Math.ceil(item.at - now)), beat: `${item.at}:${Math.floor((lead - (item.at - now)) / HERALD.every)}` }));
}
