import { ECONOMY, VILLAGER } from './config.js';
import { dayOf } from './clock.js';
import { PLAYER } from './inventory.js';
import { createStore } from './persist.js';

const KEY = 'truong-lang-xua.economy';
const FUND = 'fund';
const CHECK_MS = 5000;

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
      };
    }
  } catch {}
  return { day: null, owed: {}, seeded: false };
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

function charge(purse, value) {
  const taken = Math.min(Math.floor(value), purse.money);
  if (taken > 0 && purse.spend(taken)) pay(FUND, taken);
}

function workers() {
  return [...ctx.staff(), ...SHOPKEEPERS];
}


function payWages() {
  const fund = ctx.ledger.purse(FUND);
  for (const worker of workers()) {
    const wage = Math.min(ECONOMY.wages[worker.role] ?? 0, fund.money);
    if (wage > 0 && fund.spend(wage)) ctx.ledger.purse(worker.id).earn(wage);
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

function update() {
  const today = dayOf(ctx.now());
  if (state.day === null) state.day = today;
  const from = Math.max(state.day, today - ECONOMY.catchUpDays);
  for (let day = from; day < today; day++) settleDay();
  if (state.day !== today) {
    state.day = today;
    store.save();
  }
}

export const economy = {
  start({ ledger, bank, estate, staff, people, now }) {
    ctx = { ledger, bank, estate, staff, people, now };
    if (!state.seeded) {
      state.seeded = true;
      pay(FUND, ECONOMY.fundSeed);
      store.save();
    }
    update();
    setInterval(update, CHECK_MS);
  },
  income(seller, price) {
    if (!ctx || !(price > 0)) return;
    pay(seller, price * (ECONOMY.keep[seller] ?? 0));
    pay(FUND, price * ECONOMY.vat);
    store.save();
  },
  collect(value) {
    if (!ctx || !(value > 0)) return;
    pay(FUND, value);
    store.save();
  },
  withhold(gross) {
    if (!ctx || !(gross > 0)) return gross;
    const tax = gross * ECONOMY.vat;
    pay(FUND, tax);
    store.save();
    return gross - tax;
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
