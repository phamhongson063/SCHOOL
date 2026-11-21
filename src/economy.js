import { ARENA, AWAY, BLESSING, ECONOMY, ENERGY_PRICE, QUEST, STIPEND, VILLAGER } from './config.js';
import { atGameTime, dayOf, gameMinutesOf, gameNow, DAY_MINUTES } from './clock.js';
import { PLAYER } from './inventory.js';
import { createStore } from './persist.js';
import { holdWrites } from './seal.js';
import { worldKey } from './saveKeys.js';
import { foldArenaSurplus, planDay, pruneBook, record, sumBook } from './townhall.js';
import { blessingReward, parseSession, sessionShare } from './blessingRules.js';
import { LEGACY_NPC_IDS, NPC } from './npcIds.js';
import { trade } from './trade.js';
import { certify } from './certify.js';
import { traits } from './traits.js';
import { fate } from './fate.js';
import { census } from './census.js';
import { weekOf } from './quests.js';

const KEY = worldKey('economy');
const FUND = 'fund';
const ARENA_POOL = 'arenaPool';
const CHECK_MS = 5000;
const SLICE_MS = 150;
const ONLINE_GAP = gameMinutesOf((CHECK_MS * 3) / 1000);
const ROLE_OF = new Map([...LEGACY_NPC_IDS].map(([role, id]) => [id, role]));

export const SHOPKEEPERS = [
  { id: NPC.keeper, name: 'Yoshiko' },
  { id: NPC.cook, name: 'Meiling' },
  { id: NPC.fishmonger, name: 'Bobby' },
  { id: NPC.grocer, name: 'Jessica' },
  { id: NPC.chief, name: 'Youngsoo', role: 'chief' },
  { id: NPC.mayor, name: 'Haruto', role: 'mayor' },
];

const QUEST_POOL = { day: { pool: 'dayPool', reward: 'dayReward' }, week: { pool: 'weekPool', reward: 'weekReward' } };

function cleanQuest(raw) {
  const quest = { day: null, week: null, dayPool: 0, dayReward: 0, weekPool: 0, weekReward: 0 };
  if (!raw || typeof raw !== 'object') return quest;
  for (const key of ['day', 'week']) if (Number.isInteger(raw[key])) quest[key] = raw[key];
  for (const key of ['dayPool', 'dayReward', 'weekPool', 'weekReward']) if (Number.isFinite(raw[key]) && raw[key] > 0) quest[key] = raw[key];
  return quest;
}

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
        book: saved.book && typeof saved.book === 'object' ? foldArenaSurplus(saved.book) : {},
        plans: saved.plans && typeof saved.plans === 'object' ? saved.plans : {},
        blessingPool: Number.isFinite(saved.blessingPool) ? saved.blessingPool : 0,
        blessingCaps: saved.blessingCaps && typeof saved.blessingCaps === 'object' ? saved.blessingCaps : {},
        blessingJoins: saved.blessingJoins && typeof saved.blessingJoins === 'object' ? saved.blessingJoins : {},
        blessingCarry: saved.blessingCarry && typeof saved.blessingCarry === 'object' ? saved.blessingCarry : {},
        tuition: Number.isFinite(saved.tuition) ? saved.tuition : 0,
        lanternPaid: Number.isFinite(saved.lanternPaid?.day) && Number.isFinite(saved.lanternPaid?.paid) ? saved.lanternPaid : { day: null, paid: 0 },
        quest: cleanQuest(saved.quest),
      };
    }
  } catch {}
  return { day: null, owed: {}, seeded: false, seen: null, observed: 0, flows: {}, book: {}, plans: {}, blessingPool: 0, blessingCaps: {}, blessingJoins: {}, blessingCarry: {}, tuition: 0, lanternPaid: { day: null, paid: 0 }, quest: cleanQuest(null) };
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

function takeFund(value) {
  const fund = ctx.ledger.purse(FUND);
  const amount = Math.min(Math.floor(value), fund.money);
  if (!(amount > 0) || !fund.spend(amount)) return 0;
  return amount;
}

