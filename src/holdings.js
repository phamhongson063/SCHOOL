import { FARMING } from './config.js';

export const holesWanted = (money) => Math.min(FARMING.villagerHolesMax, FARMING.villagerHoles + Math.floor(Math.max(0, money) / FARMING.holesPerCoins));
