import { RANKING } from './config.js';
import { clockText, dayOf, minuteOfDay, DAY_MINUTES } from './clock.js';
import { amount, coins } from './format.js';
import { PLAYER } from './inventory.js';
import { closable } from './dialog.js';
import { setRich } from './goldArt.js';
import { writeGameItem } from './seal.js';
import { worldKey } from './saveKeys.js';
import { certify } from './certify.js';

const KEY = worldKey('ranking');
const MEDALS = ['🥇', '🥈', '🥉'];
const CHECK_MS = 5000;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Number.isFinite(saved.slot) && Number.isFinite(saved.at) && Array.isArray(saved.rows)) return saved;
  } catch {}
  return null;
}

function latestCheckpoint(minutes) {
  const day = dayOf(minutes);
  const passed = RANKING.hours.filter((hour) => hour <= minuteOfDay(minutes)).length;
  const slot = day * RANKING.hours.length + passed - 1;
  const at = passed > 0 ? day * DAY_MINUTES + RANKING.hours[passed - 1] : (day - 1) * DAY_MINUTES + RANKING.hours.at(-1);
  return { slot, at };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function richSpan(className, text) {
  const node = el('span', className);
  setRich(node, text);
  return node;
}

export function createRanking({ ledger, bank, estate, arena, people, now }) {
  const dialog = document.getElementById('rankDialog');
  const list = document.getElementById('rankList');
  const stamp = document.getElementById('rankStamp');
  const names = new Map(people.map(({ id, name }) => [id, name]));
  const tabs = [...dialog.querySelectorAll('[data-tab]')];
  let board = load();
  let tab = 'worth';

  const titlesOf = (id) => arena.champions.filter((item) => item.id === id).length;
  const worthOf = (id) => Math.floor(ledger.accounts[id]?.money ?? 0) + bank.deposited(id) - bank.debt(id) + (estate.houseOf(id)?.price ?? 0);

  function standings(score, previous) {
    const before = new Map((previous ?? []).map((row) => [row.id, row.score]));
    const rows = people.map(({ id }) => ({ id, score: score(id) })).sort((a, b) => b.score - a.score);
    rows.forEach((row, i) => {
      row.rank = i + 1;
      row.prev = before.get(row.id) ?? null;
    });
    return rows;
  }

  function snapshot({ slot, at }) {
    board = { slot, at, rows: standings(worthOf, board?.rows), certs: standings((id) => certify.certifiedTotal(id), board?.certs), arena: standings(titlesOf, board?.arenaVersion === arena.version ? board?.arena : null), arenaVersion: arena.version };
    try {
      writeGameItem(KEY, JSON.stringify(board));
    } catch {}
  }

  const scoreCell = {
    worth: (worth) => richSpan(worth < 0 ? 'rank-worth debt' : 'rank-worth', coins(worth)),
    certs: (count) => el('span', 'rank-worth', `🎓 ${amount(count)}`),
    arena: (count) => el('span', 'rank-worth', `🏆 ${amount(count)}`),
  };

  function row({ id, score, rank, prev }) {
    const item = el('li', id === PLAYER ? 'rank-row mine' : 'rank-row');
    const change = Number.isFinite(prev) ? score - prev : 0;
    item.append(
      el('span', 'rank-place', MEDALS[rank - 1] ?? String(rank)),
      el('span', 'rank-name', `${names.get(id) ?? 'người khác'}${id === arena.champions[0]?.id ? ' ⚔️' : ''}`),
      scoreCell[tab](score),
      el('span', change > 0 ? 'rank-trend up' : change < 0 ? 'rank-trend down' : 'rank-trend', change > 0 ? `+${amount(change)}` : change < 0 ? `-${amount(-change)}` : ''),
    );
    return item;
  }

  function render() {
    for (const node of tabs) node.setAttribute('aria-selected', String(node.dataset.tab === tab));
    const rows = (tab === 'certs' ? board.certs : tab === 'arena' ? board.arena.filter((entry) => entry.score > 0) : board.rows).filter((entry) => names.has(entry.id));
    list.replaceChildren(...(rows.length ? rows.map(row) : [el('li', 'rank-empty', 'Chưa có nhà vô địch.')]));
    stamp.textContent = `Cập nhật lúc ${clockText(board.at)}`;
  }

  function update() {
    const checkpoint = latestCheckpoint(now());
    if (board?.slot === checkpoint.slot && board.certs && board.arena && board.arenaVersion === arena.version) return;
    snapshot(checkpoint);
    if (dialog.open) render();
  }

  update();
  setInterval(update, CHECK_MS);
  const button = document.getElementById('rankBtn');
  button.addEventListener('click', () => {
    update();
    render();
    dialog.showModal();
  });
  button.addEventListener('pointerup', () => button.blur());
  for (const node of tabs) {
    node.addEventListener('click', () => {
      tab = node.dataset.tab;
      render();
    });
  }
  closable(dialog);
}
