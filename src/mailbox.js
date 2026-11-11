import { clockText, gameNow } from './clock.js';
import { setRich } from './goldArt.js';

const TABS = [{ key: 'system', icon: '🔔', label: 'Hệ thống', empty: 'Chưa có thư.' }];
const KINDS = {
  ripe: { icon: '🧺', body: (crops) => `${crops} đã chín, ra thu hoạch thôi!` },
  water: { icon: '💧', body: (crops) => `${crops} đang khát nước, tưới ngay nhé!` },
};
const KIND_ORDER = Object.keys(KINDS);
const MIXED = { icon: '📬' };

function choreView(mail) {
  const kinds = KIND_ORDER.filter((kind) => mail.events.has(kind));
  const mixed = kinds.length > 1;
  const kind = mixed ? MIXED : KINDS[kinds[0]];
  const lines = kinds.map((id) => {
    const text = KINDS[id].body(mail.events.get(id).join(', '));
    return mixed ? `${KINDS[id].icon} ${text}` : text;
  });
  return { icon: kind.icon, lines };
}

function mailRow(mail) {
  const kind = mail.events ? choreView(mail) : mail;
  const row = document.createElement('div');
  row.className = mail.read ? 'mail-row' : 'mail-row unread';
  row.dataset.id = String(mail.id);
  const icon = document.createElement('span');
  icon.className = 'mail-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = kind.icon;
  const side = document.createElement('div');
  side.className = 'mail-side';
  side.append(icon);
  const main = document.createElement('div');
  main.className = 'mail-main';
  const head = document.createElement('div');
  head.className = 'mail-head';
  const time = document.createElement('span');
  time.className = 'mail-time';
  time.textContent = clockText(mail.at);
  head.append(time);
  const lines = kind.lines.map((text) => {
    const line = document.createElement('p');
    line.className = 'mail-body';
    setRich(line, text);
    return line;
  });
  main.append(...lines);
  if (mail.point) {
    const place = document.createElement('button');
    place.type = 'button';
    place.className = 'mail-place';
    place.textContent = `X: ${Math.round(mail.point.x)}  Y: ${Math.round(mail.point.z)}`;
    const last = lines.at(-1);
    if (last) last.append(' ', place);
    else main.append(place);
  }
  row.append(side, main, head);
  return row;
}

export function createMailbox({ onTravel }) {
  const button = document.getElementById('mailBtn');
  const dot = document.getElementById('mailDot');
  const panel = document.getElementById('mailPanel');
  const veil = document.getElementById('mailVeil');
  const close = document.getElementById('mailClose');
  const tabBar = panel.querySelector('.bag-tabs');
  const list = document.getElementById('mailList');
  const category = document.getElementById('mailCategory');
  const bagPanel = document.getElementById('bagPanel');
  const mails = new Map();
  const owners = new Map();
  const skipped = new Set();
  let order = 0;
  const tab = TABS[0];

  const tabNode = document.createElement('button');
  tabNode.type = 'button';
  tabNode.className = 'bag-tab';
  tabNode.setAttribute('role', 'tab');
  tabNode.id = `mailTab-${tab.key}`;
  tabNode.setAttribute('aria-controls', 'mailList');
  tabNode.setAttribute('aria-selected', 'true');
  tabNode.setAttribute('aria-label', tab.label);
  tabNode.title = tab.label;
  tabNode.textContent = tab.icon;
  tabBar.append(tabNode);
  list.setAttribute('aria-labelledby', tabNode.id);
  category.textContent = ` · ${tab.label}`;

  const isOpen = () => !panel.hidden;

  function render() {
    const sorted = [...mails.values()].sort((a, b) => b.order - a.order);
    if (!sorted.length) {
      const empty = document.createElement('p');
      empty.className = 'mail-empty';
      empty.textContent = tab.empty;
      list.replaceChildren(empty);
      return;
    }
    const scroll = list.scrollTop;
    list.replaceChildren(...sorted.map(mailRow));
    list.scrollTop = scroll;
  }

  function refresh() {
    dot.hidden = ![...mails.values()].some((mail) => !mail.read);
    if (isOpen()) render();
  }

  function markRead(id) {
    const mail = mails.get(id);
    if (!mail || mail.read) return;
    mail.read = true;
    refresh();
  }

  function setOpen(open) {
    if (open && !bagPanel.hidden) document.getElementById('bagClose').click();
    if (open) render();
    panel.hidden = !open;
    veil.hidden = !open;
    document.body.classList.toggle('mail-open', open);
    button.classList.toggle('active', open);
    button.setAttribute('aria-expanded', String(open));
    if (open) close.focus({ preventScroll: true });
  }

  function post(chore) {
    const mail = [...mails.values()].find((item) => item.events && item.bed === chore.bed && !item.read);
    if (mail) {
      mail.events.set(chore.kind, chore.crops);
      mail.at = gameNow();
      mail.order = order++;
      return mail.id;
    }
    const id = order;
    mails.set(id, { id, bed: chore.bed, place: chore.place, point: chore.point, events: new Map([[chore.kind, chore.crops]]), at: gameNow(), order: order++, read: false });
    return id;
  }

  function notify({ icon, lines, place, point }) {
    const id = order;
    mails.set(id, { id, icon, lines, place, point, at: gameNow(), order: order++, read: false });
    refresh();
    return id;
  }

  function remove(id) {
    if (mails.delete(id)) refresh();
  }

  function sync(chores) {
    const seen = new Set();
    let changed = false;
    for (const chore of chores) {
      seen.add(chore.key);
      const owner = mails.get(owners.get(chore.key));
      if (owner) {
        if (owner.events.get(chore.kind).join() !== chore.crops.join()) {
          owner.events.set(chore.kind, chore.crops);
          changed = true;
        }
        continue;
      }
      if (skipped.has(chore.key)) continue;
      if (chore.here) {
        skipped.add(chore.key);
        continue;
      }
      owners.set(chore.key, post(chore));
      changed = true;
    }
    for (const key of skipped) if (!seen.has(key)) skipped.delete(key);
    for (const [key, id] of owners) {
      if (seen.has(key)) continue;
      owners.delete(key);
      const mail = mails.get(id);
      if (!mail) continue;
      mail.events.delete(key.slice(0, key.indexOf(':')));
      if (!mail.events.size) mails.delete(id);
      changed = true;
    }
    if (changed) refresh();
  }

  list.addEventListener('click', (event) => {
    const row = event.target.closest('.mail-row');
    if (!row) return;
    const id = Number(row.dataset.id);
    const mail = mails.get(id);
    markRead(id);
    if (!mail || !event.target.closest('.mail-place')) return;
    setOpen(false);
    onTravel(mail.point);
  });
  button.addEventListener('click', () => setOpen(panel.hidden));
  button.addEventListener('pointerup', () => button.blur());
  close.addEventListener('click', () => setOpen(false));
  document.getElementById('bagBtn').addEventListener('click', () => {
    if (isOpen()) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) setOpen(false);
  });

  return { sync, notify, remove };
}
