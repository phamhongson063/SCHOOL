import { FATE } from './config.js';

export const fate = {
  roll(day, rand = Math.random) {
    if (!Number.isInteger(day) || rand() >= FATE.sick) return null;
    return { kind: 'sick', energy: FATE.sickEnergy, cost: FATE.medicine };
  },
};
