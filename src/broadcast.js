const EXPAND = 780;
const COLLAPSE = 690;
const SPEED = 80;
const GLOW = 22;
const REDUCED_HOLD = 6000;
const SMOOTH = 'cubic-bezier(0.45, 0, 0.55, 1)';

export function createBroadcast() {
  const root = document.getElementById('broadcast');
  const frame = root.querySelector('.broadcast-frame');
  const track = root.querySelector('.broadcast-track');
  const text = root.querySelector('.broadcast-text');
  const topLayer = typeof root.showPopover === 'function';
  const queue = [];
  let current = null;

  function raise() {
    if (!topLayer || !current) return;
    if (root.matches(':popover-open')) root.hidePopover();
    root.showPopover();
  }

  new MutationObserver(raise).observe(document.body, { subtree: true, attributeFilter: ['open'] });

  const clip = (edge) => `inset(-${GLOW}px ${edge}px -${GLOW}px ${edge}px round 999px)`;

  function play({ loops }) {
    const lane = track.clientWidth;
    const span = text.scrollWidth;
    const shut = clip(frame.offsetWidth / 2);
    const open = clip(-GLOW);
    const pass = ((lane + span) / SPEED) * 1000;
    const scroll = pass * loops;
    const total = EXPAND + scroll + COLLAPSE;
    const at = (time) => time / total;
    frame.style.clipPath = shut;
    text.style.opacity = 0;
    return [
      frame.animate(
        [
          { offset: 0, clipPath: shut, easing: SMOOTH },
          { offset: at(EXPAND), clipPath: open },
          { offset: at(EXPAND + scroll), clipPath: open, easing: SMOOTH },
          { offset: 1, clipPath: shut },
        ],
        { duration: total },
      ),
      text.animate(
        [
          { transform: `translateX(${lane}px)`, opacity: 1 },
          { transform: `translateX(${-span}px)`, opacity: 1 },
        ],
        { duration: pass, delay: EXPAND, iterations: loops },
      ),
    ];
  }

  function begin(item) {
    text.textContent = item.message;
    root.hidden = false;
    current = item;
    raise();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame.style.clipPath = clip(-GLOW);
      text.style.opacity = 1;
      text.style.transform = `translateX(${Math.max(0, (track.clientWidth - text.scrollWidth) / 2)}px)`;
      setTimeout(finish, REDUCED_HOLD);
      return;
    }
    item.timeline = play(item);
    item.timeline[0].finished.then(finish, () => {});
  }

  function finish() {
    for (const animation of current?.timeline ?? []) animation.cancel();
    current = null;
    frame.style.clipPath = clip(frame.offsetWidth / 2);
    text.style.opacity = 0;
    if (topLayer && root.matches(':popover-open')) root.hidePopover();
    root.hidden = true;
    if (queue.length) begin(queue.shift());
  }

  return {
    show(message, { loops = 2 } = {}) {
      const item = { message, loops };
      if (current) queue.push(item);
      else begin(item);
    },
  };
}
