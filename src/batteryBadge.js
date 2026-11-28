const LOW_PERCENT = 20;

export function createBatteryBadge() {
  const root = document.getElementById('battery');
  const fill = root.querySelector('.battery-fill');
  const levels = root.querySelectorAll('.battery-level');
  let shown = null;

  function show(level) {
    const percent = Math.round(Math.max(0, Math.min(1, level)) * 100);
    root.hidden = false;
    if (percent === shown) return;
    shown = percent;
    fill.style.setProperty('--level', String(percent / 100));
    for (const label of levels) label.textContent = String(percent);
    root.classList.toggle('low', percent <= LOW_PERCENT);
    root.setAttribute('aria-label', `Pin ${percent}%`);
  }

  return { show };
}
