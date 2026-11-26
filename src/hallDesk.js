import { dayOf } from './clock.js';
import { coins } from './format.js';
import { closable, el } from './dialog.js';
import { setRich } from './goldArt.js';
import { paintStallArt } from './stallCard.js';
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
  lodge: ['🛏️', 'Tiền phòng trọ'],
  arenaFee: ['⚔️', 'Phí lôi đài'],
  blessing: ['✨', 'Phí chúc phúc'],
  lantern: ['🏮', 'Phí hội đèn trời'],
  loto: ['🎴', 'Phí lô tô chữ'],
  fireworks: ['🎆', 'Phí hội pháo hoa'],
  market: ['🧺', 'Phí chợ'],
  tuition: ['📚', 'Học phí'],
  capital: ['🏪', 'Thu hồi vốn tiệm'],
};
const EXPENSE_NAMES = {
  wage: ['🎖️', 'Lương quan viên'],
  stipend: ['🎓', 'Học bổng'],
  blessing: ['✨', 'Lễ chúc phúc'],
  lantern: ['🏮', 'Hội đèn trời'],
  loto: ['🎴', 'Thưởng lô tô chữ'],
  arena: ['🏆', 'Giải lôi đài'],
  fireworks: ['🎆', 'Giải hội pháo hoa'],
  quest: ['📋', 'Thưởng nhiệm vụ'],
  buyback: ['🏚️', 'Mua lại nhà'],
  capital: ['🏪', 'Cấp vốn tiệm'],
};

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

  function render() {
    setRich(money, coins(economy.treasury));
    for (const node of tabs) node.setAttribute('aria-selected', String(node.dataset.tab === tab));
    const day = dayOf(now());
    const rows = tab === 'week' ? ledgerRows(day - WEEK + 1, day) : ledgerRows(day, day);
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
      if (choice === 'today' || choice === 'week') tab = choice;
      list.scrollTop = 0;
      render();
      dialog.showModal();
    },
  };
}
