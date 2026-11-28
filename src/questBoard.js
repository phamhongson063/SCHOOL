import { QUEST } from './config.js';
import { DECKS } from './studyDecks.js';
import { coins } from './format.js';
import { el } from './dialog.js';
import { setRich } from './goldArt.js';

const TABS = [
  { scope: 'day', icon: '📋', label: 'Hằng ngày' },
  { scope: 'week', icon: '🔗', label: 'Liên hoàn' },
];
const REFRESH_MS = 3000;

const STEP_TEXT = {
  learn: (step) => [`Học ${step.goal} ${DECKS[step.deck]?.unit ?? 'từ'} mới ở `, step.deck],
  sit: (step) => [`Luyện tập ${step.goal} phút ở `, step.deck],
  review: (step) => [`Ôn chứng chỉ ${step.goal} lượt ở `, step.deck],
  speak: (step) => [`Luyện nói ${step.goal} hội thoại ở `, step.deck],
  internal: (step) => [step.goal > 1 ? `Đậu thi nội bộ ${step.goal} lần ở ` : 'Đậu thi nội bộ ở ', step.deck],
  exam: (step) => [`Đậu khảo thí ${DECKS[step.deck]?.label ?? step.deck}${step.goal > 1 ? ` ${step.goal} lần` : ''} ở `, step.deck],
  farm: (step) => [`Làm ${step.goal} việc đồng áng`],
  fish: (step) => [`Câu được ${step.goal} con cá`],
  hunt: (step) => [`Săn được ${step.goal} con thú`],
};

export function createQuestBoard({ list, active, reward, act, placeOf, onTravel }) {
  const button = document.getElementById('questBtn');
  const dot = document.getElementById('questDot');
  const panel = document.getElementById('questPanel');
  const veil = document.getElementById('questVeil');
  const close = document.getElementById('questClose');
  const tabBar = panel.querySelector('.bag-tabs');
  const rows = document.getElementById('questList');
  const category = document.getElementById('questCategory');
  let tab = TABS[0];

  const tabNodes = TABS.map((item) => {
    const node = el('button', 'bag-tab quest-tab', item.icon);
    node.type = 'button';
    node.id = `questTab-${item.scope}`;
    node.setAttribute('role', 'tab');
    node.setAttribute('aria-controls', 'questList');
    node.setAttribute('aria-label', item.label);
    node.title = item.label;
    node.addEventListener('click', () => {
      tab = item;
      rows.scrollTop = 0;
      render();
    });
    tabBar.append(node);
    return node;
  });

  const isOpen = () => !panel.hidden;

  function stepNode(step, state, count) {
    const node = el('div', `quest-step ${state}`);
    const [text, deck] = STEP_TEXT[step.kind](step);
    const label = el('span', 'quest-step-text', text);
    const place = deck ? placeOf(deck, step.kind) : null;
    if (place) {
      const link = el('button', 'quest-place', place.name);
      link.type = 'button';
      link.addEventListener('click', () => {
        setOpen(false);
        onTravel(place.point);
      });
      label.append(link);
    } else if (deck) label.append(DECKS[deck]?.label ?? deck);
    const mark = state === 'done' ? '✓' : state === 'now' ? `${count}/${step.goal}` : '';
    node.append(el('span', 'quest-step-icon', QUEST.kinds[step.kind].icon), label, el('span', 'quest-step-count', mark));
    if (state === 'now') {
      const bar = el('span', 'quest-bar');
      const fill = el('span', 'quest-bar-fill');
      fill.style.width = `${Math.round((count / step.goal) * 100)}%`;
      bar.append(fill);
      node.append(bar);
    }
    return node;
  }

  function stepState(quest, i) {
    if (quest.status === 'open') return 'later';
    if (i < quest.step) return 'done';
    return i === quest.step ? 'now' : 'later';
  }

  function actButton(quest, full) {
    const [label, action, primary] =
      quest.status === 'open' ? ['Nhận', 'accept', false] : quest.status === 'ready' ? ['Nhận thưởng', 'claim', true] : quest.status === 'active' ? ['Huỷ', 'drop', false] : ['Đã xong', null, false];
    const node = el('button', primary ? 'quest-act primary' : 'quest-act', label);
    node.type = 'button';
    node.disabled = !action || (action === 'accept' && (full || quest.blocked));
    if (action) {
      node.addEventListener('click', () => {
        act(quest, action);
        render();
      });
    }
    return node;
  }

  function questCard(quest, full) {
    const card = el('div', `quest-card ${quest.status}`);
    const steps = el('div', 'quest-steps');
    steps.append(...quest.steps.map((step, i) => stepNode(step, stepState(quest, i), quest.count)));
    const foot = el('div', 'quest-foot');
    if (quest.steps.length > 1) foot.append(el('span', 'quest-chain', `🔗 ${Math.min(quest.step, quest.steps.length)}/${quest.steps.length}`));
    const money = el('span', 'quest-reward');
    if (quest.status !== 'done') setRich(money, coins(reward(quest.scope)));
    foot.append(money, actButton(quest, full));
    card.append(steps, foot);
    return card;
  }

  function render() {
    const quests = list();
    const taken = active();
    const full = taken >= QUEST.active;
    TABS.forEach((item, i) => {
      tabNodes[i].setAttribute('aria-selected', String(item === tab));
      tabNodes[i].classList.toggle('ready', quests.some((quest) => quest.scope === item.scope && quest.status === 'ready'));
    });
    rows.setAttribute('aria-labelledby', `questTab-${tab.scope}`);
    category.textContent = ` · ${tab.label} · ${taken}/${QUEST.active}`;
    const order = { ready: 0, active: 1, open: 2, done: 3 };
    const shown = quests.filter((quest) => quest.scope === tab.scope).sort((a, b) => order[a.status] - order[b.status] || a.index - b.index);
    const scroll = rows.scrollTop;
    rows.replaceChildren(...shown.map((quest) => questCard(quest, full)));
    rows.scrollTop = scroll;
  }

  function refresh() {
    dot.hidden = !list().some((quest) => quest.status === 'ready');
    if (isOpen()) render();
  }

  function setOpen(open) {
    if (open) {
      for (const id of ['bagPanel', 'mailPanel']) {
        if (!document.getElementById(id).hidden) document.getElementById(id === 'bagPanel' ? 'bagClose' : 'mailClose').click();
      }
      render();
    }
    panel.hidden = !open;
    veil.hidden = !open;
    document.body.classList.toggle('quest-open', open);
    button.classList.toggle('active', open);
    button.setAttribute('aria-expanded', String(open));
    if (open) close.focus({ preventScroll: true });
  }

  button.addEventListener('click', () => setOpen(panel.hidden));
  button.addEventListener('pointerup', () => button.blur());
  close.addEventListener('click', () => setOpen(false));
  veil.addEventListener('click', () => setOpen(false));
  for (const id of ['bagBtn', 'mailBtn']) {
    document.getElementById(id).addEventListener('click', () => {
      if (isOpen()) setOpen(false);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) setOpen(false);
  });
  setInterval(refresh, REFRESH_MS);
  refresh();

  return { refresh };
}
