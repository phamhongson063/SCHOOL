import { FIREWORKS } from './config.js';
import { DAY_MINUTES, dayOf } from './clock.js';

const weekdayOf = (day) => new Date(day * DAY_MINUTES * 60000).getUTCDay();

export const fireworksSlots = (day) => FIREWORKS.slots.filter((slot) => !slot.weekdays || slot.weekdays.includes(weekdayOf(day)));
export const slotStarts = (day) => fireworksSlots(day).map((slot) => slot.start);
export const fireworksPerDay = (day) => fireworksSlots(day).length;
export const validSlot = (start) => FIREWORKS.slots.some((slot) => slot.start === start);

export const showStart = (day, slot) => day * DAY_MINUTES + slot;
export const showEnd = (day, slot) => showStart(day, slot) + FIREWORKS.minutes;

function windowOf(day, slot) {
  const start = showStart(day, slot.start);
  return { day, slot: slot.start, signOpen: day * DAY_MINUTES + slot.signOpen, start, gather: start - FIREWORKS.gather, end: start + FIREWORKS.minutes };
}

export function fireworksWindow(now) {
  const day = dayOf(now);
  for (const slot of fireworksSlots(day)) {
    const window = windowOf(day, slot);
    if (now >= window.signOpen && now < window.end) return window;
  }
  return null;
}

export const fireworksSignOpen = (now) => fireworksWindow(now) !== null;

export function fireworksLive(now) {
  const window = fireworksWindow(now);
  return !!window && now >= window.start;
}

export function fireworksLeft(now) {
  const window = fireworksWindow(now);
  return window ? Math.max(0, Math.min(FIREWORKS.minutes, window.end - now)) : 0;
}

export const fireworksStayMinutes = (now) => (fireworksLive(now) ? 0 : FIREWORKS.gather) + fireworksLeft(now);

export function fireworksSkyMinutes(minutes) {
  const day = dayOf(minutes);
  for (const slot of fireworksSlots(day)) {
    const { gather, end } = windowOf(day, slot);
    const from = gather - FIREWORKS.dusk;
    const to = end + FIREWORKS.dusk;
    if (minutes < from || minutes >= to) continue;
    const shift = FIREWORKS.night - slot.start;
    const k = minutes < gather ? (minutes - from) / FIREWORKS.dusk : minutes >= end ? (to - minutes) / FIREWORKS.dusk : 1;
    return minutes + shift * k;
  }
  return minutes;
}

