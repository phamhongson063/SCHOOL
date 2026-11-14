import { ARENA, AWAY, BLESSING, ECONOMY, VILLAGER } from './config.js';
import { atGameTime, dayOf, gameMinutesOf, gameNow, DAY_MINUTES } from './clock.js';
import { PLAYER } from './inventory.js';
import { createStore } from './persist.js';
import { holdWrites } from './seal.js';
import { worldKey } from './saveKeys.js';
import { planDay, pruneBook, record, sumBook } from './townhall.js';

const KEY = worldKey('economy');
const FUND = 'fund';
const ARENA_POOL = 'arenaPool';
const CHECK_MS = 5000;
const SLICE_MS = 150;
const ONLINE_GAP = gameMinutesOf((CHECK_MS * 3) / 1000);

export const SHOPKEEPERS = [
  { id: 'keeper', name: 'Yoshiko' },
  { id: 'cook', name: 'Meiling' },
  { id: 'fishmonger', name: 'Bobby' },
  { id: 'grocer', name: 'Jessica' },
  { id: 'chief', name: 'Youngsoo', role: 'chief' },
  { id: 'mayor', name: 'Haruto', role: 'mayor' },
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      return {
        day: Number.isFinite(saved.day) ? saved.day : null,
        owed: saved.owed && typeof saved.owed === 'object' ? saved.owed : {},
        seeded: saved.seeded === true,
        seen: Number.isFinite(saved.seen) ? saved.seen : null,
        observed: Number.isFinite(saved.observed) ? saved.observed : 0,
        flows: saved.flows && typeof saved.flows === 'object' ? saved.flows : {},
        book: saved.book && typeof saved.book === 'object' ? saved.book : {},
        plans: saved.plans && typeof saved.plans === 'object' ? saved.plans : {},
      };
    }
  } catch {}
  return { day: null, owed: {}, seeded: false, seen: null, observed: 0, flows: {}, book: {}, plans: {} };
}

let ctx = null;
const state = load();
const store = createStore(KEY, () => state);

function settle(id, value) {
  const total = (state.owed[id] ?? 0) + value;
  const whole = Math.floor(total);
  state.owed[id] = total - whole;
  return whole;
}

function pay(id, value) {
  const whole = settle(id, value);
  if (whole > 0) ctx.ledger.purse(id).earn(whole);
}

const today = () => dayOf(gameNow());

function deposit(value, kind) {
  if (!(value > 0)) return;
  pay(FUND, value);
  record(state.book, today(), 'in', kind, value);
}

function withdraw(value, kind) {
  const amount = Math.min(Math.floor(value), ctx.ledger.purse(FUND).money);
  if (!(amount > 0) || !ctx.ledger.purse(FUND).spend(amount)) return 0;
  record(state.book, today(), 'out', kind, amount);
  return amount;
}

function payEarner(id, value) {
  const cut = value * ECONOMY.incomeTax;
  deposit(cut, 'levy');
  pay(id, value - cut);
  return cut;
}

function charge(purse, value, kind) {
  const taken = Math.min(Math.floor(value), purse.money);
  if (taken > 0 && purse.spend(taken)) deposit(taken, kind);
}

function workers() {
  return [...ctx.staff(), ...SHOPKEEPERS];
}

function flowOf(id) {
  if (!id || id === PLAYER || id === FUND || workers().some((worker) => worker.id === id)) return null;
  state.flows[id] ??= { earn: 0, tax: 0, spent: 0, to: {} };
  return state.flows[id];
}

function trackSpend(payer, total, shares) {
  const flow = flowOf(payer);
  if (!flow) return;
  flow.spent += total;
  for (const [recipient, amount] of Object.entries(shares)) flow.to[recipient] = (flow.to[recipient] ?? 0) + amount;
}

function trackEarn(payee, net, tax = 0) {
  const flow = flowOf(payee);
  if (!flow) return;
  flow.earn += net;
  flow.tax += tax;
}

