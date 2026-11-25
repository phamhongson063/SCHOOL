import { CROPS } from './cropData.js';
import { ITEMS, seedId, fishId, gameId, snackId } from './inventory.js';
import { FISH, FISHING, WILDLIFE, SNACKS, growDays } from './config.js';
import { durationText, DAY_MINUTES } from './clock.js';
import { amount, coins, notEnough } from './format.js';
import { closable } from './dialog.js';
import { stallCard, paintStallArt } from './stallCard.js';
import { setRich } from './goldArt.js';
import { priceOf, trade } from './trade.js';

function createStallUI({ market, purse, ids, sellItems, buyItems, greeting }) {
  const dialog = document.getElementById(ids.dialog);
  const list = document.getElementById(ids.list);
  const money = document.getElementById(ids.money);
  const note = document.getElementById(ids.note);
  const tabs = [...dialog.querySelectorAll('[data-tab]')];
  paintStallArt(dialog);
  let tab = 'sell';

  const say = (text) => {
    setRich(note, text);
  };

  function sellRow(item) {
    const info = ITEMS[item];
    const have = purse.count(item);
    const price = trade.quote(item);
    const buying = trade.buying(item);
    const sellSome = (count) => () => {
      const before = purse.count(item);
      const earned = market.sell(purse, item, count);
      const sold = before - purse.count(item);
      if (sold > 0) say(`Bán ${sold} ${info.unit} ${info.name.toLowerCase()} được ${coins(earned)}.`);
      else say('Tiệm hết tiền mua rồi.');
      render();
    };
    return stallCard({
      key: `sell:${item}`,
      icon: info.icon,
      art: info.art,
      title: info.name,
      price,
      unit: info.unit,
      tag: `có ${have}`,
      actions:
        have >= 1 && !buying
          ? [{ label: 'Hết tiền', disabled: true, run: () => {} }]
          : [
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
      else if (!trade.available(item, count)) say('Hết hàng rồi.');
      else say(notEnough(price * count));
      render();
    };
    const stocked = trade.available(item);
    const actions = owned
      ? [{ label: 'Đã có', disabled: true, run: () => {} }]
      : stocked
        ? [{ label: 'Mua 1', disabled: purse.money < price, run: purchase(1) }]
        : [{ label: 'Hết hàng', disabled: true, run: () => {} }];
    if (many > 1 && !owned && stocked) actions.push({ label: `Mua ${many}`, disabled: purse.money < price * many || !trade.available(item, many), run: purchase(many) });
    return stallCard({
      key: `buy:${item}`,
      icon: info.icon,
      art: info.art,
      title: info.name,
      price,
      unit,
      tag: `có ${purse.count(item)}`,
      detail,
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
    money.textContent = amount(purse.money);
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
    if (!dialog.open || 'energy' in detail) return;
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
    greeting: 'Yoshiko: "Mua gì bán gì cứ tự nhiên nghen!"',
    sellItems: () => [...Object.keys(CROPS), ...Object.keys(WILDLIFE).map(gameId).filter((item) => ITEMS[item] && purse.count(item) > 0)],
    buyItems: () => [
      ...Object.keys(CROPS)
        .sort((a, b) => growDays(a) - growDays(b))
        .map((crop) => [seedId(crop), `thu sau ${durationText(growDays(crop) * DAY_MINUTES)}`]),
      ['fertilizer', 'bù lại 1 lần lỡ tưới'],
    ],
  });
}

export function createMartUI({ market, purse }) {
  return createStallUI({
    market,
    purse,
    ids: { dialog: 'martDialog', list: 'martList', money: 'martMoney', note: 'martNote' },
    greeting: 'Jessica: "Đồ ăn đóng gói tiện mang theo nè!"',
    sellItems: () => [],
    buyItems: () => Object.entries(SNACKS).map(([id, snack]) => [snackId(id), `+${snack.energy} năng lượng`]),
  });
}

export function createFishShopUI({ market, purse }) {
  return createStallUI({
    market,
    purse,
    ids: { dialog: 'fishShopDialog', list: 'fishShopList', money: 'fishShopMoney', note: 'fishShopNote' },
    greeting: 'Bobby: "Cá tươi rói đây, bán mua gì cứ nói!"',
    sellItems: () => Object.keys(FISH).map(fishId),
    buyItems: () => [
      ['bait', `mỗi gói ${FISHING.baitPerPack} lần câu`, { unit: 'gói' }],
      ['rod', 'ra bến sông Hoài câu cá', { many: 1, owned: purse.count('rod') > 0 }],
    ],
  });
}
