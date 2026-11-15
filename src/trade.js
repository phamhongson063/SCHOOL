import { CROP_ECONOMY, ECONOMY, FISH, FISHING, FOODS, SHOP, SNACKS, TRADE, VENDOR, WILDLIFE } from './config.js';
import { ITEMS, seedId, snackId } from './inventory.js';
import { createStore } from './persist.js';
import { worldKey } from './saveKeys.js';
import { economy } from './economy.js';
import { NPC } from './npcIds.js';

const KEY = worldKey('trade');
const KITCHENS = { [NPC.cook]: 'cook', [NPC.vendor]: 'vendor', [NPC.grocer]: 'grocer' };
const WHOLESALE = { produce: NPC.keeper, fish: NPC.fishmonger, game: NPC.keeper };
const PARTS = { produce: ['produce'], protein: ['fish', 'game'] };
const MERCHANTS = new Set([NPC.keeper, NPC.fishmonger, ...Object.keys(KITCHENS)]);
const MENUS = { [NPC.cook]: FOODS, [NPC.vendor]: VENDOR.foods };
const GOODS = [...Object.keys(CROP_ECONOMY).map(seedId), 'fertilizer', 'bait', 'rod', ...Object.keys(SNACKS).map(snackId)];
const RAW = Object.fromEntries(Object.keys(WHOLESALE).map((kind) => [kind, Object.keys(ITEMS).filter((item) => ITEMS[item].kind === kind)]));
const BUYERS = [...new Set(Object.values(WHOLESALE))];
const RAW_OF = Object.fromEntries(BUYERS.map((holder) => [holder, Object.keys(RAW).filter((kind) => WHOLESALE[kind] === holder).flatMap((kind) => RAW[kind])]));

export function priceOf(item) {
  const info = ITEMS[item];
  if (!info) return 0;
  if (info.kind === 'produce') return CROP_ECONOMY[info.crop]?.price ?? 0;
  if (info.kind === 'seed') return CROP_ECONOMY[info.crop]?.seed ?? 0;
  if (info.kind === 'fertilizer') return SHOP.fertilizer;
  if (info.kind === 'fish') return FISH[info.fish]?.price ?? 0;
  if (info.kind === 'game') return WILDLIFE[info.animal]?.price ?? 0;
  if (info.kind === 'snack') return SNACKS[info.snack]?.price ?? 0;
  if (item === 'rod') return FISHING.rod;
  if (item === 'bait') return FISHING.baitPack;
  return 0;
}

export const packSize = (item) => (item === 'bait' ? FISHING.baitPerPack : 1);

export function sellerOf(item) {
  if (item === 'rod' || item === 'bait') return NPC.fishmonger;
  if (ITEMS[item]?.kind === 'snack') return NPC.grocer;
  return NPC.keeper;
}

const recipeOf = (item) => (ITEMS[item]?.kind === 'snack' ? SNACKS[ITEMS[item].snack]?.uses ?? null : null);
const importCost = (item) => (priceOf(item) / packSize(item)) * TRADE.importRate;
const stockTarget = (item) => TRADE.stock[item] ?? TRADE.stock[ITEMS[item]?.kind] ?? 0;
const usesOf = (food) => food.uses ?? {};
const valueOf = (uses) => Object.values(uses).reduce((sum, value) => sum + value, 0);
const itemCap = (item) => TRADE.cap[ITEMS[item].kind] / RAW[ITEMS[item].kind].length;
const fine = (value) => Math.round(value * 10) / 10;
const objectOr = (value) => (value && typeof value === 'object' ? value : {});
const emptyPantry = () => Object.fromEntries(Object.keys(PARTS).map((part) => [part, { value: 0, paid: 0 }]));

function cleanPantry(raw) {
  const pantry = {};
  for (const [id, parts] of Object.entries(objectOr(raw))) {
    pantry[id] = emptyPantry();
    for (const part of Object.keys(PARTS)) {
      const entry = parts?.[part];
      if (typeof entry === 'number') pantry[id][part] = { value: entry, paid: entry };
      else if (entry && typeof entry === 'object') pantry[id][part] = { value: Number(entry.value) || 0, paid: Number(entry.paid) || 0 };
    }
  }
  return pantry;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      return {
        seeded: saved.seeded === true,
        basis: objectOr(saved.basis),
        pantry: cleanPantry(saved.pantry),
        carry: objectOr(saved.carry),
        owed: objectOr(saved.owed),
        sales: objectOr(saved.sales),
        turnover: objectOr(saved.turnover),
      };
    }
  } catch {}
  return { seeded: false, basis: {}, pantry: {}, carry: {}, owed: {}, sales: {}, turnover: {} };
}

