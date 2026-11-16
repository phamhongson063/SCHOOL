import { ENERGY, FARMING, MOVE } from './config.js';

export const vigorAt = (missed) => Math.max(FARMING.minVigor, 1 - FARMING.missPenalty * Math.max(0, missed));

export function cropWorth(action, { fruits, price, missed }) {
  if (action === 'harvest') return Math.max(1, Math.round(fruits * vigorAt(missed))) * price;
  if (action === 'water') return fruits * price * (vigorAt(missed) - vigorAt(missed + 1));
  if (action === 'fertilize') return fruits * price * (vigorAt(missed - 1) - vigorAt(missed));
  return null;
}

export function affordableJobs(jobs, energy) {
  const picked = [];
  let left = energy;
  for (const job of jobs) {
    const cost = ENERGY.costs[job.action] ?? 0;
    if (cost > left) continue;
    left -= cost;
    picked.push(job);
  }
  return picked;
}

const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function tripMinutes(from, stops, workSeconds) {
  const left = [...stops];
  let at = from;
  let meters = 0;
  while (left.length) {
    let next = 0;
    for (let i = 1; i < left.length; i++) if (gap(left[i], at) < gap(left[next], at)) next = i;
    meters += gap(left[next], at);
    at = left.splice(next, 1)[0];
  }
  return meters / MOVE.walk / 60 + (stops.length * workSeconds) / 60;
}
