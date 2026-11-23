import { amount } from './format.js';

const FLASH_MS = 900;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const clockOf = (seconds) => {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export function createFireworksPanel() {
  const panel = document.getElementById('fireworksPanel');
  const score = document.getElementById('fireworksScore');
  const clock = document.getElementById('fireworksClock');
  const reading = document.getElementById('fireworksReading');
  const meaning = document.getElementById('fireworksMeaning');
  const slots = document.getElementById('fireworksSlots');
  const bar = document.getElementById('fireworksBar');
  const flash = document.getElementById('fireworksFlash');
  let shownWord = null;
  let shownFill = '';
  let flashTimer = 0;

  function buildSlots(count) {
    slots.replaceChildren(...Array.from({ length: count }, () => el('span', 'fireworks-slot')));
  }

  return {
    show(on) {
      panel.hidden = !on;
      if (!on) shownWord = null;
    },
    get open() {
      return !panel.hidden;
    },
    render({ word, reading: kana, meaning: gloss, size, filled, wrong, left, limit, points, showLeft }) {
      if (word !== shownWord) {
        shownWord = word;
        shownFill = '';
        reading.textContent = kana;
        meaning.textContent = gloss;
        buildSlots(size);
      }
      const fill = `${filled.join('')}|${wrong}`;
      if (fill !== shownFill) {
        shownFill = fill;
        [...slots.children].forEach((slot, i) => {
          slot.textContent = filled[i] ?? '';
          slot.classList.toggle('filled', i < filled.length);
          slot.classList.toggle('wrong', wrong && i === filled.length - 1);
          slot.classList.toggle('next', i === filled.length && !wrong);
        });
      }
      bar.style.transform = `scaleX(${limit > 0 ? Math.max(0, Math.min(1, left / limit)) : 0})`;
      score.textContent = `🎆 ${amount(points)}`;
      clock.textContent = clockOf(showLeft);
    },
    flash(kind, text) {
      flash.textContent = text;
      flash.className = `fireworks-flash ${kind}`;
      panel.classList.remove('shake');
      if (kind === 'wrong') {
        void panel.offsetWidth;
        panel.classList.add('shake');
      }
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flash.textContent = '';
        flash.className = 'fireworks-flash';
      }, FLASH_MS);
    },
  };
}
