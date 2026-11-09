import { CROPS } from './crops.js';
import { ITEMS, seedId, fishId, gameId } from './inventory.js';
import { CROP_ECONOMY, SHOP, SCHOOL, MONEY, VILLAGER, FARMING, FISH, FISHING, FISH_SHOP, WILDLIFE, growDays } from './config.js';
import { isOpenAt, hoursText } from './clock.js';
import { amount, coins, notEnough } from './format.js';
import { iconTag, paintIcon } from './itemArt.js';
import { closable } from './dialog.js';
import { economy } from './economy.js';

export function priceOf(item) {
  const info = ITEMS[item];
  if (!info) return 0;
  if (info.kind === 'produce') return CROP_ECONOMY[info.crop]?.price ?? 0;
  if (info.kind === 'seed') return CROP_ECONOMY[info.crop]?.seed ?? 0;
  if (info.kind === 'fertilizer') return SHOP.fertilizer;
  if (info.kind === 'fish') return FISH[info.fish]?.price ?? 0;
  if (info.kind === 'game') return WILDLIFE[info.animal]?.price ?? 0;
  if (item === 'rod') return FISHING.rod;
  if (item === 'bait') return FISHING.baitPack;
  return 0;
}

const SELLABLE = new Set(['produce', 'fish', 'game']);
const SHOP_KINDS = ['produce', 'game'];
const FISH_KINDS = ['fish'];

function packSize(item) {
  return item === 'bait' ? FISHING.baitPerPack : 1;
}

function stockValue(purse) {
  let value = 0;
  for (const kind of SHOP_KINDS) for (const [item, count] of purse.entries(kind)) value += priceOf(item) * count;
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

export const shopOpen = (minutes) => isOpenAt(SHOP, minutes);
export const shopHours = () => hoursText(SHOP);

export const fishShopOpen = (minutes) => isOpenAt(FISH_SHOP, minutes);
export const fishShopHours = () => hoursText(FISH_SHOP);

const reserveOf = (villager) => (villager.kind === 'student' ? SCHOOL.tuition * VILLAGER.tuitionReserve : 0);

function wantsBait(villager) {
  const purse = villager.purse;
  return purse.count('rod') > 0 && purse.count('bait') < FISHING.villagerBaitBelow && purse.money - reserveOf(villager) >= FISHING.baitPack * FISHING.villagerBaitFunds;
}

export function createMarket() {
  function sell(purse, item, count) {
    const have = purse.count(item);
    const amount = Math.min(have, count);
    if (amount <= 0 || !SELLABLE.has(ITEMS[item]?.kind)) return 0;
    if (!purse.take(item, amount)) return 0;
    const earned = Math.floor(economy.withhold(amount * priceOf(item)));
    purse.earn(earned);
    return earned;
  }

  function sellAll(purse, kinds) {
    let earned = 0;
    for (const kind of kinds) {
      for (const [item, amount] of purse.entries(kind)) earned += sell(purse, item, amount);
    }
    return earned;
  }

  function buy(purse, item, count) {
    const price = priceOf(item);
    if (!(count > 0) || !price || !purse.spend(price * count)) return false;
    economy.income(item === 'rod' || item === 'bait' ? 'fishmonger' : 'keeper', price * count);
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
      if (purse.total('produce') >= VILLAGER.sellWhen || purse.total('game') >= 1) return true;
      if (purse.total('seed') > 0) return false;
      const plots = villager.town.farm.plots(villager.id);
      if (plots.owned >= FARMING.villagerPlots) return false;
      return purse.money + stockValue(purse) - reserveOf(villager) >= cheapestSeed();
    },
    trade(villager) {
      const purse = villager.purse;
      const lines = [];
      const earned = sellAll(purse, SHOP_KINDS);
      if (earned) lines.push(`Bán được ${coins(earned)}`);
      const reserve = reserveOf(villager);
      const plan = seedPlan(purse, purse.money - reserve);
      if (plan && buy(purse, plan.item, plan.count)) lines.push(`Mua ${plan.count} gói ${iconTag(ITEMS[plan.item])}`);
      if (purse.count('fertilizer') === 0 && purse.money - reserve >= SHOP.fertilizer * 8 && Math.random() < 0.4) {
        if (buy(purse, 'fertilizer', 2)) lines.push('Mua 2 bao 🧪');
      }
      if (!lines.length) lines.push('Chào bà chủ!');
      return lines;
    },
    wantsFish(villager) {
      return villager.purse.total('fish') >= FISHING.villagerSellAt || wantsBait(villager);
    },
    fishTrade(villager) {
      const purse = villager.purse;
      const lines = [];
      const earned = sellAll(purse, FISH_KINDS);
      if (earned) lines.push(`Bán cá được ${coins(earned)}`);
      if (wantsBait(villager) && buy(purse, 'bait', 1)) lines.push('Mua 1 gói 🪱');
      if (!lines.length) lines.push('Chào chú hàng cá!');
      return lines;
    },
  };
}

