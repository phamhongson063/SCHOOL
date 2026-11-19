export const RIPE = 6;
export const SPENT = 7;
export const BED_NEEDS = ['ripe', 'water', 'clear', 'empty'];

export const growing = (spot) => spot.stage > 0 && spot.stage < RIPE;
export const thirsty = (spot) => growing(spot) && !spot.watered && !spot.late;
export const needsCure = (spot) => growing(spot) && !thirsty(spot) && spot.missed > 0;

export function bedNeeds(spots, owner) {
  const needs = new Set();
  for (const spot of spots) {
    if (spot.stage === 0) needs.add('empty');
    else if (spot.stage === SPENT) needs.add('clear');
    else if (spot.owner !== owner) continue;
    else if (spot.stage === RIPE) needs.add('ripe');
    else if (thirsty(spot)) needs.add('water');
  }
  return BED_NEEDS.filter((need) => needs.has(need));
}
