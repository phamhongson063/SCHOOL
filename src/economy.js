import { AWAY, ECONOMY, VILLAGER } from './config.js';
import { atGameTime, dayOf, gameMinutesOf, DAY_MINUTES } from './clock.js';
import { PLAYER } from './inventory.js';
import { createStore } from './persist.js';
import { holdWrites } from './seal.js';
import { worldKey } from './saveKeys.js';

const KEY = worldKey('economy');
const FUND = 'fund';
export const ARENA_POOL = 'arenaPool';
const CHECK_MS = 5000;
const SLICE_MS = 150;
const ONLINE_GAP = gameMinutesOf((CHECK_MS * 3) / 1000);

export const SHOPKEEPERS = [
  { id: 'keeper', name: 'Bà chủ tạp hoá' },
  { id: 'cook', name: 'Bà chủ quán' },
  { id: 'fishmonger', name: 'Chú hàng cá' },
  { id: 'grocer', name: 'Chị chủ siêu thị' },
  { id: 'chief', name: 'Ông Lý trưởng', role: 'chief' },
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
      };
    }
  } catch {}
  return { day: null, owed: {}, seeded: false, seen: null, observed: 0, flows: {} };
}

let ctx = null;
const state = load();
const store = createStore(KEY, () => state);

function pay(id, value) {
  const total = (state.owed[id] ?? 0) + value;
  const whole = Math.floor(total);
  state.owed[id] = total - whole;
  if (whole > 0) ctx.ledger.purse(id).earn(whole);
}

function payEarner(id, value) {
  const cut = value * ECONOMY.arenaCut;
  pay(ARENA_POOL, cut);
  pay(id, value - cut);
  return cut;
}

function charge(purse, value) {
  const taken = Math.min(Math.floor(value), purse.money);
  if (taken > 0 && purse.spend(taken)) pay(FUND, taken);
}

function workers() {
  return [...ctx.staff(), ...SHOPKEEPERS];
}

function flowOf(id) {
  if (!id || id === PLAYER || id === FUND || id === ARENA_POOL || workers().some((worker) => worker.id === id)) return null;
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

function payWages() {
  const fund = ctx.ledger.purse(FUND);
  for (const worker of workers()) {
    const wage = Math.min(ECONOMY.wages[worker.role] ?? 0, fund.money);
    if (wage > 0 && fund.spend(wage)) payEarner(worker.id, wage);
  }
}

function collectTaxes() {
  for (const id of ctx.people()) {
    const purse = ctx.ledger.purse(id);
    charge(purse, ECONOMY.pollTax);
    const house = ctx.estate.houseOf(id);
    if (house) charge(purse, Math.round(house.price * ECONOMY.houseTax));
  }
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

function settleDay() {
  payWages();
  collectTaxes();
  payLiving();
  sellDistressedHouses();
  manageSavings();
}

function settleThrough(t) {
  const today = dayOf(t);
  if (state.day === null) state.day = today;
  for (let day = state.day; day < today; day++) settleDay();
  state.day = today;
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
      store.save();
    }
    await update(progress);
    setInterval(() => update(), CHECK_MS);
  },
  income(seller, price, payer = null) {
    if (!ctx || !(price > 0)) return;
    const keep = price * (ECONOMY.keep[seller] ?? 0);
    const tax = price * ECONOMY.vat;
    const cut = payEarner(seller, keep);
    pay(FUND, tax);
    trackSpend(payer, price, { [seller]: keep - cut, [ARENA_POOL]: cut, [FUND]: tax });
    store.save();
  },
  collect(value, payer = null, spent = value) {
    if (!ctx || !(value > 0)) return;
    pay(FUND, value);
    trackSpend(payer, spent, { [FUND]: value });
    store.save();
  },
  withhold(gross, payee = null) {
    if (!ctx || !(gross > 0)) return gross;
    const tax = gross * ECONOMY.vat;
    const cut = (gross - tax) * ECONOMY.arenaCut;
    pay(FUND, tax);
    pay(ARENA_POOL, cut);
    trackEarn(payee, gross - tax - cut, tax + cut);
    store.save();
    return gross - tax - cut;
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
  payOut(value, purse) {
    if (!ctx || !(value > 0)) return false;
    if (!ctx.ledger.purse(FUND).spend(value)) return false;
    purse.earn(value);
    return true;
  },
  refund(seller, value) {
    if (!ctx || !(value > 0)) return;
    const purse = ctx.ledger.purse(seller);
    purse.spend(Math.min(purse.money, value));
  },
};
