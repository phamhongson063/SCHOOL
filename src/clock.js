import { TIME_SCALE, START } from './config.js';

const KEY = 'truong-lang-xua.clock';
export const DAY_MINUTES = 1440;

function startMinutes() {
  return START.day * DAY_MINUTES + START.minute;
}

function load() {
  const now = Date.now();
  let origin = null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Number.isFinite(saved.real) && Number.isFinite(saved.game) && Number.isFinite(saved.scale)) origin = saved;
  } catch {}
  if (origin && origin.scale !== TIME_SCALE) {
    const game = origin.game + ((now - origin.real) / 60000) * origin.scale;
    origin = { real: now, game, scale: TIME_SCALE };
    save(origin);
  }
  if (!origin) {
    origin = { real: now, game: startMinutes(), scale: TIME_SCALE };
    save(origin);
  }
  return origin;
}

function save(origin) {
  try {
    localStorage.setItem(KEY, JSON.stringify(origin));
  } catch {}
}

const origin = load();

export function gameNow(real = Date.now()) {
  return origin.game + ((real - origin.real) / 60000) * TIME_SCALE;
}

export const dayOf = (minutes) => Math.floor(minutes / DAY_MINUTES);

export const minuteOfDay = (minutes) => ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

export const realSeconds = (gameMinutes) => (gameMinutes * 60) / TIME_SCALE;

export const gameMinutesOf = (realSecondsSpan) => (realSecondsSpan * TIME_SCALE) / 60;

const pad = (n) => String(n).padStart(2, '0');

export function clockText(minutes) {
  const m = Math.floor(minuteOfDay(minutes));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

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
