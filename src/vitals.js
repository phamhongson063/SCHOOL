import { ENERGY } from './config.js';

export function createVitals(purse) {
  const root = document.getElementById('vitals');
  const bar = document.getElementById('energyBar');
  const text = document.getElementById('vitalsText');
  let shown = null;

  function render() {
    const energy = Math.floor(purse.energy);
    if (energy !== shown) {
      shown = energy;
      const ratio = Math.max(0, Math.min(1, purse.energy / ENERGY.max));
      bar.style.width = `${ratio * 100}%`;
      root.classList.toggle('low', energy < ENERGY.low);
      text.textContent = `${energy}/${ENERGY.max}`;
    }
    root.setAttribute('aria-label', `Năng lượng ${energy}/${ENERGY.max}`);
  }

  render();
  purse.onChange((detail) => {
    if ('energy' in detail) render();
  });
  return { render };
}
