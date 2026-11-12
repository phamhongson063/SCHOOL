import { RANKING } from './config.js';
import { clockText, dayOf, minuteOfDay, DAY_MINUTES } from './clock.js';
import { amount, coins } from './format.js';
import { PLAYER } from './inventory.js';
import { closable } from './dialog.js';
import { setRich } from './goldArt.js';
import { writeGameItem } from './seal.js';

const KEY = 'truong-lang-xua.ranking';
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

export function createRanking({ ledger, bank, estate, people, now }) {
  const dialog = document.getElementById('rankDialog');
  const list = document.getElementById('rankList');
  const stamp = document.getElementById('rankStamp');
  const names = new Map(people.map(({ id, name }) => [id, name]));
  let board = load();

  const worthOf = (id) => Math.floor(ledger.accounts[id]?.money ?? 0) + bank.deposited(id) - bank.debt(id) + (estate.houseOf(id)?.price ?? 0);

  function snapshot({ slot, at }) {
    const before = new Map((board?.rows ?? []).map((row) => [row.id, row.worth]));
    const rows = people.map(({ id }) => ({ id, worth: worthOf(id) })).sort((a, b) => b.worth - a.worth);
    rows.forEach((row, i) => {
      row.rank = i + 1;
      row.prevWorth = before.get(row.id) ?? null;
    });
    board = { slot, at, rows };
    try {
      writeGameItem(KEY, JSON.stringify(board));
    } catch {}
  }

  function row({ id, worth, rank, prevWorth }) {
    const item = el('li', id === PLAYER ? 'rank-row mine' : 'rank-row');
    const change = Number.isFinite(prevWorth) ? worth - prevWorth : 0;
    item.append(
      el('span', 'rank-place', MEDALS[rank - 1] ?? String(rank)),
      el('span', 'rank-name', names.get(id) ?? 'người khác'),
      richSpan(worth < 0 ? 'rank-worth debt' : 'rank-worth', coins(worth)),
      el('span', change > 0 ? 'rank-trend up' : change < 0 ? 'rank-trend down' : 'rank-trend', change > 0 ? `+${amount(change)}` : change < 0 ? `-${amount(-change)}` : ''),
    );
    return item;
  }

  function render() {
    list.replaceChildren(...board.rows.filter((entry) => names.has(entry.id)).map(row));
    stamp.textContent = `Cập nhật lúc ${clockText(board.at)}`;
  }

  function update() {
    const checkpoint = latestCheckpoint(now());
    if (board?.slot === checkpoint.slot) return;
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
  closable(dialog);
}
