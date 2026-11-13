import { paintIcon } from './itemArt.js';
import { ITEMS } from './inventory.js';
import { MONEY, SNACKS } from './config.js';
import { amount } from './format.js';
import { GOLD_HTML } from './goldArt.js';

const TAB_KEY = 'truong-lang-xua.bagTab';
const COLUMNS = 5;
const MIN_SLOTS = 20;
const TABS = [
  { key: 'seed', icon: '🌱', label: 'Hạt giống', kinds: ['seed'], empty: 'Chưa có hạt giống. Ra tiệm buôn mua nhé!' },
  { key: 'produce', icon: '🥬', label: 'Nông sản', kinds: ['produce'], empty: 'Chưa thu hoạch được gì.' },
  { key: 'fish', icon: '🐟', label: 'Thủy sản', kinds: ['fish'], empty: 'Chưa câu được con nào.' },
  { key: 'game', icon: '🐇', label: 'Thú rừng', kinds: ['game'], empty: 'Chưa bắt được con nào.' },
  { key: 'food', icon: '🍱', label: 'Đồ ăn', kinds: ['snack'], empty: 'Chưa có đồ ăn mang theo.' },
  { key: 'tools', icon: '🎣', label: 'Đồ nghề', kinds: ['gear', 'fertilizer'], empty: 'Chưa có đồ nghề.' },
];

function loadTab() {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (TABS.some((tab) => tab.key === saved)) return saved;
  } catch {}
  return TABS[0].key;
}

function filledSlot(id, value, selected) {
  const item = ITEMS[id];
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'bag-slot filled';
  node.dataset.id = id;
  node.setAttribute('aria-label', `${item.name}: ${value}`);
  node.setAttribute('aria-pressed', String(selected));
  const icon = document.createElement('span');
  icon.className = 'bag-slot-icon';
  icon.setAttribute('aria-hidden', 'true');
  paintIcon(icon, item);
  const count = document.createElement('span');
  count.className = 'bag-slot-count';
  count.setAttribute('aria-hidden', 'true');
  count.textContent = value > 999 ? '999+' : String(value);
  node.append(icon, count);
  return node;
}

function emptySlot() {
  const node = document.createElement('span');
  node.className = 'bag-slot';
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function createBag(purse) {
  const button = document.getElementById('bagBtn');
  const panel = document.getElementById('bagPanel');
  const veil = document.getElementById('bagVeil');
  const close = document.getElementById('bagClose');
  const tabBar = panel.querySelector('.bag-tabs');
  const slots = document.getElementById('bagSlots');
  const category = document.getElementById('bagCategory');
  const info = document.getElementById('bagInfo');
  const wallet = document.getElementById('walletAmount');
  const walletPill = document.getElementById('wallet');
  document.getElementById('walletGold').innerHTML = GOLD_HTML;
  let current = loadTab();
  let selected = null;
  let hovered = null;

  const entriesOf = (tab) => tab.kinds.flatMap((kind) => purse.entries(kind));
  const currentTab = () => TABS.find((item) => item.key === current);

  const tabs = TABS.map((tab) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'bag-tab';
    node.setAttribute('role', 'tab');
    node.id = `bagTab-${tab.key}`;
    node.setAttribute('aria-controls', 'bagSlots');
    node.setAttribute('aria-label', tab.label);
    node.title = tab.label;
    node.textContent = tab.icon;
    node.addEventListener('click', () => {
      if (current === tab.key) return;
      current = tab.key;
      selected = null;
      hovered = null;
      try {
        localStorage.setItem(TAB_KEY, current);
      } catch {}
      render();
    });
    tabBar.append(node);
    return { tab, node };
  });

  function renderInfo() {
    const id = hovered ?? selected;
    const value = id ? purse.count(id) : 0;
    info.classList.toggle('muted', !id);
    if (id && value > 0) {
      const snack = SNACKS[ITEMS[id].snack];
      info.textContent = snack ? `${ITEMS[id].name} × ${value} · +${snack.energy} năng lượng` : `${ITEMS[id].name} × ${value}`;
      if (snack && id === selected) info.append(eatButton(id, snack));
      return;
    }
    info.textContent = entriesOf(currentTab()).length ? '' : currentTab().empty;
  }

  function eatButton(id, snack) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'bag-eat';
    node.textContent = 'Ăn';
    node.disabled = purse.full;
    node.addEventListener('click', () => {
      if (purse.full || !purse.take(id, 1)) return;
      purse.addEnergy(snack.energy);
    });
    return node;
  }

  function renderWallet() {
    wallet.textContent = amount(purse.money);
    walletPill.title = `Tiền: ${amount(purse.money)} ${MONEY.name}`;
  }

  function render() {
    const tab = currentTab();
    category.textContent = ` · ${tab.label}`;
    for (const { tab: item, node } of tabs) {
      const active = item.key === current;
      node.setAttribute('aria-selected', String(active));
      node.tabIndex = active ? 0 : -1;
      node.classList.toggle('empty', entriesOf(item).length === 0);
      if (active) slots.setAttribute('aria-labelledby', node.id);
    }
    const entries = entriesOf(tab);
    if (selected && purse.count(selected) <= 0) selected = null;
    if (hovered && purse.count(hovered) <= 0) hovered = null;
    const total = Math.max(MIN_SLOTS, Math.ceil(entries.length / COLUMNS) * COLUMNS);
    const nodes = entries.map(([id, value]) => filledSlot(id, value, id === selected));
    while (nodes.length < total) nodes.push(emptySlot());
    slots.replaceChildren(...nodes);
    renderInfo();
  }

  slots.addEventListener('click', (event) => {
    const node = event.target.closest('.bag-slot.filled');
    if (!node) return;
    selected = selected === node.dataset.id ? null : node.dataset.id;
    for (const slot of slots.querySelectorAll('.bag-slot.filled')) slot.setAttribute('aria-pressed', String(slot.dataset.id === selected));
    renderInfo();
  });
  slots.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const id = event.target.closest('.bag-slot.filled')?.dataset.id ?? null;
    if (id === hovered) return;
    hovered = id;
    renderInfo();
  });
  slots.addEventListener('pointerleave', () => {
    if (!hovered) return;
    hovered = null;
    renderInfo();
  });

  function setOpen(open) {
    if (open) render();
    else hovered = null;
    panel.hidden = !open;
    veil.hidden = !open;
    document.body.classList.toggle('bag-open', open);
    button.classList.toggle('active', open);
    button.setAttribute('aria-expanded', String(open));
    if (open) close.focus({ preventScroll: true });
  }

  button.addEventListener('click', () => setOpen(panel.hidden));
  button.addEventListener('pointerup', () => button.blur());
  close.addEventListener('click', () => setOpen(false));
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
