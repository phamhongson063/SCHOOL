const root = document.documentElement;

const currentElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

const enter = () => {
  if (root.requestFullscreen) return root.requestFullscreen({ navigationUI: 'hide' });
  root.webkitRequestFullscreen?.();
  return Promise.resolve();
};

const exit = () => {
  if (document.exitFullscreen) return document.exitFullscreen();
  document.webkitExitFullscreen?.();
  return Promise.resolve();
};

export function createFullscreenToggle() {
  const group = document.getElementById('fullscreenGroup');
  const button = document.getElementById('fullscreenBtn');
  const label = button.querySelector('.fs-label');
  const supported = Boolean(document.fullscreenEnabled ?? document.webkitFullscreenEnabled);
  if (!supported) return;
  group.hidden = false;

  const sync = () => {
    const active = Boolean(currentElement());
    button.classList.toggle('active', active);
    label.textContent = active ? 'Thoát toàn màn hình' : 'Toàn màn hình';
  };

  button.addEventListener('click', () => {
    const request = currentElement() ? exit() : enter();
    Promise.resolve(request).catch(() => {});
  });
  button.addEventListener('pointerup', () => button.blur());
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  sync();
}
