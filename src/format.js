import { MONEY } from './config.js';

export const amount = (value) => Math.floor(value).toLocaleString('vi-VN');

export const fineAmount = (value) => (Math.round(value * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

export const coins = (value) => `${amount(value)} ${MONEY.icon}`;

export const LETTERS = ['A', 'B', 'C', 'D'];

const MEDALS = ['🥇', '🥈', '🥉'];

export const placeText = (rank) => MEDALS[rank - 1] ?? String(rank);

export const notEnough = (value) => `Không đủ tiền! Cần ${coins(value)}.`;
