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
  let saved = loadCollapsed();
  let auto = false;
  let peek = false;

  const collapsed = () => (auto ? !peek : saved);

  function paintDot() {
    dot.hidden = !collapsed() || dots.every((node) => node.hidden);
  }

  function paint() {
    const hidden = collapsed();
    toolbar.classList.toggle('collapsed', hidden);
    button.setAttribute('aria-expanded', String(!hidden));
    const label = hidden ? 'Hiện biểu tượng' : 'Ẩn biểu tượng';
    button.title = label;
    button.setAttribute('aria-label', label);
    paintDot();
  }

  button.addEventListener('click', () => {
    if (auto) {
      peek = !peek;
    } else {
      saved = !saved;
      try {
        localStorage.setItem(KEY, saved ? 'collapsed' : 'open');
      } catch {}
    }
    paint();
  });
  button.addEventListener('pointerup', () => button.blur());
  const watch = new MutationObserver(paintDot);
  for (const node of dots) watch.observe(node, { attributes: true, attributeFilter: ['hidden'] });
  paint();

  return {
    autoHide(on) {
      if (auto === on) return;
      auto = on;
      peek = false;
      paint();
    },
  };
}