let ledger = null;
let bank = null;
const state = load();
const store = createStore(KEY, () => state);
const purseOf = (id) => ledger.purse(id);

function defaultCost(item) {
  if (GOODS.includes(item)) return recipeOf(item) ? valueOf(recipeOf(item)) : importCost(item);
  return priceOf(item) * TRADE.buyHigh;
}

const costOf = (holder, item, count) => (state.basis[holder]?.[item] ?? defaultCost(item)) * count;

function receive(holder, item, count, unitCost) {
  const purse = purseOf(holder);
  const have = purse.count(item);
  const old = state.basis[holder]?.[item] ?? unitCost;
  (state.basis[holder] ??= {})[item] = (old * have + unitCost * count) / (have + count);
  purse.add(item, count);
}

function surplus(id) {
  const debt = (bank?.debt(id) ?? 0) + (state.owed[id] ?? 0);
  return Math.min(1, Math.max(0, (purseOf(id).money - TRADE.capital - debt) / TRADE.capital));
}

const lift = (id) => 1 + TRADE.richLift * surplus(id);

function spendFine(id, value) {
  const purse = purseOf(id);
  const total = (state.carry[id] ?? 0) + value;
  const whole = Math.floor(total);
  if (purse.money < whole || !purse.spend(whole)) return false;
  state.carry[id] = total - whole;
  return true;
}

function earned(id, value) {
  state.sales[id] = (state.sales[id] ?? 0) + value;
}

const cashFloor = () => TRADE.capital * TRADE.cashFloor;
const short = (holder) => purseOf(holder).money < cashFloor();

function fillRate(item) {
  const holder = WHOLESALE[ITEMS[item].kind];
  const fill = Math.min(1, purseOf(holder).count(item) / itemCap(item));
  const rate = TRADE.buyHigh - (TRADE.buyHigh - TRADE.buyLow) * fill;
  return short(holder) ? Math.min(rate, TRADE.exportRate) : rate;
}

function quote(item) {
  const holder = WHOLESALE[ITEMS[item]?.kind];
  if (!holder) return 0;
  if (!ledger) return fine(priceOf(item) * TRADE.buyHigh);
  return fine(priceOf(item) * fillRate(item) * lift(holder));
}

function payRate(kind) {
  const items = RAW[kind];
  if (!ledger || !items?.length) return TRADE.buyHigh;
  return (items.reduce((sum, item) => sum + fillRate(item), 0) / items.length) * lift(WHOLESALE[kind]);
}

function exportStock(holder, item, units) {
  if (!(units > 0)) return;
  const purse = purseOf(holder);
  const gross = units * priceOf(item) * TRADE.exportRate;
  const cost = costOf(holder, item, units);
  purse.take(item, units);
  economy.trade(purse, gross, cost);
  earned(holder, gross);
}

function fullestOf(holder) {
  let best = null;
  let most = 0;
  for (const item of RAW_OF[holder]) {
    const count = purseOf(holder).count(item);
    const fill = count / itemCap(item);
    if (count >= 1 && fill > most) {
      best = item;
      most = fill;
    }
  }
  return best;
}

function raiseCash(holder, need) {
  const purse = purseOf(holder);
  while (purse.money < need) {
    const item = fullestOf(holder);
    if (!item) return;
    exportStock(holder, item, 1);
  }
}

const exportValue = (holder) => RAW_OF[holder].reduce((sum, item) => sum + Math.floor(purseOf(holder).count(item)) * priceOf(item) * TRADE.exportRate, 0);

function buyRaw(purse, item, count) {
  const holder = WHOLESALE[ITEMS[item]?.kind];
  if (!ledger || !holder || purse.id === holder) return { sold: 0, earned: 0 };
  let sold = 0;
  let gross = 0;
  while (sold < count && purse.count(item) > 0) {
    const price = quote(item);
    if (!(price > 0)) break;
    if (!spendFine(holder, price)) {
      raiseCash(holder, Math.ceil(price));
      if (!spendFine(holder, price)) break;
    }
    purse.take(item, 1);
    receive(holder, item, 1, price);
    sold += 1;
    gross += price;
  }
  store.save();
  return { sold, earned: gross > 0 ? economy.trade(purse, gross, 0) : 0 };
}

