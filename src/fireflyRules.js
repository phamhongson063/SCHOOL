import { ENERGY, FIREFLY } from './config.js';
import { OFFLINE_GAP } from './stamina.js';

export const LAMP_SAVING = (ENERGY.drain.study * (ENERGY.nightFactor - 1) * FIREFLY.lampMinutesPerFly) / 60;

export const passingCatch = (seconds, speed, density) => seconds * speed * 2 * FIREFLY.catchRadius * density;

export const nearestFlyGap = (density) => (density > 0 ? 0.5 / Math.sqrt(density) : Infinity);

export function createLampBurner() {
  let left = 0;
  let at = null;
  const ignite = (purse) => {
    if (left > 0 || !purse.take('firefly', 1)) return;
    left = FIREFLY.lampMinutesPerFly;
  };
  const spend = (purse, minutes) => {
    let rest = minutes;
    while (rest > 0) {
      ignite(purse);
      if (left <= 0) return;
      const used = Math.min(left, rest);
      left -= used;
      rest -= used;
    }
    ignite(purse);
  };
  return {
    lit(night, atStudySeat, flies) {
      return night && atStudySeat && (left > 0 || flies >= FIREFLY.lampMin);
    },
    spend,
    tick(lit, now, purse) {
      if (lit && at !== null && now > at && now - at <= OFFLINE_GAP) spend(purse, now - at);
      else if (lit) ignite(purse);
      at = lit ? now : null;
    },
  };
}
