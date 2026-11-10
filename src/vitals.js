import { ENERGY } from './config.js';

export function createVitals(purse) {
  const root = document.getElementById('vitals');
  const bar = document.getElementById('energyBar');
  const text = document.getElementById('vitalsText');
  let shown = null;

  function render() {
    const energy = Math.floor(purse.energy);
    if (energy === shown) return;
    shown = energy;
    const ratio = Math.max(0, Math.min(1, purse.energy / ENERGY.max));
    bar.style.width = `${ratio * 100}%`;
    const low = energy < ENERGY.low;
    root.classList.toggle('low', low);
    const label = `Năng lượng ${energy}/${ENERGY.max}`;
    root.setAttribute('aria-label', label);
    text.textContent = `${energy}/${ENERGY.max}`;
  }

  render();
  purse.onChange((detail) => {
    if ('energy' in detail) render();
  });
  return { render };
}
