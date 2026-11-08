const root = document.getElementById('loader');
const track = root?.querySelector('.loader-track');
const fill = root?.querySelector('.loader-fill');
const stage = root?.querySelector('.loader-stage');
const label = root?.querySelector('.loader-label');
const HOLD_FULL = 450;
const REMOVE_AFTER = 2600;

let progress = 0;

const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

function shownProgress() {
  const matrix = getComputedStyle(fill).transform;
  if (!matrix || matrix === 'none' || !track.clientWidth) return progress;
  return 1 + new DOMMatrixReadOnly(matrix).m41 / track.clientWidth;
}

function setProgress(value) {
  if (root.classList.contains('booting')) {
    progress = Math.max(progress, shownProgress());
    root.style.setProperty('--p', progress);
    root.classList.remove('booting');
    void fill.offsetWidth;
  }
  progress = Math.min(1, Math.max(progress, value));
  root.style.setProperty('--p', progress);
  root.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
}

function setLabel(text) {
  if (!text || label.textContent === text) return;
  label.textContent = text;
  stage.classList.remove('enter');
  void stage.offsetWidth;
  stage.classList.add('enter');
}

export function loadingStep(value, text) {
  if (!root) return Promise.resolve();
  setProgress(value);
  setLabel(text);
  return nextPaint();
}

export function loadingDone() {
  if (!root) return;
  setProgress(1);
  const remove = () => root.remove();
  root.addEventListener('transitionend', (event) => {
    if (event.target === root && event.propertyName === 'opacity') remove();
  });
  setTimeout(() => root.classList.add('done'), HOLD_FULL);
  setTimeout(remove, HOLD_FULL + REMOVE_AFTER);
}
