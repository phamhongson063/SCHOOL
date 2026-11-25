import { CROPS } from './cropData.js';
import { ITEMS, seedId } from './inventory.js';
import { CROP_ECONOMY, SHOP, CERTIFY, VILLAGER, FISHING, FISH_SHOP, MART, growDays } from './config.js';
import { holesWanted } from './holdings.js';
import { isOpenAt, hoursText } from './clock.js';
import { coins } from './format.js';
import { iconTag } from './itemArt.js';
import { priceOf, trade } from './trade.js';

const SHOP_KINDS = ['produce', 'game'];
const FISH_KINDS = ['fish'];

export const martOpen = (minutes) => isOpenAt(MART, minutes);
export const martHours = () => hoursText(MART);

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

const reserveOf = (villager) => (villager.seated ? (CERTIFY.learnFee + CERTIFY.internalFee + CERTIFY.examFee) * VILLAGER.studyReserve : 0);

function wantsBait(villager) {
  const purse = villager.purse;
  return purse.count('rod') > 0 && purse.count('bait') < FISHING.villagerBaitBelow && purse.money - reserveOf(villager) >= FISHING.baitPack * FISHING.villagerBaitFunds && trade.available('bait');
}

export function createMarket() {
  function sell(purse, item, count) {
    return trade.sell(purse, item, Math.min(purse.count(item), count)).earned;
  }

  function sellAll(purse, kinds) {
    let earned = 0;
    for (const kind of kinds) {
      for (const [item, amount] of purse.entries(kind)) earned += sell(purse, item, amount);
    }
    return earned;
  }

  function buy(purse, item, count) {
    return trade.buy(purse, item, count);
  }

  function seedPlan(purse, budget) {
    const want = Math.max(0, VILLAGER.seedStock - purse.total('seed'));
    if (!want || budget <= 0) return null;
    const options = Object.keys(CROPS)
      .filter((crop) => CROP_ECONOMY[crop].seed <= budget && trade.available(seedId(crop)))
      .sort((a, b) => profitPerDay(b) - profitPerDay(a));
    if (!options.length) return null;
    const crop = options[Math.floor(Math.random() * Math.min(3, options.length))];
    const count = Math.min(want, Math.floor(budget / CROP_ECONOMY[crop].seed), trade.stockOf(seedId(crop)));
    return count > 0 ? { item: seedId(crop), count } : null;
  }

  return {
    sell,
    sellAll,
    buy,
    wantsTrade(villager) {
      const purse = villager.purse;
      if (purse.total('produce') >= VILLAGER.sellWhen && purse.entries('produce').some(([item]) => trade.buying(item))) return true;
      if (purse.entries('game').some(([item]) => trade.buying(item))) return true;
      if (purse.total('seed') > 0) return false;
      const plots = villager.town.farm.plots(villager.id);
      if (plots.owned >= holesWanted(purse.money)) return false;
      return purse.money + stockValue(purse) - reserveOf(villager) >= cheapestSeed() && Object.keys(CROPS).some((crop) => trade.available(seedId(crop)));
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
      const purse = villager.purse;
      return (purse.total('fish') >= FISHING.villagerSellAt && purse.entries('fish').some(([item]) => trade.buying(item))) || wantsBait(villager);
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
