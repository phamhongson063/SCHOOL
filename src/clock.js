import { TIME_ZONE_MINUTES } from './config.js';

export const DAY_MINUTES = 1440;

let frozen = null;

export function gameNow(real) {
  if (real === undefined && frozen !== null) return frozen;
  return (real ?? Date.now()) / 60000 + TIME_ZONE_MINUTES;
}

export function atGameTime(minutes, run) {
  const before = frozen;
  frozen = minutes;
  try {
    return run();
  } finally {
    frozen = before;
  }
}

export const dayOf = (minutes) => Math.floor(minutes / DAY_MINUTES);

export const minuteOfDay = (minutes) => ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

export const realSeconds = (gameMinutes) => gameMinutes * 60;

export const gameMinutesOf = (realSecondsSpan) => realSecondsSpan / 60;

const pad = (n) => String(n).padStart(2, '0');

export function clockText(minutes) {
  const m = Math.floor(minuteOfDay(minutes));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function isOpenAt(hours, minutes) {
  const t = minuteOfDay(minutes);
  return hours.open < hours.close ? t >= hours.open && t < hours.close : t >= hours.open || t < hours.close;
}

export function dateText(minutes) {
  const date = new Date(Math.floor(minutes) * 60000);
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

export const hoursText = (hours) => `${clockText(hours.open)}–${clockText(hours.close)}`;

export function countdownText(minutes) {
  const total = Math.max(1, Math.ceil(minutes));
  const days = Math.floor(total / DAY_MINUTES);
  const hours = Math.floor((total % DAY_MINUTES) / 60);
  const mins = total % 60;
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

export function durationText(minutes) {
  const total = Math.max(1, Math.ceil(minutes));
  const days = Math.floor(total / DAY_MINUTES);
  const hours = Math.floor((total % DAY_MINUTES) / 60);
  const mins = total % 60;
  if (days > 0) return hours ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return mins ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  return `${mins} phút`;
}
