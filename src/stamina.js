import { ENERGY, LODGING, ROUTINE } from './config.js';
import { DAY_MINUTES, minuteOfDay } from './clock.js';

export const OFFLINE_GAP = 5;

export function isNight(minutes) {
  const m = minuteOfDay(minutes);
  return m >= ROUTINE.home || m < ROUTINE.wake;
}

export function energyRate(activity, night) {
  if (activity === 'sleep') return -ENERGY.sleepPerHour;
  if (activity === 'rest') return -ENERGY.restPerHour;
  if (activity === 'inn') return -LODGING.perHour;
  const base = ENERGY.drain[activity] ?? ENERGY.drain.idle;
  return night ? base * ENERGY.nightFactor : base;
}

export function nextShift(minutes) {
  const m = minuteOfDay(minutes);
  const base = minutes - m;
  if (m < ROUTINE.wake) return base + ROUTINE.wake;
  if (m < ROUTINE.home) return base + ROUTINE.home;
  return base + DAY_MINUTES + ROUTINE.wake;
}

export function activityOf(speed, walk, run) {
  if (speed >= (walk + run) / 2) return 'run';
  if (speed > 0.2) return 'walk';
  return 'idle';
}
