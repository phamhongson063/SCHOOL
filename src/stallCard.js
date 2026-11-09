import { BANK_ART } from './bankArt.js';
import { paintIcon } from './itemArt.js';
import { amount } from './format.js';
import { setRich } from './goldArt.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function coinArt() {
  const node = el('span', 'bank-coin');
  node.innerHTML = BANK_ART.silver;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function paintStallArt(dialog) {
  for (const node of dialog.querySelectorAll('[data-art]')) {
    node.innerHTML = BANK_ART[node.dataset.art];
    node.setAttribute('aria-hidden', 'true');
  }
}

export function stallCard({ key, icon, art, title, price = null, unit = null, tag = null, detail = null, actions = [], muted = false }) {
  const node = el('div', muted ? 'bank-card stall-card muted' : 'bank-card stall-card');
  const badge = el('span', 'stall-card-icon');
  badge.setAttribute('aria-hidden', 'true');
  paintIcon(badge, { icon, art });
  const text = el('div', 'bank-card-text');
  text.append(el('strong', 'bank-card-title', title));
  if (price !== null) {
    const chip = el('span', 'bank-chip');
    chip.append(coinArt(), el('strong', 'bank-chip-value', amount(price)));
    if (unit) chip.append(el('span', 'stall-chip-unit', `/${unit}`));
    if (tag) chip.append(el('span', 'bank-chip-bar'), el('span', 'bank-chip-rate', tag));
    text.append(chip);
  }
  if (detail) {
    const small = el('small', 'bank-card-detail');
    setRich(small, detail);
    text.append(small);
  }
  const buttons = el('div', 'bank-card-actions');
  for (const [index, action] of actions.entries()) {
    const button = el('button', index === actions.length - 1 ? 'bank-btn primary' : 'bank-btn', action.label);
    button.type = 'button';
    if (key) button.dataset.key = `${key}#${index}`;
    button.disabled = !!action.disabled;
    button.addEventListener('click', action.run);
    buttons.append(button);
  }
  node.append(badge, text, buttons);
  return node;
}
