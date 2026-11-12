const LOCK = 'truong-lang-xua.game';
const loader = document.getElementById('loader');
const label = loader?.querySelector('.loader-label');
const idleLabel = label?.textContent;
const waiting = new AbortController();
let releaseLock = () => {};

const holdWhileOpen = () => new Promise((resolve) => (releaseLock = resolve));

function startGame() {
  if (loader?.classList.contains('blocked')) {
    loader.classList.remove('blocked');
    label.textContent = idleLabel;
  }
  import('./main.js');
  return holdWhileOpen();
}

function showBlocked() {
  if (!loader) return;
  loader.classList.add('blocked');
  label.textContent = 'Game đang mở ở một tab khác';
}

addEventListener('pagehide', (event) => {
  if (!event.persisted) return;
  waiting.abort();
  releaseLock();
});

addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});

if (!navigator.locks) import('./main.js');
else {
  navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => {
    if (lock) return startGame();
    showBlocked();
    navigator.locks.request(LOCK, { signal: waiting.signal }, startGame).catch(() => {});
  });
}
