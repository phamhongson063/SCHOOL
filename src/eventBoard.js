import { BLESSING, LOTO } from './config.js';
import { clockText, dayOf, DAY_MINUTES } from './clock.js';
import { arenaStarts } from './arenaSchedule.js';
import { arenaWindow } from './arena.js';
import { blessingSlots } from './economy.js';
import { el } from './dialog.js';

const REFRESH_MS = 3000;
const OTHER_PANELS = [
  ['bagPanel', 'bagClose'],
  ['mailPanel', 'mailClose'],
  ['questPanel', 'questClose'],
];

function eventCard(icon, name, note, spans) {
  const card = el('div', 'event-card');
  const head = el('div', 'event-head');
  head.append(el('span', 'event-icon', icon), el('span', 'event-name', name), el('span', 'event-note', note));
  const times = el('div', 'event-times');
  times.append(...spans.map((text) => el('span', 'event-time', text)));
  card.append(head, times);
  return card;
}

export function createEventBoard({ now }) {
  const button = document.getElementById('eventBtn');
  const panel = document.getElementById('eventPanel');
  const veil = document.getElementById('eventVeil');
  const close = document.getElementById('eventClose');
  const rows = document.getElementById('eventList');

  const isOpen = () => !panel.hidden;

  function render() {
    const day = dayOf(now());
    const blessing = blessingSlots(day);
    const arena = arenaStarts(day).map((start) => arenaWindow({ at: day * DAY_MINUTES + start }));
    const scroll = rows.scrollTop;
    rows.replaceChildren(
      eventCard(
        '✨',
        'Chúc phúc',
        `${blessing.length}/${BLESSING.windows.length} buổi`,
        blessing.map(({ start, end }) => `${clockText(start)}–${clockText(end)}`),
      ),
      eventCard(
        '🏆',
        'Lôi đài',
        `${arena.length} trận`,
        arena.map(({ from, to }) => `${clockText(from)}–${clockText(to)}`),
      ),
      eventCard('🎴', 'Lô tô chữ', '', [clockText(LOTO.start)]),
    );
    rows.scrollTop = scroll;
  }

  function setOpen(open) {
    if (open) {
      for (const [id, closeId] of OTHER_PANELS) {
        if (!document.getElementById(id).hidden) document.getElementById(closeId).click();
      }
      rows.scrollTop = 0;
      render();
    }
    panel.hidden = !open;
    veil.hidden = !open;
    document.body.classList.toggle('event-open', open);
    button.classList.toggle('active', open);
    button.setAttribute('aria-expanded', String(open));
    if (open) close.focus({ preventScroll: true });
  }

  button.addEventListener('click', () => setOpen(panel.hidden));
  button.addEventListener('pointerup', () => button.blur());
  close.addEventListener('click', () => setOpen(false));
  veil.addEventListener('click', () => setOpen(false));
  for (const id of ['bagBtn', 'mailBtn', 'questBtn']) {
    document.getElementById(id).addEventListener('click', () => {
      if (isOpen()) setOpen(false);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) setOpen(false);
  });
  setInterval(() => {
    if (isOpen()) render();
  }, REFRESH_MS);
}