function withdraw(value, kind) {
  const amount = takeFund(value);
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

function closeBlessingPool() {
  const left = Math.max(0, state.blessingPool);
  state.blessingPool = 0;
  state.blessingCaps = {};
  state.blessingJoins = {};
  if (left > 0) ctx.ledger.purse(FUND).earn(left);
}

function shareOf(session) {
  const at = parseSession(session);
  return at ? sessionShare(Math.max(0, state.blessingPool), blessingSlots(at.day), at.index) : 0;
}

function capOf(session) {
  state.blessingCaps[session] ??= { cap: shareOf(session), paid: 0 };
  return state.blessingCaps[session];
}

const joinsOf = (session) => state.blessingJoins[session] ?? [];

function headShare(session, extra = 0) {
  const cap = capOf(session);
  const left = Math.max(0, Math.min(cap.cap - cap.paid, Math.floor(state.blessingPool)));
  const waiting = Math.max(1, joinsOf(session).length - (cap.payers ?? 0) + extra);
  return Math.floor(left / waiting);
}

function grantBlessing(session, value) {
  const share = headShare(session);
  const cap = capOf(session);
  cap.payers = (cap.payers ?? 0) + 1;
  const paid = Math.min(Math.floor(value), share);
  if (!(paid > 0)) return 0;
  cap.paid += paid;
  state.blessingPool -= paid;
  record(state.book, today(), 'out', 'blessing', paid);
  return paid;
}

function openBlessingPool(value) {
  const amount = takeFund(value);
  if (amount > 0) state.blessingPool = amount;
  return amount;
}

const draftPlan = () =>
  planDay({
    fund: ctx.ledger.purse(FUND).money,
    wages: dailyWages(),
    starts: ARENA.starts.length,
  });

function refundQuest(key) {
  const left = Math.floor(state.quest[key]);
  state.quest[key] = 0;
  if (left > 0) ctx.ledger.purse(FUND).earn(left);
}

function closeQuests(day) {
  refundQuest('dayPool');
  if (state.quest.week !== weekOf(day)) refundQuest('weekPool');
}

function openQuests(day, budget) {
  const quest = state.quest;
  const takers = villagers().length + 1;
  const weekSlots = (QUEST.week.count * QUEST.week.weight) / 7;
  const amount = takeFund(budget);
  const weekPart = Math.floor((amount * weekSlots) / (QUEST.day.count + weekSlots));
  const dayPart = amount - weekPart;
  const week = weekOf(day);
  if (quest.week !== week) {
    quest.week = week;
    quest.weekReward = Math.floor((weekPart * 7) / (takers * QUEST.week.count));
  }
  quest.weekPool += weekPart;
  quest.day = day;
  quest.dayPool = dayPart;
  quest.dayReward = Math.floor(dayPart / (takers * QUEST.day.count));
}

function planFor(day) {
  closeBlessingPool();
  closeQuests(day);
  const plan = draftPlan();
  const blessingPool = openBlessingPool(plan.blessingPool);
  openQuests(day, plan.questBudget);
  state.plans[day] = { arenaPrize: plan.arenaPrize, lanternBudget: plan.lanternBudget, questBudget: plan.questBudget, lotoBudget: plan.lotoBudget, reserve: plan.reserve, blessingPool };
  for (const key of Object.keys(state.plans)) if (Number(key) < day - 1) delete state.plans[key];
  pruneBook(state.book, day);
}

function latestPlan() {
  const days = Object.keys(state.plans).map(Number);
  return days.length ? state.plans[Math.max(...days)] : null;
}

const planOf = (day) => state.plans[day] ?? latestPlan();

export function blessingSlots() {
  return BLESSING.windows.map(([start, end], index) => ({ index, start, end }));
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
    if (!ctx.estate.houseOf(worker.id)) ctx.estate.buyFor(worker.id, purse, Math.max(VILLAGER.houseReserve, trade.reserveOf(worker.id) ?? 0));
    const merchant = trade.isMerchant(worker.id);
    const client = { id: worker.id, purse, thrift: ECONOMY.thrift, roll: Math.random(), keep: trade.reserveOf(worker.id), income: trade.incomeOf(worker.id) };
    const plan = ctx.bank.npcPlan(client);
    if (plan && plan.kind !== (merchant ? 'deposit' : 'borrow')) ctx.bank.npcServe(client);
  }
}

const villagers = () => (ctx.villagers ? ctx.villagers() : []);

function payStipends() {
  const teacher = ctx.ledger.purse(NPC.teacher);
  const pot = Math.min(teacher.money, Math.floor(state.tuition * STIPEND.share));
  state.tuition = 0;
  if (!(pot > 0)) return;
  const scholars = villagers()
    .map((id) => ({ id, certs: certify.certifiedTotal(id) }))
    .filter((row) => row.certs >= STIPEND.minCerts)
    .sort((a, b) => b.certs - a.certs)
    .slice(0, STIPEND.top);
  const each = scholars.length ? Math.floor(pot / scholars.length) : 0;
  if (!(each > 0) || !teacher.spend(each * scholars.length)) return;
  for (const { id } of scholars) {
    ctx.ledger.purse(id).earn(each);
    trackEarn(id, each);
  }
}

