import { BLESSING, CERTIFY } from './config.js';

export function blessingScore(correct, wrong) {
  return Math.max(0, correct - wrong * BLESSING.wrongCost);
}

export function blessingAskScore(odds) {
  return Math.max(0, odds - (1 - odds) * BLESSING.wrongCost);
}

export function blessingReward(score, carry = null) {
  const coinUnits = (carry?.coin ?? 0) + score;
  const intellectUnits = (carry?.intellect ?? 0) + score;
  const money = Math.floor(coinUnits / CERTIFY.blessingCoinPer);
  const intellect = Math.floor(intellectUnits / CERTIFY.blessingIntellectPer);
  return {
    money,
    intellect,
    carry: { coin: coinUnits - money * CERTIFY.blessingCoinPer, intellect: intellectUnits - intellect * CERTIFY.blessingIntellectPer },
  };
}

export function sessionShare(pool, slots, index) {
  const left = Math.max(1, slots.filter((slot) => slot.index >= index).length);
  return Math.floor(pool / left);
}

export function parseSession(session) {
  const [day, index] = String(session).split(':').map(Number);
  return Number.isInteger(day) && Number.isInteger(index) ? { day, index } : null;
}
