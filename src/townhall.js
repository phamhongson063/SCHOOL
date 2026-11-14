import { TOWNHALL } from './config.js';

export const INCOME_KINDS = ['vat', 'levy', 'poll', 'house', 'estate', 'land', 'arena'];
export const EXPENSE_KINDS = ['wage', 'blessing', 'arena', 'buyback'];

export function spreadPicks(count, total) {
  if (count >= total) return Array.from({ length: total }, (_, i) => i);
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) * total) / count - 0.5));
}

export function planDay({ fund, wages, windows, starts, blessingCost }) {
  const reserve = wages * TOWNHALL.reserveDays;
  const budget = Math.max(0, fund - reserve) * TOWNHALL.spend;
  const wanted = Math.floor((budget * TOWNHALL.blessingShare) / blessingCost);
  const count = Math.max(Math.min(TOWNHALL.blessingMin, windows), Math.min(windows, wanted));
  const blessingSpend = Math.min(fund, count * blessingCost);
  const arenaBudget = Math.max(0, budget - count * blessingCost);
  return {
    blessings: spreadPicks(count, windows),
    blessingSpend,
    arenaPrize: starts > 0 ? Math.floor(arenaBudget / starts) : 0,
    reserve,
    budget,
  };
}

export function bookDay(book, day) {
  book[day] ??= { in: {}, out: {} };
  return book[day];
}

export function record(book, day, side, kind, value) {
  if (!(value > 0)) return;
  const page = bookDay(book, day);
  page[side][kind] = (page[side][kind] ?? 0) + value;
}

export function pruneBook(book, today) {
  for (const key of Object.keys(book)) if (Number(key) <= today - TOWNHALL.history) delete book[key];
}

export function sumBook(book, fromDay, toDay) {
  const total = { in: {}, out: {} };
  for (let day = fromDay; day <= toDay; day++) {
    const page = book[day];
    if (!page) continue;
    for (const side of ['in', 'out']) {
      for (const [kind, value] of Object.entries(page[side])) total[side][kind] = (total[side][kind] ?? 0) + value;
    }
  }
  return total;
}

export const sideTotal = (side) => Object.values(side).reduce((sum, value) => sum + value, 0);
