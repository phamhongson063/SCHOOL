import { BLESSING, FIREWORKS, KEEPER_SHIFT, LOTO } from './config.js';
import { DAY_MINUTES, dayOf } from './clock.js';
import { lotoEnd } from './lotoRules.js';
import { fireworksSlots } from './fireworksSchedule.js';

const span = (day, from, to) => (to > from ? [day * DAY_MINUTES + from - KEEPER_SHIFT.arrive, day * DAY_MINUTES + to + KEEPER_SHIFT.linger] : null);

function onShift(now, shiftOf) {
  const day = dayOf(now);
  return [day - 1, day].some((d) => {
    const shift = shiftOf(d);
    return !!shift && now >= shift[0] && now < shift[1];
  });
}

function blessingShift(day) {
  const starts = BLESSING.windows.map(([start]) => start);
  const ends = BLESSING.windows.map(([, end]) => end);
  return span(day, Math.min(...starts), Math.max(...ends));
}

const lotoShift = (day) => span(day, LOTO.signOpen, lotoEnd(day) - day * DAY_MINUTES);

function fireworksShift(day) {
  const slots = fireworksSlots(day);
  if (!slots.length) return null;
  return span(day, Math.min(...slots.map((slot) => slot.signOpen)), Math.max(...slots.map((slot) => slot.start + FIREWORKS.minutes)));
}

export const blessingOnDuty = (now) => onShift(now, blessingShift);
export const lotoOnDuty = (now) => onShift(now, lotoShift);
export const fireworksOnDuty = (now) => onShift(now, fireworksShift);
