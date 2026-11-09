import { paintIcon } from './itemArt.js';
import { setRich } from './goldArt.js';

const MARGIN = 12;

export function createPicker() {
  const panel = document.getElementById('picker');
  const list = panel.querySelector('.picker-options');
  let onPick = null;

  function close() {
    panel.hidden = true;
    onPick = null;
  }

  function option(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'picker-option';
    if (item.label) button.setAttribute('aria-label', item.label);
    const icon = document.createElement('span');
    icon.className = 'picker-option-icon';
    icon.setAttribute('aria-hidden', 'true');
    paintIcon(icon, item);
    const name = document.createElement('span');
    name.className = 'picker-option-label';
    setRich(name, item.name);
    button.append(icon, name);
    button.addEventListener('click', () => {
      const pick = onPick;
      close();
      pick?.(item);
    });
    return button;
  }

  function open({ title, options, x, y }, pick) {
    panel.setAttribute('aria-label', title);
    list.replaceChildren(...options.map(option));
    onPick = pick;
    panel.hidden = false;
    const { width, height } = panel.getBoundingClientRect();
    const left = Math.min(Math.max(MARGIN, x - width / 2), window.innerWidth - width - MARGIN);
    const top = Math.min(Math.max(MARGIN, y - height - 18), window.innerHeight - height - MARGIN);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.setProperty('--tail', `${Math.min(width - 18, Math.max(18, x - left))}px`);
    panel.classList.toggle('tailless', top + height > y - 4);
    list.firstElementChild?.focus({ preventScroll: true });
  }

  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !panel.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });

  return { open, close };
}
