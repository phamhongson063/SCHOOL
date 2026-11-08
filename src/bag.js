import { paintIcon } from './itemArt.js';
import { ITEMS } from './inventory.js';
import { MONEY } from './config.js';
import { amount } from './format.js';

const TAB_KEY = 'truong-lang-xua.bagTab';
const TABS = [
  { key: 'seed', icon: '🌱', label: 'Hạt giống', kinds: ['seed'], empty: 'Chưa có hạt giống. Ra tiệm buôn mua nhé!' },
  { key: 'produce', icon: '🥬', label: 'Nông sản', kinds: ['produce'], empty: 'Chưa thu hoạch được gì.' },
  { key: 'fish', icon: '🐟', label: 'Thủy sản', kinds: ['fish'], empty: 'Chưa câu được con nào.' },
  { key: 'game', icon: '🐇', label: 'Thú rừng', kinds: ['game'], empty: 'Chưa bắt được con nào.' },
  { key: 'tools', icon: '🎣', label: 'Đồ nghề', kinds: ['gear', 'fertilizer'], empty: 'Chưa có đồ nghề.' },
];

function loadTab() {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (TABS.some((tab) => tab.key === saved)) return saved;
  } catch {}
  return TABS[0].key;
}

function slot(id, amount) {
  const item = ITEMS[id];
  const node = document.createElement('div');
  node.className = item.kind === 'seed' ? 'bag-slot seed' : 'bag-slot';
  node.dataset.id = id;
  node.dataset.tip = `${item.name}: ${amount}`;
  node.setAttribute('aria-label', node.dataset.tip);
  const icon = document.createElement('span');
  icon.className = 'bag-slot-icon';
  icon.setAttribute('aria-hidden', 'true');
  paintIcon(icon, item);
  const count = document.createElement('span');
  count.className = 'bag-slot-count';
  count.textContent = amount;
  node.append(icon, count);
  if (item.kind === 'seed') {
    const badge = document.createElement('span');
    badge.className = 'bag-slot-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = '🌱';
    node.append(badge);
  }
  return node;
}

export function createBag(purse) {
  const button = document.getElementById('bagBtn');
  const panel = document.getElementById('bagPanel');
  const tabBar = panel.querySelector('.bag-tabs');
  const slots = document.getElementById('bagSlots');
  const empty = panel.querySelector('.bag-empty');
  const money = document.getElementById('bagMoney');
  const credits = document.getElementById('bagCredits');
  const wallet = document.getElementById('walletAmount');
  const walletPill = document.getElementById('wallet');
  let current = loadTab();
  const tip = document.createElement('div');
  tip.className = 'bag-tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  document.body.append(tip);
  let hovered = null;

  function showTip() {
    const node = hovered && !panel.hidden ? slots.querySelector(`[data-id="${CSS.escape(hovered)}"]`) : null;
    tip.hidden = !node;
    if (!node) return;
    tip.textContent = node.dataset.tip;
    const box = node.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const x = Math.min(window.innerWidth - half - 8, Math.max(half + 8, box.left + box.width / 2));
    tip.style.left = `${x}px`;
    tip.style.top = `${box.top - 6}px`;
  }

  slots.addEventListener('pointerover', (event) => {
    const node = event.target.closest('.bag-slot');
    if (!node || node.dataset.id === hovered) return;
    hovered = node.dataset.id;
    showTip();
  });
  slots.addEventListener('pointerleave', () => {
    hovered = null;
    showTip();
  });
  slots.addEventListener('scroll', showTip, { passive: true });

  const entriesOf = (tab) => tab.kinds.flatMap((kind) => purse.entries(kind));

  const tabs = TABS.map((tab) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'bag-tab';
    node.setAttribute('role', 'tab');
    node.id = `bagTab-${tab.key}`;
    node.setAttribute('aria-controls', 'bagSlots');
    const icon = document.createElement('span');
    icon.className = 'bag-tab-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = tab.icon;
    const label = document.createElement('span');
    label.className = 'bag-tab-label';
    label.textContent = tab.label;
    const count = document.createElement('span');
    count.className = 'bag-tab-count';
    node.append(icon, label, count);
    node.addEventListener('click', () => {
      current = tab.key;
      try {
        localStorage.setItem(TAB_KEY, current);
      } catch {}
      render();
    });
    tabBar.append(node);
    return { tab, node, count };
  });

  function renderWallet() {
    wallet.textContent = amount(purse.money);
    walletPill.title = `Tiền: ${amount(purse.money)} ${MONEY.name}`;
  }

  function render() {
    money.textContent = `${MONEY.icon} ${amount(purse.money)} ${MONEY.name}`;
    credits.textContent = purse.credits ? `📖 Đã đóng trước ${purse.credits} tiết` : '';
    credits.hidden = !purse.credits;
    for (const { tab, node, count } of tabs) {
      const selected = tab.key === current;
      const total = entriesOf(tab).reduce((sum, [, value]) => sum + value, 0);
      node.setAttribute('aria-selected', String(selected));
      node.tabIndex = selected ? 0 : -1;
      count.textContent = total > 99 ? '99+' : String(total);
      count.hidden = total === 0;
      if (selected) slots.setAttribute('aria-labelledby', node.id);
    }
    const tab = TABS.find((item) => item.key === current);
    const entries = entriesOf(tab);
    slots.replaceChildren(...entries.map(([id, value]) => slot(id, value)));
    empty.textContent = tab.empty;
    empty.hidden = entries.length > 0;
    showTip();
  }

  function setOpen(open) {
    if (open) render();
    panel.hidden = !open;
    if (!open) hovered = null;
    showTip();
    button.classList.toggle('active', open);
    button.setAttribute('aria-expanded', String(open));
  }

  button.addEventListener('click', () => setOpen(panel.hidden));
  button.addEventListener('pointerup', () => button.blur());
  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  renderWallet();
  purse.onChange((detail) => {
    renderWallet();
    if (!panel.hidden) render();
    if (detail.money) {
      walletPill.classList.remove('bump');
      void walletPill.offsetWidth;
      walletPill.classList.add('bump');
    }
    if (!(detail.amount > 0)) return;
    button.classList.remove('bump');
    void button.offsetWidth;
    button.classList.add('bump');
  });
}
