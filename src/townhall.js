import { TOWNHALL } from './config.js';

export const INCOME_KINDS = ['vat', 'levy', 'market', 'poll', 'house', 'estate', 'land', 'lodge', 'arenaFee', 'blessing', 'lantern', 'capital'];
export const EXPENSE_KINDS = ['wage', 'blessing', 'lantern', 'arena', 'buyback', 'capital'];

export function planDay({ fund, wages, starts }) {
  const reserve = wages * TOWNHALL.reserveDays;
  const budget = Math.max(0, fund - reserve) * TOWNHALL.spend;
  const blessingPool = Math.max(0, Math.min(fund, Math.floor(budget * TOWNHALL.blessingShare)));
  const lanternBudget = Math.floor(budget * TOWNHALL.lanternShare);
  const arenaBudget = Math.floor(budget * TOWNHALL.arenaShare);
  return {
    blessingPool,
    lanternBudget,
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

export function foldArenaSurplus(book) {
  for (const page of Object.values(book)) {
    const surplus = page?.in?.arena;
    if (surplus === undefined) continue;
    delete page.in.arena;
    const spent = (page.out?.arena ?? 0) - surplus;
    if (spent > 0) page.out.arena = spent;
    else if (page.out) delete page.out.arena;
  }
  return book;
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