const pantryOf = (id) => (state.pantry[id] ??= emptyPantry());

function pickSource(part) {
  let best = null;
  for (const kind of PARTS[part]) {
    const holder = WHOLESALE[kind];
    for (const [item, count] of purseOf(holder).entries(kind)) if (!best || count > best.count) best = { holder, item, count };
  }
  return best;
}

function buyOne(id, part) {
  const source = pickSource(part);
  if (!source) return false;
  const base = priceOf(source.item);
  const price = Math.ceil(base * lift(id));
  if (!purseOf(id).spend(price)) return false;
  const shop = purseOf(source.holder);
  const cost = costOf(source.holder, source.item, 1);
  const fee = price * TRADE.marketFee;
  shop.take(source.item, 1);
  economy.collect(fee, null, fee, 'market');
  economy.trade(shop, price - fee, cost);
  earned(source.holder, price - fee);
  const entry = pantryOf(id)[part];
  entry.value += base;
  entry.paid += price;
  return true;
}

function importPart(id, part, value) {
  const price = Math.ceil(value * TRADE.scarce[part]);
  if (!purseOf(id).spend(price)) return false;
  const entry = pantryOf(id)[part];
  entry.value += value;
  entry.paid += price;
  return true;
}

function topUp(id, part, want) {
  const entry = pantryOf(id)[part];
  while (entry.value < want && buyOne(id, part));
  if (entry.value < want && TRADE.scarce[part]) importPart(id, part, want - entry.value);
}

function restockKitchens() {
  const wants = Object.entries(KITCHENS).flatMap(([id, role]) => Object.entries(TRADE.pantry[role]).map(([part, target]) => ({ id, part, target })));
  let moving = true;
  while (moving) {
    moving = false;
    for (const { id, part, target } of wants) if (pantryOf(id)[part].value < target && buyOne(id, part)) moving = true;
  }
}

const enough = (id, uses) => Object.entries(uses).every(([part, value]) => pantryOf(id)[part].value >= value);

function ready(id, food) {
  const uses = usesOf(food);
  if (enough(id, uses)) return true;
  if (!KITCHENS[id]) return false;
  for (const [part, value] of Object.entries(uses)) topUp(id, part, value);
  store.save();
  return enough(id, uses);
}

function consume(id, uses) {
  let cost = 0;
  for (const [part, value] of Object.entries(uses)) {
    const entry = pantryOf(id)[part];
    const unit = entry.value > 0 ? entry.paid / entry.value : 1;
    entry.value -= value;
    entry.paid = Math.max(0, entry.paid - unit * value);
    cost += unit * value;
  }
  return cost;
}

function restockGood(item, need = 0) {
  const holder = sellerOf(item);
  const purse = purseOf(holder);
  const target = Math.max(stockTarget(item), need);
  const have = purse.count(item);
  if (have >= need && have >= target * TRADE.restockBelow) return;
  const want = target - have;
  const recipe = recipeOf(item);
  if (recipe) {
    let made = 0;
    while (made < want && ready(holder, { uses: recipe })) {
      receive(holder, item, 1, consume(holder, recipe));
      made += 1;
    }
  } else {
    const unit = importCost(item);
    const count = Math.min(want, Math.floor(purse.money / unit));
    if (count > 0 && purse.spend(Math.ceil(count * unit))) receive(holder, item, count, unit);
  }
  store.save();
}

function exportSurplus() {
  for (const holder of BUYERS) {
    for (const item of RAW_OF[holder]) exportStock(holder, item, Math.floor(purseOf(holder).count(item) - itemCap(item)));
    raiseCash(holder, cashFloor());
  }
}

function repayCapital() {
  for (const id of MERCHANTS) {
    const owed = state.owed[id] ?? 0;
    if (!(owed > 0)) continue;
    const purse = purseOf(id);
    const spare = Math.floor(Math.min(owed, purse.money - TRADE.capital - (bank?.debt(id) ?? 0)));
    if (!(spare > 0) || !purse.spend(spare)) continue;
    economy.collect(spare, null, spare, 'capital');
    state.owed[id] = owed - spare;
  }
}

