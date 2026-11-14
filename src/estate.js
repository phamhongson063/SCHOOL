import { HOUSE_PRICES, CHIEF, ECONOMY } from './config.js';
import { PLAYER } from './inventory.js';
import { amount } from './format.js';
import { isOpenAt, hoursText } from './clock.js';
import { closable } from './dialog.js';
import { economy } from './economy.js';
import { stallCard, paintStallArt } from './stallCard.js';
import { writeGameItem } from './seal.js';
import { worldKey } from './saveKeys.js';

const KEY = worldKey('estate');
const SIZE_NAMES = { small: 'Nhà nhỏ', medium: 'Nhà vừa', large: 'Nhà lớn' };

export const chiefOpen = (minutes) => isOpenAt(CHIEF, minutes);
export const chiefHours = () => hoursText(CHIEF);

export function createEstate({ houses }) {
  const list = houses.map((house) => ({ ...house, price: HOUSE_PRICES[house.size], owner: null }));
  const listeners = [];
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
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
    economy.collect(house.price);
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

export function createChiefUI({ estate, purse, nameOf }) {
  const dialog = document.getElementById('chiefDialog');
  const list = document.getElementById('chiefList');
  const money = document.getElementById('chiefMoney');
  const note = document.getElementById('chiefNote');
  paintStallArt(dialog);

  function render() {
    money.textContent = amount(purse.money);
    const mine = estate.houseOf(PLAYER);
    list.replaceChildren(
      ...estate.houses.map((house) => {
        const actions = [];
        if (!house.owner) {
          actions.push({
            label: 'Mua',
            disabled: !!mine || purse.money < house.price,
            run: () => {
              const bought = estate.buy(house.id, PLAYER, purse);
              note.textContent = bought ? `🎉 Chúc mừng! Nhà số ${house.id} giờ là của bạn.` : 'Chưa đủ tiền mua căn này.';
              render();
            },
          });
        }
        if (house.owner === PLAYER) {
          actions.push({
            label: `Bán lại ${amount(estate.buybackOf(house))}`,
            run: () => {
              const sold = estate.sellBack(PLAYER, purse);
              note.textContent = sold ? `Youngsoo: "Làng đã mua lại nhà số ${sold.id}."` : 'Youngsoo: "Quỹ làng chưa đủ tiền mua lại, con chờ ít bữa nhé."';
              render();
            },
          });
        }
        return stallCard({
          icon: house.owner === PLAYER ? '🏡' : '🏠',
          title: `Nhà số ${house.id} · ${estate.sizeName(house)}`,
          price: house.price,
          tag: house.owner ? null : 'đang bán',
          detail: house.owner ? `Chủ nhà: ${house.owner === PLAYER ? 'Bạn' : nameOf(house.owner)}` : null,
          actions,
          muted: !!house.owner && house.owner !== PLAYER,
        });
      }),
    );
  }

  closable(dialog);
  estate.onChange(() => {
    if (dialog.open) render();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open() {
      const mine = estate.houseOf(PLAYER);
      note.textContent = mine ? `Youngsoo: "Con đã có nhà số ${mine.id} rồi đó."` : 'Youngsoo: "Muốn mua nhà thì chọn căn nào ưng ý nhé."';
      render();
      dialog.showModal();
    },
  };
}
