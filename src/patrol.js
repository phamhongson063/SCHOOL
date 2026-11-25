import { GATES, GUARD, MOVE } from './config.js';
import { energyRate } from './stamina.js';

export function patrolXs() {
  const west = GATES.west + GUARD.gateInset;
  const east = GATES.east - GUARD.gateInset;
  const legs = Math.ceil((east - west) / GUARD.stride);
  return Array.from({ length: legs + 1 }, (_, i) => west + ((east - west) * i) / legs);
}

export function patrolNext({ stop, step }, count) {
  const turned = stop + step < 0 || stop + step >= count ? -step : step;
  return { stop: stop + turned, step: turned };
}

const walkSeconds = (xs) => (xs.length > 1 ? Math.abs(xs[1] - xs[0]) / MOVE.walk : 0);
const legMinutes = (xs) => (walkSeconds(xs) + GUARD.pause) / 60;

export function patrolEnergyRate(xs, night) {
  const walk = walkSeconds(xs);
  return (walk * energyRate('walk', night) + GUARD.pause * energyRate('idle', night)) / (walk + GUARD.pause);
}

export function advancePatrol(state, minutes, xs) {
  const leg = legMinutes(xs);
  let carry = (state.carry ?? 0) + minutes;
  let at = { stop: state.stop, step: state.step };
  let moved = false;
  while (carry >= leg) {
    carry -= leg;
    at = patrolNext(at, xs.length);
    moved = true;
  }
  return { ...at, carry, moved };
}