function rollSales() {
  for (const id of MERCHANTS) {
    const today = state.sales[id] ?? 0;
    const before = state.turnover[id];
    state.turnover[id] = Number.isFinite(before) ? before + (today - before) * TRADE.turnoverWeight : today;
    state.sales[id] = 0;
  }
}

function open() {
  for (const id of MERCHANTS) {
    const purse = purseOf(id);
    const lent = Math.min(TRADE.capital - purse.money, economy.treasury);
    if (lent > 0 && economy.payOut(lent, purse, 'capital')) state.owed[id] = (state.owed[id] ?? 0) + lent;
  }
  for (const [kind, units] of Object.entries(TRADE.opening)) {
    for (const item of RAW[kind]) receive(WHOLESALE[kind], item, Math.ceil(units / RAW[kind].length), priceOf(item) * TRADE.buyHigh);
  }
  for (const [id, role] of Object.entries(KITCHENS)) {
    const pantry = pantryOf(id);
    for (const [part, value] of Object.entries(TRADE.pantry[role])) pantry[part] = { value, paid: value };
  }
  for (const item of GOODS) {
    const missing = stockTarget(item) - purseOf(sellerOf(item)).count(item);
    if (missing > 0) receive(sellerOf(item), item, missing, defaultCost(item));
  }
  state.seeded = true;
  store.save();
}

export const trade = {
  start({ ledger: shared }) {
    ledger = shared;
  },
  open(shared) {
    bank = shared;
    if (ledger && !state.seeded) open();
  },
  priceOf,
  quote,
  payRate,
  sell(purse, item, count) {
    return buyRaw(purse, item, count);
  },
  buying(item) {
    const holder = WHOLESALE[ITEMS[item]?.kind];
    return !!ledger && !!holder && purseOf(holder).money + exportValue(holder) >= Math.ceil(quote(item));
  },
  stockOf(item) {
    return ledger ? purseOf(sellerOf(item)).count(item) : 0;
  },
  available(item, count = 1) {
    if (!ledger || !GOODS.includes(item)) return false;
    const units = count * packSize(item);
    restockGood(item, units);
    return purseOf(sellerOf(item)).count(item) >= units;
  },
  buy(purse, item, count) {
    const holder = sellerOf(item);
    const price = priceOf(item) * count;
    const units = count * packSize(item);
    if (!(count > 0) || !price || purse.money < price || purse.id === holder || !trade.available(item, count)) return false;
    if (!purse.spend(price)) return false;
    const cost = costOf(holder, item, units);
    purseOf(holder).take(item, units);
    purse.add(item, units);
    economy.retail(holder, price, cost, purse.id);
    earned(holder, price);
    store.save();
    return true;
  },
  ready(seller, food) {
    return !!ledger && ready(seller, food);
  },
  serve(seller, food, purse) {
    if (!ledger || purse.id === seller || !ready(seller, food) || !purse.spend(food.price)) return false;
    economy.retail(seller, food.price, consume(seller, usesOf(food)), purse.id);
    earned(seller, food.price);
    store.save();
    return true;
  },
  cookFor(seller, food) {
    if (!ledger || !ready(seller, food)) return false;
    consume(seller, usesOf(food));
    store.save();
    return true;
  },
  meals(diners) {
    if (!ledger) return;
    for (const id of diners) {
      const seller = id === NPC.cook ? NPC.vendor : NPC.cook;
      const menu = Object.values(MENUS[seller])
        .filter((food) => food.price <= ECONOMY.living)
        .sort((a, b) => b.price - a.price);
      const purse = purseOf(id);
      menu.some((food) => trade.serve(seller, food, purse));
    }
  },
  daily() {
    if (!ledger) return;
    restockKitchens();
    exportSurplus();
    for (const item of GOODS) restockGood(item);
    repayCapital();
    rollSales();
    store.save();
  },
  isMerchant(id) {
    return MERCHANTS.has(id);
  },
  reserveOf(id) {
    return MERCHANTS.has(id) ? TRADE.capital : null;
  },
  incomeOf(id) {
    return MERCHANTS.has(id) ? { earn: state.turnover[id] ?? 0 } : null;
  },
  debtOf(id) {
    return state.owed[id] ?? 0;
  },
};