function strikeShocks(day) {
  for (const id of villagers()) {
    const hit = fate.roll(day);
    if (!hit) continue;
    const purse = ctx.ledger.purse(id);
    purse.shiftEnergy(Math.min(0, hit.energy - purse.energy));
    if (purse.spend(hit.cost)) economy.retail(NPC.grocer, hit.cost, 0, id);
    traits.note(id, 'tired', day);
  }
}

function worthOf(id) {
  return Math.floor(ctx.ledger.purse(id).money) + ctx.bank.deposited(id) - ctx.bank.debt(id) - Math.ceil(trade.debtOf(id)) + (ctx.estate.houseOf(id)?.price ?? 0);
}

function supplyOf() {
  return ctx.people().reduce((sum, id) => sum + Math.floor(ctx.ledger.purse(id).money) + ctx.bank.deposited(id) - ctx.bank.debt(id), 0);
}

function takeCensus(day) {
  const worth = Object.fromEntries(villagers().map((id) => [id, worthOf(id)]));
  census.record(day, worth, supplyOf(), ctx.ledger.purse(FUND).money);
}

function settleDay(day) {
  payWages();
  payStipends();
  collectTaxes();
  strikeShocks(day);
  trade.meals(SHOPKEEPERS.map((keeper) => keeper.id));
  trade.daily();
  sellDistressedHouses();
  manageSavings();
  planFor(day);
  takeCensus(day);
}

function settleThrough(t) {
  const now = dayOf(t);
  if (state.day === null) state.day = now;
  for (let day = state.day; day < now; day++) settleDay(day + 1);
  state.day = now;
  if (!Number.isFinite(state.plans[now]?.blessingPool)) planFor(now);
  if (!Number.isFinite(state.plans[now].lanternBudget)) state.plans[now].lanternBudget = draftPlan().lanternBudget;
  if (!Number.isFinite(state.plans[now].lotoBudget)) state.plans[now].lotoBudget = draftPlan().lotoBudget;
  if (state.quest.day !== now) {
    closeQuests(now);
    const budget = draftPlan().questBudget;
    state.plans[now].questBudget = budget;
    openQuests(now, budget);
  }
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
    ctx.away.begin();
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
  if (catching || document.hidden) return;
  const t = ctx.now();
  const gap = state.seen === null ? 0 : t - state.seen;
  if (gap > ONLINE_GAP) await catchUp(state.seen, t, progress);
  else if (gap > 0) observe(gap);
  settleThrough(t);
  state.seen = t;
  store.save();
}

