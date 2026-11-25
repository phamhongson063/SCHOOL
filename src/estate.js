import { HOUSE_PRICES, CHIEF, ECONOMY } from './config.js';
import { isOpenAt, hoursText } from './clock.js';
import { economy } from './economy.js';
import { writeGameItem } from './seal.js';
import { worldKey } from './saveKeys.js';
import { readSaved } from './persist.js';

const KEY = worldKey('estate');
const SIZE_NAMES = { small: 'Nhà nhỏ', medium: 'Nhà vừa', large: 'Nhà lớn' };

export const chiefOpen = (minutes) => isOpenAt(CHIEF, minutes);
export const chiefHours = () => hoursText(CHIEF);

export function createEstate({ houses }) {
  const list = houses.map((house) => ({ ...house, price: HOUSE_PRICES[house.size], owner: null }));
  const listeners = [];
  try {
    const saved = readSaved(KEY);
    if (saved && typeof saved === 'object') {
      for (const house of list) {
        const owner = saved[house.id];
        if (typeof owner === 'string') house.owner = owner;
      }
    }
  } catch {}

  function save() {
    const owners = {};
    for (const house of list) if (house.owner) owners[house.id] = house.owner;
    try {
      writeGameItem(KEY, JSON.stringify(owners));
    } catch {}
    for (const listener of listeners) listener();
  }

  const houseOf = (owner) => list.find((house) => house.owner === owner) ?? null;
  const forSale = () => list.filter((house) => !house.owner).sort((a, b) => a.price - b.price);

  function buy(houseId, owner, purse) {
    const house = list.find((item) => item.id === houseId);
    if (!house || house.owner || houseOf(owner)) return null;
    if (!purse.spend(house.price)) return null;
    economy.collect(house.price, null, 'estate');
    house.owner = owner;
    save();
    return house;
  }

  const buybackOf = (house) => Math.floor(house.price * ECONOMY.buyback);

  function sellBack(owner, purse) {
    const house = houseOf(owner);
    if (!house || !economy.payOut(buybackOf(house), purse)) return null;
    house.owner = null;
    save();
    return house;
  }

  return {
    houses: list,
    houseOf,
    sizeName: (house) => SIZE_NAMES[house.size],
    affordableFor(owner, budget) {
      if (houseOf(owner)) return false;
      const cheapest = forSale()[0];
      return !!cheapest && cheapest.price <= budget;
    },
    buyFor(owner, purse, reserve = 0) {
      if (houseOf(owner)) return null;
      const options = forSale().filter((house) => house.price <= purse.money - reserve);
      if (!options.length) return null;
      const house = options[options.length - 1];
      return buy(house.id, owner, purse);
    },
    buy,
    buybackOf,
    sellBack,
    onChange(listener) {
      listeners.push(listener);
    },
  };
}
