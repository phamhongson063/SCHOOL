import { el } from './dialog.js';

const FLASH_MS = 900;
const READING_SIZE = 20;
const READING_MIN = 14;
const LOW_SECONDS = 5;
const RING = 2 * Math.PI * 15;

export function createFireworksPanel() {
  const panel = document.getElementById('fireworksPanel');
  const reading = document.getElementById('fireworksReading');
  const meaning = document.getElementById('fireworksMeaning');
  const slots = document.getElementById('fireworksSlots');
  const timer = document.getElementById('fireworksTimer');
  const ring = document.getElementById('fireworksRing');
  ring.style.strokeDasharray = `${RING}`;
  const flash = document.getElementById('fireworksFlash');
  let shownWord = null;
  let shownFill = null;
  let flashTimer = 0;

  function fitReading() {
    reading.style.fontSize = `${READING_SIZE}px`;
    const room = reading.clientWidth;
    const need = reading.scrollWidth;
    if (room > 0 && need > room) reading.style.fontSize = `${Math.max(READING_MIN, Math.floor((READING_SIZE * room) / need))}px`;
  }

  function paintSlots(size, filled) {
    slots.replaceChildren(
      ...Array.from({ length: size }, (_, i) => (i < filled.length ? el('span', 'fireworks-glyph', filled[i]) : el('span', i === filled.length ? 'fireworks-dot next' : 'fireworks-dot'))),
    );
  }

  return {
    show(on) {
      panel.hidden = !on;
      if (!on) shownWord = null;
    },
    get open() {
      return !panel.hidden;
    },
    render({ word, reading: kana, meaning: gloss, size, filled, left, limit }) {
      if (word !== shownWord) {
        shownWord = word;
        shownFill = null;
        reading.textContent = kana;
        meaning.textContent = gloss;
        fitReading();
      }
      const fill = filled.join('');
      if (fill !== shownFill) {
        shownFill = fill;
        paintSlots(size, filled);
      }
      const share = limit > 0 ? Math.max(0, Math.min(1, left / limit)) : 0;
      ring.style.strokeDashoffset = `${RING * (1 - share)}`;
      timer.classList.toggle('low', left <= LOW_SECONDS);
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
