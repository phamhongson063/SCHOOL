import { ITEMS } from './inventory.js';

export function createBag(inventory) {
  const button = document.getElementById('bagBtn');
  const panel = document.getElementById('bagPanel');
  const slots = panel.querySelector('.bag-slots');
  const empty = panel.querySelector('.bag-empty');

  function render() {
    const entries = inventory.entries();
    slots.replaceChildren(
      ...entries.map(([id, amount]) => {
        const item = ITEMS[id];
        const slot = document.createElement('div');
        slot.className = 'bag-slot';
        slot.title = `${item.name}: ${amount}`;
        slot.setAttribute('aria-label', `${item.name}: ${amount}`);
        const icon = document.createElement('span');
        icon.className = 'bag-slot-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = item.icon;
        const count = document.createElement('span');
        count.className = 'bag-slot-count';
        count.textContent = amount;
        slot.append(icon, count);
        return slot;
      }),
    );
    empty.hidden = entries.length > 0;
  }

  function setOpen(open) {
    if (open) render();
    panel.hidden = !open;
    button.classList.toggle('active', open);
    button.setAttribute('aria-expanded', String(open));
  }

  button.addEventListener('click', () => setOpen(panel.hidden));
  button.addEventListener('pointerup', () => button.blur());
  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  inventory.onChange(() => {
    if (!panel.hidden) render();
    button.classList.remove('bump');
    void button.offsetWidth;
    button.classList.add('bump');
  });
}
