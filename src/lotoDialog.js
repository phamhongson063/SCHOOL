import { LOTO } from './config.js';
import { coins } from './format.js';
import { setRich } from './goldArt.js';
import { HIT, LOCKED, LOTO_CLUE_LABELS, MISSED, OPEN } from './lotoRules.js';

const MARK_CLASS = { [HIT]: 'hit', [LOCKED]: 'locked', [MISSED]: 'missed' };

export function createLotoDialog({ onTap }) {
  const dialog = document.getElementById('lotoDialog');
  const level = document.getElementById('lotoLevel');
  const pot = document.getElementById('lotoPot');
  const bar = document.getElementById('lotoBar');
  const kind = document.getElementById('lotoKind');
  const clue = document.getElementById('lotoClue');
  const grid = document.getElementById('lotoGrid');
  const result = document.getElementById('lotoResult');
  let words = [];
  let buttons = [];
  let potShown = null;

  document.getElementById('lotoClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dialog.close();
  });

  function build(next) {
    words = next;
    buttons = next.map((word, cell) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = word;
      button.addEventListener('click', () => onTap(cell));
      return button;
    });
    grid.replaceChildren(...buttons);
  }

  return {
    get isOpen() {
      return dialog.open;
    },
    open(next) {
      if (next.join('|') !== words.join('|')) build(next);
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
    render({ marks, call, left, index, count, prize, waiting, outcome }) {
      level.textContent = call ? `Lượt ${index + 1}/${count}` : 'Lô tô chữ';
      if (prize !== potShown) {
        potShown = prize;
        setRich(pot, coins(prize));
      }
      kind.textContent = call ? LOTO_CLUE_LABELS[call.kind] : '';
      clue.textContent = call ? call.text : waiting;
      clue.lang = call?.kind === 'reading' ? 'ja' : 'vi';
      bar.style.transform = `scaleX(${call ? Math.max(0, left / LOTO.callSeconds) : 0})`;
      buttons.forEach((button, cell) => {
        const mark = marks?.[cell] ?? OPEN;
        button.className = MARK_CLASS[mark] ?? '';
        button.disabled = !call || mark !== OPEN || !!outcome;
      });
      result.textContent = outcome ?? '';
    },
  };
}

export function createLotoSign() {
  const dialog = document.getElementById('lotoSignDialog');
  const text = document.getElementById('lotoSignText');
  const yes = document.getElementById('lotoSignYes');
  const no = document.getElementById('lotoSignNo');
  let confirmed = null;
  no.addEventListener('click', () => dialog.close());
  yes.addEventListener('click', () => {
    dialog.close();
    confirmed?.();
  });
  return {
    get isOpen() {
      return dialog.open;
    },
    show(message, accept = null) {
      text.textContent = message;
      confirmed = accept;
      no.hidden = !accept;
      yes.textContent = accept ? 'Mua vé' : 'OK';
      dialog.showModal();
      yes.focus({ preventScroll: true });
    },
  };
}