function observe(minutes) {
  state.observed += minutes;
  const window = ECONOMY.offline.sampleDays * DAY_MINUTES;
  if (state.observed <= window) return;
  const keep = window / state.observed;
  state.observed = window;
  for (const flow of Object.values(state.flows)) {
    flow.earn *= keep;
    flow.tax *= keep;
    flow.spent *= keep;
    for (const recipient of Object.keys(flow.to)) flow.to[recipient] *= keep;
  }
}

const dailyWages = () => workers().reduce((sum, worker) => sum + (ECONOMY.wages[worker.role] ?? 0), 0);

function payWages() {
  for (const worker of workers()) {
    const wage = withdraw(ECONOMY.wages[worker.role] ?? 0, 'wage');
    if (wage > 0) payEarner(worker.id, wage);
  }
}

function collectTaxes() {
  for (const id of ctx.people()) {
    const purse = ctx.ledger.purse(id);
    charge(purse, ECONOMY.pollTax, 'poll');
    const house = ctx.estate.houseOf(id);
    if (house) charge(purse, Math.round(house.price * ECONOMY.houseTax), 'house');
  }
}

function planFor(day) {
  const plan = planDay({
    fund: ctx.ledger.purse(FUND).money,
    wages: dailyWages(),
    windows: BLESSING.windows.length,
    starts: ARENA.starts.length,
    blessingCost: BLESSING.cost,
  });
  withdraw(plan.blessingSpend, 'blessing');
  state.plans[day] = { blessings: plan.blessings, arenaPrize: plan.arenaPrize, reserve: plan.reserve };
  for (const key of Object.keys(state.plans)) if (Number(key) < day - 1) delete state.plans[key];
  pruneBook(state.book, day);
}

function latestPlan() {
  const days = Object.keys(state.plans).map(Number);
  return days.length ? state.plans[Math.max(...days)] : null;
}

const planOf = (day) => state.plans[day] ?? latestPlan();

export function blessingSlots(day) {
  const picks = planOf(day)?.blessings ?? BLESSING.windows.map((_, index) => index);
  return picks.map((index) => ({ index, start: BLESSING.windows[index][0], end: BLESSING.windows[index][1] }));
}

function payLiving() {
  for (const keeper of SHOPKEEPERS) {
    const purse = ctx.ledger.purse(keeper.id);
    const cost = Math.min(ECONOMY.living, purse.money);
    if (cost > 0 && purse.spend(cost)) economy.income(keeper.id === 'cook' ? 'vendor' : 'cook', cost);
  }
}

function sellDistressedHouses() {
  for (const id of ctx.people()) {
    if (id === PLAYER || !ctx.estate.houseOf(id) || !ctx.bank.overdue(id)) continue;
    const purse = ctx.ledger.purse(id);
    if (purse.money < ctx.bank.debt(id)) ctx.estate.sellBack(id, purse);
  }
}

function manageSavings() {
  for (const worker of workers()) {
    const purse = ctx.ledger.purse(worker.id);
    if (!ctx.estate.houseOf(worker.id)) ctx.estate.buyFor(worker.id, purse, VILLAGER.houseReserve);
    const client = { id: worker.id, purse, thrift: ECONOMY.thrift, roll: Math.random() };
    const plan = ctx.bank.npcPlan(client);
    if (plan && plan.kind !== 'borrow') ctx.bank.npcServe(client);
  }
}

function settleDay(day) {
  payWages();
  collectTaxes();
  payLiving();
  sellDistressedHouses();
  manageSavings();
  planFor(day);
}

function settleThrough(t) {
  const now = dayOf(t);
  if (state.day === null) state.day = now;
  for (let day = state.day; day < now; day++) settleDay(day + 1);
  state.day = now;
  if (!state.plans[now]) planFor(now);
}

function mergeArenaPool() {
  const pool = ctx.ledger.purse(ARENA_POOL);
  const money = pool.money;
  if (money > 0 && pool.spend(money)) ctx.ledger.purse(FUND).earn(money);
  delete state.owed[ARENA_POOL];
}

function stepAway(t, to) {
  const end = Math.min(to, t + AWAY.step, (dayOf(t) + 1) * DAY_MINUTES);
  atGameTime(t, () => {
    settleThrough(t);
    ctx.away.step(t, end);
  });
  observe(end - t);
  return end;
}

