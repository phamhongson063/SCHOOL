import { clockText, dateText, gameNow } from './clock.js';
import { setRich } from './goldArt.js';
import { coins } from './format.js';

const KEY = 'truong-lang-xua.mail';
const TABS = [
  { key: 'system', icon: '🔔', label: 'Hệ thống', empty: 'Chưa có thư.' },
  { key: 'cert', icon: '🎓', label: 'Chứng chỉ', empty: 'Chưa có kết quả khảo thí.' },
];
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
  const time = document.createElement('span');
  time.className = 'mail-time';
  time.textContent = mail.tab === 'cert' ? `${dateText(mail.at)} ${clockText(mail.at)}` : clockText(mail.at);
  const side = document.createElement('div');
  side.className = 'mail-side';
  side.append(icon, time);
  const main = document.createElement('div');
  main.className = 'mail-main';
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
  if (mail.attach) {
    const gifts = [];
    if (mail.attach.money) gifts.push(coins(mail.attach.money));
    if (mail.attach.intellect) gifts.push(`${mail.attach.intellect} 💡`);
    const claim = document.createElement('button');
    claim.type = 'button';
    claim.className = 'mail-claim';
    claim.disabled = !!mail.claimed;
    setRich(claim, mail.claimed ? `Đã nhận ${gifts.join(' · ')}` : `Nhận ${gifts.join(' · ')}`);
    main.append(claim);
  }
  row.append(side, main);
  return row;
}

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((mail) => mail && Array.isArray(mail.lines) && Number.isFinite(mail.at)) : [];
  } catch {
    return [];
  }
}

export function createMailbox({ onTravel, onClaim = null }) {
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
  let tab = TABS[0];

  for (const saved of loadSaved()) {
    const id = order++;
    mails.set(id, { ...saved, id, order: id, keep: true, tab: TABS.some((item) => item.key === saved.tab) ? saved.tab : 'system' });
  }

  function save() {
    const kept = [...mails.values()].filter((mail) => mail.keep).sort((a, b) => a.order - b.order);
    try {
      localStorage.setItem(KEY, JSON.stringify(kept.map(({ id, order: rank, keep, ...mail }) => mail)));
    } catch {}
  }

  const tabNodes = TABS.map((item) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'bag-tab mail-tab';
    node.setAttribute('role', 'tab');
    node.id = `mailTab-${item.key}`;
    node.setAttribute('aria-controls', 'mailList');
    node.setAttribute('aria-label', item.label);
    node.title = item.label;
    node.textContent = item.icon;
    node.addEventListener('click', () => {
      tab = item;
      paintTabs();
      render();
    });
    tabBar.append(node);
    return node;
  });

  function paintTabs() {
    TABS.forEach((item, i) => {
      const node = tabNodes[i];
      node.setAttribute('aria-selected', String(item === tab));
      node.classList.toggle('unread', [...mails.values()].some((mail) => (mail.tab ?? 'system') === item.key && !mail.read));
    });
    list.setAttribute('aria-labelledby', `mailTab-${tab.key}`);
    category.textContent = ` · ${tab.label}`;
  }
  paintTabs();

  const isOpen = () => !panel.hidden;

  function prune() {
    const now = gameNow();
    let removed = false;
    for (const [id, mail] of mails) {
      if (mail.expires && mail.expires <= now) {
        mails.delete(id);
        removed = true;
      }
    }
    if (removed) save();
    return removed;
  }

  function render() {
    const sorted = [...mails.values()].filter((mail) => (mail.tab ?? 'system') === tab.key).sort((a, b) => b.order - a.order);
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
    paintTabs();
    if (isOpen()) render();
  }

  function markRead(id) {
    const mail = mails.get(id);
    if (!mail || mail.read) return;
    mail.read = true;
    if (mail.keep) save();
    refresh();
  }

  function setOpen(open) {
    if (open && !bagPanel.hidden) document.getElementById('bagClose').click();
    if (open) {
      prune();
      paintTabs();
      render();
    }
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

  function notify({ icon, lines, place = null, point = null, tab: where = 'system', keep = false, expires = null, attach = null, tag = null }) {
    const id = order;
    mails.set(id, { id, icon, lines, place, point, tab: where, keep, expires, attach, claimed: false, tag, at: gameNow(), order: order++, read: false });
    if (keep) save();
    refresh();
    return id;
  }

  function remove(id) {
    const mail = mails.get(id);
    if (!mail) return;
    mails.delete(id);
    if (mail.keep) save();
    refresh();
  }

  function removeTag(tag) {
    for (const [id, mail] of mails) if (mail.tag === tag) remove(id);
  }

  function hasTag(tag) {
    return [...mails.values()].some((mail) => mail.tag === tag);
  }

  function tick() {
    if (prune()) refresh();
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
    if (mail?.attach && !mail.claimed && event.target.closest('.mail-claim')) {
      mail.claimed = true;
      onClaim?.(mail.attach);
      if (mail.keep) save();
      refresh();
      return;
    }
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

  return { sync, notify, remove, removeTag, hasTag, tick };
}
