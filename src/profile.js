import { amount, coins } from './format.js';
import { dateText, durationText, DAY_MINUTES } from './clock.js';
import { closable } from './dialog.js';
import { setRich } from './goldArt.js';
import { certify } from './certify.js';
import { homelandOf, netWorth, habitsOf, abilitiesOf, certifiedDecks, certifiedRows } from './profileRules.js';

const ROW = 50;
const OVERSCAN = 6;
const RADAR = 40;
const HABITS = { farm: '🌾', fish: '🎣', hunt: '🏹', study: '📖', blessing: '🙏', loto: '🎴' };
const SKILL_LABELS = { farm: 'Làm ruộng', fish: 'Câu cá', hunt: 'Săn bắt' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const percent = (value) => `${Math.round(value * 100)}%`;

function point(i, count, radius) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

const polygon = (count, radiusOf) =>
  Array.from({ length: count }, (_, i) => point(i, count, radiusOf(i)).map((value) => value.toFixed(1)).join(',')).join(' ');

function radarMarkup(habits) {
  const count = habits.length;
  const top = habits.some((habit) => habit.share > 0) ? habits.reduce((best, habit, i) => (habit.share > habits[best].share ? i : best), 0) : -1;
  const rings = [0.25, 0.5, 0.75, 1].map((ring) => `<polygon class="radar-ring" points="${polygon(count, () => RADAR * ring)}"/>`).join('');
  const spokes = habits
    .map((_, i) => {
      const [x, y] = point(i, count, RADAR);
      return `<line class="radar-spoke" x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    })
    .join('');
  const shape = `<polygon class="radar-shape" points="${polygon(count, (i) => RADAR * (0.12 + 0.88 * habits[i].share))}"/>`;
  const labels = habits
    .map((habit, i) => {
      const [x, y] = point(i, count, RADAR + 11);
      return `<text class="radar-icon${i === top ? ' top' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${HABITS[habit.kind]}</text>`;
    })
    .join('');
  return rings + spokes + shape + labels;
}

function createCertList(scroller, track) {
  const shown = new Map();
  const spare = [];
  let rows = [];
  let frame = 0;

  function fill(node, row, i) {
    node.style.transform = `translateY(${i * ROW}px)`;
    node.firstChild.firstChild.textContent = row.title;
    node.firstChild.lastChild.textContent = row.reading;
    node.children[1].textContent = row.meaning;
    node.lastChild.textContent = dateText(row.day * DAY_MINUTES);
  }

  function make() {
    const node = el('div', 'profile-cert');
    const word = el('span', 'profile-cert-word');
    word.append(el('span', 'profile-cert-title'), el('small', 'profile-cert-reading'));
    node.append(word, el('span', 'profile-cert-mean'), el('span', 'profile-cert-day'));
    return node;
  }

  function draw() {
    frame = 0;
    const top = scroller.scrollTop;
    const from = Math.max(0, Math.floor(top / ROW) - OVERSCAN);
    const to = Math.min(rows.length, Math.ceil((top + scroller.clientHeight) / ROW) + OVERSCAN);
    for (const [i, node] of shown) {
      if (i >= from && i < to) continue;
      shown.delete(i);
      spare.push(node);
    }
    const added = [];
    for (let i = from; i < to; i++) {
      if (shown.has(i)) continue;
      const node = spare.pop() ?? make();
      fill(node, rows[i], i);
      shown.set(i, node);
      if (!node.isConnected) added.push(node);
    }
    for (const node of spare) node.remove();
    if (added.length) track.append(...added);
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  scroller.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(scroller);

  return {
    show(list) {
      rows = list;
      for (const node of shown.values()) spare.push(node);
      shown.clear();
      track.style.height = `${list.length * ROW}px`;
      scroller.scrollTop = 0;
      draw();
    },
  };
}

export function createProfile({ ledger, bank, estate, arena, people, portraitOf, assetsOf = () => [], takesPart = () => true, canLocate = () => false, onLocate = () => {}, onTravel = () => {}, self = null, onReset = () => {} }) {
  const dialog = document.getElementById('profileDialog');
  const title = document.getElementById('profileName');
  const locate = document.getElementById('profileLocate');
  const portrait = document.getElementById('profilePortrait');
  const initial = document.getElementById('profileInitial');
  const radar = document.getElementById('profileRadar');
  const info = document.getElementById('profileInfo');
  const certs = document.getElementById('profileCerts');
  const deckBar = document.getElementById('profileDecks');
  const scroller = document.getElementById('profileScroll');
  const empty = document.getElementById('profileEmpty');
  const assets = document.getElementById('profileAssets');
  const tabs = [...dialog.querySelectorAll('.profile-tabs [data-tab]')];
  const resetArea = document.getElementById('profileReset');
  const reset = document.getElementById('resetBtn');
  const confirmBox = document.getElementById('resetConfirm');
  const confirm = document.getElementById('resetConfirmBtn');
  const cancel = document.getElementById('resetCancel');
  const list = createCertList(scroller, scroller.firstElementChild);
  const names = new Map(people.map(({ id, name }) => [id, name]));
  let current = null;
  let tab = 'info';
  let deck = null;

  function infoRow(label, value) {
    const term = el('dt', '', label);
    const detail = el('dd');
    if (value instanceof Node) detail.append(value);
    else setRich(detail, value);
    info.append(term, detail);
  }

  function bar(share) {
    const node = el('span', 'profile-bar');
    const fill = el('span', 'profile-bar-fill');
    fill.style.width = percent(share);
    node.append(fill, el('span', 'profile-bar-text', percent(share)));
    return node;
  }

  function renderInfo() {
    const { id } = current;
    const land = homelandOf(id, names.get(id));
    const house = estate.houseOf(id);
    const { diligence, skills } = abilitiesOf(id, takesPart(id));
    info.replaceChildren();
    if (land) infoRow('Quốc gia', `${land.flag} ${land.name}`);
    infoRow('Tài sản', coins(netWorth(id, { ledger, bank, estate })));
    infoRow('Nhà ở', house ? estate.sizeName(house) : 'Chưa có');
    infoRow('Chứng chỉ', `🎓 ${amount(certify.certifiedTotal(id))}`);
    infoRow('Lôi đài', `🏆 ${amount(arena.titlesOf(id))}`);
    infoRow('Siêng năng', bar(diligence));
    for (const skill of skills) infoRow(SKILL_LABELS[skill.kind], bar(skill.share));
  }

  function renderDecks() {
    const decks = certifiedDecks(current.id);
    if (!decks.some((item) => item.deck === deck)) deck = (decks.find((item) => item.count > 0) ?? decks[0]).deck;
    deckBar.replaceChildren(
      ...decks.map((item) => {
        const node = el('button', 'profile-deck');
        node.type = 'button';
        node.setAttribute('role', 'tab');
        node.dataset.deck = item.deck;
        node.setAttribute('aria-selected', String(item.deck === deck));
        node.append(el('span', '', item.title), el('span', 'profile-deck-count', amount(item.count)));
        return node;
      }),
    );
    const rows = certifiedRows(current.id, deck);
    empty.hidden = rows.length > 0;
    list.show(rows);
  }

  function assetRow(item) {
    const node = el('button', 'profile-asset');
    node.type = 'button';
    node.disabled = !item.point;
    const text = el('span', 'profile-asset-text');
    text.append(el('span', 'profile-asset-title', item.title), el('small', 'profile-asset-detail', item.detail));
    const badges = el('span', 'profile-asset-badges');
    badges.append(...(item.badges ?? []).map((badge) => el('span', 'profile-asset-badge', badge)));
    node.append(el('span', 'profile-asset-icon', item.icon), text, badges, el('span', 'profile-asset-go', '➜'));
    node.addEventListener('click', () => onTravel(item.point));
    return node;
  }

  function renderAssets() {
    const items = assetsOf(current.id).map((item) => (item.left === undefined ? item : { ...item, detail: `Còn ${durationText(item.left)}` }));
    assets.replaceChildren(...(items.length ? items.map(assetRow) : [el('p', 'profile-empty', 'Chưa có tài sản.')]));
  }

  function showConfirm(shown) {
    confirmBox.hidden = !shown;
    reset.hidden = shown;
  }

  function renderTab() {
    for (const node of tabs) node.setAttribute('aria-selected', String(node.dataset.tab === tab));
    showConfirm(false);
    resetArea.hidden = tab !== 'info' || current.id !== self;
    info.hidden = tab !== 'info';
    certs.hidden = tab !== 'certs';
    assets.hidden = tab !== 'assets';
    if (tab === 'info') renderInfo();
    else if (tab === 'certs') renderDecks();
    else renderAssets();
  }

  function renderSide() {
    const { id } = current;
    const src = portraitOf(id);
    portrait.hidden = !src;
    initial.hidden = !!src;
    if (src) portrait.src = src;
    else initial.textContent = (names.get(id) ?? '?').slice(0, 1).toUpperCase();
    radar.innerHTML = radarMarkup(habitsOf(id, takesPart(id)));
  }

  for (const node of tabs) {
    node.addEventListener('click', () => {
      tab = node.dataset.tab;
      renderTab();
    });
  }
  deckBar.addEventListener('click', (event) => {
    const node = event.target.closest('[data-deck]');
    if (!node || node.dataset.deck === deck) return;
    deck = node.dataset.deck;
    renderDecks();
  });
  reset.addEventListener('click', () => showConfirm(true));
  cancel.addEventListener('click', () => showConfirm(false));
  confirm.addEventListener('click', () => {
    confirm.disabled = true;
    onReset();
  });
  locate.addEventListener('click', () => {
    if (!current) return;
    onLocate(current.id);
  });
  closable(dialog);

  return {
    open(id) {
      if (!names.has(id)) return;
      current = { id };
      deck = null;
      title.textContent = names.get(id);
      locate.hidden = !canLocate(id);
      renderSide();
      if (!dialog.open) dialog.showModal();
      renderTab();
    },
  };
}
