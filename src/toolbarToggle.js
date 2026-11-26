import { PREFIX } from './saveKeys.js';

const KEY = PREFIX + 'toolbar';
const DOTS = ['mailDot', 'questDot'];

function loadCollapsed() {
  try {
    return localStorage.getItem(KEY) === 'collapsed';
  } catch {
    return false;
  }
}

export function createToolbarToggle() {
  const toolbar = document.getElementById('toolbar');
  const button = document.getElementById('toolbarToggle');
  const dot = document.getElementById('toolbarDot');
  const dots = DOTS.map((id) => document.getElementById(id));

  function paintDot() {
    dot.hidden = !toolbar.classList.contains('collapsed') || dots.every((node) => node.hidden);
  }

  function setCollapsed(collapsed) {
    toolbar.classList.toggle('collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Hiện biểu tượng' : 'Ẩn biểu tượng';
    button.title = label;
    button.setAttribute('aria-label', label);
    paintDot();
  }

  button.addEventListener('click', () => {
    const collapsed = !toolbar.classList.contains('collapsed');
    setCollapsed(collapsed);
    try {
      localStorage.setItem(KEY, collapsed ? 'collapsed' : 'open');
    } catch {}
  });
  button.addEventListener('pointerup', () => button.blur());
  const watch = new MutationObserver(paintDot);
  for (const node of dots) watch.observe(node, { attributes: true, attributeFilter: ['hidden'] });
  setCollapsed(loadCollapsed());
}
