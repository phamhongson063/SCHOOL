import { ENERGY } from './config.js';

const RING = 2 * Math.PI * 29;

export function createVitals(purse) {
  const root = document.getElementById('vitals');
  const ring = document.getElementById('energyRing');
  const text = document.getElementById('vitalsText');
  ring.style.strokeDasharray = `${RING}`;
  let shown = null;

  function render() {
    const energy = Math.floor(purse.energy);
    if (energy === shown) return;
    shown = energy;
    const ratio = Math.max(0, Math.min(1, purse.energy / ENERGY.max));
    ring.style.strokeDashoffset = `${RING * (1 - ratio)}`;
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
