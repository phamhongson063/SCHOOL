import { MONEY } from './config.js';

export const amount = (value) => Math.floor(value).toLocaleString('vi-VN');

export const coins = (value) => `${amount(value)} ${MONEY.icon}`;
