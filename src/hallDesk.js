import { ARENA, BLESSING, LOTO } from './config.js';
import { clockText, dayOf } from './clock.js';
import { coins } from './format.js';
import { closable } from './dialog.js';
import { setRich } from './goldArt.js';
import { paintStallArt } from './stallCard.js';
import { blessingSlots } from './economy.js';
import { EXPENSE_KINDS, INCOME_KINDS, sideTotal } from './townhall.js';

const WEEK = 7;
const QUEST_RIBBONS = [
  ['day', 'Hôm nay'],
  ['week', 'Tuần này'],
];
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
  market: ['🧺', 'Phí chợ'],
  capital: ['🏪', 'Thu hồi vốn tiệm'],
};
const EXPENSE_NAMES = {
  wage: ['🎖️', 'Lương quan viên'],
  blessing: ['✨', 'Lễ chúc phúc'],
  lantern: ['🏮', 'Hội đèn trời'],
  loto: ['🎴', 'Thưởng lô tô chữ'],
  arena: ['🏆', 'Giải lôi đài'],
  quest: ['📋', 'Thưởng nhiệm vụ'],
  buyback: ['🏚️', 'Mua lại nhà'],
  capital: ['🏪', 'Cấp vốn tiệm'],
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
    { id: 'quests', name: 'Nhiệm vụ', icon: '📋', art: 'scroll' },
    { id: 'plan', name: 'Lịch hôm nay', icon: '🗓️', art: 'scroll' },
    { id: 'fund', name: `Ngân khố ${coins(economy.treasury)}`, icon: '🏛️', info: true },
  ];
}

export function createHallUI({ economy, now, quests }) {
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
      row('✨', `${slots.length}/${BLESSING.windows.length} buổi`, economy.blessingBudget(day)),
      times,
      el('h3', 'bank-ribbon', 'Lôi đài'),
      row('🏆', `Giải mỗi trận · ${ARENA.starts.length} trận`, economy.arenaPrize()),
      el('h3', 'bank-ribbon', 'Lô tô chữ'),
      row('🎴', `Quỹ thưởng · ${clockText(LOTO.start)}`, LOTO.purse),
      el('h3', 'bank-ribbon', 'Nhiệm vụ'),
      row('📋', 'Quỹ thưởng', economy.questBudget(day)),
      el('h3', 'bank-ribbon', 'Ngân khố'),
      row('🏛️', 'Dự trữ', economy.reserve(day)),
    ];
  }

  function questButton(quest, label, primary) {
    const button = el('button', primary ? 'bank-btn primary' : 'bank-btn', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      quests.act(quest);
      render();
    });
    return button;
  }

  function questRow(quest) {
    const item = el('div', `hall-row quest-row ${quest.status}`);
    const money = el('span', 'hall-money');
    if (quest.status !== 'done') setRich(money, coins(economy.questReward(quest.scope)));
    const end =
      quest.status === 'open' ? questButton(quest, 'Nhận', false) : quest.status === 'ready' ? questButton(quest, 'Trả', true) : el('span', 'quest-mark', quest.status === 'done' ? '✓' : '');
    item.append(el('span', 'hall-icon', quest.icon), el('span', 'hall-label', `${quest.name} ${quest.count}/${quest.goal}`), money, end);
    return item;
  }

  function questRows() {
    const list = quests.list();
    return QUEST_RIBBONS.flatMap(([scope, title]) => [el('h3', 'bank-ribbon', title), ...list.filter((quest) => quest.scope === scope).map(questRow)]);
  }

  function render() {
    setRich(money, coins(economy.treasury));
    for (const node of tabs) node.setAttribute('aria-selected', String(node.dataset.tab === tab));
    const day = dayOf(now());
    const rows = tab === 'quests' ? questRows() : tab === 'plan' ? planRows(day) : tab === 'week' ? ledgerRows(day - WEEK + 1, day) : ledgerRows(day, day);
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
      if (choice === 'today' || choice === 'week' || choice === 'plan' || choice === 'quests') tab = choice;
      list.scrollTop = 0;
      render();
      dialog.showModal();
    },
  };
}
