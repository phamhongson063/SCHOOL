import { CROPS } from './crops.js';
import { ITEMS, seedId, fishId } from './inventory.js';
import { CROP_ECONOMY, SHOP, SCHOOL, MONEY, VILLAGER, FARMING, FISH, FISHING, growDays } from './config.js';
import { minuteOfDay, clockText } from './clock.js';
import { amount, coins } from './format.js';
import { iconTag, paintIcon } from './itemArt.js';

export function priceOf(item) {
  const info = ITEMS[item];
  if (!info) return 0;
  if (info.kind === 'produce') return CROP_ECONOMY[info.crop]?.price ?? 0;
  if (info.kind === 'seed') return CROP_ECONOMY[info.crop]?.seed ?? 0;
  if (info.kind === 'fertilizer') return SHOP.fertilizer;
  if (info.kind === 'fish') return FISH[info.fish]?.price ?? 0;
  if (item === 'rod') return FISHING.rod;
  if (item === 'bait') return FISHING.baitPack;
  return 0;
}

const SELLABLE = new Set(['produce', 'fish']);

function packSize(item) {
  return item === 'bait' ? FISHING.baitPerPack : 1;
}

function stockValue(purse) {
  let value = 0;
  for (const kind of SELLABLE) for (const [item, count] of purse.entries(kind)) value += priceOf(item) * count;
  return value;
}

export function averageYield(crop) {
  const list = CROPS[crop].varieties;
  return list.reduce((sum, variety) => sum + variety.fruits, 0) / list.length;
}

export function profitPerDay(crop) {
  const economy = CROP_ECONOMY[crop];
  return (averageYield(crop) * economy.price - economy.seed) / growDays(crop);
}

export function cheapestSeed() {
  return Math.min(...Object.values(CROP_ECONOMY).map((economy) => economy.seed));
}

export function shopOpen(minutes) {
  const t = minuteOfDay(minutes);
  return t >= SHOP.open && t < SHOP.close;
}

export const shopHours = () => `${clockText(SHOP.open)}–${clockText(SHOP.close)}`;


export function createMarket() {
  function sell(purse, item, count) {
    const have = purse.count(item);
    const amount = Math.min(have, count);
    if (amount <= 0 || !SELLABLE.has(ITEMS[item]?.kind)) return 0;
    const earned = amount * priceOf(item);
    if (!purse.take(item, amount)) return 0;
    purse.earn(earned);
    return earned;
  }

  function sellAll(purse) {
    let earned = 0;
    for (const kind of SELLABLE) {
      for (const [item, amount] of purse.entries(kind)) earned += sell(purse, item, amount);
    }
    return earned;
  }

  function buy(purse, item, count) {
    const price = priceOf(item);
    if (!(count > 0) || !price || !purse.spend(price * count)) return false;
    purse.add(item, count * packSize(item));
    return true;
  }

  function seedPlan(purse, budget) {
    const want = Math.max(0, VILLAGER.seedStock - purse.total('seed'));
    if (!want || budget <= 0) return null;
    const options = Object.keys(CROPS)
      .filter((crop) => CROP_ECONOMY[crop].seed <= budget)
      .sort((a, b) => profitPerDay(b) - profitPerDay(a));
    if (!options.length) return null;
    const crop = options[Math.floor(Math.random() * Math.min(3, options.length))];
    const count = Math.min(want, Math.floor(budget / CROP_ECONOMY[crop].seed));
    return count > 0 ? { item: seedId(crop), count } : null;
  }

  return {
    sell,
    sellAll,
    buy,
    wantsTrade(villager) {
      const purse = villager.purse;
      if (purse.total('produce') >= VILLAGER.sellWhen || purse.total('fish') >= 3) return true;
      if (purse.total('seed') > 0) return false;
      const plots = villager.town.farm.plots(villager.id);
      if (plots.owned >= FARMING.villagerPlots) return false;
      const reserve = villager.kind === 'student' ? SCHOOL.tuition * 4 : 0;
      return purse.money + stockValue(purse) - reserve >= cheapestSeed();
    },
    trade(villager) {
      const purse = villager.purse;
      const lines = [];
      const earned = sellAll(purse);
      if (earned) lines.push(`Bán được ${coins(earned)}`);
      const reserve = villager.kind === 'student' ? SCHOOL.tuition * 4 : 0;
      const plan = seedPlan(purse, purse.money - reserve);
      if (plan && buy(purse, plan.item, plan.count)) lines.push(`Mua ${plan.count} gói ${iconTag(ITEMS[plan.item])}`);
      if (purse.count('fertilizer') === 0 && purse.money - reserve >= SHOP.fertilizer * 8 && Math.random() < 0.4) {
        if (buy(purse, 'fertilizer', 2)) lines.push('Mua 2 bao 🧪');
      }
      if (purse.count('rod') > 0 && purse.count('bait') < 3 && purse.money - reserve >= FISHING.baitPack * 2 && Math.random() < 0.5) {
        if (buy(purse, 'bait', 1)) lines.push('Mua 1 gói 🪱');
      }
      if (!lines.length) lines.push('Chào bà chủ!');
      return lines;
    },
  };
}

