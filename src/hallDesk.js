import { ARENA, BLESSING } from './config.js';
import { clockText, dayOf } from './clock.js';
import { coins } from './format.js';
import { closable } from './dialog.js';
import { setRich } from './goldArt.js';
import { paintStallArt } from './stallCard.js';
import { blessingSlots } from './economy.js';
import { EXPENSE_KINDS, INCOME_KINDS, sideTotal } from './townhall.js';

const WEEK = 7;
const REFRESH_MS = 3000;
const INCOME_NAMES = {
  vat: ['🧾', 'Thuế buôn bán'],
  levy: ['💼', 'Thuế thu nhập'],
  poll: ['👥', 'Thuế đinh'],
  house: ['🏠', 'Thuế nhà'],
  estate: ['🏡', 'Bán nhà'],
  land: ['🌾', 'Thuê ruộng'],
  arena: ['⚔️', 'Dư giải lôi đài'],
};
const EXPENSE_NAMES = {
  wage: ['🎖️', 'Lương quan viên'],
  blessing: ['✨', 'Lễ chúc phúc'],
  arena: ['🏆', 'Giải lôi đài'],
  buyback: ['🏚️', 'Mua lại nhà'],
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(icon, label, value, { strong = false, sign = '' } = {}) {
  const item = el('div', strong ? 'hall-row total' : 'hall-row');
  const money = el('span', sign === '-' ? 'hall-money out' : sign === '+' ? 'hall-money in' : 'hall-money');
  setRich(money, `${sign}${coins(Math.round(value))}`);
  item.append(el('span', 'hall-icon', icon), el('span', 'hall-label', label), money);
  return item;
}

function sideRows(side, kinds, names, sign) {
  return kinds.filter((kind) => side[kind] >= 0.5).map((kind) => row(names[kind][0], names[kind][1], side[kind], { sign }));
}

export function hallMenu(economy) {
  return [
    { id: 'today', name: 'Thu chi hôm nay', icon: '📜', art: 'scroll' },
    { id: 'week', name: `Thu chi ${WEEK} ngày`, icon: '📊', art: 'scroll' },
    { id: 'plan', name: 'Lịch hôm nay', icon: '🗓️', art: 'scroll' },
    { id: 'fund', name: `Ngân khố ${coins(economy.treasury)}`, icon: '🏛️', info: true },
  ];
}

export function createHallUI({ economy, now }) {
  const dialog = document.getElementById('hallDialog');
  const list = document.getElementById('hallList');
  const money = document.getElementById('hallMoney');
  const tabs = [...dialog.querySelectorAll('[data-tab]')];
  let tab = 'today';
  paintStallArt(dialog);

  function ledgerRows(fromDay, toDay) {
    const book = economy.book(fromDay, toDay);
    const earned = sideTotal(book.in);
    const spent = sideTotal(book.out);
    const income = sideRows(book.in, INCOME_KINDS, INCOME_NAMES, '+');
    const expense = sideRows(book.out, EXPENSE_KINDS, EXPENSE_NAMES, '-');
    const net = earned - spent;
    return [
      el('h3', 'bank-ribbon', 'Thu'),
      ...(income.length ? income : [el('p', 'bank-empty', 'Chưa có khoản thu.')]),
      row('🪙', 'Tổng thu', earned, { strong: true, sign: '+' }),
      el('h3', 'bank-ribbon', 'Chi'),
      ...(expense.length ? expense : [el('p', 'bank-empty', 'Chưa có khoản chi.')]),
      row('🪙', 'Tổng chi', spent, { strong: true, sign: '-' }),
      row('⚖️', 'Chênh lệch', Math.abs(net), { strong: true, sign: net >= 0 ? '+' : '-' }),
    ];
  }

  function planRows(day) {
    const slots = blessingSlots(day);
    const times = el('div', 'hall-times');
    times.append(...slots.map(({ start, end }) => el('span', 'hall-time', `${clockText(start)}–${clockText(end)}`)));
    return [
      el('h3', 'bank-ribbon', 'Chúc phúc'),
      row('✨', `${slots.length}/${BLESSING.windows.length} buổi`, slots.length * BLESSING.cost),
      times,
      el('h3', 'bank-ribbon', 'Lôi đài'),
      row('🏆', `Giải mỗi trận · ${ARENA.starts.length} trận`, economy.arenaPrize()),
      el('h3', 'bank-ribbon', 'Ngân khố'),
      row('🏛️', 'Dự trữ', economy.reserve(day)),
    ];
  }

  function render() {
    setRich(money, coins(economy.treasury));
    for (const node of tabs) node.setAttribute('aria-selected', String(node.dataset.tab === tab));
    const day = dayOf(now());
    const rows = tab === 'plan' ? planRows(day) : tab === 'week' ? ledgerRows(day - WEEK + 1, day) : ledgerRows(day, day);
    const scroll = list.scrollTop;
    list.replaceChildren(...rows);
    list.scrollTop = scroll;
  }

  for (const node of tabs) {
    node.addEventListener('click', () => {
      tab = node.dataset.tab;
      list.scrollTop = 0;
      render();
    });
  }
  closable(dialog);
  setInterval(() => {
    if (dialog.open) render();
  }, REFRESH_MS);

  return {
    get isOpen() {
      return dialog.open;
    },
    open(choice) {
      if (choice === 'today' || choice === 'week' || choice === 'plan') tab = choice;
      list.scrollTop = 0;
      render();
      dialog.showModal();
    },
  };
}
