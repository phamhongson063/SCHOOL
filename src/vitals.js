import { ENERGY } from './config.js';

export function createVitals(purse) {
  const root = document.getElementById('vitals');
  const bar = document.getElementById('energyBar');
  const text = document.getElementById('vitalsText');
  const intellect = document.getElementById('intellectText');
  let shown = null;
  let shownIntellect = null;

  function render() {
    const energy = Math.floor(purse.energy);
    if (energy !== shown) {
      shown = energy;
      const ratio = Math.max(0, Math.min(1, purse.energy / ENERGY.max));
      bar.style.width = `${ratio * 100}%`;
      root.classList.toggle('low', energy < ENERGY.low);
      text.textContent = `${energy}/${ENERGY.max}`;
    }
    if (purse.intellect !== shownIntellect) {
      shownIntellect = purse.intellect;
      intellect.textContent = String(purse.intellect);
    }
    root.setAttribute('aria-label', `Năng lượng ${energy}/${ENERGY.max}, trí lực ${purse.intellect}`);
  }

  render();
  purse.onChange((detail) => {
    if ('energy' in detail || 'intellect' in detail) render();
  });
  return { render };
}
