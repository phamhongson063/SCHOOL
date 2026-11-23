import { amount } from './format.js';
import { PLAYER } from './inventory.js';
import { isStashed, unstash } from './popupStash.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const CHECK_MS = 500;
const UPDATE_MS = 60_000;
const MARGIN = 12;
const GAP = 8;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createStandingsBoard({ buttonId, boardId, icon, active, standings, people, every = UPDATE_MS, onPick = () => {} }) {
  const button = document.getElementById(buttonId);
  const board = document.getElementById(boardId);
  const list = board.querySelector('.lantern-board-list');
  const names = new Map(people.map(({ id, name }) => [id, name]));
  let shown = '';
  let rows = null;
  let takenAt = 0;

  function row({ id, score }, i) {
    const item = el('li', id === PLAYER ? 'lantern-board-row mine' : 'lantern-board-row');
    const name = el('button', 'lantern-board-name', names.get(id) ?? 'người khác');
    name.type = 'button';
    name.dataset.id = id;
    item.append(el('span', 'lantern-board-place', MEDALS[i] ?? String(i + 1)), name, el('span', 'lantern-board-score', `${icon} ${amount(score)}`));
    return item;
  }

  function capture() {
    rows = standings().filter((entry) => names.has(entry.id));
    takenAt = performance.now();
  }

  function render() {
    const key = rows.map(({ id, score }) => `${id}:${score}`).join(',');
    if (key === shown && list.childElementCount) return;
    shown = key;
    list.replaceChildren(...(rows.length ? rows.map(row) : [el('li', 'lantern-board-empty', 'Chưa có ai ghi danh.')]));
  }

  function setOpen(open) {
    board.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (!open) return;
    unstash(board);
    if (!rows) capture();
    render();
    place();
  }

  function place() {
    const spot = button.getBoundingClientRect();
    const top = Math.max(MARGIN, Math.min(spot.top, innerHeight - board.offsetHeight - MARGIN));
    board.style.top = `${top}px`;
    board.style.left = `${Math.max(MARGIN, Math.min(spot.right + GAP, innerWidth - board.offsetWidth - MARGIN))}px`;
  }

  function refresh() {
    const on = active();
    button.hidden = !on;
    if (!on) {
      rows = null;
      setOpen(false);
      return;
    }
    if (rows && performance.now() - takenAt < every) return;
    capture();
    if (!board.hidden) {
      render();
      if (!isStashed(board)) place();
    }
  }

  refresh();
  setInterval(refresh, CHECK_MS);
  button.addEventListener('click', () => setOpen(board.hidden));
  button.addEventListener('pointerup', () => button.blur());
  board.querySelector('.picker-x').addEventListener('click', () => setOpen(false));
  list.addEventListener('click', (event) => {
    const name = event.target.closest('.lantern-board-name');
    if (name) onPick(name.dataset.id);
  });
  document.addEventListener('pointerdown', (event) => {
    if (board.hidden || isStashed(board) || board.contains(event.target) || button.contains(event.target)) return;
    if (event.target.closest?.('dialog')) return;
    setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !board.hidden && !isStashed(board)) setOpen(false);
  });
}
