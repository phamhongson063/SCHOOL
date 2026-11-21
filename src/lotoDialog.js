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
  const calledList = document.getElementById('lotoCalled');
  const grid = document.getElementById('lotoGrid');
  const result = document.getElementById('lotoResult');
  const chip = document.getElementById('lotoChip');
  const chipText = document.getElementById('lotoChipText');
  let words = [];
  let buttons = [];
  let potShown = null;
  let calledShown = null;

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

  function showCalled(called, live) {
    const shown = `${called.length}:${live}`;
    if (shown === calledShown) return;
    calledShown = shown;
    calledList.replaceChildren(
      ...(live ? called.slice(0, -1) : called)
        .reverse()
        .map((call) => {
          const item = document.createElement('span');
          item.textContent = call.text;
          item.lang = call.kind === 'reading' ? 'ja' : 'vi';
          return item;
        }),
    );
    calledList.scrollLeft = 0;
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
    render({ marks, call, called, left, index, count, prize, waiting, live, outcome }) {
      level.textContent = call ? `Lượt ${index + 1}/${count}` : 'Lô tô chữ';
      if (prize !== potShown) {
        potShown = prize;
        setRich(pot, coins(prize));
      }
      kind.textContent = call ? LOTO_CLUE_LABELS[call.kind] : '';
      clue.textContent = call ? call.text : (outcome ?? waiting);
      clue.lang = call?.kind === 'reading' ? 'ja' : 'vi';
      chipText.textContent = call ? call.text : (outcome ?? waiting);
      chipText.lang = clue.lang;
      bar.style.transform = `scaleX(${call ? Math.max(0, left / LOTO.callSeconds) : 0})`;
      showCalled(called, !!call);
      buttons.forEach((button, cell) => {
        const mark = marks?.[cell] ?? OPEN;
        button.className = MARK_CLASS[mark] ?? '';
        button.disabled = !live || mark !== OPEN || !!outcome;
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