const pause = () => new Promise((resolve) => setTimeout(resolve));

let catching = false;

async function catchUp(from, to, progress) {
  catching = true;
  try {
    let t = from;
    while (t < to) {
      const until = performance.now() + SLICE_MS;
      holdWrites(() =>
        ctx.away.during(() => {
          while (t < to && performance.now() < until) t = stepAway(t, to);
        }),
      );
      state.seen = t;
      store.save();
      if (t < to) await (progress ? progress((t - from) / (to - from)) : pause());
    }
  } finally {
    catching = false;
  }
}

async function update(progress = null) {
  if (catching) return;
  const t = ctx.now();
  const gap = state.seen === null ? 0 : t - state.seen;
  if (gap > ONLINE_GAP || (gap > 0 && document.hidden)) await catchUp(state.seen, t, progress);
  else if (gap > 0) observe(gap);
  settleThrough(t);
  state.seen = t;
  store.save();
}

export const economy = {
  get catching() {
    return catching;
  },
  async start({ ledger, bank, estate, staff, people, now, away, progress = null }) {
    ctx = { ledger, bank, estate, staff, people, now, away };
    if (!state.seeded) {
      state.seeded = true;
      pay(FUND, ECONOMY.fundSeed);
    }
    mergeArenaPool();
    store.save();
    await update(progress);
    setInterval(() => update(), CHECK_MS);
  },
  income(seller, price, payer = null) {
    if (!ctx || !(price > 0)) return;
    const keep = price * (ECONOMY.keep[seller] ?? 0);
    const tax = price * ECONOMY.vat;
    const cut = payEarner(seller, keep);
    deposit(tax, 'vat');
    trackSpend(payer, price, { [seller]: keep - cut, [FUND]: tax + cut });
    store.save();
  },
  collect(value, payer = null, spent = value, kind = 'vat') {
    if (!ctx || !(value > 0)) return;
    deposit(value, kind);
    trackSpend(payer, spent, { [FUND]: value });
    store.save();
  },
  sale(purse, gross) {
    if (!(gross > 0)) return 0;
    if (!ctx) {
      const whole = Math.floor(gross);
      purse.earn(whole);
      return whole;
    }
    const tax = gross * ECONOMY.vat;
    const cut = (gross - tax) * ECONOMY.incomeTax;
    const net = gross - tax - cut;
    deposit(tax, 'vat');
    deposit(cut, 'levy');
    const whole = settle(purse.id, net);
    if (whole > 0) purse.earn(whole);
    trackEarn(purse.id, net, tax + cut);
    store.save();
    return whole;
  },
  dailyFlow(id) {
    const flow = state.flows[id];
    if (!flow || state.observed < ECONOMY.offline.minSample) return null;
    const scale = DAY_MINUTES / state.observed;
    return { earn: flow.earn * scale, spent: flow.spent * scale };
  },
  reward(purse, amount) {
    purse.earn(amount);
    if (ctx) trackEarn(purse.id, amount);
  },
  payOut(value, purse, kind = 'buyback') {
    if (!ctx || !(value > 0) || ctx.ledger.purse(FUND).money < value) return false;
    if (!withdraw(value, kind)) return false;
    purse.earn(value);
    store.save();
    return true;
  },
  arenaPrize(at = gameNow()) {
    return planOf(dayOf(at))?.arenaPrize ?? 0;
  },
  sponsorArena(at) {
    if (!ctx) return 0;
    const paid = withdraw(economy.arenaPrize(at), 'arena');
    if (paid > 0) store.save();
    return paid;
  },
  get treasury() {
    return ctx ? ctx.ledger.purse(FUND).money : 0;
  },
  reserve(day = today()) {
    return planOf(day)?.reserve ?? 0;
  },
  book(fromDay, toDay = fromDay) {
    return sumBook(state.book, fromDay, toDay);
  },
  refund(seller, value) {
    if (!ctx || !(value > 0)) return;
    const purse = ctx.ledger.purse(seller);
    purse.spend(Math.min(purse.money, value));
  },
};
