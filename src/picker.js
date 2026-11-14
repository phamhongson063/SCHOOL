import { paintIcon } from './itemArt.js';
import { setRich } from './goldArt.js';

const MARGIN = 12;
const MIN_TITLE_SIZE = 11;

export function createPicker() {
  const panel = document.getElementById('picker');
  const list = panel.querySelector('.picker-options');
  const head = panel.querySelector('.picker-head');
  const heading = head.querySelector('.picker-title');
  let onPick = null;

  function close() {
    panel.hidden = true;
    onPick = null;
  }

  function option(item) {
    const button = document.createElement(item.info ? 'div' : 'button');
    if (!item.info) button.type = 'button';
    button.className = item.info ? 'picker-option picker-info' : 'picker-option';
    if (item.label) button.setAttribute('aria-label', item.label);
    const icon = document.createElement('span');
    icon.className = 'picker-option-icon';
    icon.setAttribute('aria-hidden', 'true');
    paintIcon(icon, item);
    const name = document.createElement('span');
    name.className = 'picker-option-label';
    setRich(name, item.name);
    button.append(icon, name);
    if (item.info) return button;
    button.addEventListener('click', () => {
      const pick = onPick;
      close();
      pick?.(item);
    });
    return button;
  }

  function fitTitle() {
    heading.style.fontSize = '';
    let size = parseFloat(getComputedStyle(heading).fontSize);
    while (heading.scrollWidth > heading.clientWidth && size > MIN_TITLE_SIZE) {
      size -= 1;
      heading.style.fontSize = `${size}px`;
    }
  }

  function open({ title, options, x, y, menu = false }, pick) {
    panel.setAttribute('aria-label', title);
    panel.classList.toggle('menu', menu);
    heading.textContent = title;
    head.hidden = !menu;
    list.replaceChildren(...options.map(option));
    onPick = pick;
    panel.hidden = false;
    if (menu) fitTitle();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = menu ? (window.innerWidth - width) / 2 : Math.min(Math.max(MARGIN, x - width / 2), window.innerWidth - width - MARGIN);
    const top = menu ? (window.innerHeight - height) / 2 : Math.min(Math.max(MARGIN, y - height - 18), window.innerHeight - height - MARGIN);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.setProperty('--tail', `${Math.min(width - 18, Math.max(18, x - left))}px`);
    panel.classList.toggle('tailless', menu || top + height > y - 4);
    list.firstElementChild?.focus({ preventScroll: true });
  }

  head.querySelector('.picker-x').addEventListener('click', close);

  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !panel.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });

  return { open, close };
}