function row({ key, icon, art, title, detail, actions }) {
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
  for (const [index, action] of actions.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.key = `${key}#${index}`;
    button.textContent = action.label;
    button.disabled = !!action.disabled;
    button.addEventListener('click', action.run);
    buttons.append(button);
  }
  node.append(badge, text, buttons);
  return node;
}

function createStallUI({ market, purse, ids, sellItems, buyItems, greeting }) {
  const dialog = document.getElementById(ids.dialog);
  const list = document.getElementById(ids.list);
  const money = document.getElementById(ids.money);
  const note = document.getElementById(ids.note);
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
      key: `sell:${item}`,
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

  function buyRow([item, detail, { unit = ITEMS[item].unit, many = 5, owned = false } = {}]) {
    const price = priceOf(item);
    const info = ITEMS[item];
    const purchase = (count) => () => {
      if (market.buy(purse, item, count)) say(`Đã mua ${count} ${unit} ${info.name.toLowerCase()}.`);
      else say(notEnough(price * count));
      render();
    };
    const actions = owned
      ? [{ label: 'Đã có', disabled: true, run: () => {} }]
      : [{ label: 'Mua 1', disabled: purse.money < price, run: purchase(1) }];
    if (many > 1 && !owned) actions.push({ label: `Mua ${many}`, disabled: purse.money < price * many, run: purchase(many) });
    return row({
      key: `buy:${item}`,
      icon: info.icon,
      art: info.art,
      title: info.name,
      detail: `${coins(price)}/${unit} · ${detail} · đang có ${purse.count(item)}`,
      actions,
    });
  }

  function refocus(key) {
    if (!key) return;
    const same = [...list.querySelectorAll('button')].find((button) => button.dataset.key === key);
    const target = same && !same.disabled ? same : same?.parentElement.querySelector('button:not(:disabled)');
    target?.focus({ preventScroll: true });
  }

  function render() {
    const active = list.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    money.textContent = `${MONEY.icon} ${amount(purse.money)}`;
    for (const button of tabs) button.setAttribute('aria-selected', String(button.dataset.tab === tab));
    list.replaceChildren(...(tab === 'sell' ? sellItems().map(sellRow) : buyItems().map(buyRow)));
    refocus(active);
  }

  for (const button of tabs) {
    button.addEventListener('click', () => {
      tab = button.dataset.tab;
      say('');
      render();
    });
  }
  closable(dialog);
  purse.onChange((detail) => {
    if (!dialog.open || 'energy' in detail || 'credits' in detail) return;
    render();
  });

  return {
    open() {
      tab = sellItems().some((item) => purse.count(item) > 0) ? 'sell' : 'buy';
      say(greeting);
      render();
      dialog.showModal();
    },
    close() {
      dialog.close();
    },
    get isOpen() {
      return dialog.open;
    },
  };
}

export function createShopUI({ market, purse }) {
  return createStallUI({
    market,
    purse,
    ids: { dialog: 'shopDialog', list: 'shopList', money: 'shopMoney', note: 'shopNote' },
    greeting: 'Bà chủ: "Mua gì bán gì cứ tự nhiên nghen!"',
    sellItems: () => [...Object.keys(CROPS), ...Object.keys(WILDLIFE).map(gameId).filter((item) => ITEMS[item] && purse.count(item) > 0)],
    buyItems: () => [
      ...Object.keys(CROPS)
        .sort((a, b) => growDays(a) - growDays(b))
        .map((crop) => [seedId(crop), `thu sau ${growDays(crop)} ngày`]),
      ['fertilizer', 'bù lại 1 lần lỡ tưới'],
    ],
  });
}

export function createFishShopUI({ market, purse }) {
  return createStallUI({
    market,
    purse,
    ids: { dialog: 'fishShopDialog', list: 'fishShopList', money: 'fishShopMoney', note: 'fishShopNote' },
    greeting: 'Chú hàng cá: "Cá tươi rói đây, bán mua gì cứ nói!"',
    sellItems: () => Object.keys(FISH).map(fishId),
    buyItems: () => [
      ['bait', `mỗi gói ${FISHING.baitPerPack} lần câu`, { unit: 'gói' }],
      ['rod', 'ra bến sông Hoài câu cá', { many: 1, owned: purse.count('rod') > 0 }],
    ],
  });
}
