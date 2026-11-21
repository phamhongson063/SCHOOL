import { LOTO } from './config.js';
import { coins } from './format.js';
import { setRich } from './goldArt.js';
import { HIT, LOCKED, MISSED, OPEN } from './lotoRules.js';

const MARK_CLASS = { [HIT]: 'hit', [LOCKED]: 'locked', [MISSED]: 'missed' };

export function createLotoDialog({ onTap }) {
  const dialog = document.getElementById('lotoDialog');
  const level = document.getElementById('lotoLevel');
  const pot = document.getElementById('lotoPot');
  const bar = document.getElementById('lotoBar');
  const clue = document.getElementById('lotoClue');
  const grid = document.getElementById('lotoGrid');
  const result = document.getElementById('lotoResult');
  const chip = document.getElementById('lotoChip');
  const chipText = document.getElementById('lotoChipText');
  let words = [];
  let buttons = [];
  let potShown = null;

  const fold = () => {
    dialog.close();
    chip.hidden = false;
  };
  const unfold = () => {
    chip.hidden = true;
    if (!dialog.open) dialog.show();
  };
  const close = () => {
    chip.hidden = true;
    if (dialog.open) dialog.close();
  };

  document.getElementById('lotoFold').addEventListener('click', fold);
  document.getElementById('lotoClose').addEventListener('click', close);
  chip.addEventListener('click', unfold);

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
      return dialog.open || !chip.hidden;
    },
    open(next) {
      if (next.join('|') !== words.join('|')) build(next);
      unfold();
    },
    close,
    render({ marks, call, round, turn, size, left, prize, waiting, outcome }) {
      level.textContent = call ? `Vòng ${round} · ${turn}/${size}` : 'Lô tô chữ';
      if (prize !== potShown) {
        potShown = prize;
        setRich(pot, coins(prize));
      }
      clue.textContent = call ? call.text : (outcome ?? waiting);
      clue.lang = call?.kind === 'reading' ? 'ja' : 'vi';
      chipText.textContent = call ? call.text : (outcome ?? waiting);
      chipText.lang = clue.lang;
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
