const LOW_PERCENT = 20;

export function createBatteryBadge() {
  const root = document.getElementById('battery');
  const fill = root.querySelector('.battery-fill');
  const levels = root.querySelectorAll('.battery-level');
  const topLayer = typeof root.showPopover === 'function';
  let shown = null;

  function raise() {
    if (!topLayer || root.hidden) return;
    if (root.matches(':popover-open')) root.hidePopover();
    root.showPopover();
  }

  new MutationObserver(raise).observe(document.body, { subtree: true, attributeFilter: ['open'] });
  document.addEventListener('fullscreenchange', raise);

  function show(level) {
    const percent = Math.round(Math.max(0, Math.min(1, level)) * 100);
    if (root.hidden) {
      root.hidden = false;
      raise();
    }
    if (percent === shown) return;
    shown = percent;
    fill.style.setProperty('--level', String(percent / 100));
    for (const label of levels) label.textContent = String(percent);
    root.classList.toggle('low', percent <= LOW_PERCENT);
    root.setAttribute('aria-label', `Pin ${percent}%`);
  }

  return { show };
}
