import { SCHOOL } from './config.js';
import { makeRandom } from './random.js';
import { dayOf, minuteOfDay, DAY_MINUTES, gameMinutesOf } from './clock.js';

const cache = new Map();

export function planFor(day) {
  const rand = makeRandom(day * 7919 + 13);
  rand();
  return SCHOOL.plans[Math.floor(rand() * SCHOOL.plans.length)];
}

export function scheduleFor(day) {
  if (cache.has(day)) return cache.get(day);
  const plan = planFor(day);
  const segments = [];
  let period = 0;
  const session = (start, count) => {
    let t = start;
    for (let i = 0; i < count; i++) {
      period += 1;
      segments.push({ kind: 'period', period, start: t, end: t + SCHOOL.period });
      t += SCHOOL.period;
      if (i === count - 1) break;
      const recess = (i + 1) % 2 === 0;
      const length = recess ? SCHOOL.recess : SCHOOL.rest;
      segments.push({ kind: recess ? 'recess' : 'rest', start: t, end: t + length });
      t += length;
    }
  };
  session(SCHOOL.morning, plan.morning);
  session(SCHOOL.afternoon, plan.afternoon);
  const schedule = { day, plan, periods: period, segments };
  cache.set(day, schedule);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return schedule;
}

export const payWindow = () => gameMinutesOf(SCHOOL.payWindowSeconds);

export function phaseAt(minutes) {
  const day = dayOf(minutes);
  const t = minuteOfDay(minutes);
  const schedule = scheduleFor(day);
  const base = day * DAY_MINUTES;
  for (const seg of schedule.segments) {
    if (t < seg.start || t >= seg.end) continue;
    const key = `${day}:${seg.kind}:${seg.start}`;
    const paying = seg.kind === 'period' && t - seg.start < payWindow();
    return { ...seg, key, day, schedule, paying, startAt: base + seg.start, endAt: base + seg.end, remaining: seg.end - t };
  }
  const next = schedule.segments.find((seg) => seg.kind === 'period' && seg.start > t) ?? null;
  const done = !next;
  const key = `${day}:free:${next?.start ?? 'end'}`;
  return {
    kind: 'free',
    key,
    day,
    schedule,
    paying: false,
    done,
    next,
    startAt: next ? base + next.start : null,
    remaining: next ? next.start - t : null,
  };
}

export function sessionLabel(plan) {
  const parts = [];
  if (plan.morning) parts.push(`sáng ${plan.morning} tiết`);
  if (plan.afternoon) parts.push(`chiều ${plan.afternoon} tiết`);
  return parts.join(' · ');
}