function row({ icon, art, title, detail, actions }) {
  const node = document.createElement('div');
  node.className = 'shop-row';
  const badge = document.createElement('span');
  badge.className = 'shop-icon';
  badge.setAttribute('aria-hidden', 'true');
  paintIcon(badge, { icon, art });
  const text = document.createElement('div');
  text.className = 'shop-text';
  const name = document.createElement('strong');
  name.textContent = title;
  const info = document.createElement('small');
  info.textContent = detail;
  text.append(name, info);
  const buttons = document.createElement('div');
  buttons.className = 'shop-actions';
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.disabled = !!action.disabled;
    button.addEventListener('click', action.run);
    buttons.append(button);
  }
  node.append(badge, text, buttons);
  return node;
}

export function createShopUI({ market, purse }) {
  const dialog = document.getElementById('shopDialog');
  const list = document.getElementById('shopList');
  const money = document.getElementById('shopMoney');
  const note = document.getElementById('shopNote');
  const tabs = [...dialog.querySelectorAll('[data-tab]')];
  let tab = 'sell';

  const say = (text) => {
    note.textContent = text;
  };

  function sellRow(item) {
    const info = ITEMS[item];
    const have = purse.count(item);
    const price = priceOf(item);
    const sellSome = (count) => () => {
      const earned = market.sell(purse, item, count);
      if (earned) say(`Bán ${Math.min(count, have)} ${info.unit} ${info.name.toLowerCase()} được ${coins(earned)}.`);
      render();
    };
    return row({
      icon: info.icon,
      art: info.art,
      title: info.name,
      detail: `${coins(price)}/${info.unit} · đang có ${have}`,
      actions: [
        { label: 'Bán 1', disabled: have < 1, run: sellSome(1) },
        { label: 'Bán hết', disabled: have < 1, run: sellSome(have) },
      ],
    });
  }

  function sellRows() {
    const fish = Object.keys(FISH).map(fishId);
    const owned = fish.filter((item) => purse.count(item) > 0);
    return [...Object.keys(CROPS), ...(owned.length ? fish : [])].map(sellRow);
  }

  function buyRow(item, detail, { unit = ITEMS[item].unit, many = 5, owned = false } = {}) {
    const price = priceOf(item);
    const info = ITEMS[item];
    const purchase = (count) => () => {
      if (market.buy(purse, item, count)) say(`Đã mua ${count} ${unit} ${info.name.toLowerCase()}.`);
      else say(`Không đủ tiền! Cần ${coins(price * count)}.`);
      render();
    };
    const actions = owned
      ? [{ label: 'Đã có', disabled: true, run: () => {} }]
      : [{ label: 'Mua 1', disabled: purse.money < price, run: purchase(1) }];
    if (many > 1 && !owned) actions.push({ label: `Mua ${many}`, disabled: purse.money < price * many, run: purchase(many) });
    return row({
      icon: info.icon,
      art: info.art,
      title: info.name,
      detail: `${coins(price)}/${unit} · ${detail} · đang có ${purse.count(item)}`,
      actions,
    });
  }

  function buyRows() {
    const rows = Object.keys(CROPS)
      .sort((a, b) => growDays(a) - growDays(b))
      .map((crop) => buyRow(seedId(crop), `thu sau ${growDays(crop)} ngày`));
    rows.push(buyRow('fertilizer', 'bù lại 1 lần lỡ tưới'));
    rows.push(buyRow('bait', `mỗi gói ${FISHING.baitPerPack} lần câu`, { unit: 'gói' }));
    rows.push(buyRow('rod', 'ra bến sông Hoài câu cá', { many: 1, owned: purse.count('rod') > 0 }));
    return rows;
  }

  function render() {
    money.textContent = `${MONEY.icon} ${amount(purse.money)}`;
    for (const button of tabs) button.setAttribute('aria-selected', String(button.dataset.tab === tab));
    list.replaceChildren(...(tab === 'sell' ? sellRows() : buyRows()));
  }

  for (const button of tabs) {
    button.addEventListener('click', () => {
      tab = button.dataset.tab;
      say('');
      render();
    });
  }
  dialog.querySelector('.sched-x').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  purse.onChange(() => {
    if (dialog.open) render();
  });

  return {
    open() {
      tab = purse.total('produce') + purse.total('fish') > 0 ? 'sell' : 'buy';
      say('Bà chủ: "Mua gì bán gì cứ tự nhiên nghen!"');
      render();
      dialog.showModal();
    },
    get isOpen() {
      return dialog.open;
    },
  };
}