export const economy = {
  get catching() {
    return catching;
  },
  async start({ ledger, bank, estate, staff, people, villagers: roster = null, now, away, progress = null }) {
    ctx = { ledger, bank, estate, staff, people, villagers: roster, now, away };
    if (!state.seeded) {
      state.seeded = true;
      pay(FUND, ECONOMY.fundSeed);
    }
    mergeArenaPool();
    trade.open(bank);
    store.save();
    await update(progress);
    setInterval(() => update(), CHECK_MS);
  },
  resume: () => (ctx ? update() : Promise.resolve()),
  income(seller, price, payer = null) {
    if (!ctx || !(price > 0)) return;
    const role = ROLE_OF.get(seller);
    const keep = price * (ECONOMY.keep[role] ?? 0);
    const tax = price * ECONOMY.vat;
    const cut = payEarner(seller, keep);
    if (role === 'teacher') state.tuition += keep - cut;
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
  trade(purse, gross, cost = 0) {
    if (!(gross > 0)) return 0;
    if (!ctx) {
      const whole = Math.floor(gross);
      purse.earn(whole);
      return whole;
    }
    const cut = Math.max(0, gross - cost) * ECONOMY.incomeTax;
    const net = gross - cut;
    deposit(cut, 'levy');
    const whole = settle(purse.id, net);
    if (whole > 0) purse.earn(whole);
    trackEarn(purse.id, net, cut);
    store.save();
    return whole;
  },
  retail(seller, price, cost, payer = null) {
    if (!ctx || !(price > 0)) return;
    const tax = price * ECONOMY.vat;
    const net = price - tax;
    const cut = Math.max(0, net - cost) * ECONOMY.incomeTax;
    deposit(tax, 'vat');
    deposit(cut, 'levy');
    pay(seller, net - cut);
    trackSpend(payer, price, { [seller]: net - cut, [FUND]: tax + cut });
    store.save();
  },
  census() {
    if (!ctx) return null;
    const ids = villagers();
    const day = today();
    return census.report({
      day,
      worth: Object.fromEntries(ids.map((id) => [id, worthOf(id)])),
      traits: ids.map((id) => traits.snapshot(id)),
      acts: ids.map((id) => traits.lastActs(id)),
      supply: supplyOf(),
      fund: ctx.ledger.purse(FUND).money,
    });
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
  payBlessing(id, session, score) {
    const reward = blessingReward(score, state.blessingCarry[id]);
    if (!ctx) return { money: 0, intellect: reward.intellect };
    state.blessingCarry[id] = reward.carry;
    const money = grantBlessing(session, reward.money);
    store.save();
    return { money, intellect: reward.intellect };
  },
  blessingLeft(session) {
    return headShare(session, joinsOf(session).length ? 1 : 0);
  },
  joinBlessing(id, session, purse) {
    if (!session) return false;
    const joins = joinsOf(session);
    if (joins.includes(id)) return true;
    if (purse.money < BLESSING.fee || !purse.spend(BLESSING.fee)) return false;
    state.blessingJoins[session] = [...joins, id];
    if (ctx) {
      deposit(BLESSING.fee, 'blessing');
      trackSpend(id, BLESSING.fee, { [FUND]: BLESSING.fee });
    }
    store.save();
    return true;
  },
  blessingBudget(day = today()) {
    return planOf(day)?.blessingPool ?? 0;
  },
  lanternLeft(at = gameNow()) {
    if (!ctx) return 0;
    const day = dayOf(at);
    const paid = state.lanternPaid.day === day ? state.lanternPaid.paid : 0;
    const left = Math.min((planOf(day)?.lanternBudget ?? 0) - paid, ctx.ledger.purse(FUND).money);
    return Math.max(0, Math.floor(left / ENERGY_PRICE));
  },
  payLantern(points, at = gameNow()) {
    const funded = Math.min(Math.floor(points), economy.lanternLeft(at));
    if (!(funded > 0)) return 0;
    const cost = withdraw(Math.ceil(funded * ENERGY_PRICE), 'lantern');
    if (!(cost > 0)) return 0;
    const day = dayOf(at);
    if (state.lanternPaid.day !== day) state.lanternPaid = { day, paid: 0 };
    state.lanternPaid.paid += cost;
    payEarner(NPC.cook, cost);
    store.save();
    return funded;
  },
  lotoBudget(day = today()) {
    return planOf(day)?.lotoBudget ?? 0;
  },
  payLoto(winners, pot) {
    if (!ctx || !winners.length) return 0;
    const each = Math.floor(Math.min(pot, ctx.ledger.purse(FUND).money) / winners.length);
    if (!(each > 0) || !withdraw(each * winners.length, 'loto')) return 0;
    for (const id of winners) {
      ctx.ledger.purse(id).earn(each);
      trackEarn(id, each);
    }
    store.save();
    return each;
  },
  questBudget(day = today()) {
    return planOf(day)?.questBudget ?? 0;
  },
  questReward(scope) {
    const keys = QUEST_POOL[scope];
    if (!ctx || !keys) return 0;
    return Math.max(0, Math.floor(Math.min(state.quest[keys.reward], state.quest[keys.pool])));
  },
  payQuest(purse, scope) {
    const paid = economy.questReward(scope);
    if (!(paid > 0)) return 0;
    state.quest[QUEST_POOL[scope].pool] -= paid;
    record(state.book, today(), 'out', 'quest', paid);
    purse.earn(paid);
    trackEarn(purse.id, paid);
    store.save();
    return paid;
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
    return ctx ? takeFund(economy.arenaPrize(at)) : 0;
  },
  payArena(purse, amount, cut = 0) {
    if (!(amount > 0)) return;
    purse.earn(amount - cut);
    if (!ctx) return;
    trackEarn(purse.id, amount - cut);
    record(state.book, today(), 'out', 'arena', amount);
    deposit(cut, 'arenaFee');
    store.save();
  },
  returnArena(value) {
    if (ctx && value > 0) ctx.ledger.purse(FUND).earn(value);
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
